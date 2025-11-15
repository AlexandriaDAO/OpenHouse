# 🤖 AUTONOMOUS PR ORCHESTRATOR - DO NOT SKIP

**You are an autonomous PR orchestrator. Your ONLY job is to implement this plan and create a PR.**

## Isolation Check (RUN FIRST)
```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
if [ "$REPO_ROOT" = "/home/theseus/alexandria/openhouse" ]; then
    echo "❌ FATAL: In main repo. Must be in worktree."
    echo "Worktree: /home/theseus/alexandria/openhouse-accounting-simplify"
    exit 1
fi
echo "✅ In isolated worktree: $REPO_ROOT"
```

## Your Autonomous Workflow (NO QUESTIONS ALLOWED)
1. **Verify isolation** - You must be in worktree: `/home/theseus/alexandria/openhouse-accounting-simplify`
2. **Implement feature** - Follow plan sections below
3. **Build & Deploy to Mainnet**:
   ```bash
   # Build dice backend
   cargo build --target wasm32-unknown-unknown --release

   # Deploy to mainnet
   ./deploy.sh --dice-only
   ```

4. **Verify deployment**:
   ```bash
   # Check canister status
   dfx canister --network ic status dice_backend

   # Test accounting functions
   dfx canister --network ic call dice_backend get_accounting_stats
   dfx canister --network ic call dice_backend audit_balances
   ```

5. **Create PR** (MANDATORY):
   ```bash
   git add .
   git commit -m "refactor(accounting): remove balance caching and fix update_balance bug"
   git push -u origin refactor/accounting-simplification
   gh pr create --title "Refactor: Simplify Accounting & Fix Critical Bug" --body "Implements SIMPLIFY_ACCOUNTING.md

   **🚨 Critical Bug Fixed:**
   - update_balance() now properly updates TOTAL_USER_DEPOSITS (prevents accounting drift)

   **Changes:**
   - Removed balance caching system (~80 lines)
   - Fixed update_balance() to track totals correctly
   - Consolidated rollback logic (DRY)
   - Added memory ID constant
   - Simplified get_house_balance() to query ledger directly

   **Impact:**
   - Fixes accounting drift bug that occurred after games
   - Simpler code (400 → ~320 lines)
   - No performance impact (query calls are fast)
   - More reliable accounting

   Deployed to mainnet:
   - Dice backend: whchi-hyaaa-aaaao-a4ruq-cai"
   ```

6. **Iterate autonomously**:
   - FOR i=1 to 5:
     - Check review: `gh pr view --json comments`
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

**Branch:** `refactor/accounting-simplification`
**Worktree:** `/home/theseus/alexandria/openhouse-accounting-simplify`

---

# Implementation Plan: Simplify Accounting Module

## Task Classification
**REFACTORING**: Improve existing code → subtractive + targeted fixes

## 🚨 CRITICAL BUG TO FIX

**Problem:** `update_balance()` in accounting.rs doesn't update `TOTAL_USER_DEPOSITS`!

When game.rs calls:
```rust
accounting::update_balance(user, new_balance)?;
```

It only updates `USER_BALANCES_STABLE` but NOT `TOTAL_USER_DEPOSITS`. This causes drift:
- User bets → balance decreases → TOTAL_USER_DEPOSITS wrong → house balance wrong
- User wins → balance increases → TOTAL_USER_DEPOSITS wrong → audit fails

## Current State

**File:** `dice_backend/src/accounting.rs` (400 lines)

**Current complexity:**
- Balance caching system (lines 44-123) - ~80 lines
- Duplicate rollback logic (lines 249-256, 260-267)
- Bug in update_balance() (line 371)
- Hardcoded memory ID (line 48)

## Implementation

### File: `dice_backend/src/accounting.rs`

```rust
// PSEUDOCODE - Complete refactoring

// =============================================================================
// STEP 1: Add constants at top
// =============================================================================
use candid::{CandidType, Deserialize, Nat, Principal};
use ic_cdk::{query, update};
use ic_stable_structures::memory_manager::MemoryId;
use ic_stable_structures::StableBTreeMap;
use std::cell::RefCell;

use crate::{MEMORY_MANAGER, Memory};

// Constants
const ICP_TRANSFER_FEE: u64 = 10_000; // 0.0001 ICP in e8s
const MIN_DEPOSIT: u64 = 10_000_000; // 0.1 ICP
const MIN_WITHDRAW: u64 = 10_000_000; // 0.1 ICP
const USER_BALANCES_MEMORY_ID: u8 = 10; // Memory ID for user balances

// [Keep ICRC-1 types as-is, lines 14-41]

// =============================================================================
// STEP 2: Remove balance caching, keep only essential state
// =============================================================================
thread_local! {
    // User balances in stable storage
    static USER_BALANCES_STABLE: RefCell<StableBTreeMap<Principal, u64, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(USER_BALANCES_MEMORY_ID))),
        )
    );

    // DELETE THESE (lines 52-59):
    // static TOTAL_USER_DEPOSITS: RefCell<u64> = RefCell::new(0);
    // static CACHED_CANISTER_BALANCE: RefCell<u64> = RefCell::new(0);
    // static LAST_BALANCE_REFRESH: RefCell<u64> = RefCell::new(0);
}

// =============================================================================
// STEP 3: DELETE balance cache management functions (lines 70-123)
// =============================================================================
// DELETE: refresh_canister_balance()
// DELETE: is_balance_cache_stale()
// DELETE: get_balance_cache_age()

// =============================================================================
// STEP 4: Add helper to calculate total deposits on-demand
// =============================================================================
fn calculate_total_deposits() -> u64 {
    USER_BALANCES_STABLE.with(|balances| {
        balances.borrow()
            .iter()
            .map(|(_, balance)| balance)
            .sum()
    })
}

// =============================================================================
// STEP 5: Add helper to query canister balance from ledger
// =============================================================================
async fn get_canister_balance_from_ledger() -> Result<u64, String> {
    let account = Account {
        owner: ic_cdk::id(),
        subaccount: None,
    };

    let ledger = Principal::from_text("ryjl3-tyaaa-aaaaa-aaaba-cai").unwrap();
    let result: Result<(Nat,), _> = ic_cdk::call(ledger, "icrc1_balance_of", (account,)).await;

    match result {
        Ok((balance,)) => Ok(balance.0.try_into().unwrap_or(0)),
        Err(e) => Err(format!("Failed to query ledger balance: {:?}", e))
    }
}

// =============================================================================
// STEP 6: Add rollback helper to DRY up code
// =============================================================================
fn rollback_balance_change(user: Principal, original_balance: u64) {
    USER_BALANCES_STABLE.with(|balances| {
        balances.borrow_mut().insert(user, original_balance);
    });
}

// =============================================================================
// STEP 7: Update deposit() - remove cache refresh
// =============================================================================
#[update]
pub async fn deposit(amount: u64) -> Result<u64, String> {
    // Validation (unchanged)
    if amount < MIN_DEPOSIT {
        return Err(format!("Minimum deposit is {} ICP", MIN_DEPOSIT / 100_000_000));
    }

    let caller = ic_cdk::caller();

    // Transfer ICP (unchanged)
    let transfer_args = TransferArg {
        from_subaccount: None,
        to: Account {
            owner: ic_cdk::id(),
            subaccount: None,
        },
        amount: Nat::from(amount),
        fee: Some(Nat::from(ICP_TRANSFER_FEE)),
        memo: None,
        created_at_time: None,
    };

    let ledger = Principal::from_text("ryjl3-tyaaa-aaaaa-aaaba-cai").unwrap();
    let call_result: Result<(Result<Nat, TransferErrorIcrc>,), _> =
        ic_cdk::call(ledger, "icrc1_transfer", (transfer_args,)).await;

    match call_result {
        Ok((transfer_result,)) => match transfer_result {
            Ok(_block_index) => {
                // Credit user balance
                let new_balance = USER_BALANCES_STABLE.with(|balances| {
                    let mut balances = balances.borrow_mut();
                    let current = balances.get(&caller).unwrap_or(0);
                    let new_bal = current + amount;
                    balances.insert(caller, new_bal);
                    new_bal
                });

                // DELETE: TOTAL_USER_DEPOSITS update (line 170-172)
                // DELETE: refresh_canister_balance() call (line 175)

                ic_cdk::println!("Deposit successful: {} deposited {} e8s", caller, amount);
                Ok(new_balance)
            }
            Err(transfer_error) => {
                Err(format!("Transfer failed: {:?}", transfer_error))
            }
        }
        Err(call_error) => {
            Err(format!("Transfer call failed: {:?}", call_error))
        }
    }
}

// =============================================================================
// STEP 8: Update withdraw() - use rollback helper, remove cache
// =============================================================================
#[update]
pub async fn withdraw(amount: u64) -> Result<u64, String> {
    // Validation (unchanged)
    if amount < MIN_WITHDRAW {
        return Err(format!("Minimum withdrawal is {} ICP", MIN_WITHDRAW / 100_000_000));
    }

    let caller = ic_cdk::caller();
    let user_balance = get_balance(caller);

    if user_balance < amount {
        return Err(format!("Insufficient balance. You have {} e8s, trying to withdraw {} e8s",
                          user_balance, amount));
    }

    // Deduct balance first (prevent re-entrancy)
    let new_balance = USER_BALANCES_STABLE.with(|balances| {
        let mut balances = balances.borrow_mut();
        let new_bal = user_balance - amount;
        balances.insert(caller, new_bal);
        new_bal
    });

    // DELETE: TOTAL_USER_DEPOSITS update (lines 217-220)

    // Transfer ICP
    let transfer_args = TransferArg {
        from_subaccount: None,
        to: Account {
            owner: caller,
            subaccount: None,
        },
        amount: Nat::from(amount - ICP_TRANSFER_FEE),
        fee: Some(Nat::from(ICP_TRANSFER_FEE)),
        memo: None,
        created_at_time: None,
    };

    let ledger = Principal::from_text("ryjl3-tyaaa-aaaaa-aaaba-cai").unwrap();
    let call_result: Result<(Result<Nat, TransferErrorIcrc>,), _> =
        ic_cdk::call(ledger, "icrc1_transfer", (transfer_args,)).await;

    match call_result {
        Ok((transfer_result,)) => match transfer_result {
            Ok(_block_index) => {
                // DELETE: refresh_canister_balance() call
                ic_cdk::println!("Withdrawal successful: {} withdrew {} e8s", caller, amount);
                Ok(new_balance)
            }
            Err(transfer_error) => {
                // Use helper for rollback
                rollback_balance_change(caller, user_balance);
                Err(format!("Transfer failed: {:?}", transfer_error))
            }
        }
        Err(call_error) => {
            // Use helper for rollback
            rollback_balance_change(caller, user_balance);
            Err(format!("Transfer call failed: {:?}", call_error))
        }
    }
}

// =============================================================================
// STEP 9: Keep withdraw_all() unchanged
// =============================================================================
// [Keep as-is]

// =============================================================================
// STEP 10: Update get_house_balance() to calculate on-demand
// =============================================================================
#[update]  // Changed from query to update because it calls ledger
pub async fn get_house_balance() -> Result<u64, String> {
    // Get real canister balance from ledger
    let canister_balance = get_canister_balance_from_ledger().await?;

    // Calculate total user deposits
    let total_deposits = calculate_total_deposits();

    if canister_balance > total_deposits {
        Ok(canister_balance - total_deposits)
    } else {
        Ok(0) // Should never happen unless exploited
    }
}

// =============================================================================
// STEP 11: Update get_accounting_stats() to calculate on-demand
// =============================================================================
#[update]  // Changed from query to update because it calls ledger
pub async fn get_accounting_stats() -> Result<AccountingStats, String> {
    let total_deposits = calculate_total_deposits();
    let unique_depositors = USER_BALANCES_STABLE.with(|balances|
        balances.borrow().iter().count() as u64
    );

    let canister_balance = get_canister_balance_from_ledger().await?;
    let house_balance = if canister_balance > total_deposits {
        canister_balance - total_deposits
    } else {
        0
    };

    Ok(AccountingStats {
        total_user_deposits: total_deposits,
        house_balance,
        canister_balance,
        unique_depositors,
    })
}

// =============================================================================
// STEP 12: Update audit_balances() to use fresh data
// =============================================================================
#[update]  // Changed from query to update
pub async fn audit_balances() -> Result<String, String> {
    let total_deposits = calculate_total_deposits();
    let canister_balance = get_canister_balance_from_ledger().await
        .map_err(|e| format!("Failed to get canister balance: {}", e))?;

    let house_balance = if canister_balance > total_deposits {
        canister_balance - total_deposits
    } else {
        0
    };

    let calculated_total = house_balance + total_deposits;

    if calculated_total == canister_balance {
        Ok(format!("✅ Audit passed: house ({}) + deposits ({}) = canister ({})",
                   house_balance, total_deposits, canister_balance))
    } else {
        Err(format!("❌ Audit FAILED: house ({}) + deposits ({}) = {} != canister ({})",
                    house_balance, total_deposits, calculated_total, canister_balance))
    }
}

// =============================================================================
// STEP 13: FIX CRITICAL BUG - update_balance() must be correct
// =============================================================================
pub fn update_balance(user: Principal, new_balance: u64) -> Result<(), String> {
    USER_BALANCES_STABLE.with(|balances| {
        balances.borrow_mut().insert(user, new_balance);
    });

    // NOTE: We removed TOTAL_USER_DEPOSITS, so nothing else to update
    // Total is now calculated on-demand via calculate_total_deposits()

    Ok(())
}

// =============================================================================
// STEP 14: Simplify upgrade hooks
// =============================================================================
pub fn pre_upgrade_accounting() {
    // Nothing needed - StableBTreeMap handles persistence
}

pub fn post_upgrade_accounting() {
    // Nothing needed - we calculate totals on-demand now
}

// =============================================================================
// STEP 15: Add new helper for game.rs compatibility
// =============================================================================
#[update]
pub async fn refresh_canister_balance() -> u64 {
    // This function is called by game.rs, keep for compatibility
    // But now it just queries the ledger directly
    get_canister_balance_from_ledger().await.unwrap_or(0)
}
```

### File: `dice_backend/dice_backend.did`

```candid
// PSEUDOCODE - Update interface

service : {
  // ... other functions ...

  // Changed from query to update (now calls ledger):
  get_house_balance: () -> (variant { Ok: nat64; Err: text });
  get_accounting_stats: () -> (variant { Ok: AccountingStats; Err: text });
  audit_balances: () -> (variant { Ok: text; Err: text });

  // Remove these (no longer exist):
  // is_balance_cache_stale: (nat64) -> (bool) query;
  // get_balance_cache_age: () -> (nat64) query;
}
```

## Lines of Code Impact

**Before:** 400 lines
**After:** ~320 lines
**Reduction:** ~80 lines (20% smaller, much simpler)

## Testing After Deployment

```bash
# Test deposit
dfx canister --network ic call dice_backend deposit '(100_000_000 : nat64)'

# Test balance query
dfx canister --network ic call dice_backend get_my_balance

# Test accounting stats (now an update call)
dfx canister --network ic call dice_backend get_accounting_stats

# Test audit (now an update call)
dfx canister --network ic call dice_backend audit_balances

# Play a game to verify update_balance() works
dfx canister --network ic call dice_backend play_dice '(10_000_000 : nat64, 50 : nat8, variant { Over }, "test")'

# Verify accounting still correct after game
dfx canister --network ic call dice_backend audit_balances
```

## Deployment Notes

**Affected canister:** `whchi-hyaaa-aaaao-a4ruq-cai` (dice_backend only)

**Breaking changes:**
- `get_house_balance()` - Now returns Result, is update call
- `get_accounting_stats()` - Now returns Result, is update call
- `audit_balances()` - Now update call (queries ledger)

**Migration:** None needed - StableBTreeMap data persists

## Success Criteria

- ✅ update_balance() no longer causes drift
- ✅ All balance caching code removed (~80 lines)
- ✅ Rollback logic consolidated (DRY)
- ✅ House balance calculated correctly from ledger
- ✅ Audit passes after games are played
- ✅ PR created and merged