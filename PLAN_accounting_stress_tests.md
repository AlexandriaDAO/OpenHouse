# AUTONOMOUS PR ORCHESTRATOR - DO NOT SKIP

**You are an autonomous PR orchestrator. Your ONLY job is to implement this plan and create a PR.**

## Isolation Check (RUN FIRST)
```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
if [ "$REPO_ROOT" = "/home/theseus/alexandria/openhouse" ]; then
    echo "FATAL: In main repo. Must be in worktree."
    echo "Worktree: /home/theseus/alexandria/openhouse-stress-tests"
    exit 1
fi
echo "In isolated worktree: $REPO_ROOT"
```

## Your Autonomous Workflow (NO QUESTIONS ALLOWED)
1. **Verify isolation** - You must be in worktree: `/home/theseus/alexandria/openhouse-stress-tests`
2. **Implement feature** - Follow plan sections below
3. **Build & Test**:
   ```bash
   cd dice_backend
   cargo test stress_tests -- --nocapture
   ```
4. **Create PR** (MANDATORY):
   ```bash
   git add .
   git commit -m "feat(dice): Add DeFi accounting stress tests with proptest"
   git push -u origin feature/accounting-stress-tests
   gh pr create --title "feat(dice): DeFi Accounting Stress Tests" --body "$(cat <<'EOF'
   ## Summary
   - Adds property-based stress tests for dice backend accounting system
   - Tests invariant: pool_reserve + user_balances + fees == total_system_funds
   - Simulates 10,000+ operations to detect accounting drift, edge cases, state machine bugs

   ## Test Categories
   1. **Accounting drift** - Random operation sequences verify invariant holds
   2. **Edge cases** - Max u64, minimum bets, precision
   3. **State machine** - Invalid states unreachable

   ## How to Run
   ```bash
   cd dice_backend
   cargo test stress_tests -- --nocapture
   ```

   Implements PLAN_accounting_stress_tests.md
   EOF
   )"
   ```

5. **Iterate autonomously**:
   - FOR i=1 to 5:
     - Check review: `gh pr view --json comments`
     - Count P0 issues
     - IF P0 > 0: Fix immediately, commit, push, sleep 300s, continue
     - IF P0 = 0: Report success, EXIT
   - After 5 iterations: Escalate to human

## CRITICAL RULES
- NO questions ("should I?", "want me to?", "is it done?")
- NO skipping PR creation - it's MANDATORY
- NO stopping after implementation - create PR immediately
- After sleep: IMMEDIATELY continue (no pause)
- ONLY stop at: approved, max iterations, or error

**Branch:** `feature/accounting-stress-tests`
**Worktree:** `/home/theseus/alexandria/openhouse-stress-tests`

---

# Implementation Plan: DeFi Accounting Stress Tests

## Goal

Create property-based stress tests that simulate thousands of deposits, withdrawals, bets, and LP operations to detect accounting discrepancies before they occur on mainnet.

## Current State

### Existing Test Files
```
dice_backend/src/defi_accounting/tests/
├── mod.rs                      # Module declaration only
└── test_serialization.rs       # 2 tests for serialization
```

### Test Coverage Gap
- `accounting.rs` (652 lines) - **0% coverage**
- `liquidity_pool.rs` (~500 lines) - **0% coverage**
- `game.rs` (221 lines) - **2 tests only** (multiplier math)

### Core Accounting Functions to Mirror
| Function | File | Line | Purpose |
|----------|------|------|---------|
| `update_balance()` | accounting.rs | 546 | User balance changes |
| `get_balance_internal()` | accounting.rs | 502 | Read user balance |
| `calculate_shares_for_deposit()` | liquidity_pool.rs | 126 | LP share math |
| `update_pool_on_win()` | liquidity_pool.rs | 484 | Pool decreases on player win |
| `update_pool_on_loss()` | liquidity_pool.rs | 511 | Pool increases on player loss |

### Constants (from types.rs)
```rust
DECIMALS_PER_USDT = 1_000_000    // 1 USDT = 1,000,000 decimals
MIN_BET = 10_000                  // 0.01 USDT
LP_WITHDRAWAL_FEE_BPS = 100       // 1%
MINIMUM_LIQUIDITY = 1000          // Burned on first LP deposit
TRANSFER_FEE = 10_000             // 0.01 USDT per transfer
```

## Target State

### New Test Structure
```
dice_backend/src/defi_accounting/tests/
├── mod.rs                      # ADD: mod stress_tests;
├── test_serialization.rs       # Existing
└── stress_tests/
    ├── mod.rs                  # NEW: Module declarations
    ├── model.rs                # NEW: Pure Rust accounting model
    ├── operations.rs           # NEW: Operation enum & execution
    ├── generators.rs           # NEW: proptest strategies
    └── tests.rs                # NEW: All stress tests
```

---

## Implementation Pseudocode

### Step 1: Update Cargo.toml

**File:** `dice_backend/Cargo.toml` (MODIFY)

```toml
# ADD to [dev-dependencies] section
[dev-dependencies]
proptest = "1.4"
rand = "0.8"
rand_chacha = "0.3"
```

### Step 2: Create stress_tests/mod.rs

**File:** `dice_backend/src/defi_accounting/tests/stress_tests/mod.rs` (NEW)

```rust
// PSEUDOCODE
mod model;
mod operations;
mod generators;
mod tests;

pub use model::AccountingModel;
pub use operations::{Operation, OpResult};
```

### Step 3: Create stress_tests/model.rs

**File:** `dice_backend/src/defi_accounting/tests/stress_tests/model.rs` (NEW)

```rust
// PSEUDOCODE - Pure Rust accounting model mirroring production logic

use std::collections::HashMap;

// Constants matching production (from types.rs)
const DECIMALS_PER_USDT: u64 = 1_000_000;
const MIN_BET: u64 = 10_000;
const LP_WITHDRAWAL_FEE_BPS: u64 = 100;
const MINIMUM_LIQUIDITY: u64 = 1000;

pub struct AccountingModel {
    // User balances - mirrors USER_BALANCES_STABLE
    user_balances: HashMap<u64, u64>,

    // LP shares - mirrors LP_SHARES
    lp_shares: HashMap<u64, u64>,
    total_shares: u64,

    // Pool reserve - mirrors POOL_STATE.reserve
    pool_reserve: u64,

    // Tracking for invariant checking
    total_system_funds: u64,
    accumulated_fees: u64,

    // State
    initialized: bool,
    operation_count: u64,
}

impl AccountingModel {
    pub fn new() -> Self {
        // Initialize empty model
    }

    pub fn with_initial_liquidity(amount: u64) -> Self {
        // Create model with seed liquidity
        // Burn MINIMUM_LIQUIDITY to address 0 (mirrors liquidity_pool.rs:214)
    }

    /// THE CORE INVARIANT
    /// Must hold after ANY sequence of operations
    pub fn check_invariant(&self) -> Result<(), String> {
        let sum_user_balances: u64 = self.user_balances.values().sum();
        let calculated = pool_reserve + sum_user_balances + accumulated_fees;

        if calculated != total_system_funds {
            return Err(format!(
                "INVARIANT VIOLATION: {} + {} + {} = {} != {}",
                pool_reserve, sum_user_balances, accumulated_fees,
                calculated, total_system_funds
            ));
        }
        Ok(())
    }

    /// LP shares must sum to total_shares
    pub fn check_lp_invariant(&self) -> Result<(), String> {
        let sum_shares: u64 = self.lp_shares.values().sum();
        if sum_shares != self.total_shares {
            return Err("LP shares don't sum to total");
        }
        Ok(())
    }

    /// Execute an operation and return result
    pub fn execute(&mut self, op: Operation) -> OpResult {
        self.operation_count += 1;
        match op {
            Operation::UserDeposit { user, amount } => self.user_deposit(user, amount),
            Operation::UserWithdraw { user } => self.user_withdraw(user),
            Operation::PlaceBet { user, amount, win, multiplier_bps } =>
                self.place_bet(user, amount, win, multiplier_bps),
            Operation::LPDeposit { user, amount } => self.lp_deposit(user, amount),
            Operation::LPWithdraw { user } => self.lp_withdraw(user),
        }
    }

    // Each method mirrors exact production logic
    fn user_deposit(&mut self, user: u64, amount: u64) -> OpResult {
        // Mirror accounting.rs:170-176
        // Add amount to user balance
        // Add amount to total_system_funds
    }

    fn user_withdraw(&mut self, user: u64) -> OpResult {
        // Mirror accounting.rs:195-261
        // Check user has balance
        // Deduct from user balance
        // Deduct from total_system_funds
    }

    fn place_bet(&mut self, user: u64, amount: u64, win: bool, multiplier_bps: u64) -> OpResult {
        // Mirror game.rs:117-182
        // Check user has sufficient balance
        // Deduct bet from user
        // If win: calculate payout, check pool can afford, add to user, deduct from pool
        // If loss: add bet to pool
        // total_system_funds unchanged (internal transfer)
    }

    fn lp_deposit(&mut self, user: u64, amount: u64) -> OpResult {
        // Mirror liquidity_pool.rs:126-231
        // Calculate shares: (amount * total_shares) / pool_reserve
        // First deposit: burn MINIMUM_LIQUIDITY
        // Add shares to user
        // Add amount to pool_reserve
        // Add amount to total_system_funds
    }

    fn lp_withdraw(&mut self, user: u64) -> OpResult {
        // Mirror liquidity_pool.rs:242-369
        // Calculate payout: (shares * pool_reserve) / total_shares
        // Calculate 1% fee
        // Remove user shares
        // Deduct payout from pool_reserve
        // Add fee to accumulated_fees
        // Deduct (payout - fee) from total_system_funds
    }
}
```

### Step 4: Create stress_tests/operations.rs

**File:** `dice_backend/src/defi_accounting/tests/stress_tests/operations.rs` (NEW)

```rust
// PSEUDOCODE

#[derive(Debug, Clone, PartialEq)]
pub enum OpResult {
    Success,
    InsufficientBalance,
    InsufficientShares,
    InsufficientPoolReserve,
    BelowMinimum,
    Overflow,
    ZeroAmount,
}

#[derive(Debug, Clone)]
pub enum Operation {
    UserDeposit { user: u64, amount: u64 },
    UserWithdraw { user: u64 },
    PlaceBet { user: u64, amount: u64, win: bool, multiplier_bps: u64 },
    LPDeposit { user: u64, amount: u64 },
    LPWithdraw { user: u64 },
}
```

### Step 5: Create stress_tests/generators.rs

**File:** `dice_backend/src/defi_accounting/tests/stress_tests/generators.rs` (NEW)

```rust
// PSEUDOCODE
use proptest::prelude::*;

// User IDs 1-100 (0 reserved for burned shares)
pub fn user_id() -> impl Strategy<Value = u64> {
    1..=100u64
}

// Deposit amounts: mix of small/medium/large
pub fn deposit_amount() -> impl Strategy<Value = u64> {
    prop_oneof![
        (10_000..1_000_000u64),           // 0.01 - 1 USDT
        (1_000_000..100_000_000u64),      // 1 - 100 USDT
        (100_000_000..10_000_000_000u64), // 100 - 10,000 USDT
    ]
}

// Bet amounts: 0.01 - 10 USDT
pub fn bet_amount() -> impl Strategy<Value = u64> {
    10_000..10_000_000u64
}

// Realistic multipliers (in basis points)
pub fn multiplier_bps() -> impl Strategy<Value = u64> {
    prop_oneof![
        Just(20000),   // 2x
        Just(40000),   // 4x
        Just(100000),  // 10x
        Just(500000),  // 50x
    ]
}

// Win probability weighted toward house edge (25% wins)
pub fn win_probability() -> impl Strategy<Value = bool> {
    prop_oneof![
        3 => Just(false),  // 75% losses
        1 => Just(true),   // 25% wins
    ]
}

// Generate random operation (weighted distribution)
pub fn operation() -> impl Strategy<Value = Operation> {
    prop_oneof![
        3 => user_deposit(),   // 15%
        1 => user_withdraw(),  // 5%
        4 => place_bet(),      // 20%
        10 => lp_deposit(),    // 50%
        2 => lp_withdraw(),    // 10%
    ]
}

// Generate sequence of N operations
pub fn operation_sequence(len: usize) -> impl Strategy<Value = Vec<Operation>> {
    proptest::collection::vec(operation(), len)
}
```

### Step 6: Create stress_tests/tests.rs

**File:** `dice_backend/src/defi_accounting/tests/stress_tests/tests.rs` (NEW)

```rust
// PSEUDOCODE
use super::*;
use proptest::prelude::*;
use rand::{SeedableRng, Rng};
use rand_chacha::ChaCha8Rng;

// ============================================
// CATEGORY 1: ACCOUNTING DRIFT DETECTION
// ============================================

proptest! {
    #![proptest_config(ProptestConfig::with_cases(1000))]

    #[test]
    fn test_invariant_holds_after_100_ops(ops in operation_sequence(100)) {
        let mut model = AccountingModel::with_initial_liquidity(100_000_000);

        for (i, op) in ops.into_iter().enumerate() {
            let _ = model.execute(op);

            // Check invariant after EVERY operation
            model.check_invariant()
                .map_err(|e| format!("Op {}: {}", i, e))?;
        }
    }

    #[test]
    fn test_invariant_holds_after_1000_ops(ops in operation_sequence(1000)) {
        let mut model = AccountingModel::with_initial_liquidity(1_000_000_000);

        for op in ops {
            let _ = model.execute(op);
        }

        // Check at end
        model.check_invariant()?;
        model.check_lp_invariant()?;
    }
}

// Deterministic regression test (reproducible with seed)
#[test]
fn test_deterministic_10k_operations() {
    let mut rng = ChaCha8Rng::seed_from_u64(12345);  // Fixed seed
    let mut model = AccountingModel::with_initial_liquidity(100_000_000_000);

    for i in 0..10000 {
        let op = generate_random_op(&mut rng);
        let _ = model.execute(op);

        // Check every 100 ops
        if i % 100 == 0 {
            model.check_invariant().expect(&format!("Failed at op {}", i));
        }
    }

    model.check_invariant().expect("Final invariant check failed");
    model.check_lp_invariant().expect("Final LP invariant check failed");
}

// ============================================
// CATEGORY 2: EDGE CASE STRESS
// ============================================

#[test]
fn test_max_u64_overflow_protection() {
    let mut model = AccountingModel::new();

    // Deposit near max u64
    let huge = u64::MAX - 1000;
    let result = model.execute(Operation::UserDeposit { user: 1, amount: huge });
    assert_eq!(result, OpResult::Success);

    // Another huge deposit should fail with overflow
    let result = model.execute(Operation::UserDeposit { user: 1, amount: huge });
    assert_eq!(result, OpResult::Overflow);

    model.check_invariant().unwrap();
}

#[test]
fn test_minimum_bet_edge_cases() {
    let mut model = AccountingModel::with_initial_liquidity(100_000_000);

    // Deposit exactly MIN_BET
    model.execute(Operation::UserDeposit { user: 1, amount: 10_000 });

    // Bet exactly MIN_BET and lose
    let result = model.execute(Operation::PlaceBet {
        user: 1, amount: 10_000, win: false, multiplier_bps: 20000,
    });
    assert_eq!(result, OpResult::Success);

    // Now balance is 0, bet should fail
    let result = model.execute(Operation::PlaceBet {
        user: 1, amount: 10_000, win: false, multiplier_bps: 20000,
    });
    assert_eq!(result, OpResult::InsufficientBalance);

    model.check_invariant().unwrap();
}

#[test]
fn test_5000_small_operations_precision() {
    let mut model = AccountingModel::with_initial_liquidity(1_000_000_000_000);

    // 5000 minimum-sized operations
    for i in 0..5000 {
        let user = (i % 100 + 1) as u64;
        model.execute(Operation::UserDeposit { user, amount: 10_000 });
        model.execute(Operation::PlaceBet {
            user, amount: 10_000, win: false, multiplier_bps: 20000,
        });
    }

    // Should have zero accumulated error
    model.check_invariant().unwrap();
}

#[test]
fn test_single_decimal_precision() {
    let mut model = AccountingModel::with_initial_liquidity(100_000_000);

    // Many operations at single decimal precision (0.01 USDT = 10000 decimals)
    for i in 0..1000 {
        let user = (i % 10 + 1) as u64;
        model.execute(Operation::UserDeposit { user, amount: 10_000 });
        model.execute(Operation::PlaceBet {
            user, amount: 10_000, win: i % 3 == 0, multiplier_bps: 20000,
        });
    }

    model.check_invariant().unwrap();
}

// ============================================
// CATEGORY 3: STATE MACHINE VALIDITY
// ============================================

#[test]
fn test_cannot_withdraw_more_than_balance() {
    let mut model = AccountingModel::with_initial_liquidity(100_000_000);

    model.execute(Operation::UserDeposit { user: 1, amount: 10_000_000 });

    // Lose everything
    model.execute(Operation::PlaceBet {
        user: 1, amount: 10_000_000, win: false, multiplier_bps: 20000,
    });

    // Try to withdraw - should fail
    let result = model.execute(Operation::UserWithdraw { user: 1 });
    assert_eq!(result, OpResult::InsufficientBalance);

    model.check_invariant().unwrap();
}

#[test]
fn test_cannot_bet_more_than_balance() {
    let mut model = AccountingModel::with_initial_liquidity(100_000_000);

    model.execute(Operation::UserDeposit { user: 1, amount: 1_000_000 });

    // Try to bet more than balance
    let result = model.execute(Operation::PlaceBet {
        user: 1, amount: 10_000_000, win: false, multiplier_bps: 20000,
    });
    assert_eq!(result, OpResult::InsufficientBalance);

    model.check_invariant().unwrap();
}

#[test]
fn test_pool_cannot_go_negative() {
    let mut model = AccountingModel::with_initial_liquidity(10_000_000);  // Small pool

    // User has large balance
    model.execute(Operation::UserDeposit { user: 1, amount: 1_000_000_000 });

    // Try 100x win on 10 USDT bet - would need 990 USDT from pool (only has 10)
    let result = model.execute(Operation::PlaceBet {
        user: 1, amount: 10_000_000, win: true, multiplier_bps: 1_000_000,
    });
    assert_eq!(result, OpResult::InsufficientPoolReserve);

    model.check_invariant().unwrap();
}

#[test]
fn test_lp_share_consistency_after_many_ops() {
    let mut model = AccountingModel::new();

    // Multiple LPs deposit
    for user in 1..=10 {
        model.execute(Operation::LPDeposit {
            user,
            amount: user * 1_000_000
        });
    }

    // Run some game activity
    for _ in 0..100 {
        model.execute(Operation::UserDeposit { user: 50, amount: 1_000_000 });
        model.execute(Operation::PlaceBet {
            user: 50, amount: 100_000, win: false, multiplier_bps: 20000,
        });
    }

    // LP shares should still be consistent
    model.check_lp_invariant().unwrap();

    // Some LPs withdraw
    for user in [2, 4, 6, 8] {
        model.execute(Operation::LPWithdraw { user });
    }

    // Still consistent
    model.check_lp_invariant().unwrap();
    model.check_invariant().unwrap();
}

#[test]
fn test_withdrawal_fee_properly_tracked() {
    let mut model = AccountingModel::new();

    // LP deposits
    model.execute(Operation::LPDeposit { user: 1, amount: 100_000_000 });
    let initial_funds = model.total_system_funds;

    model.check_invariant().unwrap();

    // LP withdraws
    model.execute(Operation::LPWithdraw { user: 1 });

    // Fee should be in accumulated_fees (1% of ~99 USDT after burn)
    assert!(model.accumulated_fees > 0, "Fee should be accumulated");

    // Invariant must still hold
    model.check_invariant().unwrap();
}

// ============================================
// HELPER FUNCTIONS
// ============================================

fn generate_random_op(rng: &mut ChaCha8Rng) -> Operation {
    let op_type = rng.gen_range(0..5);
    let user = rng.gen_range(1..=100);
    let amount = rng.gen_range(10_000..10_000_000u64);

    match op_type {
        0 => Operation::UserDeposit { user, amount },
        1 => Operation::UserWithdraw { user },
        2 => Operation::PlaceBet {
            user,
            amount: amount.min(1_000_000),
            win: rng.gen_bool(0.25),
            multiplier_bps: [20000, 40000, 100000][rng.gen_range(0..3)],
        },
        3 => Operation::LPDeposit { user, amount },
        4 => Operation::LPWithdraw { user },
        _ => unreachable!(),
    }
}
```

### Step 7: Update tests/mod.rs

**File:** `dice_backend/src/defi_accounting/tests/mod.rs` (MODIFY)

```rust
// PSEUDOCODE - Add stress_tests module
mod test_serialization;
mod stress_tests;  // ADD THIS LINE
```

---

## Files Changed Summary

| File | Action | Purpose |
|------|--------|---------|
| `dice_backend/Cargo.toml` | MODIFY | Add proptest, rand, rand_chacha dev-deps |
| `dice_backend/src/defi_accounting/tests/mod.rs` | MODIFY | Add `mod stress_tests;` |
| `dice_backend/src/defi_accounting/tests/stress_tests/mod.rs` | NEW | Module declarations |
| `dice_backend/src/defi_accounting/tests/stress_tests/model.rs` | NEW | Pure Rust accounting model |
| `dice_backend/src/defi_accounting/tests/stress_tests/operations.rs` | NEW | Operation enum & results |
| `dice_backend/src/defi_accounting/tests/stress_tests/generators.rs` | NEW | proptest strategies |
| `dice_backend/src/defi_accounting/tests/stress_tests/tests.rs` | NEW | All test functions |

## What These Tests Will Catch

1. **Rounding errors** - Small amounts accumulating incorrectly
2. **Off-by-one bugs** - Edge cases in balance math
3. **Overflow/underflow** - Large numbers causing wrap-around
4. **Fee leaks** - LP fees not properly tracked
5. **Share calculation drift** - LP shares inconsistent with reserve
6. **Invalid state transitions** - Negative balances, over-withdrawals

## What These Tests Won't Catch

1. **True async race conditions** - IC executes sequentially per message
2. **Real VRF randomness** - Would need actual IC
3. **Ledger transfer failures** - External system
4. **Cross-canister timing** - Would need integration tests

## Running Tests

```bash
cd dice_backend
cargo test stress_tests -- --nocapture
cargo test deterministic_10k -- --nocapture  # Specific regression
```

## Success Criteria

All tests pass, meaning:
- Core invariant holds after any operation sequence
- No invalid states are reachable
- Edge cases handled correctly
- Deterministic test reproducible
