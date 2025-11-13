# 🤖 AUTONOMOUS PR ORCHESTRATOR - DO NOT SKIP

**You are an autonomous PR orchestrator. Your ONLY job is to implement this plan and create a PR.**

## Isolation Check (RUN FIRST)
```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
if [ "$REPO_ROOT" = "/home/theseus/alexandria/openhouse" ]; then
    echo "❌ FATAL: In main repo. Must be in worktree."
    echo "Worktree: /home/theseus/alexandria/openhouse-unified-wallet"
    exit 1
fi
echo "✅ In isolated worktree: $REPO_ROOT"
```

## Your Autonomous Workflow (NO QUESTIONS ALLOWED)
1. **Verify isolation** - You must be in worktree: `/home/theseus/alexandria/openhouse-unified-wallet`
2. **Implement feature** - Follow plan sections below
3. **Build & Deploy to Mainnet**:
   - Backend changes:
     ```bash
     # Build all affected backends
     cargo build --target wasm32-unknown-unknown --release

     # Deploy to mainnet (deploys all canisters - simplest approach)
     ./deploy.sh
     ```
   - Frontend changes:
     ```bash
     cd openhouse_frontend
     npm run build
     cd ..
     ./deploy.sh
     ```
   - Both backend + frontend:
     ```bash
     cargo build --target wasm32-unknown-unknown --release
     cd openhouse_frontend && npm run build && cd ..
     ./deploy.sh
     ```

4. **Verify deployment**:
   ```bash
   # Check canister status
   dfx canister --network ic status casino_main
   dfx canister --network ic status crash_backend
   dfx canister --network ic status plinko_backend
   dfx canister --network ic status mines_backend
   dfx canister --network ic status dice_backend

   # Test the live site
   echo "Visit: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io"
   ```

5. **Create PR** (MANDATORY):
   ```bash
   git add .
   git commit -m "feat: implement unified wallet with internal accounting system"
   git push -u origin feature/unified-wallet
   gh pr create --title "[Feature]: Unified Wallet with Internal Accounting" --body "Implements UNIFIED_WALLET_IMPLEMENTATION_PLAN.md

Deployed to mainnet:
- Frontend: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io
- New canister: casino_main (unified wallet & internal accounting)
- Affected canisters: crash_backend, plinko_backend, mines_backend, dice_backend

## What Changed
- Created casino_main canister for centralized wallet management
- Implemented internal accounting (no ICP fees during gameplay)
- Updated all 4 game canisters to accept inter-canister calls
- Added deposit/withdraw UI components
- Implemented balance tracking and display
- Added security features (withdrawal limits, betting limits)
- Created audit functions for proof of reserves"
   ```

6. **Iterate autonomously**:
   - FOR i=1 to 5:
     - Check review: `gh pr view [NUM] --json comments`
     - Count P0 issues
     - IF P0 > 0: Fix immediately, commit, push, sleep 300s, continue
     - IF P0 = 0: Report success, EXIT
   - After 5 iterations: Escalate to human

## CRITICAL RULES
- ❌ NO questions ("should I?", "want me to?", "is it done?")
- ❌ NO skipping PR creation - it's MANDATORY
- ❌ NO stopping after implementation - create PR immediately
- ⚠️ MAINNET DEPLOYMENT: All changes go directly to production
- ✅ After sleep: IMMEDIATELY continue (no pause)
- ✅ ONLY stop at: approved, max iterations, or error

**Branch:** `feature/unified-wallet`
**Worktree:** `/home/theseus/alexandria/openhouse-unified-wallet`

---

# OpenHouse Casino Unified Wallet Implementation Plan

## Executive Summary

This plan implements a unified wallet system with internal accounting for OpenHouse Casino. Users deposit ICP once into a central `casino_main` canister, then play any game without additional on-chain transactions. This eliminates ICP transaction fees during gameplay while maintaining transparency through on-chain deposits/withdrawals.

## Task Classification

**NEW FEATURE** - Additive approach. We are building new functionality alongside existing game infrastructure.

---

## 1. Current State Documentation

### Existing File Structure
```
openhouse/
├── crash_backend/
│   ├── src/lib.rs              (291 lines - game logic)
│   ├── crash_backend.did       (Candid interface)
│   └── Cargo.toml
├── plinko_backend/
│   ├── src/lib.rs              (317 lines - game logic)
│   ├── plinko_backend.did
│   └── Cargo.toml
├── mines_backend/
│   ├── src/lib.rs              (166 lines - game logic)
│   ├── mines_backend.did
│   └── Cargo.toml
├── dice_backend/
│   ├── src/lib.rs              (651 lines - game logic with VRF)
│   ├── dice_backend.did
│   └── Cargo.toml
├── openhouse_frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── providers/
│   │   │   ├── AuthProvider.tsx
│   │   │   ├── ActorProvider.tsx
│   │   │   └── BalanceProvider.tsx
│   │   ├── pages/
│   │   │   ├── Home.tsx
│   │   │   ├── Crash.tsx
│   │   │   ├── Plinko.tsx
│   │   │   ├── Mines.tsx
│   │   │   └── Dice.tsx
│   │   └── components/
│   │       ├── Layout.tsx
│   │       ├── GameCard.tsx
│   │       └── game-ui/ (shared components)
│   ├── package.json
│   └── dist/
├── dfx.json                    (5 canisters: 4 games + frontend)
├── Cargo.toml                  (workspace)
└── deploy.sh                   (deployment script)
```

### Current Game Backend Architecture

All 4 game backends currently:
- Accept bets directly from players
- Have TODOs for ICP transfers (not implemented)
- Track game stats internally
- Use IC VRF for randomness
- Store game history in StableBTreeMap
- Have no inter-canister communication

**Crash Backend** (`crash_backend/src/lib.rs`):
- Lines 14-18: MIN_BET, MAX_BET, HOUSE_EDGE constants
- Lines 187-219: `place_bet()` function (TODO on line 212)
- Lines 221-240: `cash_out()` function (TODO on line 232)

**Plinko Backend** (`plinko_backend/src/lib.rs`):
- Lines 14-15: MIN_BET, MAX_BET constants
- Lines 224-278: `play_plinko()` function (TODO on line 275)

**Mines Backend** (`mines_backend/src/lib.rs`):
- Lines 14-16: MIN_BET, MAX_BET constants
- Lines 84-140: `start_game()` function (no payout logic yet)

**Dice Backend** (`dice_backend/src/lib.rs`):
- Lines 92-95: MIN_BET, MAX_BET, HOUSE_EDGE constants
- Lines 320-422: `play_dice()` function (TODO on lines 417-419)

### Current Frontend Architecture

- **AuthProvider**: Manages Internet Identity authentication
- **ActorProvider**: Creates canister actors for each game
- **BalanceProvider**: Currently tracks ICP balance (will be replaced)
- Each game page directly calls game backend methods
- No centralized wallet UI

### What's Missing for Unified Wallet

1. **No casino_main canister** - Need central wallet management
2. **No internal balance tracking** - Need HashMap<Principal, u64>
3. **No inter-canister calls** - Games don't communicate with casino_main
4. **No deposit/withdraw functions** - No ICP transfer logic
5. **No unified balance UI** - Frontend doesn't show internal balance
6. **No game authorization** - Games accept bets from anyone
7. **No audit functions** - No proof of reserves

---

## 2. Architecture Design

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      User (Principal)                        │
└────────────┬─────────────────────────────────┬──────────────┘
             │                                 │
        Deposit ICP                       Withdraw ICP
             │                                 │
             ▼                                 ▼
┌─────────────────────────────────────────────────────────────┐
│                     casino_main                              │
│  - User balance tracking (HashMap<Principal, u64>)           │
│  - Deposit ICP (ICRC-1 transfer)                            │
│  - Withdraw ICP (ICRC-1 transfer)                           │
│  - Inter-canister calls to games                            │
│  - Audit functions (proof of reserves)                      │
│  - Security: withdrawal limits, betting limits              │
└────────────┬────────┬────────┬────────┬─────────────────────┘
             │        │        │        │
         Play│Game    │        │        │
             │        │        │        │
    ┌────────▼───┐ ┌─▼────────▼───┐ ┌──▼──────────┐
    │  crash     │ │  plinko      │ │  mines      │ etc...
    │  backend   │ │  backend     │ │  backend    │
    └────────────┘ └──────────────┘ └─────────────┘
       House: 100 ICP  House: 100 ICP  House: 100 ICP
```

### Data Flow

1. **Deposit**: User → ICP Ledger → casino_main (balance++)
2. **Play Game**: User → casino_main → Game Backend → Result → casino_main (update balance)
3. **Withdraw**: User → casino_main → ICP Ledger → User (balance--)

### Security Model

- **Double-spend prevention**: Lock balance during game play
- **Withdrawal limits**: Max withdrawal per transaction
- **Betting limits**: Min/max bet enforced by casino_main
- **House bankroll protection**: Each game maintains 100 ICP reserve
- **Audit trail**: All deposits/withdrawals logged on-chain

---

## 3. Implementation Plan with Pseudocode

### 3.1 Create casino_main Canister

#### File: `casino_main/Cargo.toml` (NEW)

```toml
[package]
name = "casino_main"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
candid = "0.10"
ic-cdk = "0.13"
ic-stable-structures = "0.6"
serde = "1.0"
serde_json = "1.0"
sha2 = "0.10"
```

#### File: `casino_main/src/lib.rs` (NEW)

```rust
// PSEUDOCODE for casino_main canister

use candid::{CandidType, Deserialize, Principal, Nat};
use ic_cdk::api::call::CallResult;
use ic_cdk::{init, post_upgrade, pre_upgrade, query, update, caller};
use ic_stable_structures::memory_manager::{MemoryId, MemoryManager, VirtualMemory};
use ic_stable_structures::{DefaultMemoryImpl, StableBTreeMap, StableCell, Storable};
use serde::Serialize;
use std::borrow::Cow;
use std::cell::RefCell;

type Memory = VirtualMemory<DefaultMemoryImpl>;

// ============================================================================
// CONSTANTS
// ============================================================================

const ICP_LEDGER_CANISTER: &str = "ryjl3-tyaaa-aaaaa-aaaba-cai"; // ICP Ledger
const MIN_DEPOSIT: u64 = 100_000_000; // 1 ICP
const MIN_WITHDRAWAL: u64 = 100_000_000; // 1 ICP
const MAX_WITHDRAWAL: u64 = 100_000_000_000; // 1000 ICP per withdrawal
const MIN_BET: u64 = 100_000_000; // 1 ICP
const MAX_BET: u64 = 10_000_000_000; // 100 ICP

// Game canister IDs (from dfx.json)
const CRASH_BACKEND: &str = "fws6k-tyaaa-aaaap-qqc7q-cai";
const PLINKO_BACKEND: &str = "weupr-2qaaa-aaaap-abl3q-cai";
const MINES_BACKEND: &str = "wvrcw-3aaaa-aaaah-arm4a-cai";
const DICE_BACKEND: &str = "whchi-hyaaa-aaaao-a4ruq-cai";

// ============================================================================
// DATA STRUCTURES
// ============================================================================

#[derive(CandidType, Deserialize, Serialize, Clone, Debug)]
pub struct UserAccount {
    pub principal: Principal,
    pub balance: u64,           // Internal balance in e8s
    pub total_deposited: u64,
    pub total_withdrawn: u64,
    pub total_wagered: u64,
    pub is_locked: bool,        // Prevent double-spending during game
    pub created_at: u64,
    pub last_activity: u64,
}

#[derive(CandidType, Deserialize, Serialize, Clone, Debug)]
pub struct DepositRecord {
    pub user: Principal,
    pub amount: u64,
    pub timestamp: u64,
    pub block_index: u64,       // ICP ledger block for verification
}

#[derive(CandidType, Deserialize, Serialize, Clone, Debug)]
pub struct WithdrawalRecord {
    pub user: Principal,
    pub amount: u64,
    pub timestamp: u64,
    pub block_index: u64,
}

#[derive(CandidType, Deserialize, Serialize, Clone, Debug)]
pub struct GameTransaction {
    pub user: Principal,
    pub game: String,           // "crash", "plinko", "mines", "dice"
    pub bet_amount: u64,
    pub payout: u64,
    pub profit: i64,            // Can be negative
    pub timestamp: u64,
}

#[derive(CandidType, Deserialize, Clone, Default)]
pub struct CasinoStats {
    pub total_users: u64,
    pub total_deposits: u64,
    pub total_withdrawals: u64,
    pub total_volume: u64,      // Total wagered across all games
    pub house_profit: i64,
}

// Storable implementations
impl Storable for UserAccount {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(serde_json::to_vec(self).unwrap())
    }
    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        serde_json::from_slice(&bytes).unwrap()
    }
    const BOUND: ic_stable_structures::storable::Bound = 
        ic_stable_structures::storable::Bound::Unbounded;
}

impl Storable for DepositRecord {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(serde_json::to_vec(self).unwrap())
    }
    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        serde_json::from_slice(&bytes).unwrap()
    }
    const BOUND: ic_stable_structures::storable::Bound = 
        ic_stable_structures::storable::Bound::Unbounded;
}

impl Storable for WithdrawalRecord {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(serde_json::to_vec(self).unwrap())
    }
    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        serde_json::from_slice(&bytes).unwrap()
    }
    const BOUND: ic_stable_structures::storable::Bound = 
        ic_stable_structures::storable::Bound::Unbounded;
}

impl Storable for GameTransaction {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(serde_json::to_vec(self).unwrap())
    }
    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        serde_json::from_slice(&bytes).unwrap()
    }
    const BOUND: ic_stable_structures::storable::Bound = 
        ic_stable_structures::storable::Bound::Unbounded;
}

// ============================================================================
// STABLE STORAGE
// ============================================================================

thread_local! {
    static MEMORY_MANAGER: RefCell<MemoryManager<DefaultMemoryImpl>> =
        RefCell::new(MemoryManager::init(DefaultMemoryImpl::default()));

    // User accounts: Principal -> UserAccount
    static USER_ACCOUNTS: RefCell<StableBTreeMap<Principal, UserAccount, Memory>> = 
        RefCell::new(StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(0)))
        ));

    // Deposit history: u64 ID -> DepositRecord
    static DEPOSITS: RefCell<StableBTreeMap<u64, DepositRecord, Memory>> = 
        RefCell::new(StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(1)))
        ));

    // Withdrawal history: u64 ID -> WithdrawalRecord
    static WITHDRAWALS: RefCell<StableBTreeMap<u64, WithdrawalRecord, Memory>> = 
        RefCell::new(StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(2)))
        ));

    // Game transaction history: u64 ID -> GameTransaction
    static GAME_TRANSACTIONS: RefCell<StableBTreeMap<u64, GameTransaction, Memory>> = 
        RefCell::new(StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(3)))
        ));

    // Counters
    static NEXT_DEPOSIT_ID: RefCell<u64> = RefCell::new(0);
    static NEXT_WITHDRAWAL_ID: RefCell<u64> = RefCell::new(0);
    static NEXT_TRANSACTION_ID: RefCell<u64> = RefCell::new(0);

    // Global stats
    static CASINO_STATS: RefCell<CasinoStats> = RefCell::new(CasinoStats::default());
}

// ============================================================================
// LIFECYCLE HOOKS
// ============================================================================

#[init]
fn init() {
    ic_cdk::println!("Casino Main Canister Initialized - Unified Wallet");
}

#[pre_upgrade]
fn pre_upgrade() {
    // State is already in stable memory via StableBTreeMap
}

#[post_upgrade]
fn post_upgrade() {
    // State is restored from stable memory automatically
}

// ============================================================================
// USER ACCOUNT MANAGEMENT
// ============================================================================

// Get or create user account
fn get_or_create_account(principal: Principal) -> UserAccount {
    USER_ACCOUNTS.with(|accounts| {
        let mut accounts = accounts.borrow_mut();
        
        if let Some(account) = accounts.get(&principal) {
            return account;
        }
        
        // Create new account
        let now = ic_cdk::api::time();
        let new_account = UserAccount {
            principal,
            balance: 0,
            total_deposited: 0,
            total_withdrawn: 0,
            total_wagered: 0,
            is_locked: false,
            created_at: now,
            last_activity: now,
        };
        
        accounts.insert(principal, new_account.clone());
        
        // Update stats
        CASINO_STATS.with(|stats| {
            let mut stats = stats.borrow_mut();
            stats.total_users += 1;
        });
        
        new_account
    })
}

// ============================================================================
// DEPOSIT FUNCTIONS
// ============================================================================

#[update]
async fn deposit(amount: u64) -> Result<u64, String> {
    // STEP 1: Validate amount
    if amount < MIN_DEPOSIT {
        return Err(format!("Minimum deposit is {} ICP", MIN_DEPOSIT / 100_000_000));
    }
    
    let caller = caller();
    let now = ic_cdk::api::time();
    
    // STEP 2: Transfer ICP from user to this canister using ICRC-1
    // Build ICRC-1 transfer arguments
    let transfer_args = TransferArgs {
        from_subaccount: None,
        to: Account {
            owner: ic_cdk::id(), // This canister
            subaccount: None,
        },
        amount: Nat::from(amount),
        fee: None, // Let ledger calculate
        memo: None,
        created_at_time: Some(now),
    };
    
    // Call ICP ledger canister
    let ledger = Principal::from_text(ICP_LEDGER_CANISTER).unwrap();
    let result: CallResult<(Result<Nat, TransferError>,)> = 
        ic_cdk::call(ledger, "icrc1_transfer", (transfer_args,)).await;
    
    match result {
        Ok((Ok(block_index),)) => {
            // STEP 3: Update user account
            let mut account = get_or_create_account(caller);
            account.balance += amount;
            account.total_deposited += amount;
            account.last_activity = now;
            
            USER_ACCOUNTS.with(|accounts| {
                accounts.borrow_mut().insert(caller, account);
            });
            
            // STEP 4: Record deposit
            let deposit_id = NEXT_DEPOSIT_ID.with(|id| {
                let current = *id.borrow();
                *id.borrow_mut() = current + 1;
                current
            });
            
            let record = DepositRecord {
                user: caller,
                amount,
                timestamp: now,
                block_index: block_index.0.to_u64().unwrap_or(0),
            };
            
            DEPOSITS.with(|deposits| {
                deposits.borrow_mut().insert(deposit_id, record);
            });
            
            // STEP 5: Update stats
            CASINO_STATS.with(|stats| {
                let mut stats = stats.borrow_mut();
                stats.total_deposits += amount;
            });
            
            Ok(amount)
        }
        Ok((Err(transfer_error),)) => {
            Err(format!("ICP transfer failed: {:?}", transfer_error))
        }
        Err((code, msg)) => {
            Err(format!("Ledger call failed: {:?} - {}", code, msg))
        }
    }
}

// ============================================================================
// WITHDRAWAL FUNCTIONS
// ============================================================================

#[update]
async fn withdraw(amount: u64) -> Result<u64, String> {
    // STEP 1: Validate amount
    if amount < MIN_WITHDRAWAL {
        return Err(format!("Minimum withdrawal is {} ICP", MIN_WITHDRAWAL / 100_000_000));
    }
    
    if amount > MAX_WITHDRAWAL {
        return Err(format!("Maximum withdrawal is {} ICP per transaction", MAX_WITHDRAWAL / 100_000_000));
    }
    
    let caller = caller();
    let now = ic_cdk::api::time();
    
    // STEP 2: Check user balance
    let mut account = USER_ACCOUNTS.with(|accounts| {
        accounts.borrow().get(&caller).ok_or("Account not found".to_string())
    })?;
    
    if account.is_locked {
        return Err("Account is locked during active game".to_string());
    }
    
    if account.balance < amount {
        return Err(format!("Insufficient balance. You have {} e8s, trying to withdraw {} e8s", 
            account.balance, amount));
    }
    
    // STEP 3: Lock account and deduct balance (optimistic)
    account.balance -= amount;
    account.total_withdrawn += amount;
    account.last_activity = now;
    
    USER_ACCOUNTS.with(|accounts| {
        accounts.borrow_mut().insert(caller, account.clone());
    });
    
    // STEP 4: Transfer ICP from this canister to user using ICRC-1
    let transfer_args = TransferArgs {
        from_subaccount: None,
        to: Account {
            owner: caller,
            subaccount: None,
        },
        amount: Nat::from(amount),
        fee: None,
        memo: None,
        created_at_time: Some(now),
    };
    
    let ledger = Principal::from_text(ICP_LEDGER_CANISTER).unwrap();
    let result: CallResult<(Result<Nat, TransferError>,)> = 
        ic_cdk::call(ledger, "icrc1_transfer", (transfer_args,)).await;
    
    match result {
        Ok((Ok(block_index),)) => {
            // STEP 5: Record withdrawal
            let withdrawal_id = NEXT_WITHDRAWAL_ID.with(|id| {
                let current = *id.borrow();
                *id.borrow_mut() = current + 1;
                current
            });
            
            let record = WithdrawalRecord {
                user: caller,
                amount,
                timestamp: now,
                block_index: block_index.0.to_u64().unwrap_or(0),
            };
            
            WITHDRAWALS.with(|withdrawals| {
                withdrawals.borrow_mut().insert(withdrawal_id, record);
            });
            
            // STEP 6: Update stats
            CASINO_STATS.with(|stats| {
                let mut stats = stats.borrow_mut();
                stats.total_withdrawals += amount;
            });
            
            Ok(amount)
        }
        Ok((Err(transfer_error),)) => {
            // ROLLBACK: Restore user balance
            account.balance += amount;
            account.total_withdrawn -= amount;
            USER_ACCOUNTS.with(|accounts| {
                accounts.borrow_mut().insert(caller, account);
            });
            
            Err(format!("ICP transfer failed: {:?}", transfer_error))
        }
        Err((code, msg)) => {
            // ROLLBACK: Restore user balance
            account.balance += amount;
            account.total_withdrawn -= amount;
            USER_ACCOUNTS.with(|accounts| {
                accounts.borrow_mut().insert(caller, account);
            });
            
            Err(format!("Ledger call failed: {:?} - {}", code, msg))
        }
    }
}

// ============================================================================
// GAME PLAY FUNCTIONS (Inter-canister calls)
// ============================================================================

#[update]
async fn play_crash(bet_amount: u64) -> Result<CrashResult, String> {
    let caller = caller();
    
    // STEP 1: Validate bet
    if bet_amount < MIN_BET {
        return Err(format!("Minimum bet is {} ICP", MIN_BET / 100_000_000));
    }
    if bet_amount > MAX_BET {
        return Err(format!("Maximum bet is {} ICP", MAX_BET / 100_000_000));
    }
    
    // STEP 2: Check and lock user balance
    let mut account = get_or_create_account(caller);
    if account.is_locked {
        return Err("Account locked during active game".to_string());
    }
    if account.balance < bet_amount {
        return Err("Insufficient balance".to_string());
    }
    
    account.balance -= bet_amount;
    account.is_locked = true;
    USER_ACCOUNTS.with(|accounts| {
        accounts.borrow_mut().insert(caller, account.clone());
    });
    
    // STEP 3: Call crash backend
    let crash_canister = Principal::from_text(CRASH_BACKEND).unwrap();
    let result: CallResult<(Result<CrashResult, String>,)> = 
        ic_cdk::call(crash_canister, "play_from_casino", (caller, bet_amount)).await;
    
    match result {
        Ok((Ok(game_result),)) => {
            // STEP 4: Update balance with payout
            account.balance += game_result.payout;
            account.total_wagered += bet_amount;
            account.is_locked = false;
            account.last_activity = ic_cdk::api::time();
            
            USER_ACCOUNTS.with(|accounts| {
                accounts.borrow_mut().insert(caller, account);
            });
            
            // STEP 5: Record transaction
            record_game_transaction(caller, "crash", bet_amount, game_result.payout);
            
            Ok(game_result)
        }
        Ok((Err(error),)) => {
            // ROLLBACK: Restore balance and unlock
            account.balance += bet_amount;
            account.is_locked = false;
            USER_ACCOUNTS.with(|accounts| {
                accounts.borrow_mut().insert(caller, account);
            });
            
            Err(error)
        }
        Err((code, msg)) => {
            // ROLLBACK: Restore balance and unlock
            account.balance += bet_amount;
            account.is_locked = false;
            USER_ACCOUNTS.with(|accounts| {
                accounts.borrow_mut().insert(caller, account);
            });
            
            Err(format!("Game canister call failed: {:?} - {}", code, msg))
        }
    }
}

// Similar functions for play_plinko, play_mines, play_dice...
// (Pseudocode - follow same pattern as play_crash)

#[update]
async fn play_plinko(bet_amount: u64, rows: u8, risk: RiskLevel) -> Result<PlinkoResult, String> {
    // Same pattern as play_crash:
    // 1. Validate bet
    // 2. Check and lock balance
    // 3. Call plinko backend
    // 4. Update balance with payout
    // 5. Record transaction
    // Handle rollback on error
}

#[update]
async fn play_mines(bet_amount: u64, num_mines: u8) -> Result<MinesResult, String> {
    // Same pattern...
}

#[update]
async fn play_dice(bet_amount: u64, target_number: u8, direction: RollDirection, client_seed: String) -> Result<DiceResult, String> {
    // Same pattern...
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

fn record_game_transaction(user: Principal, game: &str, bet: u64, payout: u64) {
    let transaction_id = NEXT_TRANSACTION_ID.with(|id| {
        let current = *id.borrow();
        *id.borrow_mut() = current + 1;
        current
    });
    
    let transaction = GameTransaction {
        user,
        game: game.to_string(),
        bet_amount: bet,
        payout,
        profit: (payout as i64) - (bet as i64),
        timestamp: ic_cdk::api::time(),
    };
    
    GAME_TRANSACTIONS.with(|txs| {
        txs.borrow_mut().insert(transaction_id, transaction);
    });
    
    // Update global stats
    CASINO_STATS.with(|stats| {
        let mut stats = stats.borrow_mut();
        stats.total_volume += bet;
        stats.house_profit += (bet as i64) - (payout as i64);
    });
}

// ============================================================================
// QUERY FUNCTIONS
// ============================================================================

#[query]
fn get_balance() -> Result<u64, String> {
    let caller = caller();
    USER_ACCOUNTS.with(|accounts| {
        accounts.borrow()
            .get(&caller)
            .map(|acc| acc.balance)
            .ok_or("Account not found".to_string())
    })
}

#[query]
fn get_account_info() -> Result<UserAccount, String> {
    let caller = caller();
    USER_ACCOUNTS.with(|accounts| {
        accounts.borrow()
            .get(&caller)
            .ok_or("Account not found".to_string())
    })
}

#[query]
fn get_deposit_history(limit: u32) -> Vec<DepositRecord> {
    let caller = caller();
    DEPOSITS.with(|deposits| {
        deposits.borrow()
            .iter()
            .rev()
            .filter(|(_, record)| record.user == caller)
            .take(limit as usize)
            .map(|(_, record)| record)
            .collect()
    })
}

#[query]
fn get_withdrawal_history(limit: u32) -> Vec<WithdrawalRecord> {
    let caller = caller();
    WITHDRAWALS.with(|withdrawals| {
        withdrawals.borrow()
            .iter()
            .rev()
            .filter(|(_, record)| record.user == caller)
            .take(limit as usize)
            .map(|(_, record)| record)
            .collect()
    })
}

#[query]
fn get_game_history(limit: u32) -> Vec<GameTransaction> {
    let caller = caller();
    GAME_TRANSACTIONS.with(|txs| {
        txs.borrow()
            .iter()
            .rev()
            .filter(|(_, tx)| tx.user == caller)
            .take(limit as usize)
            .map(|(_, tx)| tx)
            .collect()
    })
}

#[query]
fn get_casino_stats() -> CasinoStats {
    CASINO_STATS.with(|stats| stats.borrow().clone())
}

// ============================================================================
// AUDIT FUNCTIONS (Proof of Reserves)
// ============================================================================

#[query]
fn get_total_user_balances() -> u64 {
    USER_ACCOUNTS.with(|accounts| {
        accounts.borrow()
            .iter()
            .map(|(_, account)| account.balance)
            .sum()
    })
}

#[query]
async fn get_canister_icp_balance() -> Result<u64, String> {
    // Query ICP ledger for this canister's balance
    let ledger = Principal::from_text(ICP_LEDGER_CANISTER).unwrap();
    let account = Account {
        owner: ic_cdk::id(),
        subaccount: None,
    };
    
    let result: CallResult<(Nat,)> = 
        ic_cdk::call(ledger, "icrc1_balance_of", (account,)).await;
    
    match result {
        Ok((balance,)) => Ok(balance.0.to_u64().unwrap_or(0)),
        Err((code, msg)) => Err(format!("Failed to get balance: {:?} - {}", code, msg))
    }
}

#[query]
fn verify_reserves() -> ReservesReport {
    let total_user_balances = get_total_user_balances();
    // Note: get_canister_icp_balance requires async, so this is approximation
    // Full verification requires update call
    
    ReservesReport {
        total_user_balances,
        is_solvent: true, // Must verify async
        timestamp: ic_cdk::api::time(),
    }
}

// ============================================================================
// ADMIN FUNCTIONS
// ============================================================================

// TODO: Add controller-only functions
// - Pause deposits/withdrawals
// - Emergency withdrawal of funds
// - Update game canister IDs
// - Adjust limits

#[query]
fn greet(name: String) -> String {
    format!("Welcome to OpenHouse Casino Main Wallet, {}!", name)
}
```

#### File: `casino_main/casino_main.did` (NEW)

```candid
// PSEUDOCODE Candid interface for casino_main

type UserAccount = record {
    principal: principal;
    balance: nat64;
    total_deposited: nat64;
    total_withdrawn: nat64;
    total_wagered: nat64;
    is_locked: bool;
    created_at: nat64;
    last_activity: nat64;
};

type DepositRecord = record {
    user: principal;
    amount: nat64;
    timestamp: nat64;
    block_index: nat64;
};

type WithdrawalRecord = record {
    user: principal;
    amount: nat64;
    timestamp: nat64;
    block_index: nat64;
};

type GameTransaction = record {
    user: principal;
    game: text;
    bet_amount: nat64;
    payout: nat64;
    profit: int64;
    timestamp: nat64;
};

type CasinoStats = record {
    total_users: nat64;
    total_deposits: nat64;
    total_withdrawals: nat64;
    total_volume: nat64;
    house_profit: int64;
};

type ReservesReport = record {
    total_user_balances: nat64;
    is_solvent: bool;
    timestamp: nat64;
};

// Result types from game canisters (must match their interfaces)
type CrashResult = record {
    // Define based on crash backend
};

type PlinkoResult = record {
    // Define based on plinko backend
};

type MinesResult = record {
    // Define based on mines backend
};

type DiceResult = record {
    // Define based on dice backend
};

type RiskLevel = variant { Low; Medium; High };
type RollDirection = variant { Over; Under };

service : {
    // Deposit & Withdrawal
    "deposit": (nat64) -> (variant { Ok: nat64; Err: text });
    "withdraw": (nat64) -> (variant { Ok: nat64; Err: text });
    
    // Game Play (Inter-canister)
    "play_crash": (nat64) -> (variant { Ok: CrashResult; Err: text });
    "play_plinko": (nat64, nat8, RiskLevel) -> (variant { Ok: PlinkoResult; Err: text });
    "play_mines": (nat64, nat8) -> (variant { Ok: MinesResult; Err: text });
    "play_dice": (nat64, nat8, RollDirection, text) -> (variant { Ok: DiceResult; Err: text });
    
    // Query Functions
    "get_balance": () -> (variant { Ok: nat64; Err: text }) query;
    "get_account_info": () -> (variant { Ok: UserAccount; Err: text }) query;
    "get_deposit_history": (nat32) -> (vec DepositRecord) query;
    "get_withdrawal_history": (nat32) -> (vec WithdrawalRecord) query;
    "get_game_history": (nat32) -> (vec GameTransaction) query;
    "get_casino_stats": () -> (CasinoStats) query;
    
    // Audit Functions
    "get_total_user_balances": () -> (nat64) query;
    "verify_reserves": () -> (ReservesReport) query;
    
    // Test Function
    "greet": (text) -> (text) query;
}
```

---

### 3.2 Update Game Backend Canisters

Each game backend needs to add an inter-canister callable function that only casino_main can call.

#### Modifications to `crash_backend/src/lib.rs` (MODIFY)

```rust
// PSEUDOCODE additions to crash_backend

// Add at top with constants
const CASINO_MAIN_CANISTER: &str = "TBD-AFTER-DEPLOYMENT"; // Set after deploying casino_main

// Add this new function (inter-canister only)
#[update]
async fn play_from_casino(player: Principal, bet_amount: u64) -> Result<CrashResult, String> {
    // AUTHORIZATION CHECK
    let caller = ic_cdk::caller();
    let casino_main = Principal::from_text(CASINO_MAIN_CANISTER)
        .map_err(|_| "Invalid casino_main principal".to_string())?;
    
    if caller != casino_main {
        return Err("Only casino_main can call this function".to_string());
    }
    
    // VALIDATE BET
    if bet_amount < MIN_BET {
        return Err(format!("Minimum bet is {} ICP", MIN_BET / 100_000_000));
    }
    if bet_amount > MAX_BET {
        return Err(format!("Maximum bet is {} ICP", MAX_BET / 100_000_000));
    }
    
    // GAME LOGIC (generate crash point, determine outcome)
    let crash_point = generate_crash_point().await;
    
    // For simplicity, assume instant game (no waiting for user cash-out)
    // Real implementation would need game state management
    let multiplier = crash_point; // Simplified
    let payout = (bet_amount as f64 * multiplier) as u64;
    
    // Create result
    let result = CrashResult {
        player,
        bet_amount,
        crash_point,
        multiplier,
        payout,
        timestamp: ic_cdk::api::time(),
    };
    
    // Update game stats
    GAME_STATE.with(|state| {
        let mut state = state.borrow_mut();
        state.total_volume += bet_amount;
    });
    
    Ok(result)
}

// Add CrashResult struct if not exists
#[derive(CandidType, Deserialize, Serialize, Clone, Debug)]
pub struct CrashResult {
    pub player: Principal,
    pub bet_amount: u64,
    pub crash_point: f64,
    pub multiplier: f64,
    pub payout: u64,
    pub timestamp: u64,
}
```

#### Modifications to `plinko_backend/src/lib.rs` (MODIFY)

```rust
// PSEUDOCODE additions to plinko_backend

const CASINO_MAIN_CANISTER: &str = "TBD-AFTER-DEPLOYMENT";

#[update]
async fn play_from_casino(player: Principal, bet_amount: u64, rows: u8, risk: RiskLevel) 
    -> Result<PlinkoResult, String> {
    
    // Authorization check
    let caller = ic_cdk::caller();
    let casino_main = Principal::from_text(CASINO_MAIN_CANISTER)
        .map_err(|_| "Invalid casino_main principal".to_string())?;
    
    if caller != casino_main {
        return Err("Only casino_main can call this function".to_string());
    }
    
    // Validate inputs
    if bet_amount < MIN_BET {
        return Err(format!("Minimum bet is {} ICP", MIN_BET / 100_000_000));
    }
    if ![8, 12, 16].contains(&rows) {
        return Err("Rows must be 8, 12, or 16".to_string());
    }
    
    // Game logic (same as current play_plinko)
    let path = generate_ball_path(rows).await;
    let final_position = calculate_position(&path);
    let multiplier = get_multiplier(rows, &risk, final_position);
    let payout = (bet_amount as f64 * multiplier) as u64;
    
    let result = PlinkoResult {
        player,
        bet_amount,
        rows,
        risk,
        path,
        final_position,
        multiplier,
        payout,
        timestamp: ic_cdk::api::time(),
    };
    
    // Update stats
    GAME_STATS.with(|stats| {
        let mut stats = stats.borrow_mut();
        stats.total_games += 1;
        stats.total_volume += bet_amount;
        stats.total_payouts += payout;
    });
    
    // Store in history
    let game_id = NEXT_GAME_ID.with(|id| {
        let current = *id.borrow();
        *id.borrow_mut() = current + 1;
        current
    });
    
    GAME_HISTORY.with(|history| {
        history.borrow_mut().insert(game_id, result.clone());
    });
    
    Ok(result)
}
```

#### Modifications to `mines_backend/src/lib.rs` (MODIFY)

```rust
// PSEUDOCODE additions to mines_backend

const CASINO_MAIN_CANISTER: &str = "TBD-AFTER-DEPLOYMENT";

#[update]
async fn play_from_casino(player: Principal, bet_amount: u64, num_mines: u8) 
    -> Result<MinesResult, String> {
    
    // Authorization check
    let caller = ic_cdk::caller();
    let casino_main = Principal::from_text(CASINO_MAIN_CANISTER)
        .map_err(|_| "Invalid casino_main principal".to_string())?;
    
    if caller != casino_main {
        return Err("Only casino_main can call this function".to_string());
    }
    
    // Validate inputs
    if bet_amount < MIN_BET || bet_amount > MAX_BET {
        return Err("Invalid bet amount".to_string());
    }
    if num_mines < 1 || num_mines > 24 {
        return Err("Invalid number of mines".to_string());
    }
    
    // Game logic (simplified - full game needs reveal mechanics)
    let random_bytes = match raw_rand().await {
        Ok((bytes,)) => bytes,
        Err(_) => return Err("Randomness failed".to_string()),
    };
    
    // Simplified: instant game result
    // Real implementation needs tile reveal flow
    let tiles_revealed = 5; // Example
    let multiplier = calculate_mines_multiplier(num_mines, tiles_revealed);
    let payout = (bet_amount as f64 * multiplier) as u64;
    
    let result = MinesResult {
        player,
        bet_amount,
        num_mines,
        tiles_revealed,
        multiplier,
        payout,
        timestamp: ic_cdk::api::time(),
    };
    
    Ok(result)
}

#[derive(CandidType, Deserialize, Serialize, Clone, Debug)]
pub struct MinesResult {
    pub player: Principal,
    pub bet_amount: u64,
    pub num_mines: u8,
    pub tiles_revealed: u8,
    pub multiplier: f64,
    pub payout: u64,
    pub timestamp: u64,
}
```

#### Modifications to `dice_backend/src/lib.rs` (MODIFY)

```rust
// PSEUDOCODE additions to dice_backend

const CASINO_MAIN_CANISTER: &str = "TBD-AFTER-DEPLOYMENT";

#[update]
fn play_from_casino(
    player: Principal, 
    bet_amount: u64, 
    target_number: u8, 
    direction: RollDirection,
    client_seed: String
) -> Result<DiceResult, String> {
    
    // Authorization check
    let caller = ic_cdk::caller();
    let casino_main = Principal::from_text(CASINO_MAIN_CANISTER)
        .map_err(|_| "Invalid casino_main principal".to_string())?;
    
    if caller != casino_main {
        return Err("Only casino_main can call this function".to_string());
    }
    
    // Validate inputs (same as current play_dice)
    if bet_amount < MIN_BET || bet_amount > MAX_BET {
        return Err("Invalid bet amount".to_string());
    }
    
    match direction {
        RollDirection::Over => {
            if target_number >= MAX_NUMBER || target_number < 1 {
                return Err("Invalid target for Over".to_string());
            }
        }
        RollDirection::Under => {
            if target_number <= 0 || target_number > MAX_NUMBER {
                return Err("Invalid target for Under".to_string());
            }
        }
    }
    
    // Game logic (same as current implementation)
    let win_chance = calculate_win_chance(target_number, &direction);
    if win_chance < 0.01 || win_chance > 0.98 {
        return Err("Win chance must be between 1% and 98%".to_string());
    }
    
    let multiplier = calculate_multiplier(win_chance);
    let (rolled_number, nonce, server_seed_hash) = generate_dice_roll_instant(&client_seed)?;
    
    let is_win = match direction {
        RollDirection::Over => rolled_number > target_number,
        RollDirection::Under => rolled_number < target_number,
    };
    
    let payout = if is_win {
        (bet_amount as f64 * multiplier) as u64
    } else {
        0
    };
    
    let result = DiceResult {
        player,
        bet_amount,
        target_number,
        direction,
        rolled_number,
        win_chance,
        multiplier,
        payout,
        is_win,
        timestamp: ic_cdk::api::time(),
        client_seed,
        nonce,
        server_seed_hash,
    };
    
    // Update stats
    GAME_STATS.with(|stats| {
        let mut stats = stats.borrow_mut();
        stats.total_games += 1;
        stats.total_volume += bet_amount;
        stats.total_payouts += payout;
    });
    
    // Store in history
    let game_id = NEXT_GAME_ID.with(|id| {
        let current = *id.borrow();
        *id.borrow_mut() = current + 1;
        current
    });
    
    GAME_HISTORY.with(|history| {
        history.borrow_mut().insert(game_id, result.clone());
    });
    
    Ok(result)
}
```

---

### 3.3 Update dfx.json Configuration

#### File: `dfx.json` (MODIFY)

```json
// PSEUDOCODE modifications

{
  "canisters": {
    "casino_main": {
      "type": "rust",
      "package": "casino_main",
      "candid": "casino_main/casino_main.did"
      // Note: No specified_id - will get new ID on first deployment
    },
    "crash_backend": {
      "type": "rust",
      "package": "crash_backend",
      "candid": "crash_backend/crash_backend.did",
      "specified_id": "fws6k-tyaaa-aaaap-qqc7q-cai"
    },
    "plinko_backend": {
      "type": "rust",
      "package": "plinko_backend",
      "candid": "plinko_backend/plinko_backend.did",
      "specified_id": "weupr-2qaaa-aaaap-abl3q-cai"
    },
    "mines_backend": {
      "type": "rust",
      "package": "mines_backend",
      "candid": "mines_backend/mines_backend.did",
      "specified_id": "wvrcw-3aaaa-aaaah-arm4a-cai"
    },
    "dice_backend": {
      "type": "rust",
      "package": "dice_backend",
      "candid": "dice_backend/dice_backend.did",
      "specified_id": "whchi-hyaaa-aaaao-a4ruq-cai"
    },
    "openhouse_frontend": {
      "type": "assets",
      "source": ["openhouse_frontend/dist"],
      "specified_id": "pezw3-laaaa-aaaal-qssoa-cai",
      "dependencies": ["casino_main", "crash_backend", "plinko_backend", "mines_backend", "dice_backend"]
    }
  },
  "defaults": {
    "build": {
      "args": "",
      "packtool": ""
    }
  },
  "networks": {
    "ic": {
      "providers": [
        "https://icp0.io"
      ]
    }
  },
  "version": 1
}
```

---

### 3.4 Update Cargo Workspace

#### File: `Cargo.toml` (MODIFY)

```toml
// PSEUDOCODE modifications

[workspace]
members = [
    "casino_main",      # NEW
    "crash_backend",
    "plinko_backend",
    "mines_backend",
    "dice_backend",
]
resolver = "2"

[profile.release]
lto = true
opt-level = 3
codegen-units = 1
```

---

### 3.5 Update Deployment Script

#### File: `deploy.sh` (MODIFY)

```bash
#!/bin/bash
# PSEUDOCODE modifications

# Add casino_main to deployment options
case $1 in
    --casino-only)
        DEPLOY_TARGET="casino"
        ;;
    --crash-only)
        DEPLOY_TARGET="crash"
        ;;
    # ... existing options
    *)
        DEPLOY_TARGET="all"
        ;;
esac

# Add deploy_casino function
deploy_casino() {
    echo "================================================"
    echo "Deploying Casino Main Canister (Unified Wallet)"
    echo "================================================"

    echo "Building casino_main canister..."
    cargo build --release --target wasm32-unknown-unknown --package casino_main

    echo "Deploying casino_main to mainnet..."
    dfx deploy casino_main --network ic

    # IMPORTANT: After first deployment, get the canister ID
    CASINO_MAIN_ID=$(dfx canister --network ic id casino_main)
    echo "Casino Main Canister ID: $CASINO_MAIN_ID"
    echo ""
    echo "⚠️  MANUAL STEP REQUIRED:"
    echo "Update CASINO_MAIN_CANISTER constant in all game backends to:"
    echo "  const CASINO_MAIN_CANISTER: &str = \"$CASINO_MAIN_ID\";"
    echo ""
    echo "Then re-deploy all game backends:"
    echo "  ./deploy.sh --crash-only"
    echo "  ./deploy.sh --plinko-only"
    echo "  ./deploy.sh --mines-only"
    echo "  ./deploy.sh --dice-only"
    echo ""
}

# Modify main deployment flow
case $DEPLOY_TARGET in
    casino)
        deploy_casino
        ;;
    all)
        deploy_casino
        deploy_crash
        deploy_plinko
        deploy_mines
        deploy_dice
        deploy_frontend
        ;;
    # ... existing cases
esac
```

---

### 3.6 Frontend Updates

#### File: `openhouse_frontend/src/providers/WalletProvider.tsx` (NEW)

```typescript
// PSEUDOCODE for new WalletProvider

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthProvider';
import { useCasinoMainActor } from '../hooks/actors/useCasinoMainActor';

interface WalletContextType {
  balance: bigint | null;
  isLoading: boolean;
  deposit: (amount: bigint) => Promise<void>;
  withdraw: (amount: bigint) => Promise<void>;
  refreshBalance: () => Promise<void>;
  depositHistory: DepositRecord[];
  withdrawalHistory: WithdrawalRecord[];
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const casinoMainActor = useCasinoMainActor();
  
  const [balance, setBalance] = useState<bigint | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [depositHistory, setDepositHistory] = useState<DepositRecord[]>([]);
  const [withdrawalHistory, setWithdrawalHistory] = useState<WithdrawalRecord[]>([]);

  // Fetch balance on mount and when auth changes
  useEffect(() => {
    if (isAuthenticated && casinoMainActor) {
      refreshBalance();
      loadHistory();
    } else {
      setBalance(null);
    }
  }, [isAuthenticated, casinoMainActor]);

  const refreshBalance = async () => {
    if (!casinoMainActor) return;
    
    try {
      setIsLoading(true);
      const result = await casinoMainActor.get_balance();
      
      if ('Ok' in result) {
        setBalance(result.Ok);
      } else {
        console.error('Failed to get balance:', result.Err);
      }
    } catch (error) {
      console.error('Error fetching balance:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const deposit = async (amount: bigint) => {
    if (!casinoMainActor) throw new Error('Casino actor not initialized');
    
    try {
      setIsLoading(true);
      const result = await casinoMainActor.deposit(amount);
      
      if ('Ok' in result) {
        await refreshBalance();
        await loadHistory();
      } else {
        throw new Error(result.Err);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const withdraw = async (amount: bigint) => {
    if (!casinoMainActor) throw new Error('Casino actor not initialized');
    
    try {
      setIsLoading(true);
      const result = await casinoMainActor.withdraw(amount);
      
      if ('Ok' in result) {
        await refreshBalance();
        await loadHistory();
      } else {
        throw new Error(result.Err);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const loadHistory = async () => {
    if (!casinoMainActor) return;
    
    try {
      const deposits = await casinoMainActor.get_deposit_history(10);
      const withdrawals = await casinoMainActor.get_withdrawal_history(10);
      
      setDepositHistory(deposits);
      setWithdrawalHistory(withdrawals);
    } catch (error) {
      console.error('Error loading history:', error);
    }
  };

  return (
    <WalletContext.Provider value={{
      balance,
      isLoading,
      deposit,
      withdraw,
      refreshBalance,
      depositHistory,
      withdrawalHistory,
    }}>
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within WalletProvider');
  }
  return context;
};
```

#### File: `openhouse_frontend/src/hooks/actors/useCasinoMainActor.ts` (NEW)

```typescript
// PSEUDOCODE for casino_main actor hook

import { useMemo } from 'react';
import { Actor, HttpAgent } from '@dfinity/agent';
import { useAuth } from '../../providers/AuthProvider';
import { idlFactory } from '../../declarations/casino_main';

const CASINO_MAIN_CANISTER_ID = process.env.CASINO_MAIN_CANISTER_ID || 'TBD';

export const useCasinoMainActor = () => {
  const { identity } = useAuth();

  return useMemo(() => {
    if (!identity) return null;

    const agent = new HttpAgent({
      identity,
      host: 'https://icp0.io',
    });

    // In production, fetch root key is not needed
    // agent.fetchRootKey(); // Only for local

    return Actor.createActor(idlFactory, {
      agent,
      canisterId: CASINO_MAIN_CANISTER_ID,
    });
  }, [identity]);
};
```

#### File: `openhouse_frontend/src/components/Wallet/WalletModal.tsx` (NEW)

```typescript
// PSEUDOCODE for wallet modal component

import React, { useState } from 'react';
import { useWallet } from '../../providers/WalletProvider';

export const WalletModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({
  isOpen,
  onClose,
}) => {
  const { balance, deposit, withdraw, depositHistory, withdrawalHistory } = useWallet();
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState<'deposit' | 'withdraw'>('deposit');
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setIsProcessing(true);
      const amountE8s = BigInt(parseFloat(amount) * 100_000_000);
      
      if (mode === 'deposit') {
        await deposit(amountE8s);
      } else {
        await withdraw(amountE8s);
      }
      
      setAmount('');
      alert(`${mode} successful!`);
    } catch (error) {
      alert(`${mode} failed: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>Wallet</h2>
        
        {/* Balance Display */}
        <div className="balance-section">
          <p>Current Balance</p>
          <h1>{balance ? Number(balance) / 100_000_000 : 0} ICP</h1>
        </div>

        {/* Deposit/Withdraw Toggle */}
        <div className="mode-toggle">
          <button 
            className={mode === 'deposit' ? 'active' : ''}
            onClick={() => setMode('deposit')}
          >
            Deposit
          </button>
          <button 
            className={mode === 'withdraw' ? 'active' : ''}
            onClick={() => setMode('withdraw')}
          >
            Withdraw
          </button>
        </div>

        {/* Amount Form */}
        <form onSubmit={handleSubmit}>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount in ICP"
            min="1"
            step="0.01"
            required
          />
          <button type="submit" disabled={isProcessing}>
            {isProcessing ? 'Processing...' : mode === 'deposit' ? 'Deposit' : 'Withdraw'}
          </button>
        </form>

        {/* History Tabs */}
        <div className="history-section">
          <h3>Recent {mode === 'deposit' ? 'Deposits' : 'Withdrawals'}</h3>
          <ul>
            {(mode === 'deposit' ? depositHistory : withdrawalHistory).map((record, i) => (
              <li key={i}>
                {Number(record.amount) / 100_000_000} ICP - {new Date(Number(record.timestamp) / 1_000_000).toLocaleString()}
              </li>
            ))}
          </ul>
        </div>

        <button onClick={onClose}>Close</button>
      </div>
    </div>
  );
};
```

#### File: `openhouse_frontend/src/components/Layout.tsx` (MODIFY)

```typescript
// PSEUDOCODE modifications to Layout

import { WalletModal } from './Wallet/WalletModal';
import { useWallet } from '../providers/WalletProvider';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { balance } = useWallet();
  const [isWalletOpen, setIsWalletOpen] = useState(false);

  return (
    <div className="layout">
      <header>
        <h1>OpenHouse Casino</h1>
        
        {/* Balance Display in Header */}
        <div className="header-balance">
          <span>Balance: {balance ? Number(balance) / 100_000_000 : 0} ICP</span>
          <button onClick={() => setIsWalletOpen(true)}>
            Wallet
          </button>
        </div>
        
        <AuthButton />
      </header>

      <main>{children}</main>

      <WalletModal 
        isOpen={isWalletOpen} 
        onClose={() => setIsWalletOpen(false)} 
      />
    </div>
  );
};
```

#### File: `openhouse_frontend/src/App.tsx` (MODIFY)

```typescript
// PSEUDOCODE modifications to App

import { WalletProvider } from './providers/WalletProvider';

function App() {
  return (
    <Router>
      <AuthProvider>
        <ActorProvider>
          <WalletProvider> {/* NEW: Wrap with WalletProvider */}
            <Layout>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/crash" element={<Crash />} />
                <Route path="/plinko" element={<Plinko />} />
                <Route path="/mines" element={<Mines />} />
                <Route path="/dice" element={<Dice />} />
              </Routes>
            </Layout>
          </WalletProvider>
        </ActorProvider>
      </AuthProvider>
    </Router>
  );
}
```

#### File: `openhouse_frontend/src/pages/Dice.tsx` (MODIFY - Example)

```typescript
// PSEUDOCODE modifications to game pages
// Show Dice as example, apply same pattern to all games

import { useCasinoMainActor } from '../hooks/actors/useCasinoMainActor';
import { useWallet } from '../providers/WalletProvider';

export const Dice: React.FC = () => {
  const casinoMainActor = useCasinoMainActor();
  const { balance, refreshBalance } = useWallet();
  const [betAmount, setBetAmount] = useState(1);
  const [targetNumber, setTargetNumber] = useState(50);
  const [direction, setDirection] = useState<'Over' | 'Under'>('Over');
  const [isPlaying, setIsPlaying] = useState(false);
  const [result, setResult] = useState(null);

  const handlePlay = async () => {
    if (!casinoMainActor) return;
    
    try {
      setIsPlaying(true);
      
      const amountE8s = BigInt(betAmount * 100_000_000);
      const clientSeed = generateRandomSeed(); // Helper function
      
      // Call casino_main instead of dice_backend directly
      const response = await casinoMainActor.play_dice(
        amountE8s,
        targetNumber,
        { [direction]: null },
        clientSeed
      );
      
      if ('Ok' in response) {
        setResult(response.Ok);
        await refreshBalance(); // Update balance after game
      } else {
        alert(`Game failed: ${response.Err}`);
      }
    } catch (error) {
      alert(`Error: ${error.message}`);
    } finally {
      setIsPlaying(false);
    }
  };

  return (
    <div className="dice-game">
      <h1>Dice Game</h1>
      
      {/* Balance Display */}
      <div className="balance">
        Balance: {balance ? Number(balance) / 100_000_000 : 0} ICP
      </div>

      {/* Game Controls */}
      <div className="controls">
        <input 
          type="number" 
          value={betAmount}
          onChange={(e) => setBetAmount(parseFloat(e.target.value))}
          min="1"
          max="100"
        />
        
        <input 
          type="number" 
          value={targetNumber}
          onChange={(e) => setTargetNumber(parseInt(e.target.value))}
          min="1"
          max="99"
        />
        
        <select value={direction} onChange={(e) => setDirection(e.target.value as any)}>
          <option value="Over">Over</option>
          <option value="Under">Under</option>
        </select>
        
        <button onClick={handlePlay} disabled={isPlaying}>
          {isPlaying ? 'Rolling...' : 'Play'}
        </button>
      </div>

      {/* Result Display */}
      {result && (
        <div className={`result ${result.is_win ? 'win' : 'lose'}`}>
          <h2>{result.is_win ? 'WIN!' : 'LOSE'}</h2>
          <p>Rolled: {result.rolled_number}</p>
          <p>Multiplier: {result.multiplier.toFixed(2)}x</p>
          <p>Payout: {Number(result.payout) / 100_000_000} ICP</p>
        </div>
      )}
    </div>
  );
};
```

---

## 4. Deployment Strategy

### Phase 1: Deploy casino_main

```bash
# 1. Build and deploy casino_main
cargo build --target wasm32-unknown-unknown --release --package casino_main
dfx deploy casino_main --network ic

# 2. Get the canister ID
CASINO_MAIN_ID=$(dfx canister --network ic id casino_main)
echo "Casino Main ID: $CASINO_MAIN_ID"
```

### Phase 2: Update Game Backends

```bash
# 3. Manually update CASINO_MAIN_CANISTER constant in all game backends
# Replace "TBD-AFTER-DEPLOYMENT" with actual canister ID

# 4. Update and add new inter-canister methods to all game backends
# (play_from_casino functions)

# 5. Rebuild and redeploy all game backends
cargo build --target wasm32-unknown-unknown --release
./deploy.sh --crash-only
./deploy.sh --plinko-only
./deploy.sh --mines-only
./deploy.sh --dice-only
```

### Phase 3: Update Frontend

```bash
# 6. Generate declarations for casino_main
dfx generate casino_main

# 7. Build and deploy frontend
cd openhouse_frontend
npm install  # Install any new dependencies
npm run build
cd ..
./deploy.sh --frontend-only
```

### Phase 4: Verification

```bash
# 8. Test deposit
dfx canister --network ic call casino_main deposit '(100000000 : nat64)'

# 9. Check balance
dfx canister --network ic call casino_main get_balance

# 10. Test game play
dfx canister --network ic call casino_main play_dice '(100000000 : nat64, 50 : nat8, variant { Over }, "test-seed")'

# 11. Verify reserves
dfx canister --network ic call casino_main verify_reserves
```

---

## 5. Security Considerations

### Implemented Security Features

1. **Authorization Checks**: Only casino_main can call game backends
2. **Balance Locking**: Prevent double-spending during active games
3. **Withdrawal Limits**: Max withdrawal per transaction
4. **Betting Limits**: Min/max bet enforced centrally
5. **Audit Functions**: Proof of reserves, transparent accounting
6. **Rollback Logic**: Failed transactions restore user balance
7. **On-chain Verification**: All deposits/withdrawals recorded with block indexes

### Potential Vulnerabilities & Mitigations

| Vulnerability | Mitigation |
|--------------|------------|
| Inter-canister call failure | Rollback logic restores balances |
| Race conditions | Account locking during gameplay |
| Insufficient house bankroll | Each game maintains 100 ICP reserve |
| User balance overflow | Use u64 (max 184M ICP) |
| Malicious frontend | All logic in backend, frontend is UI only |

---

## 6. Testing Requirements

### Manual Testing Checklist

- [ ] Deploy casino_main and verify canister ID
- [ ] Update all game backends with casino_main ID
- [ ] Test deposit: User → casino_main
- [ ] Test balance query
- [ ] Test play_crash via casino_main
- [ ] Test play_plinko via casino_main
- [ ] Test play_mines via casino_main
- [ ] Test play_dice via casino_main
- [ ] Test withdrawal: casino_main → User
- [ ] Verify deposit history
- [ ] Verify withdrawal history
- [ ] Verify game transaction history
- [ ] Test audit functions (reserves, solvency)
- [ ] Test frontend wallet modal
- [ ] Test frontend game pages with unified wallet
- [ ] Verify balance updates after games
- [ ] Test insufficient balance error
- [ ] Test withdrawal limit enforcement

---

## 7. Migration Notes

### For Existing Users

Since this is a NEW feature with no existing unified wallet:
- No user migration needed
- Existing game backends continue to work
- Users start with 0 balance in casino_main
- Users must deposit to play via unified wallet

### Backward Compatibility

- Old game backend methods (play_plinko, play_dice, etc.) remain unchanged
- New inter-canister methods added (play_from_casino)
- Frontend can choose to use either direct or unified wallet approach
- Gradual migration: deploy casino_main, then update frontend incrementally

---

## 8. Documentation Updates

### Files to Update

1. **CLAUDE.md**: Add casino_main canister info, update architecture section
2. **README.md**: Explain unified wallet system
3. **API Documentation**: Document casino_main interface
4. **Frontend README**: Update setup instructions

---

## 9. Future Enhancements

### Post-MVP Features

1. **Transaction Fees**: Optional platform fee (e.g., 0.5% on winnings)
2. **Referral System**: Track referrals in casino_main
3. **Loyalty Rewards**: Points system for frequent players
4. **Multi-Token Support**: Accept other ICRC-1 tokens (not just ICP)
5. **Batch Withdrawals**: Combine multiple withdrawals to save fees
6. **Game-Specific Wallets**: Separate balances per game
7. **Social Features**: Leaderboards, achievements
8. **Admin Dashboard**: Monitor stats, manage limits
9. **Emergency Pause**: Circuit breaker for all games
10. **Automated Market Making**: Dynamic house bankroll management

---

## 10. File Summary

### New Files Created (8 files)

1. `casino_main/Cargo.toml`
2. `casino_main/src/lib.rs`
3. `casino_main/casino_main.did`
4. `openhouse_frontend/src/providers/WalletProvider.tsx`
5. `openhouse_frontend/src/hooks/actors/useCasinoMainActor.ts`
6. `openhouse_frontend/src/components/Wallet/WalletModal.tsx`
7. `openhouse_frontend/src/components/Wallet/DepositForm.tsx` (optional)
8. `openhouse_frontend/src/components/Wallet/WithdrawForm.tsx` (optional)

### Modified Files (12 files)

1. `dfx.json` - Add casino_main canister
2. `Cargo.toml` - Add casino_main to workspace
3. `deploy.sh` - Add casino_main deployment
4. `crash_backend/src/lib.rs` - Add play_from_casino function
5. `plinko_backend/src/lib.rs` - Add play_from_casino function
6. `mines_backend/src/lib.rs` - Add play_from_casino function
7. `dice_backend/src/lib.rs` - Add play_from_casino function
8. `openhouse_frontend/src/App.tsx` - Add WalletProvider
9. `openhouse_frontend/src/components/Layout.tsx` - Add wallet UI
10. `openhouse_frontend/src/pages/Crash.tsx` - Use casino_main actor
11. `openhouse_frontend/src/pages/Plinko.tsx` - Use casino_main actor
12. `openhouse_frontend/src/pages/Mines.tsx` - Use casino_main actor
13. `openhouse_frontend/src/pages/Dice.tsx` - Use casino_main actor

### Total Changes

- **New files**: 8
- **Modified files**: 13
- **Total affected files**: 21
- **New canister**: 1 (casino_main)
- **Modified canisters**: 5 (4 games + frontend)

---

## 11. Affected Canisters

| Canister | ID | Changes | Deploy Required |
|----------|------|---------|----------------|
| **casino_main** | TBD (new) | Create entire canister | Yes - NEW |
| **crash_backend** | fws6k-tyaaa-aaaap-qqc7q-cai | Add play_from_casino | Yes |
| **plinko_backend** | weupr-2qaaa-aaaap-abl3q-cai | Add play_from_casino | Yes |
| **mines_backend** | wvrcw-3aaaa-aaaah-arm4a-cai | Add play_from_casino | Yes |
| **dice_backend** | whchi-hyaaa-aaaao-a4ruq-cai | Add play_from_casino | Yes |
| **openhouse_frontend** | pezw3-laaaa-aaaal-qssoa-cai | Add wallet UI | Yes |

---

## 12. Implementation Timeline

### Estimated Effort

- **casino_main canister**: 4-6 hours (core logic)
- **Game backend updates**: 2-3 hours (4 games × 30min each)
- **Frontend wallet UI**: 3-4 hours (provider + components)
- **Frontend game page updates**: 2-3 hours (4 pages × 30min each)
- **Testing & debugging**: 3-4 hours
- **Documentation**: 1-2 hours

**Total**: 15-22 hours

### Development Order

1. Create casino_main canister (backend)
2. Update game backends (inter-canister calls)
3. Deploy casino_main and update IDs
4. Redeploy game backends
5. Create frontend wallet provider
6. Update game pages to use casino_main
7. Build and deploy frontend
8. Test end-to-end on mainnet
9. Update documentation

---

## 13. Success Criteria

Feature is complete when:

- [ ] casino_main canister deployed and verified
- [ ] All 4 game backends updated with play_from_casino
- [ ] Frontend wallet UI functional (deposit/withdraw)
- [ ] Users can deposit ICP into casino_main
- [ ] Users can play all 4 games via unified wallet
- [ ] Balance updates correctly after games
- [ ] Users can withdraw ICP from casino_main
- [ ] Audit functions show correct reserves
- [ ] No ICP fees during gameplay (only on deposit/withdraw)
- [ ] All tests pass on mainnet
- [ ] Documentation updated

---

## 14. Rollback Plan

If deployment fails or critical bugs found:

1. **Keep old game backends working**: Don't remove original play methods
2. **Frontend can switch back**: Change actor calls from casino_main to direct
3. **Pause deposits**: Add emergency pause flag in casino_main
4. **Drain casino_main**: Allow users to withdraw all balances
5. **Redeploy previous version**: Use git to revert changes

---

## 15. Notes for Implementer

### Critical Implementation Details

1. **ICRC-1 Integration**: Use proper ICRC-1 types (Account, TransferArgs, etc.)
2. **Error Handling**: Always rollback balances on failed inter-canister calls
3. **Account Locking**: Lock during gameplay, unlock after result
4. **Stable Storage**: Use StableBTreeMap for all persistent data
5. **Canister ID Update**: After deploying casino_main, update all game backend constants
6. **Frontend Actor Creation**: Generate declarations with `dfx generate`
7. **Testing on Mainnet**: No local environment - test carefully in small amounts first

### Common Pitfalls to Avoid

- Forgetting to update CASINO_MAIN_CANISTER constant in game backends
- Not implementing rollback logic in casino_main
- Frontend caching old balances (use refreshBalance after games)
- Not handling inter-canister call failures gracefully
- Forgetting to add casino_main to dfx.json dependencies for frontend

---

## 16. Final Handoff Command

The plan is complete with embedded PR orchestrator.

**Execute**: `@/home/theseus/alexandria/openhouse-unified-wallet/UNIFIED_WALLET_IMPLEMENTATION_PLAN.md`

The implementing agent MUST:
1. Read the orchestrator header (cannot skip - it's at the top)
2. Verify worktree isolation
3. Implement the plan using the pseudocode as a guide
4. Deploy to mainnet (mandatory)
5. Create PR (mandatory step)
6. Iterate autonomously until approved

---

**END OF IMPLEMENTATION PLAN**
