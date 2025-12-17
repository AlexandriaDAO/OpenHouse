//! WebSocket message protocol

use serde::{Serialize, Deserialize};
use life_core::Cell;

/// Messages from client to server
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(tag = "type")]
pub enum ClientMessage {
    /// Subscribe to updates
    Subscribe,
    /// Ping for latency measurement
    Ping { timestamp: u64 },
}

/// Messages from server to client
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(tag = "type")]
pub enum ServerMessage {
    /// Full grid state (sent on initial connection)
    FullState {
        generation: u64,
        width: u32,
        height: u32,
        /// Packed cells as u16 values for efficiency
        cells: Vec<u16>,
    },

    /// Incremental delta update
    Delta {
        generation: u64,
        /// Changed cells: (flat_index, packed_cell_value)
        changed_cells: Vec<(u32, u16)>,
    },

    /// Pong response to ping
    Pong { timestamp: u64 },
}

impl ServerMessage {
    /// Create a full state message from grid
    pub fn full_state(generation: u64, width: usize, height: usize, cells: &[Cell]) -> Self {
        ServerMessage::FullState {
            generation,
            width: width as u32,
            height: height as u32,
            cells: cells.iter().map(|c| c.packed()).collect(),
        }
    }

    /// Create a delta message from changed cells
    pub fn delta(generation: u64, changed: Vec<(u32, u16)>) -> Self {
        ServerMessage::Delta {
            generation,
            changed_cells: changed,
        }
    }
}
