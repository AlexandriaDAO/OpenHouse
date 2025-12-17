# Life2: Pure On-Chain Game of Life (Hybrid Sparse/Dense)

## Overview

A fully on-chain Game of Life combining **sparse iteration** (OneLoneCoder style) with **dense binary grids** for O(1) state lookups, running at 10 generations/second entirely on the Internet Computer.

**Key Innovation**: Sparse iteration (only process cells that can change) + Dense binary grids (fast bit operations for state). Dynamic player allocation means we only create grids when players join.

| Aspect | Life1 (Hybrid) | Life2 (On-Chain) |
|--------|----------------|------------------|
| Simulation | Fly.io (off-chain) | IC Canister (on-chain) |
| Grid Storage | Dense 2-byte cells (512 KB) | **Binary grids (~32-320 KB)** |
| Computation | All 262K cells | **Only potential cells (~10-50K)** |
| Cost | ~$670/year (server) | **~$50-200/year (cycles only)** |
| Decentralization | Medium | **Full** |
| Coins/Points | Yes (in cells) | **Simple balance only** |

---

## Deployment Info

| Component | Value |
|-----------|-------|
| Canister Name | `life2_backend` |
| Canister ID | TBD (new deployment) |
| Frontend Route | `/life2` |
| Grid Size | 512x512 (262,144 cells) |
| Generation Rate | 10 gen/sec |
| Max Players | 9 |

---

## Architecture

```
+-----------------------------------------------------------------------+
|                    IC Canister (life2_backend)                        |
|                                                                       |
|  +------------------+   +----------------------+   +-----------------+ |
|  |   ALIVE GRID     |   |  PLAYER TERRITORY    |   |  POTENTIAL SET  | |
|  |  [u64; 4096]     |   |  Vec<[u64; 4096]>    |   |  HashSet<u32>   | |
|  |  32 KB binary    |   |  32 KB per player    |   |  ~50K coords    | |
|  |  O(1) bit lookup |   |  Dynamic allocation  |   |  Sparse iterate | |
|  +------------------+   +----------------------+   +-----------------+ |
|                                                                       |
|  step_generation() iterates POTENTIAL, looks up state in binary grids |
|  Timer fires every 100ms (10 gen/sec)                                 |
+-----------------------------------------------------------------------+
                            |
                            | Query (get_state) - FREE
                            v
+-----------------------------------------------------------------------+
|                    Frontend (/life2)                                  |
|                                                                       |
|  Polls IC every 5 seconds for latest state                           |
|  Simulates locally at 10 gen/sec between polls                       |
|  Renders 512x512 grid with player colors                             |
|  Submits place_cells() for user actions                              |
+-----------------------------------------------------------------------+
```

---

## Hybrid Design: Sparse Iteration + Dense State

### Why Hybrid?

**Pure Sparse (HashSet for everything)** - Problems:
- HashSet lookup: ~20-50 cycles per operation
- Finding owner requires checking 9 HashSets = O(9) expensive lookups
- Poor cache locality

**Pure Dense (iterate all cells)** - Problems:
- Must check all 262,144 cells every generation
- Most cells never change state

**Hybrid Solution** - Best of both:
- **Sparse HashSet** for WHICH cells to process (OneLoneCoder optimization)
- **Dense binary grids** for WHAT the state is (O(1) bit operations)

| Operation | Pure Sparse | Hybrid |
|-----------|-------------|--------|
| Check if alive | ~30 cycles (HashSet) | **~3 cycles (bit op)** |
| Find owner | 9 x ~30 = 270 cycles | **9 x ~3 = 27 cycles** |
| Cells processed | ~50K | ~50K |
| Cache behavior | Random | **Sequential** |

### Dynamic Player Allocation

Players get their territory grid allocated **only when they join**:

| Active Players | Memory Used |
|----------------|-------------|
| 0 | 32 KB (alive grid only) |
| 1 | 64 KB |
| 3 | 128 KB |
| 5 | 192 KB |
| 9 (max) | 320 KB |

---

## Data Structures

```rust
const GRID_SIZE: usize = 512;
const GRID_BITS: usize = GRID_SIZE * GRID_SIZE;      // 262,144 bits
const GRID_WORDS: usize = GRID_BITS / 64;            // 4,096 u64s = 32 KB
const GRID_MASK: u32 = 511;                          // For toroidal wrapping
const MAX_PLAYERS: usize = 9;
const STARTING_BALANCE: u64 = 10_000;

thread_local! {
    // === SPARSE: Which cells to process (OneLoneCoder style) ===
    // Only cells that MIGHT change state
    // Rebuilt each generation from births/deaths + their neighbors
    static POTENTIAL: RefCell<HashSet<u32>> = RefCell::new(HashSet::new());

    // === DENSE: Master alive grid (32 KB) ===
    // Bit-packed: 1 = alive, 0 = dead
    // O(1) lookup via bit operations
    static ALIVE: RefCell<[u64; GRID_WORDS]> = RefCell::new([0; GRID_WORDS]);

    // === DENSE: Per-player territory grids (32 KB each) ===
    // Dynamically allocated when player joins
    // None = player slot not used, Some = player's territory bitmap
    static TERRITORY: RefCell<Vec<Option<Box<[u64; GRID_WORDS]>>>> =
        RefCell::new(Vec::new());

    // === PLAYER DATA ===
    static PLAYERS: RefCell<Vec<Principal>> = RefCell::new(Vec::new());
    static BALANCES: RefCell<Vec<u64>> = RefCell::new(Vec::new());

    // === GAME STATE ===
    static GENERATION: RefCell<u64> = RefCell::new(0);
    static IS_RUNNING: RefCell<bool> = RefCell::new(true);
}
```

### Coordinate Encoding

Pack (x, y) into a single u32 for the potential set, and derive bit index for grids:

```rust
/// Pack (x, y) into u32 for HashSet storage
/// Bits 0-8: x (0-511), Bits 9-17: y (0-511)
#[inline]
fn pack_coord(x: u32, y: u32) -> u32 {
    ((y & GRID_MASK) << 9) | (x & GRID_MASK)
}

#[inline]
fn unpack_coord(packed: u32) -> (u32, u32) {
    (packed & GRID_MASK, (packed >> 9) & GRID_MASK)
}

/// Convert packed coord to bit index for grid access
#[inline]
fn coord_to_bit_index(packed: u32) -> (usize, u64) {
    let word_idx = (packed >> 6) as usize;      // Which u64 (0-4095)
    let bit_pos = packed & 63;                   // Which bit (0-63)
    (word_idx, 1u64 << bit_pos)
}

/// Get 8 neighbor coordinates (with toroidal wrapping)
#[inline]
fn get_neighbors(packed: u32) -> [u32; 8] {
    let (x, y) = unpack_coord(packed);
    [
        pack_coord(x.wrapping_sub(1) & GRID_MASK, y.wrapping_sub(1) & GRID_MASK),
        pack_coord(x,                              y.wrapping_sub(1) & GRID_MASK),
        pack_coord(x.wrapping_add(1) & GRID_MASK, y.wrapping_sub(1) & GRID_MASK),
        pack_coord(x.wrapping_sub(1) & GRID_MASK, y),
        pack_coord(x.wrapping_add(1) & GRID_MASK, y),
        pack_coord(x.wrapping_sub(1) & GRID_MASK, y.wrapping_add(1) & GRID_MASK),
        pack_coord(x,                              y.wrapping_add(1) & GRID_MASK),
        pack_coord(x.wrapping_add(1) & GRID_MASK, y.wrapping_add(1) & GRID_MASK),
    ]
}
```

### Bit Operations for State Access

```rust
/// Check if cell is alive - O(1) bit lookup
#[inline]
fn is_alive(alive_grid: &[u64; GRID_WORDS], coord: u32) -> bool {
    let (word_idx, bit_mask) = coord_to_bit_index(coord);
    (alive_grid[word_idx] & bit_mask) != 0
}

/// Set cell alive state
#[inline]
fn set_alive(alive_grid: &mut [u64; GRID_WORDS], coord: u32, alive: bool) {
    let (word_idx, bit_mask) = coord_to_bit_index(coord);
    if alive {
        alive_grid[word_idx] |= bit_mask;
    } else {
        alive_grid[word_idx] &= !bit_mask;
    }
}

/// Get owner of cell - O(n) where n = active players, but just bit ops
/// Returns 0 = unclaimed, 1-9 = player number
#[inline]
fn get_owner(territory: &[Option<Box<[u64; GRID_WORDS]>>], coord: u32) -> u8 {
    let (word_idx, bit_mask) = coord_to_bit_index(coord);

    for (i, maybe_grid) in territory.iter().enumerate() {
        if let Some(grid) = maybe_grid {
            if (grid[word_idx] & bit_mask) != 0 {
                return (i + 1) as u8;
            }
        }
    }
    0
}

/// Set territory for a cell
#[inline]
fn set_territory(
    territory: &mut [Option<Box<[u64; GRID_WORDS]>>],
    coord: u32,
    player: u8  // 1-9, or 0 to clear
) {
    let (word_idx, bit_mask) = coord_to_bit_index(coord);

    // Clear from all players first
    for maybe_grid in territory.iter_mut() {
        if let Some(grid) = maybe_grid {
            grid[word_idx] &= !bit_mask;
        }
    }

    // Set for new owner if specified
    if player > 0 && (player as usize - 1) < territory.len() {
        if let Some(grid) = &mut territory[player as usize - 1] {
            grid[word_idx] |= bit_mask;
        }
    }
}
```

---

## Simulation Algorithm

### The Potential Set (OneLoneCoder Optimization)

Instead of checking all 262,144 cells, we only check cells that CAN possibly change:

1. A cell can only **DIE** if it's currently alive
2. A cell can only be **BORN** if it has at least one alive neighbor

Therefore: **Potential = Alive cells + all neighbors of alive cells**

```rust
/// Rebuild the potential set from alive grid
fn rebuild_potential(alive_grid: &[u64; GRID_WORDS], potential: &mut HashSet<u32>) {
    potential.clear();

    // Iterate through alive grid to find living cells
    for word_idx in 0..GRID_WORDS {
        let word = alive_grid[word_idx];
        if word == 0 { continue; }  // Skip empty words (64 dead cells)

        // Check each bit in this word
        for bit in 0..64 {
            if (word & (1u64 << bit)) != 0 {
                let coord = ((word_idx as u32) << 6) | bit;

                // This alive cell might die
                potential.insert(coord);

                // Its neighbors might be born
                for neighbor in get_neighbors(coord) {
                    potential.insert(neighbor);
                }
            }
        }
    }
}
```

### step_generation (Hybrid)

```rust
/// Run one generation - sparse iteration, dense lookups
fn step_generation() {
    // Get references to state
    let potential_snapshot: Vec<u32> = POTENTIAL.with(|p|
        p.borrow().iter().copied().collect()
    );

    // Snapshot alive grid for consistent neighbor reads
    let alive_snapshot: [u64; GRID_WORDS] = ALIVE.with(|a| *a.borrow());

    // Snapshot territory for owner lookups
    let territory_snapshot: Vec<Option<Box<[u64; GRID_WORDS]>>> = TERRITORY.with(|t|
        t.borrow().iter().map(|opt| opt.clone()).collect()
    );

    // Track changes
    let mut births: Vec<(u32, u8)> = Vec::new();  // (coord, new_owner)
    let mut deaths: Vec<u32> = Vec::new();

    // Only check cells in the potential set
    for coord in potential_snapshot {
        let neighbors = get_neighbors(coord);

        // Count alive neighbors and track owners for majority vote
        let mut alive_count = 0u8;
        let mut owner_counts = [0u8; MAX_PLAYERS + 1];  // Index 0 unused

        for n in neighbors {
            if is_alive(&alive_snapshot, n) {
                alive_count += 1;
                let owner = get_owner(&territory_snapshot, n);
                if owner > 0 {
                    owner_counts[owner as usize] += 1;
                }
            }
        }

        let currently_alive = is_alive(&alive_snapshot, coord);

        match (currently_alive, alive_count) {
            // Alive with 2-3 neighbors: survive (no change needed)
            (true, 2) | (true, 3) => {}

            // Dead with exactly 3 neighbors: birth!
            (false, 3) => {
                let new_owner = find_majority_owner(&owner_counts);
                births.push((coord, new_owner));
            }

            // Alive with wrong neighbor count: death!
            (true, _) => {
                deaths.push(coord);
            }

            // Dead without 3 neighbors: stays dead (no change)
            (false, _) => {}
        }
    }

    // Apply changes to alive grid
    ALIVE.with(|a| {
        let mut alive = a.borrow_mut();
        for coord in deaths.iter() {
            set_alive(&mut alive, *coord, false);
        }
        for (coord, _) in births.iter() {
            set_alive(&mut alive, *coord, true);
        }
    });

    // Apply territory changes (only for births - territory persists on death)
    TERRITORY.with(|t| {
        let mut territory = t.borrow_mut();
        for (coord, owner) in births.iter() {
            if *owner > 0 {
                set_territory(&mut territory, *coord, *owner);
            }
        }
    });

    // Rebuild potential set for next generation
    ALIVE.with(|a| {
        POTENTIAL.with(|p| {
            rebuild_potential(&a.borrow(), &mut p.borrow_mut());
        });
    });

    // Increment generation
    GENERATION.with(|g| *g.borrow_mut() += 1);
}

/// Find the owner with most neighbors (for birth inheritance)
fn find_majority_owner(counts: &[u8; MAX_PLAYERS + 1]) -> u8 {
    let mut max_count = 0u8;
    let mut max_owner = 0u8;

    for (owner, &count) in counts.iter().enumerate().skip(1) {
        if count > max_count {
            max_count = count;
            max_owner = owner as u8;
        }
    }
    max_owner
}
```

---

## Memory Analysis

### Hybrid vs Alternatives

| Approach | Memory | Alive Lookup | Owner Lookup |
|----------|--------|--------------|--------------|
| Current Dense (2-byte cells) | 512 KB fixed | O(1) | O(1) |
| Pure Sparse (HashSets) | ~50-100 KB | O(1) hash | O(9) hash |
| **Hybrid (our design)** | **32-320 KB** | **O(1) bit** | **O(n) bit** |

### Dynamic Scaling

```
Empty game:     32 KB  (alive grid only)
1 player:       64 KB  (+ 1 territory grid)
3 players:      128 KB (+ 3 territory grids)
5 players:      192 KB (+ 5 territory grids)
9 players:      320 KB (+ 9 territory grids)

Plus: Potential HashSet ~50-200 KB depending on alive count
Total typical: 100-400 KB
```

---

## Cycle Cost Analysis

### Per-Generation Breakdown

```
Potential set iteration:           ~1M cycles (HashSet to Vec)
50K cells x 8 neighbors:
  - is_alive (bit op):             ~2M cycles
  - get_owner (n bit ops):         ~3M cycles
Apply births/deaths:               ~1M cycles
Rebuild potential set:             ~2M cycles
-----------------------------------------------
Total per generation:              ~9-12M cycles
```

### Annual Cost Estimate

```
At 10 gen/sec:
  Per second:  10 x 10M = 100M cycles
  Per day:     100M x 86,400 = 8.6T cycles
  Per year:    8.6T x 365 = 3,140T cycles

  At ~$1.30/trillion cycles: ~$4,100/year
```

**Wait, that's expensive!** Let's reconsider the timer frequency...

### Optimized: 1 gen/sec with Frontend Interpolation

```
At 1 gen/sec (frontend simulates locally at 10 gen/sec):
  Per year:    10M x 31.5M = 315T cycles
  Cost:        ~$410/year

Savings: Fly.io ($670) - IC cycles ($410) = ~$260/year
         Plus: Full decentralization, no server maintenance
```

### Comparison Table

| Architecture | Rate | Annual Cost | Notes |
|--------------|------|-------------|-------|
| Life1 Hybrid (Fly.io) | 10/sec | ~$670 | Server hosting |
| Life2 Dense on-chain | 1/sec | ~$800 | Current impl |
| **Life2 Hybrid on-chain** | 1/sec | **~$400** | This design |
| Life2 Hybrid on-chain | 10/sec | ~$4,100 | If needed |

---

## API Design

### Candid Interface

```candid
type Coord = nat32;  // Packed (x, y)

type GameState = record {
    generation : nat64;
    alive : vec nat32;              // List of alive cell coordinates
    territory : vec record {        // Per-player territory (only alive cells)
        player : nat8;
        cells : vec nat32;
    };
    players : vec principal;
    balances : vec nat64;
    player_num : opt nat8;          // Caller's player number if joined
};

type PlaceCellsResult = record {
    placed_count : nat32;
    generation : nat64;
    new_balance : nat64;
};

service : {
    // Player actions
    place_cells : (vec record { int32; int32 }) -> (variant { Ok : PlaceCellsResult; Err : text });
    join_game : () -> (variant { Ok : nat8; Err : text });

    // Queries (FREE)
    get_state : () -> (GameState) query;
    get_alive_count : () -> (nat32) query;
    get_generation : () -> (nat64) query;

    // Admin
    reset_game : () -> ();
    pause_game : () -> ();
    resume_game : () -> ();
}
```

### Player Join (Dynamic Allocation)

```rust
#[update]
fn join_game() -> Result<u8, String> {
    let caller = ic_cdk::caller();

    if caller == Principal::anonymous() {
        return Err("Anonymous not allowed".to_string());
    }

    PLAYERS.with(|players| {
        BALANCES.with(|balances| {
            TERRITORY.with(|territory| {
                let mut players = players.borrow_mut();
                let mut balances = balances.borrow_mut();
                let mut territory = territory.borrow_mut();

                // Check if already a player
                if let Some(pos) = players.iter().position(|p| *p == caller) {
                    return Ok((pos + 1) as u8);
                }

                // Check max players
                if players.len() >= MAX_PLAYERS {
                    return Err("Game full - max 9 players".to_string());
                }

                // Add player
                players.push(caller);
                balances.push(STARTING_BALANCE);

                // DYNAMIC ALLOCATION: Create territory grid for this player
                territory.push(Some(Box::new([0u64; GRID_WORDS])));

                Ok(players.len() as u8)
            })
        })
    })
}
```

### Get State (Efficient Sparse Response)

```rust
#[query]
fn get_state() -> GameState {
    let caller = ic_cdk::caller();

    // Collect alive cells
    let alive: Vec<u32> = ALIVE.with(|a| {
        let grid = a.borrow();
        let mut cells = Vec::new();

        for word_idx in 0..GRID_WORDS {
            let word = grid[word_idx];
            if word == 0 { continue; }

            for bit in 0..64 {
                if (word & (1u64 << bit)) != 0 {
                    cells.push(((word_idx as u32) << 6) | bit);
                }
            }
        }
        cells
    });

    // Build territory list (only for alive cells to minimize response size)
    let alive_set: HashSet<u32> = alive.iter().copied().collect();

    let territory: Vec<TerritoryEntry> = TERRITORY.with(|t| {
        t.borrow()
            .iter()
            .enumerate()
            .filter_map(|(i, maybe_grid)| {
                maybe_grid.as_ref().map(|grid| {
                    let cells: Vec<u32> = alive_set.iter()
                        .filter(|&&coord| {
                            let (word_idx, bit_mask) = coord_to_bit_index(coord);
                            (grid[word_idx] & bit_mask) != 0
                        })
                        .copied()
                        .collect();

                    TerritoryEntry {
                        player: (i + 1) as u8,
                        cells,
                    }
                })
            })
            .filter(|entry| !entry.cells.is_empty())
            .collect()
    });

    // Get player number for caller
    let player_num = PLAYERS.with(|p| {
        p.borrow().iter().position(|p| *p == caller).map(|i| (i + 1) as u8)
    });

    GameState {
        generation: GENERATION.with(|g| *g.borrow()),
        alive,
        territory,
        players: PLAYERS.with(|p| p.borrow().clone()),
        balances: BALANCES.with(|b| b.borrow().clone()),
        player_num,
    }
}
```

---

## Frontend Integration

### Local Simulation (10 gen/sec visual smoothness)

The backend runs at 1 gen/sec for cost efficiency. Frontend simulates locally at 10 gen/sec for smooth visuals, syncing every 5 seconds.

```typescript
const GRID_SIZE = 512;
const BACKEND_GEN_PER_SEC = 1;
const FRONTEND_GEN_PER_SEC = 10;
const POLL_INTERVAL_MS = 5000;

// Local state (mirrors backend between syncs)
let localAlive: Set<number> = new Set();
let localTerritory: Map<number, number> = new Map(); // coord -> player
let localGeneration = 0n;

// Unpack coordinate
function unpackCoord(packed: number): [number, number] {
    return [packed & 511, (packed >> 9) & 511];
}

// Pack coordinate
function packCoord(x: number, y: number): number {
    return ((y & 511) << 9) | (x & 511);
}

// Get neighbors with wrapping
function getNeighbors(packed: number): number[] {
    const [x, y] = unpackCoord(packed);
    const m = (v: number) => ((v % 512) + 512) % 512;
    return [
        packCoord(m(x-1), m(y-1)), packCoord(x, m(y-1)), packCoord(m(x+1), m(y-1)),
        packCoord(m(x-1), y),                            packCoord(m(x+1), y),
        packCoord(m(x-1), m(y+1)), packCoord(x, m(y+1)), packCoord(m(x+1), m(y+1)),
    ];
}

// Local simulation step
function localStep() {
    const potential = new Set<number>();

    // Build potential set
    for (const coord of localAlive) {
        potential.add(coord);
        for (const n of getNeighbors(coord)) {
            potential.add(n);
        }
    }

    const births: Array<{coord: number, owner: number}> = [];
    const deaths: number[] = [];

    for (const coord of potential) {
        let aliveCount = 0;
        const ownerCounts = new Map<number, number>();

        for (const n of getNeighbors(coord)) {
            if (localAlive.has(n)) {
                aliveCount++;
                const owner = localTerritory.get(n) || 0;
                if (owner > 0) {
                    ownerCounts.set(owner, (ownerCounts.get(owner) || 0) + 1);
                }
            }
        }

        const isAlive = localAlive.has(coord);

        if (isAlive && (aliveCount < 2 || aliveCount > 3)) {
            deaths.push(coord);
        } else if (!isAlive && aliveCount === 3) {
            // Find majority owner
            let maxOwner = 0, maxCount = 0;
            for (const [owner, count] of ownerCounts) {
                if (count > maxCount) { maxCount = count; maxOwner = owner; }
            }
            births.push({coord, owner: maxOwner});
        }
    }

    // Apply changes
    for (const d of deaths) localAlive.delete(d);
    for (const {coord, owner} of births) {
        localAlive.add(coord);
        if (owner > 0) localTerritory.set(coord, owner);
    }

    localGeneration++;
}

// Sync from canister
async function syncFromCanister(actor: Life2Actor) {
    const state = await actor.get_state();

    // Reset local state to match canister
    localAlive = new Set(state.alive.map(Number));
    localTerritory = new Map();

    for (const entry of state.territory) {
        for (const coord of entry.cells) {
            localTerritory.set(Number(coord), entry.player);
        }
    }

    localGeneration = state.generation;
}
```

---

## Implementation Plan

### Phase 1: Backend Core
1. Set up new canister with binary grid data structures
2. Implement coordinate packing/unpacking
3. Implement bit operations for alive/territory access
4. Implement `step_generation` with potential set optimization
5. Set up timer (start with 1 gen/sec)

### Phase 2: Player System
1. Implement `join_game` with dynamic grid allocation
2. Implement `place_cells` with balance deduction
3. Implement territory assignment on placement and birth

### Phase 3: API & Queries
1. Implement `get_state` with efficient sparse response
2. Implement admin controls (pause, reset)
3. Add stable memory persistence for upgrades

### Phase 4: Frontend
1. Copy Life1 UI to `/life2` route
2. Update to use IC polling instead of WebSocket
3. Implement local 10 gen/sec simulation
4. Implement 5-second sync with canister

### Phase 5: Testing & Deploy
1. Deploy to mainnet
2. Test with multiple players
3. Monitor cycle consumption
4. Tune timer frequency if needed

---

## Testing Checklist

- [ ] Coordinate packing/unpacking roundtrips correctly
- [ ] Bit operations correctly set/get alive state
- [ ] Toroidal wrapping works at all edges
- [ ] Potential set correctly identifies cells that might change
- [ ] step_generation produces correct Game of Life behavior
- [ ] Player grids allocated only on join
- [ ] Territory persists after cell death
- [ ] Territory transfers on birth (majority owner)
- [ ] place_cells deducts balance correctly
- [ ] Timer runs stable
- [ ] get_state returns minimal sparse data
- [ ] Frontend local sim matches backend behavior
- [ ] Canister survives upgrades (stable memory)

---

## Summary

Life2 with hybrid sparse/dense architecture:

- **Sparse iteration**: Only process ~10-50K potential cells (OneLoneCoder style)
- **Dense binary grids**: O(1) bit operations for state lookups
- **Dynamic allocation**: Player grids created on join (32 KB per player)
- **~$400/year** at 1 gen/sec (vs $670/year Fly.io hybrid)
- **100% on-chain** - fully decentralized, no server dependency
- **Simple economy** - 10,000 coins, burn on placement

This design combines the best of both worlds: sparse iteration efficiency with dense lookup speed, while minimizing memory through dynamic player allocation.
