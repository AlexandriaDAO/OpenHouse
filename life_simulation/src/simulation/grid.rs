//! Game grid state management

use life_core::{Cell, step_generation, GRID_SIZE, TOTAL_CELLS};

/// Game grid state - the authoritative simulation state
pub struct GameGrid {
    pub cells: Vec<Cell>,
    pub width: usize,
    pub height: usize,
    pub generation: u64,
    pub last_event_id: u64,
}

impl GameGrid {
    /// Create a new empty grid
    pub fn new(width: usize, height: usize) -> Self {
        Self {
            cells: vec![Cell::default(); width * height],
            width,
            height,
            generation: 0,
            last_event_id: 0,
        }
    }

    /// Create default 512x512 grid
    pub fn default_size() -> Self {
        Self::new(GRID_SIZE, GRID_SIZE)
    }

    /// Run one generation step
    pub fn step(&mut self) {
        let (new_cells, _transfers) = step_generation(&self.cells);
        self.cells = new_cells;
        self.generation += 1;
    }

    /// Apply a placement event from IC
    pub fn apply_placement(&mut self, event: &crate::ic_client::PlacementEvent) {
        for (x, y) in &event.cells {
            let idx = (*y as usize) * self.width + (*x as usize);

            if idx < self.cells.len() {
                let mut cell = self.cells[idx];
                cell.set_owner(event.player_num);
                cell.set_alive(true);
                cell.set_points(1);
                self.cells[idx] = cell;
            }
        }

        self.last_event_id = event.event_id;

        tracing::info!(
            "Applied event {} (player {}, {} cells)",
            event.event_id,
            event.player_num,
            event.cells.len()
        );
    }

    /// Count alive cells
    pub fn alive_count(&self) -> usize {
        self.cells.iter().filter(|c| c.alive()).count()
    }
}

impl Default for GameGrid {
    fn default() -> Self {
        Self::new(TOTAL_CELLS.isqrt(), TOTAL_CELLS.isqrt())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_new_grid() {
        let grid = GameGrid::new(512, 512);
        assert_eq!(grid.width, 512);
        assert_eq!(grid.height, 512);
        assert_eq!(grid.cells.len(), 512 * 512);
        assert_eq!(grid.generation, 0);
    }

    #[test]
    fn test_step() {
        let mut grid = GameGrid::new(512, 512);
        grid.step();
        assert_eq!(grid.generation, 1);
    }
}
