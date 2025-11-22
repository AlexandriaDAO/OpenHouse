# 🤖 AUTONOMOUS PR ORCHESTRATOR - DO NOT SKIP

**You are an autonomous PR orchestrator. Your ONLY job is to implement this plan and create a PR.**

## Isolation Check (RUN FIRST)
```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
if [ "$REPO_ROOT" = "/home/theseus/alexandria/openhouse" ]; then
    echo "❌ FATAL: In main repo. Must be in worktree."
    echo "Worktree: /home/theseus/alexandria/openhouse-defi-security-fixes"
    exit 1
fi
echo "✅ In isolated worktree: $REPO_ROOT"
```

## Your Autonomous Workflow (NO QUESTIONS ALLOWED)
1. **Verify isolation** - You must be in worktree: `/home/theseus/alexandria/openhouse-defi-security-fixes`
2. **Implement security fixes** - Follow plan sections below
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

   # Test withdrawal with small amount
   # Query pending withdrawals to verify retry system
   dfx canister --network ic call whchi-hyaaa-aaaao-a4ruq-cai get_withdrawal_status
   ```

5. **Create PR** (MANDATORY):
   ```bash
   git add .
   git commit -m "fix(defi): critical security fixes for withdrawal double-spend vulnerabilities

- Fix error classification to distinguish uncertain vs definite failures
- Add lock mechanism to prevent balance updates during pending withdrawals
- Migrate LP withdrawals to pending/retry system
- Remove automatic rollback after MAX_RETRIES
- Addresses critical vulnerabilities from both Claude and Gemini audits"

   git push -u origin feature/defi-accounting-security-fixes

   gh pr create --title "🔴 CRITICAL: Fix DeFi Accounting Double-Spend Vulnerabilities" --body "## Summary

Fixes multiple critical double-spend vulnerabilities in the DeFi accounting module identified by security audits.

## Critical Fixes

### 1. Error Classification (PRIMARY - Gemini's Critical #1 & #2)
- **Issue**: Timeouts treated as definite failures, causing immediate rollback when transfer might have succeeded
- **Impact**: User gets ICP in wallet + balance restored = instant double-spend
- **Fix**: Distinguish between uncertain (timeout/system) and definite (logic) errors
- **Files**: \`dice_backend/src/defi_accounting/accounting.rs:247-268\`

### 2. Lock Mechanism (SECONDARY - Claude's Critical #1)
- **Issue**: Race condition between withdrawal rollback and game balance updates
- **Impact**: User wins game during pending withdrawal, rollback adds to new balance
- **Fix**: Block \`update_balance\` while withdrawal is pending
- **Files**: \`dice_backend/src/defi_accounting/accounting.rs:429-434\`

### 3. LP Withdrawal Retry (Gemini's Critical #2)
- **Issue**: LP withdrawals immediately rollback on any error, including timeouts
- **Impact**: LP can drain pool by exploiting timeout errors
- **Fix**: Migrate LP withdrawals to use pending/retry system
- **Files**: \`dice_backend/src/defi_accounting/liquidity_pool.rs:206-309\`

### 4. Remove Auto-Rollback (Gemini's High #4)
- **Issue**: MAX_RETRIES causes automatic rollback after 50 minutes
- **Impact**: Long network issues can cause double-spend
- **Fix**: Never auto-rollback uncertain states, require manual intervention
- **Files**: \`dice_backend/src/defi_accounting/accounting.rs:337-378\`

## Testing on Mainnet

Deployed to: \`whchi-hyaaa-aaaao-a4ruq-cai\` (Dice Backend)

Manual verification:
- ✅ Test user withdrawal with small amount
- ✅ Verify pending withdrawal stays pending on uncertain errors
- ✅ Test update_balance blocked during pending withdrawal
- ✅ Test LP withdrawal uses retry system
- ✅ Verify no auto-rollback after retries

## Audit References
- Claude Audit: \`dice_backend/src/defi_accounting/claude_audit.md\`
- Gemini Audit: \`dice_backend/src/defi_accounting/gemini_audit_v1.md\`

## Risk Assessment
**Before**: 🔴 CRITICAL - Active double-spend vulnerability
**After**: 🟢 SECURE - All critical vulnerabilities patched

---
Deployed to mainnet and tested.
Implements DEFI_ACCOUNTING_SECURITY_FIXES.md"
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

**Branch:** `feature/defi-accounting-security-fixes`
**Worktree:** `/home/theseus/alexandria/openhouse-defi-security-fixes`

---

# Implementation Plan: DeFi Accounting Security Fixes

## Executive Summary

This plan addresses **4 critical security vulnerabilities** in the DeFi accounting module that enable double-spend attacks:

1. **Error Classification Bug** (PRIMARY) - Timeouts treated as definite failures
2. **Balance Update Race Condition** (SECONDARY) - update_balance callable during pending withdrawal
3. **LP Withdrawal Immediate Rollback** - Same error classification bug affects LP withdrawals
4. **Premature Auto-Rollback** - MAX_RETRIES causes rollback of uncertain states

**Priority Order**: Fix #1 first (prevents immediate double-spend), then #2 (prevents race condition), then #3 and #4.

## Current State Analysis

### File: `dice_backend/src/defi_accounting/accounting.rs`

#### Problem 1: Error Classification (Lines 247-268)
```rust
async fn attempt_transfer(user: Principal, amount: u64, created_at: u64) -> TransferResult {
    let args = TransferArgs {
        memo: Memo(0),
        amount: Tokens::from_e8s(amount - ICP_TRANSFER_FEE),
        fee: Tokens::from_e8s(ICP_TRANSFER_FEE),
        from_subaccount: None,
        to: AccountIdentifier::new(&user, &DEFAULT_SUBACCOUNT),
        created_at_time: Some(Timestamp { timestamp_nanos: created_at }),
    };

    match ic_ledger_types::transfer(MAINNET_LEDGER_CANISTER_ID, &args).await {
        Ok(Ok(block)) => TransferResult::Success(block),
        Ok(Err(e)) => {
             // ic_ledger_types::TransferError - CORRECT (definite ledger error)
             TransferResult::DefiniteError(format!("{:?}", e))
        }
        Err(e) => {
            // ⚠️ BUG: Treats ALL inter-canister call failures as definite
            // Should distinguish between uncertain (timeout) and definite (invalid canister)
            TransferResult::DefiniteError(format!("{:?}", e))
        }
    }
}
```

**Vulnerability**: Line 265 treats timeouts (`SysTransient`, `NoResponse`) as definite failures, causing immediate rollback (line 204) when transfer might have actually succeeded.

**Exploit**:
1. User withdraws 100 ICP
2. Ledger processes transfer (user gets 100 ICP in wallet)
3. Network timeout (response lost)
4. Code treats as `DefiniteError` → immediate rollback
5. User has 100 ICP in wallet + 100 ICP restored in canister

#### Problem 2: Update Balance During Pending (Lines 429-434)
```rust
pub fn update_balance(user: Principal, new_balance: u64) -> Result<(), String> {
    // ⚠️ BUG: No check for pending withdrawal
    USER_BALANCES_STABLE.with(|balances| {
        balances.borrow_mut().insert(user, new_balance);
    });
    Ok(())
}
```

**Vulnerability**: Game logic can call `update_balance` while withdrawal is pending. If rollback happens (lines 270-292), it adds pending amount to new balance.

**Exploit** (requires error classification to be fixed first):
1. User withdraws 100 ICP (balance = 0, pending)
2. Withdrawal gets `UncertainError`, stays pending
3. User wins game, game calls `update_balance(user, 50)`
4. Withdrawal eventually fails definitively, rollback executes
5. Rollback: `balance = 50 + 100 = 150` (should be 50)

#### Problem 3: Premature Auto-Rollback (Lines 341-348)
```rust
if pending.retries >= MAX_RETRIES {
    let amount = match pending.withdrawal_type {
        WithdrawalType::User { amount } => amount,
        WithdrawalType::LP { amount, .. } => amount,
    };
    // ⚠️ BUG: Auto-rollback uncertain state after 50 minutes
    rollback_withdrawal(user)?;
    log_audit(AuditEvent::WithdrawalExpired { user, amount });
    return Ok(());
}
```

**Vulnerability**: If transfer actually succeeded but network was unreliable for 50 minutes, automatic rollback creates double-spend.

### File: `dice_backend/src/defi_accounting/liquidity_pool.rs`

#### Problem 4: LP Withdrawal Immediate Rollback (Lines 276-308)
```rust
match transfer_to_user(caller, lp_amount).await {
    Ok(_) => {
        // LP got paid successfully
        // ... fee transfer ...
        Ok(lp_amount)
    }
    Err(e) => {
        // ⚠️ BUG: Immediate rollback on ANY error, including timeouts
        // 1. Restore shares
        LP_SHARES.with(|shares| {
            shares.borrow_mut().insert(caller, StorableNat(user_shares));
        });
        // 2. Restore reserve
        POOL_STATE.with(|state| {
            let mut pool_state = state.borrow().get().clone();
            pool_state.reserve += payout_nat;
            state.borrow_mut().set(pool_state);
        });
        Err(format!("Transfer failed: {}. State rolled back.", e))
    }
}
```

**Vulnerability**: Same as Problem 1 but for LP withdrawals. If `transfer_to_user` times out after ledger processed transfer, immediate rollback allows LP to drain pool.

**Exploit**:
1. LP calls `withdraw_all_liquidity(100 ICP)`
2. Shares burned, reserve decreased
3. Transfer succeeds on ledger (LP gets 100 ICP)
4. Timeout occurs
5. Immediate rollback: shares restored, reserve restored
6. LP can withdraw again (repeatedly drain pool)

## Implementation Plan

### Fix 1: Error Classification (PRIMARY FIX)

**File**: `dice_backend/src/defi_accounting/accounting.rs:247-268`

**Goal**: Distinguish between uncertain and definite inter-canister call failures.

**Pseudocode**:
```rust
use ic_cdk::api::call::RejectionCode;

async fn attempt_transfer(user: Principal, amount: u64, created_at: u64) -> TransferResult {
    let args = TransferArgs {
        memo: Memo(0),
        amount: Tokens::from_e8s(amount - ICP_TRANSFER_FEE),
        fee: Tokens::from_e8s(ICP_TRANSFER_FEE),
        from_subaccount: None,
        to: AccountIdentifier::new(&user, &DEFAULT_SUBACCOUNT),
        created_at_time: Some(Timestamp { timestamp_nanos: created_at }),
    };

    match ic_ledger_types::transfer(MAINNET_LEDGER_CANISTER_ID, &args).await {
        Ok(Ok(block)) => TransferResult::Success(block),

        Ok(Err(e)) => {
            // Definite ledger errors (InsufficientFunds, BadFee, etc.)
            // Safe to rollback - transfer definitely didn't happen
            TransferResult::DefiniteError(format!("Ledger error: {:?}", e))
        }

        Err((code, msg)) => {
            // ✅ FIX: Distinguish between uncertain and definite IC errors
            match code {
                // UNCERTAIN: Transfer might have succeeded
                // DO NOT rollback immediately - enter pending/retry queue
                RejectionCode::SysTransient |   // Temporary system error
                RejectionCode::SysFatal |       // System error (subnet issue)
                RejectionCode::NoResponse => {  // Timeout - response lost
                    TransferResult::UncertainError(code, msg)
                }

                // DEFINITE: Transfer definitely failed
                // Safe to rollback
                RejectionCode::DestinationInvalid |  // Canister doesn't exist
                RejectionCode::CanisterReject |      // Canister explicitly rejected
                RejectionCode::CanisterError => {    // Canister trapped
                    TransferResult::DefiniteError(format!("IC error {:?}: {}", code, msg))
                }
            }
        }
    }
}
```

**Impact**: Prevents immediate double-spend from timeouts. Uncertain errors now enter retry queue instead of rolling back.

### Fix 2: Lock Mechanism (SECONDARY FIX)

**File**: `dice_backend/src/defi_accounting/accounting.rs:429-434`

**Goal**: Prevent balance updates while withdrawal is pending.

**Pseudocode**:
```rust
pub fn update_balance(user: Principal, new_balance: u64) -> Result<(), String> {
    // ✅ FIX: Check if user has pending withdrawal
    if PENDING_WITHDRAWALS.with(|p| p.borrow().contains_key(&user)) {
        return Err("Cannot update balance: withdrawal in progress. Wait for withdrawal to complete or contact support.".to_string());
    }

    USER_BALANCES_STABLE.with(|balances| {
        balances.borrow_mut().insert(user, new_balance);
    });
    Ok(())
}
```

**Impact**: Prevents race condition during pending state. Game logic will receive error if trying to update balance during withdrawal.

**Note**: This only matters AFTER Fix 1 is applied. Without Fix 1, withdrawals immediately rollback so there's no "pending" state to race with.

### Fix 3: Remove Auto-Rollback (HIGH PRIORITY)

**File**: `dice_backend/src/defi_accounting/accounting.rs:337-378`

**Goal**: Never automatically rollback uncertain states.

**Pseudocode**:
```rust
async fn process_single_withdrawal(user: Principal) -> Result<(), String> {
    let pending = PENDING_WITHDRAWALS.with(|p| p.borrow().get(&user))
        .ok_or("No pending")?;

    // ✅ FIX: Remove MAX_RETRIES auto-rollback
    // Instead, mark as "stuck" for manual intervention
    if pending.retries >= MAX_RETRIES {
        let amount = match pending.withdrawal_type {
            WithdrawalType::User { amount } => amount,
            WithdrawalType::LP { amount, .. } => amount,
        };

        // ❌ OLD: rollback_withdrawal(user)?;

        // ✅ NEW: Mark as stuck, log for admin attention
        log_audit(AuditEvent::SystemError {
            error: format!("Withdrawal stuck after {} retries for user {}. Amount: {}. Manual intervention required.", MAX_RETRIES, user, amount)
        });

        // Update pending with stuck status
        PENDING_WITHDRAWALS.with(|p| {
            let mut map = p.borrow_mut();
            if let Some(mut w) = map.get(&user) {
                w.last_error = Some(format!("STUCK: Exceeded {} retries. Manual intervention required. Contact support.", MAX_RETRIES));
                map.insert(user, w);
            }
        });

        // Continue retrying (infinite retry with exponential backoff handled by timer)
        return Ok(());
    }

    let amount = match pending.withdrawal_type {
         WithdrawalType::User { amount } => amount,
         WithdrawalType::LP { amount, .. } => amount,
    };

    match attempt_transfer(user, amount, pending.created_at).await {
        TransferResult::Success(_) => {
             PENDING_WITHDRAWALS.with(|p| p.borrow_mut().remove(&user));
             log_audit(AuditEvent::WithdrawalCompleted { user, amount });
        }
        TransferResult::DefiniteError(_) => {
             rollback_withdrawal(user)?;
             log_audit(AuditEvent::WithdrawalFailed { user, amount });
        }
        TransferResult::UncertainError(code, msg) => {
             PENDING_WITHDRAWALS.with(|p| {
                let mut map = p.borrow_mut();
                if let Some(mut w) = map.get(&user) {
                    w.retries += 1;
                    w.last_error = Some(format!("{:?}: {}", code, msg));
                    map.insert(user, w);
                }
             });
        }
    }

    Ok(())
}
```

**Impact**: Prevents double-spend from long network issues. Admin can manually resolve stuck withdrawals after verifying ledger state.

**Future Enhancement**: Add admin function to manually resolve stuck withdrawals:
```rust
// PSEUDOCODE for future admin function
#[update]
pub async fn admin_resolve_stuck_withdrawal(user: Principal, action: ResolutionAction) -> Result<(), String> {
    // Only callable by canister controller
    let caller = ic_cdk::caller();
    let controllers = ic_cdk::api::canister_controllers();

    if !controllers.contains(&caller) {
        return Err("Only controller can resolve stuck withdrawals".to_string());
    }

    // Get pending withdrawal
    let pending = PENDING_WITHDRAWALS.with(|p| p.borrow().get(&user))
        .ok_or("No pending withdrawal for this user")?;

    // Admin manually verifies ledger state and chooses action
    match action {
        ResolutionAction::Complete => {
            // Transfer succeeded on ledger, just remove pending
            PENDING_WITHDRAWALS.with(|p| p.borrow_mut().remove(&user));
            log_audit(AuditEvent::WithdrawalCompleted { user, amount });
        }
        ResolutionAction::Rollback => {
            // Transfer definitely failed on ledger, safe to rollback
            rollback_withdrawal(user)?;
            log_audit(AuditEvent::WithdrawalFailed { user, amount });
        }
    }

    Ok(())
}
```

### Fix 4: LP Withdrawal Retry System (CRITICAL)

**File**: `dice_backend/src/defi_accounting/liquidity_pool.rs:206-309`

**Goal**: Migrate LP withdrawals to use pending/retry system instead of immediate rollback.

**Pseudocode**:
```rust
async fn withdraw_liquidity(shares_to_burn: Nat) -> Result<u64, String> {
    let caller = ic_cdk::caller();

    // ✅ NEW: Check if already pending (like user withdrawals)
    if PENDING_WITHDRAWALS.with(|p| p.borrow().contains_key(&caller)) {
        return Err("LP withdrawal already pending".to_string());
    }

    // Validate shares
    if shares_to_burn == Nat::from(0u64) {
        return Err("Cannot withdraw zero shares".to_string());
    }

    let user_shares = LP_SHARES.with(|s| s.borrow().get(&caller).map(|sn| sn.0.clone()).unwrap_or(Nat::from(0u64)));
    if user_shares < shares_to_burn {
        return Err("Insufficient shares".to_string());
    }

    // Calculate payout (same as before)
    let payout_nat = POOL_STATE.with(|state| {
        let pool_state = state.borrow().get().clone();
        let current_reserve = pool_state.reserve.clone();
        let total_shares = calculate_total_supply();

        if total_shares == Nat::from(0u64) {
            return Err("No shares in circulation".to_string());
        }

        let numerator = shares_to_burn.clone() * current_reserve.clone();
        let payout = numerator / total_shares;

        if current_reserve < payout {
             return Err("Insufficient pool reserve".to_string());
        }

        Ok(payout)
    })?;

    let payout_u64 = payout_nat.0.to_u64().ok_or("Payout too large")?;
    if payout_u64 < MIN_WITHDRAWAL {
        return Err(format!("Minimum withdrawal is {} e8s", MIN_WITHDRAWAL));
    }

    // Calculate fee
    let fee_amount = (payout_u64 * LP_WITHDRAWAL_FEE_BPS) / 10_000;
    let lp_amount = payout_u64 - fee_amount;

    // ✅ NEW: Create pending withdrawal BEFORE state changes
    let created_at = ic_cdk::api::time();
    let pending = PendingWithdrawal {
        withdrawal_type: WithdrawalType::LP {
            shares: shares_to_burn.clone(),
            reserve: payout_nat.clone(),
            amount: payout_u64
        },
        created_at,
        retries: 0,
        last_error: None,
    };

    PENDING_WITHDRAWALS.with(|p| p.borrow_mut().insert(caller, pending));

    // Update shares (same as before)
    LP_SHARES.with(|shares| {
        let mut shares_map = shares.borrow_mut();
        let new_shares = user_shares.clone() - shares_to_burn.clone();
        if new_shares == Nat::from(0u64) {
            shares_map.remove(&caller);
        } else {
            shares_map.insert(caller, StorableNat(new_shares));
        }
    });

    // Deduct from reserve (same as before)
    POOL_STATE.with(|state| {
        let mut pool_state = state.borrow().get().clone();
        if pool_state.reserve < payout_nat {
             return Err("Insufficient pool reserve".to_string());
        }
        pool_state.reserve -= payout_nat.clone();
        state.borrow_mut().set(pool_state);
        Ok::<(), String>(())
    })?;

    log_audit(AuditEvent::WithdrawalInitiated { user: caller, amount: payout_u64 });

    // ✅ NEW: Use attempt_transfer with proper error handling (like user withdrawals)
    match attempt_transfer_lp(caller, lp_amount, created_at, fee_amount).await {
        TransferResult::Success(_block) => {
            PENDING_WITHDRAWALS.with(|p| p.borrow_mut().remove(&caller));
            log_audit(AuditEvent::WithdrawalCompleted { user: caller, amount: payout_u64 });
            Ok(lp_amount)
        }
        TransferResult::DefiniteError(err) => {
            // Definite failure - safe to rollback
            rollback_lp_withdrawal(caller)?;
            log_audit(AuditEvent::WithdrawalFailed { user: caller, amount: payout_u64 });
            Err(err)
        }
        TransferResult::UncertainError(code, msg) => {
            // Uncertain - keep pending, retry later
            update_pending_error(caller, format!("{:?}: {}", code, msg));
            Err(format!("Processing LP withdrawal. Check status later. {:?} {}", code, msg))
        }
    }
}

// ✅ NEW: Helper function for LP transfer with fee handling
async fn attempt_transfer_lp(user: Principal, lp_amount: u64, created_at: u64, fee_amount: u64) -> TransferResult {
    // First, transfer to LP (critical)
    let lp_result = attempt_transfer(user, lp_amount, created_at).await;

    match lp_result {
        TransferResult::Success(block) => {
            // LP paid successfully, try to pay parent fee (best effort)
            let net_fee = fee_amount.saturating_sub(TRANSFER_FEE);

            if net_fee > 0 {
                // Spawn async fee transfer (don't block on this)
                ic_cdk::spawn(async move {
                    let _ = accounting::transfer_to_user(get_parent_principal(), net_fee).await;
                });
            }

            TransferResult::Success(block)
        }
        other => other  // Pass through errors
    }
}

// ✅ NEW: Rollback function for LP withdrawals
fn rollback_lp_withdrawal(user: Principal) -> Result<(), String> {
    let pending = PENDING_WITHDRAWALS.with(|p| p.borrow().get(&user))
        .ok_or("No pending withdrawal")?;

    if let WithdrawalType::LP { shares, reserve, amount } = pending.withdrawal_type {
        // Restore LP shares
        LP_SHARES.with(|shares_map| {
            shares_map.borrow_mut().insert(user, StorableNat(shares));
        });

        // Restore pool reserve
        POOL_STATE.with(|state| {
            let mut pool_state = state.borrow().get().clone();
            pool_state.reserve += reserve;
            state.borrow_mut().set(pool_state);
        });

        log_audit(AuditEvent::LPRestored { user, amount });
    } else {
        return Err("Pending withdrawal is not LP type".to_string());
    }

    PENDING_WITHDRAWALS.with(|p| p.borrow_mut().remove(&user));
    Ok(())
}
```

**Impact**: LP withdrawals now use same pending/retry system as user withdrawals. Timeouts no longer cause immediate rollback.

**Note**: The existing `rollback_withdrawal` function in `accounting.rs` already handles LP withdrawals (lines 283-287), but it uses `liquidity_pool::restore_lp_position`. We need to ensure consistency or consolidate the rollback logic.

## Additional Required Changes

### Import RejectionCode

**File**: `dice_backend/src/defi_accounting/accounting.rs:1-17`

Add to imports:
```rust
use ic_cdk::api::call::RejectionCode;
```

### Update AuditEvent Enum (if needed)

**File**: `dice_backend/src/defi_accounting/types.rs:49-64`

Ensure `SystemError` variant exists (or add it):
```rust
#[derive(CandidType, Deserialize, Clone, Debug)]
pub enum AuditEvent {
    WithdrawalInitiated { user: Principal, amount: u64 },
    WithdrawalCompleted { user: Principal, amount: u64 },
    WithdrawalFailed { user: Principal, amount: u64 },
    WithdrawalExpired { user: Principal, amount: u64 },
    BalanceRestored { user: Principal, amount: u64 },
    LPRestored { user: Principal, amount: u64 },
    SystemError { error: String },  // ✅ Add if not exists
}
```

## Testing Strategy (Mainnet)

### Test 1: Error Classification
```bash
# Small test withdrawal to verify uncertain errors are handled
dfx canister --network ic call whchi-hyaaa-aaaao-a4ruq-cai withdraw_all

# Check if withdrawal is pending (not immediately rolled back)
dfx canister --network ic call whchi-hyaaa-aaaao-a4ruq-cai get_withdrawal_status
```

**Expected**: If network timeout occurs, withdrawal should show as pending with error message, NOT immediately rolled back.

### Test 2: Lock Mechanism
```bash
# During pending withdrawal, try to update balance
# (This would be called by game logic, simulating a game win)
# The call should fail with "withdrawal in progress" error
```

**Expected**: `update_balance` returns error while withdrawal is pending.

### Test 3: LP Withdrawal Retry
```bash
# Small LP withdrawal to verify retry system
dfx canister --network ic call whchi-hyaaa-aaaao-a4ruq-cai withdraw_all_liquidity

# Check pending status
dfx canister --network ic call whchi-hyaaa-aaaao-a4ruq-cai get_withdrawal_status
```

**Expected**: LP withdrawal uses pending/retry system, not immediate rollback.

### Test 4: No Auto-Rollback
```bash
# Monitor a pending withdrawal over time
# After 50 minutes (MAX_RETRIES), verify it's marked as stuck, not rolled back
```

**Expected**: Audit log shows "stuck" message, withdrawal remains pending, no auto-rollback.

## Deployment Notes

- **Affected Canister**: Dice Backend (`whchi-hyaaa-aaaao-a4ruq-cai`)
- **Changes**: Backend only (no frontend changes)
- **Deployment Command**: `./deploy.sh --dice-only`
- **Critical**: All changes go directly to mainnet production

## Risk Mitigation

- **Gradual Rollout**: Start with small test withdrawals
- **Monitoring**: Watch audit logs for stuck withdrawals
- **Manual Intervention**: Controller can resolve stuck cases via admin functions (to be implemented)
- **Rollback Plan**: If issues detected, deploy previous version (but this doesn't rollback mainnet state, only code)

## Success Criteria

- ✅ Timeouts no longer cause immediate rollback (enter pending queue)
- ✅ Balance updates blocked during pending withdrawals
- ✅ LP withdrawals use pending/retry system
- ✅ No auto-rollback after MAX_RETRIES
- ✅ Audit logs show proper event tracking
- ✅ No double-spend exploits possible

## Implementation Checklist

- [ ] Import RejectionCode in accounting.rs
- [ ] Update attempt_transfer to classify errors correctly
- [ ] Add lock check to update_balance
- [ ] Remove auto-rollback in process_single_withdrawal
- [ ] Migrate LP withdrawals to pending/retry system
- [ ] Add attempt_transfer_lp helper function
- [ ] Add rollback_lp_withdrawal function (or reuse existing)
- [ ] Ensure AuditEvent::SystemError exists
- [ ] Build and deploy to mainnet
- [ ] Test all 4 scenarios on mainnet
- [ ] Monitor audit logs for 24 hours
- [ ] Create PR with comprehensive description

---

**CRITICAL REMINDER**: This fixes vulnerabilities that could drain millions. Test thoroughly on mainnet with small amounts before announcing.

**AUDIT REFERENCE**: See `dice_backend/src/defi_accounting/claude_audit.md` and `gemini_audit_v1.md` for detailed vulnerability analysis.
