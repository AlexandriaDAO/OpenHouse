//! IC canister polling for events

use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::sync::RwLock;
use tokio::time::{interval, Duration};
use ic_agent::Agent;
use candid::{Decode, Encode};

use super::PlacementEvent;
use crate::simulation::GameGrid;

/// Initialize grid from IC on startup (Apply-Then-Forward recovery)
///
/// Recovery Time Estimates:
/// - 1 hour: 36,000 gens -> ~36 seconds
/// - 1 day: 864,000 gens -> ~14 minutes
/// - 2 days: 1,728,000 gens -> ~29 minutes
pub async fn initialize_grid_from_ic() -> Result<GameGrid, Box<dyn std::error::Error + Send + Sync>> {
    let canister_id_str = std::env::var("IC_CANISTER_ID")
        .expect("IC_CANISTER_ID environment variable required");
    let ic_url = std::env::var("IC_URL")
        .unwrap_or_else(|_| "https://icp-api.io".to_string());

    tracing::info!("Connecting to IC at {} for canister {}", ic_url, canister_id_str);

    // Create agent
    let agent = Agent::builder()
        .with_url(&ic_url)
        .build()?;

    // For mainnet, we need to fetch root key only on local replica
    if ic_url.contains("localhost") || ic_url.contains("127.0.0.1") {
        agent.fetch_root_key().await?;
    }

    let canister_id = candid::Principal::from_text(&canister_id_str)?;

    // Fetch ALL events from IC (no snapshots in v1)
    tracing::info!("Fetching all events from IC...");
    let events = fetch_all_events(&agent, canister_id).await?;

    if events.is_empty() {
        tracing::info!("No events found - starting fresh game");
        return Ok(GameGrid::default_size());
    }

    tracing::info!("Fetched {} total events", events.len());

    // Find game start time (first event timestamp)
    let game_start_ns = events.first().unwrap().timestamp_ns;

    // Create empty grid and apply ALL events
    let mut grid = GameGrid::default_size();
    for event in &events {
        grid.apply_placement(event);
    }
    grid.last_event_id = events.last().map(|e| e.event_id + 1).unwrap_or(0);

    // Fast-forward simulation from game start to now
    let now_ns = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos() as u64;
    let elapsed_secs = (now_ns.saturating_sub(game_start_ns)) / 1_000_000_000;
    let gens_to_run = elapsed_secs * 10;  // 10 gen/sec

    if gens_to_run > 0 {
        tracing::info!("Fast-forwarding {} generations (this may take a few minutes)...", gens_to_run);
        let start = std::time::Instant::now();
        for i in 0..gens_to_run {
            grid.step();
            // Log progress every 100k generations
            if i > 0 && i % 100_000 == 0 {
                tracing::info!("  Progress: {} / {} generations", i, gens_to_run);
            }
        }
        tracing::info!("Fast-forward complete in {:?}", start.elapsed());
    }
    grid.generation = gens_to_run;

    Ok(grid)
}

/// Poll IC for new events every 2 seconds
pub async fn run_poll_loop(grid: Arc<RwLock<GameGrid>>) {
    let canister_id_str = std::env::var("IC_CANISTER_ID")
        .expect("IC_CANISTER_ID environment variable required");
    let ic_url = std::env::var("IC_URL")
        .unwrap_or_else(|_| "https://icp-api.io".to_string());

    // Create agent
    let agent = match Agent::builder().with_url(&ic_url).build() {
        Ok(a) => a,
        Err(e) => {
            tracing::error!("Failed to create IC agent: {}", e);
            return;
        }
    };

    // For mainnet, we need to fetch root key only on local replica
    if ic_url.contains("localhost") || ic_url.contains("127.0.0.1") {
        if let Err(e) = agent.fetch_root_key().await {
            tracing::error!("Failed to fetch root key: {}", e);
            return;
        }
    }

    let canister_id = match candid::Principal::from_text(&canister_id_str) {
        Ok(id) => id,
        Err(e) => {
            tracing::error!("Invalid canister ID: {}", e);
            return;
        }
    };

    let mut ticker = interval(Duration::from_secs(2));

    tracing::info!("IC event polling started (every 2s)");

    loop {
        ticker.tick().await;

        let last_event_id = grid.read().await.last_event_id;

        match fetch_events_since(&agent, canister_id, last_event_id).await {
            Ok(events) => {
                if !events.is_empty() {
                    tracing::info!("Received {} new events from IC", events.len());
                    let mut g = grid.write().await;
                    for event in events {
                        g.apply_placement(&event);
                    }
                }
            }
            Err(e) => {
                tracing::error!("IC poll failed: {}", e);
            }
        }
    }
}

/// Fetch all events from IC canister
async fn fetch_all_events(
    agent: &Agent,
    canister_id: candid::Principal,
) -> Result<Vec<PlacementEvent>, Box<dyn std::error::Error + Send + Sync>> {
    let response = agent
        .query(&canister_id, "get_all_events")
        .with_arg(Encode!()?)
        .call()
        .await?;

    let events: Vec<PlacementEvent> = Decode!(&response, Vec<PlacementEvent>)?;
    Ok(events)
}

/// Fetch events since a specific event ID
async fn fetch_events_since(
    agent: &Agent,
    canister_id: candid::Principal,
    since_id: u64,
) -> Result<Vec<PlacementEvent>, Box<dyn std::error::Error + Send + Sync>> {
    let limit: u32 = 100; // Fetch up to 100 events at a time

    let response = agent
        .query(&canister_id, "get_events_since")
        .with_arg(Encode!(&since_id, &limit)?)
        .call()
        .await?;

    let events: Vec<PlacementEvent> = Decode!(&response, Vec<PlacementEvent>)?;
    Ok(events)
}
