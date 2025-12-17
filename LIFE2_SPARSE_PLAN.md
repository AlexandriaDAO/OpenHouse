# Life2: Sparse On-Chain Game of Life

## Overview

A 100% on-chain multiplayer Game of Life running at **10 generations/second** using sparse iteration. Instead of processing all 262,144 cells every generation, we only process cells that can possibly change state (~20,000 typical).

## Quick Comparison

| Metric | Current Dense | New Sparse |
|--------|---------------|------------|
| Cells processed/gen | 262,144 | ~20,000 |
| Grid memory | 512 KB | 256 KB |
| Generation rate | 1/sec | 10/sec |
| Annual cost | ~$170 | **~$70-140** |

---

## Game Rules

### 1. Conway's Game of Life (B3/S23)
- Cell with 2-3 alive neighbors survives
- Dead cell with exactly 3 alive neighbors is born
- All other cells die or stay dead

### 2. Multiplayer Territory
- Each cell has an owner (player 1-9)
- Territory persists after cell death
- New cells inherit majority owner from parent neighbors
- **Tie-breaking**: When multiple players tie for majority, use cell position hash for fairness (see `find_majority_owner`)
- Placing cells claims territory

### 3. Economy
- Players start with 1000 coins balance
- Placing cells costs 1 coin each
- Each placed cell stores 1 coin (cells can hold 0-7 coins)
- **7-coin cap**: Cannot place on cells that already have 7 coins (blocks placement)

### 4. Capture Rules
- **Enemy capture**: When a cell is born on enemy territory with coins, those coins transfer to the conqueror's balance
- **Self-capture NOT allowed**: You cannot pick up your own coins by re-conquering your own territory
- **Newborn cells start with 0 coins**: Captured coins go entirely to balance, the newborn cell is empty
- Formula: `if old_owner > 0 AND old_owner != new_owner AND old_coins > 0: transfer coins`

---

## Core Invariants

These invariants MUST be maintained at all times:

```
INVARIANT 1: Potential Set Completeness
  For every alive cell at index i:
    - Bit i is SET in POTENTIAL
    - All 8 neighbor bits are SET in POTENTIAL

  Implication: Any cell that CAN change state IS in POTENTIAL

INVARIANT 2: Potential Set Minimality (soft)
  Cells in POTENTIAL are either:
    - Alive, OR
    - Adjacent to an alive cell

  Note: Extra bits are harmless (just waste cycles), missing bits cause bugs

INVARIANT 3: Grid-Bitset Consistency
  After place_cells(): newly placed cells are in POTENTIAL
  After step_generation(): POTENTIAL reflects new alive cells
  After post_upgrade(): POTENTIAL rebuilt from grid

INVARIANT 4: Balance Conservation
  sum(balances) + sum(cell_coins) + coins_in_play = TOTAL_COINS_EVER_MINTED
  (Where coins_in_play = starting_balance * num_players - withdrawals + deposits)
```

---

## Data Structures

### Cell Encoding (u8)

Each cell is 1 byte with three fields packed:

```
┌─────────┬────────┬──────────┐
│ bits 7-5│ bit 4  │ bits 3-0 │
│  coins  │ alive  │  owner   │
│  (0-7)  │ (0/1)  │  (0-9)   │
└─────────┴────────┴──────────┘

Bit layout:  C C C A O O O O
             7 6 5 4 3 2 1 0
```

**Example values:**

| Value | Binary | Meaning |
|-------|--------|---------|
| 0 | `00000000` | Dead, unclaimed, 0 coins |
| 1 | `00000001` | Dead, Player 1 territory, 0 coins |
| 17 | `00010001` | Alive, Player 1, 0 coins |
| 49 | `00110001` | Alive, Player 1, 1 coin |
| 117 | `01110101` | Alive, Player 5, 3 coins |
| 226 | `11100010` | Dead, Player 2 territory, 7 coins |

**Rust Implementation:**

```rust
// ============================================================================
// CELL ENCODING
// ============================================================================

const OWNER_MASK: u8 = 0x0F;      // bits 0-3
const ALIVE_BIT: u8 = 0x10;       // bit 4
const COINS_SHIFT: u8 = 5;        // bits 5-7

#[inline(always)]
fn get_owner(cell: u8) -> u8 {
    cell & OWNER_MASK
}

#[inline(always)]
fn is_alive(cell: u8) -> bool {
    cell & ALIVE_BIT != 0
}

#[inline(always)]
fn get_coins(cell: u8) -> u8 {
    cell >> COINS_SHIFT
}

#[inline(always)]
fn make_cell(owner: u8, alive: bool, coins: u8) -> u8 {
    ((coins & 0x07) << COINS_SHIFT)
        | (if alive { ALIVE_BIT } else { 0 })
        | (owner & OWNER_MASK)
}

// Convenience: modify single field
#[inline(always)]
fn set_alive(cell: u8, alive: bool) -> u8 {
    if alive { cell | ALIVE_BIT } else { cell & !ALIVE_BIT }
}

#[inline(always)]
fn set_coins(cell: u8, coins: u8) -> u8 {
    (cell & 0x1F) | ((coins & 0x07) << COINS_SHIFT)
}

#[inline(always)]
fn add_coins(cell: u8, amount: u8) -> u8 {
    let current = get_coins(cell);
    let new_coins = current.saturating_add(amount).min(7);
    set_coins(cell, new_coins)
}
```

### Memory Layout

```rust
// ============================================================================
// CONSTANTS
// ============================================================================

const GRID_SIZE: usize = 512;
const GRID_SHIFT: usize = 9;              // 2^9 = 512
const GRID_MASK: usize = 0x1FF;           // 511
const TOTAL_CELLS: usize = 512 * 512;     // 262,144
const GRID_WORDS: usize = TOTAL_CELLS / 64;  // 4,096 u64s for bitsets

const MAX_PLAYERS: usize = 9;
const STARTING_BALANCE: u64 = 1000;

// ============================================================================
// STATE
// ============================================================================

thread_local! {
    /// Main grid: 1 byte per cell = 256 KB
    /// Index formula: y * 512 + x  OR  (y << 9) | x
    static GRID: RefCell<[u8; TOTAL_CELLS]> = RefCell::new([0u8; TOTAL_CELLS]);

    /// Potential bitset: cells to check THIS generation = 32 KB
    /// Bit is SET if cell might change state
    static POTENTIAL: RefCell<[u64; GRID_WORDS]> = RefCell::new([0u64; GRID_WORDS]);

    /// Next potential bitset: being built DURING simulation = 32 KB
    /// After step_generation(), this becomes the new POTENTIAL
    static NEXT_POTENTIAL: RefCell<[u64; GRID_WORDS]> = RefCell::new([0u64; GRID_WORDS]);

    /// Player principals (index 0 = player 1, etc.)
    static PLAYERS: RefCell<Vec<Principal>> = RefCell::new(Vec::new());

    /// Player balances (parallel to PLAYERS)
    static BALANCES: RefCell<Vec<u64>> = RefCell::new(Vec::new());

    /// Current generation counter
    static GENERATION: RefCell<u64> = RefCell::new(0);

    /// Is simulation running?
    static IS_RUNNING: RefCell<bool> = RefCell::new(true);
}
```

**Memory Footprint:**

| Component | Size |
|-----------|------|
| GRID | 262,144 bytes = 256 KB |
| POTENTIAL | 4,096 × 8 = 32 KB |
| NEXT_POTENTIAL | 4,096 × 8 = 32 KB |
| PLAYERS | ~300 bytes (9 principals max) |
| BALANCES | 72 bytes (9 × u64) |
| **Total** | **~320 KB** |

---

## Coordinate System

### Index ↔ Coordinate Conversion

```rust
// ============================================================================
// COORDINATE HELPERS
// ============================================================================

/// Convert (x, y) to flat array index
/// Uses bit operations for speed: y * 512 + x = (y << 9) | x
#[inline(always)]
fn coord_to_index(x: usize, y: usize) -> usize {
    ((y & GRID_MASK) << GRID_SHIFT) | (x & GRID_MASK)
}

/// Convert flat index to (x, y)
#[inline(always)]
fn index_to_coord(idx: usize) -> (usize, usize) {
    let x = idx & GRID_MASK;        // idx % 512
    let y = idx >> GRID_SHIFT;       // idx / 512
    (x, y)
}

/// Get 8 neighbor indices with TOROIDAL wrapping
/// Grid wraps: x=-1 becomes x=511, x=512 becomes x=0, etc.
#[inline(always)]
fn get_neighbor_indices(idx: usize) -> [usize; 8] {
    let x = idx & GRID_MASK;
    let y = idx >> GRID_SHIFT;

    // Wrapping arithmetic: (x - 1) & MASK handles underflow
    // (x + 1) & MASK handles overflow
    let xm = (x.wrapping_sub(1)) & GRID_MASK;  // x - 1, wrapped
    let xp = (x + 1) & GRID_MASK;               // x + 1, wrapped
    let ym = (y.wrapping_sub(1)) & GRID_MASK;  // y - 1, wrapped
    let yp = (y + 1) & GRID_MASK;               // y + 1, wrapped

    [
        (ym << GRID_SHIFT) | xm,  // NW
        (ym << GRID_SHIFT) | x,   // N
        (ym << GRID_SHIFT) | xp,  // NE
        (y  << GRID_SHIFT) | xm,  // W
        (y  << GRID_SHIFT) | xp,  // E
        (yp << GRID_SHIFT) | xm,  // SW
        (yp << GRID_SHIFT) | x,   // S
        (yp << GRID_SHIFT) | xp,  // SE
    ]
}
```

**Visual: Neighbor Layout**

```
    NW   N   NE
      ↖  ↑  ↗
   W ← [C] → E
      ↙  ↓  ↘
    SW   S   SE

Index offsets (for cell at index i):
  NW = ((y-1) << 9) | (x-1)
  N  = ((y-1) << 9) | x
  NE = ((y-1) << 9) | (x+1)
  W  = (y << 9) | (x-1)
  E  = (y << 9) | (x+1)
  SW = ((y+1) << 9) | (x-1)
  S  = ((y+1) << 9) | x
  SE = ((y+1) << 9) | (x+1)
```

---

## Bitset Operations

### How the Potential Bitset Works

```
POTENTIAL is an array of 4,096 u64 words.
Each u64 covers 64 consecutive cell indices.

Word 0:    covers cells 0-63
Word 1:    covers cells 64-127
Word 2:    covers cells 128-191
...
Word 4095: covers cells 262,080-262,143

To find which word contains cell index i:
  word_index = i >> 6    (i / 64)
  bit_position = i & 63  (i % 64)
  bit_mask = 1u64 << bit_position
```

### Bitset Functions

```rust
// ============================================================================
// BITSET OPERATIONS
// ============================================================================

/// Check if cell index is in potential set
#[inline(always)]
fn is_potential(potential: &[u64; GRID_WORDS], idx: usize) -> bool {
    let word_idx = idx >> 6;
    let bit_mask = 1u64 << (idx & 63);
    (potential[word_idx] & bit_mask) != 0
}

/// Set a single bit in the potential set
#[inline(always)]
fn set_potential(potential: &mut [u64; GRID_WORDS], idx: usize) {
    let word_idx = idx >> 6;
    let bit_mask = 1u64 << (idx & 63);
    potential[word_idx] |= bit_mask;
}

/// Add cell AND all 8 neighbors to potential set
/// This is the key operation for maintaining INVARIANT 1
#[inline(always)]
fn add_with_neighbors(potential: &mut [u64; GRID_WORDS], idx: usize) {
    set_potential(potential, idx);
    for neighbor_idx in get_neighbor_indices(idx) {
        set_potential(potential, neighbor_idx);
    }
}

/// Count set bits in potential (for diagnostics)
fn count_potential(potential: &[u64; GRID_WORDS]) -> u32 {
    potential.iter().map(|w| w.count_ones()).sum()
}
```

### Bitset Iteration Pattern

```rust
/// Iterate over all set bits efficiently using trailing_zeros
///
/// KEY INSIGHT: trailing_zeros() finds lowest set bit in O(1)
/// word &= word - 1 clears that bit in O(1)
/// So we process only SET bits, skipping zeros entirely

fn iterate_potential_bits<F>(potential: &[u64; GRID_WORDS], mut process: F)
where
    F: FnMut(usize),
{
    for word_idx in 0..GRID_WORDS {
        let mut word = potential[word_idx];

        // Skip entirely empty words (very common!)
        if word == 0 {
            continue;
        }

        // Process each set bit
        while word != 0 {
            // trailing_zeros: count zeros from LSB until first 1
            // Example: 0b00101000.trailing_zeros() = 3
            let bit_pos = word.trailing_zeros() as usize;

            // Convert to cell index
            let cell_idx = (word_idx << 6) | bit_pos;

            // Process this cell
            process(cell_idx);

            // Clear the lowest set bit
            // Trick: word & (word - 1) clears lowest set bit
            // Example: 0b00101000 & 0b00100111 = 0b00100000
            word &= word - 1;
        }
    }
}
```

**Visual Example:**

```
Word 5 = 0b0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_0000_1010_0100_0001
                                                                              ↑ ↑  ↑    ↑
                                                                              9 7  5    0

Cell indices in word 5: 5*64 + {0, 5, 7, 9} = {320, 325, 327, 329}

Iteration:
  1. trailing_zeros() = 0  → process cell 320 → clear bit 0
  2. trailing_zeros() = 5  → process cell 325 → clear bit 5
  3. trailing_zeros() = 7  → process cell 327 → clear bit 7
  4. trailing_zeros() = 9  → process cell 329 → clear bit 9
  5. word == 0 → done with this word
```

---

## Main Simulation Loop

### High-Level Pseudocode

```
FUNCTION step_generation():
    // PHASE 1: Clear next_potential (will rebuild during processing)
    next_potential.fill(0)

    // PHASE 2: Process each cell in current potential set
    FOR each set bit in POTENTIAL:
        cell_idx = bit_to_index(bit)
        process_cell(cell_idx)

    // PHASE 3: Swap buffers (next becomes current)
    swap(POTENTIAL, NEXT_POTENTIAL)

    // PHASE 4: Increment generation
    GENERATION += 1
```

### Detailed process_cell Logic

```
FUNCTION process_cell(idx):
    cell = GRID[idx]
    currently_alive = is_alive(cell)
    neighbors = get_neighbor_indices(idx)

    // Count alive neighbors and track owners for birth
    alive_count = 0
    owner_counts = [0; 10]  // Index i = count of player i neighbors

    FOR n_idx IN neighbors:
        n = GRID[n_idx]
        IF is_alive(n):
            alive_count += 1
            owner = get_owner(n)
            IF owner > 0:
                owner_counts[owner] += 1

    // APPLY CONWAY'S RULES
    MATCH (currently_alive, alive_count):

        // CASE 1: SURVIVAL (alive with 2 or 3 neighbors)
        CASE (true, 2) OR (true, 3):
            // Cell survives - no grid change needed
            // Add to next_potential because it might die next gen
            add_with_neighbors(next_potential, idx)

        // CASE 2: BIRTH (dead with exactly 3 neighbors)
        CASE (false, 3):
            // Fair tie-breaking: pass cell idx for position-based hash
            new_owner = find_majority_owner(owner_counts, idx)

            // CAPTURE LOGIC: Only transfer coins from ENEMY territory
            // Self-capture NOT allowed (can't pick up your own coins)
            old_owner = get_owner(cell)
            old_coins = get_coins(cell)
            IF old_owner > 0 AND old_owner != new_owner AND old_coins > 0:
                // Enemy territory captured! ALL coins go to conqueror's balance
                BALANCES[new_owner - 1] += old_coins

            // Birth the cell with 0 coins (captured coins went to balance)
            GRID[idx] = make_cell(new_owner, alive=true, coins=0)

            // Add to next_potential (new alive cell)
            add_with_neighbors(next_potential, idx)

        // CASE 3: DEATH (alive with wrong neighbor count)
        CASE (true, 0) OR (true, 1) OR (true, 4..=8):
            // Cell dies, but KEEPS owner (territory) and coins
            owner = get_owner(cell)
            coins = get_coins(cell)
            GRID[idx] = make_cell(owner, alive=false, coins)

            // IMPORTANT: Neighbors now have one fewer alive neighbor
            // They might change state next gen, so add them to potential
            FOR n_idx IN neighbors:
                add_with_neighbors(next_potential, n_idx)

        // CASE 4: STAYS DEAD (dead with wrong neighbor count)
        CASE (false, 0) OR (false, 1) OR (false, 2) OR (false, 4..=8):
            // Nothing changes, nothing to add to next_potential
            PASS
```

### Full Rust Implementation

```rust
// ============================================================================
// SIMULATION
// ============================================================================

fn step_generation() {
    GRID.with(|grid| {
    POTENTIAL.with(|potential| {
    NEXT_POTENTIAL.with(|next_potential| {
    BALANCES.with(|balances| {
        let grid = &mut *grid.borrow_mut();
        let potential = &*potential.borrow();
        let next_potential = &mut *next_potential.borrow_mut();
        let balances = &mut *balances.borrow_mut();

        // Clear next_potential
        next_potential.fill(0);

        // Process each set bit in potential
        for word_idx in 0..GRID_WORDS {
            let mut word = potential[word_idx];
            if word == 0 { continue; }

            while word != 0 {
                let bit_pos = word.trailing_zeros() as usize;
                let idx = (word_idx << 6) | bit_pos;

                process_cell(grid, next_potential, balances, idx);

                word &= word - 1;
            }
        }
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

    GENERATION.with(|g| *g.borrow_mut() += 1);
}

fn process_cell(
    grid: &mut [u8; TOTAL_CELLS],
    next_potential: &mut [u64; GRID_WORDS],
    balances: &mut Vec<u64>,
    idx: usize,
) {
    let cell = grid[idx];
    let currently_alive = is_alive(cell);
    let neighbors = get_neighbor_indices(idx);

    // Count alive neighbors and their owners
    let mut alive_count = 0u8;
    let mut owner_counts = [0u8; 10];

    for &n_idx in &neighbors {
        let n = grid[n_idx];
        if is_alive(n) {
            alive_count += 1;
            let owner = get_owner(n);
            if owner > 0 && (owner as usize) < owner_counts.len() {
                owner_counts[owner as usize] += 1;
            }
        }
    }

    match (currently_alive, alive_count) {
        // Survival: 2 or 3 neighbors
        (true, 2) | (true, 3) => {
            add_with_neighbors(next_potential, idx);
        }

        // Birth: exactly 3 neighbors
        (false, 3) => {
            // Determine new owner (fair tie-breaking uses cell position)
            let new_owner = find_majority_owner(&owner_counts, idx);

            // CAPTURE LOGIC: Only transfer coins from ENEMY territory
            // - old_owner > 0: territory was claimed
            // - old_owner != new_owner: it's ENEMY territory (not your own)
            // - old_coins > 0: there are coins to capture
            // NOTE: Self-capture is NOT allowed - you can't pick up your own coins
            let old_owner = get_owner(cell);
            let old_coins = get_coins(cell);
            if old_owner > 0 && old_owner != new_owner && old_coins > 0 {
                // Transfer ALL coins to conqueror's balance
                let new_owner_idx = (new_owner - 1) as usize;
                if new_owner_idx < balances.len() {
                    balances[new_owner_idx] += old_coins as u64;
                }
            }

            // Birth cell with 0 coins (captured coins went to balance, not cell)
            grid[idx] = make_cell(new_owner, true, 0);
            add_with_neighbors(next_potential, idx);
        }

        // Death: wrong neighbor count
        (true, _) => {
            let owner = get_owner(cell);
            let coins = get_coins(cell);
            grid[idx] = make_cell(owner, false, coins);

            // Add neighbors to next_potential (they lost a neighbor)
            for &n_idx in &neighbors {
                add_with_neighbors(next_potential, n_idx);
            }
        }

        // Stays dead: do nothing
        (false, _) => {}
    }
}

/// Find majority owner among neighbors, with FAIR tie-breaking using cell position hash.
///
/// Why cell position hash? The old "lowest player wins" approach gave P1 unfair advantage
/// in every tie. Using cell position distributes ties fairly across the grid.
///
/// Example: P1, P3, P5 tied (each has 1 neighbor)
///   - Cell 0: 0 % 3 = 0 → tied[0] = P1 wins
///   - Cell 1: 1 % 3 = 1 → tied[1] = P3 wins
///   - Cell 2: 2 % 3 = 2 → tied[2] = P5 wins
///   - Cell 3: 3 % 3 = 0 → tied[0] = P1 wins
///   - ... distributes evenly across 262K cells
fn find_majority_owner(counts: &[u8; 10], cell_idx: usize) -> u8 {
    // Find the maximum neighbor count
    let max_count = counts[1..=9].iter().max().copied().unwrap_or(0);
    if max_count == 0 {
        return 1; // No neighbors with owners, default to P1
    }

    // Collect all players tied at max_count (ascending order)
    let tied: Vec<u8> = (1..=9)
        .filter(|&p| counts[p] == max_count)
        .map(|p| p as u8)
        .collect();

    // Single winner - no tie to break
    if tied.len() == 1 {
        return tied[0];
    }

    // FAIR TIE-BREAKING: Use cell position to deterministically pick winner
    // Each cell location favors a different player among the tied ones
    // Result: ties distributed evenly across the grid
    let hash = cell_idx % tied.len();
    tied[hash]
}
```

---

## Place Cells Operation

### Pseudocode

```
FUNCTION place_cells(caller, cells: Vec<(x, y)>):
    // Get or assign player number
    player_num = get_or_create_player(caller)
    player_idx = player_num - 1

    // Check balance
    cost = cells.len()
    IF BALANCES[player_idx] < cost:
        RETURN Err("Insufficient balance")

    placed = 0

    FOR (x, y) IN cells:
        idx = coord_to_index(wrap(x), wrap(y))
        cell = GRID[idx]

        // VALIDATION: Can't place on alive cells
        IF is_alive(cell):
            CONTINUE  // Skip this cell

        // VALIDATION: Can't place if already at 7 coins
        IF get_coins(cell) >= 7:
            CONTINUE  // Skip this cell

        // PLACE THE CELL
        new_coins = min(get_coins(cell) + 1, 7)
        GRID[idx] = make_cell(player_num, alive=true, new_coins)

        // CRITICAL: Add to potential set (maintains INVARIANT 1)
        add_with_neighbors(POTENTIAL, idx)

        placed += 1

    // Deduct balance (only for actually placed cells)
    BALANCES[player_idx] -= placed

    RETURN Ok(PlaceResult { placed, generation, new_balance })
```

### Key Details

```rust
#[update]
fn place_cells(cells: Vec<(i32, i32)>) -> Result<PlaceResult, String> {
    let caller = ic_cdk::caller();

    // Get or assign player
    let player_num = PLAYERS.with(|p| {
        let mut players = p.borrow_mut();

        // Check if already registered
        if let Some(pos) = players.iter().position(|&p| p == caller) {
            return Ok((pos + 1) as u8);
        }

        // Check if room for new player
        if players.len() >= MAX_PLAYERS {
            return Err("Game full".to_string());
        }

        // Register new player
        players.push(caller);
        BALANCES.with(|b| b.borrow_mut().push(STARTING_BALANCE));
        Ok(players.len() as u8)
    })?;

    let player_idx = (player_num - 1) as usize;
    let cost = cells.len() as u64;

    // Check balance
    let balance = BALANCES.with(|b| b.borrow().get(player_idx).copied().unwrap_or(0));
    if balance < cost {
        return Err(format!("Need {} coins, have {}", cost, balance));
    }

    let mut placed = 0u32;

    GRID.with(|g| {
    POTENTIAL.with(|p| {
        let grid = &mut *g.borrow_mut();
        let potential = &mut *p.borrow_mut();

        for (x, y) in cells {
            // Wrap coordinates to grid
            let wx = ((x % 512) + 512) as usize % 512;
            let wy = ((y % 512) + 512) as usize % 512;
            let idx = coord_to_index(wx, wy);

            let cell = grid[idx];

            // Skip if alive
            if is_alive(cell) { continue; }

            // Skip if 7 coins (cap)
            if get_coins(cell) >= 7 { continue; }

            // Place cell
            let new_coins = get_coins(cell).saturating_add(1).min(7);
            grid[idx] = make_cell(player_num, true, new_coins);

            // Add to potential (CRITICAL!)
            add_with_neighbors(potential, idx);

            placed += 1;
        }
    });
    });

    // Deduct balance
    BALANCES.with(|b| {
        if let Some(bal) = b.borrow_mut().get_mut(player_idx) {
            *bal -= placed as u64;
        }
    });

    let generation = GENERATION.with(|g| *g.borrow());
    let new_balance = BALANCES.with(|b| b.borrow().get(player_idx).copied().unwrap_or(0));

    Ok(PlaceResult { placed, generation, new_balance })
}
```

---

## Timer Setup

### Batched Execution

```rust
const GENERATIONS_PER_TICK: u32 = 10;
const TICK_INTERVAL_MS: u64 = 1000;  // 1 second = 10 generations

fn start_simulation_timer() {
    ic_cdk_timers::set_timer_interval(
        Duration::from_millis(TICK_INTERVAL_MS),
        || {
            let is_running = IS_RUNNING.with(|r| *r.borrow());
            if is_running {
                for _ in 0..GENERATIONS_PER_TICK {
                    step_generation();
                }
            }
        }
    );
}
```

**Why batch 10 generations?**

- Timer has fixed overhead (~590K cycles per call)
- By batching 10 gens, we amortize this overhead
- Result: 10 gen/sec at ~3.4M cycles/sec total

---

## Stable Memory & Upgrades

### Pre-Upgrade: Save State

```rust
#[pre_upgrade]
fn pre_upgrade() {
    // Serialize everything to stable memory

    // 1. Save grid (256 KB)
    GRID.with(|g| {
        let grid = g.borrow();
        // Write to stable memory starting at offset 0
        ic_cdk::api::stable::stable_write(0, &grid[..]);
    });

    // 2. Save metadata as candid at offset 256KB
    let metadata = Metadata {
        generation: GENERATION.with(|g| *g.borrow()),
        players: PLAYERS.with(|p| p.borrow().clone()),
        balances: BALANCES.with(|b| b.borrow().clone()),
        is_running: IS_RUNNING.with(|r| *r.borrow()),
    };
    let encoded = candid::encode_one(&metadata).unwrap();
    let len = encoded.len() as u32;

    // Write length prefix then data
    ic_cdk::api::stable::stable_write(TOTAL_CELLS as u32, &len.to_le_bytes());
    ic_cdk::api::stable::stable_write(TOTAL_CELLS as u32 + 4, &encoded);
}
```

### Post-Upgrade: Restore State

```rust
#[post_upgrade]
fn post_upgrade() {
    // 1. Restore grid
    GRID.with(|g| {
        let mut grid = g.borrow_mut();
        let mut buf = [0u8; TOTAL_CELLS];
        ic_cdk::api::stable::stable_read(0, &mut buf);
        *grid = buf;
    });

    // 2. Restore metadata
    let mut len_buf = [0u8; 4];
    ic_cdk::api::stable::stable_read(TOTAL_CELLS as u32, &mut len_buf);
    let len = u32::from_le_bytes(len_buf) as usize;

    let mut meta_buf = vec![0u8; len];
    ic_cdk::api::stable::stable_read(TOTAL_CELLS as u32 + 4, &mut meta_buf);

    if let Ok(metadata) = candid::decode_one::<Metadata>(&meta_buf) {
        GENERATION.with(|g| *g.borrow_mut() = metadata.generation);
        PLAYERS.with(|p| *p.borrow_mut() = metadata.players);
        BALANCES.with(|b| *b.borrow_mut() = metadata.balances);
        IS_RUNNING.with(|r| *r.borrow_mut() = metadata.is_running);
    }

    // 3. CRITICAL: Rebuild potential set from grid
    rebuild_potential_from_grid();

    // 4. Restart timer
    start_simulation_timer();
}

/// Rebuild potential bitset by scanning for alive cells
/// Called after upgrade or when potential might be corrupted
fn rebuild_potential_from_grid() {
    GRID.with(|g| {
    POTENTIAL.with(|p| {
        let grid = g.borrow();
        let potential = &mut *p.borrow_mut();

        // Clear potential
        potential.fill(0);

        // Add every alive cell and its neighbors
        for idx in 0..TOTAL_CELLS {
            if is_alive(grid[idx]) {
                add_with_neighbors(potential, idx);
            }
        }
    });
    });
}
```

---

## Query API: Sparse Response

### get_state Returns Only Non-Empty Cells

```rust
#[derive(CandidType, Deserialize)]
struct SparseCell {
    x: u16,
    y: u16,
    owner: u8,
    coins: u8,
}

#[derive(CandidType, Deserialize)]
struct GameState {
    generation: u64,
    alive_cells: Vec<SparseCell>,    // Only alive cells
    territory: Vec<SparseCell>,       // Dead cells with owner or coins
    players: Vec<Principal>,
    balances: Vec<u64>,
    player_num: Option<u8>,           // Caller's player number (if registered)
}

#[query]
fn get_state() -> GameState {
    let caller = ic_cdk::caller();

    let mut alive_cells = Vec::new();
    let mut territory = Vec::new();

    GRID.with(|g| {
        let grid = g.borrow();

        for idx in 0..TOTAL_CELLS {
            let cell = grid[idx];

            // Skip completely empty cells
            if cell == 0 { continue; }

            let (x, y) = index_to_coord(idx);
            let owner = get_owner(cell);
            let coins = get_coins(cell);

            let sparse = SparseCell {
                x: x as u16,
                y: y as u16,
                owner,
                coins,
            };

            if is_alive(cell) {
                alive_cells.push(sparse);
            } else {
                // Dead but has territory or coins
                territory.push(sparse);
            }
        }
    });

    let player_num = PLAYERS.with(|p| {
        p.borrow()
            .iter()
            .position(|&p| p == caller)
            .map(|i| (i + 1) as u8)
    });

    GameState {
        generation: GENERATION.with(|g| *g.borrow()),
        alive_cells,
        territory,
        players: PLAYERS.with(|p| p.borrow().clone()),
        balances: BALANCES.with(|b| b.borrow().clone()),
        player_num,
    }
}
```

**Response Size Analysis:**

- 5,000 alive cells × 6 bytes = 30 KB
- 10,000 territory cells × 6 bytes = 60 KB
- Total: ~90 KB (vs 262 KB for full grid)

---

## Edge Cases

### Edge Case 1: Empty Grid

```
Scenario: No alive cells
Potential set: Empty (all zeros)
step_generation(): Iterates 0 cells, does nothing, swaps empty buffers
Cost: ~10K instructions (bitset scan with all zeros)

This is CORRECT: nothing can change in an empty grid
```

### Edge Case 2: Full Grid (Worst Case)

```
Scenario: All 262,144 cells are alive
Potential set: All bits set (all ones)
step_generation(): Processes all 262,144 cells

Cost: Same as dense algorithm (~10M instructions)

This is ACCEPTABLE: sparse degrades to dense only in pathological cases
In practice, Conway's Life never sustains >5% alive (chaos leads to death)
```

### Edge Case 3: Glider at Edge

```
Scenario: Glider pattern crossing x=511 → x=0 boundary

Toroidal wrapping ensures correct behavior:
- Cell at (511, y) has neighbor at (0, y)
- Bitset correctly tracks both sides

Test: Place glider at (510, 100), verify it crosses to (0, 100) correctly
```

### Edge Case 4: Concurrent place_cells and step_generation

```
Scenario: User places cells while timer fires

ICP executes messages atomically:
- Either place_cells completes fully, then step_generation runs
- Or step_generation completes fully, then place_cells runs

No race conditions possible due to canister execution model
```

### Edge Case 5: Majority Owner Tie

```
Scenario: 3 neighbors from 3 different players (1-1-1 tie)

find_majority_owner uses FAIR cell position hash:
- Collects tied players in ascending order: [P1, P3, P5]
- Uses cell_idx % tied.len() to pick winner
- Result: Each tied player wins ~1/n of contested cells across grid

Example at different cell positions:
- Cell 0: 0 % 3 = 0 → tied[0] = P1 wins
- Cell 1: 1 % 3 = 1 → tied[1] = P3 wins
- Cell 2: 2 % 3 = 2 → tied[2] = P5 wins
- Cell 3: 3 % 3 = 0 → tied[0] = P1 wins

Fairness: Over 262,144 cells, ties distribute evenly (±1 cell)
Deterministic: Same cell position always produces same winner
```

---

## Testing Strategy

### Unit Tests (Rust)

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cell_encoding() {
        // Test all combinations
        for owner in 0..=9 {
            for coins in 0..=7 {
                for alive in [false, true] {
                    let cell = make_cell(owner, alive, coins);
                    assert_eq!(get_owner(cell), owner);
                    assert_eq!(is_alive(cell), alive);
                    assert_eq!(get_coins(cell), coins);
                }
            }
        }
    }

    #[test]
    fn test_coordinate_wrapping() {
        // Test edge wrapping
        assert_eq!(coord_to_index(0, 0), 0);
        assert_eq!(coord_to_index(511, 511), 262143);

        // Test neighbor wrapping at corners
        let neighbors = get_neighbor_indices(0);  // Top-left corner
        assert!(neighbors.contains(&coord_to_index(511, 511)));  // NW wraps
        assert!(neighbors.contains(&coord_to_index(511, 0)));    // W wraps
        assert!(neighbors.contains(&coord_to_index(0, 511)));    // N wraps
    }

    #[test]
    fn test_blinker_oscillator() {
        // Blinker: 3 cells in a row, oscillates between horizontal/vertical
        //   .X.     ...
        //   .X.  -> XXX
        //   .X.     ...

        let mut grid = [0u8; TOTAL_CELLS];
        let mut potential = [0u64; GRID_WORDS];
        let mut next_potential = [0u64; GRID_WORDS];
        let mut balances = vec![1000u64];

        // Set up vertical blinker at center
        let center = coord_to_index(256, 256);
        grid[center] = make_cell(1, true, 0);
        grid[coord_to_index(256, 255)] = make_cell(1, true, 0);
        grid[coord_to_index(256, 257)] = make_cell(1, true, 0);

        // Initialize potential
        for idx in 0..TOTAL_CELLS {
            if is_alive(grid[idx]) {
                add_with_neighbors(&mut potential, idx);
            }
        }

        // Run one generation
        // ... (would need to refactor step_generation to be testable)

        // Verify horizontal blinker
        assert!(is_alive(grid[coord_to_index(255, 256)]));
        assert!(is_alive(grid[coord_to_index(256, 256)]));
        assert!(is_alive(grid[coord_to_index(257, 256)]));
        assert!(!is_alive(grid[coord_to_index(256, 255)]));
        assert!(!is_alive(grid[coord_to_index(256, 257)]));
    }

    #[test]
    fn test_sparse_matches_dense() {
        // Run same pattern through sparse and dense, verify identical
        // This is the CRITICAL correctness test
    }
}
```

### Integration Tests (dfx)

```bash
# Test 1: Join and place
dfx canister call life2_backend join_game
dfx canister call life2_backend place_cells '(vec { record { 100; 100 }; record { 101; 100 }; record { 100; 101 } })'

# Test 2: Get state and verify
dfx canister call life2_backend get_state
# Should show 3 alive cells

# Test 3: Wait and verify simulation
sleep 5
dfx canister call life2_backend get_generation
# Should be >= 50 (10 gen/sec * 5 sec)

# Test 4: Verify alive count changes
dfx canister call life2_backend get_alive_count
```

---

## Deployment Strategy

### Fresh Deploy (Recommended)

This is a **fresh deploy** to a new canister. No migration from the old dense implementation.

```
Deployment steps:
1. Create new lib.rs with sparse implementation
2. Deploy to new canister ID (or same canister with fresh state)
3. Update frontend to use new canister
4. Old implementation archived at: life2_backend/src/lib_archive.md

Why fresh deploy?
- Data format changed (u16 → u8 cells)
- Game mechanics changed (points 0-127 → coins 0-7)
- Clean slate for testing
- No complex migration code to maintain
```

### Reference: Old Implementation

The previous dense implementation is preserved at:
```
life2_backend/src/lib_archive.md
```

Key differences:
| Aspect | Old (Dense) | New (Sparse) |
|--------|-------------|--------------|
| Cell size | u16 (2 bytes) | u8 (1 byte) |
| Points/Coins | 0-127 | 0-7 |
| Iteration | All 262K cells | ~20K potential cells |
| Speed | 1 gen/sec | 10 gen/sec |

---

## Candid Interface

```candid
type SparseCell = record {
    x: nat16;
    y: nat16;
    owner: nat8;
    coins: nat8;
};

type GameState = record {
    generation: nat64;
    alive_cells: vec SparseCell;
    territory: vec SparseCell;
    players: vec principal;
    balances: vec nat64;
    player_num: opt nat8;
};

type PlaceResult = record {
    placed: nat32;
    generation: nat64;
    new_balance: nat64;
};

service : {
    // Player actions
    join_game: () -> (variant { Ok: nat8; Err: text });
    place_cells: (vec record { int32; int32 }) -> (variant { Ok: PlaceResult; Err: text });

    // Queries (FREE - no cycles cost to caller)
    get_state: () -> (GameState) query;
    get_generation: () -> (nat64) query;
    get_alive_count: () -> (nat32) query;

    // Admin
    pause_game: () -> ();
    resume_game: () -> ();
    reset_game: () -> ();
}
```

---

## Cost Analysis (Revised)

### Per-Generation Compute

```
Assumptions:
- 5,000 alive cells
- 20,000 potential cells (alive + ~3 neighbors each on average)
- 500 state changes per generation

Operations breakdown:
┌──────────────────────────────────────────────────────────────────┐
│ Operation                          │ Instructions               │
├──────────────────────────────────────────────────────────────────┤
│ Clear next_potential (32KB)        │ 8K (memset)                │
│ Bitset scan (4096 words)           │ 12K (mostly skipped)       │
│ Process 20K cells:                 │                            │
│   - Read cell                      │ 20K × 2 = 40K              │
│   - Get 8 neighbors                │ 20K × 20 = 400K            │
│   - Read 8 neighbor cells          │ 20K × 8 × 2 = 320K         │
│   - Count alive + owners           │ 20K × 15 = 300K            │
│   - Match + branch                 │ 20K × 5 = 100K             │
│ Birth/death (500 changes):         │                            │
│   - Write cell                     │ 500 × 3 = 1.5K             │
│   - add_with_neighbors             │ 500 × 9 × 5 = 22K          │
│ Swap pointers                      │ 10                         │
│ Increment generation               │ 5                          │
├──────────────────────────────────────────────────────────────────┤
│ TOTAL                              │ ~700K instructions         │
└──────────────────────────────────────────────────────────────────┘
```

### Annual Cost Calculation

```
Instructions per generation:     700,000
Cycles per instruction:          0.4 (IC average)
Cycles per generation:           280,000

Timer overhead per call:         590,000 cycles
Generations per call:            10
Compute per call:                2,800,000 cycles
Total per call:                  3,390,000 cycles

Calls per second:                1
Cycles per second:               3,390,000

Seconds per year:                31,536,000
Cycles per year:                 106,917,040,000,000 (~107T)

Cost at $1.30/trillion:          $139/year
```

### Comparison Table

| Approach | Gen/sec | Cycles/sec | Annual Cost |
|----------|---------|------------|-------------|
| Current Dense | 1 | 4.2M | $172 |
| Current Dense | 10 | 42M | $1,720 |
| **Sparse** | **10** | **3.4M** | **$139** |
| Sparse (small pop) | 10 | 1.8M | $74 |

**Result: 10x speed at 80% of the cost (or same speed at 8% cost)**

---

## Implementation Checklist

### Phase 1: Core Data Structures
- [ ] u8 cell encoding with owner/alive/coins
- [ ] GRID array (256 KB)
- [ ] POTENTIAL bitset (32 KB)
- [ ] NEXT_POTENTIAL bitset (32 KB)
- [ ] Coordinate helpers (coord_to_index, index_to_coord, get_neighbor_indices)
- [ ] Bitset operations (set_potential, add_with_neighbors)

### Phase 2: Simulation Engine
- [ ] step_generation with bitset iteration
- [ ] process_cell with all 4 cases (pass idx to find_majority_owner)
- [ ] find_majority_owner with FAIR cell position hash tie-breaking
- [ ] Coin transfer on enemy capture (not self-capture)

### Phase 3: Player API
- [ ] join_game (register player, assign number)
- [ ] place_cells (validate, place, update potential, deduct balance)
- [ ] get_state (sparse response)
- [ ] get_generation, get_alive_count helpers

### Phase 4: Timer & Lifecycle
- [ ] start_simulation_timer (10 gen batched per second)
- [ ] init (start timer)
- [ ] pre_upgrade (save to stable)
- [ ] post_upgrade (restore, rebuild potential, restart timer)

### Phase 5: Testing
- [ ] Unit tests for cell encoding
- [ ] Unit tests for coordinate wrapping
- [ ] Unit tests for bitset operations
- [ ] Unit test: fair tie-breaking distributes wins across cell positions
- [ ] Unit test: enemy capture transfers coins to balance
- [ ] Unit test: self-capture does NOT transfer coins (same owner)
- [ ] Unit test: 7-coin cap blocks placement
- [ ] Integration test: blinker oscillates correctly
- [ ] Integration test: glider crosses boundary
- [ ] Integration test: sparse matches dense (correctness)
- [ ] Integration test: survives upgrade
- [ ] Load test: 10K alive cells, verify 10 gen/sec

---

## Summary

**Same game, 10x faster, same cost.**

| Feature | Implementation |
|---------|----------------|
| Cell encoding | u8: owner (4b) + alive (1b) + coins (3b) |
| Grid storage | 256 KB flat array |
| Sparse tracking | 64 KB bitsets (potential + next_potential) |
| Iteration | trailing_zeros() to extract set bits |
| Tie-breaking | Fair cell position hash (not lowest-player-wins) |
| Capture | Enemy territory only, coins to balance, newborn gets 0 |
| Speed | 10 generations/second |
| Annual cost | ~$70-140 depending on population |

**Key insight**: Only ~8% of cells can change state per generation. Sparse iteration exploits this for 10x speedup.
