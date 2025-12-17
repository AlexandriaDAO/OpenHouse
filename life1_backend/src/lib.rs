use candid::{CandidType, Deserialize, Principal};
use ic_cdk::{query, update, init, post_upgrade, pre_upgrade};
use ic_stable_structures::{
    memory_manager::{MemoryId, MemoryManager, VirtualMemory},
    DefaultMemoryImpl, StableVec, Storable,
};
use std::borrow::Cow;
use std::cell::RefCell;

// Import from life_core (shared with Fly.io)
use life_core::{GRID_SIZE, GRID_MASK, MAX_PLAYERS, STARTING_BALANCE};

// ============================================================================
// CONSTANTS
// ============================================================================

// Memory IDs for stable storage
const MEMORY_ID_METADATA: MemoryId = MemoryId::new(21);
const MEMORY_ID_EVENT_LOG: MemoryId = MemoryId::new(50);

type Memory = VirtualMemory<DefaultMemoryImpl>;

// ============================================================================
// TYPES
// ============================================================================

/// External cell representation for Candid API (what frontend sees)
/// Kept for backwards compatibility with frontend
#[derive(CandidType, Deserialize, Clone, Copy, Debug, Default, PartialEq)]
pub struct CellView {
    pub owner: u8,
    pub points: u8,
    pub alive: bool,
}

#[derive(CandidType, Deserialize, Clone, Debug, PartialEq, Eq)]
pub enum GameStatus {
    Waiting,
    Active,
    Finished,
}

/// Game info for lobby listing
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct GameInfo {
    pub id: u64,
    pub name: String,
    pub status: GameStatus,
    pub player_count: u32,
    pub generation: u64,
}

/// Game room structure (for API compatibility)
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct GameRoom {
    pub id: u64,
    pub name: String,
    pub width: u32,
    pub height: u32,
    pub status: GameStatus,
    pub players: Vec<Principal>,
    pub generation: u64,
    pub is_running: bool,
}

/// Game config for create_game
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct GameConfig {
    pub width: u32,
    pub height: u32,
    pub max_players: u32,
    pub generations_limit: Option<u64>,
}

/// Lightweight metadata for sync checks
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct GameMetadata {
    pub width: u32,
    pub height: u32,
    pub generation: u64,
    pub players: Vec<Principal>,
    pub balances: Vec<u64>,
    pub is_running: bool,
    pub checkpoint_timestamp_ns: u64,
}

// ============================================================================
// EVENT LOG TYPES (New for Hybrid Architecture)
// ============================================================================

/// A cell placement event recorded on-chain
/// This is the immutable source of truth that Fly.io uses to replay state
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct PlacementEvent {
    pub event_id: u64,
    pub timestamp_ns: u64,
    pub player_principal: Principal,
    pub player_num: u8,
    pub cells: Vec<(u16, u16)>,  // (x, y) grid coordinates
    pub balance_after: u64,
}

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

    // Max size: ~8KB for events with up to 1000 cells
    const BOUND: ic_stable_structures::storable::Bound =
        ic_stable_structures::storable::Bound::Bounded {
            max_size: 8192,
            is_fixed_size: false,
        };
}

/// Result from place_cells with event info
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct PlaceCellsResult {
    pub placed_count: u32,
    pub event_id: u64,
    pub new_timestamp_ns: u64,
    pub new_balance: u64,  // Player's balance after placement
}

// ============================================================================
// INTERNAL METADATA
// ============================================================================

/// Metadata stored in stable memory
#[derive(CandidType, Deserialize, Clone, Debug)]
struct Metadata {
    generation: u64,  // Kept for compatibility, but not updated (Fly.io tracks this)
    players: Vec<Principal>,
    balances: Vec<u64>,
    is_running: bool,
    checkpoint_timestamp_ns: u64,
}

impl Default for Metadata {
    fn default() -> Self {
        Self {
            generation: 0,
            players: Vec::new(),
            balances: Vec::new(),
            is_running: true,
            checkpoint_timestamp_ns: 0,
        }
    }
}

impl Storable for Metadata {
    fn to_bytes(&self) -> Cow<'_, [u8]> {
        Cow::Owned(candid::encode_one(self).unwrap())
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        candid::decode_one(&bytes).unwrap_or_default()
    }

    // Max size: ~1KB for metadata with up to 10 players
    const BOUND: ic_stable_structures::storable::Bound =
        ic_stable_structures::storable::Bound::Bounded {
            max_size: 1024,
            is_fixed_size: false,
        };
}

// ============================================================================
// STABLE STATE
// ============================================================================

thread_local! {
    static MEMORY_MANAGER: RefCell<MemoryManager<DefaultMemoryImpl>> =
        RefCell::new(MemoryManager::init(DefaultMemoryImpl::default()));

    // Metadata stored as serialized blob
    static METADATA_STORE: RefCell<StableVec<u8, Memory>> = RefCell::new(
        StableVec::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MEMORY_ID_METADATA))
        ).unwrap()
    );

    // Event log - immutable append-only log of placement events
    static EVENT_LOG: RefCell<StableVec<PlacementEvent, Memory>> = RefCell::new(
        StableVec::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MEMORY_ID_EVENT_LOG))
        ).unwrap()
    );

    // Cached metadata in heap for fast access
    static CACHED_METADATA: RefCell<Metadata> = RefCell::new(Metadata::default());
}

// ============================================================================
// HELPERS
// ============================================================================

fn load_metadata() {
    METADATA_STORE.with(|meta| {
        let meta = meta.borrow();
        if meta.len() > 0 {
            let bytes: Vec<u8> = (0..meta.len()).filter_map(|i| meta.get(i)).collect();
            if let Ok(m) = candid::decode_one::<Metadata>(&bytes) {
                CACHED_METADATA.with(|c| *c.borrow_mut() = m);
            }
        }
    });
}

fn save_metadata() {
    CACHED_METADATA.with(|cached| {
        let m = cached.borrow();
        let bytes = candid::encode_one(&*m).unwrap();
        METADATA_STORE.with(|meta| {
            let meta = meta.borrow_mut();
            // Clear and rewrite
            while meta.len() > 0 {
                meta.pop();
            }
            for b in bytes {
                meta.push(&b).unwrap();
            }
        });
    });
}

// ============================================================================
// CANISTER LIFECYCLE
// ============================================================================

#[init]
fn init() {
    let now = ic_cdk::api::time();
    CACHED_METADATA.with(|m| {
        let mut m = m.borrow_mut();
        m.is_running = true;
        m.checkpoint_timestamp_ns = now;
    });

    ic_cdk::println!("Life Backend Initialized - Pure Event Log Mode (Hybrid Architecture v1)");
    ic_cdk::println!("Grid: {}x{}, Simulation runs on Fly.io", GRID_SIZE, GRID_SIZE);
}

#[pre_upgrade]
fn pre_upgrade() {
    save_metadata();
    ic_cdk::println!("Life Backend pre_upgrade: metadata saved");
}

#[post_upgrade]
fn post_upgrade() {
    load_metadata();

    let event_count = EVENT_LOG.with(|log| log.borrow().len());
    ic_cdk::println!("Life Backend post_upgrade: loaded {} events from log", event_count);
    ic_cdk::println!("Hybrid Architecture v1 - Pure event log mode");
}

// ============================================================================
// GAME MANAGEMENT (compatibility layer)
// ============================================================================

/// List available games (returns single global world)
#[query]
fn list_games() -> Vec<GameInfo> {
    CACHED_METADATA.with(|m| {
        let m = m.borrow();
        vec![GameInfo {
            id: 0,
            name: "Global World".to_string(),
            status: GameStatus::Active,
            player_count: m.players.len() as u32,
            generation: m.generation,
        }]
    })
}

/// Create game (returns existing world id)
#[update]
fn create_game(_name: String, _config: GameConfig) -> Result<u64, String> {
    Ok(0)
}

/// Join game (adds player to global world)
#[update]
fn join_game(_game_id: u64) -> Result<u8, String> {
    let caller = ic_cdk::api::msg_caller();

    if caller == Principal::anonymous() {
        return Err("Anonymous players not allowed. Please log in.".to_string());
    }

    CACHED_METADATA.with(|m| {
        let mut m = m.borrow_mut();

        // Check if already a player
        if let Some(pos) = m.players.iter().position(|p| *p == caller) {
            return Ok((pos + 1) as u8);
        }

        // Check max players
        if m.players.len() >= MAX_PLAYERS {
            return Err("Game full - max 10 players".to_string());
        }

        m.players.push(caller);
        m.balances.push(STARTING_BALANCE);
        Ok(m.players.len() as u8)
    })
}

/// Start game (no-op for global world)
#[update]
fn start_game(_game_id: u64) -> Result<(), String> {
    Ok(())
}

/// Get game room info
#[query]
fn get_game(_game_id: u64) -> Result<GameRoom, String> {
    CACHED_METADATA.with(|m| {
        let m = m.borrow();
        Ok(GameRoom {
            id: 0,
            name: "Global World".to_string(),
            width: GRID_SIZE as u32,
            height: GRID_SIZE as u32,
            status: GameStatus::Active,
            players: m.players.clone(),
            generation: m.generation,
            is_running: m.is_running,
        })
    })
}

// ============================================================================
// PLACE CELLS - Event Recording Only (No Simulation)
// ============================================================================

/// Place cells on the grid. Records event for Fly.io to apply.
/// In hybrid architecture: IC validates balance, records event. Fly.io runs simulation.
#[update]
fn place_cells(
    _game_id: u64,
    cells: Vec<(i32, i32)>,
    _expected_generation: u64  // Ignored - Fly.io handles generation tracking
) -> Result<PlaceCellsResult, String> {
    let caller = ic_cdk::api::msg_caller();

    if caller == Principal::anonymous() {
        return Err("Anonymous players not allowed. Please log in.".to_string());
    }

    if cells.is_empty() {
        return Err("No cells to place".to_string());
    }

    // Get or assign player number
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
    let balance_after = CACHED_METADATA.with(|m| {
        let mut m = m.borrow_mut();
        if let Some(balance) = m.balances.get_mut(player_idx) {
            *balance -= cost;
            *balance
        } else {
            0
        }
    });

    // Get next event ID
    let event_id = EVENT_LOG.with(|log| log.borrow().len());

    let now = ic_cdk::api::time();

    // Convert coordinates to u16 with wrapping
    let cells_u16: Vec<(u16, u16)> = cells.iter()
        .map(|(x, y)| {
            let col = ((*x & GRID_MASK as i32) + GRID_SIZE as i32) as u16 & GRID_MASK as u16;
            let row = ((*y & GRID_MASK as i32) + GRID_SIZE as i32) as u16 & GRID_MASK as u16;
            (col, row)
        })
        .collect();

    let placed_count = cells_u16.len() as u32;

    // Record event
    let event = PlacementEvent {
        event_id,
        timestamp_ns: now,
        player_principal: caller,
        player_num,
        cells: cells_u16,
        balance_after,
    };

    EVENT_LOG.with(|log| {
        log.borrow_mut().push(&event).map_err(|e| format!("Failed to store event: {:?}", e))
    })?;

    ic_cdk::println!(
        "Event {} recorded: player {} placed {} cells (balance: {})",
        event_id, player_num, placed_count, balance_after
    );

    Ok(PlaceCellsResult {
        placed_count,
        event_id,
        new_timestamp_ns: now,
        new_balance: balance_after,
    })
}

// ============================================================================
// EVENT LOG QUERIES (For Fly.io Polling)
// ============================================================================

/// Get events starting from a specific event ID
/// Fly.io calls this every 2 seconds to get new events
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

/// Get all events from the beginning
/// Fly.io calls this on startup to rebuild state
#[query]
fn get_all_events() -> Vec<PlacementEvent> {
    EVENT_LOG.with(|log| {
        let log = log.borrow();
        (0..log.len())
            .filter_map(|i| log.get(i))
            .collect()
    })
}

/// Get the ID of the next event (current log length)
#[query]
fn get_latest_event_id() -> u64 {
    EVENT_LOG.with(|log| log.borrow().len())
}

/// Get the timestamp of the first event (game start time)
#[query]
fn get_game_start_time() -> Option<u64> {
    EVENT_LOG.with(|log| {
        log.borrow().get(0).map(|e| e.timestamp_ns)
    })
}

/// Get event count
#[query]
fn get_event_count() -> u64 {
    EVENT_LOG.with(|log| log.borrow().len())
}

// ============================================================================
// QUERY METHODS
// ============================================================================

/// Get lightweight metadata only (no cells - grid is on Fly.io)
#[query]
fn get_metadata(_game_id: u64) -> Result<GameMetadata, String> {
    CACHED_METADATA.with(|m| {
        let m = m.borrow();
        Ok(GameMetadata {
            width: GRID_SIZE as u32,
            height: GRID_SIZE as u32,
            generation: m.generation,
            players: m.players.clone(),
            balances: m.balances.clone(),
            is_running: m.is_running,
            checkpoint_timestamp_ns: m.checkpoint_timestamp_ns,
        })
    })
}

/// Get player balance
#[query]
fn get_balance(_game_id: u64) -> Result<u64, String> {
    let caller = ic_cdk::api::msg_caller();
    CACHED_METADATA.with(|m| {
        let m = m.borrow();
        let player_idx = m.players
            .iter()
            .position(|p| *p == caller)
            .ok_or("Not a player")?;
        Ok(m.balances.get(player_idx).copied().unwrap_or(0))
    })
}

/// Simple greeting
#[query]
fn greet(name: String) -> String {
    let event_count = EVENT_LOG.with(|log| log.borrow().len());
    format!(
        "Hello, {}! Welcome to the {}x{} Game of Life (Hybrid Architecture). {} events recorded.",
        name, GRID_SIZE, GRID_SIZE, event_count
    )
}

// ============================================================================
// LEGACY COMPATIBILITY - get_state returns error (cells on Fly.io now)
// ============================================================================

/// Game state - DEPRECATED in hybrid architecture
/// Grid state is maintained by Fly.io, not IC canister
/// Use WebSocket connection to Fly.io for real-time grid state
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct GameState {
    pub cells: Vec<CellView>,
    pub width: u32,
    pub height: u32,
    pub generation: u64,
    pub players: Vec<Principal>,
    pub balances: Vec<u64>,
    pub is_running: bool,
    pub checkpoint_timestamp_ns: u64,
}

/// Get current game state - DEPRECATED
/// In hybrid architecture, grid state is on Fly.io
/// Returns empty cells with a note to use WebSocket
#[query]
fn get_state(_game_id: u64) -> Result<GameState, String> {
    // Return metadata with empty cells
    // Frontend should use WebSocket to Fly.io for grid state
    CACHED_METADATA.with(|m| {
        let m = m.borrow();
        Ok(GameState {
            cells: vec![],  // Grid is on Fly.io
            width: GRID_SIZE as u32,
            height: GRID_SIZE as u32,
            generation: m.generation,
            players: m.players.clone(),
            balances: m.balances.clone(),
            is_running: m.is_running,
            checkpoint_timestamp_ns: m.checkpoint_timestamp_ns,
        })
    })
}

// ============================================================================
// ADMIN / DEBUG
// ============================================================================

/// Manual tick - NO-OP in hybrid architecture (simulation on Fly.io)
#[update]
fn manual_tick() -> u64 {
    ic_cdk::println!("manual_tick called but simulation runs on Fly.io");
    CACHED_METADATA.with(|m| m.borrow().generation)
}

/// Get system info for debugging
#[query]
fn get_system_info() -> String {
    let event_count = EVENT_LOG.with(|log| log.borrow().len());
    let player_count = CACHED_METADATA.with(|m| m.borrow().players.len());

    format!(
        "Life Backend - Hybrid Architecture v1\n\
         Grid: {}x{}\n\
         Events: {}\n\
         Players: {}\n\
         Simulation: Fly.io (connect via WebSocket)\n\
         IC Role: Event log + balance tracking",
        GRID_SIZE, GRID_SIZE, event_count, player_count
    )
}
