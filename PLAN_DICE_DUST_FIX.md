# 🤖 AUTONOMOUS PR ORCHESTRATOR - DO NOT SKIP

**You are an autonomous PR orchestrator. Your ONLY job is to implement this plan and create a PR.**

## Isolation Check (RUN FIRST)
```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
if [[ "$REPO_ROOT" != *"/openhouse-dust-fix" ]]; then
    echo "❌ FATAL: In main repo. Must be in worktree."
    echo "Worktree: /home/theseus/alexandria/openhouse-dust-fix"
    exit 1
fi
echo "✅ In isolated worktree: $REPO_ROOT"
```

## Your Autonomous Workflow (NO QUESTIONS ALLOWED)
1. **Verify isolation** - You must be in worktree: `/home/theseus/alexandria/openhouse-dust-fix`
2. **Implement feature** - Follow plan sections below
3. **Build & Deploy to Mainnet**:
   - Backend changes:
     ```bash
     # Build dice_backend
     cargo build --target wasm32-unknown-unknown --release -p dice_backend

     # Deploy to mainnet (only dice needed)
     ./deploy.sh --dice-only
     ```

4. **Verify deployment**:
   ```bash
   # Check canister status
   dfx canister --network ic status dice_backend
   ```

5. **Create PR** (MANDATORY):
   ```bash
   git add .
   git commit -m "Fix: Prevent zero-share deposits (Dust Loss) in Liquidity Pool"
   git push -u origin feature/dust-fix
   gh pr create --title "Fix: Zero-Share Deposit Safety Check" --body "Implements PLAN_DICE_DUST_FIX.md

Resolves:
- [Medium] Zero-Share Deposit (Dust Loss)

Summary:
Adds a pre-flight check to 'deposit_liquidity' to calculate projected shares before transferring user funds. Returns an error if the deposit would result in 0 shares, preventing effective donation of funds.

Deployed to mainnet:
- Dice Backend: $(dfx canister --network ic id dice_backend)"
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

**Branch:** `feature/dust-fix`
**Worktree:** `/home/theseus/alexandria/openhouse-dust-fix`

---

# Implementation Plan

## 1. Current State
The `dice_backend` liquidity pool allows a user to deposit funds that result in 0 shares (if `amount * total_shares < reserve`). The current implementation takes the funds first, then calculates shares, then errors out (but keeps the funds).

## 2. Implementation Details

### A. Pre-Flight Check in `deposit_liquidity`
**Target:** `dice_backend/src/defi_accounting/liquidity_pool.rs`

**Goal:** Calculate projected shares *before* calling `transfer_from_user`.

```rust
// PSEUDOCODE for 'deposit_liquidity' function

pub async fn deposit_liquidity(amount: u64) -> Result<Nat, String> {
    // 1. Validation
    if amount < MIN_DEPOSIT { ... }
    let amount_nat = Nat::from(amount);
    let caller = ic_cdk::api::msg_caller();

    // 2. [NEW] Pre-Flight Check (Dry Run)
    let projected_shares = POOL_STATE.with(|state| {
        let pool_state = state.borrow().get().clone();
        let current_reserve = pool_state.reserve.clone();
        let total_shares = calculate_total_supply();

        if total_shares == Nat::from(0u64) {
             // Initial deposit logic
             let initial_shares = amount_nat.clone();
             let burned_shares = Nat::from(MINIMUM_LIQUIDITY);
             if initial_shares < burned_shares {
                 return Ok(Nat::from(0u64)); // Will trigger error
             }
             Ok(initial_shares - burned_shares)
        } else {
             // Standard logic
             let numerator = amount_nat.clone() * total_shares;
             if current_reserve == Nat::from(0u64) {
                 // Edge case
                 return Ok(Nat::from(0u64)); 
             }
             Ok(numerator / current_reserve)
        }
    })?;

    // 3. [NEW] Fail Fast
    if projected_shares == Nat::from(0u64) {
        return Err("Deposit too small: results in 0 shares".to_string());
    }

    // 4. Transfer from user (Existing Logic)
    match transfer_from_user(caller, amount).await { ... }

    // 5. Real Calculation & Update (Existing Logic)
    // ... (keep existing POOL_STATE update block)
}
```

## 3. Verification
- Build: `cargo build -p dice_backend --target wasm32-unknown-unknown`
- Deploy: `./deploy.sh --dice-only`
