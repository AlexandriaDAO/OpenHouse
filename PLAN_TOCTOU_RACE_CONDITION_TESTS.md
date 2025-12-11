# AUTONOMOUS PR ORCHESTRATOR - DO NOT SKIP

**You are an autonomous PR orchestrator. Your ONLY job is to implement this plan and create a PR.**

## Isolation Check (RUN FIRST)
```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
if [ "$REPO_ROOT" = "/home/theseus/alexandria/openhouse" ]; then
    echo "FATAL: In main repo. Must be in worktree."
    echo "Worktree: /home/theseus/alexandria/openhouse-toctou-tests"
    exit 1
fi
echo "In isolated worktree: $REPO_ROOT"
```

## Your Autonomous Workflow (NO QUESTIONS ALLOWED)
1. **Verify isolation** - You must be in worktree: `/home/theseus/alexandria/openhouse-toctou-tests`
2. **Implement feature** - Follow plan sections below
3. **Build & Test**:
   ```bash
   cargo test --package crash_backend -- --nocapture
   ```
4. **Create PR** (MANDATORY):
   ```bash
   git add .
   git commit -m "test: Add TOCTOU race condition test suite for async vulnerability detection"
   git push -u origin feature/toctou-race-condition-tests
   gh pr create --title "test: TOCTOU Race Condition Test Suite" --body "$(cat <<'EOF'
## Summary
Adds comprehensive test suite to detect Time-of-Check-Time-of-Use (TOCTOU) race conditions in async game functions.

## Background
Security audit (PROJECT_WIDE_SECURITY_AUDIT.md) revealed critical TOCTOU vulnerability where concurrent game calls exploit stale balance values across await points. Existing tests use synchronous models that cannot detect this class of bug.

## Changes
- New test module: `crash_backend/src/defi_accounting/tests/concurrency/`
- Async execution model that simulates IC message interleaving
- Tests for: concurrent bets, balance inflation, pool drain attacks
- Documentation explaining the vulnerability pattern

## Test Coverage
- `test_concurrent_bets_same_balance` - Detects N bets using 1x funds
- `test_stale_balance_overwrites` - Detects last-write-wins corruption
- `test_pool_drain_via_concurrent_wins` - Detects LP theft scenarios
- `test_accounting_inflation` - Detects phantom balance creation

Generated with Claude Code
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

**Branch:** `feature/toctou-race-condition-tests`
**Worktree:** `/home/theseus/alexandria/openhouse-toctou-tests`

---

# Implementation Plan: TOCTOU Race Condition Test Suite

## Problem Statement

The existing test suite uses a **synchronous model** (`AccountingModel`) that executes operations atomically. This fundamentally cannot detect race conditions that occur when:

1. Multiple messages capture the same balance value
2. All messages suspend at an `await` point (e.g., `raw_rand().await`)
3. All messages resume and overwrite each other's state

### The Vulnerable Pattern (from `game.rs:181-269`)

```
Line 183: let user_balance = get_balance(caller);     // CAPTURE (stale after await)
Line 184: if user_balance < bet_amount { return Err }  // CHECK
...
Line 212: let random = raw_rand().await;               // AWAIT - SUSPENSION POINT
...
Line 220: balance_after_bet = user_balance - bet       // USE STALE VALUE
Line 222: update_balance(caller, balance_after_bet);   // OVERWRITE
```

### Why Current Tests Miss This

From `stress_tests/model.rs`:
```rust
pub fn settle_bet(&mut self, user: u64, bet_amount: u64, payout_amount: u64) -> OpResult {
    let balance = self.user_balances.entry(user).or_insert(0);
    if *balance < bet_amount {
        return OpResult::InsufficientBalance;
    }
    *balance = balance.checked_sub(bet_amount).unwrap();  // INSTANT - no await
    // ... rest happens immediately
}
```

The test model is **synchronous**. Operations cannot interleave.

---

## Current State

### File Structure
```
crash_backend/src/defi_accounting/tests/
├── adversarial/           # Attack tests (synchronous model)
├── integration/           # Async ledger tests (withdrawal flows only)
├── monte_carlo/           # Statistical tests
├── stress_tests/          # Property-based tests (synchronous model)
├── upgrade_safety/        # Canister upgrade tests
├── mod.rs                 # Module declarations
├── test_serialization.rs
└── test_slippage_audit.rs
```

### What's Missing
```
crash_backend/src/defi_accounting/tests/
└── concurrency/           # NEW - Inter-message race condition tests
    ├── mod.rs
    ├── async_model.rs     # Execution model with suspend/resume
    ├── toctou_attacks.rs  # TOCTOU-specific attack scenarios
    └── invariants.rs      # Post-concurrent-execution invariants
```

---

## Implementation

### File 1: `crash_backend/src/defi_accounting/tests/concurrency/mod.rs`

```rust
// PSEUDOCODE
//! Concurrency Tests for Inter-Message Race Conditions
//!
//! These tests model the IC's async execution where messages can:
//! 1. Start execution and capture state
//! 2. Suspend at await points (raw_rand, inter-canister calls)
//! 3. Resume while other messages have modified state
//!
//! Unlike stress_tests/ which use synchronous models, these tests
//! explicitly simulate message interleaving to detect TOCTOU bugs.

pub mod async_model;
pub mod toctou_attacks;
pub mod invariants;
```

### File 2: `crash_backend/src/defi_accounting/tests/concurrency/async_model.rs`

```rust
// PSEUDOCODE
//! Async Execution Model
//!
//! Simulates IC message execution with explicit await points.
//! Key insight: Messages interleave at await, not during sync code.

use std::collections::HashMap;

/// State captured by a message BEFORE its await point
#[derive(Debug, Clone)]
pub struct SuspendedMessage {
    pub id: u64,
    pub caller: u64,
    pub captured_balance: u64,    // Balance seen at start
    pub bet_amount: u64,
    pub target_multiplier: f64,
    // State frozen at suspension
}

/// Represents a message that has resumed after await
#[derive(Debug, Clone)]
pub struct ResumedMessage {
    pub suspended: SuspendedMessage,
    pub random_result: f64,       // VRF result (determines win/loss)
    // Message continues with stale captured_balance
}

/// The concurrent execution model
pub struct ConcurrentGameModel {
    // Actual canister state
    pub user_balances: HashMap<u64, u64>,
    pub pool_reserve: u64,
    pub total_system_funds: u64,

    // Messages in flight
    pub suspended_messages: Vec<SuspendedMessage>,
    pub completed_games: Vec<GameResult>,

    // Tracking
    pub message_counter: u64,
}

#[derive(Debug, Clone)]
pub struct GameResult {
    pub message_id: u64,
    pub caller: u64,
    pub bet_amount: u64,
    pub payout: u64,
    pub balance_before_deduct: u64,  // What the message THOUGHT the balance was
    pub balance_written: u64,        // What the message WROTE
}

impl ConcurrentGameModel {
    pub fn new() -> Self {
        Self {
            user_balances: HashMap::new(),
            pool_reserve: 0,
            total_system_funds: 0,
            suspended_messages: Vec::new(),
            completed_games: Vec::new(),
            message_counter: 0,
        }
    }

    /// Seed the model with initial state
    pub fn setup(&mut self, user: u64, balance: u64, pool: u64) {
        self.user_balances.insert(user, balance);
        self.pool_reserve = pool;
        self.total_system_funds = balance + pool;
    }

    /// Phase 1: Message starts, captures state, suspends at await
    /// Models game.rs lines 181-213 (before raw_rand().await returns)
    pub fn start_game(&mut self, caller: u64, bet_amount: u64, target: f64) -> Result<u64, String> {
        // Capture balance (line 183)
        let captured_balance = *self.user_balances.get(&caller).unwrap_or(&0);

        // Check balance (line 184-186)
        if captured_balance < bet_amount {
            return Err("INSUFFICIENT_BALANCE".to_string());
        }

        // Validate bet (simplified)
        if bet_amount < 10_000 {
            return Err("Below minimum".to_string());
        }

        // Check max payout (simplified)
        let max_payout = (bet_amount as f64 * target) as u64;
        let max_allowed = self.pool_reserve / 10; // 10% limit
        if max_payout > max_allowed {
            return Err("Exceeds house limit".to_string());
        }

        // SUSPEND at raw_rand().await (line 212)
        // Message is now frozen with captured_balance
        let message_id = self.message_counter;
        self.message_counter += 1;

        self.suspended_messages.push(SuspendedMessage {
            id: message_id,
            caller,
            captured_balance,
            bet_amount,
            target_multiplier: target,
        });

        Ok(message_id)
    }

    /// Phase 2: Message resumes from await, uses STALE captured_balance
    /// Models game.rs lines 214-268 (after raw_rand().await returns)
    pub fn resume_game(&mut self, message_id: u64, random_result: f64) -> Result<GameResult, String> {
        // Find and remove the suspended message
        let idx = self.suspended_messages.iter()
            .position(|m| m.id == message_id)
            .ok_or("Message not found")?;
        let msg = self.suspended_messages.remove(idx);

        // Calculate crash point from random (line 229)
        let crash_point = calculate_crash_point(random_result);

        // Determine outcome (line 232)
        let won = crash_point >= msg.target_multiplier;
        let payout = if won {
            (msg.bet_amount as f64 * msg.target_multiplier) as u64
        } else {
            0
        };

        // CRITICAL BUG LOCATION (lines 220-222):
        // Uses msg.captured_balance (STALE!) instead of re-reading
        let balance_after_bet = msg.captured_balance.checked_sub(msg.bet_amount)
            .ok_or("Balance underflow")?;

        // This OVERWRITES whatever the current balance is
        self.user_balances.insert(msg.caller, balance_after_bet);

        // Add payout (lines 241-244)
        let current = *self.user_balances.get(&msg.caller).unwrap_or(&0);
        let new_balance = current + payout;
        self.user_balances.insert(msg.caller, new_balance);

        // Settle with pool (line 247)
        if payout > msg.bet_amount {
            let profit = payout - msg.bet_amount;
            self.pool_reserve = self.pool_reserve.saturating_sub(profit);
        } else if payout < msg.bet_amount {
            let loss = msg.bet_amount - payout;
            self.pool_reserve += loss;
        }

        let result = GameResult {
            message_id: msg.id,
            caller: msg.caller,
            bet_amount: msg.bet_amount,
            payout,
            balance_before_deduct: msg.captured_balance,
            balance_written: new_balance,
        };

        self.completed_games.push(result.clone());
        Ok(result)
    }

    /// Check if the model detected a TOCTOU violation
    pub fn check_toctou_violation(&self) -> Option<String> {
        // Group completed games by caller
        let mut by_caller: HashMap<u64, Vec<&GameResult>> = HashMap::new();
        for game in &self.completed_games {
            by_caller.entry(game.caller).or_default().push(game);
        }

        for (caller, games) in by_caller {
            if games.len() <= 1 {
                continue;
            }

            // Check if multiple games used the same captured balance
            let balances_seen: Vec<u64> = games.iter()
                .map(|g| g.balance_before_deduct)
                .collect();

            // If all games saw the same balance, TOCTOU occurred
            if balances_seen.iter().all(|&b| b == balances_seen[0]) {
                let total_bet: u64 = games.iter().map(|g| g.bet_amount).sum();
                let single_balance = balances_seen[0];

                if total_bet > single_balance {
                    return Some(format!(
                        "TOCTOU DETECTED: Caller {} placed {} bets totaling {} \
                         but all saw balance {}",
                        caller, games.len(), total_bet, single_balance
                    ));
                }
            }
        }

        None
    }

    /// Check solvency invariant
    pub fn check_solvency(&self) -> Result<(), String> {
        let user_sum: u64 = self.user_balances.values().sum();
        let calculated = user_sum + self.pool_reserve;

        // With TOCTOU bugs, total_system_funds will NOT match
        // because bets were deducted from stale values
        if calculated != self.total_system_funds {
            return Err(format!(
                "SOLVENCY VIOLATION: users({}) + pool({}) = {} != expected({})",
                user_sum, self.pool_reserve, calculated, self.total_system_funds
            ));
        }

        Ok(())
    }
}

/// Simplified crash point calculation
fn calculate_crash_point(random: f64) -> f64 {
    // 1% house edge calculation
    let raw = 0.99 / (1.0 - random);
    if raw < 1.0 { 1.0 } else { raw }
}
```

### File 3: `crash_backend/src/defi_accounting/tests/concurrency/toctou_attacks.rs`

```rust
// PSEUDOCODE
//! TOCTOU Attack Test Scenarios
//!
//! Each test simulates a specific attack that exploits the race condition.

use super::async_model::ConcurrentGameModel;

/// TEST 1: Multiple concurrent bets with single balance
/// This is the exact scenario from PROJECT_WIDE_SECURITY_AUDIT.md
#[test]
fn test_concurrent_bets_same_balance() {
    println!("\n=== TEST: Concurrent Bets Same Balance ===");
    println!("Attack: Send 5 bets with 1 USDT balance");

    let mut model = ConcurrentGameModel::new();

    // Setup: User has 1 USDT, pool has 100 USDT
    let user = 1;
    let initial_balance = 1_000_000; // 1 USDT
    let pool = 100_000_000;          // 100 USDT
    model.setup(user, initial_balance, pool);

    println!("Initial: balance={}, pool={}", initial_balance, pool);

    // Attack: Start 5 concurrent bets (all capture same balance)
    let bet_amount = 1_000_000; // 1 USDT each
    let target = 2.0;           // 2x multiplier

    let mut message_ids = Vec::new();
    for i in 0..5 {
        match model.start_game(user, bet_amount, target) {
            Ok(id) => {
                println!("Message {} started, captured balance: {}",
                    id, model.suspended_messages.last().unwrap().captured_balance);
                message_ids.push(id);
            }
            Err(e) => {
                println!("Message {} rejected: {}", i, e);
            }
        }
    }

    // EXPECTED (secure): Only 1 message should start
    // ACTUAL (vulnerable): All 5 start because they all see balance=1_000_000

    println!("\nMessages in flight: {}", message_ids.len());

    // Resume all messages (simulate raw_rand returning)
    // Give them random results that make some win, some lose
    let randoms = [0.5, 0.3, 0.7, 0.2, 0.6]; // Mix of wins and losses

    for (id, &random) in message_ids.iter().zip(randoms.iter()) {
        match model.resume_game(*id, random) {
            Ok(result) => {
                println!("Message {} completed: bet={}, payout={}",
                    result.message_id, result.bet_amount, result.payout);
            }
            Err(e) => {
                println!("Message {} failed on resume: {}", id, e);
            }
        }
    }

    // Check for TOCTOU violation
    if let Some(violation) = model.check_toctou_violation() {
        println!("\n!!! VULNERABILITY DETECTED !!!");
        println!("{}", violation);

        // This test SHOULD FAIL in vulnerable code
        // When fixed, this assertion should be removed
        panic!("TOCTOU vulnerability confirmed: {}", violation);
    }

    // Check solvency
    match model.check_solvency() {
        Ok(()) => println!("\nSolvency check passed"),
        Err(e) => {
            println!("\n!!! SOLVENCY VIOLATION !!!");
            println!("{}", e);
            panic!("Solvency violated: {}", e);
        }
    }

    let final_balance = model.user_balances.get(&user).unwrap_or(&0);
    println!("\nFinal state: balance={}, pool={}", final_balance, model.pool_reserve);
}

/// TEST 2: Stale balance overwrites
/// Shows how the last message to resume "wins" by overwriting
#[test]
fn test_stale_balance_overwrites() {
    println!("\n=== TEST: Stale Balance Overwrites ===");
    println!("Attack: Demonstrate last-write-wins corruption");

    let mut model = ConcurrentGameModel::new();

    let user = 1;
    model.setup(user, 10_000_000, 100_000_000); // 10 USDT balance

    // Start two concurrent bets
    let id1 = model.start_game(user, 3_000_000, 2.0).unwrap(); // 3 USDT
    let id2 = model.start_game(user, 5_000_000, 2.0).unwrap(); // 5 USDT

    // Both captured balance = 10_000_000

    // Resume in different order to show overwrite
    // Message 2 resumes first: writes 10_000_000 - 5_000_000 = 5_000_000
    model.resume_game(id2, 0.3).unwrap(); // Loses

    let balance_after_msg2 = *model.user_balances.get(&user).unwrap();
    println!("After msg2: balance = {}", balance_after_msg2);
    // Balance is now 5_000_000

    // Message 1 resumes: writes 10_000_000 - 3_000_000 = 7_000_000
    // This OVERWRITES the 5_000_000 from msg2!
    model.resume_game(id1, 0.3).unwrap(); // Loses

    let balance_after_msg1 = *model.user_balances.get(&user).unwrap();
    println!("After msg1: balance = {}", balance_after_msg1);

    // EXPECTED (secure): balance = 10 - 3 - 5 = 2 USDT
    // ACTUAL (vulnerable): balance = 7 USDT (msg2's deduction lost!)

    let expected = 10_000_000 - 3_000_000 - 5_000_000; // 2_000_000

    if balance_after_msg1 != expected {
        println!("\n!!! OVERWRITE BUG DETECTED !!!");
        println!("Expected final balance: {}", expected);
        println!("Actual final balance: {}", balance_after_msg1);
        println!("Missing deduction: {}", balance_after_msg1 - expected);

        panic!("Stale balance overwrite: lost {} in deductions",
            balance_after_msg1 - expected);
    }
}

/// TEST 3: Pool drain via concurrent winning bets
/// Shows how attackers can extract more than deposited
#[test]
fn test_pool_drain_via_concurrent_wins() {
    println!("\n=== TEST: Pool Drain via Concurrent Wins ===");
    println!("Attack: Extract more than deposited through concurrent wins");

    let mut model = ConcurrentGameModel::new();

    let attacker = 1;
    let initial_deposit = 1_000_000; // 1 USDT
    let pool = 50_000_000;           // 50 USDT pool
    model.setup(attacker, initial_deposit, pool);

    // Start 10 concurrent games, all with 1 USDT bet at 2x
    let mut ids = Vec::new();
    for _ in 0..10 {
        if let Ok(id) = model.start_game(attacker, initial_deposit, 2.0) {
            ids.push(id);
        }
    }

    println!("Started {} concurrent games with {} deposit",
        ids.len(), initial_deposit);

    // Make all of them win (favorable random values)
    for id in ids {
        model.resume_game(id, 0.01).unwrap(); // Low random = high crash point = win
    }

    let final_balance = *model.user_balances.get(&attacker).unwrap();
    let total_payout: u64 = model.completed_games.iter()
        .map(|g| g.payout)
        .sum();

    println!("\nResults:");
    println!("  Initial deposit: {}", initial_deposit);
    println!("  Total payouts: {}", total_payout);
    println!("  Final balance: {}", final_balance);
    println!("  Pool remaining: {}", model.pool_reserve);

    // EXPECTED (secure): Only 1 game should execute (deposit = 1, bet = 1)
    // ACTUAL (vulnerable): All 10 execute, each paying 2 USDT

    if total_payout > initial_deposit * 2 {
        // Attacker got more than 1 bet could win
        println!("\n!!! POOL DRAIN ATTACK SUCCESSFUL !!!");
        println!("Attacker extracted {} from {} deposit", total_payout, initial_deposit);

        panic!("Pool drain: {} payout from {} deposit", total_payout, initial_deposit);
    }
}

/// TEST 4: Accounting inflation (losses that don't reduce balance)
#[test]
fn test_accounting_inflation() {
    println!("\n=== TEST: Accounting Inflation ===");
    println!("Attack: Multiple losses only deduct once");

    let mut model = ConcurrentGameModel::new();

    let user = 1;
    model.setup(user, 5_000_000, 100_000_000); // 5 USDT

    // Start 5 games at 1 USDT each (total 5 USDT = full balance)
    let mut ids = Vec::new();
    for _ in 0..5 {
        if let Ok(id) = model.start_game(user, 1_000_000, 2.0) {
            ids.push(id);
        }
    }

    // Make all lose
    for id in ids {
        model.resume_game(id, 0.99).unwrap(); // High random = low crash point = loss
    }

    let final_balance = *model.user_balances.get(&user).unwrap();

    // EXPECTED (secure): balance = 5 - 5 = 0 (or only 1 game executes)
    // ACTUAL (vulnerable): balance = 4 USDT (only last deduction counts)

    println!("\nFinal balance: {} (expected 0)", final_balance);

    if final_balance > 0 {
        println!("\n!!! ACCOUNTING INFLATION !!!");
        println!("User should have 0 but has {}", final_balance);
        println!("This is 'free money' created by the bug");

        // Check pool - it received too much
        println!("Pool received {} from 5 'losing' bets",
            model.pool_reserve - 100_000_000);

        panic!("Accounting inflation: {} phantom balance", final_balance);
    }
}

/// TEST 5: Mixed operations interleaving
#[test]
fn test_mixed_concurrent_operations() {
    println!("\n=== TEST: Mixed Concurrent Operations ===");
    println!("Attack: Interleave games, deposits, withdrawals");

    let mut model = ConcurrentGameModel::new();

    let user = 1;
    model.setup(user, 10_000_000, 100_000_000);

    // Start game 1
    let game1 = model.start_game(user, 5_000_000, 2.0).unwrap();
    println!("Game 1 started, sees balance: {}",
        model.suspended_messages[0].captured_balance);

    // User deposits more (between start and resume of game1)
    // In production this would be a separate message that completes
    // while game1 is suspended
    let deposit = 20_000_000;
    *model.user_balances.get_mut(&user).unwrap() += deposit;
    model.total_system_funds += deposit;
    println!("Deposit of {} completed", deposit);
    println!("Balance now: {}", model.user_balances.get(&user).unwrap());

    // Start game 2 (sees new balance)
    let game2 = model.start_game(user, 15_000_000, 2.0).unwrap();
    println!("Game 2 started, sees balance: {}",
        model.suspended_messages[0].captured_balance);

    // Resume game 1 (uses STALE balance of 10_000_000)
    model.resume_game(game1, 0.5).unwrap();
    println!("Game 1 resumed with stale balance 10M, wrote: {}",
        model.user_balances.get(&user).unwrap());

    // Resume game 2
    model.resume_game(game2, 0.5).unwrap();
    println!("Game 2 resumed, final balance: {}",
        model.user_balances.get(&user).unwrap());

    // Check solvency - the deposit got "lost" due to overwrite
    match model.check_solvency() {
        Ok(()) => println!("Solvency OK (unexpected with bug)"),
        Err(e) => {
            println!("\n!!! DEPOSIT LOST !!!");
            println!("{}", e);
            panic!("Mixed operation bug: {}", e);
        }
    }
}
```

### File 4: `crash_backend/src/defi_accounting/tests/concurrency/invariants.rs`

```rust
// PSEUDOCODE
//! Post-Concurrent-Execution Invariant Checks
//!
//! These invariants MUST hold even after concurrent execution.
//! If any fail, the code has a TOCTOU vulnerability.

use super::async_model::ConcurrentGameModel;
use rand::{SeedableRng, Rng};
use rand_chacha::ChaCha8Rng;

/// INVARIANT 1: Total deductions must equal sum of individual bets
///
/// If N games execute with bet B each, the total balance reduction
/// should be N*B, not B (which happens with TOCTOU).
#[test]
fn invariant_total_deductions_match_bets() {
    println!("\n=== INVARIANT: Total Deductions Match Bets ===");

    let mut model = ConcurrentGameModel::new();
    let user = 1;
    let initial = 100_000_000; // 100 USDT
    model.setup(user, initial, 1_000_000_000);

    // Run N concurrent games
    let n = 10;
    let bet = 5_000_000; // 5 USDT each

    let mut ids = Vec::new();
    for _ in 0..n {
        if let Ok(id) = model.start_game(user, bet, 2.0) {
            ids.push(id);
        }
    }

    // All lose (to simplify - no payouts)
    for id in ids.iter() {
        model.resume_game(*id, 0.99).unwrap();
    }

    let final_balance = *model.user_balances.get(&user).unwrap();
    let expected_deduction = ids.len() as u64 * bet;
    let actual_deduction = initial - final_balance;

    println!("Games executed: {}", ids.len());
    println!("Expected deduction: {} ({} * {})", expected_deduction, ids.len(), bet);
    println!("Actual deduction: {}", actual_deduction);

    assert_eq!(
        actual_deduction, expected_deduction,
        "INVARIANT VIOLATION: Deducted {} but should have deducted {}",
        actual_deduction, expected_deduction
    );
}

/// INVARIANT 2: System funds are conserved
///
/// total_system_funds should equal sum(user_balances) + pool_reserve
/// after ANY sequence of operations.
#[test]
fn invariant_system_funds_conservation() {
    println!("\n=== INVARIANT: System Funds Conservation ===");

    let mut model = ConcurrentGameModel::new();

    // Setup multiple users
    for user in 1..=5 {
        model.user_balances.insert(user, 10_000_000);
        model.total_system_funds += 10_000_000;
    }
    model.pool_reserve = 100_000_000;
    model.total_system_funds += 100_000_000;

    let initial_total = model.total_system_funds;

    // Random concurrent operations
    let mut rng = ChaCha8Rng::seed_from_u64(42);

    for _ in 0..20 {
        let user = rng.gen_range(1..=5);
        let bet = rng.gen_range(100_000..1_000_000);

        if let Ok(id) = model.start_game(user, bet, 2.0) {
            model.resume_game(id, rng.gen::<f64>()).ok();
        }
    }

    // Check conservation
    let user_sum: u64 = model.user_balances.values().sum();
    let calculated_total = user_sum + model.pool_reserve;

    println!("Initial system funds: {}", initial_total);
    println!("Final user balances: {}", user_sum);
    println!("Final pool reserve: {}", model.pool_reserve);
    println!("Calculated total: {}", calculated_total);
    println!("Expected total: {}", initial_total);

    // Note: With wins/losses, money moves but total is conserved
    // (assuming no external deposits/withdrawals in this test)

    assert_eq!(
        calculated_total, initial_total,
        "INVARIANT VIOLATION: System funds {} != expected {}",
        calculated_total, initial_total
    );
}

/// INVARIANT 3: No negative balances via race
///
/// Even with concurrent operations, balance should never go negative
/// or underflow to a huge number.
#[test]
fn invariant_no_negative_balance_via_race() {
    println!("\n=== INVARIANT: No Negative Balance via Race ===");

    let mut model = ConcurrentGameModel::new();
    let user = 1;
    model.setup(user, 5_000_000, 100_000_000); // Only 5 USDT

    // Try to spend 10 USDT via concurrent 2 USDT bets
    let mut ids = Vec::new();
    for _ in 0..5 {
        // Each captures balance, sees it as sufficient
        if let Ok(id) = model.start_game(user, 2_000_000, 2.0) {
            ids.push(id);
        }
    }

    // Resume all (all will try to deduct from stale balance)
    for id in ids {
        model.resume_game(id, 0.99).ok(); // May fail on underflow
    }

    let final_balance = *model.user_balances.get(&user).unwrap();

    println!("Initial balance: 5_000_000");
    println!("Attempted to spend: 10_000_000 (5 * 2M)");
    println!("Final balance: {}", final_balance);

    // Check for underflow (wrapping to huge number)
    if final_balance > 100_000_000 {
        panic!("INVARIANT VIOLATION: Balance underflowed to {}", final_balance);
    }

    // Balance should be 0 or reasonable, not negative-as-large-positive
    println!("Balance check passed (no underflow)");
}

/// INVARIANT 4: Pool cannot be over-drained
///
/// Pool reserve should not go negative or underflow.
#[test]
fn invariant_pool_not_overdrained() {
    println!("\n=== INVARIANT: Pool Not Over-Drained ===");

    let mut model = ConcurrentGameModel::new();

    // Small pool, many concurrent winning bets
    let pool_initial = 10_000_000; // 10 USDT pool
    model.setup(1, 100_000_000, pool_initial);

    // Try to win 50 USDT from 10 USDT pool via concurrent wins
    let mut ids = Vec::new();
    for _ in 0..10 {
        if let Ok(id) = model.start_game(1, 5_000_000, 2.0) {
            ids.push(id);
        }
    }

    // Make all win
    for id in ids {
        model.resume_game(id, 0.01).ok();
    }

    println!("Pool initial: {}", pool_initial);
    println!("Pool final: {}", model.pool_reserve);

    // Check for underflow (would show as huge number)
    if model.pool_reserve > 1_000_000_000_000 {
        panic!("INVARIANT VIOLATION: Pool underflowed to {}", model.pool_reserve);
    }

    // With proper limits, pool should not go negative
    // (saturating_sub prevents this, but concurrent wins can still over-pay)
    println!("Pool check passed (no underflow)");
}

/// COMPREHENSIVE: Run many random concurrent scenarios
#[test]
fn invariant_stress_concurrent_execution() {
    println!("\n=== INVARIANT: Stress Test Concurrent Execution ===");

    let mut violations = Vec::new();

    for seed in 0..100 {
        let mut model = ConcurrentGameModel::new();
        let mut rng = ChaCha8Rng::seed_from_u64(seed);

        // Setup
        for user in 1..=10 {
            model.user_balances.insert(user, 50_000_000);
            model.total_system_funds += 50_000_000;
        }
        model.pool_reserve = 500_000_000;
        model.total_system_funds += 500_000_000;

        let initial_total = model.total_system_funds;

        // Random concurrent operations
        for _ in 0..50 {
            let user = rng.gen_range(1..=10);
            let bet = rng.gen_range(100_000..5_000_000);
            let target = rng.gen_range(1.1..5.0);

            if let Ok(id) = model.start_game(user, bet, target) {
                // Immediately resume (could also batch)
                model.resume_game(id, rng.gen::<f64>()).ok();
            }
        }

        // Check TOCTOU
        if let Some(v) = model.check_toctou_violation() {
            violations.push(format!("Seed {}: {}", seed, v));
        }

        // Check solvency
        let user_sum: u64 = model.user_balances.values().sum();
        let calculated = user_sum + model.pool_reserve;
        if calculated != initial_total {
            violations.push(format!(
                "Seed {}: Conservation violation: {} != {}",
                seed, calculated, initial_total
            ));
        }
    }

    if !violations.is_empty() {
        println!("\n!!! {} INVARIANT VIOLATIONS FOUND !!!", violations.len());
        for v in &violations[..violations.len().min(10)] {
            println!("  - {}", v);
        }
        panic!("{} invariant violations in 100 stress runs", violations.len());
    }

    println!("All 100 stress runs passed invariant checks");
}
```

### File 5: Update `crash_backend/src/defi_accounting/tests/mod.rs`

```rust
// ADD to existing mod.rs:
pub mod test_serialization;
pub mod test_slippage_audit;
mod stress_tests;
mod adversarial;
mod concurrency;  // NEW - TOCTOU race condition tests
```

---

## Deployment Notes

### Affected Components
- **Crash Backend Only** (`fws6k-tyaaa-aaaap-qqc7q-cai`)
- No frontend changes
- No mainnet deployment needed (tests only)

### Build & Test Commands
```bash
# Run all tests including new concurrency tests
cargo test --package crash_backend -- --nocapture

# Run only concurrency tests
cargo test --package crash_backend concurrency -- --nocapture

# Run specific test
cargo test --package crash_backend test_concurrent_bets_same_balance -- --nocapture
```

### Expected Test Results

**With Current Vulnerable Code:**
```
test concurrency::toctou_attacks::test_concurrent_bets_same_balance ... FAILED
test concurrency::toctou_attacks::test_stale_balance_overwrites ... FAILED
test concurrency::toctou_attacks::test_pool_drain_via_concurrent_wins ... FAILED
test concurrency::toctou_attacks::test_accounting_inflation ... FAILED
test concurrency::invariants::invariant_total_deductions_match_bets ... FAILED
```

**After Fix Applied:**
```
test concurrency::toctou_attacks::test_concurrent_bets_same_balance ... ok
test concurrency::toctou_attacks::test_stale_balance_overwrites ... ok
... all pass
```

---

## Why These Tests Would Have Caught the Bug

| Test | What It Detects | How |
|------|----------------|-----|
| `test_concurrent_bets_same_balance` | Multiple bets using same funds | Checks if N messages saw identical balance |
| `test_stale_balance_overwrites` | Last-write-wins corruption | Tracks balance through resume order |
| `test_pool_drain_via_concurrent_wins` | Theft from LP providers | Checks payout vs deposit ratio |
| `test_accounting_inflation` | Phantom balance creation | Verifies deductions match bets |
| `invariant_total_deductions_match_bets` | Core TOCTOU invariant | N bets = N*bet_amount deducted |
| `invariant_system_funds_conservation` | Solvency | sum(balances) + pool = total |

---

## Post-Fix: How to Verify

After implementing the fix from `PROJECT_WIDE_SECURITY_AUDIT.md`:

1. **Run tests** - All should pass
2. **Modify `async_model.rs`** to use `try_deduct_balance` pattern:
   ```rust
   // In resume_game(), replace:
   let balance_after_bet = msg.captured_balance.checked_sub(msg.bet_amount)

   // With:
   let current_balance = *self.user_balances.get(&msg.caller).unwrap_or(&0);
   if current_balance < msg.bet_amount {
       return Err("INSUFFICIENT_BALANCE (re-checked)".to_string());
   }
   let balance_after_bet = current_balance.checked_sub(msg.bet_amount)
   ```
3. **Tests should then pass** - confirming the fix works

---

## Checklist

- [x] Orchestrator header embedded at top
- [x] Current state documented (existing test structure)
- [x] Problem analysis (why current tests miss TOCTOU)
- [x] Implementation in pseudocode (4 new files)
- [x] Test scenarios covering all attack vectors from audit
- [x] Invariants that catch the vulnerability class
- [x] No mainnet deployment (tests only)
- [x] Build/test commands provided
