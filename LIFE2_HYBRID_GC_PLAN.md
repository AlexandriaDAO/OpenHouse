# Life2 Garbage Collection Plan

## Overview

A garbage collection system that uses **delta-based staleness detection** to identify quadrants containing only stable/oscillating patterns, then removes all small (≤4 cell) connected components from those quadrants.

## The Problem

Without cleanup, the 512x512 grid fills with "garbage":
- **Blocks** (2x2 still lifes) - 0 births, 0 deaths per generation
- **Blinkers** (period-2 oscillators) - 3 births, 3 deaths per generation
- **Beehives, loafs, boats** - various small still lifes

These patterns consume compute cycles forever and block new placements.

## Why Simpler Approaches Failed

### Activity-Based Staleness

```
Stale = no cell changes in 5 minutes
```

**Problem:** Blinkers have cell changes every generation (3 births, 3 deaths). A single blinker keeps its entire quadrant "active" forever.

| Pattern | Cell Changes? | Quadrant Status | GC Runs? |
|---------|---------------|-----------------|----------|
| Block | No | Stale | Yes ✓ |
| Blinker | Yes (every gen) | **ACTIVE** | **No** ❌ |

### Full Quadrant Wipe

```
Stale = births == deaths for 5 minutes
Wipe entire quadrant if stale
```

**Problem:** Destroys large player-built structures. A 50-cell still life has delta=0 just like a 4-cell block.

## The Solution

### The Rule

**Kill a pattern if BOTH are true:**

1. **Delta-stale quadrant**: births == deaths for every generation over 5 minutes
2. **Small**: pattern has ≤4 connected cells

That's it. No isolation check needed.

### Why No Isolation Check?

The isolation check was designed to protect "intentional player builds near each other." But in a delta-stale quadrant:

- Zero player interaction for 5 minutes
- Everything there is either natural garbage or abandoned
- Two small patterns near each other = two pieces of garbage, not intentional design

The isolation check protects garbage from being cleaned. Remove it.

### Pattern Outcomes

| Pattern | Delta | Size | Result |
|---------|-------|------|--------|
| Lone blinker | 0 (3=3) | 3 cells | **KILLED** |
| Lone block | 0 (0=0) | 4 cells | **KILLED** |
| Dense blinker cluster | 0 | 3 cells each | **ALL KILLED** |
| Block + blinker nearby | 0 | 3-4 cells each | **BOTH KILLED** |
| 50-cell still life | 0 | 50 cells | **PRESERVED** |
| Pulsar (48 cells) | 0 | 48 cells | **PRESERVED** |
| Glider passing | ≠0 | 5 cells | **PRESERVED** |
| Player placing cells | ≠0 | any | **PRESERVED** |
| Active territory battle | ≠0 | any | **PRESERVED** |

## Algorithm

```
Every 5 minutes:

Step 1: Identify delta-stale quadrants
  - For each quadrant: did births ever ≠ deaths in any generation?
  - If yes: quadrant is active, skip it
  - If no (delta always = 0): quadrant is delta-stale

Step 2: Scan delta-stale quadrants with GLOBAL visited set
  - Create ONE visited bitset for the entire grid
  - For each delta-stale quadrant:
    - For each alive cell not yet visited:
      - Flood-fill to find connected component (may cross quadrant boundaries)
      - Mark ALL cells in component as visited
      - If component ≤4 cells: kill all cells in it
      - If component >4 cells: preserve it

Step 3: Reset for next cycle
  - Clear all delta flags to false
```

### Why Global Visited Set?

A pattern can straddle quadrant boundaries. With per-quadrant visited sets:

1. Scan quadrant 0, find 6-cell pattern wrapping into quadrant 1
2. Flood-fill correctly finds all 6 cells → preserved
3. Scan quadrant 1 with **fresh visited set**
4. Find the same 3 cells again, see "small pattern" → **incorrectly killed**

A global visited set ensures each cell is only processed once, regardless of which quadrant triggered the scan.

## Implementation

### Constants

```rust
const GRID_SIZE: usize = 512;
const QUADRANT_SIZE: usize = 128;
const QUADRANTS_PER_SIDE: usize = 4;
const TOTAL_QUADRANTS: usize = 16;
const GC_INTERVAL_NS: u64 = 300_000_000_000; // 5 minutes
const GARBAGE_MAX_SIZE: usize = 4;

// For visited bitset
const GRID_CELLS: usize = GRID_SIZE * GRID_SIZE; // 262,144
const VISITED_WORDS: usize = GRID_CELLS / 64;    // 4,096
```

### State Variables

```rust
thread_local! {
    // Did this quadrant ever have births ≠ deaths since last GC?
    static QUADRANT_HAD_DELTA: RefCell<[bool; 16]> = RefCell::new([true; 16]);

    // Per-generation counters (reset each generation)
    static QUADRANT_BIRTHS: RefCell<[u16; 16]> = RefCell::new([0; 16]);
    static QUADRANT_DEATHS: RefCell<[u16; 16]> = RefCell::new([0; 16]);

    // GC timing
    static LAST_GC_TIME_NS: RefCell<u64> = RefCell::new(0);
}
```

### Delta Tracking During Simulation

```rust
fn get_quadrant(x: usize, y: usize) -> usize {
    let qx = x / QUADRANT_SIZE;
    let qy = y / QUADRANT_SIZE;
    qy * QUADRANTS_PER_SIDE + qx
}

// Call when a cell is born
fn record_birth(x: usize, y: usize) {
    let q = get_quadrant(x, y);
    QUADRANT_BIRTHS.with(|b| b.borrow_mut()[q] += 1);
}

// Call when a cell dies
fn record_death(x: usize, y: usize) {
    let q = get_quadrant(x, y);
    QUADRANT_DEATHS.with(|d| d.borrow_mut()[q] += 1);
}

// Call at end of each generation
fn end_generation_delta_check() {
    QUADRANT_BIRTHS.with(|births| {
        QUADRANT_DEATHS.with(|deaths| {
            QUADRANT_HAD_DELTA.with(|delta| {
                let b = births.borrow();
                let d = deaths.borrow();
                let mut del = delta.borrow_mut();

                for i in 0..TOTAL_QUADRANTS {
                    if b[i] != d[i] {
                        del[i] = true;
                    }
                }
            });
        });
    });

    // Reset per-generation counters
    QUADRANT_BIRTHS.with(|b| *b.borrow_mut() = [0; 16]);
    QUADRANT_DEATHS.with(|d| *d.borrow_mut() = [0; 16]);
}
```

### Player Placement Tracking

**Important:** Player placements bypass simulation and don't trigger `record_birth()`. We must explicitly mark quadrants as active when players place cells.

```rust
// In place_cells(), after successfully placing a cell at (x, y):
fn mark_quadrant_active_from_placement(x: usize, y: usize) {
    let q = get_quadrant(x, y);
    QUADRANT_HAD_DELTA.with(|d| d.borrow_mut()[q] = true);
}

// Example integration in place_cells():
pub fn place_cells(cells: Vec<(u16, u16)>, ...) -> Result<...> {
    for (x, y) in cells {
        // ... existing placement logic ...

        // Mark quadrant as active (prevents GC from killing fresh placements)
        mark_quadrant_active_from_placement(x as usize, y as usize);
    }
    // ...
}
```

This prevents the race condition where:
1. Quadrant is quiet for 4:59
2. Player places cells
3. GC timer fires
4. GC kills the freshly placed cells (because quadrant wasn't marked active)

### Garbage Collection Pass

```rust
fn run_gc_if_needed() {
    let now = ic_cdk::api::time();
    let should_run = LAST_GC_TIME_NS.with(|t| {
        now - *t.borrow() >= GC_INTERVAL_NS
    });

    if !should_run {
        return;
    }

    LAST_GC_TIME_NS.with(|t| *t.borrow_mut() = now);

    // Build stale quadrant bitmask (for fast lookup during kill phase)
    let stale_mask: u16 = QUADRANT_HAD_DELTA.with(|d| {
        let flags = d.borrow();
        let mut mask = 0u16;
        for i in 0..TOTAL_QUADRANTS {
            if !flags[i] {
                mask |= 1 << i;
            }
        }
        mask
    });

    if stale_mask == 0 {
        // No stale quadrants, reset flags and return
        QUADRANT_HAD_DELTA.with(|d| *d.borrow_mut() = [false; 16]);
        return;
    }

    // Global visited bitset - one bit per cell
    let mut visited = [0u64; VISITED_WORDS];

    // Process each stale quadrant
    for quadrant in 0..TOTAL_QUADRANTS {
        if stale_mask & (1 << quadrant) != 0 {
            gc_quadrant(quadrant, &mut visited, stale_mask);
        }
    }

    // Reset delta flags for next cycle
    QUADRANT_HAD_DELTA.with(|d| *d.borrow_mut() = [false; 16]);
}

#[inline]
fn is_quadrant_stale(stale_mask: u16, quadrant: usize) -> bool {
    stale_mask & (1 << quadrant) != 0
}

fn gc_quadrant(quadrant: usize, visited: &mut [u64; VISITED_WORDS], stale_mask: u16) {
    let qx_start = (quadrant % QUADRANTS_PER_SIDE) * QUADRANT_SIZE;
    let qy_start = (quadrant / QUADRANTS_PER_SIDE) * QUADRANT_SIZE;

    for y in qy_start..(qy_start + QUADRANT_SIZE) {
        for x in qx_start..(qx_start + QUADRANT_SIZE) {
            if !is_alive(x, y) || is_visited(visited, x, y) {
                continue;
            }

            // Flood-fill to find connected component
            let component = flood_fill(x, y, visited);

            // Kill if small enough to be garbage
            if component.len() <= GARBAGE_MAX_SIZE {
                for (cx, cy) in component {
                    // IMPORTANT: Only kill cells in delta-stale quadrants
                    // Component may span into active quadrants - leave those alone
                    let cell_quadrant = get_quadrant(cx, cy);
                    if is_quadrant_stale(stale_mask, cell_quadrant) {
                        kill_cell(cx, cy);
                    }
                }
            }
            // Large components are preserved (already marked visited)
        }
    }
}
```

### Bitset Operations

```rust
#[inline]
fn cell_index(x: usize, y: usize) -> usize {
    y * GRID_SIZE + x
}

#[inline]
fn is_visited(visited: &[u64; VISITED_WORDS], x: usize, y: usize) -> bool {
    let idx = cell_index(x, y);
    let word = idx / 64;
    let bit = idx % 64;
    (visited[word] >> bit) & 1 == 1
}

#[inline]
fn mark_visited(visited: &mut [u64; VISITED_WORDS], x: usize, y: usize) {
    let idx = cell_index(x, y);
    let word = idx / 64;
    let bit = idx % 64;
    visited[word] |= 1u64 << bit;
}
```

### Flood Fill

```rust
const NEIGHBORS: [(i32, i32); 8] = [
    (-1, -1), (0, -1), (1, -1),
    (-1,  0),          (1,  0),
    (-1,  1), (0,  1), (1,  1),
];

fn flood_fill(
    start_x: usize,
    start_y: usize,
    visited: &mut [u64; VISITED_WORDS]
) -> Vec<(usize, usize)> {
    let mut component = Vec::with_capacity(GARBAGE_MAX_SIZE + 1);
    let mut stack = Vec::with_capacity(16);
    stack.push((start_x, start_y));

    // Track if we've exceeded garbage size (for early exit optimization)
    let mut exceeded_size = false;

    while let Some((x, y)) = stack.pop() {
        if is_visited(visited, x, y) || !is_alive(x, y) {
            continue;
        }

        mark_visited(visited, x, y);

        // Only collect cells if we haven't exceeded garbage size
        // Once exceeded, we still mark visited but don't collect
        if !exceeded_size {
            component.push((x, y));
            if component.len() > GARBAGE_MAX_SIZE {
                exceeded_size = true;
                // Don't clear component - caller checks len() > GARBAGE_MAX_SIZE
            }
        }

        // Add neighbors to stack (with toroidal wrapping)
        // Must continue even after exceeding size to mark all cells visited
        for (dx, dy) in NEIGHBORS {
            let nx = (x as i32 + dx).rem_euclid(GRID_SIZE as i32) as usize;
            let ny = (y as i32 + dy).rem_euclid(GRID_SIZE as i32) as usize;
            if !is_visited(visited, nx, ny) {
                stack.push((nx, ny));
            }
        }
    }

    component
}
```

**Optimization note:** Once a component exceeds `GARBAGE_MAX_SIZE`, we stop collecting cells into the vector but continue marking them as visited. This prevents building a 1000-element `Vec` just to discover "too big, preserve." The flood-fill must complete to mark all connected cells as visited (preventing re-scanning from other quadrants).

### Killing Cells

```rust
fn kill_cell(x: usize, y: usize) {
    // Set alive bit to false (preserve owner and coins for history)
    set_alive(x, y, false);

    // Remove from potential set
    remove_from_potential(x, y);

    // Add neighbors to potential set (they might now change)
    for (dx, dy) in NEIGHBORS {
        let nx = (x as i32 + dx).rem_euclid(GRID_SIZE as i32) as usize;
        let ny = (y as i32 + dy).rem_euclid(GRID_SIZE as i32) as usize;
        add_to_potential(nx, ny);
    }
}
```

## Cost Analysis

### Per Generation (runs ~10x/second)

| Operation | Cost |
|-----------|------|
| Record birth quadrant | O(1) per birth |
| Record death quadrant | O(1) per death |
| Check 16 quadrant deltas | O(16) |
| Reset counters | O(16) |

**Total: O(changes + 32) per generation - negligible**

### Per GC Pass (runs once per 5 minutes)

| Operation | Cost |
|-----------|------|
| Check 16 delta flags | O(16) |
| Scan stale quadrants | O(128×128) per stale quadrant |
| Flood-fill components | O(alive cells) per stale quadrant |
| Kill garbage | O(garbage × 9) for potential set updates |

**Worst case: ~50,000 operations per GC pass**

### Savings

Without GC: 1000 garbage patterns × ~12 cells in potential set × 3000 generations = **36,000,000 checks per 5 minutes**

With GC: One-time 50,000 operation cost, then dramatically reduced potential set.

**Net: ~5x reduction in compute for garbage processing**

## Edge Cases

### Blinker at quadrant boundary
- Blinker cells stay within one quadrant (oscillation doesn't move cells)
- That quadrant's delta = 0 (3 births = 3 deaths)
- Marked as delta-stale → blinker killed ✓

### Pattern straddling two stale quadrants
- 6-cell pattern spans quadrants 0 and 1
- Both quadrants are delta-stale
- Quadrant 0 scan: flood-fill finds all 6 cells (crossing boundary)
- All 6 cells marked visited in global bitset
- Quadrant 1 scan: cells already visited, skipped
- Pattern correctly identified as >4 cells → preserved ✓

### Small pattern straddling stale + active quadrant
```
Stale quadrant A     Active quadrant B
        ▪▪ ─────────────── ▪
        (2 cells)          (1 cell)
```
- 3-cell pattern spans stale quadrant A and active quadrant B
- Flood-fill finds all 3 cells → small enough to be garbage
- Kill phase checks each cell's quadrant individually
- Cells in stale quadrant A: killed
- Cell in active quadrant B: preserved (player might be working there)
- Result: pattern partially killed, cell in active area survives ✓

### Glider crossing quadrant
- Entering: births > deaths in destination quadrant → delta ≠ 0
- Quadrant marked as had-delta → not cleaned
- Glider preserved ✓

### Large still life in quiet area
- Delta = 0 (no births or deaths)
- Quadrant marked as delta-stale
- Flood-fill finds 50+ cells → too big to be garbage
- Preserved ✓

### Dense garbage cluster
- Multiple blinkers/blocks within a quadrant
- All have delta = 0
- Each is ≤4 cells
- **All killed** ✓ (this is the main improvement over isolation-based approach)

### Glider griefing
- Griefer fills quadrant with blinkers
- Launches glider through every 4 minutes
- Quadrant never becomes delta-stale
- Blinkers persist

This is acceptable: the griefer must actively maintain protection. If they stop, cleanup resumes. The cost is on them.

### Upgrade/restart behavior
- All delta flags initialize to `true` (assume activity)
- All quadrants get 5-minute grace period
- No garbage killed until system stabilizes

## Testing Checklist

After deployment:

1. **Lone blinker**: Place single blinker in empty area, wait 5 min → killed
2. **Lone block**: Place single block in empty area, wait 5 min → killed
3. **Dense cluster**: Place 5 blinkers near each other, wait 5 min → all killed
4. **Large structure**: Build 10+ cell pattern, wait 5 min → preserved
5. **Cross-boundary pattern (both stale)**: Build 6-cell pattern on quadrant edge, wait 5 min → preserved
6. **Cross-boundary pattern (stale+active)**: Build 3-cell pattern spanning stale and active quadrants → only stale-side cells killed
7. **Active quadrant**: Keep placing cells → nothing killed
8. **Glider transit**: Launch glider through empty quadrant → quadrant stays active, glider preserved
9. **Fresh placement race**: Wait 4:59 in quiet quadrant, place cells, verify they survive GC
10. **Large structure efficiency**: Build 100+ cell pattern, verify GC doesn't timeout (early exit optimization)

## Summary

The garbage collection system:

1. **Uses delta-based staleness** to identify quadrants with only stable/oscillating patterns (catches blinkers that activity-based detection misses)
2. **Kills all small components** (≤4 cells) in delta-stale quadrants (no isolation check to protect garbage clusters)
3. **Uses a global visited bitset** to correctly handle patterns spanning quadrant boundaries
4. **Only kills cells in stale quadrants** - patterns spanning stale+active boundaries are partially preserved
5. **Tracks player placements** - placing cells marks the quadrant as active, preventing race conditions
6. **Early-exit optimization** - stops collecting cells once component exceeds garbage size
7. **Preserves large structures** (>4 cells) regardless of activity

Simple, efficient, and solves the actual problem.
