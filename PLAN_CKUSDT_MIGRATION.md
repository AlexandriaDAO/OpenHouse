# 🤖 AUTONOMOUS PR ORCHESTRATOR - DO NOT SKIP

**You are an autonomous PR orchestrator. Your ONLY job is to implement this plan and create a PR.**

## Isolation Check (RUN FIRST)
```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
if [ "$REPO_ROOT" = "/home/theseus/alexandria/openhouse" ]; then
    echo "❌ FATAL: In main repo. Must be in worktree."
    echo "Worktree: /home/theseus/alexandria/openhouse-ckusdt-migration"
    exit 1
fi
echo "✅ In isolated worktree: $REPO_ROOT"
```

## Your Autonomous Workflow (NO QUESTIONS ALLOWED)
1. **Verify isolation** - You must be in worktree: `/home/theseus/alexandria/openhouse-ckusdt-migration`
2. **Implement feature** - Follow plan sections below
3. **Build & Deploy to Mainnet**:
   ```bash
   # Frontend changes only (no backend changes needed)
   cd openhouse_frontend
   npm run build
   cd ..
   ./deploy.sh --frontend-only
   ```

4. **Verify deployment**:
   ```bash
   # Test the live site
   echo "Visit: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io"
   ```

5. **Create PR** (MANDATORY):
   ```bash
   git add .
   git commit -m "feat: Complete ICP to ckUSDT migration across all UI components

- Replace all ICP references with USDT/ckUSDT in frontend
- Update balance formatting from 8 decimals (e8s) to 6 decimals (ckUSDT)
- Update AuthButton, GameLayout, GameHistory components
- Update type definitions and helper functions
- Update error messages and validation text
- Update Plinko game UI references
- Update HealthDashboard accounting displays

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
   git push -u origin feature/ckusdt-migration
   gh pr create --title "feat: Complete ICP to ckUSDT Migration" --body "Implements PLAN_CKUSDT_MIGRATION.md

## Summary
- Replaces all remaining ICP references with USDT/ckUSDT in frontend
- Updates decimal formatting from 8 decimals (ICP e8s) to 6 decimals (ckUSDT)
- Ensures consistent currency display across all games and components
- Dice backend already migrated in PR #91 - this completes the UI migration

## Changes
- Updated 13 frontend files with ICP references
- Changed balance formatting helpers (e8sToIcp → decimalsToUSDT)
- Updated error messages, validation text, and UI labels
- Fixed hardcoded decimal divisors (100_000_000 → 1_000_000)

Deployed to mainnet:
- Frontend: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io"
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

**Branch:** `feature/ckusdt-migration`
**Worktree:** `/home/theseus/alexandria/openhouse-ckusdt-migration`

---

# Implementation Plan: Complete ICP to ckUSDT Migration

## Context

Dice backend was recently converted from ICP to ckUSDT (PR #91). However, the frontend and several type definitions still reference ICP throughout. This plan completes the migration by replacing ALL ICP references with ckUSDT/USDT across the entire application.

### Why ckUSDT?
- **Stable value**: 1 USDT = $1 (vs ICP volatility)
- **Better UX**: Players understand dollar amounts
- **Transparent odds**: Casino payouts in stable currency
- **Already implemented**: Dice backend fully operational on ckUSDT

### Current State Summary

**Backend Status:**
- ✅ `dice_backend`: Fully migrated to ckUSDT (6 decimals)
- ❌ `crash_backend`: Stateless (no accounting system yet)
- ❌ `plinko_backend`: Stateless (no accounting system yet)
- ❌ `mines_backend`: Actually "PlinkoV2Motoko" - stateless

**Frontend Status:**
- ⚠️ 13 files still reference "ICP"
- ⚠️ Multiple formatters use 8 decimals (e8s) instead of 6 (ckUSDT)
- ⚠️ Comments and type definitions mention "e8s" and "ICP"
- ✅ `useLedgerActor` already points to ckUSDT canister
- ✅ `types/balance.ts` has DECIMALS_PER_CKUSDT constant

## Files Requiring Changes

### 1. Type Definitions & Constants

#### `openhouse_frontend/src/types/ledger.ts`
**Current State (lines 50-58):**
```typescript
// Helper to convert e8s to ICP
export function e8sToIcp(e8s: bigint): number {
  return Number(e8s) / 100_000_000;
}

// Helper to format ICP balance
export function formatIcp(e8s: bigint): string {
  const icp = e8sToIcp(e8s);
  return icp.toLocaleString('en-US', {
```

**Required Changes:**
```typescript
// PSEUDOCODE - Update helper functions
// Rename: e8sToIcp() → decimalsToUSDT()
// Update divisor: 100_000_000 → 1_000_000 (6 decimals for ckUSDT)
// Rename: formatIcp() → formatUSDT()
// Update return format: "$X.XX USDT" instead of "X.XX ICP"

export function decimalsToUSDT(decimals: bigint): number {
  return Number(decimals) / 1_000_000; // 6 decimals
}

export function formatUSDT(decimals: bigint): string {
  const usdt = decimalsToUSDT(decimals);
  return `$${usdt.toFixed(2)} USDT`;
}
```

#### `openhouse_frontend/src/types/dice-backend.ts`
**Current State (lines 10-66):**
```typescript
  /** Total ICP deposited by all users (in e8s) */
  total_user_deposits: bigint;

  /** House/pool balance (in e8s) */
  house_balance: bigint;

  /** Actual canister balance (in e8s) */
  canister_balance: bigint;

  // ... many more "e8s" comments
```

**Required Changes:**
```typescript
// PSEUDOCODE - Update ALL comments
// Replace "(in e8s)" with "(in ckUSDT decimals - 6 decimals)"
// Replace "ICP" with "USDT"

/** Total USDT deposited by all users (in ckUSDT decimals - 6 decimals) */
total_user_deposits: bigint;

/** House/pool balance (in ckUSDT decimals - 6 decimals) */
house_balance: bigint;

/** Actual canister balance (in ckUSDT decimals - 6 decimals) */
canister_balance: bigint;
```

#### `openhouse_frontend/src/utils/ledgerIdl.ts`
**Current State (line 1, 9):**
```typescript
// Minimal ICP Ledger IDL Factory (ICRC-1 and ICRC-2 methods)
// ...
    e8s: IDL.Nat64,
```

**Required Changes:**
```typescript
// PSEUDOCODE
// Update comment: "ICP Ledger" → "ckUSDT Ledger"
// Keep e8s field name (it's from ICRC standard interface)
// Add comment explaining it's actually 6 decimals for ckUSDT

// ckUSDT Ledger IDL Factory (ICRC-1 and ICRC-2 methods)
// Note: e8s field name is from ICRC standard, but ckUSDT uses 6 decimals
```

### 2. UI Components

#### `openhouse_frontend/src/components/AuthButton.tsx` (lines 42, 47)
**Current State:**
```typescript
<div className="text-gray-400 text-xs">ICP Balance</div>
// ...
<span>{formatIcp(balance)} ICP</span>
```

**Required Changes:**
```typescript
// PSEUDOCODE
// Replace "ICP Balance" with "USDT Balance"
// Replace formatIcp() with formatUSDT()
// Remove redundant "ICP" text (already in formatUSDT output)

<div className="text-gray-400 text-xs">USDT Balance</div>
<span>{formatUSDT(balance)}</span>
```

#### `openhouse_frontend/src/components/game-ui/GameLayout.tsx` (line 36)
**Current State:**
```typescript
Min: {minBet} ICP • Max Win: {maxWin}{title === 'Dice' ? ' ICP' : 'x'} • House Edge: {houseEdge}%
```

**Required Changes:**
```typescript
// PSEUDOCODE
// Replace "ICP" with "USDT"

Min: {minBet} USDT • Max Win: {maxWin}{title === 'Dice' ? ' USDT' : 'x'} • House Edge: {houseEdge}%
```

#### `openhouse_frontend/src/components/game-ui/GameHistory.tsx` (lines 47, 51)
**Current State:**
```typescript
Bet: {(Number(item.bet_amount) / 100_000_000).toFixed(2)} ICP
// ...
<>✓ +{(Number(item.payout) / 100_000_000).toFixed(2)} ICP</>
```

**Required Changes:**
```typescript
// PSEUDOCODE
// Update divisor: 100_000_000 → 1_000_000
// Replace "ICP" with "USDT"

Bet: {(Number(item.bet_amount) / 1_000_000).toFixed(2)} USDT

<>✓ +{(Number(item.payout) / 1_000_000).toFixed(2)} USDT</>
```

#### `openhouse_frontend/src/components/game-specific/dice/HealthDashboard.tsx`
**Current State (lines 67-68, 93, 162, 167, 181, 189, 193, 208, 216):**
```typescript
const formatICP = (e8s: bigint) => {
  return (Number(e8s) / 100_000_000).toFixed(4);
};

const isHealthy = excess < BigInt(100_000_000); // Less than 1 ICP

// ... multiple uses of "ICP" text and formatICP function
```

**Required Changes:**
```typescript
// PSEUDOCODE
// Rename formatICP → formatUSDT
// Update divisor: 100_000_000 → 1_000_000
// Update threshold: BigInt(100_000_000) → BigInt(1_000_000) (1 USDT)
// Replace all "ICP" text with "USDT"
// Update fee comment: "0.0001 ICP" → "0.01 USDT"

const formatUSDT = (decimals: bigint) => {
  return (Number(decimals) / 1_000_000).toFixed(4);
};

const isHealthy = excess < BigInt(1_000_000); // Less than 1 USDT

// All display strings
{excessUSDT} USDT
{orphanedFees} (@ 0.01 USDT each)
{formatUSDT(accounting.total_user_deposits)} USDT
{formatUSDT(accounting.house_balance)} USDT
{formatUSDT(accounting.canister_balance)} USDT
{formatUSDT(poolStats.pool_reserve)} USDT
{formatUSDT(poolStats.share_price)} USDT
```

### 3. Game Pages

#### `openhouse_frontend/src/pages/Plinko.tsx` (lines 187-188, 305)
**Current State:**
```typescript
Total Bet: {(0.1 * ballCount).toFixed(1)} ICP
<span className="text-pure-white/40 ml-2">(0.1 ICP per ball)</span>
// ...
Total Win: {(0.1 * currentMultiResult.ball_count * currentMultiResult.total_multiplier).toFixed(2)} ICP
```

**Required Changes:**
```typescript
// PSEUDOCODE
// Replace "ICP" with "USDT"

Total Bet: {(0.1 * ballCount).toFixed(1)} USDT
<span className="text-pure-white/40 ml-2">(0.1 USDT per ball)</span>

Total Win: {(0.1 * currentMultiResult.ball_count * currentMultiResult.total_multiplier).toFixed(2)} USDT
```

#### `openhouse_frontend/src/pages/PlinkoMotoko.tsx` (lines 200-201, 334)
**Current State:**
```typescript
Total Bet: {(0.1 * ballCount).toFixed(1)} ICP
<span className="text-pure-white/40 ml-2">(0.1 ICP per ball)</span>
// ...
Total Win: {(0.1 * currentMultiResult.ball_count * currentMultiResult.total_multiplier).toFixed(2)} ICP
```

**Required Changes:**
```typescript
// PSEUDOCODE
// Same as Plinko.tsx - replace "ICP" with "USDT"

Total Bet: {(0.1 * ballCount).toFixed(1)} USDT
<span className="text-pure-white/40 ml-2">(0.1 USDT per ball)</span>

Total Win: {(0.1 * currentMultiResult.ball_count * currentMultiResult.total_multiplier).toFixed(2)} USDT
```

#### `openhouse_frontend/src/pages/dice/DiceGame.tsx` (lines 44-45)
**Current State:**
```typescript
bet_icp: number;
won_icp: number;
```

**Required Changes:**
```typescript
// PSEUDOCODE
// Rename fields: bet_icp → bet_usdt, won_icp → won_usdt

bet_usdt: number;
won_usdt: number;
```

### 4. Hooks & Utilities

#### `openhouse_frontend/src/hooks/games/useBetValidation.ts` (lines 32, 37)
**Current State:**
```typescript
setError(`Minimum bet is ${minBet} ICP`);
// ...
setError(`Maximum bet is ${maxBet} ICP`);
```

**Required Changes:**
```typescript
// PSEUDOCODE
// Replace "ICP" with "USDT"

setError(`Minimum bet is ${minBet} USDT`);
setError(`Maximum bet is ${maxBet} USDT`);
```

#### `openhouse_frontend/src/hooks/games/useGameState.ts` (line 52)
**Current State:**
```typescript
setBetError(`Bet amount must be between ${minBet} and ${maxBet} ICP`);
```

**Required Changes:**
```typescript
// PSEUDOCODE
// Replace "ICP" with "USDT"

setBetError(`Bet amount must be between ${minBet} and ${maxBet} USDT`);
```

#### `openhouse_frontend/src/providers/BalanceProvider.tsx` (line 47)
**Current State:**
```typescript
console.error('Failed to fetch ICP balance:', err);
```

**Required Changes:**
```typescript
// PSEUDOCODE
// Replace "ICP" with "USDT"

console.error('Failed to fetch USDT balance:', err);
```

#### `openhouse_frontend/src/providers/GameBalanceProvider.tsx` (line 123)
**Current State:**
```typescript
houseBalance = BigInt(100000000000); // 1000 ICP in e8s for display
```

**Required Changes:**
```typescript
// PSEUDOCODE
// Update comment and adjust value for 6 decimals
// 1000 USDT = 1000 * 1_000_000 = 1_000_000_000

houseBalance = BigInt(1_000_000_000); // 1000 USDT in ckUSDT decimals for display
```

## Implementation Steps

### Step 1: Update Core Type Definitions
```typescript
// FILE: openhouse_frontend/src/types/ledger.ts
// PSEUDOCODE

// 1. Rename e8sToIcp → decimalsToUSDT
// 2. Update divisor to 1_000_000 (6 decimals)
// 3. Rename formatIcp → formatUSDT
// 4. Update format string to include "$" and "USDT"
// 5. Export new functions
```

### Step 2: Update Type Comments
```typescript
// FILE: openhouse_frontend/src/types/dice-backend.ts
// PSEUDOCODE

// Find and replace ALL occurrences:
// "(in e8s)" → "(in ckUSDT decimals - 6 decimals)"
// "ICP" → "USDT"
```

### Step 3: Update UI Components (Batch)
```typescript
// FILES:
// - openhouse_frontend/src/components/AuthButton.tsx
// - openhouse_frontend/src/components/game-ui/GameLayout.tsx
// - openhouse_frontend/src/components/game-ui/GameHistory.tsx
// - openhouse_frontend/src/components/game-specific/dice/HealthDashboard.tsx

// PSEUDOCODE FOR EACH FILE:
// 1. Import formatUSDT instead of formatIcp
// 2. Replace all formatIcp() calls with formatUSDT()
// 3. Replace all divisors 100_000_000 with 1_000_000
// 4. Replace all text "ICP" with "USDT"
// 5. Update thresholds (e.g., BigInt(100_000_000) → BigInt(1_000_000))
```

### Step 4: Update Game Pages
```typescript
// FILES:
// - openhouse_frontend/src/pages/Plinko.tsx
// - openhouse_frontend/src/pages/PlinkoMotoko.tsx
// - openhouse_frontend/src/pages/dice/DiceGame.tsx

// PSEUDOCODE:
// 1. Replace all "ICP" text with "USDT"
// 2. Rename bet_icp/won_icp fields to bet_usdt/won_usdt
```

### Step 5: Update Hooks & Providers
```typescript
// FILES:
// - openhouse_frontend/src/hooks/games/useBetValidation.ts
// - openhouse_frontend/src/hooks/games/useGameState.ts
// - openhouse_frontend/src/providers/BalanceProvider.tsx
// - openhouse_frontend/src/providers/GameBalanceProvider.tsx

// PSEUDOCODE:
// 1. Replace error message text "ICP" → "USDT"
// 2. Update dummy balance values for correct decimal places
```

### Step 6: Update Comments & IDL
```typescript
// FILE: openhouse_frontend/src/utils/ledgerIdl.ts
// PSEUDOCODE

// Update top comment:
// "ICP Ledger" → "ckUSDT Ledger"
// Add note about e8s being 6 decimals for ckUSDT
```

## Testing Checklist

### Manual Verification (Post-Deployment)

Visit https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io and verify:

1. **AuthButton**: Shows "USDT Balance" and formats correctly
2. **Dice Game**:
   - Balance displays show USDT
   - Bet validation messages say USDT
   - Health dashboard shows USDT everywhere
   - All values formatted with 6 decimals
3. **Plinko Games**:
   - Both Plinko.tsx and PlinkoMotoko.tsx show USDT
   - Bet amounts and wins display USDT
4. **Game History**:
   - Historical bets show USDT
   - Payouts formatted correctly (6 decimals)
5. **Game Layout Footer**:
   - Min/Max bets show USDT

### Browser Console Checks
```javascript
// Check no ICP references in console logs
// Look for "Failed to fetch USDT balance" (not ICP)
```

## Backend Considerations (Future Work)

**Note:** This plan focuses on frontend migration ONLY. Backend games (crash, plinko) don't have accounting systems yet, so they don't need migration.

When crash_backend and plinko_backend get accounting systems in the future, they should:
1. Copy dice_backend's defi_accounting module
2. Use CKUSDT_CANISTER_ID: "cngnf-vqaaa-aaaar-qag4q-cai"
3. Use 6 decimal precision (DECIMALS_PER_CKUSDT = 1_000_000)
4. Use CKUSDT_TRANSFER_FEE = 10_000

## Deployment Notes

**Affected Canisters:**
- Frontend only: `pezw3-laaaa-aaaal-qssoa-cai`

**Deployment Command:**
```bash
cd openhouse_frontend
npm run build
cd ..
./deploy.sh --frontend-only
```

**No Backend Deployment Needed:**
- dice_backend already on ckUSDT ✅
- Other backends are stateless (no accounting) ✅

## Success Criteria

- ✅ No "ICP" text visible anywhere in UI
- ✅ All balances formatted with 6 decimals (ckUSDT)
- ✅ All balance displays show "USDT" or "$X.XX USDT"
- ✅ Error messages reference USDT, not ICP
- ✅ Type definitions and comments updated
- ✅ Frontend builds successfully
- ✅ Deployment to mainnet succeeds
- ✅ Manual testing on live site passes

## References

- Dice ckUSDT Implementation: `dice_backend/src/types.rs` (lines 10-14)
- ckUSDT Canister ID: `cngnf-vqaaa-aaaar-qag4q-cai`
- Decimals: 6 (1 USDT = 1,000,000 decimals)
- Transfer Fee: 10,000 decimals (0.01 USDT)
- Related PR: #91 (Dice backend ICP → ckUSDT migration)
