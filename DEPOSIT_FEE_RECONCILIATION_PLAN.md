# 🤖 AUTONOMOUS PR ORCHESTRATOR - DO NOT SKIP

**You are an autonomous PR orchestrator. Your ONLY job is to implement this plan and create a PR.**

## Isolation Check (RUN FIRST)
```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
if [ "$REPO_ROOT" = "/home/theseus/alexandria/openhouse" ]; then
    echo "❌ FATAL: In main repo. Must be in worktree."
    echo "Worktree: /home/theseus/alexandria/openhouse-deposit-fee"
    exit 1
fi
echo "✅ In isolated worktree: $REPO_ROOT"
```

## Your Autonomous Workflow (NO QUESTIONS ALLOWED)
1. **Verify isolation** - You must be in worktree: `/home/theseus/alexandria/openhouse-deposit-fee`
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

   # Test pool stats
   dfx canister --network ic call whchi-hyaaa-aaaao-a4ruq-cai get_pool_stats
   ```

5. **Create PR** (MANDATORY):
   ```bash
   git add .
   git commit -m "feat(dice): add 1% deposit fee with reconciliation for floating funds"
   git push -u origin feature/deposit-fee-reconciliation
   gh pr create --title "Feature: 1% Deposit Fee with Daily Reconciliation" --body "Implements DEPOSIT_FEE_RECONCILIATION_PLAN.md

## Summary
- 1% fee on DEPOSITS ONLY (no withdrawal fees)
- Best-effort transfer to parent staker
- Failed fees become floating funds (this already happens)
- Daily reconciliation sweeps floating funds to parent

## Why This Is Safe
- Floating ICP already exists (donations, mistakes)
- No complex rollback logic needed
- Reconciliation handles all edge cases
- ~20 lines total

Deployed to mainnet: dice_backend (whchi-hyaaa-aaaao-a4ruq-cai)"
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

**Branch:** `feature/deposit-fee-reconciliation`
**Worktree:** `/home/theseus/alexandria/openhouse-deposit-fee`

---

# Implementation Plan: 1% Deposit Fee with Reconciliation

## CRITICAL CONTEXT: Floating ICP Already Exists

**IMPORTANT:** Any canister can receive ICP from external sources at any time:
- Donations: Someone sends ICP directly to support the project
- Mistakes: Wrong address transfers
- Refunds: Services returning funds

This creates "floating ICP" - funds in the canister but not tracked in pool reserve.

**This PR doesn't create a new problem - it handles an existing one.**

## Current State

### File: `dice_backend/src/defi_accounting/liquidity_pool.rs`

**Function:** `deposit_liquidity()` (lines 85-172)
- Pulls ICP from user via ICRC-2 transfer
- Calculates shares to mint
- Updates pool reserve with full amount

### Existing Issue: Floating ICP
```rust
// Anyone can do this RIGHT NOW:
transfer_to_canister(dice_backend, 10_ICP);  // Direct transfer

// Result:
// Canister balance: +10 ICP
// Pool reserve: Unchanged
// 10 ICP is "floating" (untracked)
```

## Implementation

### Part 1: Add Deposit Fee (3 lines)

**File:** `dice_backend/src/defi_accounting/liquidity_pool.rs`

**Add constant after line 19:**
```rust
// PSEUDOCODE
const PARENT_STAKER_CANISTER: &str = "e454q-riaaa-aaaap-qqcyq-cai";
```

**Modify deposit_liquidity() - Add after line 127 (after successful transfer from user):**
```rust
// PSEUDOCODE - Best effort fee transfer
// Note: Failed transfers become floating funds, handled by daily reconciliation
let fee = amount / 100;  // 1% fee
let _ = accounting::transfer_to_user(
    Principal::from_text(PARENT_STAKER_CANISTER).unwrap(),
    fee
).await;  // Ignore result - failures handled by reconciliation

// Continue with deposit using NET amount
let deposit_amount = amount - fee;
let deposit_nat = u64_to_nat(deposit_amount);
```

**Update line 129-172 to use `deposit_nat` instead of `amount_nat`:**
- Line 137: Use `deposit_nat` instead of `amount_nat`
- Line 146: Calculate with `deposit_nat`
- Line 151: Calculate with `deposit_nat`
- Line 168: Add `deposit_nat` to reserve

### Part 2: Add Reconciliation Function

**File:** `dice_backend/src/defi_accounting/liquidity_pool.rs`

**Add at end of file (new public function):**
```rust
// PSEUDOCODE
/// Reconcile floating funds (called daily by heartbeat)
/// Floating funds = canister balance - pool reserve - user deposits
/// These come from: failed fee transfers, donations, mistaken transfers
pub async fn reconcile_floating_funds() -> Result<u64, String> {
    // Refresh canister balance from ledger
    let canister_balance = accounting::refresh_canister_balance().await;

    // Calculate what should be in canister
    let pool_reserve = get_pool_reserve();
    let user_deposits = accounting::get_total_user_deposits();
    let expected_balance = pool_reserve + user_deposits;

    // Calculate floating amount
    let floating = canister_balance.saturating_sub(expected_balance);

    // Only sweep if meaningful (> 1 ICP)
    if floating > 100_000_000 {
        let parent = Principal::from_text(PARENT_STAKER_CANISTER).unwrap();
        match accounting::transfer_to_user(parent, floating).await {
            Ok(_) => {
                ic_cdk::println!("Reconciled {} e8s floating funds to parent", floating);
                Ok(floating)
            }
            Err(e) => {
                ic_cdk::println!("Reconciliation transfer failed: {}, will retry tomorrow", e);
                Ok(0)
            }
        }
    } else {
        Ok(0)  // Nothing to sweep
    }
}
```

**File:** `dice_backend/src/defi_accounting/mod.rs`

**Export the reconciliation function (add to public exports):**
```rust
pub use liquidity_pool::reconcile_floating_funds;
```

### Part 3: Add Heartbeat Timer

**File:** `dice_backend/src/lib.rs`

**Add heartbeat function (if not exists):**
```rust
// PSEUDOCODE
use std::time::Duration;

static LAST_RECONCILIATION: RefCell<u64> = RefCell::new(0);

#[ic_cdk::heartbeat]
async fn heartbeat() {
    let now = ic_cdk::api::time();
    let last = LAST_RECONCILIATION.with(|l| *l.borrow());

    // Run daily (86400 seconds)
    if now - last > 86_400_000_000_000 {  // 24 hours in nanos
        LAST_RECONCILIATION.with(|l| *l.borrow_mut() = now);

        // Run reconciliation
        match defi_accounting::reconcile_floating_funds().await {
            Ok(amount) if amount > 0 => {
                ic_cdk::println!("Reconciled {} e8s to parent", amount);
            }
            _ => {}
        }
    }
}
```

## Why This Approach Is Safe

### The Fee Logic
1. User deposits 100 ICP
2. Try to send 1 ICP to parent (best effort)
3. Calculate shares on 99 ICP (always consistent)
4. If fee transfer fails, 1 ICP becomes floating

### Floating Funds Are Already Reality
- Someone sends 10 ICP donation → 10 ICP floating
- Failed fee transfer → 1 ICP floating
- **Same problem, same solution: reconciliation**

### No Complex Accounting
- Pool reserve always tracks correctly (99 ICP added)
- User always gets correct shares (for 99 ICP)
- Floating funds swept daily

## Code Changes Summary

**Total changes: ~20 lines**
1. Add parent canister constant (1 line)
2. Add fee transfer attempt (2 lines)
3. Update deposit to use net amount (4 line changes)
4. Add reconciliation function (15 lines)
5. Add heartbeat timer (10 lines)
6. Export reconciliation (1 line)

## Testing Checklist

**Manual Verification (Mainnet):**
- [ ] Deploy updated dice_backend
- [ ] Test deposit with fee
- [ ] Verify shares calculated on 99% of deposit
- [ ] Check logs for fee transfer attempts
- [ ] Manually call `reconcile_floating_funds()` to test

## FAQ for Reviewers

**Q: What if the fee transfer fails?**
A: Fee becomes floating funds, swept daily by reconciliation. This already happens with donations.

**Q: Why not track failed fees?**
A: Unnecessary complexity. Floating funds from any source (donations, mistakes, failed fees) are all handled the same way.

**Q: What about withdrawal fees?**
A: NO withdrawal fees. Users hate them and they add complexity.

**Q: Is this accounting correct?**
A: Yes. Pool reserve tracks deposited amount minus fee. Floating funds are outside the pool.

**Q: What if someone sends ICP directly to canister?**
A: That already happens. Reconciliation handles it the same way.

## Summary

This PR adds:
1. **1% deposit fee** (best effort, 2 lines)
2. **Daily reconciliation** for floating funds (handles existing problem)
3. **NO withdrawal fees** (keeping it simple)
4. **NO complex rollback logic** (fee failures just float)

The system already has floating ICP from external transfers. This PR provides a solution (reconciliation) while adding a revenue stream (deposit fees).

**Total complexity: ~20 lines of simple, clear code.**