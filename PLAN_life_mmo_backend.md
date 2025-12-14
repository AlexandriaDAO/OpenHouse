# AUTONOMOUS PR ORCHESTRATOR - DO NOT SKIP

**You are an autonomous PR orchestrator. Your ONLY job is to implement this plan and create a PR.**

## Isolation Check (RUN FIRST)
```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
if [ "$REPO_ROOT" = "/home/theseus/alexandria/openhouse" ]; then
    echo "FATAL: In main repo. Must be in worktree."
    echo "Worktree: /home/theseus/alexandria/openhouse-life"
    exit 1
fi
echo "In isolated worktree: $REPO_ROOT"
```

## Pre-Flight: Canister Controller Setup
**IMPORTANT**: Before deployment, ensure the daopad identity is a controller of `pijnb-7yaaa-aaaae-qgcuq-cai`.

Current situation:
- Canister: `pijnb-7yaaa-aaaae-qgcuq-cai` (life1)
- Current controller: `yog5q-6fxnl-g4zd4-s2nuh-f7fkw-ijb4e-z7dmo-jrarx-uoe2x-wx5sh-dae`
- Daopad principal: `67ktx-ln42b-uzmo5-bdiyn-gu62c-cd4h4-a5qt3-2w3rs-cixdl-iaso2-mqe`

The existing controller must run:
```bash
dfx canister --network ic update-settings pijnb-7yaaa-aaaae-qgcuq-cai --add-controller 67ktx-ln42b-uzmo5-bdiyn-gu62c-cd4h4-a5qt3-2w3rs-cixdl-iaso2-mqe
```

## Your Autonomous Workflow (NO QUESTIONS ALLOWED)
1. **Verify isolation** - You must be in worktree: `/home/theseus/alexandria/openhouse-life`
2. **Implement feature** - Follow plan sections below
3. **Build & Deploy to Mainnet**:
   ```bash
   # Add life1_backend to Cargo workspace
   # Build the new backend
   cargo build --target wasm32-unknown-unknown --release -p life1_backend

   # Deploy life1 canister to mainnet
   dfx deploy life1_backend --network ic

   # Build and deploy frontend
   cd openhouse_frontend && npm run build && cd ..
   ./deploy.sh --frontend-only
   ```

4. **Verify deployment**:
   ```bash
   # Check canister status
   dfx canister --network ic status life1_backend

   # Test the live site
   echo "Visit: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io/life"
   ```

5. **Create PR** (MANDATORY):
   ```bash
   git add .
   git commit -m "feat: Add Life MMO backend with polling-based multiplayer sync"
   git push -u origin feature/life-mmo-backend
   gh pr create --title "[Feature]: Life MMO Backend" --body "Implements PLAN_life_mmo_backend.md

   Deployed to mainnet:
   - Frontend: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io/life
   - Life1 Backend: pijnb-7yaaa-aaaae-qgcuq-cai"
   ```

6. **Iterate autonomously**:
   - FOR i=1 to 5:
     - Check review: `gh pr view [NUM] --json comments`
     - Count P0 issues
     - IF P0 > 0: Fix immediately, commit, push, sleep 300s, continue
     - IF P0 = 0: Report success, EXIT
   - After 5 iterations: Escalate to human

## CRITICAL RULES
- NO questions ("should I?", "want me to?", "is it done?")
- NO skipping PR creation - it's MANDATORY
- NO stopping after implementation - create PR immediately
- MAINNET DEPLOYMENT: All changes go directly to production
- After sleep: IMMEDIATELY continue (no pause)
- ONLY stop at: approved, max iterations, or error

**Branch:** `feature/life-mmo-backend`
**Worktree:** `/home/theseus/alexandria/openhouse-life`

---

# Implementation Plan: Life MMO Backend

## Overview

Create a backend canister for multiplayer Game of Life with:
- Multiple game rooms with fixed-size boards
- Deterministic simulation (same inputs = same outputs)
- Polling-based synchronization (1-2 second updates)
- Territory tracking for scoring

## Architecture

```
Frontend (real-time)          Backend (async state store)
┌─────────────────┐           ┌─────────────────────────┐
│ Local simulation │           │ life1_backend canister  │
│ at 30 gen/sec   │           │ pijnb-7yaaa-aaaae-qgcuq │
├─────────────────┤           ├─────────────────────────┤
│ - Render grid   │  poll 1s  │ - Game rooms            │
│ - Place patterns│◄─────────►│ - Placement log         │
│ - Track territory│           │ - Territory snapshots   │
│ - Run simulation │           │ - Player scores         │
└─────────────────┘           └─────────────────────────┘
```

## Current State

### Files to Create
```
openhouse-life/
├── life1_backend/
│   ├── Cargo.toml
│   ├── src/
│   │   └── lib.rs
│   └── life1_backend.did
├── dfx.json (MODIFY - add life1_backend)
├── Cargo.toml (MODIFY - add to workspace)
└── openhouse_frontend/
    └── src/pages/Life.tsx (MODIFY - connect to backend)
```

### Canister Info
- **Canister ID**: `pijnb-7yaaa-aaaae-qgcuq-cai`
- **Name**: `life1_backend`
- **Purpose**: Store game state, placements, sync multiplayer

---

## Backend Implementation

### File: `life1_backend/Cargo.toml` (NEW)
```toml
[package]
name = "life1_backend"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
candid = "0.10"
ic-cdk = "0.13"
ic-cdk-macros = "0.8"
serde = { version = "1.0", features = ["derive"] }
```

### File: `life1_backend/src/lib.rs` (NEW)
```rust
// PSEUDOCODE - Life MMO Backend

use candid::{CandidType, Deserialize, Principal};
use ic_cdk::{query, update, init};
use std::cell::RefCell;
use std::collections::HashMap;

// ============================================================================
// TYPES
// ============================================================================

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct Placement {
    pub player: Principal,
    pub pattern_name: String,  // "Glider", "Gosper Glider Gun", etc.
    pub x: i32,
    pub y: i32,
    pub generation: u64,       // When this was placed
    pub timestamp: u64,        // IC time
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct GameRoom {
    pub id: u64,
    pub name: String,
    pub width: u32,            // Grid width (fixed)
    pub height: u32,           // Grid height (fixed)
    pub created_at: u64,
    pub placements: Vec<Placement>,
    pub current_generation: u64,
    pub players: Vec<Principal>,
    pub territory: HashMap<Principal, u64>,  // Player -> squares owned
    pub status: GameStatus,
}

#[derive(CandidType, Deserialize, Clone, Debug, PartialEq)]
pub enum GameStatus {
    Waiting,    // Waiting for players
    Active,     // Game running
    Finished,   // Game ended
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct GameConfig {
    pub width: u32,
    pub height: u32,
    pub max_players: u8,
    pub generations_limit: Option<u64>,  // None = infinite
}

// ============================================================================
// STATE
// ============================================================================

thread_local! {
    static GAMES: RefCell<HashMap<u64, GameRoom>> = RefCell::new(HashMap::new());
    static NEXT_GAME_ID: RefCell<u64> = RefCell::new(1);
}

// ============================================================================
// GAME MANAGEMENT
// ============================================================================

#[init]
fn init() {
    ic_cdk::println!("Life1 Backend Initialized");
}

/// Create a new game room
#[update]
fn create_game(name: String, config: GameConfig) -> Result<u64, String> {
    // PSEUDOCODE:
    // 1. Validate config (width/height within limits)
    // 2. Generate new game ID
    // 3. Create GameRoom with empty state
    // 4. Add caller as first player
    // 5. Return game ID

    let game_id = NEXT_GAME_ID.with(|id| {
        let current = *id.borrow();
        *id.borrow_mut() = current + 1;
        current
    });

    let caller = ic_cdk::api::caller();
    let now = ic_cdk::api::time();

    let game = GameRoom {
        id: game_id,
        name,
        width: config.width.min(200),   // Max 200x200
        height: config.height.min(200),
        created_at: now,
        placements: Vec::new(),
        current_generation: 0,
        players: vec![caller],
        territory: HashMap::new(),
        status: GameStatus::Waiting,
    };

    GAMES.with(|games| {
        games.borrow_mut().insert(game_id, game);
    });

    Ok(game_id)
}

/// Join an existing game
#[update]
fn join_game(game_id: u64) -> Result<(), String> {
    // PSEUDOCODE:
    // 1. Check game exists
    // 2. Check game status is Waiting or Active
    // 3. Check player not already in game
    // 4. Add player to game

    let caller = ic_cdk::api::caller();

    GAMES.with(|games| {
        let mut games = games.borrow_mut();
        let game = games.get_mut(&game_id).ok_or("Game not found")?;

        if game.status == GameStatus::Finished {
            return Err("Game already finished".to_string());
        }

        if !game.players.contains(&caller) {
            game.players.push(caller);
        }

        Ok(())
    })
}

/// Start the game (creator only)
#[update]
fn start_game(game_id: u64) -> Result<(), String> {
    // PSEUDOCODE:
    // 1. Verify caller is game creator (first player)
    // 2. Change status to Active

    let caller = ic_cdk::api::caller();

    GAMES.with(|games| {
        let mut games = games.borrow_mut();
        let game = games.get_mut(&game_id).ok_or("Game not found")?;

        if game.players.first() != Some(&caller) {
            return Err("Only creator can start game".to_string());
        }

        game.status = GameStatus::Active;
        Ok(())
    })
}

// ============================================================================
// PLACEMENT (Core multiplayer sync)
// ============================================================================

/// Place a pattern on the board
#[update]
fn place_pattern(
    game_id: u64,
    pattern_name: String,
    x: i32,
    y: i32,
    at_generation: u64
) -> Result<u64, String> {
    // PSEUDOCODE:
    // 1. Verify game exists and is Active
    // 2. Verify caller is a player in this game
    // 3. Validate coordinates are within bounds
    // 4. Create Placement record
    // 5. Add to game's placement log
    // 6. Return placement index

    let caller = ic_cdk::api::caller();
    let now = ic_cdk::api::time();

    GAMES.with(|games| {
        let mut games = games.borrow_mut();
        let game = games.get_mut(&game_id).ok_or("Game not found")?;

        if game.status != GameStatus::Active {
            return Err("Game not active".to_string());
        }

        if !game.players.contains(&caller) {
            return Err("Not a player in this game".to_string());
        }

        let placement = Placement {
            player: caller,
            pattern_name,
            x,
            y,
            generation: at_generation,
            timestamp: now,
        };

        game.placements.push(placement);
        Ok(game.placements.len() as u64 - 1)
    })
}

/// Get placements since a given index (for polling)
#[query]
fn get_placements_since(game_id: u64, since_index: u64) -> Result<Vec<Placement>, String> {
    // PSEUDOCODE:
    // 1. Get game
    // 2. Return placements[since_index..]
    // Frontend calls this every 1-2 seconds to get new placements

    GAMES.with(|games| {
        let games = games.borrow();
        let game = games.get(&game_id).ok_or("Game not found")?;

        let since = since_index as usize;
        if since >= game.placements.len() {
            return Ok(Vec::new());
        }

        Ok(game.placements[since..].to_vec())
    })
}

/// Update current generation (called by any frontend to sync)
#[update]
fn report_generation(game_id: u64, generation: u64) -> Result<(), String> {
    // PSEUDOCODE:
    // Frontends report their current generation
    // We track the highest reported to help sync

    GAMES.with(|games| {
        let mut games = games.borrow_mut();
        let game = games.get_mut(&game_id).ok_or("Game not found")?;

        if generation > game.current_generation {
            game.current_generation = generation;
        }

        Ok(())
    })
}

// ============================================================================
// TERRITORY / SCORING
// ============================================================================

/// Submit territory snapshot (periodic, from authoritative frontend or consensus)
#[update]
fn submit_territory_snapshot(
    game_id: u64,
    territory: Vec<(Principal, u64)>  // (player, squares_owned)
) -> Result<(), String> {
    // PSEUDOCODE:
    // 1. Verify caller is a player
    // 2. Update territory counts
    // For now: trust any player's submission (can add consensus later)

    let caller = ic_cdk::api::caller();

    GAMES.with(|games| {
        let mut games = games.borrow_mut();
        let game = games.get_mut(&game_id).ok_or("Game not found")?;

        if !game.players.contains(&caller) {
            return Err("Not a player".to_string());
        }

        game.territory = territory.into_iter().collect();
        Ok(())
    })
}

/// Get current territory scores
#[query]
fn get_territory(game_id: u64) -> Result<Vec<(Principal, u64)>, String> {
    GAMES.with(|games| {
        let games = games.borrow();
        let game = games.get(&game_id).ok_or("Game not found")?;
        Ok(game.territory.clone().into_iter().collect())
    })
}

// ============================================================================
// QUERIES
// ============================================================================

/// List all active games
#[query]
fn list_games() -> Vec<(u64, String, GameStatus, u32)> {
    // Returns: (id, name, status, player_count)
    GAMES.with(|games| {
        games.borrow()
            .iter()
            .map(|(id, g)| (*id, g.name.clone(), g.status.clone(), g.players.len() as u32))
            .collect()
    })
}

/// Get full game state
#[query]
fn get_game(game_id: u64) -> Result<GameRoom, String> {
    GAMES.with(|games| {
        games.borrow()
            .get(&game_id)
            .cloned()
            .ok_or("Game not found".to_string())
    })
}

/// Get game info (lightweight)
#[query]
fn get_game_info(game_id: u64) -> Result<(String, GameStatus, u32, u64, u64), String> {
    // Returns: (name, status, player_count, placement_count, current_gen)
    GAMES.with(|games| {
        let games = games.borrow();
        let game = games.get(&game_id).ok_or("Game not found")?;
        Ok((
            game.name.clone(),
            game.status.clone(),
            game.players.len() as u32,
            game.placements.len() as u64,
            game.current_generation,
        ))
    })
}

#[query]
fn greet(name: String) -> String {
    format!("Hello, {}! Welcome to Life MMO.", name)
}
```

### File: `life1_backend/life1_backend.did` (NEW)
```candid
type Placement = record {
    player: principal;
    pattern_name: text;
    x: int32;
    y: int32;
    generation: nat64;
    timestamp: nat64;
};

type GameStatus = variant {
    Waiting;
    Active;
    Finished;
};

type GameConfig = record {
    width: nat32;
    height: nat32;
    max_players: nat8;
    generations_limit: opt nat64;
};

type GameRoom = record {
    id: nat64;
    name: text;
    width: nat32;
    height: nat32;
    created_at: nat64;
    placements: vec Placement;
    current_generation: nat64;
    players: vec principal;
    territory: vec record { principal; nat64 };
    status: GameStatus;
};

service : {
    // Game management
    create_game: (text, GameConfig) -> (variant { Ok: nat64; Err: text });
    join_game: (nat64) -> (variant { Ok; Err: text });
    start_game: (nat64) -> (variant { Ok; Err: text });

    // Placements (multiplayer sync)
    place_pattern: (nat64, text, int32, int32, nat64) -> (variant { Ok: nat64; Err: text });
    get_placements_since: (nat64, nat64) -> (variant { Ok: vec Placement; Err: text }) query;
    report_generation: (nat64, nat64) -> (variant { Ok; Err: text });

    // Territory / Scoring
    submit_territory_snapshot: (nat64, vec record { principal; nat64 }) -> (variant { Ok; Err: text });
    get_territory: (nat64) -> (variant { Ok: vec record { principal; nat64 }; Err: text }) query;

    // Queries
    list_games: () -> (vec record { nat64; text; GameStatus; nat32 }) query;
    get_game: (nat64) -> (variant { Ok: GameRoom; Err: text }) query;
    get_game_info: (nat64) -> (variant { Ok: record { text; GameStatus; nat32; nat64; nat64 }; Err: text }) query;
    greet: (text) -> (text) query;
}
```

---

## Configuration Changes

### File: `dfx.json` (MODIFY)
```json
// PSEUDOCODE: Add life1_backend to canisters object
{
  "canisters": {
    // ... existing canisters ...
    "life1_backend": {
      "type": "rust",
      "package": "life1_backend",
      "candid": "life1_backend/life1_backend.did",
      "specified_id": "pijnb-7yaaa-aaaae-qgcuq-cai"
    }
  }
}
```

### File: `Cargo.toml` (MODIFY - workspace root)
```toml
// PSEUDOCODE: Add life1_backend to workspace members
[workspace]
members = [
    "crash_backend",
    "plinko_backend",
    "dice_backend",
    "roulette_backend",
    "life1_backend"  // ADD THIS
]
```

---

## Frontend Integration

### File: `openhouse_frontend/src/pages/Life.tsx` (MODIFY)

Add the following to connect to the backend:

```typescript
// PSEUDOCODE: Add to Life.tsx

// 1. Import actor utilities
import { Actor, HttpAgent } from '@dfinity/agent';
import { idlFactory } from '../declarations/life1_backend';

// 2. Create actor
const LIFE1_CANISTER_ID = 'pijnb-7yaaa-aaaae-qgcuq-cai';

async function getLife1Actor() {
    const agent = new HttpAgent({ host: 'https://icp0.io' });
    return Actor.createActor(idlFactory, {
        agent,
        canisterId: LIFE1_CANISTER_ID,
    });
}

// 3. Add state for multiplayer
const [gameId, setGameId] = useState<bigint | null>(null);
const [lastPlacementIndex, setLastPlacementIndex] = useState<bigint>(0n);
const [isMultiplayer, setIsMultiplayer] = useState(false);

// 4. Poll for placements (when in multiplayer mode)
useEffect(() => {
    if (!isMultiplayer || !gameId) return;

    const pollInterval = setInterval(async () => {
        const actor = await getLife1Actor();
        const result = await actor.get_placements_since(gameId, lastPlacementIndex);

        if ('Ok' in result && result.Ok.length > 0) {
            // Apply new placements to local grid
            result.Ok.forEach(placement => {
                applyPlacement(placement);
            });
            setLastPlacementIndex(lastPlacementIndex + BigInt(result.Ok.length));
        }
    }, 1500); // Poll every 1.5 seconds

    return () => clearInterval(pollInterval);
}, [isMultiplayer, gameId, lastPlacementIndex]);

// 5. Send placement to backend
async function sendPlacement(patternName: string, x: number, y: number) {
    if (!isMultiplayer || !gameId) return;

    const actor = await getLife1Actor();
    await actor.place_pattern(gameId, patternName, x, y, BigInt(generation));
}

// 6. Modify handleCanvasClick to also send to backend
// In handleCanvasClick, after local placement:
if (isMultiplayer && gameId) {
    sendPlacement(selectedPattern.name, col, row);
}
```

---

## Deployment Notes

### Affected Components
- **NEW**: `life1_backend` canister (`pijnb-7yaaa-aaaae-qgcuq-cai`)
- **MODIFY**: Frontend (`pezw3-laaaa-aaaal-qssoa-cai`)

### Deployment Commands
```bash
# 1. Build life1_backend
cargo build --target wasm32-unknown-unknown --release -p life1_backend

# 2. Deploy life1_backend to mainnet
dfx deploy life1_backend --network ic

# 3. Generate declarations for frontend
dfx generate life1_backend

# 4. Copy declarations to frontend
cp -r src/declarations/life1_backend openhouse_frontend/src/declarations/

# 5. Build and deploy frontend
cd openhouse_frontend && npm run build && cd ..
./deploy.sh --frontend-only
```

---

## Testing (Manual)

After deployment, verify:

```bash
# Test greet endpoint
dfx canister --network ic call pijnb-7yaaa-aaaae-qgcuq-cai greet '("World")'

# Create a test game
dfx canister --network ic call pijnb-7yaaa-aaaae-qgcuq-cai create_game '("Test Game", record { width = 100; height = 100; max_players = 4; generations_limit = null })'

# List games
dfx canister --network ic call pijnb-7yaaa-aaaae-qgcuq-cai list_games
```

---

## Future Enhancements (Not in this PR)

1. **Betting integration** - Add ckUSDT deposits/payouts based on territory
2. **Consensus mechanism** - Multiple frontends agree on state
3. **Spectator mode** - Watch games without participating
4. **Persistent rankings** - Track player stats across games
5. **IC WebSockets** - Real-time push instead of polling
