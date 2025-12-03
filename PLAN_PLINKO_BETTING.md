# AUTONOMOUS PR ORCHESTRATOR - DO NOT SKIP

**You are an autonomous PR orchestrator. Your ONLY job is to implement this plan and create a PR.**

## Isolation Check (RUN FIRST)
```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
if [ "$REPO_ROOT" = "/home/theseus/alexandria/openhouse" ]; then
    echo "FATAL: In main repo. Must be in worktree."
    echo "Worktree: /home/theseus/alexandria/openhouse-plinko-betting"
    exit 1
fi
echo "In isolated worktree: $REPO_ROOT"
```

## Your Autonomous Workflow (NO QUESTIONS ALLOWED)
1. **Verify isolation** - You must be in worktree: `/home/theseus/alexandria/openhouse-plinko-betting`
2. **Implement feature** - Follow plan sections below
3. **Build & Deploy to Mainnet**:
   ```bash
   cargo build --target wasm32-unknown-unknown --release
   ./deploy.sh --plinko-only
   ```
4. **Verify deployment**:
   ```bash
   dfx canister --network ic status plinko_backend
   dfx canister --network ic call weupr-2qaaa-aaaap-abl3q-cai greet '("Test")'
   ```
5. **Create PR** (MANDATORY):
   ```bash
   git add .
   git commit -m "feat: integrate defi_accounting betting rail into plinko_backend"
   git push -u origin feature/plinko-betting-rail
   gh pr create --title "Feature: Plinko Betting Rail Integration" --body "Implements PLAN_PLINKO_BETTING.md

Deployed to mainnet:
- Plinko Backend: weupr-2qaaa-aaaap-abl3q-cai

Changes:
- Added types.rs with ICRC-2 types and plinko constants
- Created game.rs with play_plinko() betting flow
- Updated lib.rs with accounting integration
- Updated .did with all accounting endpoints"
   ```

## CRITICAL RULES
- NO questions ("should I?", "want me to?")
- NO skipping PR creation - it's MANDATORY
- MAINNET DEPLOYMENT: All changes go directly to production
- ONLY stop at: approved, max iterations, or error

**Branch:** `feature/plinko-betting-rail`
**Worktree:** `/home/theseus/alexandria/openhouse-plinko-betting`

---

# Implementation Plan: Plinko Betting Rail Integration

## Summary
Connect the existing `defi_accounting` module to plinko game logic to enable real ckUSDT betting.

**Scope**: Fixed 8-row configuration (no risk/row parameters yet)
**Min Bet**: 0.01 USDT (10,000 decimals) - same as dice

## Current State

### What Exists
- `plinko_backend/src/lib.rs` - Pure game logic with `drop_ball()` returning multipliers
- `plinko_backend/src/defi_accounting/` - Complete accounting module (DO NOT MODIFY)
- `plinko_backend/plinko_backend.did` - Only exposes pure game functions

### Critical Gap
The `defi_accounting/` module imports `crate::types` which doesn't exist - compilation will fail until we create it.

### Key Constants (from lib.rs)
- `MULTIPLIER_SCALE = 10,000` (basis points)
- `MAX_MULTIPLIER_BP = 65,200` (6.52x at edges)
- `MIN_MULTIPLIER_BP = 2,000` (0.2x at center)
- Expected value: 0.99 (1% house edge)

---

## Files to Create/Modify

### 1. `plinko_backend/Cargo.toml` (MODIFY)

Add missing dependencies:
```toml
[dependencies]
candid = "0.10"
ic-cdk = "0.19"
ic-cdk-timers = "1.0"              # ADD - for timer functions
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"                  # ADD - for PoolState serialization
ic-stable-structures = "0.7"        # ADD - for stable storage
num-bigint = "0.4"                  # ADD - for StorableNat
num-traits = "0.2"                  # ADD - for ToPrimitive

[dev-dependencies]
rand = "0.8"
```

### 2. `plinko_backend/src/types.rs` (CREATE)

```rust
// PSEUDOCODE - Create types required by defi_accounting

use candid::{CandidType, Deserialize, Principal};
use serde::Serialize;

// Constants
pub const DECIMALS_PER_CKUSDT: u64 = 1_000_000;  // 6 decimals
pub const MIN_BET: u64 = 10_000;                  // 0.01 USDT (same as dice)
pub const CKUSDT_CANISTER_ID: &str = "cngnf-vqaaa-aaaar-qag4q-cai";
pub const CKUSDT_TRANSFER_FEE: u64 = 10_000;      // 0.01 USDT

// ICRC-2 Account type
pub struct Account {
    pub owner: Principal,
    pub subaccount: Option<[u8; 32]>,
}

impl From<Principal> for Account { ... }

// ICRC-2 TransferFromArgs
pub struct TransferFromArgs {
    pub from: Account,
    pub to: Account,
    pub amount: candid::Nat,
    pub fee: Option<candid::Nat>,
    pub memo: Option<Vec<u8>>,
    pub created_at_time: Option<u64>,
    pub spender_subaccount: Option<[u8; 32]>,
}

// ICRC-2 TransferFromError enum
pub enum TransferFromError {
    BadFee, BadBurn, InsufficientFunds, InsufficientAllowance,
    TooOld, CreatedInFuture, Duplicate, TemporarilyUnavailable, GenericError
}

// ICRC-2 TransferArg and TransferError (for outbound transfers)
pub struct TransferArg { ... }
pub enum TransferError { ... }
```

**Reference**: Copy exact types from `dice_backend/src/types.rs` lines 83-142

### 3. `plinko_backend/src/game.rs` (CREATE)

```rust
// PSEUDOCODE - Betting-integrated game logic

use crate::types::{DECIMALS_PER_CKUSDT, MIN_BET};
use crate::defi_accounting::{self as accounting, liquidity_pool};
use crate::{calculate_multiplier_bp, MULTIPLIER_SCALE, ROWS};

// Max multiplier for bet validation (6.52x at edges)
const MAX_MULTIPLIER_BP: u64 = 65_200;

// Result type with betting info
pub struct PlinkoGameResult {
    pub path: Vec<bool>,
    pub final_position: u8,
    pub multiplier_bp: u64,
    pub multiplier: f64,
    pub bet_amount: u64,
    pub payout: u64,
    pub profit: i64,
    pub is_win: bool,
}

pub struct MultiBallGameResult {
    pub results: Vec<PlinkoGameResult>,
    pub total_balls: u8,
    pub total_bet: u64,
    pub total_payout: u64,
    pub net_profit: i64,
    pub average_multiplier: f64,
}

// Helper: Calculate max bet based on pool
pub fn calculate_max_bet() -> u64 {
    let max_allowed = accounting::get_max_allowed_payout();
    if max_allowed == 0 { return 0; }
    // max_bet = max_allowed / max_multiplier (6.52x)
    (max_allowed * MULTIPLIER_SCALE / MAX_MULTIPLIER_BP)
}

// Helper: Calculate payout from bet and multiplier
fn calculate_payout(bet_amount: u64, multiplier_bp: u64) -> u64 {
    (bet_amount * multiplier_bp / MULTIPLIER_SCALE)
}

// Main game function - follows dice_backend pattern
pub async fn play_plinko(bet_amount: u64, caller: Principal) -> Result<PlinkoGameResult, String> {
    // 1. Check user balance
    let user_balance = accounting::get_balance(caller);
    if user_balance < bet_amount {
        return Err("INSUFFICIENT_BALANCE|...");
    }

    // 2. Validate minimum bet (0.01 USDT)
    if bet_amount < MIN_BET {
        return Err("Invalid bet: minimum is 0.01 USDT");
    }

    // 3. Check max payout against pool limit
    let max_potential_payout = calculate_payout(bet_amount, MAX_MULTIPLIER_BP);
    let max_allowed = accounting::get_max_allowed_payout();
    if max_potential_payout > max_allowed {
        return Err("Invalid bet: exceeds house limit");
    }

    // 4. Get VRF randomness BEFORE deducting balance
    let random_bytes = raw_rand().await?;
    let random_byte = random_bytes[0];

    // 5. Deduct bet from balance
    let balance_after_bet = user_balance - bet_amount;
    accounting::update_balance(caller, balance_after_bet)?;

    // 6. Record volume for statistics
    crate::defi_accounting::record_bet_volume(bet_amount);

    // 7. Generate path and calculate position (existing logic)
    let path: Vec<bool> = (0..ROWS).map(|i| (random_byte >> i) & 1 == 1).collect();
    let final_position = path.iter().filter(|&&d| d).count() as u8;

    // 8. Calculate multiplier and payout
    let multiplier_bp = calculate_multiplier_bp(final_position)?;
    let payout = calculate_payout(bet_amount, multiplier_bp);
    let is_win = multiplier_bp >= MULTIPLIER_SCALE;
    let profit = payout as i64 - bet_amount as i64;

    // 9. Credit payout to user
    let current_balance = accounting::get_balance(caller);
    let new_balance = current_balance + payout;
    accounting::update_balance(caller, new_balance)?;

    // 10. Settle with pool
    if let Err(e) = liquidity_pool::settle_bet(bet_amount, payout) {
        // Rollback: refund bet
        accounting::update_balance(caller, current_balance + bet_amount)?;
        return Err("House cannot afford payout. Bet refunded.");
    }

    Ok(PlinkoGameResult { path, final_position, multiplier_bp, multiplier, bet_amount, payout, profit, is_win })
}

// Multi-ball version - same pattern with batch processing
pub async fn play_multi_plinko(ball_count: u8, bet_per_ball: u64, caller: Principal) -> Result<MultiBallGameResult, String> {
    // Validate 1-30 balls
    // Check total balance
    // Get single VRF call (32 bytes)
    // Deduct total bet
    // Process each ball
    // Credit total payout
    // Settle with pool
    // Return aggregate result
}

pub fn calculate_max_bet_per_ball(ball_count: u8) -> Result<u64, String> {
    // max_allowed / (ball_count * max_multiplier)
}
```

### 4. `plinko_backend/src/lib.rs` (MODIFY)

Add at top after existing imports:
```rust
// PSEUDOCODE - Add module declarations

use ic_stable_structures::memory_manager::{MemoryManager, VirtualMemory};
use ic_stable_structures::DefaultMemoryImpl;
use std::cell::RefCell;

mod defi_accounting;
pub mod types;
pub mod game;

pub use game::{PlinkoGameResult, MultiBallGameResult};

pub type Memory = VirtualMemory<DefaultMemoryImpl>;

thread_local! {
    pub static MEMORY_MANAGER: RefCell<MemoryManager<DefaultMemoryImpl>> =
        RefCell::new(MemoryManager::init(DefaultMemoryImpl::default()));
}
```

Update lifecycle hooks (replace existing):
```rust
#[init]
fn init() {
    ic_cdk::println!("Plinko Backend Initialized with DeFi Accounting");
    defi_accounting::accounting::start_parent_withdrawal_timer();
    defi_accounting::start_stats_timer();
}

#[pre_upgrade]
fn pre_upgrade() {
    // StableBTreeMap persists automatically
}

#[post_upgrade]
fn post_upgrade() {
    defi_accounting::accounting::start_parent_withdrawal_timer();
    defi_accounting::start_stats_timer();
}
```

Add solvency check:
```rust
fn is_canister_solvent() -> bool {
    let pool_reserve = defi_accounting::liquidity_pool::get_pool_reserve();
    let total_deposits = defi_accounting::accounting::calculate_total_deposits_internal();
    let canister_balance = defi_accounting::accounting::get_cached_canister_balance_internal();

    canister_balance >= pool_reserve + total_deposits
}
```

Add game endpoints:
```rust
#[update]
async fn play_plinko(bet_amount: u64) -> Result<PlinkoGameResult, String> {
    if !is_canister_solvent() {
        return Err("Game temporarily paused - insufficient funds.");
    }
    game::play_plinko(bet_amount, ic_cdk::api::msg_caller()).await
}

#[update]
async fn play_multi_plinko(ball_count: u8, bet_per_ball: u64) -> Result<MultiBallGameResult, String> {
    if !is_canister_solvent() {
        return Err("Game temporarily paused - insufficient funds.");
    }
    game::play_multi_plinko(ball_count, bet_per_ball, ic_cdk::api::msg_caller()).await
}

#[query]
fn get_max_bet() -> u64 {
    game::calculate_max_bet()
}
```

Add ALL accounting endpoints (copy pattern from dice_backend/src/lib.rs lines 155-310):
- User accounting: `deposit`, `withdraw_all`, `retry_withdrawal`, `abandon_withdrawal`, `get_balance`, `get_my_balance`, `get_pending_withdrawal`
- LP operations: `deposit_liquidity`, `withdraw_all_liquidity`, `get_pool_stats`, `get_lp_position`, `get_my_lp_position`, `get_house_mode`
- Admin: `admin_health_check`, `admin_get_all_pending_withdrawals`, `admin_get_orphaned_funds`, `refresh_canister_balance`
- Stats: `get_daily_stats`, `get_pool_apy`

### 5. `plinko_backend/plinko_backend.did` (MODIFY)

Add new types and expand service definition:

```candid
// PSEUDOCODE - Add all new types

type PlinkoGameResult = record {
  path: vec bool;
  final_position: nat8;
  multiplier_bp: nat64;
  multiplier: float64;
  bet_amount: nat64;
  payout: nat64;
  profit: int64;
  is_win: bool;
};

type MultiBallGameResult = record {
  results: vec PlinkoGameResult;
  total_balls: nat8;
  total_bet: nat64;
  total_payout: nat64;
  net_profit: int64;
  average_multiplier: float64;
};

// Accounting types (copy from dice_backend.did)
type LPPosition = record { ... };
type PoolStats = record { ... };
type PendingWithdrawal = record { ... };
type HealthCheck = record { ... };
type DailySnapshot = record { ... };
type ApyInfo = record { ... };

service : {
  // Existing pure game functions (keep)
  drop_ball: () -> (variant { Ok: PlinkoResult; Err: text });
  drop_multiple_balls: (nat8) -> (variant { Ok: MultiBallResult; Err: text });
  get_multipliers_bp: () -> (vec nat64) query;
  get_formula: () -> (text) query;
  get_expected_value: () -> (float64) query;
  greet: (text) -> (text) query;

  // NEW: Betting game functions
  play_plinko: (nat64) -> (variant { Ok: PlinkoGameResult; Err: text });
  play_multi_plinko: (nat8, nat64) -> (variant { Ok: MultiBallGameResult; Err: text });
  get_max_bet: () -> (nat64) query;
  get_max_bet_per_ball: (nat8) -> (variant { Ok: nat64; Err: text }) query;

  // NEW: User accounting
  deposit: (nat64) -> (variant { Ok: nat64; Err: text });
  withdraw_all: () -> (variant { Ok: nat64; Err: text });
  retry_withdrawal: () -> (variant { Ok: nat64; Err: text });
  abandon_withdrawal: () -> (variant { Ok: text; Err: text });
  get_balance: (principal) -> (nat64) query;
  get_my_balance: () -> (nat64) query;
  get_pending_withdrawal: () -> (opt PendingWithdrawal) query;

  // NEW: LP operations
  deposit_liquidity: (nat64, opt nat) -> (variant { Ok: nat; Err: text });
  withdraw_all_liquidity: () -> (variant { Ok: record { shares: nat; amount: nat64 }; Err: text });
  get_pool_stats: () -> (PoolStats) query;
  get_lp_position: (principal) -> (LPPosition) query;
  get_my_lp_position: () -> (LPPosition) query;
  get_house_mode: () -> (text) query;

  // NEW: Admin
  admin_health_check: () -> (HealthCheck) query;
  admin_get_all_pending_withdrawals: () -> (vec record { principal; PendingWithdrawal }) query;
  admin_get_orphaned_funds: () -> (vec record { principal; nat64; nat64 }) query;
  refresh_canister_balance: () -> (nat64);

  // NEW: Statistics
  get_daily_stats: (nat32) -> (vec DailySnapshot) query;
  get_pool_apy: (nat32) -> (ApyInfo) query;
}
```

---

## Key Points

### DO NOT MODIFY
- `plinko_backend/src/defi_accounting/*` - Already solid, leave as-is

### Constants Reminder
- MIN_BET = 10,000 (0.01 USDT)
- MAX_MULTIPLIER_BP = 65,200 (6.52x)
- MULTIPLIER_SCALE = 10,000

### Test After Deployment
```bash
# Check greet still works
dfx canister --network ic call weupr-2qaaa-aaaap-abl3q-cai greet '("Test")'

# Check new endpoints exist
dfx canister --network ic call weupr-2qaaa-aaaap-abl3q-cai get_max_bet

# Check pool stats (will be empty until LP deposits)
dfx canister --network ic call weupr-2qaaa-aaaap-abl3q-cai get_pool_stats
```

---

## Estimated Scope
- `types.rs`: ~100 lines (mostly copied from dice)
- `game.rs`: ~200 lines
- `lib.rs`: +200 lines (endpoints)
- `.did`: +100 lines
- **Total**: ~600 lines new code
