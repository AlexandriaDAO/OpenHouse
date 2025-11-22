# 🤖 AUTONOMOUS PR ORCHESTRATOR - DO NOT SKIP

**You are an autonomous PR orchestrator. Your ONLY job is to implement this plan and create a PR.**

## Isolation Check (RUN FIRST)
```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
if [ "$REPO_ROOT" = "/home/theseus/alexandria/openhouse" ]; then
    echo "❌ FATAL: In main repo. Must be in worktree."
    echo "Worktree: /home/theseus/alexandria/openhouse-share-inheritance"
    exit 1
fi
echo "✅ In isolated worktree: $REPO_ROOT"
```

## Your Autonomous Workflow (NO QUESTIONS ALLOWED)
1. **Verify isolation** - You must be in worktree: `/home/theseus/alexandria/openhouse-share-inheritance`
2. **Implement feature** - Follow plan sections below
3. **Build & Deploy to Mainnet**:
   - Backend changes:
     ```bash
     # Build affected backend(s)
     cargo build --target wasm32-unknown-unknown --release

     # Deploy to mainnet (deploys all canisters - simplest approach)
     ./deploy.sh
     ```
4. **Verify deployment**:
   ```bash
   # Check canister status
   dfx canister --network ic status dice_backend
   ```

5. **Create PR** (MANDATORY):
   ```bash
   git add .
   git commit -m "feat(dice_backend): Implement share inheritance fee mechanism"
   git push -u origin feature/share-inheritance-fees
   gh pr create --title "feat(dice_backend): Share Inheritance Fee Mechanism" --body "Implements PLAN_SHARE_INHERITANCE.md

   Replaces broken 'fire-and-forget' fee transfer with atomic share inheritance.
   - Fees are paid in LP shares, not ICP
   - Parent Canister becomes an LP (at house risk)
   - Auto-withdrawal timer configured for weekly payouts"
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

**Branch:** `feature/share-inheritance-fees`
**Worktree:** `/home/theseus/alexandria/openhouse-share-inheritance`

---

# Implementation Plan

## 1. Current State Analysis
The current implementation of `withdraw_liquidity` in `dice_backend` uses a "fire-and-forget" mechanism to pay the 1% protocol fee.
- It spawns an async task to transfer the fee.
- If this task fails (network/cycles), the fee is lost ("Ghost Funds").
- The fee is removed from the pool reserve but never received by the parent.

## 2. Proposed Solution: Share Inheritance
Instead of transferring ICP, we transfer **LP Shares**.
1. LP requests withdrawal of X shares.
2. 1% of X (fee) is transferred to the Parent Canister's LP account.
3. 99% of X (net) is burned.
4. ICP value of the 99% is calculated and sent to the LP.
5. Parent Canister now owns shares and participates in House Risk/Reward.
6. A weekly timer automatically withdraws the Parent's shares.

## 3. Implementation Details

### A. `dice_backend/src/defi_accounting/liquidity_pool.rs`

**Refactor `withdraw_liquidity`**:
```rust
// PSEUDOCODE
// Rename original to internal
async fn withdraw_liquidity_internal(
    user: Principal, 
    shares_total: Nat, 
    apply_fee: bool
) -> Result<u64, String> {
    // ... validation ...

    // 1. Calculate Split
    let (shares_fee, shares_burn) = if apply_fee {
        let fee = shares_total.clone() / 100;
        (fee, shares_total.clone() - fee)
    } else {
        (Nat::from(0u64), shares_total.clone())
    };

    // 2. Inherit Fee Shares (Atomic)
    if shares_fee > Nat::from(0u64) {
        let parent = get_parent_principal();
        LP_SHARES.with(|s| {
             let mut map = s.borrow_mut();
             let current = map.get(&parent).map(|sn| sn.0.clone()).unwrap_or(Nat::from(0u64));
             map.insert(parent, StorableNat(current + shares_fee));
        });
    }

    // 3. Calculate Payout (on shares_burn ONLY)
    let payout_nat = POOL_STATE.with(|state| {
        // ... existing logic but use shares_burn ...
        // payout = (shares_burn * current_reserve) / total_shares
        // NOTE: total_shares currently INCLUDES the fee shares we just moved to parent.
        // This is correct. The fee shares are still in circulation.
    })?;

    // 4. Update State
    // Burn user shares (shares_total)
    // Note: We already updated Parent. Now we remove User's full amount.
    LP_SHARES.with(|shares| {
        // ... remove user shares ...
    });
    
    // Update Reserve (-payout)
    POOL_STATE.with(|state| {
        // ... deduct payout ...
    })?;

    // 5. Execute Transfer
    // Use shares_burn for logging/events, but shares_total was effectively processed
    match accounting::schedule_lp_withdrawal(user, shares_burn.clone(), payout_nat.clone(), lp_amount) {
        Ok(_) => Ok(lp_amount),
        Err(e) => {
            // ROLLBACK
            // 1. Restore user shares
            // 2. Reverse parent fee inheritance
            if shares_fee > Nat::from(0u64) {
                 let parent = get_parent_principal();
                 LP_SHARES.with(|s| {
                     // ... subtract shares_fee from parent ...
                 });
            }
            // 3. Restore reserve
            Err(e)
        }
    }
}

#[update]
pub async fn withdraw_all_liquidity() -> Result<u64, String> {
    let caller = ic_cdk::caller();
    let shares = LP_SHARES.with(|s| s.borrow().get(&caller).map(|sn| sn.0.clone()).unwrap_or(Nat::from(0u64)));
    
    if shares == Nat::from(0u64) {
        return Err("No liquidity to withdraw".to_string());
    }
    
    // Regular LPs pay fee
    withdraw_liquidity_internal(caller, shares, true).await
}

pub async fn auto_withdraw_parent() {
    let parent = get_parent_principal();
    let shares = LP_SHARES.with(|s| s.borrow().get(&parent).map(|sn| sn.0.clone()).unwrap_or(Nat::from(0u64)));
    
    if shares > Nat::from(0u64) {
        // Parent pays NO fee on own withdrawal
        let _ = withdraw_liquidity_internal(parent, shares, false).await;
    }
}
```

### B. `dice_backend/src/defi_accounting/accounting.rs`

Add Timer Logic:
```rust
// PSEUDOCODE
thread_local! {
    static PARENT_TIMER: RefCell<Option<ic_cdk_timers::TimerId>> = RefCell::new(None);
}

pub fn start_parent_withdrawal_timer() {
    PARENT_TIMER.with(|t| {
        if t.borrow().is_some() { return; }
        
        // Run every 7 days (604,800 seconds)
        let timer_id = ic_cdk_timers::set_timer_interval(Duration::from_secs(604_800), || async {
             crate::defi_accounting::liquidity_pool::auto_withdraw_parent().await;
        });
        *t.borrow_mut() = Some(timer_id);
    });
}
```

### C. `dice_backend/src/lib.rs`

Update Lifecycle Hooks:
```rust
// PSEUDOCODE
#[init]
fn init() {
    // ... existing ...
    defi_accounting::accounting::start_parent_withdrawal_timer();
}

#[post_upgrade]
fn post_upgrade() {
    // ... existing ...
    defi_accounting::accounting::start_parent_withdrawal_timer();
}
```

## 4. Deployment
- **Affected Canister**: `dice_backend`
- **Strategy**: Deploy all backend canisters to ensure interface consistency.

## 5. Verification
- Check `dfx canister status dice_backend`
- (Optional) Check logs for `auto_withdraw_parent` execution if timer duration is shortened for testing (not recommended for prod deploy).
