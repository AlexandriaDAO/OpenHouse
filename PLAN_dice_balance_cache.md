# AUTONOMOUS PR ORCHESTRATOR - DO NOT SKIP

**You are an autonomous PR orchestrator. Your ONLY job is to implement this plan and create a PR.**

## Isolation Check (RUN FIRST)
```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
if [ "$REPO_ROOT" = "/home/theseus/alexandria/openhouse" ]; then
    echo "FATAL: In main repo. Must be in worktree."
    echo "Worktree: /home/theseus/alexandria/openhouse-dice-perf"
    exit 1
fi
echo "In isolated worktree: $REPO_ROOT"
```

## Your Autonomous Workflow (NO QUESTIONS ALLOWED)
1. **Verify isolation** - You must be in worktree: `/home/theseus/alexandria/openhouse-dice-perf`
2. **Implement feature** - Follow plan sections below
3. **Build & Deploy to Mainnet**:
   ```bash
   cargo build --target wasm32-unknown-unknown --release -p dice_backend
   ./deploy.sh --dice-only
   ```
4. **Verify deployment**:
   ```bash
   dfx canister --network ic status dice_backend
   echo "Test: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io/dice"
   ```
5. **Create PR** (MANDATORY):
   ```bash
   git add .
   git commit -m "perf(dice): add balance cache tracking for faster solvency checks"
   git push -u origin feature/dice-remove-balance-query
   gh pr create --title "Perf: Add balance cache tracking to Dice backend" --body "$(cat <<'EOF'
## Summary
Applies the same balance caching optimization from Plinko (PR #168) to Dice backend.

- Adds `increment_cached_balance` / `decrement_cached_balance` functions
- Tracks balance changes on deposit/withdraw success paths
- Adds hourly reconciliation timer for safety
- Initializes cache on init/post_upgrade via zero-delay timer

## Context
The dice backend currently has a stale cache problem:
- `CACHED_CANISTER_BALANCE` starts at 0 after upgrade
- Only updated via `admin_health_check` (which queries the ledger)
- `is_canister_solvent()` uses this stale cache
- Games could be blocked unnecessarily after upgrades

This mirrors the fix applied to plinko_backend in PR #168.

## Changes
- `accounting.rs`: Add increment/decrement functions, reconciliation timer
- `liquidity_pool.rs`: Track balance on LP deposit/withdraw success
- `lib.rs`: Start reconciliation timer, init cache on startup

## Test plan
- [ ] Play dice game - should work immediately after deployment
- [ ] Deposit funds - balance tracking should update
- [ ] Withdraw funds - balance tracking should update
- [ ] Check admin_health_check - should show correct balance

Deployed to mainnet:
- Dice Backend: whchi-hyaaa-aaaao-a4ruq-cai

Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
   ```
6. **Iterate autonomously** on review feedback

## CRITICAL RULES
- NO questions ("should I?", "want me to?", "is it done?")
- NO skipping PR creation - it's MANDATORY
- After implementation: create PR immediately

**Branch:** `feature/dice-remove-balance-query`
**Worktree:** `/home/theseus/alexandria/openhouse-dice-perf`

---

# Implementation Plan: Add Balance Cache Tracking to Dice Backend

## Problem

The dice_backend has a stale `CACHED_CANISTER_BALANCE` that:
1. Starts at 0 after every canister upgrade
2. Is only updated when `admin_health_check` is called (which queries the ledger)
3. Is used in `is_canister_solvent()` to gate game play
4. Has no reconciliation timer

This means games could be blocked after upgrades until an admin calls the health check.

## Solution

Apply the same fix from plinko_backend (PR #168):
1. Track balance internally when deposits/withdrawals succeed
2. Add hourly reconciliation timer
3. Initialize cache on init/post_upgrade

---

## Files to Modify

### 1. `dice_backend/src/defi_accounting/accounting.rs`

**Add after line 59 (after PARENT_TIMER definition):**

```rust
static RECONCILIATION_TIMER: RefCell<Option<ic_cdk_timers::TimerId>> = const { RefCell::new(None) };
```

**Add after line 66 (after TransferResult enum), new section:**

```rust
// =============================================================================
// CACHED BALANCE TRACKING
// =============================================================================

/// Increment cached balance after successful deposit.
/// Called when ckUSDT is received by the canister.
pub(crate) fn increment_cached_balance(amount: u64) {
    CACHED_CANISTER_BALANCE.with(|cache| {
        let mut c = cache.borrow_mut();
        *c = c.saturating_add(amount);
    });
}

/// Decrement cached balance after successful withdrawal.
/// Called when ckUSDT is sent from the canister.
pub(crate) fn decrement_cached_balance(amount: u64) {
    CACHED_CANISTER_BALANCE.with(|cache| {
        let mut c = cache.borrow_mut();
        *c = c.saturating_sub(amount);
    });
}
```

**Update deposit() success path (~line 171, after `balances.insert(caller, new_bal);`):**

Add before the println:
```rust
// Update cached canister balance (canister received `amount`)
increment_cached_balance(amount);
```

**Update withdraw_internal() success path (~line 227, after `log_audit(AuditEvent::WithdrawalCompleted...)`):**

Add:
```rust
// Update cached canister balance (canister sent `balance`)
decrement_cached_balance(balance);
```

**Update retry_withdrawal() success path (~line 444, after `log_audit(AuditEvent::WithdrawalCompleted...)`):**

Add:
```rust
// Update cached canister balance (canister sent `amount`)
decrement_cached_balance(amount);
```

**Add after start_parent_withdrawal_timer() function (~line 390):**

```rust
// =============================================================================
// BALANCE RECONCILIATION TIMER
// =============================================================================

/// Start hourly timer to reconcile cached balance with actual ledger balance.
/// This is a safety mechanism to detect any drift between cached and actual balance.
pub fn start_balance_reconciliation_timer() {
    RECONCILIATION_TIMER.with(|t| {
        if t.borrow().is_some() { return; }

        // Run every hour (3600 seconds)
        let timer_id = ic_cdk_timers::set_timer_interval(Duration::from_secs(3600), || async {
            // refresh_canister_balance() queries the ledger and updates the cache
            // This automatically corrects any drift
            let _ = refresh_canister_balance().await;
        });
        *t.borrow_mut() = Some(timer_id);
    });
}
```

---

### 2. `dice_backend/src/defi_accounting/liquidity_pool.rs`

**Update deposit_liquidity() success (~line 271, after `pool_state.reserve += amount_nat;`):**

Add after the POOL_STATE update block closes:
```rust
// Update cached canister balance (canister received `amount`)
accounting::increment_cached_balance(amount);
```

**Update withdraw_liquidity() success path (~line 396, after `accounting::complete_withdrawal(caller, lp_amount);`):**

Add:
```rust
// Update cached canister balance (canister sent `lp_amount`)
accounting::decrement_cached_balance(lp_amount);
```

---

### 3. `dice_backend/src/lib.rs`

**Update init() (~line 37-46):**

```rust
#[init]
fn init() {
    // Initialize game state
    ic_cdk::println!("Dice Game Backend Initialized");

    // Start parent auto-withdrawal timer (weekly fee collection)
    defi_accounting::accounting::start_parent_withdrawal_timer();

    // Start balance reconciliation timer (hourly)
    defi_accounting::accounting::start_balance_reconciliation_timer();

    // Start daily statistics timer
    defi_accounting::start_stats_timer();

    // Initialize cached balance on fresh install using a one-shot timer
    // (spawn not allowed in init mode)
    ic_cdk_timers::set_timer(std::time::Duration::ZERO, async {
        defi_accounting::accounting::refresh_canister_balance().await;
        ic_cdk::println!("Init: balance cache initialized");
    });
}
```

**Update post_upgrade() (~line 53-63):**

```rust
#[post_upgrade]
fn post_upgrade() {
    // Start parent auto-withdrawal timer (weekly fee collection)
    defi_accounting::accounting::start_parent_withdrawal_timer();

    // Start balance reconciliation timer (hourly)
    defi_accounting::accounting::start_balance_reconciliation_timer();

    // Start daily statistics timer
    defi_accounting::start_stats_timer();

    // Initialize cached balance immediately after upgrade using a one-shot timer
    // This prevents games being blocked until hourly reconciliation
    // (spawn not allowed in post_upgrade mode)
    ic_cdk_timers::set_timer(std::time::Duration::ZERO, async {
        defi_accounting::accounting::refresh_canister_balance().await;
        ic_cdk::println!("Post-upgrade: balance cache initialized");
    });

    ic_cdk::println!("Post-upgrade: timers restarted");
}
```

---

## Summary of Changes

| File | Change |
|------|--------|
| `accounting.rs` | Add `RECONCILIATION_TIMER`, `increment_cached_balance()`, `decrement_cached_balance()`, `start_balance_reconciliation_timer()` |
| `accounting.rs` | Call `increment_cached_balance(amount)` in deposit success |
| `accounting.rs` | Call `decrement_cached_balance(balance/amount)` in withdraw/retry success |
| `liquidity_pool.rs` | Call `increment_cached_balance(amount)` in LP deposit success |
| `liquidity_pool.rs` | Call `decrement_cached_balance(lp_amount)` in LP withdraw success |
| `lib.rs` | Start reconciliation timer in init/post_upgrade |
| `lib.rs` | Initialize cache via zero-delay timer in init/post_upgrade |

## Key Points

1. **Balance only updated on SUCCESS** - Failed transfers don't change cache
2. **Hourly reconciliation** - Safety net to catch any drift
3. **Init/post_upgrade initialization** - Prevents games being blocked after restart
4. **Mirrors plinko_backend exactly** - Same pattern, same safety properties

## Expected Result

- Games work immediately after canister upgrade (no waiting for admin_health_check)
- Solvency check uses accurate cached balance
- Any drift corrected within 1 hour maximum
