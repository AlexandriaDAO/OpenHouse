//! Life Core - Shared Game of Life Simulation Library
//!
//! This crate provides the core Game of Life logic shared between:
//! - IC Canister (with `candid` feature for Candid serialization)
//! - Fly.io Server (with `serde` feature for JSON/bincode serialization)
//!
//! # Features
//!
//! - `serde` - Enable serde serialization (for Fly.io)
//! - `candid` - Enable Candid serialization (for IC canister)
//!
//! # Example
//!
//! ```rust
//! use life_core::{Cell, step_generation, GRID_SIZE, TOTAL_CELLS};
//!
//! // Create an empty grid
//! let mut cells = vec![Cell::default(); TOTAL_CELLS];
//!
//! // Place a cell
//! cells[100].set_owner(1);
//! cells[100].set_alive(true);
//! cells[100].set_points(1);
//!
//! // Run one generation
//! let (new_cells, point_transfers) = step_generation(&cells);
//! ```

mod cell;
mod step;

pub use cell::Cell;
pub use step::{idx, step_generation, step_generation_double_buffer, PointTransfer};

// ============================================================================
// CONSTANTS
// ============================================================================

/// Grid dimension (512x512)
pub const GRID_SIZE: usize = 512;

/// Bit shift for fast row-to-index conversion (2^9 = 512)
pub const GRID_SHIFT: usize = 9;

/// Bitmask for fast modulo operation (x & GRID_MASK == x % 512)
pub const GRID_MASK: usize = 0x1FF;

/// Total cells in grid (512 * 512 = 262,144)
pub const TOTAL_CELLS: usize = GRID_SIZE * GRID_SIZE;

/// Maximum number of players supported
pub const MAX_PLAYERS: usize = 10;

/// Starting balance for new players
pub const STARTING_BALANCE: u64 = 1000;

/// Generations per second (10 gen/sec = 100ms per generation)
pub const GENERATIONS_PER_SECOND: u64 = 10;

/// Milliseconds per generation
pub const MS_PER_GENERATION: u64 = 100;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_constants() {
        assert_eq!(GRID_SIZE, 512);
        assert_eq!(TOTAL_CELLS, 262_144);
        assert_eq!(1 << GRID_SHIFT, GRID_SIZE);
        assert_eq!(GRID_SIZE - 1, GRID_MASK);
    }

    #[test]
    fn test_idx_function() {
        // Test various positions
        assert_eq!(idx(0, 0), 0);
        assert_eq!(idx(0, 1), 1);
        assert_eq!(idx(1, 0), GRID_SIZE);
        assert_eq!(idx(1, 1), GRID_SIZE + 1);
        assert_eq!(idx(100, 200), 100 * GRID_SIZE + 200);
    }
}
