# 🤖 AUTONOMOUS PR ORCHESTRATOR - DO NOT SKIP

**You are an autonomous PR orchestrator. Your ONLY job is to implement this plan and create a PR.**

## Isolation Check (RUN FIRST)
```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
if [ "$REPO_ROOT" = "/home/theseus/alexandria/openhouse" ]; then
    echo "❌ FATAL: In main repo. Must be in worktree."
    echo "Worktree: /home/theseus/alexandria/openhouse-remove-legacy"
    exit 1
fi
echo "✅ In isolated worktree: $REPO_ROOT"
```

## Your Autonomous Workflow (NO QUESTIONS ALLOWED)
1. **Verify isolation** - You must be in worktree: `/home/theseus/alexandria/openhouse-remove-legacy`
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

   # Test the mode
   dfx canister --network ic call whchi-hyaaa-aaaao-a4ruq-cai get_house_mode
   # Should return: ("liquidity_pool")
   ```

5. **Create PR** (MANDATORY):
   ```bash
   git add .
   git commit -m "refactor(dice): remove legacy mode, simplify to LP-only system"
   git push -u origin feature/remove-legacy-mode
   gh pr create --title "Refactor: Remove Legacy Mode from Dice Backend" --body "Implements REMOVE_LEGACY_MODE_PLAN.md

Deployed to mainnet:
- Dice Backend: whchi-hyaaa-aaaao-a4ruq-cai

## Changes
- Removed HouseMode enum (Legacy variant)
- Removed get_legacy_house_balance()
- Simplified get_house_balance() to always use LP reserve
- Removed dual-mode logic from game.rs
- Updated documentation to reflect LP-only system

## LOC Impact
- Before: ~1597 lines
- After: ~1450 lines (estimated -147 lines)

## Testing
✅ WASM build succeeds
✅ Deployed to mainnet
✅ get_house_mode() returns 'liquidity_pool'"
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
- 🗑️ DELETE, DON'T COMMENT: Remove all code and comments about legacy - no "// removed legacy mode" comments

**Branch:** `feature/remove-legacy-mode`
**Worktree:** `/home/theseus/alexandria/openhouse-remove-legacy`

---

# Implementation Plan: Remove Legacy Mode

## Context

**Problem:** Dice backend has dual-mode system (Legacy vs LiquidityPool) that adds unnecessary complexity.

**Current State:**
- Only 1 test user with ~0.97 ICP deposit
- 0 games played
- Canister will be wiped and reinstalled
- Liquidity Pool system is ready and tested

**Goal:** Simplify codebase by removing Legacy mode entirely, keeping only LP system.

**Expected LOC Reduction:** ~150 lines removed

---

## Current State Documentation

### Files Affected (7 files)
```
dice_backend/src/
├── lib.rs                              # HouseMode conversion to string
├── game.rs                             # Legacy mode checks in game logic
└── defi_accounting/
    ├── accounting.rs                   # get_legacy_house_balance(), HouseMode enum
    ├── liquidity_pool.rs               # Legacy fallback in can_accept_bets()
    ├── mod.rs                          # Re-exports
    ├── CLAUDE.md                       # Documentation
    └── README.md                       # Documentation
```

### Legacy Code Locations

#### 1. `accounting.rs` - HouseMode enum and legacy balance calculation
```rust
// Lines 18-21: HouseMode enum
pub enum HouseMode {
    Legacy,        // ← REMOVE THIS
    LiquidityPool,
}

// Lines 274-278: get_legacy_house_balance()
pub(crate) fn get_legacy_house_balance() -> u64 {
    // REMOVE ENTIRE FUNCTION
}

// Lines 282-293: get_house_balance() - Dual mode logic
pub fn get_house_balance() -> u64 {
    // Check LP pool first
    if liquidity_pool::is_pool_initialized() {
        let pool_reserve = liquidity_pool::get_pool_reserve();
        if pool_reserve > 0 {
            return pool_reserve;
        }
    }
    // Fall back to legacy  ← REMOVE FALLBACK
    get_legacy_house_balance()
}

// Lines 296-309: get_house_mode() - Mode detection
pub fn get_house_mode() -> HouseMode {
    if liquidity_pool::is_pool_initialized() && liquidity_pool::get_pool_reserve() > 0 {
        HouseMode::LiquidityPool
    } else {
        HouseMode::Legacy  // ← REMOVE FALLBACK
    }
}
```

#### 2. `game.rs` - Legacy mode checks in game logic
```rust
// Line 240: Get house mode
let house_mode = accounting::get_house_mode();

// Lines 250-258: Win handling
match house_mode {
    accounting::HouseMode::LiquidityPool => {
        liquidity_pool::update_pool_on_win(profit);
    }
    accounting::HouseMode::Legacy => {  // ← REMOVE THIS BRANCH
        // Legacy mode: no pool update needed
    }
}

// Lines 261-268: Loss handling
match house_mode {
    accounting::HouseMode::LiquidityPool => {
        liquidity_pool::update_pool_on_loss(bet_amount);
    }
    accounting::HouseMode::Legacy => {  // ← REMOVE THIS BRANCH
        // Legacy mode: no pool update needed
    }
}
```

#### 3. `liquidity_pool.rs` - Legacy fallback in can_accept_bets()
```rust
// Lines 366-375: can_accept_bets()
pub fn can_accept_bets() -> bool {
    let pool_reserve = get_pool_reserve();

    // Can accept if pool has minimum OR legacy house has minimum
    if pool_reserve >= MIN_OPERATING_BALANCE {
        true
    } else {
        let legacy_balance = accounting::get_legacy_house_balance();  // ← REMOVE
        legacy_balance >= MIN_OPERATING_BALANCE                       // ← REMOVE
    }
}
```

#### 4. `lib.rs` - HouseMode to string conversion
```rust
// Lines 183-189: get_house_mode() API endpoint
#[query]
fn get_house_mode() -> String {
    // Convert enum to string for backward compatibility
    match defi_accounting::get_house_mode() {
        defi_accounting::HouseMode::LiquidityPool => "liquidity_pool".to_string(),
        defi_accounting::HouseMode::Legacy => "legacy".to_string(),  // ← REMOVE
    }
}
```

#### 5. `mod.rs` - HouseMode export
```rust
// Line 22: HouseMode export
pub use accounting::{
    // ... other exports
    HouseMode,  // ← Keep but simplified
};
```

#### 6. `CLAUDE.md` and `README.md`
- Multiple references to dual-mode operation
- Legacy mode documentation
- Examples showing Legacy vs LP mode

---

## Implementation Plan

**IMPORTANT:** When removing code:
- ✅ DELETE completely - no commented-out code
- ✅ DELETE related comments explaining legacy mode
- ✅ DELETE comments like "removed legacy mode" or "was: Legacy"
- ✅ Clean, simple code as if legacy never existed

### Step 1: Remove HouseMode::Legacy Variant

**File:** `dice_backend/src/defi_accounting/accounting.rs`

```rust
// BEFORE (Lines 18-21)
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq)]
pub enum HouseMode {
    Legacy,
    LiquidityPool,
}

// AFTER - Remove entire enum, no longer needed
// DELETE LINES 12-21 (entire enum definition and comments)
```

### Step 2: Remove get_legacy_house_balance()

**File:** `dice_backend/src/defi_accounting/accounting.rs`

```rust
// BEFORE (Lines 273-278)
// Keep legacy calculation available (internal use only)
pub(crate) fn get_legacy_house_balance() -> u64 {
    let canister_balance = CACHED_CANISTER_BALANCE.with(|b| *b.borrow());
    let total_user_deposits = get_total_user_deposits();
    canister_balance.saturating_sub(total_user_deposits)
}

// AFTER - Delete entire function
// DELETE LINES 273-278
```

### Step 3: Simplify get_house_balance()

**File:** `dice_backend/src/defi_accounting/accounting.rs`

```rust
// BEFORE (Lines 280-293)
// Update main house balance function for dual-mode
#[query]
pub fn get_house_balance() -> u64 {
    // Check LP pool first
    if liquidity_pool::is_pool_initialized() {
        let pool_reserve = liquidity_pool::get_pool_reserve();
        if pool_reserve > 0 {
            return pool_reserve;
        }
    }

    // Fall back to legacy
    get_legacy_house_balance()
}

// AFTER - Simplify to LP-only
#[query]
pub fn get_house_balance() -> u64 {
    // Always use liquidity pool reserve
    liquidity_pool::get_pool_reserve()
}
```

### Step 4: Remove get_house_mode()

**File:** `dice_backend/src/defi_accounting/accounting.rs`

```rust
// BEFORE (Lines 295-309)
// Add helper for mode detection
pub fn get_house_mode() -> HouseMode {
    // ... long comment block
    if liquidity_pool::is_pool_initialized() && liquidity_pool::get_pool_reserve() > 0 {
        HouseMode::LiquidityPool
    } else {
        HouseMode::Legacy
    }
}

// AFTER - Delete entire function
// DELETE LINES 295-309
// No longer needed since there's only one mode
```

### Step 5: Simplify game logic

**File:** `dice_backend/src/game.rs`

```rust
// BEFORE (Lines 239-269)
// After determining outcome
let house_mode = accounting::get_house_mode();

if is_win {
    let current_balance = accounting::get_balance(caller);
    let new_balance = current_balance.checked_add(payout)
        .ok_or("Balance overflow when adding winnings")?;
    accounting::update_balance(caller, new_balance)?;

    let profit = payout.saturating_sub(bet_amount);

    // Update pool only if in LP mode (using type-safe enum)
    match house_mode {
        accounting::HouseMode::LiquidityPool => {
            liquidity_pool::update_pool_on_win(profit);
        }
        accounting::HouseMode::Legacy => {
            // Legacy mode: no pool update needed
        }
    }
} else {
    // Player lost
    match house_mode {
        accounting::HouseMode::LiquidityPool => {
            liquidity_pool::update_pool_on_loss(bet_amount);
        }
        accounting::HouseMode::Legacy => {
            // Legacy mode: no pool update needed
        }
    }
}

// AFTER - LP-only logic
if is_win {
    let current_balance = accounting::get_balance(caller);
    let new_balance = current_balance.checked_add(payout)
        .ok_or("Balance overflow when adding winnings")?;
    accounting::update_balance(caller, new_balance)?;

    let profit = payout.saturating_sub(bet_amount);

    // Update pool reserve
    liquidity_pool::update_pool_on_win(profit);
} else {
    // Player lost - add to pool
    liquidity_pool::update_pool_on_loss(bet_amount);
}
```

### Step 6: Simplify can_accept_bets()

**File:** `dice_backend/src/defi_accounting/liquidity_pool.rs`

```rust
// BEFORE (Lines 366-375)
pub fn can_accept_bets() -> bool {
    let pool_reserve = get_pool_reserve();

    // Can accept if pool has minimum OR legacy house has minimum
    if pool_reserve >= MIN_OPERATING_BALANCE {
        true
    } else {
        let legacy_balance = accounting::get_legacy_house_balance();
        legacy_balance >= MIN_OPERATING_BALANCE
    }
}

// AFTER - LP-only check
pub fn can_accept_bets() -> bool {
    let pool_reserve = get_pool_reserve();
    pool_reserve >= MIN_OPERATING_BALANCE
}
```

### Step 7: Simplify get_house_mode() API endpoint

**File:** `dice_backend/src/lib.rs`

```rust
// BEFORE (Lines 183-189)
#[query]
fn get_house_mode() -> String {
    // Convert enum to string for backward compatibility
    match defi_accounting::get_house_mode() {
        defi_accounting::HouseMode::LiquidityPool => "liquidity_pool".to_string(),
        defi_accounting::HouseMode::Legacy => "legacy".to_string(),
    }
}

// AFTER - Always return liquidity_pool
#[query]
fn get_house_mode() -> String {
    "liquidity_pool".to_string()
}
```

### Step 8: Update mod.rs exports

**File:** `dice_backend/src/defi_accounting/mod.rs`

```rust
// BEFORE
pub use accounting::{
    deposit,
    withdraw,
    withdraw_all,
    get_balance,
    get_my_balance,
    get_house_balance,
    get_house_mode,      // ← REMOVE
    get_max_allowed_payout,
    get_accounting_stats,
    audit_balances,
    refresh_canister_balance,
    update_balance,
    AccountingStats,
    Account,
    HouseMode,           // ← REMOVE (enum no longer exists)
};

// AFTER
pub use accounting::{
    deposit,
    withdraw,
    withdraw_all,
    get_balance,
    get_my_balance,
    get_house_balance,
    get_max_allowed_payout,
    get_accounting_stats,
    audit_balances,
    refresh_canister_balance,
    update_balance,
    AccountingStats,
    Account,
};
```

### Step 9: Update documentation

**File:** `dice_backend/src/defi_accounting/CLAUDE.md`

```markdown
<!-- BEFORE -->
## Core Features
- **Dual Mode Operation**: Legacy house balance OR Liquidity Pool (LP) system
...

## Architecture Overview

### Operating Modes
```rust
pub enum HouseMode {
    Legacy,        // Traditional house balance
    LiquidityPool  // LP providers stake ICP for shares
}
```

<!-- AFTER -->
## Core Features
- **Liquidity Pool System**: LP providers stake ICP for shares
- **User Deposits/Withdrawals**: Player fund management with ICP ledger
- **Balance Tracking**: Stable storage persistence across upgrades
- **Bet Limits**: 10% of pool balance max payout per bet

<!-- Remove all dual-mode references -->
<!-- Remove all Legacy mode sections -->
<!-- Update all examples to show LP-only mode -->
```

**File:** `dice_backend/src/defi_accounting/README.md`

```markdown
<!-- BEFORE -->
## 🎯 Overview

This module provides complete DeFi functionality for ICP-based games with two operating modes:

### Legacy Mode
- Traditional house balance management
- Direct player deposits and withdrawals
- House funds at risk

### Liquidity Pool Mode (Default)
- Liquidity providers stake ICP for shares
...

<!-- AFTER -->
## 🎯 Overview

This module provides complete DeFi functionality for ICP-based games using a Liquidity Pool system:

- Liquidity providers stake ICP for shares
- Players win/lose from the pool
- Distributed risk among LPs
- Fully decentralized (no admin control)

<!-- Remove all Legacy mode sections -->
<!-- Remove dual-mode decision trees -->
<!-- Simplify all examples to LP-only -->
```

---

## Affected Components

### Canisters
- **Dice Backend** (`whchi-hyaaa-aaaao-a4ruq-cai`) - MODIFIED

### Other Backends
- Crash, Plinko, Mines - NOT AFFECTED (don't have accounting module yet)

---

## Build & Deployment

```bash
# Verify in worktree
pwd  # Should be /home/theseus/alexandria/openhouse-remove-legacy

# Build WASM
cargo build --target wasm32-unknown-unknown --release

# Verify build
ls -lh target/wasm32-unknown-unknown/release/dice_backend.wasm

# Deploy to mainnet
./deploy.sh --dice-only

# Verify deployment
dfx canister --network ic call whchi-hyaaa-aaaao-a4ruq-cai get_house_mode
# Expected: ("liquidity_pool")

dfx canister --network ic call whchi-hyaaa-aaaao-a4ruq-cai get_house_balance
# Expected: Pool reserve amount
```

---

## Expected Impact

### Lines of Code
```yaml
before:
  total_lines: ~1597

after:
  total_lines: ~1450

removed:
  - HouseMode enum: ~10 lines
  - get_legacy_house_balance(): ~5 lines
  - get_house_mode(): ~15 lines
  - Dual-mode checks in game.rs: ~30 lines
  - Legacy fallback logic: ~20 lines
  - Documentation updates: ~50 lines
  - Comments and spacing: ~17 lines

total_reduction: ~147 lines
percentage: -9.2%
```

### Complexity Reduction
```yaml
removed_concepts:
  - Dual-mode system
  - Mode detection logic
  - Legacy balance calculation
  - Mode-based conditionals in game logic

simplified_functions:
  - get_house_balance(): 13 lines → 3 lines
  - can_accept_bets(): 10 lines → 3 lines
  - Game win/loss handling: 30 lines → 15 lines
  - get_house_mode() API: 7 lines → 3 lines
```

### Maintenance Benefits
```yaml
benefits:
  - Single code path for all operations
  - No mode detection logic
  - Simpler testing (one mode to test)
  - Clearer documentation
  - Easier onboarding for new developers
  - No legacy migration concerns
```

---

## Testing Checklist

```bash
# Build verification
cargo build --target wasm32-unknown-unknown --release

# Should succeed with no errors
# Expected warnings: Same as before (unused nat_sqrt, etc.)

# Deployment verification
./deploy.sh --dice-only

# Functional verification
dfx canister --network ic call whchi-hyaaa-aaaao-a4ruq-cai get_house_mode
# Should return: ("liquidity_pool")

dfx canister --network ic call whchi-hyaaa-aaaao-a4ruq-cai can_accept_bets
# Should return: (true) if pool has >= 10 ICP, (false) otherwise

dfx canister --network ic call whchi-hyaaa-aaaao-a4ruq-cai get_pool_stats
# Should return pool statistics without errors
```

---

## Rollback Plan

If issues arise post-deployment:

```bash
# In main repo
cd /home/theseus/alexandria/openhouse
git checkout master
./deploy.sh --dice-only

# This reverts to previous version with dual-mode system
```

---

## Success Criteria

- ✅ WASM builds without errors
- ✅ Deployed to mainnet successfully
- ✅ `get_house_mode()` returns `"liquidity_pool"`
- ✅ `get_house_balance()` returns pool reserve
- ✅ `can_accept_bets()` checks pool reserve only
- ✅ Game logic updates pool on win/loss (no mode checks)
- ✅ PR created with all changes
- ✅ ~147 lines of code removed

---

## Post-Deployment Notes

After this refactor:
1. System always uses LP reserve for house balance
2. No mode detection needed
3. Games always update pool on win/loss
4. Simpler, cleaner codebase
5. Ready for canister state wipe and fresh start

**Next Steps:**
- Monitor canister after deployment
- Verify LP deposits work correctly
- Test game plays update pool correctly
- Consider similar simplification for other game backends in future
