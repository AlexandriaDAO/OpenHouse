//! Game of Life simulation step logic
//!
//! Pure functions for running Conway's Game of Life with ownership mechanics.

use crate::cell::Cell;
use crate::{GRID_MASK, GRID_SHIFT, GRID_SIZE, MAX_PLAYERS};

/// Pre-computed neighbor offsets for toroidal wrapping
/// Each tuple is (row_delta, col_delta) where deltas are already wrapped for GRID_SIZE
const NEIGHBOR_DELTAS: [(usize, usize); 8] = [
    (GRID_SIZE - 1, GRID_SIZE - 1), // NW
    (GRID_SIZE - 1, 0),             // N
    (GRID_SIZE - 1, 1),             // NE
    (0, GRID_SIZE - 1),             // W
    (0, 1),                         // E
    (1, GRID_SIZE - 1),             // SW
    (1, 0),                         // S
    (1, 1),                         // SE
];

/// Convert row, col to flat index using bit shifts
#[inline]
pub fn idx(row: usize, col: usize) -> usize {
    (row << GRID_SHIFT) | col
}

/// Get majority owner from neighbor counts
fn get_majority_owner(owner_counts: &[u8; MAX_PLAYERS + 1]) -> u8 {
    let mut max_count = 0u8;
    let mut max_owner = 1u8;
    for (owner, &count) in owner_counts.iter().enumerate().skip(1) {
        if count > max_count {
            max_count = count;
            max_owner = owner as u8;
        }
    }
    max_owner
}

/// Point transfer record: (to_player_index, points)
/// to_player_index is 0-based (player 1 = index 0)
pub type PointTransfer = (usize, u8);

/// Run one generation of Conway's Game of Life with ownership
///
/// Takes the current grid state and produces:
/// - A new grid with updated cell states
/// - A list of point transfers (for balance updates)
///
/// Rules:
/// - Living cell survives with 2-3 neighbors, dies otherwise
/// - Dead cell is born with exactly 3 neighbors
/// - New cells inherit owner from majority of live neighbors
/// - Territory capture: if a new cell is born on territory owned by another player,
///   the points are transferred to the new owner
pub fn step_generation(cells: &[Cell]) -> (Vec<Cell>, Vec<PointTransfer>) {
    let mut new_cells = vec![Cell::default(); cells.len()];
    let mut point_transfers: Vec<PointTransfer> = Vec::new();

    for row in 0..GRID_SIZE {
        for col in 0..GRID_SIZE {
            let i = idx(row, col);

            // Inline neighbor counting for performance
            let mut neighbor_count = 0u8;
            let mut owner_counts = [0u8; MAX_PLAYERS + 1];

            for &(dr, dc) in &NEIGHBOR_DELTAS {
                let nr = (row + dr) & GRID_MASK;
                let nc = (col + dc) & GRID_MASK;
                let neighbor = cells[idx(nr, nc)];
                if neighbor.alive() {
                    neighbor_count += 1;
                    let owner = neighbor.owner() as usize;
                    if owner < owner_counts.len() {
                        owner_counts[owner] += 1;
                    }
                }
            }

            let current_cell = cells[i];

            // Start with territory preserved (no allocation, direct u16 copy)
            let mut new_cell = Cell::new(current_cell.owner(), current_cell.points(), false);

            if current_cell.alive() {
                // Living cell survives with 2 or 3 neighbors
                if neighbor_count == 2 || neighbor_count == 3 {
                    new_cell.set_alive(true);
                }
            } else {
                // Dead cell born with exactly 3 neighbors
                if neighbor_count == 3 {
                    let new_owner = get_majority_owner(&owner_counts);
                    new_cell.set_alive(true);

                    // Territory capture: if cell had different owner with points
                    let old_owner = current_cell.owner();
                    if current_cell.points() > 0 && old_owner > 0 && old_owner != new_owner {
                        let to_idx = (new_owner - 1) as usize;
                        point_transfers.push((to_idx, current_cell.points()));
                        new_cell.set_points(0);
                    }

                    new_cell.set_owner(new_owner);
                }
            }

            new_cells[i] = new_cell;
        }
    }

    (new_cells, point_transfers)
}

/// Run one generation in-place using double buffering
///
/// This is more efficient when you already have two buffers allocated.
/// Reads from `read_grid`, writes to `write_grid`, returns point transfers.
pub fn step_generation_double_buffer(
    read_grid: &[Cell],
    write_grid: &mut [Cell],
) -> Vec<PointTransfer> {
    let mut point_transfers: Vec<PointTransfer> = Vec::new();

    for row in 0..GRID_SIZE {
        for col in 0..GRID_SIZE {
            let i = idx(row, col);

            // Inline neighbor counting for performance
            let mut neighbor_count = 0u8;
            let mut owner_counts = [0u8; MAX_PLAYERS + 1];

            for &(dr, dc) in &NEIGHBOR_DELTAS {
                let nr = (row + dr) & GRID_MASK;
                let nc = (col + dc) & GRID_MASK;
                let neighbor = read_grid[idx(nr, nc)];
                if neighbor.alive() {
                    neighbor_count += 1;
                    let owner = neighbor.owner() as usize;
                    if owner < owner_counts.len() {
                        owner_counts[owner] += 1;
                    }
                }
            }

            let current_cell = read_grid[i];

            // Start with territory preserved
            let mut new_cell = Cell::new(current_cell.owner(), current_cell.points(), false);

            if current_cell.alive() {
                // Living cell survives with 2 or 3 neighbors
                if neighbor_count == 2 || neighbor_count == 3 {
                    new_cell.set_alive(true);
                }
            } else {
                // Dead cell born with exactly 3 neighbors
                if neighbor_count == 3 {
                    let new_owner = get_majority_owner(&owner_counts);
                    new_cell.set_alive(true);

                    // Territory capture
                    let old_owner = current_cell.owner();
                    if current_cell.points() > 0 && old_owner > 0 && old_owner != new_owner {
                        let to_idx = (new_owner - 1) as usize;
                        point_transfers.push((to_idx, current_cell.points()));
                        new_cell.set_points(0);
                    }

                    new_cell.set_owner(new_owner);
                }
            }

            write_grid[i] = new_cell;
        }
    }

    point_transfers
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_empty_grid() -> Vec<Cell> {
        vec![Cell::default(); GRID_SIZE * GRID_SIZE]
    }

    #[test]
    fn test_empty_grid_stays_empty() {
        let grid = create_empty_grid();
        let (new_grid, transfers) = step_generation(&grid);

        assert!(transfers.is_empty());
        assert!(new_grid.iter().all(|c| !c.alive()));
    }

    #[test]
    fn test_blinker_oscillates() {
        // Create a blinker: 3 cells in a row (horizontal)
        let mut grid = create_empty_grid();
        grid[idx(10, 9)].set_alive(true);
        grid[idx(10, 9)].set_owner(1);
        grid[idx(10, 10)].set_alive(true);
        grid[idx(10, 10)].set_owner(1);
        grid[idx(10, 11)].set_alive(true);
        grid[idx(10, 11)].set_owner(1);

        // After one step, should become vertical
        let (new_grid, _) = step_generation(&grid);
        assert!(!new_grid[idx(10, 9)].alive());
        assert!(new_grid[idx(10, 10)].alive());
        assert!(!new_grid[idx(10, 11)].alive());
        assert!(new_grid[idx(9, 10)].alive());
        assert!(new_grid[idx(11, 10)].alive());

        // After two steps, should be horizontal again
        let (final_grid, _) = step_generation(&new_grid);
        assert!(final_grid[idx(10, 9)].alive());
        assert!(final_grid[idx(10, 10)].alive());
        assert!(final_grid[idx(10, 11)].alive());
        assert!(!final_grid[idx(9, 10)].alive());
        assert!(!final_grid[idx(11, 10)].alive());
    }

    #[test]
    fn test_block_stable() {
        // Create a block: 2x2 square (stable pattern)
        let mut grid = create_empty_grid();
        grid[idx(10, 10)].set_alive(true);
        grid[idx(10, 10)].set_owner(1);
        grid[idx(10, 11)].set_alive(true);
        grid[idx(10, 11)].set_owner(1);
        grid[idx(11, 10)].set_alive(true);
        grid[idx(11, 10)].set_owner(1);
        grid[idx(11, 11)].set_alive(true);
        grid[idx(11, 11)].set_owner(1);

        let (new_grid, transfers) = step_generation(&grid);

        // Block should remain unchanged
        assert!(new_grid[idx(10, 10)].alive());
        assert!(new_grid[idx(10, 11)].alive());
        assert!(new_grid[idx(11, 10)].alive());
        assert!(new_grid[idx(11, 11)].alive());
        assert!(transfers.is_empty());
    }

    #[test]
    fn test_double_buffer_equivalent() {
        // Verify double buffer produces same result as regular step
        let mut grid = create_empty_grid();
        grid[idx(10, 9)].set_alive(true);
        grid[idx(10, 9)].set_owner(1);
        grid[idx(10, 10)].set_alive(true);
        grid[idx(10, 10)].set_owner(1);
        grid[idx(10, 11)].set_alive(true);
        grid[idx(10, 11)].set_owner(1);

        let (new_grid1, transfers1) = step_generation(&grid);

        let mut write_buffer = create_empty_grid();
        let transfers2 = step_generation_double_buffer(&grid, &mut write_buffer);

        assert_eq!(new_grid1, write_buffer);
        assert_eq!(transfers1, transfers2);
    }
}
