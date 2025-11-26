# 🤖 AUTONOMOUS PR ORCHESTRATOR - DO NOT SKIP

**You are an autonomous PR orchestrator. Your ONLY job is to implement this plan and create a PR.**

## Isolation Check (RUN FIRST)
```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
if [ "$REPO_ROOT" = "/home/theseus/alexandria/openhouse" ]; then
    echo "❌ FATAL: In main repo. Must be in worktree."
    echo "Worktree: /home/theseus/alexandria/openhouse-deposit-fix"
    exit 1
fi
echo "✅ In isolated worktree: $REPO_ROOT"
```

## Your Autonomous Workflow (NO QUESTIONS ALLOWED)
1. **Verify isolation** - You must be in worktree: `/home/theseus/alexandria/openhouse-deposit-fix`
2. **Implement feature** - Follow plan sections below
3. **Build & Deploy to Mainnet**:
   - Backend changes:
     ```bash
     # Build dice backend
     cargo build --target wasm32-unknown-unknown --release

     # Deploy to mainnet (deploys all canisters - simplest approach)
     ./deploy.sh
     ```
   - Frontend changes:
     ```bash
     cd openhouse_frontend
     npm run build
     cd ..
     ./deploy.sh
     ```
   - Both backend + frontend:
     ```bash
     cargo build --target wasm32-unknown-unknown --release
     cd openhouse_frontend && npm run build && cd ..
     ./deploy.sh
     ```

4. **Verify deployment**:
   ```bash
   # Check canister status
   dfx canister --network ic status whchi-hyaaa-aaaao-a4ruq-cai

   # Test the live site
   echo "Visit: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io/dice"
   ```

5. **Create PR** (MANDATORY):
   ```bash
   git add .
   git commit -m "fix: Swap user and LP deposit minimums (1 USDT for users, 10 USDT for LPs)"
   git push -u origin feature/fix-deposit-minimums
   gh pr create --title "fix: Correct deposit minimums - 1 USDT for users, 10 USDT for LPs" --body "Implements PLAN_fix_deposit_minimums.md

## Problem
The deposit minimums were accidentally reversed:
- User deposits required 10 USDT (should be 1 USDT)
- LP deposits required 1 USDT (should be 10 USDT)

## Solution
Swapped the constants to correct values:
- **User Deposit Min: 1 USDT** (lower barrier for players)
- **LP Deposit Min: 10 USDT** (higher barrier for liquidity providers)

## Changes
### Backend
- \`dice_backend/src/defi_accounting/accounting.rs\` - User MIN_DEPOSIT: 10M → 1M
- \`dice_backend/src/defi_accounting/liquidity_pool.rs\` - LP MIN_DEPOSIT: 1M → 10M
- \`dice_backend/src/defi_accounting/tests/stress_tests/model.rs\` - Test constants swapped
- \`dice_backend/dice_backend.did\` - Updated documentation comment

### Frontend
- \`openhouse_frontend/src/pages/dice/DiceGame.tsx\` - Validation and error messages
- \`openhouse_frontend/src/pages/dice/DiceLiquidity.tsx\` - LP info text
- \`openhouse_frontend/src/components/game-specific/dice/DiceAccountingPanel.tsx\` - User deposit validation
- \`openhouse_frontend/src/components/game-specific/dice/DiceLiquidityPanel.tsx\` - LP deposit validation and comments

Deployed to mainnet:
- Frontend: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io
- Affected canister: whchi-hyaaa-aaaao-a4ruq-cai (Dice Backend)"
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

**Branch:** `feature/fix-deposit-minimums`
**Worktree:** `/home/theseus/alexandria/openhouse-deposit-fix`

---

# Implementation Plan: Fix Deposit Minimums

## Task Classification
**BUG FIX** - Restore correct behavior (constants were accidentally reversed)

## Problem Statement
The deposit minimums for users and liquidity providers were accidentally swapped:
- **Current (WRONG):**
  - User Deposit Min: 10 USDT
  - LP Deposit Min: 1 USDT

- **Should be:**
  - User Deposit Min: 1 USDT (lower barrier to entry for players)
  - LP Deposit Min: 10 USDT (higher barrier for liquidity providers)

## Current State Documentation

### Backend Constants

#### File: `dice_backend/src/defi_accounting/accounting.rs`
```rust
Line 15:
const MIN_DEPOSIT: u64 = 10_000_000; // 10 USDT

Used in:
Line 134-135:
    if amount < MIN_DEPOSIT {
        return Err(format!("Minimum deposit is {} USDT", MIN_DEPOSIT / 1_000_000));
    }
```

#### File: `dice_backend/src/defi_accounting/liquidity_pool.rs`
```rust
Line 14:
const MIN_DEPOSIT: u64 = 1_000_000; // 1 USDT minimum for LP (lower than regular deposits to encourage liquidity)

Used in:
Line 160-161:
    if amount < MIN_DEPOSIT {
        return Err(format!("Minimum deposit is {} e8s", MIN_DEPOSIT));
    }
```

#### File: `dice_backend/src/defi_accounting/tests/stress_tests/model.rs`
```rust
Lines 5-6:
const MIN_USER_DEPOSIT: u64 = 10_000_000; // 10 USDT (accounting.rs)
const MIN_LP_DEPOSIT: u64 = 1_000_000;    // 1 USDT (liquidity_pool.rs)

Used in:
Line 99: if amount < MIN_USER_DEPOSIT
Line 180: if amount < MIN_LP_DEPOSIT
```

#### File: `dice_backend/dice_backend.did`
```candid
Line 79:
//   amount: Amount to deposit in e8s (min 1 USDT)
```

### Frontend Constants

#### File: `openhouse_frontend/src/pages/dice/DiceGame.tsx`
```typescript
Line 159:
      if (amount < BigInt(10_000_000)) {
Line 160:
        setAccountingError('Minimum deposit is 10 USDT');
```

#### File: `openhouse_frontend/src/pages/dice/DiceLiquidity.tsx`
```typescript
Line 10:
• Minimum deposit: 1 USDT
```

#### File: `openhouse_frontend/src/components/game-specific/dice/DiceAccountingPanel.tsx`
```typescript
Line 52:
      if (amount < BigInt(10_000_000)) {
Line 53:
        setError('Minimum deposit is 10 USDT');
```

#### File: `openhouse_frontend/src/components/game-specific/dice/DiceLiquidityPanel.tsx`
```typescript
Line 73-75:
      // Validate (Min 10 USDT)
      if (amount < BigInt(10_000_000)) {
        setError('Minimum deposit is 10 USDT');
```

### Test Generators

#### File: `dice_backend/src/defi_accounting/tests/stress_tests/generators.rs`
```rust
Line 12:
        (10_000_000..100_000_000u64),      // 10 - 100 USDT (Valid User Deposits)
```

## Implementation Plan

### Backend Changes

#### 1. Fix User Deposit Minimum: `dice_backend/src/defi_accounting/accounting.rs`
```rust
// PSEUDOCODE - Line 15
// BEFORE:
const MIN_DEPOSIT: u64 = 10_000_000; // 10 USDT

// AFTER:
const MIN_DEPOSIT: u64 = 1_000_000; // 1 USDT minimum for user deposits

// Error message at line 135 automatically updates via:
// format!("Minimum deposit is {} USDT", MIN_DEPOSIT / 1_000_000)
// Will now show "Minimum deposit is 1 USDT"
```

#### 2. Fix LP Deposit Minimum: `dice_backend/src/defi_accounting/liquidity_pool.rs`
```rust
// PSEUDOCODE - Line 14
// BEFORE:
const MIN_DEPOSIT: u64 = 1_000_000; // 1 USDT minimum for LP (lower than regular deposits to encourage liquidity)

// AFTER:
const MIN_DEPOSIT: u64 = 10_000_000; // 10 USDT minimum for LP (higher barrier than user deposits)

// Error message at line 161 needs update:
// BEFORE:
return Err(format!("Minimum deposit is {} e8s", MIN_DEPOSIT));

// AFTER:
return Err(format!("Minimum LP deposit is {} USDT", MIN_DEPOSIT / 1_000_000));
```

#### 3. Fix Test Constants: `dice_backend/src/defi_accounting/tests/stress_tests/model.rs`
```rust
// PSEUDOCODE - Lines 5-6
// BEFORE:
const MIN_USER_DEPOSIT: u64 = 10_000_000; // 10 USDT (accounting.rs)
const MIN_LP_DEPOSIT: u64 = 1_000_000;    // 1 USDT (liquidity_pool.rs)

// AFTER:
const MIN_USER_DEPOSIT: u64 = 1_000_000;   // 1 USDT (accounting.rs)
const MIN_LP_DEPOSIT: u64 = 10_000_000;    // 10 USDT (liquidity_pool.rs)
```

#### 4. Update Documentation: `dice_backend/dice_backend.did`
```candid
// PSEUDOCODE - Line 79
// BEFORE:
//   amount: Amount to deposit in e8s (min 1 USDT)

// AFTER:
//   amount: Amount to deposit in e8s (min 10 USDT for LP deposits)
```

#### 5. Update Test Generators Comment: `dice_backend/src/defi_accounting/tests/stress_tests/generators.rs`
```rust
// PSEUDOCODE - Line 12
// BEFORE:
        (10_000_000..100_000_000u64),      // 10 - 100 USDT (Valid User Deposits)

// AFTER:
        (1_000_000..100_000_000u64),       // 1 - 100 USDT (Valid User Deposits)
// Note: Keep range start at 10_000_000 for test stability, just update comment for clarity
// OR actually change to 1_000_000 to match new minimum
```

### Frontend Changes

#### 6. Fix User Deposit Validation: `openhouse_frontend/src/pages/dice/DiceGame.tsx`
```typescript
// PSEUDOCODE - Lines 158-161
// BEFORE:
      // Min deposit 10 USDT for game balance
      if (amount < BigInt(10_000_000)) {
        setAccountingError('Minimum deposit is 10 USDT');

// AFTER:
      // Min deposit 1 USDT for game balance
      if (amount < BigInt(1_000_000)) {
        setAccountingError('Minimum deposit is 1 USDT');
```

Also update default deposit amount:
```typescript
// PSEUDOCODE - Line 99
// BEFORE:
  const [depositAmount, setDepositAmount] = useState('10');

// AFTER:
  const [depositAmount, setDepositAmount] = useState('1');
```

And reset value:
```typescript
// PSEUDOCODE - Line 200
// BEFORE:
        setDepositAmount('10');

// AFTER:
        setDepositAmount('1');
```

#### 7. Fix LP Info Text: `openhouse_frontend/src/pages/dice/DiceLiquidity.tsx`
```typescript
// PSEUDOCODE - Line 10
// BEFORE:
• Minimum deposit: 1 USDT

// AFTER:
• Minimum deposit: 10 USDT
```

#### 8. Fix User Deposit Panel: `openhouse_frontend/src/components/game-specific/dice/DiceAccountingPanel.tsx`
```typescript
// PSEUDOCODE - Lines 51-55
// BEFORE:
      // Validate amount (Min 10 USDT)
      if (amount < BigInt(10_000_000)) {
        setError('Minimum deposit is 10 USDT');

// AFTER:
      // Validate amount (Min 1 USDT)
      if (amount < BigInt(1_000_000)) {
        setError('Minimum deposit is 1 USDT');
```

Also update default:
```typescript
// Search for setState for depositAmount and change from '10' to '1'
```

#### 9. Clarify LP Deposit Panel: `openhouse_frontend/src/components/game-specific/dice/DiceLiquidityPanel.tsx`
```typescript
// PSEUDOCODE - Lines 73-76
// BEFORE:
      // Validate (Min 10 USDT)
      if (amount < BigInt(10_000_000)) {
        setError('Minimum deposit is 10 USDT');

// AFTER:
      // Validate (Min 10 USDT for LP deposits)
      if (amount < BigInt(10_000_000)) {
        setError('Minimum LP deposit is 10 USDT');
```

Keep default at '10' (already correct for LP):
```typescript
// Line 114 - Keep as is:
        setDepositAmount('10');
```

## Files Affected

### Backend (4 files)
1. `dice_backend/src/defi_accounting/accounting.rs` - User deposit constant
2. `dice_backend/src/defi_accounting/liquidity_pool.rs` - LP deposit constant + error message
3. `dice_backend/src/defi_accounting/tests/stress_tests/model.rs` - Test constants
4. `dice_backend/dice_backend.did` - Documentation comment

### Frontend (4 files)
5. `openhouse_frontend/src/pages/dice/DiceGame.tsx` - User deposit validation + default values
6. `openhouse_frontend/src/pages/dice/DiceLiquidity.tsx` - LP info text
7. `openhouse_frontend/src/components/game-specific/dice/DiceAccountingPanel.tsx` - User deposit validation + defaults
8. `openhouse_frontend/src/components/game-specific/dice/DiceLiquidityPanel.tsx` - LP deposit comment clarification

### Optional (1 file)
9. `dice_backend/src/defi_accounting/tests/stress_tests/generators.rs` - Update test range (optional, for consistency)

## Testing Requirements

**Manual verification on mainnet:**

1. **User Deposits (should accept 1 USDT, reject < 1 USDT):**
   ```bash
   # Visit https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io/dice
   # Try depositing 0.5 USDT - should show error "Minimum deposit is 1 USDT"
   # Try depositing 1 USDT - should succeed
   ```

2. **LP Deposits (should accept 10 USDT, reject < 10 USDT):**
   ```bash
   # Visit LP section at https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io/dice-liquidity
   # Try depositing 5 USDT - should show error "Minimum LP deposit is 10 USDT"
   # Try depositing 10 USDT - should succeed
   ```

3. **Backend validation:**
   ```bash
   # Test user deposit with 0.5 USDT (500_000 e8s) - should fail
   dfx canister --network ic call whchi-hyaaa-aaaao-a4ruq-cai deposit '(500_000: nat64)'

   # Test user deposit with 1 USDT (1_000_000 e8s) - should succeed
   dfx canister --network ic call whchi-hyaaa-aaaao-a4ruq-cai deposit '(1_000_000: nat64)'

   # Test LP deposit with 5 USDT (5_000_000 e8s) - should fail
   dfx canister --network ic call whchi-hyaaa-aaaao-a4ruq-cai deposit_liquidity '(5_000_000: nat64, null)'

   # Test LP deposit with 10 USDT (10_000_000 e8s) - should succeed
   dfx canister --network ic call whchi-hyaaa-aaaao-a4ruq-cai deposit_liquidity '(10_000_000: nat64, null)'
   ```

## Deployment Notes

### Affected Canisters
- **Dice Backend:** `whchi-hyaaa-aaaao-a4ruq-cai`
- **Frontend:** `pezw3-laaaa-aaaal-qssoa-cai`

### Deployment Strategy
```bash
# 1. Build backend
cargo build --target wasm32-unknown-unknown --release

# 2. Build frontend
cd openhouse_frontend
npm run build
cd ..

# 3. Deploy everything
./deploy.sh

# This will upgrade both the dice backend and frontend canisters
# The changes take effect immediately on mainnet
```

### Rollback Plan
If issues arise, revert the constants by swapping them back:
- User: 1M → 10M
- LP: 10M → 1M

Then redeploy immediately.

## Summary

This is a straightforward bug fix that corrects the accidentally reversed deposit minimums:
- **8 files** need changes (4 backend, 4 frontend)
- **Minimal changes** - just constant values and error messages
- **No architectural changes** - purely correcting incorrect values
- **Low risk** - only affects deposit validation, no game logic changes
- **Immediate impact** - users can start playing with 1 USDT instead of 10 USDT

The fix makes the casino more accessible to users (lower entry barrier) while maintaining a higher standard for liquidity providers (more serious commitment).
