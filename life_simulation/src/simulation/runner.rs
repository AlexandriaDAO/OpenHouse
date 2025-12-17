//! Simulation runner - runs at 10 gen/sec

use std::sync::Arc;
use tokio::sync::RwLock;
use tokio::time::{interval, Duration};

use super::GameGrid;

/// Run simulation loop at 10 generations per second
pub async fn run_simulation_loop(grid: Arc<RwLock<GameGrid>>) {
    let mut ticker = interval(Duration::from_millis(100)); // 10 gen/sec

    tracing::info!("Simulation loop started (10 gen/sec)");

    loop {
        ticker.tick().await;

        {
            let mut g = grid.write().await;
            g.step();

            // Log every 100 generations (10 seconds)
            if g.generation % 100 == 0 {
                let alive = g.alive_count();
                tracing::debug!("Generation: {}, alive cells: {}", g.generation, alive);
            }
        }
    }
}
