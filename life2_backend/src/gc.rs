//! Garbage Collection for Life2
//!
//! Uses delta-based staleness detection to identify quadrants containing only
//! stable/oscillating patterns, then removes all small (≤4 cell) connected
//! components from those quadrants.
//!
//! Key insight: A quadrant is "delta-stale" if births == deaths for every
//! generation over 5 minutes. This catches blinkers that activity-based
//! detection misses.

use std::cell::RefCell;

// ============================================================================
// CONSTANTS
// ============================================================================

const GRID_SIZE: usize = 512;
const GRID_SHIFT: usize = 9;
const GRID_MASK: usize = 0x1FF;
const TOTAL_CELLS: usize = GRID_SIZE * GRID_SIZE;
const GRID_WORDS: usize = TOTAL_CELLS / 64;

const QUADRANT_SIZE: usize = 128;
const QUADRANTS_PER_SIDE: usize = 4;
const TOTAL_QUADRANTS: usize = 16;

/// GC runs every 5 minutes (300 billion nanoseconds)
const GC_INTERVAL_NS: u64 = 300_000_000_000;

/// Maximum cells in a "garbage" pattern
const GARBAGE_MAX_SIZE: usize = 4;

/// For visited bitset during flood fill
const VISITED_WORDS: usize = TOTAL_CELLS / 64;

// ============================================================================
// STATE
// ============================================================================

thread_local! {
    /// Did this quadrant ever have births ≠ deaths since last GC?
    /// Initialized to true (assume activity) so first GC waits a full cycle.
    static QUADRANT_HAD_DELTA: RefCell<[bool; TOTAL_QUADRANTS]> = RefCell::new([true; TOTAL_QUADRANTS]);

    /// Per-generation birth counters (reset each generation)
    static QUADRANT_BIRTHS: RefCell<[u16; TOTAL_QUADRANTS]> = RefCell::new([0; TOTAL_QUADRANTS]);

    /// Per-generation death counters (reset each generation)
    static QUADRANT_DEATHS: RefCell<[u16; TOTAL_QUADRANTS]> = RefCell::new([0; TOTAL_QUADRANTS]);

    /// Last time GC ran (nanoseconds since epoch)
    static LAST_GC_TIME_NS: RefCell<u64> = RefCell::new(0);

    /// Stats: total cells killed by GC
    static GC_CELLS_KILLED: RefCell<u64> = RefCell::new(0);

    /// Stats: total GC runs
    static GC_RUN_COUNT: RefCell<u64> = RefCell::new(0);
}

// ============================================================================
// QUADRANT HELPERS
// ============================================================================

/// Get quadrant index (0-15) for a cell coordinate
#[inline]
fn get_quadrant(x: usize, y: usize) -> usize {
    let qx = x / QUADRANT_SIZE;
    let qy = y / QUADRANT_SIZE;
    qy * QUADRANTS_PER_SIDE + qx
}

/// Get quadrant from flat cell index
#[inline]
fn get_quadrant_from_idx(idx: usize) -> usize {
    let x = idx & GRID_MASK;
    let y = idx >> GRID_SHIFT;
    get_quadrant(x, y)
}

// ============================================================================
// DELTA TRACKING - Called during simulation
// ============================================================================

/// Record a birth event in a quadrant
#[inline]
pub fn record_birth(x: usize, y: usize) {
    let q = get_quadrant(x, y);
    QUADRANT_BIRTHS.with(|b| {
        let mut births = b.borrow_mut();
        births[q] = births[q].saturating_add(1);
    });
}

/// Record a death event in a quadrant
#[inline]
pub fn record_death(x: usize, y: usize) {
    let q = get_quadrant(x, y);
    QUADRANT_DEATHS.with(|d| {
        let mut deaths = d.borrow_mut();
        deaths[q] = deaths[q].saturating_add(1);
    });
}

/// Record birth from flat index (more efficient when we already have idx)
#[inline]
pub fn record_birth_idx(idx: usize) {
    let q = get_quadrant_from_idx(idx);
    QUADRANT_BIRTHS.with(|b| {
        let mut births = b.borrow_mut();
        births[q] = births[q].saturating_add(1);
    });
}

/// Record death from flat index
#[inline]
pub fn record_death_idx(idx: usize) {
    let q = get_quadrant_from_idx(idx);
    QUADRANT_DEATHS.with(|d| {
        let mut deaths = d.borrow_mut();
        deaths[q] = deaths[q].saturating_add(1);
    });
}

/// Call at end of each generation to check for delta imbalance
/// If births ≠ deaths in any quadrant, mark it as having had delta
pub fn end_generation_delta_check() {
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
    QUADRANT_BIRTHS.with(|b| *b.borrow_mut() = [0; TOTAL_QUADRANTS]);
    QUADRANT_DEATHS.with(|d| *d.borrow_mut() = [0; TOTAL_QUADRANTS]);
}

/// Mark a quadrant as active (call when player places cells)
/// This prevents GC from killing fresh placements
pub fn mark_quadrant_active(x: usize, y: usize) {
    let q = get_quadrant(x, y);
    QUADRANT_HAD_DELTA.with(|d| d.borrow_mut()[q] = true);
}

// ============================================================================
// VISITED BITSET OPERATIONS
// ============================================================================

#[inline]
fn cell_index(x: usize, y: usize) -> usize {
    ((y & GRID_MASK) << GRID_SHIFT) | (x & GRID_MASK)
}

#[inline]
fn is_visited(visited: &[u64; VISITED_WORDS], x: usize, y: usize) -> bool {
    let idx = cell_index(x, y);
    let word = idx >> 6;
    let bit = idx & 63;
    (visited[word] >> bit) & 1 == 1
}

#[inline]
fn mark_visited(visited: &mut [u64; VISITED_WORDS], x: usize, y: usize) {
    let idx = cell_index(x, y);
    let word = idx >> 6;
    let bit = idx & 63;
    visited[word] |= 1u64 << bit;
}

#[inline]
fn is_visited_idx(visited: &[u64; VISITED_WORDS], idx: usize) -> bool {
    let word = idx >> 6;
    let bit = idx & 63;
    (visited[word] >> bit) & 1 == 1
}

#[inline]
fn mark_visited_idx(visited: &mut [u64; VISITED_WORDS], idx: usize) {
    let word = idx >> 6;
    let bit = idx & 63;
    visited[word] |= 1u64 << bit;
}

// ============================================================================
// FLOOD FILL
// ============================================================================

/// 8-neighbor offsets
const NEIGHBORS: [(i32, i32); 8] = [
    (-1, -1), (0, -1), (1, -1),
    (-1,  0),          (1,  0),
    (-1,  1), (0,  1), (1,  1),
];

/// Flood fill to find a connected component
/// Returns the cells in the component (limited collection for efficiency)
/// Marks ALL cells as visited regardless of component size
fn flood_fill(
    start_x: usize,
    start_y: usize,
    grid: &[u8],
    visited: &mut [u64; VISITED_WORDS],
    is_cell_alive: fn(u8) -> bool,
) -> Vec<(usize, usize)> {
    let mut component = Vec::with_capacity(GARBAGE_MAX_SIZE + 1);
    let mut stack = Vec::with_capacity(32);
    stack.push((start_x, start_y));

    // Track if we've exceeded garbage size (for early exit optimization)
    let mut exceeded_size = false;

    while let Some((x, y)) = stack.pop() {
        if is_visited(visited, x, y) {
            continue;
        }

        let idx = cell_index(x, y);
        if !is_cell_alive(grid[idx]) {
            continue;
        }

        mark_visited(visited, x, y);

        // Only collect cells if we haven't exceeded garbage size
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

// ============================================================================
// GARBAGE COLLECTION
// ============================================================================

/// Check if a quadrant is stale (bit set in mask)
#[inline]
fn is_quadrant_stale(stale_mask: u16, quadrant: usize) -> bool {
    stale_mask & (1 << quadrant) != 0
}

/// Run garbage collection if enough time has passed
/// Returns number of cells killed (0 if GC didn't run)
pub fn run_gc_if_needed(
    grid: &mut [u8],
    potential: &mut [u64; GRID_WORDS],
    is_cell_alive: fn(u8) -> bool,
    kill_cell: fn(&mut [u8], &mut [u64; GRID_WORDS], usize, usize),
) -> u32 {
    let now = ic_cdk::api::time();

    let should_run = LAST_GC_TIME_NS.with(|t| {
        let last = *t.borrow();
        now.saturating_sub(last) >= GC_INTERVAL_NS
    });

    if !should_run {
        return 0;
    }

    LAST_GC_TIME_NS.with(|t| *t.borrow_mut() = now);
    GC_RUN_COUNT.with(|c| *c.borrow_mut() += 1);

    // Build stale quadrant bitmask
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
        QUADRANT_HAD_DELTA.with(|d| *d.borrow_mut() = [false; TOTAL_QUADRANTS]);
        return 0;
    }

    // Global visited bitset - one bit per cell
    let mut visited = [0u64; VISITED_WORDS];
    let mut cells_killed = 0u32;

    // Process each stale quadrant
    for quadrant in 0..TOTAL_QUADRANTS {
        if !is_quadrant_stale(stale_mask, quadrant) {
            continue;
        }

        let qx_start = (quadrant % QUADRANTS_PER_SIDE) * QUADRANT_SIZE;
        let qy_start = (quadrant / QUADRANTS_PER_SIDE) * QUADRANT_SIZE;

        for y in qy_start..(qy_start + QUADRANT_SIZE) {
            for x in qx_start..(qx_start + QUADRANT_SIZE) {
                let idx = cell_index(x, y);

                if !is_cell_alive(grid[idx]) || is_visited_idx(&visited, idx) {
                    continue;
                }

                // Flood-fill to find connected component
                let component = flood_fill(x, y, grid, &mut visited, is_cell_alive);

                // Kill if small enough to be garbage
                if component.len() <= GARBAGE_MAX_SIZE {
                    for (cx, cy) in component {
                        // Only kill cells in delta-stale quadrants
                        // Component may span into active quadrants - leave those alone
                        let cell_quadrant = get_quadrant(cx, cy);
                        if is_quadrant_stale(stale_mask, cell_quadrant) {
                            kill_cell(grid, potential, cx, cy);
                            cells_killed += 1;
                        }
                    }
                }
                // Large components are preserved (already marked visited)
            }
        }
    }

    // Reset delta flags for next cycle
    QUADRANT_HAD_DELTA.with(|d| *d.borrow_mut() = [false; TOTAL_QUADRANTS]);

    // Update stats
    GC_CELLS_KILLED.with(|c| *c.borrow_mut() += cells_killed as u64);

    ic_cdk::println!(
        "GC run: {} stale quadrants, {} cells killed",
        stale_mask.count_ones(),
        cells_killed
    );

    cells_killed
}

// ============================================================================
// STATS
// ============================================================================

/// Get GC statistics
pub fn get_gc_stats() -> (u64, u64, [bool; TOTAL_QUADRANTS]) {
    let run_count = GC_RUN_COUNT.with(|c| *c.borrow());
    let cells_killed = GC_CELLS_KILLED.with(|c| *c.borrow());
    let had_delta = QUADRANT_HAD_DELTA.with(|d| *d.borrow());
    (run_count, cells_killed, had_delta)
}

/// Reset GC state (for testing or after game reset)
pub fn reset_gc_state() {
    QUADRANT_HAD_DELTA.with(|d| *d.borrow_mut() = [true; TOTAL_QUADRANTS]);
    QUADRANT_BIRTHS.with(|b| *b.borrow_mut() = [0; TOTAL_QUADRANTS]);
    QUADRANT_DEATHS.with(|d| *d.borrow_mut() = [0; TOTAL_QUADRANTS]);
    LAST_GC_TIME_NS.with(|t| *t.borrow_mut() = 0);
    GC_CELLS_KILLED.with(|c| *c.borrow_mut() = 0);
    GC_RUN_COUNT.with(|c| *c.borrow_mut() = 0);
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_quadrant() {
        // Top-left quadrant (0)
        assert_eq!(get_quadrant(0, 0), 0);
        assert_eq!(get_quadrant(127, 127), 0);

        // Top-right quadrant (3)
        assert_eq!(get_quadrant(384, 0), 3);
        assert_eq!(get_quadrant(511, 127), 3);

        // Bottom-left quadrant (12)
        assert_eq!(get_quadrant(0, 384), 12);
        assert_eq!(get_quadrant(127, 511), 12);

        // Bottom-right quadrant (15)
        assert_eq!(get_quadrant(511, 511), 15);
    }

    #[test]
    fn test_stale_mask() {
        // Quadrant 0 stale
        let mask = 0b0000_0000_0000_0001u16;
        assert!(is_quadrant_stale(mask, 0));
        assert!(!is_quadrant_stale(mask, 1));

        // Multiple quadrants stale
        let mask = 0b1000_0000_0000_0101u16;
        assert!(is_quadrant_stale(mask, 0));
        assert!(!is_quadrant_stale(mask, 1));
        assert!(is_quadrant_stale(mask, 2));
        assert!(is_quadrant_stale(mask, 15));
    }

    #[test]
    fn test_visited_bitset() {
        let mut visited = [0u64; VISITED_WORDS];

        // Initially not visited
        assert!(!is_visited(&visited, 0, 0));
        assert!(!is_visited(&visited, 100, 200));

        // Mark visited
        mark_visited(&mut visited, 0, 0);
        assert!(is_visited(&visited, 0, 0));

        mark_visited(&mut visited, 100, 200);
        assert!(is_visited(&visited, 100, 200));

        // Other cells still not visited
        assert!(!is_visited(&visited, 1, 0));
        assert!(!is_visited(&visited, 0, 1));
    }
}
