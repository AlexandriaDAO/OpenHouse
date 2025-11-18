# 🤖 AUTONOMOUS PR ORCHESTRATOR - DO NOT SKIP

**You are an autonomous PR orchestrator. Your ONLY job is to implement this plan and create a PR.**

## Isolation Check (RUN FIRST)
```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
if [ "$REPO_ROOT" = "/home/theseus/alexandria/openhouse" ]; then
    echo "❌ FATAL: In main repo. Must be in worktree."
    echo "Worktree: /home/theseus/alexandria/openhouse-lp-fee"
    exit 1
fi
echo "✅ In isolated worktree: $REPO_ROOT"
```

## Your Autonomous Workflow (NO QUESTIONS ALLOWED)
1. **Verify isolation** - You must be in worktree: `/home/theseus/alexandria/openhouse-lp-fee`
2. **Implement feature** - Follow plan sections below
3. **Build & Deploy to Mainnet**:
   ```bash
   # Build dice backend
   cargo build --target wasm32-unknown-unknown --release

   # Deploy to mainnet (deploys all canisters - simplest approach)
   ./deploy.sh
   ```

4. **Verify deployment**:
   ```bash
   # Check canister status
   dfx canister --network ic status dice_backend

   # Test LP withdrawal fee
   dfx canister --network ic call whchi-hyaaa-aaaao-a4ruq-cai get_pool_stats
   ```

5. **Create PR** (MANDATORY):
   ```bash
   git add .
   git commit -m "feat(dice): add 1% LP withdrawal fee to parent staker canister"
   git push -u origin feature/lp-withdrawal-fee
   gh pr create --title "Feature: 1% LP Withdrawal Fee to Parent Staker" --body "Implements LP_WITHDRAWAL_FEE_PLAN.md

Deployed to mainnet:
- Frontend: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io
- Affected canisters: dice_backend (whchi-hyaaa-aaaao-a4ruq-cai)

## Summary
- Adds 1% withdrawal fee on LP withdrawals only
- Fee sent to parent staker canister: e454q-riaaa-aaaap-qqcyq-cai
- Regular user withdrawals remain FREE (player-friendly)
- Bulletproof error handling with proper rollback"
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

**Branch:** `feature/lp-withdrawal-fee`
**Worktree:** `/home/theseus/alexandria/openhouse-lp-fee`

---

# Implementation Plan: 1% LP Withdrawal Fee

## Current State

### Affected Files
- `dice_backend/src/defi_accounting/liquidity_pool.rs` (MODIFY)
  - Function: `withdraw_liquidity()` (lines 176-265)

### Current Behavior
When an LP withdraws liquidity:
1. User shares are calculated and validated (lines 194-201)
2. Payout amount is calculated from pool reserve (lines 204-222)
3. State is updated BEFORE transfer (lines 230-245) - CEI pattern
4. Transfer to user is attempted (line 248)
5. On transfer failure, state is rolled back (lines 252-263)

### Current Transfer Flow
```rust
// Line 248: Transfer full payout to LP
match transfer_to_user(caller, payout_u64).await {
    Ok(_) => Ok(payout_u64),
    Err(e) => {
        // Rollback shares and pool reserve
        // Return error
    }
}
```

## Implementation

### File: `dice_backend/src/defi_accounting/liquidity_pool.rs`

#### 1. Add Constants (after line 19)
```rust
// PSEUDOCODE
const PARENT_STAKER_CANISTER: &str = "e454q-riaaa-aaaap-qqcyq-cai";
const LP_WITHDRAWAL_FEE_PERCENT: f64 = 0.01; // 1% fee on LP withdrawals
```

#### 2. Modify `withdraw_liquidity()` Function

**Current signature:** Line 176
```rust
async fn withdraw_liquidity(shares_to_burn: Nat) -> Result<u64, String>
```

**New logic (replace lines 230-265):**

```rust
// PSEUDOCODE - Bulletproof two-transfer flow with complete rollback

// State is already updated at lines 230-245 (shares deducted, pool reduced)
// Now we need two transfers with proper error handling

// Calculate fee amounts
let withdrawal_fee = (payout_u64 as f64 * LP_WITHDRAWAL_FEE_PERCENT) as u64;
let lp_payout = payout_u64 - withdrawal_fee;

// Ensure fee covers transfer cost
if withdrawal_fee < TRANSFER_FEE {
    // Rollback state (restore shares and pool)
    LP_SHARES.with(|shares| {
        shares.borrow_mut().insert(caller, StorableNat(user_shares));
    });
    POOL_STATE.with(|state| {
        let mut pool_state = state.borrow().get().clone();
        pool_state.reserve = nat_add(&new_reserve, &payout_nat);
        state.borrow_mut().set(pool_state).unwrap();
    });
    return Err(format!("Withdrawal amount {} e8s too small for fee", payout_u64));
}

// Parse parent principal
let parent_principal = Principal::from_text(PARENT_STAKER_CANISTER)
    .expect("Parent canister ID must be valid");

// STEP 1: Transfer fee to parent (1%)
match transfer_to_user(parent_principal, withdrawal_fee).await {
    Ok(_) => {
        // Parent paid successfully, continue to LP transfer
    }
    Err(e) => {
        // ROLLBACK: Parent transfer failed, restore ALL state
        LP_SHARES.with(|shares| {
            shares.borrow_mut().insert(caller, StorableNat(user_shares));
        });
        POOL_STATE.with(|state| {
            let mut pool_state = state.borrow().get().clone();
            pool_state.reserve = nat_add(&new_reserve, &payout_nat);
            state.borrow_mut().set(pool_state).unwrap();
        });
        return Err(format!("Parent fee transfer failed: {}. State rolled back.", e));
    }
}

// STEP 2: Transfer remaining to LP (99%)
match transfer_to_user(caller, lp_payout).await {
    Ok(_) => {
        // Both transfers successful
        ic_cdk::println!(
            "LP withdrawal: {} received {} e8s, parent fee {} e8s",
            caller,
            lp_payout,
            withdrawal_fee
        );
        Ok(lp_payout)
    }
    Err(e) => {
        // CRITICAL: Parent already got paid, LP transfer failed
        // We CANNOT rollback the parent transfer (already committed on ledger)
        // Best we can do: restore LP's shares and pool reserve
        // LP keeps their shares, parent keeps the fee (LP loses fee but keeps position)

        LP_SHARES.with(|shares| {
            shares.borrow_mut().insert(caller, StorableNat(user_shares));
        });
        POOL_STATE.with(|state| {
            let mut pool_state = state.borrow().get().clone();
            // Only restore LP's portion, parent's fee was legitimately paid
            pool_state.reserve = nat_add(&new_reserve, &u64_to_nat(lp_payout));
            state.borrow_mut().set(pool_state).unwrap();
        });

        // Log critical error
        ic_cdk::println!(
            "⚠️ PARTIAL WITHDRAWAL: Parent received {} e8s fee, but LP transfer failed: {}. LP shares restored.",
            withdrawal_fee,
            e
        );

        Err(format!(
            "LP transfer failed after parent fee paid: {}. Your shares have been restored, but {} e8s fee was collected.",
            e,
            withdrawal_fee
        ))
    }
}
```

### Logic Flow

**Happy Path:**
1. State updated (shares burned, pool reduced)
2. Transfer 1% to parent → SUCCESS ✅
3. Transfer 99% to LP → SUCCESS ✅
4. Return LP payout amount

**Error Case 1: Parent transfer fails**
1. State updated
2. Transfer 1% to parent → FAIL ❌
3. **ROLLBACK:** Restore shares + full pool reserve
4. Return error, no money moved

**Error Case 2: LP transfer fails (rare edge case)**
1. State updated
2. Transfer 1% to parent → SUCCESS ✅
3. Transfer 99% to LP → FAIL ❌
4. **PARTIAL ROLLBACK:** Restore shares + LP's portion of pool
5. Parent keeps fee (already on ledger, can't claw back)
6. LP keeps shares (no loss except the fee)
7. Return detailed error explaining what happened

### Fee Accounting

For a 100 ICP LP withdrawal:
- **Gross payout:** 100 ICP (100,000,000 e8s)
- **Fee to parent:** 1 ICP - 0.0001 ICP = 0.9999 ICP
- **Net to LP:** 99 ICP - 0.0001 ICP = 98.9999 ICP
- **Total transfer fees:** 0.0002 ICP (two transfers)
- **LP receives:** 98.9999 ICP
- **Parent receives:** 0.9999 ICP
- **Total:** 99.9998 ICP (0.0002 ICP paid to network)

## Deployment Strategy

### Affected Canisters
- **Dice Backend:** `whchi-hyaaa-aaaao-a4ruq-cai` (MODIFY)

### Build Command
```bash
cargo build --target wasm32-unknown-unknown --release
```

### Deploy Command
```bash
./deploy.sh  # Deploys all canisters (simplest)
# OR
./deploy.sh --dice-only  # Dice backend only
```

### Verification
```bash
# Check pool stats
dfx canister --network ic call whchi-hyaaa-aaaao-a4ruq-cai get_pool_stats

# Test withdrawal (if you have LP shares)
dfx canister --network ic call whchi-hyaaa-aaaao-a4ruq-cai withdraw_all_liquidity
```

## Security Considerations

### Why This Approach Is Safe

1. **CEI Pattern Maintained:** State changes happen before transfers (existing pattern)
2. **Parent Transfer First:** If it fails, nothing moved (clean rollback)
3. **Explicit Partial Failure Handling:** If LP transfer fails, we document and handle the edge case
4. **No Reentrancy Risk:** IC guarantees sequential execution
5. **Fee Validation:** Ensures withdrawal is large enough to cover both transfers

### Edge Case: Partial Failure

The only problematic scenario is when parent succeeds but LP fails. This is extremely rare (ledger transfers rarely fail), but we handle it gracefully:
- LP keeps their shares (no loss of principal)
- Parent keeps the fee (can't be reversed)
- LP loses only the 1% fee in this scenario
- Detailed error message explains exactly what happened

This is acceptable because:
- Transfer failures are rare in practice
- LP doesn't lose their principal (shares restored)
- Parent receives legitimate fee (withdrawal was attempted)
- Better than blocking the withdrawal entirely

## User Impact

### LP Withdrawals
- **Before:** Withdraw 100 ICP → receive 99.9999 ICP (minus network fee)
- **After:** Withdraw 100 ICP → receive 98.9999 ICP (minus 1% fee + network fee)
- **Fee disclosure:** Should be shown in frontend UI

### Regular User Withdrawals
- **No change:** Still FREE (no withdrawal fees)
- **Player-friendly:** Maintains low barrier to cashing out winnings

## Testing Checklist

**Manual Verification (Mainnet):**
- [ ] Deploy updated dice_backend
- [ ] Verify `get_pool_stats()` returns expected values
- [ ] Test LP withdrawal with actual shares
- [ ] Confirm parent canister receives 1% fee
- [ ] Confirm LP receives 99% payout
- [ ] Check logs for proper fee accounting

**Build Verification:**
```bash
cargo build --target wasm32-unknown-unknown --release
# Should complete without errors
```

## Summary

**Changes:**
- +2 constants (parent canister ID, fee percentage)
- +~40 lines of bulletproof transfer logic with rollback handling
- 1 function modified: `withdraw_liquidity()`

**Benefits:**
- Revenue stream to parent staker canister
- Fair fee structure (LPs earning yield can afford 1%)
- Regular users unaffected (free withdrawals maintained)
- Robust error handling for all edge cases

**Total Code Addition:** ~45 lines (including comments and error handling)
