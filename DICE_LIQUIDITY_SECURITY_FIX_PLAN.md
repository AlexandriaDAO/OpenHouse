# 🤖 AUTONOMOUS PR ORCHESTRATOR - DO NOT SKIP

**You are an autonomous PR orchestrator. Your ONLY job is to implement this plan and create a PR.**

## Isolation Check (RUN FIRST)
```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
if [ "$REPO_ROOT" = "/home/theseus/alexandria/openhouse" ]; then
    echo "❌ FATAL: In main repo. Must be in worktree."
    echo "Worktree: /home/theseus/alexandria/openhouse-liquidity-security"
    exit 1
fi
echo "✅ In isolated worktree: $REPO_ROOT"
```

## Your Autonomous Workflow (NO QUESTIONS ALLOWED)
1. **Verify isolation** - You must be in worktree: `/home/theseus/alexandria/openhouse-liquidity-security`
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

   # Test the live site
   echo "Visit: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io"
   ```

5. **Create PR** (MANDATORY):
   ```bash
   git add .
   git commit -m "fix(dice): critical security fixes for liquidity pool

- Add CallerGuard to prevent concurrent deposit/withdrawal race conditions
- Implement upgradeable admin mechanism
- Add protection against share manipulation attack"
   git push -u origin feature/dice-liquidity-security-fixes
   gh pr create --title "Fix: Critical security issues in dice liquidity pool" --body "Implements security fixes from PR #42 analysis

Fixes:
- Race conditions in concurrent deposits/withdrawals
- Hardcoded admin principal (now upgradeable)
- Share manipulation protection

Reference: https://github.com/AlexandriaDAO/OpenHouse/pull/42#issuecomment-3543859689

Deployed to mainnet:
- Frontend: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io
- Dice backend: whchi-hyaaa-aaaao-a4ruq-cai"
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

**Branch:** `feature/dice-liquidity-security-fixes`
**Worktree:** `/home/theseus/alexandria/openhouse-liquidity-security`

---

# Implementation Plan

## Context

PR #42 (https://github.com/AlexandriaDAO/OpenHouse/pull/42#issuecomment-3543859689) identified critical security issues. Analysis shows:

**Already Fixed in Current Code:**
- ✅ Pool underflow - now uses `ic_cdk::trap` (lines 412-417)
- ✅ Authorization on initialization - admin check exists (lines 87-98)

**Still Needs Fixing:**
1. ⚠️ Race condition in concurrent operations
2. ⚠️ Hardcoded admin principal
3. ⚠️ Share manipulation vulnerability

## Current State Documentation

### File Structure
```
dice_backend/src/
├── defi_accounting/
│   ├── liquidity_pool.rs (MODIFY - main changes)
│   ├── mod.rs (MODIFY - export guard)
│   └── nat_helpers.rs (NO CHANGE)
├── lib.rs (MODIFY - add admin management)
└── types.rs (MODIFY - add guard types)
```

### Current Issues

1. **Race Condition** (lines 134-204, 208-283)
   - `deposit_liquidity` and `withdraw_liquidity` have no concurrency protection
   - Multiple calls from same user can corrupt share calculations

2. **Hardcoded Admin** (line 20)
   - `const POOL_ADMIN: &str = "p7336-..."` cannot be updated
   - Single point of failure

3. **Share Manipulation** (lines 167-170)
   - First depositor gets 1:1 shares
   - Could deposit 1 e8s, direct transfer, manipulate share price

## Implementation (PSEUDOCODE)

### 1. Create Guard Module: `dice_backend/src/defi_accounting/guard.rs` (NEW)
```rust
// PSEUDOCODE
use candid::Principal;
use std::collections::BTreeSet;
use std::cell::RefCell;

thread_local! {
    static PENDING_OPERATIONS: RefCell<BTreeSet<Principal>> = RefCell::new(BTreeSet::new());
}

pub struct CallerGuard {
    principal: Principal,
}

impl CallerGuard {
    pub fn new() -> Result<Self, String> {
        let caller = ic_cdk::caller();

        PENDING_OPERATIONS.with(|ops| {
            let mut pending = ops.borrow_mut();
            if pending.contains(&caller) {
                return Err(format!(
                    "Operation already in progress for principal {}. Please wait.",
                    caller.to_string()
                ));
            }
            pending.insert(caller);
            Ok(Self { principal: caller })
        })
    }
}

impl Drop for CallerGuard {
    fn drop(&mut self) {
        PENDING_OPERATIONS.with(|ops| {
            ops.borrow_mut().remove(&self.principal);
        });
    }
}

// Helper for checking without acquiring guard
pub fn is_operation_pending(principal: Principal) -> bool {
    PENDING_OPERATIONS.with(|ops| ops.borrow().contains(&principal))
}
```

### 2. Update `dice_backend/src/defi_accounting/mod.rs` (MODIFY)
```rust
// PSEUDOCODE - Add to existing exports
pub mod guard;
pub use guard::CallerGuard;
```

### 3. Update `dice_backend/src/defi_accounting/liquidity_pool.rs` (MODIFY)

#### Replace hardcoded admin (line 20) with upgradeable storage:
```rust
// PSEUDOCODE - Replace line 20
// DELETE: const POOL_ADMIN: &str = "p7336-...";

// ADD after line 65 (after POOL_STATE):
thread_local! {
    static POOL_ADMIN: RefCell<StableCell<Principal, VirtualMemory<DefaultMemoryImpl>>> = {
        RefCell::new(StableCell::init(
            crate::MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(14))),
            Principal::from_text("p7336-jmpo5-pkjsf-7dqkd-ea3zu-g2ror-ctcn2-sxtuo-tjve3-ulrx7-wae")
                .unwrap()
        ).expect("Failed to init admin"))
    };
}
```

#### Add guard to deposit_liquidity (line 134):
```rust
// PSEUDOCODE - Modify deposit_liquidity function
pub async fn deposit_liquidity(amount: u64) -> Result<Nat, String> {
    // ADD at beginning:
    let _guard = super::guard::CallerGuard::new()?;

    // Validate
    if amount < MIN_DEPOSIT {
        return Err(format!("Minimum deposit is {} e8s", MIN_DEPOSIT));
    }

    // ADD: Protection against share manipulation
    let total_shares = calculate_total_supply();
    if nat_is_zero(&total_shares) && amount < 100_000_000 {  // 1 ICP minimum for first deposit
        return Err("First deposit must be at least 1 ICP to prevent share manipulation".to_string());
    }

    // Rest of existing code...
}
```

#### Add guard to withdraw_liquidity (line 208):
```rust
// PSEUDOCODE - Modify withdraw_liquidity function
pub async fn withdraw_liquidity(shares_to_burn: Nat) -> Result<u64, String> {
    // ADD at beginning:
    let _guard = super::guard::CallerGuard::new()?;

    let caller = ic_cdk::caller();
    // Rest of existing code...
}
```

#### Update initialize_pool_from_house to use upgradeable admin (line 86):
```rust
// PSEUDOCODE - Modify admin check
pub async fn initialize_pool_from_house() -> Result<String, String> {
    let caller = ic_cdk::caller();

    // REPLACE lines 89-98 with:
    let admin = POOL_ADMIN.with(|a| a.borrow().get().clone());

    if caller != admin {
        return Err(format!(
            "Unauthorized: Only pool admin can initialize. Caller: {}",
            caller
        ));
    }

    // Rest of existing code...
}
```

### 4. Add Admin Management Functions: `dice_backend/src/lib.rs` (MODIFY)

```rust
// PSEUDOCODE - Add these functions to lib.rs

#[update]
async fn set_pool_admin(new_admin: Principal) -> Result<String, String> {
    // Only current admin can update
    let caller = ic_cdk::caller();
    let current_admin = defi_accounting::liquidity_pool::get_pool_admin();

    if caller != current_admin {
        return Err("Only current admin can transfer admin rights".to_string());
    }

    if new_admin == Principal::anonymous() {
        return Err("Cannot set anonymous principal as admin".to_string());
    }

    defi_accounting::liquidity_pool::set_pool_admin(new_admin);
    Ok(format!("Admin updated from {} to {}", current_admin, new_admin))
}

#[query]
fn get_pool_admin() -> Principal {
    defi_accounting::liquidity_pool::get_pool_admin()
}
```

### 5. Add Admin Helper Functions: `dice_backend/src/defi_accounting/liquidity_pool.rs` (MODIFY)

```rust
// PSEUDOCODE - Add at end of file
pub fn get_pool_admin() -> Principal {
    POOL_ADMIN.with(|a| a.borrow().get().clone())
}

pub fn set_pool_admin(new_admin: Principal) {
    POOL_ADMIN.with(|a| {
        a.borrow_mut().set(new_admin).expect("Failed to set admin");
    });
}
```

### 6. Update Candid Interface: `dice_backend/dice_backend.did` (MODIFY)

```candid
// PSEUDOCODE - Add to service definition
service : {
    // ... existing methods ...

    // Admin management
    set_pool_admin : (principal) -> (variant { Ok: text; Err: text });
    get_pool_admin : () -> (principal) query;
}
```

## Testing Strategy

### Manual Test Commands (After Deployment)
```bash
# 1. Test concurrent protection
dfx canister --network ic call dice_backend deposit_liquidity '(100000000)' &
dfx canister --network ic call dice_backend deposit_liquidity '(100000000)' &
# One should fail with "Operation already in progress"

# 2. Test admin functions
dfx canister --network ic call dice_backend get_pool_admin
# Should return current admin

# 3. Test share manipulation protection
dfx canister --network ic call dice_backend deposit_liquidity '(1000000)'
# Should fail with "First deposit must be at least 1 ICP"
```

## Deployment Notes

- **Affected Canister**: dice_backend (`whchi-hyaaa-aaaao-a4ruq-cai`)
- **Memory IDs Used**: 14 (for admin storage)
- **Breaking Changes**: None (backward compatible)
- **Migration**: Admin automatically set to existing value on upgrade

## Summary of Changes

1. **CallerGuard** prevents concurrent operations (50 lines)
2. **Upgradeable admin** stored in stable memory (20 lines)
3. **Share manipulation protection** via minimum first deposit (5 lines)
4. **Total LOC added**: ~75 lines
5. **Files modified**: 5 (3 existing, 1 new, 1 candid)

## P0 Issues Fixed

✅ Race condition in deposits/withdrawals
✅ Hardcoded admin principal
✅ Share manipulation vulnerability

## P1 Issues Not Addressed (By Design)

- Cross-caller synchronization (not needed)
- Integer overflow protection (unrealistic)
- Strict solvency checks (would block gameplay)