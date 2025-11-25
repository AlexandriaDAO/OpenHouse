# 🤖 AUTONOMOUS PR ORCHESTRATOR - DO NOT SKIP

**You are an autonomous PR orchestrator. Your ONLY job is to implement this plan and create a PR.**

## Isolation Check (RUN FIRST)
```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
if [ "$REPO_ROOT" = "/home/theseus/alexandria/openhouse" ]; then
    echo "❌ FATAL: In main repo. Must be in worktree."
    echo "Worktree: /home/theseus/alexandria/openhouse-fix-fee-accounting"
    exit 1
fi
echo "✅ In isolated worktree: $REPO_ROOT"
```

## Your Autonomous Workflow (NO QUESTIONS ALLOWED)
1. **Verify isolation** - You must be in worktree: `/home/theseus/alexandria/openhouse-fix-fee-accounting`
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

   # Run balance check script to verify fix
   cd scripts
   ./check_balance.sh
   ```

5. **Create PR** (MANDATORY):
   ```bash
   git add .
   git commit -m "fix(dice): Correct ICRC-2 fee accounting in deposits

- Fix user deposit to credit full amount received
- Fix LP deposit to credit full amount received
- User already pays fee to ledger, canister receives full amount
- Eliminates orphaned fee accumulation in canister"
   git push -u origin feature/fix-ckusdt-fee-accounting
   gh pr create --title "fix(dice): Correct ICRC-2 fee accounting in deposits" --body "## Problem

After the ckUSDT migration (PR #91, #93), deposit functions incorrectly assumed the canister pays the transfer fee, leading to accounting discrepancies.

### Symptom
Every deposit left an 'orphaned' fee amount in the canister:
- After 50 USDT LP deposit + 20 USDT chip deposit = 0.02 USDT excess
- After withdrawing chips = 20.01 USDT excess
- After withdrawing LP = 49.5 USDT excess

### Root Cause
ICRC-2 \`transfer_from\` behavior:
- User pays: amount + fee (debited from user account)
- Canister receives: amount (full amount)
- Fee is burned by the ledger

But the code incorrectly credited users with \`amount - fee\`, leaving the fee orphaned in the canister.

## Solution

Fixed both deposit functions:
1. \`deposit()\` in \`dice_backend/src/defi_accounting/accounting.rs\`
2. \`deposit_liquidity()\` in \`dice_backend/src/defi_accounting/liquidity_pool.rs\`

Now credits users with the full amount received, matching actual ICRC-2 behavior.

## Testing

Deployed to mainnet:
- Dice Backend: \`whchi-hyaaa-aaaao-a4ruq-cai\`

Run \`scripts/check_balance.sh\` to verify accounting integrity.

Implements PLAN_FIX_CKUSDT_FEE_ACCOUNTING.md"
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

**Branch:** `feature/fix-ckusdt-fee-accounting`
**Worktree:** `/home/theseus/alexandria/openhouse-fix-fee-accounting`

---

# Implementation Plan: Fix ckUSDT Fee Accounting Bug

## Problem Statement

After the ICP → ckUSDT migration (commits 1122762, a227e23), the deposit functions in the dice backend incorrectly handle ICRC-2 transfer fees, causing accounting discrepancies that accumulate over time.

### Observed User Journey with Balance Checks

The user performed a complete deposit/withdrawal cycle and documented the internal accounting state at each step:

#### Step 1: Fresh Canister (Baseline)
```
Health Check Results:
======================================
Pool Reserve:     0 decimals
User Deposits:    0 decimals
Calculated Total: 0 decimals
Actual Balance:   0 decimals
EXCESS:           0 decimals (0 USDT)

Operational Status:
❌ System cannot accept bets (pool reserve < 100 USDT)
======================================
```
**Status:** Clean slate, no discrepancies.

#### Step 2: Added 50 USDT as Liquidity Provider
```
Health Check Results:
======================================
🔍 Running accounting audit...
(variant {
  Err = "❌ Audit FAILED: pool_reserve (49990000) + deposits (0) = 49990000 != canister (0)"
})

Accounting Breakdown:
Pool Reserve:     49990000 decimals  (49.99 USDT)
User Deposits:    0 decimals
Calculated Total: 49990000 decimals
Actual Balance:   0 decimals

Accounting Statistics:
house_balance = 49_990_000 : nat64;
canister_balance = 50_000_000 : nat64;

EXCESS:           -49990000 decimals (-49.99 USDT)

Operational Status:
❌ System cannot accept bets (pool reserve < 100 USDT)
======================================
```
**Problem Identified:**
- Real canister balance: 50,000,000 (50 USDT)
- Internal pool_reserve: 49,990,000 (49.99 USDT)
- **Missing from accounting: 10,000 decimals (0.01 USDT = 1 fee)**

#### Step 3: Bought 20 USDT Worth of Chips
```
Health Check Results:
======================================
🔍 Running accounting audit...
(variant {
  Err = "❌ Audit FAILED: pool_reserve (49990000) + deposits (19990000) = 69980000 != canister (70000000)"
})

Accounting Breakdown:
Pool Reserve:     49990000 decimals  (49.99 USDT)
User Deposits:    19990000 decimals  (19.99 USDT)
Calculated Total: 69980000 decimals  (69.98 USDT)
Actual Balance:   70000000 decimals  (70.00 USDT)

EXCESS:           20000 decimals (0.02 USDT)
Orphaned Fees:    2 (@ 0.01 USDT each)

✅ HEALTH STATUS: HEALTHY (excess < 1 USDT)

Operational Status:
❌ System cannot accept bets (pool reserve < 100 USDT)
======================================
```
**Problem Compounded:**
- Real canister balance: 70,000,000 (70 USDT)
- Internal tracking: 69,980,000 (69.98 USDT)
- **Missing from accounting: 20,000 decimals (0.02 USDT = 2 fees)**

Each deposit orphaned a fee!

#### Step 4: Cashed Out 20 USDT Chips
```
Health Check Results:
======================================
🔍 Running accounting audit...
(variant {
  Err = "❌ Audit FAILED: pool_reserve (49990000) + deposits (0) = 49990000 != canister (70000000)"
})

Accounting Breakdown:
Pool Reserve:     49990000 decimals  (49.99 USDT)
User Deposits:    0 decimals          (0 USDT)
Calculated Total: 49990000 decimals  (49.99 USDT)
Actual Balance:   70000000 decimals  (70.00 USDT)

EXCESS:           20010000 decimals (20.01 USDT)
Orphaned Fees:    2001 (@ 0.01 USDT each)

⚠️  HEALTH STATUS: WARNING (excess >= 1 USDT)

Operational Status:
❌ System cannot accept bets (pool reserve < 100 USDT)
======================================
```
**Critical Issue:**
- User withdrew 20 USDT (confirmed by user: "USDT was actually returned")
- User deposits correctly went to 0
- But canister balance shows 70 USDT instead of ~50 USDT
- **EXCESS: 20.01 USDT** - The withdrawn amount wasn't reflected in the cached balance!

Note: User confirmed actual token transfers work correctly. The issue is purely internal state tracking.

#### Step 5: Withdrew All Liquidity (49.49 USDT)
```
Health Check Results:
======================================
🔍 Running accounting audit...
(variant {
  Err = "❌ Audit FAILED: pool_reserve (1000) + deposits (499890) = 500890 != canister (50010000)"
})

Accounting Breakdown:
Pool Reserve:     1000 decimals       (0.001 USDT)
User Deposits:    499890 decimals     (0.50 USDT)
Calculated Total: 500890 decimals     (0.50 USDT)
Actual Balance:   50010000 decimals   (50.01 USDT)

EXCESS:           49509110 decimals (49.51 USDT)
Orphaned Fees:    4950 (@ 0.01 USDT each)

⚠️  HEALTH STATUS: WARNING (excess >= 1 USDT)

Liquidity Pool Statistics:
total_shares = 1_000 : nat;
pool_reserve = 1_000 : nat;
total_liquidity_providers = 0 : nat64;

Operational Status:
❌ System cannot accept bets (pool reserve < 100 USDT)
======================================
```
**Massive Discrepancy:**
- Real canister balance: 50,010,000 (50.01 USDT)
- Internal tracking: 500,890 (0.50 USDT)
- **EXCESS: 49.51 USDT** - Almost the entire withdrawn amount unaccounted for!

### Root Cause Analysis

Looking at the code changes in commit 1122762 (ckUSDT fee fixes):

**File: `dice_backend/src/defi_accounting/accounting.rs:128-146`**

```rust
// CURRENT INCORRECT CODE
match result {
    Ok(block_index) => {
        // Credit user with amount minus fee
        // ICRC-2 transfer_from behavior:
        // - User pays: amount
        // - Spender (Canister) pays: fee  ❌ WRONG!
        // - Canister receives: amount
        // Net Canister Balance: +amount - fee
        // User Balance Credit: amount - fee

        if amount <= CKUSDT_TRANSFER_FEE {
            return Err(format!("Deposit amount {} too small to cover fee {}", amount, CKUSDT_TRANSFER_FEE));
        }
        let amount_received = amount - CKUSDT_TRANSFER_FEE;  // ❌ BUG HERE

        let new_balance = USER_BALANCES_STABLE.with(|balances| {
            let mut balances = balances.borrow_mut();
            let current = balances.get(&caller).unwrap_or(0);
            let new_bal = current + amount_received;
            balances.insert(caller, new_bal);
            new_bal
        });
    }
}
```

**File: `dice_backend/src/defi_accounting/liquidity_pool.rs:163-172`**

```rust
// CURRENT INCORRECT CODE
let caller = ic_cdk::api::msg_caller();

// Deduct fee from deposit to prevent insolvency (Canister pays fee)  ❌ WRONG!
if amount <= CKUSDT_TRANSFER_FEE {
    return Err("Deposit too small to cover fees".to_string());
}
let net_amount = amount - CKUSDT_TRANSFER_FEE;  // ❌ BUG HERE
let amount_nat = Nat::from(net_amount);
```

### The ICRC-2 Truth

**Actual ICRC-2 `transfer_from` behavior:**

When user calls `deposit(20_000_000)` with fee specified as `10_000`:

1. **User's account debited:** 20,000,000 + 10,000 = **20,010,000**
2. **Canister account credited:** **20,000,000** (full amount)
3. **Fee (10,000):** Burned/collected by the ledger

The user ALREADY paid the fee to the ledger. The canister receives the full `amount`.

**Current buggy behavior:**
- Canister receives: 20,000,000
- User credited internally: 19,990,000
- **Orphaned in canister: 10,000** (unaccounted fee)

This creates a growing discrepancy between actual canister balance and internal accounting.

### Why This Breaks Gameplay

The `can_accept_bets()` check requires:
```rust
pool_reserve >= 100_000_000  // 100 USDT minimum
```

Even though the user added 50 USDT LP + 20 USDT chips (70 USDT total), the system shows:
- pool_reserve: 49.99 USDT (< 100 USDT threshold)
- **Result: Gameplay blocked despite having funds!**

### Secondary Issue: Cached Balance Not Refreshed

The withdrawal functions don't trigger a balance refresh, so the `CACHED_CANISTER_BALANCE` becomes stale after transfers. This causes audit failures but doesn't affect actual transfers (user confirmed funds were correctly transferred).

## Affected Files

### Backend Files to Modify

1. **`dice_backend/src/defi_accounting/accounting.rs:132-157`**
   - Function: `deposit()`
   - Issue: Credits `amount - fee` instead of `amount`
   - Lines: ~146

2. **`dice_backend/src/defi_accounting/liquidity_pool.rs:163-172`**
   - Function: `deposit_liquidity()`
   - Issue: Credits `amount - fee` instead of `amount`
   - Lines: ~170

### Test After Deployment

- Script: `scripts/check_balance.sh`
- Will verify accounting integrity post-fix

## Implementation

### Fix 1: User Deposit Function

**File:** `dice_backend/src/defi_accounting/accounting.rs`

**Location:** Lines 132-157 (in the `deposit()` function)

**Current Code:**
```rust
match result {
    Ok(block_index) => {
        // Credit user with amount minus fee
        // ICRC-2 transfer_from behavior:
        // - User pays: amount
        // - Spender (Canister) pays: fee
        // - Canister receives: amount
        // Net Canister Balance: +amount - fee
        // User Balance Credit: amount - fee

        // Safety check (though MIN_DEPOSIT should cover this)
        if amount <= CKUSDT_TRANSFER_FEE {
            return Err(format!("Deposit amount {} too small to cover fee {}", amount, CKUSDT_TRANSFER_FEE));
        }
        let amount_received = amount - CKUSDT_TRANSFER_FEE;

        let new_balance = USER_BALANCES_STABLE.with(|balances| {
            let mut balances = balances.borrow_mut();
            let current = balances.get(&caller).unwrap_or(0);
            let new_bal = current + amount_received;
            balances.insert(caller, new_bal);
            new_bal
        });

        ic_cdk::println!("Deposit successful: {} deposited {} decimals at block {}", caller, amount_received, block_index);
        Ok(new_balance)
    }
    Err(e) => Err(format!("Transfer failed: {:?}", e)),
}
```

**Fixed Code (PSEUDOCODE):**
```rust
match result {
    Ok(block_index) => {
        // Credit user with the full amount
        // ICRC-2 transfer_from ACTUAL behavior:
        // - User pays: amount + fee (debited from user's account)
        // - Canister receives: amount (full amount)
        // - Fee is burned/collected by the ledger
        //
        // Net Canister Balance: +amount (user already paid the fee)
        // User Balance Credit: amount (full amount received)

        let new_balance = USER_BALANCES_STABLE.with(|balances| {
            let mut balances = balances.borrow_mut();
            let current = balances.get(&caller).unwrap_or(0);
            let new_bal = current + amount;  // ✅ Credit full amount
            balances.insert(caller, new_bal);
            new_bal
        });

        ic_cdk::println!("Deposit successful: {} deposited {} decimals at block {}", caller, amount, block_index);
        Ok(new_balance)
    }
    Err(e) => Err(format!("Transfer failed: {:?}", e)),
}
```

**Key Changes:**
1. Remove the fee deduction: `let amount_received = amount - CKUSDT_TRANSFER_FEE;` ❌
2. Credit full amount: `current + amount` ✅
3. Remove safety check for fee (no longer needed)
4. Update comments to reflect correct ICRC-2 behavior
5. Update log message to use `amount` instead of `amount_received`

### Fix 2: Liquidity Pool Deposit Function

**File:** `dice_backend/src/defi_accounting/liquidity_pool.rs`

**Location:** Lines 163-172 (in the `deposit_liquidity()` function)

**Current Code:**
```rust
let caller = ic_cdk::api::msg_caller();

// Deduct fee from deposit to prevent insolvency (Canister pays fee)
if amount <= CKUSDT_TRANSFER_FEE {
    return Err("Deposit too small to cover fees".to_string());
}
let net_amount = amount - CKUSDT_TRANSFER_FEE;
let amount_nat = Nat::from(net_amount);

// Pre-Flight Check: Calculate projected shares BEFORE transfer
// This prevents "dust loss" where users send funds but get 0 shares.
let projected_shares = POOL_STATE.with(|state| {
    let pool_state = state.borrow().get().clone();
    let current_reserve = pool_state.reserve.clone();
    let total_shares = calculate_total_supply();

    if !pool_state.is_initialized {
        // First deposit: 1:1 share ratio
        amount_nat.clone()
    } else {
        // Subsequent deposits: shares = (amount * total_shares) / reserve
        if current_reserve == Nat::from(0u64) {
            amount_nat.clone()
        } else {
            let numerator = amount_nat.clone() * total_shares;
            numerator / current_reserve
        }
    }
});
```

**Fixed Code (PSEUDOCODE):**
```rust
let caller = ic_cdk::api::msg_caller();

// No fee deduction needed - user already paid fee to ledger
// ICRC-2 transfer_from behavior:
// - User pays: amount + fee (to ledger)
// - Canister receives: amount (full amount)
// - Fee burned by ledger
let amount_nat = Nat::from(amount);  // ✅ Use full amount

// Pre-Flight Check: Calculate projected shares BEFORE transfer
// This prevents "dust loss" where users send funds but get 0 shares.
let projected_shares = POOL_STATE.with(|state| {
    let pool_state = state.borrow().get().clone();
    let current_reserve = pool_state.reserve.clone();
    let total_shares = calculate_total_supply();

    if !pool_state.is_initialized {
        // First deposit: 1:1 share ratio
        amount_nat.clone()  // ✅ Full amount for share calculation
    } else {
        // Subsequent deposits: shares = (amount * total_shares) / reserve
        if current_reserve == Nat::from(0u64) {
            amount_nat.clone()
        } else {
            let numerator = amount_nat.clone() * total_shares;
            numerator / current_reserve
        }
    }
});
```

**Key Changes:**
1. Remove fee deduction: `let net_amount = amount - CKUSDT_TRANSFER_FEE;` ❌
2. Use full amount: `let amount_nat = Nat::from(amount);` ✅
3. Remove fee safety check
4. Update comments to reflect correct ICRC-2 behavior
5. Share calculations now use full amount (more accurate)

## Expected Results After Fix

### Scenario 1: Fresh Start + 50 USDT LP + 20 USDT Chips

**Step 1: Add 50 USDT LP**
```
Pool Reserve:     50000000 decimals  (50.00 USDT) ✅
User Deposits:    0 decimals
Calculated Total: 50000000 decimals
Actual Balance:   50000000 decimals  (50.00 USDT) ✅
EXCESS:           0 decimals (0 USDT) ✅
```

**Step 2: Buy 20 USDT Chips**
```
Pool Reserve:     50000000 decimals  (50.00 USDT)
User Deposits:    20000000 decimals  (20.00 USDT) ✅
Calculated Total: 70000000 decimals  (70.00 USDT)
Actual Balance:   70000000 decimals  (70.00 USDT) ✅
EXCESS:           0 decimals (0 USDT) ✅
```

**Step 3: Cash Out Chips**
```
Pool Reserve:     50000000 decimals  (50.00 USDT)
User Deposits:    0 decimals
Calculated Total: 50000000 decimals
Actual Balance:   50000000 decimals  (50.00 USDT) ✅
EXCESS:           0 decimals (0 USDT) ✅
```

**Step 4: Withdraw All LP**
```
Pool Reserve:     1000 decimals      (0.001 USDT - minimum liquidity)
User Deposits:    0 decimals
Calculated Total: 1000 decimals
Actual Balance:   1000 decimals ✅
EXCESS:           0 decimals (0 USDT) ✅
```

### Scenario 2: Enable Gameplay

With 100 USDT LP deposit:
```
Pool Reserve:     100000000 decimals (100.00 USDT) ✅
Operational Status:
✅ System CAN accept bets (pool reserve >= 100 USDT) ✅
```

No more orphaned fees blocking gameplay!

## Deployment Strategy

### Build Commands
```bash
cd /home/theseus/alexandria/openhouse-fix-fee-accounting

# Build dice backend
cargo build --target wasm32-unknown-unknown --release --package dice_backend
```

### Deploy Commands
```bash
# Deploy only dice backend (affected canister)
./deploy.sh --dice-only
```

### Verification Commands
```bash
# Check canister status
dfx canister --network ic status dice_backend

# Run comprehensive balance check
cd scripts
./check_balance.sh

# Manual test: Small deposit
dfx canister --network ic call whchi-hyaaa-aaaao-a4ruq-cai deposit '(10_000_000 : nat64)'

# Check accounting audit after deposit
dfx canister --network ic call whchi-hyaaa-aaaao-a4ruq-cai audit_balances
```

## Testing Plan

Since this is mainnet-only, testing happens in production:

### Pre-Deployment Checklist
- [ ] Verify in correct worktree (`openhouse-fix-fee-accounting`)
- [ ] Build succeeds without errors
- [ ] Review diff one more time

### Post-Deployment Testing
1. **Run balance check script**
   ```bash
   cd scripts
   ./check_balance.sh
   ```
   Expected: Clean audit (0 excess)

2. **Small LP deposit (1 USDT)**
   ```bash
   # From UI or via canister call
   ```
   Expected: pool_reserve increases by exactly 1_000_000, no excess

3. **Small chip deposit (10 USDT)**
   ```bash
   # From UI
   ```
   Expected: user_deposits increases by exactly 10_000_000, no excess

4. **Withdraw chips**
   Expected: user_deposits = 0, no excess remaining

5. **Large LP deposit (100 USDT)**
   Expected:
   - pool_reserve = 100_000_000
   - `can_accept_bets()` returns true
   - Gameplay enabled!

### Rollback Plan

If something goes wrong:
```bash
# Dice backend has stable memory for state persistence
# Worst case: redeploy previous version from master
cd /home/theseus/alexandria/openhouse
./deploy.sh --dice-only
```

## Success Criteria

- [ ] `scripts/check_balance.sh` shows EXCESS = 0 after deposits
- [ ] Accounting audit passes: `pool_reserve + deposits = canister_balance`
- [ ] No orphaned fees accumulating
- [ ] System accepts bets with >= 100 USDT pool reserve
- [ ] Users can deposit, play, and withdraw without accounting errors
- [ ] PR created and approved

## Notes for Implementer

### Why This Was Hard to Catch

1. **Misleading ICRC-2 documentation comments** in the codebase
2. **Fee constant changed 5000x** (2 → 10,000) during migration, amplifying the bug
3. **Actual transfers worked correctly** - only internal accounting was wrong
4. **Small excess initially** (0.02 USDT) seemed like acceptable rounding

### What NOT to Change

- ❌ Don't touch withdrawal functions - they're correct
- ❌ Don't modify fee constant (10,000 is correct)
- ❌ Don't change transfer call parameters
- ❌ Don't add "safety margins" or extra fee padding
- ❌ Don't modify the balance refresh logic

### What TO Change

- ✅ Only change how much we credit users internally
- ✅ Remove fee deductions from credited amounts
- ✅ Update comments to reflect actual ICRC-2 behavior
- ✅ Test thoroughly on mainnet after deployment

### Related Issues

This bug was introduced in:
- Commit `1122762` - "ckUSDT fee fixes"
- Commit `a227e23` - "Complete ckUSDT migration cleanup"

Both commits incorrectly assumed the canister pays the transfer fee in ICRC-2 `transfer_from`, when in fact the user pays it to the ledger.

## References

- **ICRC-2 Specification:** https://github.com/dfinity/ICRC-1/blob/main/standards/ICRC-2/README.md
- **ckUSDT Ledger:** `cngnf-vqaaa-aaaar-qag4q-cai`
- **Dice Backend:** `whchi-hyaaa-aaaao-a4ruq-cai`
- **Health Check Script:** `/home/theseus/alexandria/openhouse/scripts/check_balance.sh`
