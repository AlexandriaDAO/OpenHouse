# Game of Life: Hybrid IC + Fly.io Architecture Plan

## Executive Summary

Split the Game of Life into a hybrid on-chain/off-chain architecture to enable 24/7 simulation at 10 gen/sec while staying under budget constraints.

**Architecture**:
- **IC Canister**: Pure event log + balance tracking (~$2/year) - NO simulation, NO grid storage
- **Fly.io Server**: Runs ALL simulation at 10 gen/sec + WebSocket broadcast (~$56/month)
- **Frontend**: Dual connection (IC for placements, WebSocket for real-time display)

**Cost Comparison**:
- Current (timer on IC): ~$36,500/year (not feasible)
- Event-driven (current): ~$10/year (backend stale unless players interact)
- Hybrid (proposed): ~$2/year IC + $56/month Fly.io = **~$675/year total**

**Key Design Decisions** (refined from discussion):
- **Points**: Spend only, no earning (token integration later)
- **Recovery**: Apply-then-forward (simpler, slight timing inaccuracy acceptable)
- **Placement UX**: Wait for WebSocket confirmation (show loading state)
- **No IC snapshots for v1**: Rebuild from events (~29 min recovery for 2-day game)
- **IC stores events, Fly.io is authoritative for grid state**

---

## Architecture Diagram

```
User → Internet Identity
         ↓
    IC Canister (place_cells)
         ↓ (event log)
    Fly.io Server (polls IC every 2s)
         ↓ (WebSocket)
    Frontend Display
```

**Data Flow**:
1. User places cells → IC validates balance → IC records event
2. Fly.io polls IC → gets new events → applies to simulation
3. Simulation runs at 10 gen/sec → generates deltas
4. Fly.io broadcasts deltas via WebSocket → Frontend updates display

---

## Phase 1: Create Shared Simulation Library

### Goal
Extract pure Game of Life logic into a shared Rust library that both IC canister and Fly.io can use.

### 1.1 Create `life_core/` directory

**Location**: `/home/theseus/alexandria/openhouse/life_core/`

**Directory Structure**:
```
life_core/
├── Cargo.toml
└── src/
    ├── lib.rs      # Re-exports
    ├── cell.rs     # Cell struct (2-byte packed)
    └── step.rs     # Pure Game of Life simulation
```

### 1.2 Extract code from `life1_backend/src/lib.rs`

**Cell struct** (lines 35-67):
```rust
// life_core/src/cell.rs
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
#[cfg_attr(feature = "candid", derive(candid::CandidType, candid::Deserialize))]
pub struct Cell {
    packed: u16,  // Bits 0-3: owner, Bits 4-10: points, Bit 11: alive
}

impl Cell {
    pub fn new(owner: u8, points: u8, alive: bool) -> Self { /* ... */ }
    pub fn owner(&self) -> u8 { /* ... */ }
    pub fn points(&self) -> u8 { /* ... */ }
    pub fn alive(&self) -> bool { /* ... */ }
    pub fn set_owner(&mut self, v: u8) { /* ... */ }
    pub fn set_points(&mut self, v: u8) { /* ... */ }
    pub fn set_alive(&mut self, v: bool) { /* ... */ }
}
```

**Constants** (lines 14-22):
```rust
// life_core/src/lib.rs
pub const GRID_SIZE: usize = 512;
pub const GRID_SHIFT: usize = 9;
pub const GRID_MASK: usize = 0x1FF;
pub const TOTAL_CELLS: usize = 262_144;
pub const MAX_PLAYERS: usize = 10;
```

**Step generation** (lines 373-469):
```rust
// life_core/src/step.rs
pub fn step_generation(
    cells: &[Cell],
    width: usize,
    height: usize,
) -> (Vec<Cell>, Vec<(u8, u8)>) {
    // Returns: (new_cells, point_transfers)
    // point_transfers = Vec<(to_player, points)>
}
```

### 1.3 Cargo.toml

```toml
[package]
name = "life_core"
version = "0.1.0"
edition = "2021"

[features]
default = []
serde = ["dep:serde"]
candid = ["dep:candid", "dep:serde"]

[dependencies]
serde = { version = "1.0", optional = true, features = ["derive"] }
candid = { version = "0.10", optional = true }
```

**Purpose**: Enable IC canister to use `candid` feature, Fly.io to use `serde` feature.

---

## Phase 2: Transform IC Canister to Pure Event Log

### Goal
Remove ALL simulation from IC canister, transform it into:
1. Lightweight event log that records player actions
2. Balance tracking (spend only)

**Note**: No IC snapshots for v1. Fly.io rebuilds from event log on startup.

### 2.1 Modify `life1_backend/Cargo.toml`

**Add dependency**:
```toml
[dependencies]
life_core = { path = "../life_core", features = ["candid"] }
# ... rest stays the same
```

### 2.2 Modify `life1_backend/src/lib.rs`

#### Remove (Simulation Components)

**Delete entirely**:
- `GRID_A`, `GRID_B` variables (lines 215-221)
- `ACTIVE_BUFFER` (line 223)
- `STABLE_GRID` (lines 223-228)
- `step_generation()` function (lines 373-411)
- `process_generation()` function (lines 416-469)
- `get_state()` query (lines 878-882)
- Catch-up simulation logic in `place_cells()` (lines 917-954)

#### Add (Event Storage)

**New types**:
```rust
use life_core::Cell;

#[derive(CandidType, Deserialize, Clone)]
pub struct PlacementEvent {
    pub event_id: u64,
    pub timestamp_ns: u64,
    pub player_principal: Principal,
    pub player_num: u8,
    pub cells: Vec<(u16, u16)>,  // (x, y) grid coordinates
    pub balance_after: u64,
}

#[derive(CandidType, Deserialize, Clone)]
pub struct PlaceCellsResult {
    pub placed_count: u32,
    pub event_id: u64,
    pub new_timestamp_ns: u64,
}
```

**New stable storage** (no snapshots in v1):
```rust
const MEMORY_ID_EVENT_LOG: MemoryId = MemoryId::new(50);

thread_local! {
    static EVENT_LOG: RefCell<StableVec<PlacementEvent, Memory>> = RefCell::new(
        StableVec::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MEMORY_ID_EVENT_LOG))
        ).unwrap()
    );

    static NEXT_EVENT_ID: RefCell<u64> = RefCell::new(0);
}
```

**Implement Storable for PlacementEvent**:
```rust
impl Storable for PlacementEvent {
    fn to_bytes(&self) -> Cow<'_, [u8]> {
        Cow::Owned(candid::encode_one(self).unwrap())
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        candid::decode_one(&bytes).unwrap_or_else(|_| PlacementEvent {
            event_id: 0,
            timestamp_ns: 0,
            player_principal: Principal::anonymous(),
            player_num: 0,
            cells: vec![],
            balance_after: 0,
        })
    }

    const BOUND: ic_stable_structures::storable::Bound =
        ic_stable_structures::storable::Bound::Unbounded;
}
```

#### Rewrite `place_cells()`

**New implementation** (simplified, no simulation):
```rust
#[update]
fn place_cells(
    _game_id: u64,
    cells: Vec<(i32, i32)>,
    _expected_generation: u64  // Ignored in new architecture
) -> Result<PlaceCellsResult, String> {
    let caller = ic_cdk::api::msg_caller();

    if caller == Principal::anonymous() {
        return Err("Anonymous players not allowed".to_string());
    }

    // Get or assign player
    let (player_num, player_idx) = CACHED_METADATA.with(|m| {
        let mut m = m.borrow_mut();

        if let Some(pos) = m.players.iter().position(|p| *p == caller) {
            Ok(((pos + 1) as u8, pos))
        } else if m.players.len() >= MAX_PLAYERS {
            Err("Game full - max 10 players".to_string())
        } else {
            m.players.push(caller);
            m.balances.push(STARTING_BALANCE);
            Ok((m.players.len() as u8, m.players.len() - 1))
        }
    })?;

    let cost = cells.len() as u64;

    // Check balance
    let current_balance = CACHED_METADATA.with(|m| {
        m.borrow().balances.get(player_idx).copied().unwrap_or(0)
    });

    if current_balance < cost {
        return Err(format!("Insufficient points. Need {}, have {}", cost, current_balance));
    }

    // Deduct balance
    CACHED_METADATA.with(|m| {
        let mut m = m.borrow_mut();
        if let Some(balance) = m.balances.get_mut(player_idx) {
            *balance -= cost;
        }
    });

    // Record event
    let event_id = NEXT_EVENT_ID.with(|id| {
        let mut id = id.borrow_mut();
        let current = *id;
        *id += 1;
        current
    });

    let now = ic_cdk::api::time();
    let event = PlacementEvent {
        event_id,
        timestamp_ns: now,
        player_principal: caller,
        player_num,
        cells: cells.iter()
            .map(|(x, y)| {
                let col = ((*x & GRID_MASK as i32) + GRID_SIZE as i32) as u16 & GRID_MASK as u16;
                let row = ((*y & GRID_MASK as i32) + GRID_SIZE as i32) as u16 & GRID_MASK as u16;
                (col, row)
            })
            .collect(),
        balance_after: current_balance - cost,
    };

    EVENT_LOG.with(|log| {
        log.borrow_mut().push(&event).map_err(|e| format!("Failed to store event: {:?}", e))
    })?;

    ic_cdk::println!("Recorded event {} for player {}", event_id, player_num);

    Ok(PlaceCellsResult {
        placed_count: cells.len() as u32,
        event_id,
        new_timestamp_ns: now,
    })
}
```

#### Add new query methods

**For Fly.io to poll events**:
```rust
#[query]
fn get_events_since(since_event_id: u64, limit: u32) -> Vec<PlacementEvent> {
    EVENT_LOG.with(|log| {
        let log = log.borrow();
        let start = since_event_id;
        let end = log.len().min(start + limit as u64);

        (start..end)
            .filter_map(|i| log.get(i))
            .collect()
    })
}

#[query]
fn get_all_events() -> Vec<PlacementEvent> {
    EVENT_LOG.with(|log| {
        let log = log.borrow();
        (0..log.len())
            .filter_map(|i| log.get(i))
            .collect()
    })
}

#[query]
fn get_latest_event_id() -> u64 {
    EVENT_LOG.with(|log| log.borrow().len())
}

#[query]
fn get_game_start_time() -> Option<u64> {
    EVENT_LOG.with(|log| {
        log.borrow().get(0).map(|e| e.timestamp_ns)
    })
}
```

### 2.3 Update Candid interface (`life1_backend.did`)

```candid
type PlacementEvent = record {
  event_id : nat64;
  timestamp_ns : nat64;
  player_principal : principal;
  player_num : nat8;
  cells : vec record { nat16; nat16 };
  balance_after : nat64;
};

type PlaceCellsResult = record {
  placed_count : nat32;
  event_id : nat64;
  new_timestamp_ns : nat64;
};

service : {
  // Existing (keep)
  join_game : (nat64) -> (variant { Ok : nat8; Err : text });
  get_balance : (nat64) -> (variant { Ok : nat64; Err : text }) query;
  get_metadata : (nat64) -> (variant { Ok : GameMetadata; Err : text }) query;

  // Modified
  place_cells : (nat64, vec record { int32; int32 }, nat64) ->
    (variant { Ok : PlaceCellsResult; Err : text });

  // New (for Fly.io polling)
  get_events_since : (nat64, nat32) -> (vec PlacementEvent) query;
  get_all_events : () -> (vec PlacementEvent) query;
  get_latest_event_id : () -> (nat64) query;
  get_game_start_time : () -> (opt nat64) query;
}
```

---

## Phase 3: Build Fly.io Simulation Server

### Goal
Create standalone Rust server that runs 24/7 simulation and streams state via WebSocket.

### 3.1 Create `life_simulation/` directory

**Location**: `/home/theseus/alexandria/openhouse/life_simulation/`

**Structure**:
```
life_simulation/
├── Cargo.toml
├── Dockerfile
├── fly.toml
├── .env.example
└── src/
    ├── main.rs              # Server bootstrap
    ├── simulation/
    │   ├── mod.rs
    │   ├── grid.rs          # GameGrid state
    │   └── runner.rs        # 10 gen/sec loop
    ├── ic_client/
    │   ├── mod.rs
    │   ├── types.rs         # PlacementEvent mirror
    │   └── poller.rs        # Poll IC every 2s
    ├── websocket/
    │   ├── mod.rs
    │   ├── handler.rs       # WS connection handler
    │   ├── broadcast.rs     # Broadcast deltas
    │   └── protocol.rs      # Message types
    └── http/
        ├── mod.rs
        └── health.rs        # Health check endpoint
```

### 3.2 Cargo.toml

```toml
[package]
name = "life_simulation"
version = "0.1.0"
edition = "2021"

[dependencies]
life_core = { path = "../life_core", features = ["serde"] }

# Async runtime
tokio = { version = "1", features = ["full"] }

# Web server
axum = { version = "0.7", features = ["ws"] }
tower-http = { version = "0.5", features = ["cors", "compression-gzip"] }

# Serialization
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
bincode = "1.3"  # For snapshot compression

# HTTP client (for IC polling)
reqwest = { version = "0.11", features = ["json"] }

# Logging
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }

# Environment
dotenvy = "0.15"

# Compression
flate2 = "1.0"  # gzip compression for snapshots
```

### 3.3 Main server (`src/main.rs`)

```rust
use std::sync::Arc;
use tokio::sync::{RwLock, broadcast};
use axum::{Router, routing::get};
use tower_http::compression::CompressionLayer;

mod simulation;
mod ic_client;
mod websocket;
mod http;

use simulation::GameGrid;

type SharedGrid = Arc<RwLock<GameGrid>>;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Load environment
    dotenvy::dotenv().ok();

    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    tracing::info!("Starting Life Simulation Server");

    // Initialize grid from IC (snapshot + events)
    tracing::info!("Loading state from IC...");
    let grid = Arc::new(RwLock::new(
        ic_client::initialize_grid_from_ic().await?
    ));
    tracing::info!("State loaded successfully");

    // WebSocket broadcast channel
    let (tx, _rx) = broadcast::channel::<websocket::ServerMessage>(100);

    // Spawn 3 background tasks (no snapshots in v1)
    tokio::spawn(simulation::run_simulation_loop(grid.clone()));
    tokio::spawn(ic_client::run_poll_loop(grid.clone()));
    tokio::spawn(websocket::run_broadcast_loop(grid.clone(), tx.clone()));

    // Build HTTP + WebSocket server
    let app = Router::new()
        .route("/ws", get(websocket::ws_handler))
        .route("/health", get(http::health_check))
        .layer(CompressionLayer::new())
        .with_state((grid, tx));

    let addr = "0.0.0.0:8080";
    let listener = tokio::net::TcpListener::bind(addr).await?;

    tracing::info!("Server listening on {}", addr);

    axum::serve(listener, app).await?;

    Ok(())
}
```

### 3.4 GameGrid (`src/simulation/grid.rs`)

```rust
use life_core::{Cell, GRID_SIZE, TOTAL_CELLS};

pub struct GameGrid {
    pub cells: Vec<Cell>,
    pub width: usize,
    pub height: usize,
    pub generation: u64,
    pub last_event_id: u64,
}

impl GameGrid {
    pub fn new(width: usize, height: usize) -> Self {
        Self {
            cells: vec![Cell::default(); width * height],
            width,
            height,
            generation: 0,
            last_event_id: 0,
        }
    }

    pub fn step(&mut self) {
        let (new_cells, _transfers) = life_core::step_generation(
            &self.cells,
            self.width,
            self.height,
        );

        self.cells = new_cells;
        self.generation += 1;
    }

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
}
```

### 3.5 Simulation loop (`src/simulation/runner.rs`)

```rust
use super::SharedGrid;
use tokio::time::{interval, Duration};

pub async fn run_simulation_loop(grid: SharedGrid) {
    let mut ticker = interval(Duration::from_millis(100)); // 10 gen/sec

    tracing::info!("Simulation loop started (10 gen/sec)");

    loop {
        ticker.tick().await;

        {
            let mut g = grid.write().await;
            g.step();

            // Log every 10 seconds
            if g.generation % 100 == 0 {
                tracing::debug!("Generation: {}", g.generation);
            }
        }
    }
}
```

### 3.6 IC initialization and polling (`src/ic_client/poller.rs`)

```rust
use super::{PlacementEvent, SharedGrid};
use tokio::time::{interval, Duration};
use std::time::{SystemTime, UNIX_EPOCH};

/// Initialize grid from IC on startup (Apply-Then-Forward recovery)
///
/// Recovery Time Estimates:
/// - 1 hour: 36,000 gens → ~36 seconds
/// - 1 day: 864,000 gens → ~14 minutes
/// - 2 days: 1,728,000 gens → ~29 minutes
pub async fn initialize_grid_from_ic() -> Result<GameGrid, Box<dyn std::error::Error>> {
    let canister_id = std::env::var("IC_CANISTER_ID")
        .expect("IC_CANISTER_ID required");

    // Fetch ALL events from IC (no snapshots in v1)
    tracing::info!("Fetching all events from IC...");
    let events = fetch_all_events(&canister_id).await?;

    if events.is_empty() {
        tracing::info!("No events found - starting fresh game");
        return Ok(GameGrid::new(512, 512));
    }

    tracing::info!("Fetched {} total events", events.len());

    // Find game start time (first event timestamp)
    let game_start_ns = events.first().unwrap().timestamp_ns;

    // Create empty grid and apply ALL events
    let mut grid = GameGrid::new(512, 512);
    for event in &events {
        grid.apply_placement(event);
    }
    grid.last_event_id = events.last().map(|e| e.event_id).unwrap_or(0);

    // Fast-forward simulation from game start to now
    let now_ns = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos() as u64;
    let elapsed_secs = (now_ns - game_start_ns) / 1_000_000_000;
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
pub async fn run_poll_loop(grid: SharedGrid) {
    let canister_id = std::env::var("IC_CANISTER_ID")
        .expect("IC_CANISTER_ID required");

    let mut ticker = interval(Duration::from_secs(2));

    tracing::info!("IC event polling started (every 2s)");

    loop {
        ticker.tick().await;

        let last_event_id = grid.read().await.last_event_id;

        match fetch_events_since(&canister_id, last_event_id).await {
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

// Helper functions for IC communication (using ic-agent crate)
async fn fetch_all_events(canister_id: &str) -> Result<Vec<PlacementEvent>, ...> { /* ... */ }
async fn fetch_events_since(canister_id: &str, since_id: u64) -> Result<Vec<PlacementEvent>, ...> { /* ... */ }
```

**Note**: No snapshot loop in v1. Snapshots can be added later for faster recovery.

### 3.7 WebSocket broadcast (`src/websocket/broadcast.rs`)

```rust
use super::{ServerMessage, SharedGrid};
use tokio::sync::broadcast;
use tokio::time::{interval, Duration};
use life_core::Cell;

pub async fn run_broadcast_loop(
    grid: SharedGrid,
    tx: broadcast::Sender<ServerMessage>,
) {
    let mut ticker = interval(Duration::from_millis(100));
    let mut prev_cells: Vec<Cell> = vec![];

    tracing::info!("WebSocket broadcast loop started");

    loop {
        ticker.tick().await;

        let (gen, cells) = {
            let g = grid.read().await;
            (g.generation, g.cells.clone())
        };

        if !prev_cells.is_empty() {
            let delta = compute_delta(&prev_cells, &cells);

            if !delta.is_empty() {
                let msg = ServerMessage::Delta {
                    generation: gen,
                    changed_cells: delta,
                };

                // Broadcast (ignore errors if no receivers)
                let _ = tx.send(msg);
            }
        }

        prev_cells = cells;
    }
}

fn compute_delta(old: &[Cell], new: &[Cell]) -> Vec<(u32, Cell)> {
    old.iter()
        .zip(new.iter())
        .enumerate()
        .filter_map(|(i, (o, n))| {
            if o != n {
                Some((i as u32, *n))
            } else {
                None
            }
        })
        .collect()
}
```

### 3.8 WebSocket protocol (`src/websocket/protocol.rs`)

```rust
use serde::{Serialize, Deserialize};
use life_core::Cell;

#[derive(Serialize, Deserialize, Clone)]
#[serde(tag = "type")]
pub enum ClientMessage {
    Subscribe,
    Ping { timestamp: u64 },
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(tag = "type")]
pub enum ServerMessage {
    FullState {
        generation: u64,
        width: u32,
        height: u32,
        cells: Vec<Cell>,
    },

    Delta {
        generation: u64,
        changed_cells: Vec<(u32, Cell)>,
    },

    Pong {
        timestamp: u64,
    },
}
```

### 3.9 WebSocket handler (`src/websocket/handler.rs`)

```rust
use axum::{
    extract::{ws::{WebSocket, WebSocketUpgrade}, State},
    response::IntoResponse,
};
use tokio::sync::broadcast;
use futures::{StreamExt, SinkExt};

use super::{ServerMessage, ClientMessage, SharedGrid};

pub async fn ws_handler(
    ws: WebSocketUpgrade,
    State((grid, tx)): State<(SharedGrid, broadcast::Sender<ServerMessage>)>,
) -> impl IntoResponse {
    ws.on_upgrade(|socket| handle_socket(socket, grid, tx))
}

async fn handle_socket(
    socket: WebSocket,
    grid: SharedGrid,
    tx: broadcast::Sender<ServerMessage>,
) {
    let (mut sender, mut receiver) = socket.split();
    let mut rx = tx.subscribe();

    // Send full state on connect
    let full_state = {
        let g = grid.read().await;
        ServerMessage::FullState {
            generation: g.generation,
            width: g.width as u32,
            height: g.height as u32,
            cells: g.cells.clone(),
        }
    };

    if sender.send(axum::extract::ws::Message::Text(
        serde_json::to_string(&full_state).unwrap()
    )).await.is_err() {
        return;
    }

    tracing::info!("WebSocket client connected");

    // Spawn task to broadcast updates to this client
    let mut send_task = tokio::spawn(async move {
        while let Ok(msg) = rx.recv().await {
            if sender.send(axum::extract::ws::Message::Text(
                serde_json::to_string(&msg).unwrap()
            )).await.is_err() {
                break;
            }
        }
    });

    // Receive messages from client (ping/pong)
    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = receiver.next().await {
            if let axum::extract::ws::Message::Text(text) = msg {
                if let Ok(client_msg) = serde_json::from_str::<ClientMessage>(&text) {
                    match client_msg {
                        ClientMessage::Ping { timestamp } => {
                            // Respond with pong (not implemented here)
                        }
                        ClientMessage::Subscribe => {
                            // Already subscribed
                        }
                    }
                }
            }
        }
    });

    // Wait for either task to finish
    tokio::select! {
        _ = (&mut send_task) => recv_task.abort(),
        _ = (&mut recv_task) => send_task.abort(),
    }

    tracing::info!("WebSocket client disconnected");
}
```

### 3.10 Deployment config (`fly.toml`)

```toml
app = "openhouse-life"
primary_region = "sjc"  # San Jose (closest to IC nodes)

[build]
  dockerfile = "Dockerfile"

[env]
  RUST_LOG = "info,life_simulation=debug"
  IC_CANISTER_ID = "pijnb-7yaaa-aaaae-qgcuq-cai"
  IC_API_URL = "https://icp-api.io"

[[services]]
  internal_port = 8080
  protocol = "tcp"
  auto_stop_machines = false
  min_machines_running = 1

  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]

  [[services.ports]]
    port = 80
    handlers = ["http"]

[http_service]
  auto_stop_machines = false
  min_machines_running = 1
  force_https = true
```

### 3.11 Dockerfile

```dockerfile
FROM rust:1.75-slim as builder

WORKDIR /app

# Copy manifests
COPY life_core/Cargo.toml life_core/Cargo.toml
COPY life_simulation/Cargo.toml life_simulation/Cargo.toml

# Copy source
COPY life_core/src life_core/src
COPY life_simulation/src life_simulation/src

# Build release
WORKDIR /app/life_simulation
RUN cargo build --release

# Runtime image
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/life_simulation/target/release/life_simulation /usr/local/bin/life_simulation

EXPOSE 8080

CMD ["life_simulation"]
```

---

## Phase 4: Update Frontend

### Goal
Connect frontend to both IC (for actions) and Fly.io (for display).

### 4.1 Add WebSocket connection

**Location**: `openhouse_frontend/src/pages/Life.tsx`

**Add state** (after line 140):
```typescript
const [wsConnected, setWsConnected] = useState(false);
const wsRef = useRef<WebSocket | null>(null);
```

**Add WebSocket useEffect** (after line 515):
```typescript
// WebSocket connection to Fly.io simulation server
useEffect(() => {
  if (!isAuthenticated) return;

  const WS_URL = 'wss://openhouse-life.fly.dev/ws';
  const ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    setWsConnected(true);
    ws.send(JSON.stringify({ type: 'Subscribe' }));
    console.log('Connected to simulation server');
  };

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);

    if (msg.type === 'FullState') {
      // Initial state on connect
      setLocalCells(msg.cells);
      setGameState(prev => prev ? {
        ...prev,
        generation: BigInt(msg.generation),
      } : prev);
    } else if (msg.type === 'Delta') {
      // Incremental updates
      setLocalCells(cells => {
        const newCells = [...cells];
        for (const [idx, cell] of msg.changed_cells) {
          newCells[idx] = cell;
        }
        return newCells;
      });

      setGameState(prev => prev ? {
        ...prev,
        generation: BigInt(msg.generation),
      } : prev);
    }
  };

  ws.onerror = (err) => {
    console.error('WebSocket error:', err);
  };

  ws.onclose = () => {
    setWsConnected(false);
    console.log('Disconnected from simulation server, reconnecting...');

    // Auto-reconnect after 2 seconds
    setTimeout(() => {
      // Trigger re-run of this effect
    }, 2000);
  };

  wsRef.current = ws;

  return () => {
    ws.close();
  };
}, [isAuthenticated]);
```

### 4.2 Remove local simulation

**DELETE lines 547-571**:
```typescript
// DELETE THIS ENTIRE BLOCK - Fly.io handles simulation now
// useEffect(() => {
//   if (!isRunning || !hasCells) return;
//   const localTick = setInterval(() => {
//     setLocalCells(cells => {
//       const { cells: newCells, transfers } = stepLocalGeneration(cells);
//       ...
//     });
//   }, LOCAL_TICK_MS);
//   return () => clearInterval(localTick);
// }, [isRunning, hasCells, myPlayerNum]);
```

### 4.3 Simplify backend sync (balances only)

**Replace lines 430-515**:
```typescript
// Backend sync - balances only (cells come from WebSocket)
useEffect(() => {
  if (!actor || !isAuthenticated) return;

  const syncBalances = async () => {
    try {
      const balanceResult = await actor.get_balance(currentGameId);

      if ('Ok' in balanceResult) {
        setMyBalance(Number(balanceResult.Ok));
      }
    } catch (err) {
      console.error('Balance sync error:', err);
    }
  };

  // Initial sync
  syncBalances();

  // Poll every 5 seconds
  const interval = setInterval(syncBalances, 5000);

  return () => clearInterval(interval);
}, [actor, currentGameId, isAuthenticated]);
```

### 4.4 Update place_cells flow

**Modify confirmPlacement** (lines 1001-1128):
```typescript
const confirmPlacement = useCallback(async () => {
  const cellsToPlace: [number, number][] = pendingPlacements.flatMap(p => p.cells);

  if (!actor || cellsToPlace.length === 0 || isConfirmingPlacement) return;

  const cost = cellsToPlace.length;

  if (myBalance < cost) {
    setPlacementError(`Not enough points. Need ${cost}, have ${myBalance}`);
    return;
  }

  setIsConfirmingPlacement(true);
  setPlacementError(null);

  try {
    // Call IC canister (event recorder)
    const result = await actor.place_cells(
      currentGameId,
      cellsToPlace,
      BigInt(0)  // Generation check removed - IC doesn't simulate anymore
    );

    if ('Err' in result) {
      setPlacementError(result.Err);
    } else {
      const { event_id, placed_count } = result.Ok;

      // Optimistic UI update
      setMyBalance(prev => prev - cost);
      setPendingPlacements([]);
      setPlacementError(null);

      console.log(`Placement recorded as event ${event_id} (${placed_count} cells)`);
      console.log('Fly.io will apply and broadcast via WebSocket in ~2 seconds');

      // Note: Don't update cells here - wait for WebSocket update from Fly.io
      // This ensures all clients see consistent state
    }
  } catch (err) {
    console.error('Place error:', err);
    setPlacementError(`Network error: ${err}. Please try again.`);
  } finally {
    setIsConfirmingPlacement(false);
  }
}, [actor, pendingPlacements, isConfirmingPlacement, myBalance, currentGameId]);
```

### 4.5 Add connection status UI

**Add after line 1416**:
```typescript
{/* WebSocket connection status */}
{!wsConnected && (
  <div className="absolute top-2 left-2 z-50 bg-red-600/90 border border-red-400 text-white px-3 py-2 rounded-lg text-sm font-mono">
    ⚠ Connecting to simulation server...
  </div>
)}

{wsConnected && (
  <div className="absolute top-2 left-2 z-50 bg-green-600/70 px-2 py-1 rounded text-xs text-white font-mono">
    ● Live
  </div>
)}
```

---

## Migration Strategy

### Phase 1: Setup (No Breaking Changes)
1. Create `life_core/` shared library
2. Build Fly.io server locally
3. Manually test simulation loop
4. **Don't deploy IC changes yet**

### Phase 2: Deploy Fly.io
1. Deploy Fly.io with manual initial state
2. Test WebSocket streaming
3. Verify simulation runs at 10 gen/sec
4. **Don't connect to IC yet**

### Phase 3: Add IC Event Log (Backwards Compatible)
1. Deploy updated IC canister with event log
2. Keep old `get_state()` for compatibility
3. Frontend still works with old API
4. **Can roll back if issues**

### Phase 4: Connect Fly.io to IC
1. Enable IC polling in Fly.io
2. Test event replay
3. Verify state consistency
4. **Both systems running in parallel**

### Phase 5: Update Frontend
1. Deploy frontend with WebSocket
2. Monitor for issues
3. **Can still fall back to old behavior**

### Phase 6: Cleanup (Optional)
1. Remove `get_state()` from IC
2. Remove cell storage from IC
3. IC is now pure event log

---

## State Persistence Strategy

### v1: Pure Event Replay (No Snapshots)

**IC Canister stores:**
1. All placement events (immutable log)
2. Player balances

**Fly.io startup sequence (Apply-Then-Forward):**
1. Fetch ALL events from IC (`get_all_events()`)
2. Create empty 512x512 grid
3. Apply all events to grid (treat as if they all happened at game start)
4. Calculate generations: `gens = (now - first_event_time) × 10 gen/sec`
5. Fast-forward simulation that many generations
6. Start normal operation

**During operation:**
- Every 2 seconds: Poll IC for new placement events
- Every 100ms: Run simulation step + broadcast WebSocket deltas

**Recovery Time Estimates:**
| Game Duration | Generations | Recovery Time |
|---------------|-------------|---------------|
| 1 hour | 36,000 | ~36 seconds |
| 12 hours | 432,000 | ~7 minutes |
| 1 day | 864,000 | ~14 minutes |
| 2 days | 1,728,000 | ~29 minutes |

**Benefits:**
- **Simple**: No snapshot management, no IC writes from Fly.io
- **Cheap**: IC is read-only after initial events
- **Verifiable**: Anyone can rebuild exact state from event log

**Limitations:**
- Recovery time grows linearly with game duration
- Games longer than ~2 days may have unacceptable recovery time

### v2 Enhancement: Add Snapshots (Future)

If games run longer than 2 days, add IC snapshot storage:
- Fly.io saves compressed snapshot to IC every 24 hours
- Requires Fly.io authentication to IC (principal allowlist)
- Reduces max recovery to ~6 minutes (1 hour of fast-forward)

---

## Testing Checklist

### IC Canister Tests
- [ ] place_cells() records event correctly
- [ ] Balance deduction works
- [ ] get_events_since() returns correct range
- [ ] get_all_events() returns complete history
- [ ] get_game_start_time() returns first event timestamp
- [ ] Event log persists across upgrades
- [ ] Multiple players can place cells

### Fly.io Server Tests
- [ ] Simulation runs at 10 gen/sec
- [ ] IC polling fetches events every 2s
- [ ] Events are applied correctly to grid
- [ ] WebSocket broadcasts deltas to all clients
- [ ] Apply-then-forward recovery works correctly
- [ ] Recovery completes in expected time (see estimates above)

### Frontend Tests
- [ ] WebSocket connects successfully
- [ ] Full state received on connect
- [ ] Delta updates apply correctly
- [ ] place_cells() works with IC
- [ ] Balance updates from IC
- [ ] Reconnect works after disconnect

### Integration Tests
- [ ] Place cells on IC → appears on Fly.io within 2s
- [ ] Multiple clients see same state
- [ ] State consistency under load
- [ ] Graceful degradation (IC down, Fly.io down)

---

## Cost Analysis

### Current Architecture (Event-Driven IC)
- **IC cost**: ~$10-50/year (minimal activity)
- **Problem**: Backend doesn't truly run 24/7

### Proposed Hybrid Architecture (v1)

| Component | Monthly | Yearly | Notes |
|-----------|---------|--------|-------|
| IC (event log only) | ~$0.17 | ~$2 | No simulation, minimal storage |
| Fly.io compute | $5.70 | $68 | shared-cpu-1x, 256MB |
| Fly.io bandwidth | ~$50 | ~$600 | WebSocket broadcasts |
| **Total** | **~$56** | **~$670** | |

### Comparison
- Pure IC 24/7: ~$36,500/year (not feasible)
- Hybrid v1: ~$670/year (98% cheaper than pure IC)
- Off-chain only: ~$68/year (but loses blockchain identity)

**Trade-off**: Pay ~$670/year to get true 24/7 blockchain-authenticated gameplay with on-chain event history.

---

## Timeline Estimate

- **Phase 1** (life_core): 1 day
- **Phase 2** (IC refactor): 1-2 days
- **Phase 3** (Fly.io server): 2-3 days
- **Phase 4** (Frontend): 1 day
- **Testing & deployment**: 1-2 days

**Total**: 6-9 days of development time

---

## Risk Mitigation

### Risk: Fly.io server goes down
**Mitigation**:
- Server rebuilds state from IC event log on restart (Apply-Then-Forward)
- Recovery time: ~14-29 min for 1-2 day old game
- Frontend shows "Simulation offline - rebuilding..." banner
- Users can still place cells (events queue on IC)
- **v2 enhancement**: Add IC snapshots to reduce recovery to ~6 min

### Risk: Game runs too long (recovery time grows)
**Mitigation**:
- v1 acceptable for games up to ~2 days (~29 min recovery)
- For longer games, implement v2 snapshots
- Alternative: periodic "game resets" as game mechanic

### Risk: IC becomes expensive again
**Mitigation**:
- Event log is read-only after write - minimal ongoing cost
- Can batch events or add rate limiting
- Can move to different IC subnet if needed

### Risk: WebSocket bandwidth costs spike
**Mitigation**:
- Already using delta compression
- Can add gzip compression
- Can reduce update frequency if needed
- Can implement viewport-based updates (only send visible cells)

### Risk: State desync between IC and Fly.io
**Mitigation**:
- Event log is immutable source of truth
- Can trigger full rebuild from IC events at any time
- Deterministic simulation ensures consistent results

---

## Design Decision Summary

Key decisions refined through discussion:

| Decision | Choice | Rationale |
|----------|--------|-----------|
| IC Role | Pure event log (no simulation) | Cheaper, simpler, IC can't keep up with 10 gen/sec anyway |
| Grid Storage | Fly.io only | IC doesn't run simulation, no need to store grid |
| Snapshots | None for v1 | Recovery time acceptable for 2-day games (~29 min) |
| Point System | Spend only | Earning points requires on-chain simulation; defer to token integration |
| Recovery Model | Apply-then-forward | Simpler than timestamp-interleaved replay, slight inaccuracy acceptable |
| Placement UX | Wait for WS confirmation | Show loading state until Fly.io broadcasts the update |
| Fly.io Domain | openhouse-life.fly.dev | Use default subdomain for v1 |

**v2 Enhancements** (if needed):
- Add IC snapshots for faster recovery
- Point earning via token integration
- Multiple Fly.io instances for high availability
