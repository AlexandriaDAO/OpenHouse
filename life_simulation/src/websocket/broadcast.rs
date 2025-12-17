//! Broadcast loop - sends delta updates to all connected clients

use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};
use tokio::time::{interval, Duration};
use life_core::Cell;

use super::ServerMessage;
use crate::simulation::GameGrid;

/// Run broadcast loop - sends deltas to all connected WebSocket clients
pub async fn run_broadcast_loop(
    grid: Arc<RwLock<GameGrid>>,
    tx: broadcast::Sender<ServerMessage>,
) {
    let mut ticker = interval(Duration::from_millis(100)); // Match simulation rate
    let mut prev_cells: Vec<Cell> = vec![];
    let mut prev_generation: u64 = 0;

    tracing::info!("WebSocket broadcast loop started");

    loop {
        ticker.tick().await;

        let (gen, cells) = {
            let g = grid.read().await;
            (g.generation, g.cells.clone())
        };

        // Only broadcast if generation changed
        if gen > prev_generation && !prev_cells.is_empty() {
            let delta = compute_delta(&prev_cells, &cells);

            if !delta.is_empty() {
                let msg = ServerMessage::delta(gen, delta);

                // Broadcast (ignore errors if no receivers)
                let _ = tx.send(msg);
            }
        }

        prev_cells = cells;
        prev_generation = gen;
    }
}

/// Compute delta between old and new cell states
fn compute_delta(old: &[Cell], new: &[Cell]) -> Vec<(u32, u16)> {
    old.iter()
        .zip(new.iter())
        .enumerate()
        .filter_map(|(i, (o, n))| {
            if o != n {
                Some((i as u32, n.packed()))
            } else {
                None
            }
        })
        .collect()
}
