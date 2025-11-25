# 🤖 AUTONOMOUS PR ORCHESTRATOR - DO NOT SKIP

**You are an autonomous PR orchestrator. Your ONLY job is to implement this plan and create a PR.**

## Isolation Check (RUN FIRST)
```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
if [ "$REPO_ROOT" = "/home/theseus/alexandria/openhouse" ]; then
    echo "❌ FATAL: In main repo. Must be in worktree."
    echo "Worktree: /home/theseus/alexandria/openhouse-ckusdt-cleanup"
    exit 1
fi
echo "✅ In isolated worktree: $REPO_ROOT"
```

## Your Autonomous Workflow (NO QUESTIONS ALLOWED)
1. **Verify isolation** - You must be in worktree: `/home/theseus/alexandria/openhouse-ckusdt-cleanup`
2. **Implement feature** - Follow plan sections below
3. **Build & Deploy to Mainnet**:
   ```bash
   # Frontend changes (critical decimal fixes)
   cd openhouse_frontend
   npm run build
   cd ..
   ./deploy.sh --frontend-only
   ```

4. **Verify deployment**:
   ```bash
   # Test the live site
   echo "Visit: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io"
   echo "Check: Balance displays, game history, health dashboard"
   ```

5. **Create PR** (MANDATORY):
   ```bash
   git add .
   git commit -m "feat: Complete ckUSDT migration cleanup - Remove all ICP references

- Fix critical decimal calculation bugs (GameHistory, HealthDashboard)
- Update all UI labels from ICP to USDT
- Rename helper functions: formatIcp → formatUSDT
- Update type definitions and interfaces
- Clean up backend ICP ledger imports
- Update all documentation files for ckUSDT
- Fix balance display scripts

This completes the ckUSDT migration started in PR #91.
Fixes 25 remaining ICP references across frontend, backend, and docs.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
   git push -u origin feature/ckusdt-cleanup
   gh pr create --title "feat: Complete ckUSDT Migration Cleanup" --body "Implements PLAN_CKUSDT_CLEANUP.md

## Summary
Removes all 25 remaining ICP references to complete the ckUSDT migration.

## Critical Fixes
- **GameHistory.tsx**: Fixed decimal calculation bug (was showing 100x smaller amounts)
- **HealthDashboard.tsx**: Fixed decimal calculations for all balance displays
- **AuthButton.tsx**: Updated to show 'USDT Balance' with correct formatting

## Changes by Category
- **Frontend UI** (6 files): Fixed decimal calculations, updated labels
- **Type Definitions** (2 files): Renamed functions, updated interfaces
- **Backend Code** (4 files): Removed ICP ledger imports, updated comments
- **Documentation** (7 files): Comprehensive updates for ckUSDT
- **Scripts** (1 file): Updated balance checking for ckUSDT

## Testing
- ✅ Balance displays show correct amounts (6 decimal precision)
- ✅ All UI text shows USDT instead of ICP
- ✅ Health dashboard calculations accurate
- ✅ Documentation reflects current ckUSDT implementation

Deployed to mainnet:
- Frontend: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io

Closes ckUSDT migration (started in PR #91)"
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

**Branch:** `feature/ckusdt-cleanup`
**Worktree:** `/home/theseus/alexandria/openhouse-ckusdt-cleanup`

---

# Implementation Plan: Complete ICP to ckUSDT Migration Cleanup

## Context

Dice backend was successfully migrated to ckUSDT in PR #91. However, a comprehensive audit revealed **25 remaining ICP references** across the codebase that need to be cleaned up. These include:
- **Critical bugs**: Frontend calculations using wrong decimals (8 instead of 6)
- **UI inconsistencies**: Labels still showing "ICP" instead of "USDT"
- **Stale documentation**: 7 files reference the old ICP system
- **Dead code**: Unused ICP ledger imports in backend

## Current State: All 25 ICP References

### 🚨 CRITICAL - Frontend Decimal Bugs (Fix First)

#### 1. GameHistory.tsx - SHOWING WRONG AMOUNTS
**File**: `openhouse_frontend/src/components/game-ui/GameHistory.tsx`
**Lines**: 47, 51
**Issue**: Uses `100_000_000` (ICP 8 decimals) instead of `1_000_000` (ckUSDT 6 decimals)
**Impact**: **All bet amounts and payouts displayed 100x smaller than actual!**

**Current Code**:
```typescript
Bet: {(Number(item.bet_amount) / 100_000_000).toFixed(2)} ICP
<>✓ +{(Number(item.payout) / 100_000_000).toFixed(2)} ICP</>
```

#### 2. HealthDashboard.tsx - WRONG CALCULATIONS
**File**: `openhouse_frontend/src/components/game-specific/dice/HealthDashboard.tsx`
**Lines**: 67-68, 93, 162, 167, 181, 189, 193, 208, 216
**Issue**: `formatICP` function uses `100_000_000` divisor
**Impact**: All accounting displays show wrong amounts

**Current Code**:
```typescript
const formatICP = (e8s: bigint) => {
  return (Number(e8s) / 100_000_000).toFixed(4);
};
const isHealthy = excess < BigInt(100_000_000); // Less than 1 ICP
```

#### 3. AuthButton.tsx - WRONG LABEL
**File**: `openhouse_frontend/src/components/AuthButton.tsx`
**Lines**: 42, 47
**Issue**: Shows "ICP Balance" and uses `formatIcp()`
**Impact**: User confusion about which token they hold

**Current Code**:
```typescript
<div className="text-gray-400 text-xs">ICP Balance</div>
<span>{formatIcp(balance)} ICP</span>
```

### ⚠️ HIGH PRIORITY - Type Definitions

#### 4. ledger.ts - WRONG FUNCTION NAMES & DECIMALS
**File**: `openhouse_frontend/src/types/ledger.ts`
**Lines**: 38, 51-58
**Issue**: Functions named for ICP, using wrong decimals

**Current Code**:
```typescript
// Line 38
// ICP Ledger Service Interface (minimal, just what we need)
export interface ICPLedgerService {

// Lines 51-58
export function e8sToIcp(e8s: bigint): number {
  return Number(e8s) / 100_000_000;
}

export function formatIcp(e8s: bigint): string {
  const icp = e8sToIcp(e8s);
  return icp.toLocaleString('en-US', {
```

#### 5. useLedgerActor.ts - WRONG TYPE NAME
**File**: `openhouse_frontend/src/hooks/actors/useLedgerActor.ts`
**Line**: 2
**Issue**: Imports `ICPLedgerService` (but canister ID is already correct ckUSDT)

**Current Code**:
```typescript
import { ICPLedgerService } from '../../types/ledger';
```

#### 6. GameBalanceProvider.tsx - WRONG COMMENT & VALUE
**File**: `openhouse_frontend/src/providers/GameBalanceProvider.tsx`
**Line**: 123
**Issue**: Comment says "ICP" and value uses 8-decimal calculation

**Current Code**:
```typescript
houseBalance = BigInt(100000000000); // 1000 ICP in e8s for display
```

#### 7. DiceGame.tsx - WRONG VARIABLE NAMES
**File**: `openhouse_frontend/src/pages/dice/DiceGame.tsx`
**Lines**: 44-45
**Issue**: Interface fields named `bet_icp` and `won_icp`

**Current Code**:
```typescript
bet_icp: number;
won_icp: number;
```

### 📦 BACKEND - Dead Code & Imports

#### 8-10. dice_backend ICP Ledger Imports
**Files**:
- `dice_backend/src/lib.rs` (Line 8)
- `dice_backend/src/defi_accounting/accounting.rs` (Lines 7-10)
- `dice_backend/src/defi_accounting/liquidity_pool.rs` (Line 8)

**Issue**: Import `MAINNET_LEDGER_CANISTER_ID` and `ic_ledger_types` (ICP ledger)
**Context**: Appears in commented code or unused

**Current Code**:
```rust
// lib.rs Line 8
use ic_ledger_types::{
    MAINNET_LEDGER_CANISTER_ID, // ...
};

// accounting.rs Lines 7-10
use ic_ledger_types::{
    AccountIdentifier, TransferArgs, Tokens, DEFAULT_SUBACCOUNT,
    MAINNET_LEDGER_CANISTER_ID, Memo, AccountBalanceArgs, BlockIndex, Timestamp,
};

// liquidity_pool.rs Line 8
use ic_ledger_types::MAINNET_LEDGER_CANISTER_ID;
```

#### 11. crash_backend - Misleading Comment
**File**: `crash_backend/src/lib.rs`
**Line**: 39
**Issue**: Comment says "e8s" without clarifying decimals

**Current Code**:
```rust
pub payout: u64,                   // Payout in e8s (0 if lost)
```

### 📚 DOCUMENTATION - Stale Content

#### 12. README.md - Main Project README
**File**: `README.md`
**Lines**: 51-54
**Issue**: Economic model section references ICP

**Current Code**:
```markdown
- Deposit ICP to become a liquidity provider (LP)
- ...economic model uses ICP...
```

#### 13. BALANCE_GUIDE.md - COMPLETELY WRONG
**File**: `openhouse_frontend/BALANCE_GUIDE.md`
**Lines**: Multiple throughout
**Issue**:
- Title: "ICP Balance Management Guide"
- References wrong ledger: `ryjl3-tyaaa-aaaaa-aaaba-cai` (ICP, not ckUSDT!)
- All examples use ICP decimals and formatting
- Line 136: "Balance Unit: e8s (1 ICP = 100,000,000 e8s)"

**This file needs comprehensive rewrite**

#### 14. dice_backend CLAUDE.md
**File**: `dice_backend/src/defi_accounting/CLAUDE.md`
**Lines**: 5-8, 25, 50-53, 61-63
**Issue**: Multiple ICP references in developer guide

**Current Text**:
- "LP providers stake ICP for shares"
- "Player fund management with ICP ledger"
- "Min LP deposit: 1 ICP"
- "0.1 ICP" and "0.0001 ICP" references

#### 15. dice_backend README.md
**File**: `dice_backend/src/defi_accounting/README.md`
**Lines**: 1, 7-12, 61, 87-88, 123-146
**Issue**: Title "ICP Games" and extensive ICP references

**Current Text**:
- Title: "ICP Games - Liquidity Pool System"
- "Stake ICP, receive LP shares (min 1 ICP)"
- Multiple constant definitions mentioning "ICP"

#### 16. check_balance.sh Script
**File**: `scripts/check_balance.sh`
**Lines**: 53, 59, 64-65, 70, 72, 107, 133-134
**Issue**: All balance checks reference ICP and use wrong decimals

**Current Code**:
```bash
# Comments mention ">= 10 ICP", "< 10 ICP"
# e8s calculations based on ICP
```

#### 17. Plan Methodology File
**File**: `.claude/workflows/plan-pursuit-methodology-condensed.md`
**Line**: 262
**Issue**: Says "Min Bet: 1 ICP across all games"

#### 18. Old Plan File
**File**: `PLAN_DICE_LP_UI_REFACTOR.md`
**Line**: 71
**Issue**: "MIN_DEPOSIT: 1 ICP (100_000_000 e8s)"

## Implementation Plan

### PHASE 1: Fix Critical Frontend Bugs (Deploy Immediately)

#### File 1: `openhouse_frontend/src/types/ledger.ts`

**MODIFY (Lines 38-58)**:
```typescript
// PSEUDOCODE

// Line 38 - Update comment
// OLD: // ICP Ledger Service Interface (minimal, just what we need)
// NEW: // ckUSDT Ledger Service Interface (ICRC-1 and ICRC-2 methods)

// Rename interface
// OLD: export interface ICPLedgerService {
// NEW: export interface ckUSDTLedgerService {

// Lines 51-52 - Rename and update function
// OLD: export function e8sToIcp(e8s: bigint): number {
//        return Number(e8s) / 100_000_000;
// NEW:
export function decimalsToUSDT(decimals: bigint): number {
  return Number(decimals) / 1_000_000; // 6 decimals for ckUSDT
}

// Lines 56-58 - Rename and update function
// OLD: export function formatIcp(e8s: bigint): string {
//        const icp = e8sToIcp(e8s);
//        return icp.toLocaleString('en-US', {
// NEW:
export function formatUSDT(decimals: bigint): string {
  const usdt = decimalsToUSDT(decimals);
  return `$${usdt.toFixed(2)} USDT`;
}

// ALSO ADD: Keep old functions as deprecated aliases for backward compatibility during transition
/** @deprecated Use decimalsToUSDT instead */
export const e8sToIcp = decimalsToUSDT;
/** @deprecated Use formatUSDT instead */
export const formatIcp = formatUSDT;
```

#### File 2: `openhouse_frontend/src/hooks/actors/useLedgerActor.ts`

**MODIFY (Line 2)**:
```typescript
// PSEUDOCODE

// Update import
// OLD: import { ICPLedgerService } from '../../types/ledger';
// NEW: import { ckUSDTLedgerService } from '../../types/ledger';

// Update type usage
// OLD: const useLedgerActor = createActorHook<ICPLedgerService>({
// NEW: const useLedgerActor = createActorHook<ckUSDTLedgerService>({
```

#### File 3: `openhouse_frontend/src/components/AuthButton.tsx`

**MODIFY (Lines 4, 42, 47)**:
```typescript
// PSEUDOCODE

// Line 4 - Update import
// OLD: import { formatIcp } from '../types/ledger';
// NEW: import { formatUSDT } from '../types/ledger';

// Line 42 - Update label
// OLD: <div className="text-gray-400 text-xs">ICP Balance</div>
// NEW: <div className="text-gray-400 text-xs">USDT Balance</div>

// Line 47 - Update display
// OLD: <span>{formatIcp(balance)} ICP</span>
// NEW: <span>{formatUSDT(balance)}</span>  // formatUSDT already includes "USDT"
```

#### File 4: `openhouse_frontend/src/components/game-ui/GameHistory.tsx`

**MODIFY (Lines 47, 51)** - CRITICAL BUG FIX:
```typescript
// PSEUDOCODE

// Line 47 - Fix decimal calculation and text
// OLD: Bet: {(Number(item.bet_amount) / 100_000_000).toFixed(2)} ICP
// NEW: Bet: {(Number(item.bet_amount) / 1_000_000).toFixed(2)} USDT

// Line 51 - Fix decimal calculation and text
// OLD: <>✓ +{(Number(item.payout) / 100_000_000).toFixed(2)} ICP</>
// NEW: <>✓ +{(Number(item.payout) / 1_000_000).toFixed(2)} USDT</>
```

#### File 5: `openhouse_frontend/src/components/game-specific/dice/HealthDashboard.tsx`

**MODIFY (Lines 67-68, 93, and all display lines)** - CRITICAL BUG FIX:
```typescript
// PSEUDOCODE

// Lines 67-68 - Rename function and fix decimal
// OLD: const formatICP = (e8s: bigint) => {
//        return (Number(e8s) / 100_000_000).toFixed(4);
//      };
// NEW:
const formatUSDT = (decimals: bigint) => {
  return (Number(decimals) / 1_000_000).toFixed(4); // 6 decimals for ckUSDT
};

// Line 93 - Update threshold
// OLD: const isHealthy = excess < BigInt(100_000_000); // Less than 1 ICP
// NEW: const isHealthy = excess < BigInt(1_000_000); // Less than 1 USDT

// Line 162 - Update display
// OLD: {excessICP} ICP
// NEW: {excessUSDT} USDT

// Line 167 - Update fee comment
// OLD: <span className="text-gray-300">{orphanedFees} (@ 0.0001 ICP each)</span>
// NEW: <span className="text-gray-300">{orphanedFees} (@ 0.01 USDT each)</span>

// Lines 181, 189, 193, 208, 216 - Update all formatICP → formatUSDT
// And update all " ICP" text to " USDT"
// OLD: {formatICP(accounting.total_user_deposits)} ICP
// NEW: {formatUSDT(accounting.total_user_deposits)} USDT
// (Repeat for all 5 locations)
```

#### File 6: `openhouse_frontend/src/providers/GameBalanceProvider.tsx`

**MODIFY (Line 123)**:
```typescript
// PSEUDOCODE

// Update comment and value for 6 decimals
// OLD: houseBalance = BigInt(100000000000); // 1000 ICP in e8s for display
// NEW: houseBalance = BigInt(1_000_000_000); // 1000 USDT in ckUSDT decimals for display
// EXPLANATION: 1000 USDT * 1_000_000 decimals = 1_000_000_000
```

#### File 7: `openhouse_frontend/src/pages/dice/DiceGame.tsx`

**MODIFY (Lines 44-45)**:
```typescript
// PSEUDOCODE

// Rename fields in interface
// OLD: bet_icp: number;
//      won_icp: number;
// NEW: bet_usdt: number;
//      won_usdt: number;

// ALSO: Update any references to these fields in the file
// bet_icp → bet_usdt
// won_icp → won_usdt
```

### PHASE 2: Clean Up Backend Code

#### File 8: `dice_backend/src/lib.rs`

**MODIFY (Line 8)** or **DELETE** if in comments:
```rust
// PSEUDOCODE

// If in active code - REMOVE this import entirely:
// use ic_ledger_types::{
//     MAINNET_LEDGER_CANISTER_ID, ...
// };

// If in commented emergency withdrawal code:
// ADD comment clarifying this is deprecated ICP code
// // DEPRECATED: Old ICP emergency withdrawal (no longer used)
// // use ic_ledger_types::{...
```

#### File 9: `dice_backend/src/defi_accounting/accounting.rs`

**MODIFY (Lines 7-10)**:
```rust
// PSEUDOCODE

// These imports are only used in commented code
// REMOVE or comment out:
// use ic_ledger_types::{
//     AccountIdentifier, TransferArgs, Tokens, DEFAULT_SUBACCOUNT,
//     MAINNET_LEDGER_CANISTER_ID, Memo, AccountBalanceArgs, BlockIndex, Timestamp,
// };

// ADD comment:
// Note: This module now uses ckUSDT (ICRC-2), not ICP ledger
// ckUSDT types defined in types.rs
```

#### File 10: `dice_backend/src/defi_accounting/liquidity_pool.rs`

**MODIFY (Line 8)**:
```rust
// PSEUDOCODE

// REMOVE:
// use ic_ledger_types::MAINNET_LEDGER_CANISTER_ID;

// This import is not used anywhere in the file
```

#### File 11: `crash_backend/src/lib.rs`

**MODIFY (Line 39)**:
```rust
// PSEUDOCODE

// Update comment to clarify decimals
// OLD: pub payout: u64,  // Payout in e8s (0 if lost)
// NEW: pub payout: u64,  // Payout in ckUSDT decimals - 6 decimals (0 if lost)
```

### PHASE 3: Update Documentation

#### File 12: `README.md`

**MODIFY (Lines 51-54)**:
```markdown
<!-- PSEUDOCODE -->

<!-- OLD: -->
<!-- - Deposit ICP to become a liquidity provider (LP) -->
<!-- - Economic model uses ICP for bets and payouts -->

<!-- NEW: -->
- Deposit ckUSDT (stablecoin pegged to $1) to become a liquidity provider (LP)
- Economic model uses ckUSDT for bets and payouts
- 1 ckUSDT = $1 USD (6 decimal precision)
- Stable value ensures predictable casino economics
```

#### File 13: `openhouse_frontend/BALANCE_GUIDE.md`

**MAJOR REWRITE** required - This entire file references ICP:
```markdown
<!-- PSEUDOCODE for changes -->

<!-- Line 1 - Update title -->
<!-- OLD: # ICP Balance Management Guide -->
<!-- NEW: # ckUSDT Balance Management Guide -->

<!-- Line 5 - Update description -->
<!-- OLD: centralized ICP balance management system -->
<!-- NEW: centralized ckUSDT balance management system -->

<!-- Lines 11-12 - CRITICAL: Wrong ledger canister -->
<!-- OLD: Connects to the ICP Ledger canister (`ryjl3-tyaaa-aaaaa-aaaba-cai`) -->
<!-- NEW: Connects to the ckUSDT Ledger canister (`cngnf-vqaaa-aaaar-qag4q-cai`) -->

<!-- Line 136 - Update decimal info -->
<!-- OLD: Balance Unit: e8s (1 ICP = 100,000,000 e8s) -->
<!-- NEW: Balance Unit: ckUSDT decimals (1 ckUSDT = 1,000,000 decimals - 6 decimal places) -->

<!-- Line 257 - Update calculation example -->
<!-- OLD: BigInt(betAmount * 100_000_000) -->
<!-- NEW: BigInt(betAmount * 1_000_000) -->

<!-- Throughout file: -->
<!-- Replace all "ICP" → "ckUSDT" or "USDT" -->
<!-- Replace all "formatIcp" → "formatUSDT" -->
<!-- Replace all "e8sToIcp" → "decimalsToUSDT" -->
<!-- Update all code examples to use 6 decimals -->
```

#### File 14: `dice_backend/src/defi_accounting/CLAUDE.md`

**MODIFY multiple sections**:
```markdown
<!-- PSEUDOCODE -->

<!-- Line 5 - Update purpose -->
<!-- OLD: Self-contained, auditable accounting module for ICP-based games -->
<!-- NEW: Self-contained, auditable accounting module for ckUSDT-based games -->

<!-- Lines 7-8 - Update feature list -->
<!-- OLD: LP providers stake ICP for shares -->
<!-- OLD: Player fund management with ICP ledger -->
<!-- NEW: LP providers stake ckUSDT for shares -->
<!-- NEW: Player fund management with ckUSDT ledger (ICRC-2) -->

<!-- Line 61 - Update constant -->
<!-- OLD: Min LP deposit: 1 ICP (prevents attacks) -->
<!-- NEW: Min LP deposit: 1 ckUSDT (prevents attacks) -->

<!-- Lines 62-63 - Update constants -->
<!-- OLD: Min user deposit/withdraw: 0.1 ICP -->
<!-- OLD: Transfer fee: 0.0001 ICP -->
<!-- NEW: Min user deposit: 10 ckUSDT (prevents dust) -->
<!-- NEW: Min withdraw: 1 ckUSDT -->
<!-- NEW: Transfer fee: 0.01 ckUSDT (10_000 decimals) -->
```

#### File 15: `dice_backend/src/defi_accounting/README.md`

**MODIFY title and extensive content**:
```markdown
<!-- PSEUDOCODE -->

<!-- Line 1 - Update title -->
<!-- OLD: # ICP Games - Liquidity Pool System -->
<!-- NEW: # ckUSDT Games - Liquidity Pool System -->

<!-- Lines 7-12 - Update description -->
<!-- Replace all "ICP" with "ckUSDT" -->

<!-- Line 61 - Update example -->
<!-- OLD: Deposit ICP to receive LP shares (minimum 1 ICP) -->
<!-- NEW: Deposit ckUSDT to receive LP shares (minimum 1 ckUSDT) -->

<!-- Lines 87-88 - Update examples -->
<!-- OLD: Stake ICP, receive LP shares (min 1 ICP) -->
<!-- NEW: Stake ckUSDT, receive LP shares (min 1 ckUSDT) -->

<!-- Lines 123-146 - Update all constant definitions -->
<!-- Replace all ICP amounts with ckUSDT equivalents -->
<!-- Update decimal calculations (8 decimals → 6 decimals) -->
```

#### File 16: `scripts/check_balance.sh`

**MODIFY balance checks and calculations**:
```bash
# PSEUDOCODE

# Lines 53, 59 - Update comments
# OLD: # Check if balance >= 10 ICP
# NEW: # Check if balance >= 10 USDT

# Lines 64-65, 70, 72 - Update calculations
# OLD: Uses e8s calculations for ICP (divide by 100_000_000)
# NEW: Use ckUSDT decimals (divide by 1_000_000)

# Line 107 - Update threshold comments
# OLD: # Threshold: 10 ICP
# NEW: # Threshold: 10 USDT

# Lines 133-134 - Update deposit tier comments
# OLD: # Small: 1-5 ICP, Large: >5 ICP
# NEW: # Small: 1-5 USDT, Large: >5 USDT

# Throughout: Replace all "ICP" text with "USDT" in output messages
```

#### File 17: `.claude/workflows/plan-pursuit-methodology-condensed.md`

**MODIFY (Line 262)**:
```markdown
<!-- PSEUDOCODE -->

<!-- OLD: - **Min Bet**: 1 ICP across all games -->
<!-- NEW: - **Min Bet**: Varies by game (Dice: 0.01 USDT, others TBD) -->
```

#### File 18: `PLAN_DICE_LP_UI_REFACTOR.md`

**MODIFY (Line 71)**:
```markdown
<!-- PSEUDOCODE -->

<!-- OLD: MIN_DEPOSIT: 1 ICP (100_000_000 e8s) -->
<!-- NEW: MIN_DEPOSIT: 10 ckUSDT (10_000_000 decimals) -->
```

## Testing Checklist

### Post-Deployment Manual Tests (CRITICAL)

Visit https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io

1. **AuthButton** (top right):
   - [ ] Shows "USDT Balance" (not "ICP Balance")
   - [ ] Balance displays with $ and correct decimals

2. **Dice Game - Play a bet**:
   - [ ] Note the bet amount
   - [ ] Check GameHistory sidebar
   - [ ] Verify bet amount shows correctly (NOT 100x smaller!)
   - [ ] If you win, verify payout shows correctly

3. **Dice Game - Health Dashboard**:
   - [ ] Navigate to Health Dashboard
   - [ ] Verify all balances show "USDT" (not "ICP")
   - [ ] Check that balance numbers look reasonable
   - [ ] Verify orphaned fees show "@ 0.01 USDT each"

4. **Browser Console**:
   - [ ] No errors related to undefined formatIcp
   - [ ] No errors related to ICPLedgerService

### Build Verification

```bash
# Before deploying, verify builds succeed:
cd openhouse_frontend
npm run build

# Check for any TypeScript errors
# Should compile without errors
```

## Deployment Strategy

**Affected Canisters:**
- Frontend only: `pezw3-laaaa-aaaal-qssoa-cai`
- No backend canisters need redeployment (changes are docs/comments only)

**Deployment Commands:**
```bash
cd openhouse_frontend
npm run build
cd ..
./deploy.sh --frontend-only
```

**Rollback Plan:**
If critical issues found after deployment:
```bash
# Frontend rollback via git
git revert <commit-hash>
cd openhouse_frontend && npm run build
./deploy.sh --frontend-only
```

## Success Criteria

- ✅ No "ICP" text visible in UI
- ✅ All balances calculated with 6 decimals (ckUSDT)
- ✅ Game history shows correct bet/payout amounts
- ✅ Health dashboard displays accurate balances
- ✅ AuthButton shows "USDT Balance"
- ✅ All documentation updated
- ✅ No ICP ledger imports in active code
- ✅ Frontend builds without errors
- ✅ Deployment succeeds
- ✅ Manual tests pass

## Impact Summary

### User-Facing Changes
- **GameHistory**: Bet amounts now display correctly (was 100x too small)
- **HealthDashboard**: All accounting displays now accurate
- **AuthButton**: Clearer labeling ("USDT Balance" not "ICP")
- **Terminology**: Consistent use of "USDT" throughout UI

### Developer-Facing Changes
- **Type definitions**: `ICPLedgerService` → `ckUSDTLedgerService`
- **Helper functions**: `formatIcp()` → `formatUSDT()`
- **Documentation**: All guides updated for ckUSDT
- **Backend**: Removed dead ICP ledger imports

### Breaking Changes
- Functions renamed but **old names aliased** for backward compatibility
- No API changes (all internal)

## References

- Original Migration PR: #91
- ckUSDT Canister: `cngnf-vqaaa-aaaar-qag4q-cai`
- ckUSDT Decimals: 6 (1 USDT = 1,000,000 decimals)
- ckUSDT Transfer Fee: 10,000 decimals (0.01 USDT)
- ICP Ledger (deprecated): `ryjl3-tyaaa-aaaaa-aaaba-cai`
