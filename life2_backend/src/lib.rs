//! Life2 v2: Territory-Based Game of Life
//!
//! A 512x512 toroidal grid running Conway's Game of Life at 10 generations/second
//! with base-centric territory control. Key v2 changes:
//! - No coins on cells - coins centralized in player bases
//! - Territory must connect orthogonally to base
//! - 8x8 bases with siege mechanics
//! - Optimized bitmap-based implementation

use candid::{CandidType, Deserialize, Principal};
use ic_cdk::{init, post_upgrade, pre_upgrade, query, update};
use std::cell::RefCell;
use std::collections::HashMap;
use std::time::Duration;

// ============================================================================
// CONSTANTS
// ============================================================================

const GRID_SIZE: u16 = 512;
const GRID_SHIFT: usize = 9; // 2^9 = 512
const GRID_MASK: u16 = 0x1FF; // 511
const TOTAL_CELLS: usize = 512 * 512; // 262,144
const GRID_WORDS: usize = TOTAL_CELLS / 64; // 4,096 u64s for bitsets
const WORDS_PER_ROW: usize = 8; // 512 cells / 64 bits = 8 words

// Chunks for sparse territory
const CHUNK_SIZE: u16 = 64;
const CHUNKS_PER_ROW: usize = 8; // 512 / 64
const TOTAL_CHUNKS: usize = 64; // 8 × 8

// Quadrants for wipe
const QUADRANT_SIZE: u16 = 128;
const QUADRANTS_PER_ROW: usize = 4; // 512 / 128
const TOTAL_QUADRANTS: usize = 16; // 4 × 4

// Players
const MAX_PLAYERS: usize = 8;

// Economy
const FAUCET_AMOUNT: u64 = 1000;
const BASE_COST: u64 = 100;
const PLACEMENT_COST: u64 = 1;
const MAX_PLACE_CELLS: usize = 1000;

// Timing
const GENERATIONS_PER_TICK: u32 = 10;
const TICK_INTERVAL_MS: u64 = 1000;
const WIPE_INTERVAL_NS: u64 = 300_000_000_000; // 5 minutes
const GRACE_PERIOD_NS: u64 = 600_000_000_000; // 10 minutes

// Base
const BASE_SIZE: u16 = 8;
const BASE_INTERIOR: u16 = 6;

// ============================================================================
// DATA STRUCTURES
// ============================================================================

/// Sparse territory storage for a single player
/// Uses chunk_mask to track which 64x64 chunks contain territory
#[derive(Clone, Default, CandidType, Deserialize)]
struct PlayerTerritory {
    /// Bit mask where bit i = 1 means chunk i has territory data
    chunk_mask: u64,
    /// Only non-empty chunks are stored (indexed via popcount)
    chunks: Vec<[u64; 64]>,
}

/// Player base structure
#[derive(Clone, Copy, CandidType, Deserialize)]
struct Base {
    x: u16,      // Top-left X coordinate
    y: u16,      // Top-left Y coordinate
    coins: u64,  // Treasury (0 = eliminated)
}

/// BFS workspace for disconnection detection
/// Pre-allocated to avoid runtime allocation
struct BFSWorkspace {
    visited: [u64; GRID_WORDS], // Dense bitmap for fast lookup
    touched_words: Vec<u16>,    // Track words to clear
    queue: Vec<u32>,            // BFS queue of cell indices
}

impl BFSWorkspace {
    fn new() -> Self {
        Self {
            visited: [0u64; GRID_WORDS],
            touched_words: Vec::with_capacity(512),
            queue: Vec::with_capacity(5000),
        }
    }

    fn clear(&mut self) {
        for &word_idx in &self.touched_words {
            self.visited[word_idx as usize] = 0;
        }
        self.touched_words.clear();
        self.queue.clear();
    }

    fn mark_visited(&mut self, x: u16, y: u16) -> bool {
        let idx = coords_to_idx(x, y);
        let word_idx = idx >> 6;
        let bit_pos = idx & 63;

        let was_visited = (self.visited[word_idx] >> bit_pos) & 1 == 1;
        if !was_visited {
            if self.visited[word_idx] == 0 {
                self.touched_words.push(word_idx as u16);
            }
            self.visited[word_idx] |= 1u64 << bit_pos;
        }
        was_visited
    }

    fn is_visited(&self, x: u16, y: u16) -> bool {
        let idx = coords_to_idx(x, y);
        let word_idx = idx >> 6;
        let bit_pos = idx & 63;
        (self.visited[word_idx] >> bit_pos) & 1 == 1
    }
}

impl Default for BFSWorkspace {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// STATE
// ============================================================================

thread_local! {
    // Hot path - accessed every generation
    static ALIVE: RefCell<[u64; GRID_WORDS]> = RefCell::new([0u64; GRID_WORDS]);
    static POTENTIAL: RefCell<[u64; GRID_WORDS]> = RefCell::new([0u64; GRID_WORDS]);
    static NEXT_POTENTIAL: RefCell<[u64; GRID_WORDS]> = RefCell::new([0u64; GRID_WORDS]);

    // Warm path - accessed on births, place_cells
    static TERRITORY: RefCell<[PlayerTerritory; MAX_PLAYERS]> = RefCell::new(
        std::array::from_fn(|_| PlayerTerritory::default())
    );

    // Cold path - rarely accessed
    static PLAYERS: RefCell<[Option<Principal>; MAX_PLAYERS]> = RefCell::new([None; MAX_PLAYERS]);
    static BASES: RefCell<[Option<Base>; MAX_PLAYERS]> = RefCell::new([None; MAX_PLAYERS]);
    static WALLETS: RefCell<HashMap<Principal, u64>> = RefCell::new(HashMap::new());
    static CELL_COUNTS: RefCell<[u32; MAX_PLAYERS]> = RefCell::new([0u32; MAX_PLAYERS]);
    static ZERO_CELLS_SINCE: RefCell<[Option<u64>; MAX_PLAYERS]> = RefCell::new([None; MAX_PLAYERS]);

    // Game state
    static GENERATION: RefCell<u64> = RefCell::new(0);
    static IS_RUNNING: RefCell<bool> = RefCell::new(true);
    static NEXT_WIPE_QUADRANT: RefCell<u8> = RefCell::new(0);
    static LAST_WIPE_NS: RefCell<u64> = RefCell::new(0);

    // BFS workspace for disconnection detection
    static BFS_WORKSPACE: RefCell<BFSWorkspace> = RefCell::new(BFSWorkspace::new());
}

// ============================================================================
// COORDINATE & BITMAP HELPERS
// ============================================================================

#[inline(always)]
fn coords_to_idx(x: u16, y: u16) -> usize {
    ((y as usize) << GRID_SHIFT) | (x as usize)
}

#[inline(always)]
fn idx_to_coords(idx: usize) -> (u16, u16) {
    ((idx & 0x1FF) as u16, (idx >> GRID_SHIFT) as u16)
}

#[inline(always)]
fn wrap_coord(v: i32) -> u16 {
    ((v % 512 + 512) % 512) as u16
}

#[inline(always)]
fn orthogonal_neighbors(x: u16, y: u16) -> [(u16, u16); 4] {
    [
        (x.wrapping_sub(1) & GRID_MASK, y),       // West
        (x.wrapping_add(1) & GRID_MASK, y),       // East
        (x, y.wrapping_sub(1) & GRID_MASK),       // North
        (x, y.wrapping_add(1) & GRID_MASK),       // South
    ]
}

#[inline(always)]
fn all_neighbors(x: u16, y: u16) -> [(u16, u16); 8] {
    let xm = x.wrapping_sub(1) & GRID_MASK;
    let xp = x.wrapping_add(1) & GRID_MASK;
    let ym = y.wrapping_sub(1) & GRID_MASK;
    let yp = y.wrapping_add(1) & GRID_MASK;
    [
        (xm, ym), // NW
        (x, ym),  // N
        (xp, ym), // NE
        (xm, y),  // W
        (xp, y),  // E
        (xm, yp), // SW
        (x, yp),  // S
        (xp, yp), // SE
    ]
}

// ALIVE bitmap operations
#[inline(always)]
fn is_alive_at(alive: &[u64; GRID_WORDS], x: u16, y: u16) -> bool {
    let idx = coords_to_idx(x, y);
    (alive[idx >> 6] >> (idx & 63)) & 1 == 1
}

#[inline(always)]
fn is_alive_idx(alive: &[u64; GRID_WORDS], idx: usize) -> bool {
    (alive[idx >> 6] >> (idx & 63)) & 1 == 1
}

#[inline(always)]
fn set_alive_at(alive: &mut [u64; GRID_WORDS], x: u16, y: u16) {
    let idx = coords_to_idx(x, y);
    alive[idx >> 6] |= 1u64 << (idx & 63);
}

#[inline(always)]
fn clear_alive_idx(alive: &mut [u64; GRID_WORDS], idx: usize) {
    alive[idx >> 6] &= !(1u64 << (idx & 63));
}

// POTENTIAL bitmap operations
#[inline(always)]
fn set_potential_bit(potential: &mut [u64; GRID_WORDS], idx: usize) {
    potential[idx >> 6] |= 1u64 << (idx & 63);
}

fn mark_with_neighbors_potential(potential: &mut [u64; GRID_WORDS], idx: usize) {
    let (x, y) = idx_to_coords(idx);
    set_potential_bit(potential, idx);
    for (nx, ny) in all_neighbors(x, y) {
        set_potential_bit(potential, coords_to_idx(nx, ny));
    }
}

fn mark_neighbors_potential(potential: &mut [u64; GRID_WORDS], idx: usize) {
    let (x, y) = idx_to_coords(idx);
    for (nx, ny) in all_neighbors(x, y) {
        set_potential_bit(potential, coords_to_idx(nx, ny));
    }
}

// ============================================================================
// QUADRANT HELPERS
// ============================================================================

#[inline(always)]
fn get_quadrant(x: u16, y: u16) -> u8 {
    ((y >> 7) * 4 + (x >> 7)) as u8
}

fn quadrant_bounds(q: u8) -> (u16, u16, u16, u16) {
    let qx = (q % 4) as u16;
    let qy = (q / 4) as u16;
    (qx * 128, qy * 128, 128, 128)
}

fn quadrant_has_base(q: u8) -> bool {
    BASES.with(|b| {
        let bases = b.borrow();
        for base_opt in bases.iter() {
            if let Some(base) = base_opt {
                if get_quadrant(base.x, base.y) == q {
                    return true;
                }
            }
        }
        false
    })
}

// ============================================================================
// TERRITORY MANAGEMENT
// ============================================================================

fn popcount_below(mask: u64, idx: usize) -> usize {
    (mask & ((1u64 << idx) - 1)).count_ones() as usize
}

fn player_owns(territory: &[PlayerTerritory; MAX_PLAYERS], player: usize, x: u16, y: u16) -> bool {
    if player >= MAX_PLAYERS {
        return false;
    }

    let chunk_x = (x / CHUNK_SIZE) as usize;
    let chunk_y = (y / CHUNK_SIZE) as usize;
    let chunk_idx = chunk_y * CHUNKS_PER_ROW + chunk_x;

    if (territory[player].chunk_mask >> chunk_idx) & 1 == 0 {
        return false;
    }

    let vec_idx = popcount_below(territory[player].chunk_mask, chunk_idx);
    let local_x = (x % CHUNK_SIZE) as usize;
    let local_y = (y % CHUNK_SIZE) as usize;
    (territory[player].chunks[vec_idx][local_y] >> local_x) & 1 == 1
}

fn find_owner(territory: &[PlayerTerritory; MAX_PLAYERS], x: u16, y: u16) -> Option<usize> {
    for player in 0..MAX_PLAYERS {
        if player_owns(territory, player, x, y) {
            return Some(player);
        }
    }
    None
}

fn set_territory(territory: &mut [PlayerTerritory; MAX_PLAYERS], player: usize, x: u16, y: u16) {
    if player >= MAX_PLAYERS {
        return;
    }

    let chunk_x = (x / CHUNK_SIZE) as usize;
    let chunk_y = (y / CHUNK_SIZE) as usize;
    let chunk_idx = chunk_y * CHUNKS_PER_ROW + chunk_x;

    let pt = &mut territory[player];

    // Check if chunk exists
    if (pt.chunk_mask >> chunk_idx) & 1 == 0 {
        // Allocate new chunk
        let insert_pos = popcount_below(pt.chunk_mask, chunk_idx);
        pt.chunks.insert(insert_pos, [0u64; 64]);
        pt.chunk_mask |= 1u64 << chunk_idx;
    }

    // Set bit
    let vec_idx = popcount_below(pt.chunk_mask, chunk_idx);
    let local_x = (x % CHUNK_SIZE) as usize;
    let local_y = (y % CHUNK_SIZE) as usize;
    pt.chunks[vec_idx][local_y] |= 1u64 << local_x;
}

fn clear_territory(territory: &mut [PlayerTerritory; MAX_PLAYERS], player: usize, x: u16, y: u16) {
    if player >= MAX_PLAYERS {
        return;
    }

    let chunk_x = (x / CHUNK_SIZE) as usize;
    let chunk_y = (y / CHUNK_SIZE) as usize;
    let chunk_idx = chunk_y * CHUNKS_PER_ROW + chunk_x;

    let pt = &mut territory[player];

    if (pt.chunk_mask >> chunk_idx) & 1 == 0 {
        return; // Chunk doesn't exist
    }

    let vec_idx = popcount_below(pt.chunk_mask, chunk_idx);
    let local_x = (x % CHUNK_SIZE) as usize;
    let local_y = (y % CHUNK_SIZE) as usize;
    pt.chunks[vec_idx][local_y] &= !(1u64 << local_x);

    // Check if chunk is now empty
    let chunk_empty = pt.chunks[vec_idx].iter().all(|&w| w == 0);
    if chunk_empty {
        pt.chunks.remove(vec_idx);
        pt.chunk_mask &= !(1u64 << chunk_idx);
    }
}

// ============================================================================
// BASE HELPERS
// ============================================================================

#[inline(always)]
fn is_in_base(base: &Base, x: u16, y: u16) -> bool {
    let dx = x.wrapping_sub(base.x);
    let dy = y.wrapping_sub(base.y);
    dx < BASE_SIZE && dy < BASE_SIZE
}

#[inline(always)]
fn is_wall(base: &Base, x: u16, y: u16) -> bool {
    let dx = x.wrapping_sub(base.x);
    let dy = y.wrapping_sub(base.y);
    dx < BASE_SIZE && dy < BASE_SIZE && (dx == 0 || dx == BASE_SIZE - 1 || dy == 0 || dy == BASE_SIZE - 1)
}

#[inline(always)]
fn is_interior(base: &Base, x: u16, y: u16) -> bool {
    let dx = x.wrapping_sub(base.x);
    let dy = y.wrapping_sub(base.y);
    dx >= 1 && dx <= BASE_INTERIOR && dy >= 1 && dy <= BASE_INTERIOR
}

fn in_protection_zone(bases: &[Option<Base>; MAX_PLAYERS], x: u16, y: u16) -> Option<usize> {
    for (i, base_opt) in bases.iter().enumerate() {
        if let Some(base) = base_opt {
            if is_in_base(base, x, y) {
                return Some(i);
            }
        }
    }
    None
}

fn bases_would_overlap(new_x: u16, new_y: u16, existing: &Base) -> bool {
    let dx = new_x.abs_diff(existing.x);
    let dy = new_y.abs_diff(existing.y);
    // Handle toroidal wrap
    let dx = dx.min(GRID_SIZE - dx);
    let dy = dy.min(GRID_SIZE - dy);
    dx < BASE_SIZE && dy < BASE_SIZE
}

// ============================================================================
// PLAYER HELPERS
// ============================================================================

fn find_player_slot(caller: Principal) -> Option<usize> {
    PLAYERS.with(|p| {
        p.borrow().iter().position(|opt| *opt == Some(caller))
    })
}

// ============================================================================
// CONWAY'S GAME OF LIFE
// ============================================================================

/// Represents a change to apply after computing fates
#[derive(Clone, Copy)]
enum CellChange {
    Survives(usize),  // idx
    Birth { idx: usize, owner: usize },
    Death { idx: usize, owner: usize },
}

/// Find majority owner among 3 alive neighbors for birth
fn find_majority_owner(
    territory: &[PlayerTerritory; MAX_PLAYERS],
    alive: &[u64; GRID_WORDS],
    x: u16,
    y: u16,
    cell_idx: usize,
) -> usize {
    let mut owner_counts = [0u8; MAX_PLAYERS];

    for (nx, ny) in all_neighbors(x, y) {
        if is_alive_at(alive, nx, ny) {
            if let Some(owner) = find_owner(territory, nx, ny) {
                owner_counts[owner] += 1;
            }
        }
    }

    // Find max count
    let max_count = *owner_counts.iter().max().unwrap_or(&0);
    if max_count == 0 {
        return 0; // Default to player 0 (shouldn't happen with 3 alive neighbors)
    }

    // Collect tied players
    let tied: Vec<usize> = owner_counts
        .iter()
        .enumerate()
        .filter(|(_, &c)| c == max_count)
        .map(|(i, _)| i)
        .collect();

    if tied.len() == 1 {
        tied[0]
    } else {
        // Tie-break using cell position
        tied[cell_idx % tied.len()]
    }
}

/// Compute cell fate - read-only on grid
fn compute_cell_fate(
    alive: &[u64; GRID_WORDS],
    territory: &[PlayerTerritory; MAX_PLAYERS],
    idx: usize,
) -> Option<CellChange> {
    let (x, y) = idx_to_coords(idx);
    let currently_alive = is_alive_idx(alive, idx);

    // Count alive neighbors
    let mut alive_count = 0u8;
    for (nx, ny) in all_neighbors(x, y) {
        if is_alive_at(alive, nx, ny) {
            alive_count += 1;
        }
    }

    match (currently_alive, alive_count) {
        // Survival: 2 or 3 neighbors
        (true, 2) | (true, 3) => Some(CellChange::Survives(idx)),

        // Birth: exactly 3 neighbors
        (false, 3) => {
            let owner = find_majority_owner(territory, alive, x, y, idx);
            Some(CellChange::Birth { idx, owner })
        }

        // Death: wrong neighbor count
        (true, _) => {
            let owner = find_owner(territory, x, y).unwrap_or(0);
            Some(CellChange::Death { idx, owner })
        }

        // Stays dead
        (false, _) => None,
    }
}

// ============================================================================
// DISCONNECTION ALGORITHM
// ============================================================================

/// Check if disconnection occurred and apply it
fn check_disconnection(
    workspace: &mut BFSWorkspace,
    territory: &mut [PlayerTerritory; MAX_PLAYERS],
    alive: &mut [u64; GRID_WORDS],
    potential: &mut [u64; GRID_WORDS],
    cell_counts: &mut [u32; MAX_PLAYERS],
    bases: &[Option<Base>; MAX_PLAYERS],
    player: usize,
    lost_x: u16,
    lost_y: u16,
) {
    // Phase 1: Find affected neighbors
    let mut affected: Vec<(u16, u16)> = Vec::with_capacity(4);
    for (nx, ny) in orthogonal_neighbors(lost_x, lost_y) {
        if player_owns(territory, player, nx, ny) {
            affected.push((nx, ny));
        }
    }

    if affected.is_empty() {
        return; // No neighbors = no disconnection possible
    }

    // Phase 2: Check if all in base interior
    if let Some(base) = bases[player].as_ref() {
        if affected.iter().all(|&(x, y)| is_interior(base, x, y)) {
            return; // All in base interior = always connected
        }

        // Phase 3: BFS from base to find reachable territory
        workspace.clear();

        // Seed from base interior
        for dy in 1..=BASE_INTERIOR {
            for dx in 1..=BASE_INTERIOR {
                let x = base.x.wrapping_add(dx) & GRID_MASK;
                let y = base.y.wrapping_add(dy) & GRID_MASK;
                if player_owns(territory, player, x, y) && !workspace.mark_visited(x, y) {
                    let idx = coords_to_idx(x, y);
                    workspace.queue.push(idx as u32);
                }
            }
        }

        // BFS with early termination
        let mut affected_found = [false; 4];
        let mut found_count = 0;
        let mut queue_idx = 0;

        while queue_idx < workspace.queue.len() {
            let cell_idx = workspace.queue[queue_idx] as usize;
            queue_idx += 1;

            let (x, y) = idx_to_coords(cell_idx);

            // Check if this is an affected neighbor
            for (i, &(ax, ay)) in affected.iter().enumerate() {
                if !affected_found[i] && x == ax && y == ay {
                    affected_found[i] = true;
                    found_count += 1;
                    if found_count == affected.len() {
                        return; // All affected neighbors reachable
                    }
                }
            }

            // Explore orthogonal neighbors
            for (nx, ny) in orthogonal_neighbors(x, y) {
                if !workspace.is_visited(nx, ny) && player_owns(territory, player, nx, ny) {
                    workspace.mark_visited(nx, ny);
                    workspace.queue.push(coords_to_idx(nx, ny) as u32);
                }
            }
        }

        // Phase 4: Find disconnected components
        let mut unreached: Vec<(u16, u16)> = Vec::new();
        for (i, &(ax, ay)) in affected.iter().enumerate() {
            if !affected_found[i] {
                unreached.push((ax, ay));
            }
        }

        if unreached.is_empty() {
            return;
        }

        // BFS to find all disconnected cells
        let mut disconnected: Vec<(u16, u16)> = Vec::new();

        for (start_x, start_y) in unreached {
            if workspace.is_visited(start_x, start_y) {
                continue; // Already processed
            }

            workspace.mark_visited(start_x, start_y);
            let mut local_queue = vec![(start_x, start_y)];
            let mut q_idx = 0;

            while q_idx < local_queue.len() {
                let (x, y) = local_queue[q_idx];
                q_idx += 1;
                disconnected.push((x, y));

                for (nx, ny) in orthogonal_neighbors(x, y) {
                    if !workspace.is_visited(nx, ny) && player_owns(territory, player, nx, ny) {
                        workspace.mark_visited(nx, ny);
                        local_queue.push((nx, ny));
                    }
                }
            }
        }

        // Phase 5: Apply disconnection
        for (x, y) in disconnected {
            clear_territory(territory, player, x, y);

            let idx = coords_to_idx(x, y);
            if is_alive_idx(alive, idx) {
                clear_alive_idx(alive, idx);
                cell_counts[player] = cell_counts[player].saturating_sub(1);
                mark_neighbors_potential(potential, idx);
            }
        }
    }
}

// ============================================================================
// STEP GENERATION
// ============================================================================

fn step_generation() {
    // Collect changes in first pass
    let mut changes: Vec<CellChange> = Vec::new();

    // PASS 1: Compute fates (read-only)
    ALIVE.with(|a| {
        POTENTIAL.with(|p| {
            TERRITORY.with(|t| {
                let alive = a.borrow();
                let potential = p.borrow();
                let territory = t.borrow();

                for word_idx in 0..GRID_WORDS {
                    let mut word = potential[word_idx];
                    if word == 0 {
                        continue;
                    }

                    while word != 0 {
                        let bit_pos = word.trailing_zeros() as usize;
                        let idx = (word_idx << 6) | bit_pos;

                        if let Some(change) = compute_cell_fate(&alive, &territory, idx) {
                            changes.push(change);
                        }

                        word &= word - 1;
                    }
                }
            });
        });
    });

    // Track territory changes for batched disconnection
    let mut territory_changes: [Vec<(u16, u16)>; MAX_PLAYERS] = Default::default();

    // PASS 2: Apply changes
    ALIVE.with(|a| {
        NEXT_POTENTIAL.with(|np| {
            TERRITORY.with(|t| {
                BASES.with(|b| {
                    WALLETS.with(|w| {
                        PLAYERS.with(|pl| {
                            CELL_COUNTS.with(|c| {
                                let alive = &mut *a.borrow_mut();
                                let next_potential = &mut *np.borrow_mut();
                                let territory = &mut *t.borrow_mut();
                                let bases = &mut *b.borrow_mut();
                                let wallets = &mut *w.borrow_mut();
                                let players = &*pl.borrow();
                                let cell_counts = &mut *c.borrow_mut();

                                // Clear next_potential
                                next_potential.fill(0);

                                for change in changes {
                                    match change {
                                        CellChange::Survives(idx) => {
                                            mark_with_neighbors_potential(next_potential, idx);
                                        }

                                        CellChange::Birth { idx, owner } => {
                                            let (x, y) = idx_to_coords(idx);

                                            // Check siege mechanic
                                            if let Some(base_owner) = in_protection_zone(bases, x, y) {
                                                if base_owner != owner {
                                                    // SIEGE! Birth prevented, transfer coin
                                                    if let Some(ref mut base) = bases[base_owner] {
                                                        base.coins = base.coins.saturating_sub(1);

                                                        // Transfer to attacker's wallet
                                                        if let Some(attacker_principal) = players[owner] {
                                                            *wallets.entry(attacker_principal).or_insert(0) += 1;
                                                        }

                                                        // Check for base destruction
                                                        if base.coins == 0 {
                                                            // Will be handled after this pass
                                                        }
                                                    }
                                                    continue; // Birth prevented
                                                }
                                            }

                                            // Normal birth
                                            alive[idx >> 6] |= 1u64 << (idx & 63);
                                            cell_counts[owner] += 1;

                                            // Update territory
                                            let old_owner = find_owner(territory, x, y);
                                            if old_owner != Some(owner) {
                                                if let Some(old) = old_owner {
                                                    clear_territory(territory, old, x, y);
                                                    territory_changes[old].push((x, y));
                                                }
                                                set_territory(territory, owner, x, y);
                                            }

                                            mark_with_neighbors_potential(next_potential, idx);
                                        }

                                        CellChange::Death { idx, owner } => {
                                            alive[idx >> 6] &= !(1u64 << (idx & 63));
                                            cell_counts[owner] = cell_counts[owner].saturating_sub(1);
                                            mark_neighbors_potential(next_potential, idx);
                                        }
                                    }
                                }
                            });
                        });
                    });
                });
            });
        });
    });

    // Handle base destructions and disconnections
    BASES.with(|b| {
        let mut bases = b.borrow_mut();
        let mut eliminated_players = Vec::new();

        for (player, base_opt) in bases.iter().enumerate() {
            if let Some(base) = base_opt {
                if base.coins == 0 {
                    eliminated_players.push(player);
                }
            }
        }

        drop(bases);

        for player in eliminated_players {
            eliminate_player(player);
        }
    });

    // Check disconnections for affected players
    BFS_WORKSPACE.with(|ws| {
        TERRITORY.with(|t| {
            ALIVE.with(|a| {
                NEXT_POTENTIAL.with(|np| {
                    CELL_COUNTS.with(|c| {
                        BASES.with(|b| {
                            let workspace = &mut *ws.borrow_mut();
                            let territory = &mut *t.borrow_mut();
                            let alive = &mut *a.borrow_mut();
                            let potential = &mut *np.borrow_mut();
                            let cell_counts = &mut *c.borrow_mut();
                            let bases = &*b.borrow();

                            for (player, changes) in territory_changes.iter().enumerate() {
                                if changes.is_empty() {
                                    continue;
                                }

                                for &(x, y) in changes {
                                    check_disconnection(
                                        workspace,
                                        territory,
                                        alive,
                                        potential,
                                        cell_counts,
                                        bases,
                                        player,
                                        x,
                                        y,
                                    );
                                }
                            }
                        });
                    });
                });
            });
        });
    });

    // Swap potential buffers
    POTENTIAL.with(|p| {
        NEXT_POTENTIAL.with(|np| {
            std::mem::swap(&mut *p.borrow_mut(), &mut *np.borrow_mut());
        });
    });

    // Update grace periods
    let now = ic_cdk::api::time();
    CELL_COUNTS.with(|c| {
        ZERO_CELLS_SINCE.with(|z| {
            BASES.with(|b| {
                let counts = c.borrow();
                let mut zero_since = z.borrow_mut();
                let bases = b.borrow();

                for player in 0..MAX_PLAYERS {
                    if bases[player].is_some() {
                        if counts[player] == 0 && zero_since[player].is_none() {
                            zero_since[player] = Some(now);
                        } else if counts[player] > 0 {
                            zero_since[player] = None;
                        }
                    }
                }
            });
        });
    });

    GENERATION.with(|g| *g.borrow_mut() += 1);
}

// ============================================================================
// PLAYER ELIMINATION
// ============================================================================

fn eliminate_player(player: usize) {
    TERRITORY.with(|t| {
        ALIVE.with(|a| {
            POTENTIAL.with(|p| {
                CELL_COUNTS.with(|c| {
                    let territory = &mut *t.borrow_mut();
                    let alive = &mut *a.borrow_mut();
                    let potential = &mut *p.borrow_mut();
                    let cell_counts = &mut *c.borrow_mut();

                    // Kill all cells and clear territory
                    let pt = &territory[player];
                    for chunk_idx in 0..TOTAL_CHUNKS {
                        if (pt.chunk_mask >> chunk_idx) & 1 == 0 {
                            continue;
                        }

                        let vec_idx = popcount_below(pt.chunk_mask, chunk_idx);
                        let chunk = &pt.chunks[vec_idx];

                        let chunk_base_x = ((chunk_idx % CHUNKS_PER_ROW) * CHUNK_SIZE as usize) as u16;
                        let chunk_base_y = ((chunk_idx / CHUNKS_PER_ROW) * CHUNK_SIZE as usize) as u16;

                        for local_y in 0..64 {
                            let mut word = chunk[local_y];
                            while word != 0 {
                                let local_x = word.trailing_zeros() as usize;
                                word &= word - 1;

                                let x = chunk_base_x + local_x as u16;
                                let y = chunk_base_y + local_y as u16;
                                let idx = coords_to_idx(x, y);

                                if is_alive_idx(alive, idx) {
                                    clear_alive_idx(alive, idx);
                                    mark_neighbors_potential(potential, idx);
                                }
                            }
                        }
                    }

                    // Clear territory
                    territory[player] = PlayerTerritory::default();
                    cell_counts[player] = 0;
                });
            });
        });
    });

    // Clear player data
    BASES.with(|b| b.borrow_mut()[player] = None);
    PLAYERS.with(|p| p.borrow_mut()[player] = None);
    ZERO_CELLS_SINCE.with(|z| z.borrow_mut()[player] = None);
}

// ============================================================================
// QUADRANT WIPE
// ============================================================================

fn wipe_quadrant(quadrant: u8) {
    let (x_start, y_start, _, _) = quadrant_bounds(quadrant);

    ALIVE.with(|a| {
        POTENTIAL.with(|p| {
            TERRITORY.with(|t| {
                CELL_COUNTS.with(|c| {
                    ZERO_CELLS_SINCE.with(|z| {
                        BASES.with(|b| {
                            let alive = &mut *a.borrow_mut();
                            let potential = &mut *p.borrow_mut();
                            let territory = &*t.borrow();
                            let cell_counts = &mut *c.borrow_mut();
                            let zero_since = &mut *z.borrow_mut();
                            let bases = &*b.borrow();

                            let now = ic_cdk::api::time();

                            for row_offset in 0..QUADRANT_SIZE {
                                let y = y_start + row_offset;
                                let word_row_base = (y as usize) * WORDS_PER_ROW;
                                let word_col_start = (x_start / 64) as usize;

                                for word_offset in 0..2 {
                                    let word_idx = word_row_base + word_col_start + word_offset;
                                    let mut alive_word = alive[word_idx];

                                    if alive_word == 0 {
                                        continue;
                                    }

                                    while alive_word != 0 {
                                        let bit_pos = alive_word.trailing_zeros() as usize;
                                        alive_word &= alive_word - 1;

                                        let x = (word_col_start * 64 + word_offset * 64 + bit_pos) as u16;
                                        let idx = coords_to_idx(x, y);

                                        if let Some(owner) = find_owner(territory, x, y) {
                                            cell_counts[owner] = cell_counts[owner].saturating_sub(1);

                                            if cell_counts[owner] == 0 && bases[owner].is_some() {
                                                zero_since[owner] = Some(now);
                                            }
                                        }

                                        mark_neighbors_potential(potential, idx);
                                    }

                                    alive[word_idx] = 0;
                                }
                            }
                        });
                    });
                });
            });
        });
    });
}

fn run_wipe_if_needed() {
    let now = ic_cdk::api::time();

    let should_wipe = LAST_WIPE_NS.with(|t| now.saturating_sub(*t.borrow()) >= WIPE_INTERVAL_NS);

    if !should_wipe {
        return;
    }

    LAST_WIPE_NS.with(|t| *t.borrow_mut() = now);

    let quadrant = NEXT_WIPE_QUADRANT.with(|q| {
        let current = *q.borrow();
        *q.borrow_mut() = (current + 1) % TOTAL_QUADRANTS as u8;
        current
    });

    wipe_quadrant(quadrant);
}

fn check_grace_periods() {
    let now = ic_cdk::api::time();

    ZERO_CELLS_SINCE.with(|z| {
        BASES.with(|b| {
            let zero_since = z.borrow();
            let bases = b.borrow();
            let mut to_eliminate = Vec::new();

            for player in 0..MAX_PLAYERS {
                if let Some(since) = zero_since[player] {
                    if now.saturating_sub(since) >= GRACE_PERIOD_NS && bases[player].is_some() {
                        to_eliminate.push(player);
                    }
                }
            }

            drop(zero_since);
            drop(bases);

            for player in to_eliminate {
                eliminate_player(player);
            }
        });
    });
}

// ============================================================================
// TIMER
// ============================================================================

fn start_simulation_timer() {
    ic_cdk_timers::set_timer_interval(Duration::from_millis(TICK_INTERVAL_MS), || {
        let is_running = IS_RUNNING.with(|r| *r.borrow());
        if is_running {
            for _ in 0..GENERATIONS_PER_TICK {
                step_generation();
            }
            run_wipe_if_needed();
            check_grace_periods();
        }
    });
}

// ============================================================================
// REBUILD HELPERS
// ============================================================================

fn rebuild_potential_from_alive() {
    ALIVE.with(|a| {
        POTENTIAL.with(|p| {
            let alive = a.borrow();
            let potential = &mut *p.borrow_mut();
            potential.fill(0);

            for word_idx in 0..GRID_WORDS {
                let mut word = alive[word_idx];
                while word != 0 {
                    let bit = word.trailing_zeros() as usize;
                    word &= word - 1;
                    let idx = word_idx * 64 + bit;
                    mark_with_neighbors_potential(potential, idx);
                }
            }
        });
    });
}

// ============================================================================
// CANDID TYPES
// ============================================================================

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct SparseCell {
    pub x: u16,
    pub y: u16,
    pub owner: u8,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct BaseInfo {
    pub x: u16,
    pub y: u16,
    pub coins: u64,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct PlayerInfo {
    pub principal: Principal,
    pub base: Option<BaseInfo>,
    pub alive_cells: u32,
    pub in_grace_period: bool,
    pub grace_seconds_remaining: Option<u64>,
    pub wallet_balance: u64,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct GameState {
    pub generation: u64,
    pub alive_cells: Vec<SparseCell>,
    pub players: Vec<Option<PlayerInfo>>,
    pub next_wipe: (u8, u64),
    pub is_running: bool,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct SlotInfo {
    pub slot: u8,
    pub occupied: bool,
    pub principal: Option<Principal>,
    pub base_x: Option<u16>,
    pub base_y: Option<u16>,
    pub base_coins: Option<u64>,
    pub alive_cells: u32,
    pub in_grace_period: bool,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct PlaceResult {
    pub placed: u32,
    pub generation: u64,
    pub new_base_coins: u64,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct JoinResult {
    pub slot: u8,
    pub base_x: u16,
    pub base_y: u16,
}

// ============================================================================
// STABLE MEMORY
// ============================================================================

#[derive(CandidType, Deserialize, Default)]
struct PersistedState {
    alive: Vec<u64>,
    territory: Vec<PlayerTerritory>,
    bases: Vec<Option<Base>>,
    players: Vec<Option<Principal>>,
    wallets: Vec<(Principal, u64)>,
    cell_counts: Vec<u32>,
    zero_cells_since: Vec<Option<u64>>,
    generation: u64,
    is_running: bool,
    next_wipe_quadrant: u8,
    last_wipe_ns: u64,
}

// ============================================================================
// CANISTER LIFECYCLE
// ============================================================================

#[init]
fn init() {
    IS_RUNNING.with(|r| *r.borrow_mut() = true);
    start_simulation_timer();
    ic_cdk::println!(
        "Life2 v2 Backend Initialized - {}x{} territory-based world",
        GRID_SIZE,
        GRID_SIZE
    );
}

#[pre_upgrade]
fn pre_upgrade() {
    let state = PersistedState {
        alive: ALIVE.with(|a| a.borrow().to_vec()),
        territory: TERRITORY.with(|t| t.borrow().to_vec()),
        bases: BASES.with(|b| b.borrow().to_vec()),
        players: PLAYERS.with(|p| p.borrow().to_vec()),
        wallets: WALLETS.with(|w| w.borrow().iter().map(|(&k, &v)| (k, v)).collect()),
        cell_counts: CELL_COUNTS.with(|c| c.borrow().to_vec()),
        zero_cells_since: ZERO_CELLS_SINCE.with(|z| z.borrow().to_vec()),
        generation: GENERATION.with(|g| *g.borrow()),
        is_running: IS_RUNNING.with(|r| *r.borrow()),
        next_wipe_quadrant: NEXT_WIPE_QUADRANT.with(|q| *q.borrow()),
        last_wipe_ns: LAST_WIPE_NS.with(|t| *t.borrow()),
    };

    ic_cdk::storage::stable_save((state,)).expect("Failed to save state");
}

#[post_upgrade]
fn post_upgrade() {
    match ic_cdk::storage::stable_restore::<(PersistedState,)>() {
        Ok((state,)) => {
            ALIVE.with(|a| {
                let mut alive = a.borrow_mut();
                for (i, &val) in state.alive.iter().enumerate() {
                    if i < alive.len() {
                        alive[i] = val;
                    }
                }
            });

            TERRITORY.with(|t| {
                let mut territory = t.borrow_mut();
                for (i, val) in state.territory.into_iter().enumerate() {
                    if i < territory.len() {
                        territory[i] = val;
                    }
                }
            });

            BASES.with(|b| {
                let mut bases = b.borrow_mut();
                for (i, val) in state.bases.into_iter().enumerate() {
                    if i < bases.len() {
                        bases[i] = val;
                    }
                }
            });

            PLAYERS.with(|p| {
                let mut players = p.borrow_mut();
                for (i, val) in state.players.into_iter().enumerate() {
                    if i < players.len() {
                        players[i] = val;
                    }
                }
            });

            WALLETS.with(|w| {
                let mut wallets = w.borrow_mut();
                for (k, v) in state.wallets {
                    wallets.insert(k, v);
                }
            });

            CELL_COUNTS.with(|c| {
                let mut counts = c.borrow_mut();
                for (i, val) in state.cell_counts.into_iter().enumerate() {
                    if i < counts.len() {
                        counts[i] = val;
                    }
                }
            });

            ZERO_CELLS_SINCE.with(|z| {
                let mut zero_since = z.borrow_mut();
                for (i, val) in state.zero_cells_since.into_iter().enumerate() {
                    if i < zero_since.len() {
                        zero_since[i] = val;
                    }
                }
            });

            GENERATION.with(|g| *g.borrow_mut() = state.generation);
            IS_RUNNING.with(|r| *r.borrow_mut() = state.is_running);
            NEXT_WIPE_QUADRANT.with(|q| *q.borrow_mut() = state.next_wipe_quadrant);
            LAST_WIPE_NS.with(|t| *t.borrow_mut() = state.last_wipe_ns);
        }
        Err(_) => {
            ic_cdk::println!("No previous state to restore");
        }
    }

    rebuild_potential_from_alive();
    start_simulation_timer();
}

// ============================================================================
// AUTHENTICATION
// ============================================================================

const ADMIN_PRINCIPAL: &str = "67ktx-ln42b-uzmo5-bdiyn-gu62c-cd4h4-a5qt3-2w3rs-cixdl-iaso2-mqe";

fn require_authenticated() -> Result<Principal, String> {
    let caller = ic_cdk::api::caller();
    if caller == Principal::anonymous() {
        return Err("Authentication required".to_string());
    }
    Ok(caller)
}

fn require_admin() -> Result<(), String> {
    let caller = ic_cdk::api::caller();
    let admin = Principal::from_text(ADMIN_PRINCIPAL)
        .map_err(|_| "Invalid admin principal")?;
    if caller != admin {
        return Err("Admin access required".to_string());
    }
    Ok(())
}

// ============================================================================
// UPDATE METHODS
// ============================================================================

/// Get coins from faucet
#[update]
fn faucet() -> Result<u64, String> {
    let caller = require_authenticated()?;

    let balance = WALLETS.with(|w| {
        let mut wallets = w.borrow_mut();
        let balance = wallets.entry(caller).or_insert(0);
        *balance += FAUCET_AMOUNT;
        *balance
    });

    Ok(balance)
}

/// Join the game by placing a base
#[update]
fn join_game(base_x: i32, base_y: i32) -> Result<JoinResult, String> {
    let caller = require_authenticated()?;

    // Validate coordinates
    if base_x < 0 || base_x >= GRID_SIZE as i32 || base_y < 0 || base_y >= GRID_SIZE as i32 {
        return Err("Coordinates out of range".to_string());
    }
    let base_x = base_x as u16;
    let base_y = base_y as u16;

    // Check not already playing
    if find_player_slot(caller).is_some() {
        return Err("Already in game".to_string());
    }

    // Check wallet balance
    let balance = WALLETS.with(|w| w.borrow().get(&caller).copied().unwrap_or(0));
    if balance < BASE_COST {
        return Err(format!("Need {} coins, have {}", BASE_COST, balance));
    }

    // Check quadrant is free
    let quadrant = get_quadrant(base_x, base_y);
    if quadrant_has_base(quadrant) {
        return Err("Quadrant already has a base".to_string());
    }

    // Check no overlap with existing bases
    BASES.with(|b| {
        let bases = b.borrow();
        for base_opt in bases.iter() {
            if let Some(existing) = base_opt {
                if bases_would_overlap(base_x, base_y, existing) {
                    return Err("Overlaps existing base".to_string());
                }
            }
        }
        Ok(())
    })?;

    // Find free slot
    let slot = PLAYERS.with(|p| {
        let players = p.borrow();
        players.iter().position(|opt| opt.is_none())
    }).ok_or("No free slots")?;

    // Deduct coins
    WALLETS.with(|w| {
        let mut wallets = w.borrow_mut();
        if let Some(bal) = wallets.get_mut(&caller) {
            *bal -= BASE_COST;
        }
    });

    // Create base
    let base = Base {
        x: base_x,
        y: base_y,
        coins: BASE_COST,
    };

    BASES.with(|b| b.borrow_mut()[slot] = Some(base));
    PLAYERS.with(|p| p.borrow_mut()[slot] = Some(caller));

    // Initialize 6x6 interior territory
    TERRITORY.with(|t| {
        let mut territory = t.borrow_mut();
        for dy in 1..=BASE_INTERIOR {
            for dx in 1..=BASE_INTERIOR {
                let x = base_x.wrapping_add(dx) & GRID_MASK;
                let y = base_y.wrapping_add(dy) & GRID_MASK;
                set_territory(&mut territory, slot, x, y);
            }
        }
    });

    Ok(JoinResult {
        slot: slot as u8,
        base_x,
        base_y,
    })
}

/// Place cells on your territory
#[update]
fn place_cells(cells: Vec<(i32, i32)>) -> Result<PlaceResult, String> {
    let caller = require_authenticated()?;

    if cells.len() > MAX_PLACE_CELLS {
        return Err(format!("Max {} cells per call", MAX_PLACE_CELLS));
    }

    if cells.is_empty() {
        return Err("No cells provided".to_string());
    }

    let slot = find_player_slot(caller).ok_or("Not in game")?;

    // Get base info
    let base = BASES.with(|b| b.borrow()[slot]).ok_or("No base")?;

    // Check wallet balance
    let cost = cells.len() as u64;
    let balance = WALLETS.with(|w| w.borrow().get(&caller).copied().unwrap_or(0));
    if balance < cost {
        return Err(format!("Need {} coins, have {}", cost, balance));
    }

    // Validate all cells first
    TERRITORY.with(|t| {
        ALIVE.with(|a| {
            let territory = t.borrow();
            let alive = a.borrow();

            for &(x, y) in &cells {
                if x < 0 || x >= GRID_SIZE as i32 || y < 0 || y >= GRID_SIZE as i32 {
                    return Err("Coordinates out of range".to_string());
                }
                let x = x as u16;
                let y = y as u16;

                if !player_owns(&territory, slot, x, y) {
                    return Err("Not your territory".to_string());
                }

                if is_wall(&base, x, y) {
                    return Err("Cannot place on walls".to_string());
                }

                if is_alive_at(&alive, x, y) {
                    return Err("Cell already alive".to_string());
                }
            }
            Ok(())
        })
    })?;

    // Deduct from wallet, add to base treasury
    WALLETS.with(|w| {
        if let Some(bal) = w.borrow_mut().get_mut(&caller) {
            *bal -= cost;
        }
    });

    let new_base_coins = BASES.with(|b| {
        let mut bases = b.borrow_mut();
        if let Some(ref mut base) = bases[slot] {
            base.coins += cost;
            base.coins
        } else {
            0
        }
    });

    // Place cells
    ALIVE.with(|a| {
        POTENTIAL.with(|p| {
            CELL_COUNTS.with(|c| {
                let alive = &mut *a.borrow_mut();
                let potential = &mut *p.borrow_mut();
                let cell_counts = &mut *c.borrow_mut();

                for &(x, y) in &cells {
                    let x = x as u16;
                    let y = y as u16;
                    set_alive_at(alive, x, y);
                    mark_with_neighbors_potential(potential, coords_to_idx(x, y));
                }

                cell_counts[slot] += cells.len() as u32;
            });
        });
    });

    // Clear grace period
    ZERO_CELLS_SINCE.with(|z| z.borrow_mut()[slot] = None);

    let generation = GENERATION.with(|g| *g.borrow());

    Ok(PlaceResult {
        placed: cells.len() as u32,
        generation,
        new_base_coins,
    })
}

/// Pause the game (admin only)
#[update]
fn pause_game() -> Result<(), String> {
    require_admin()?;
    IS_RUNNING.with(|r| *r.borrow_mut() = false);
    Ok(())
}

/// Resume the game (admin only)
#[update]
fn resume_game() -> Result<(), String> {
    require_admin()?;
    IS_RUNNING.with(|r| *r.borrow_mut() = true);
    Ok(())
}

/// Reset the game (admin only)
#[update]
fn reset_game() -> Result<(), String> {
    require_admin()?;

    ALIVE.with(|a| a.borrow_mut().fill(0));
    POTENTIAL.with(|p| p.borrow_mut().fill(0));
    NEXT_POTENTIAL.with(|np| np.borrow_mut().fill(0));
    TERRITORY.with(|t| {
        let mut territory = t.borrow_mut();
        for pt in territory.iter_mut() {
            *pt = PlayerTerritory::default();
        }
    });
    BASES.with(|b| b.borrow_mut().fill(None));
    PLAYERS.with(|p| p.borrow_mut().fill(None));
    CELL_COUNTS.with(|c| c.borrow_mut().fill(0));
    ZERO_CELLS_SINCE.with(|z| z.borrow_mut().fill(None));
    GENERATION.with(|g| *g.borrow_mut() = 0);
    IS_RUNNING.with(|r| *r.borrow_mut() = true);
    NEXT_WIPE_QUADRANT.with(|q| *q.borrow_mut() = 0);
    LAST_WIPE_NS.with(|t| *t.borrow_mut() = 0);

    Ok(())
}

// ============================================================================
// QUERY METHODS
// ============================================================================

/// Get full game state
#[query]
fn get_state() -> GameState {
    let now = ic_cdk::api::time();

    let alive_cells = ALIVE.with(|a| {
        TERRITORY.with(|t| {
            let alive = a.borrow();
            let territory = t.borrow();
            let mut cells = Vec::new();

            for word_idx in 0..GRID_WORDS {
                let mut word = alive[word_idx];
                while word != 0 {
                    let bit = word.trailing_zeros() as usize;
                    word &= word - 1;

                    let idx = word_idx * 64 + bit;
                    let (x, y) = idx_to_coords(idx);
                    let owner = find_owner(&territory, x, y).unwrap_or(0) as u8;

                    cells.push(SparseCell { x, y, owner });
                }
            }

            cells
        })
    });

    let players = PLAYERS.with(|p| {
        BASES.with(|b| {
            CELL_COUNTS.with(|c| {
                ZERO_CELLS_SINCE.with(|z| {
                    WALLETS.with(|w| {
                        let players = p.borrow();
                        let bases = b.borrow();
                        let counts = c.borrow();
                        let zero_since = z.borrow();
                        let wallets = w.borrow();

                        (0..MAX_PLAYERS)
                            .map(|i| {
                                players[i].map(|principal| {
                                    let base = bases[i].map(|b| BaseInfo {
                                        x: b.x,
                                        y: b.y,
                                        coins: b.coins,
                                    });

                                    let (in_grace, grace_remaining) = if let Some(since) = zero_since[i] {
                                        let elapsed = now.saturating_sub(since);
                                        let remaining = GRACE_PERIOD_NS.saturating_sub(elapsed);
                                        (true, Some(remaining / 1_000_000_000))
                                    } else {
                                        (false, None)
                                    };

                                    PlayerInfo {
                                        principal,
                                        base,
                                        alive_cells: counts[i],
                                        in_grace_period: in_grace,
                                        grace_seconds_remaining: grace_remaining,
                                        wallet_balance: wallets.get(&principal).copied().unwrap_or(0),
                                    }
                                })
                            })
                            .collect()
                    })
                })
            })
        })
    });

    let next_wipe = {
        let quadrant = NEXT_WIPE_QUADRANT.with(|q| *q.borrow());
        let last_wipe = LAST_WIPE_NS.with(|t| *t.borrow());
        let elapsed = now.saturating_sub(last_wipe);
        let remaining = WIPE_INTERVAL_NS.saturating_sub(elapsed);
        (quadrant, remaining / 1_000_000_000)
    };

    let is_running = IS_RUNNING.with(|r| *r.borrow());

    GameState {
        generation: GENERATION.with(|g| *g.borrow()),
        alive_cells,
        players,
        next_wipe,
        is_running,
    }
}

/// Get info for all slots
#[query]
fn get_slots_info() -> Vec<SlotInfo> {
    let now = ic_cdk::api::time();

    PLAYERS.with(|p| {
        BASES.with(|b| {
            CELL_COUNTS.with(|c| {
                ZERO_CELLS_SINCE.with(|z| {
                    let players = p.borrow();
                    let bases = b.borrow();
                    let counts = c.borrow();
                    let zero_since = z.borrow();

                    (0..MAX_PLAYERS)
                        .map(|i| {
                            let occupied = players[i].is_some();
                            let in_grace = zero_since[i].map(|since| {
                                now.saturating_sub(since) < GRACE_PERIOD_NS
                            }).unwrap_or(false);

                            SlotInfo {
                                slot: i as u8,
                                occupied,
                                principal: players[i],
                                base_x: bases[i].map(|b| b.x),
                                base_y: bases[i].map(|b| b.y),
                                base_coins: bases[i].map(|b| b.coins),
                                alive_cells: counts[i],
                                in_grace_period: in_grace,
                            }
                        })
                        .collect()
                })
            })
        })
    })
}

/// Get wallet balance
#[query]
fn get_balance() -> u64 {
    let caller = ic_cdk::api::caller();
    WALLETS.with(|w| w.borrow().get(&caller).copied().unwrap_or(0))
}

/// Get next wipe info
#[query]
fn get_next_wipe() -> (u8, u64) {
    let now = ic_cdk::api::time();
    let quadrant = NEXT_WIPE_QUADRANT.with(|q| *q.borrow());
    let last_wipe = LAST_WIPE_NS.with(|t| *t.borrow());
    let elapsed = now.saturating_sub(last_wipe);
    let remaining = WIPE_INTERVAL_NS.saturating_sub(elapsed);
    (quadrant, remaining / 1_000_000_000)
}

/// Get generation number
#[query]
fn get_generation() -> u64 {
    GENERATION.with(|g| *g.borrow())
}

/// Check if running
#[query]
fn is_running() -> bool {
    IS_RUNNING.with(|r| *r.borrow())
}

/// Get alive cell count
#[query]
fn get_alive_count() -> u32 {
    ALIVE.with(|a| {
        a.borrow().iter().map(|w| w.count_ones()).sum()
    })
}

/// Get player's territory as coordinate list
#[query]
fn get_territory(slot: u8) -> Vec<(u16, u16)> {
    if slot as usize >= MAX_PLAYERS {
        return Vec::new();
    }

    TERRITORY.with(|t| {
        let territory = t.borrow();
        let pt = &territory[slot as usize];
        let mut coords = Vec::new();

        for chunk_idx in 0..TOTAL_CHUNKS {
            if (pt.chunk_mask >> chunk_idx) & 1 == 0 {
                continue;
            }

            let vec_idx = popcount_below(pt.chunk_mask, chunk_idx);
            let chunk = &pt.chunks[vec_idx];

            let chunk_base_x = ((chunk_idx % CHUNKS_PER_ROW) * CHUNK_SIZE as usize) as u16;
            let chunk_base_y = ((chunk_idx / CHUNKS_PER_ROW) * CHUNK_SIZE as usize) as u16;

            for local_y in 0..64 {
                let mut word = chunk[local_y];
                while word != 0 {
                    let local_x = word.trailing_zeros() as usize;
                    word &= word - 1;

                    let x = chunk_base_x + local_x as u16;
                    let y = chunk_base_y + local_y as u16;
                    coords.push((x, y));
                }
            }
        }

        coords
    })
}

/// Simple greeting
#[query]
fn greet(name: String) -> String {
    format!(
        "Hello, {}! Welcome to Life2 v2 - a {}x{} territory-based Game of Life.",
        name, GRID_SIZE, GRID_SIZE
    )
}

// Export Candid interface
ic_cdk::export_candid!();
