//! Life Simulation Server
//!
//! Runs Game of Life simulation at 10 gen/sec and streams updates via WebSocket.
//! Part of the hybrid IC + Fly.io architecture.

use std::sync::Arc;
use tokio::sync::{RwLock, broadcast};
use axum::{Router, routing::get};
use tower_http::cors::{CorsLayer, Any};

mod simulation;
mod ic_client;
mod websocket;
mod http;

use websocket::ServerMessage;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    // Load environment
    dotenvy::dotenv().ok();

    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive("life_simulation=info".parse().unwrap())
        )
        .init();

    tracing::info!("Starting Life Simulation Server");
    tracing::info!("IC Canister: {}", std::env::var("IC_CANISTER_ID").unwrap_or_else(|_| "NOT SET".to_string()));

    // Initialize grid from IC (replay events + fast-forward)
    tracing::info!("Loading state from IC...");
    let grid = Arc::new(RwLock::new(
        ic_client::initialize_grid_from_ic().await?
    ));

    {
        let g = grid.read().await;
        tracing::info!(
            "State loaded: generation={}, alive_cells={}, last_event_id={}",
            g.generation,
            g.alive_count(),
            g.last_event_id
        );
    }

    // WebSocket broadcast channel
    let (tx, _rx) = broadcast::channel::<ServerMessage>(100);

    // Spawn background tasks
    tokio::spawn(simulation::run_simulation_loop(grid.clone()));
    tokio::spawn(ic_client::run_poll_loop(grid.clone()));
    tokio::spawn(websocket::run_broadcast_loop(grid.clone(), tx.clone()));

    // CORS configuration for frontend
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // Build HTTP + WebSocket server
    let app = Router::new()
        .route("/ws", get(websocket::ws_handler))
        .route("/health", get(http::health_check))
        .route("/", get(|| async { "Life Simulation Server - Connect via WebSocket at /ws" }))
        .layer(cors)
        .with_state((grid, tx));

    let port = std::env::var("PORT").unwrap_or_else(|_| "8080".to_string());
    let addr = format!("0.0.0.0:{}", port);
    let listener = tokio::net::TcpListener::bind(&addr).await?;

    tracing::info!("Server listening on {}", addr);
    tracing::info!("WebSocket endpoint: ws://{}:{}/ws", "localhost", port);

    axum::serve(listener, app).await?;

    Ok(())
}
