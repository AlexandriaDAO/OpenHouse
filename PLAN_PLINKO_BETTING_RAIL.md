# 🤖 AUTONOMOUS PR ORCHESTRATOR - DO NOT SKIP

**You are an autonomous PR orchestrator. Your ONLY job is to implement this plan and create a PR.**

## Isolation Check (RUN FIRST)
```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
if [ "$REPO_ROOT" = "/home/theseus/alexandria/openhouse" ]; then
    echo "❌ FATAL: In main repo. Must be in worktree."
    echo "Worktree: /home/theseus/alexandria/openhouse-plinko-betting"
    exit 1
fi
echo "✅ In isolated worktree: $REPO_ROOT"
```

## Your Autonomous Workflow (NO QUESTIONS ALLOWED)
1. **Verify isolation** - You must be in worktree: `/home/theseus/alexandria/openhouse-plinko-betting`
2. **Implement feature** - Follow plan sections below
3. **Build & Deploy to Mainnet**:
   ```bash
   # Frontend-only changes
   cd openhouse_frontend
   npm run build
   cd ..
   ./deploy.sh --frontend-only
   ```

4. **Verify deployment**:
   ```bash
   # Test the live site
   echo "Visit: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io/plinko"
   ```

5. **Create PR** (MANDATORY):
   ```bash
   git add .
   git commit -m "feat: add betting rail to Plinko game"
   git push -u origin feature/plinko-betting-rail
   gh pr create --title "Feature: Add Betting Rail to Plinko" --body "Implements PLAN_PLINKO_BETTING_RAIL.md

Adds the BettingRail component to the Plinko game, enabling real betting with:
- Chip-based bet selection
- Deposit/withdraw functionality
- Balance display (game/house)
- Integration with play_plinko/play_multi_plinko backend endpoints

Deployed to mainnet:
- Frontend: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io/plinko
- Backend: weupr-2qaaa-aaaap-abl3q-cai (no changes needed)"
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

**Branch:** `feature/plinko-betting-rail`
**Worktree:** `/home/theseus/alexandria/openhouse-plinko-betting`

---

# Implementation Plan: Add Betting Rail to Plinko Game

## Overview

Add the BettingRail component to Plinko, replacing demo endpoints (`drop_ball`, `drop_multiple_balls`) with real betting endpoints (`play_plinko`, `play_multi_plinko`). The backend already has full betting support - this is frontend-only.

## Current State

### Plinko Frontend (`src/pages/Plinko.tsx`)
- Ball count slider (1-30 balls)
- Uses demo endpoints: `drop_ball()`, `drop_multiple_balls()`
- No betting UI, no balance display
- Physics animation via `usePlinkoPhysics.ts`

### Backend API (Already Complete - No Changes Needed)
| Endpoint | Purpose |
|----------|---------|
| `play_plinko(bet: u64)` | Single ball with bet |
| `play_multi_plinko(count: u8, bet_per_ball: u64)` | Multi-ball with bet |
| `get_max_bet()` | Max bet for single ball |
| `get_max_bet_per_ball(count: u8)` | Max per-ball bet given count |
| `deposit(amount: u64)` | Deposit USDT |
| `withdraw_all()` | Withdraw all chips |
| `get_my_balance()` | User's chip balance |

### Reusable Components (Already Exist)
- `src/components/betting/BettingRail.tsx` - Main betting component
- `src/components/betting/ChipStack.tsx` - Chip visualization
- `src/components/betting/ChipSelector.tsx` - Chip buttons
- `src/components/betting/hooks/useBettingState.ts` - Bet state management
- `src/components/betting/hooks/useDepositFlow.ts` - Deposit/withdraw logic

---

## Files to Modify

| File | Action |
|------|--------|
| `src/components/betting/chipConfig.ts` | **CREATE** - Move from dice |
| `src/components/betting/hooks/useBettingState.ts` | **EDIT** - Update import |
| `src/components/betting/types.ts` | **EDIT** - Update import, add gameRoute prop |
| `src/components/betting/BettingRail.tsx` | **EDIT** - Dynamic route |
| `src/pages/Plinko.tsx` | **MAJOR EDIT** - Full integration |

---

## Step 1: Move chipConfig.ts to Shared Location

**CREATE** `src/components/betting/chipConfig.ts`:
```typescript
// PSEUDOCODE: Copy entire contents from src/components/game-specific/dice/chipConfig.ts
// This file contains:
// - CHIP_DENOMINATIONS array (0.01, 0.10, 1.00, 5.00, 10.00)
// - ChipDenomination interface
// - decomposeIntoChips() function
// - getChipByValue() function
```

**EDIT** `src/components/betting/hooks/useBettingState.ts` (line 2):
```typescript
// OLD: import { CHIP_DENOMINATIONS, ... } from '../../game-specific/dice/chipConfig';
// NEW:
import { CHIP_DENOMINATIONS, ChipDenomination, decomposeIntoChips } from '../chipConfig';
```

**EDIT** `src/components/betting/types.ts` (line 1):
```typescript
// OLD: import { ChipDenomination } from '../game-specific/dice/chipConfig';
// NEW:
import { ChipDenomination } from './chipConfig';
```

---

## Step 2: Make BettingRail Route Dynamic

**EDIT** `src/components/betting/types.ts`:
```typescript
// PSEUDOCODE: Add to BettingRailProps interface
export interface BettingRailProps {
  // ... existing props ...
  gameRoute?: string;  // e.g., '/plinko' - defaults to '/dice'
}
```

**EDIT** `src/components/betting/BettingRail.tsx`:
```typescript
// PSEUDOCODE: Lines 107 and 234 - replace hardcoded '/dice' with dynamic route

// Line ~16: Destructure gameRoute with default
const { gameRoute = '/dice' } = props;

// Line ~107 (desktop) and ~234 (mobile):
// OLD: onClick={() => navigate(isLiquidityRoute ? '/dice' : '/dice/liquidity')}
// NEW:
onClick={() => navigate(isLiquidityRoute ? gameRoute : `${gameRoute}/liquidity`)}
```

---

## Step 3: Update Plinko.tsx with Full Betting Integration

**EDIT** `src/pages/Plinko.tsx`:

### 3.1 Add Imports (after existing imports)
```typescript
// PSEUDOCODE: Add these imports
import useLedgerActor from '../hooks/actors/useLedgerActor';
import { BettingRail } from '../components/betting';
import { useGameBalance } from '../providers/GameBalanceProvider';
import { useBalance } from '../providers/BalanceProvider';
import { useAuth } from '../providers/AuthProvider';
import { DECIMALS_PER_CKUSDT, formatUSDT } from '../types/balance';
```

### 3.2 Add Constant
```typescript
const PLINKO_BACKEND_CANISTER_ID = 'weupr-2qaaa-aaaap-abl3q-cai';
```

### 3.3 Update Component State (inside Plinko component)
```typescript
// PSEUDOCODE: Add these hooks and state after existing state declarations

// Additional hooks
const { actor: ledgerActor } = useLedgerActor();
const { isAuthenticated } = useAuth();
const { balance: walletBalance, refreshBalance: refreshWalletBalance } = useBalance();
const gameBalanceContext = useGameBalance('plinko');
const balance = gameBalanceContext.balance;

// Betting state
const [betAmount, setBetAmount] = useState(1);  // Per-ball bet (min 1 USDT)
const [maxBet, setMaxBet] = useState(100);
```

### 3.4 Add Balance Refresh Handler
```typescript
// PSEUDOCODE: Add after state declarations
const handleBalanceRefresh = useCallback(() => {
  refreshWalletBalance();
  gameBalanceContext.refresh();
}, [refreshWalletBalance, gameBalanceContext]);
```

### 3.5 Add Max Bet Effect
```typescript
// PSEUDOCODE: Add new useEffect for max bet calculation
useEffect(() => {
  const updateMaxBet = async () => {
    if (!actor) return;
    try {
      const result = await actor.get_max_bet_per_ball(ballCount);
      if ('Ok' in result) {
        // 90% safety margin for UI
        const maxBetUSDT = (Number(result.Ok) / DECIMALS_PER_CKUSDT) * 0.9;
        setMaxBet(Math.max(1, maxBetUSDT)); // Min 1 USDT
        if (betAmount > maxBetUSDT) {
          setBetAmount(Math.min(betAmount, maxBetUSDT));
        }
      }
    } catch (err) {
      console.error('Failed to get max bet:', err);
      setMaxBet(100); // Fallback
    }
  };
  updateMaxBet();
}, [actor, ballCount]);
```

### 3.6 Add Balance Auto-Refresh Effect
```typescript
// PSEUDOCODE: Add useEffect for balance refresh
useEffect(() => {
  if (actor && isAuthenticated) {
    gameBalanceContext.refresh().catch(console.error);
  }
}, [actor, isAuthenticated]);
```

### 3.7 Replace dropBalls Function
```typescript
// PSEUDOCODE: Replace the entire dropBalls function

const dropBalls = async () => {
  if (!actor) return;

  // Auth check
  if (!isAuthenticated) {
    setGameError('Please log in to play.');
    return;
  }

  // Balance check
  if (balance.game === 0n) {
    setGameError('No chips! Use the + button below to deposit.');
    return;
  }

  // Calculate bet in e8s (6 decimals for ckUSDT)
  const betPerBallE8s = BigInt(Math.floor(betAmount * DECIMALS_PER_CKUSDT));
  const totalBetE8s = betPerBallE8s * BigInt(ballCount);

  // Validate total bet against balance
  if (totalBetE8s > balance.game) {
    setGameError(`Insufficient balance. Total bet: $${(betAmount * ballCount).toFixed(2)}`);
    return;
  }

  setIsPlaying(true);
  setGameError('');
  setMultiBallResult(null);
  setCurrentResult(null);

  try {
    if (ballCount === 1) {
      // Single ball with betting
      const result = await actor.play_plinko(betPerBallE8s);
      if ('Ok' in result) {
        const gameResult: PlinkoGameResult = {
          path: result.Ok.path,
          final_position: result.Ok.final_position,
          multiplier: result.Ok.multiplier,
          win: result.Ok.is_win,
          timestamp: Date.now(),
          bet_amount: Number(result.Ok.bet_amount) / DECIMALS_PER_CKUSDT,
          payout: Number(result.Ok.payout) / DECIMALS_PER_CKUSDT,
          profit: Number(result.Ok.profit) / DECIMALS_PER_CKUSDT,
        };
        setCurrentResult(gameResult);
        // Refresh balance after game
        gameBalanceContext.refresh().catch(console.error);
      } else {
        setGameError(result.Err);
        setIsPlaying(false);
      }
    } else {
      // Multi-ball with betting
      const result = await actor.play_multi_plinko(ballCount, betPerBallE8s);
      if ('Ok' in result) {
        const multiBallGameResult = {
          results: result.Ok.results.map(r => ({
            path: r.path,
            final_position: r.final_position,
            multiplier: r.multiplier,
            win: r.is_win,
          })),
          total_balls: result.Ok.total_balls,
          total_wins: result.Ok.results.filter(r => r.is_win).length,
          average_multiplier: result.Ok.average_multiplier,
          total_bet: Number(result.Ok.total_bet) / DECIMALS_PER_CKUSDT,
          total_payout: Number(result.Ok.total_payout) / DECIMALS_PER_CKUSDT,
          net_profit: Number(result.Ok.net_profit) / DECIMALS_PER_CKUSDT,
        };
        setMultiBallResult(multiBallGameResult);
        // Refresh balance after game
        gameBalanceContext.refresh().catch(console.error);
      } else {
        setGameError(result.Err);
        setIsPlaying(false);
      }
    }
  } catch (err) {
    console.error('Failed to play plinko:', err);
    setGameError(err instanceof Error ? err.message : 'Failed to play');
    setIsPlaying(false);
  }
};
```

### 3.8 Update Type Definitions
```typescript
// PSEUDOCODE: Update interfaces at top of file

interface PlinkoGameResult {
  path: boolean[];
  final_position: number;
  multiplier: number;
  win: boolean;
  timestamp: number;
  // Betting info (optional for backwards compat)
  bet_amount?: number;
  payout?: number;
  profit?: number;
}

interface MultiBallBackendResult {
  results: {
    path: boolean[];
    final_position: number;
    multiplier: number;
    win: boolean;
  }[];
  total_balls: number;
  total_wins: number;
  average_multiplier: number;
  // Betting totals (optional)
  total_bet?: number;
  total_payout?: number;
  net_profit?: number;
}
```

### 3.9 Update Result Display (in JSX, around line 176-188)
```typescript
// PSEUDOCODE: Update result display to show profit/loss

{/* Result display - compact */}
<div className="h-8 flex items-center justify-center flex-shrink-0">
  {!isPlaying && currentResult && (
    <span className={`text-sm font-bold ${currentResult.win ? 'text-green-400' : 'text-red-400'}`}>
      {currentResult.win ? 'WIN' : 'LOST'} {currentResult.multiplier.toFixed(2)}x
      {currentResult.profit !== undefined && (
        <span className="ml-2">
          {currentResult.profit >= 0 ? '+' : ''}{currentResult.profit.toFixed(2)} USDT
        </span>
      )}
    </span>
  )}
  {!isPlaying && multiBallResult && (
    <span className="text-xs text-gray-300">
      AVG {multiBallResult.average_multiplier.toFixed(2)}x
      ({multiBallResult.total_wins}/{multiBallResult.total_balls} wins)
      {multiBallResult.net_profit !== undefined && (
        <span className={`ml-2 font-bold ${multiBallResult.net_profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {multiBallResult.net_profit >= 0 ? '+' : ''}{multiBallResult.net_profit.toFixed(2)} USDT
        </span>
      )}
    </span>
  )}
</div>
```

### 3.10 Add Multi-Ball Bet Info Display (after ball count slider)
```typescript
// PSEUDOCODE: Add after the ball count slider div, before the game board

{/* Bet info for multi-ball */}
{ballCount > 1 && (
  <div className="flex justify-center items-center gap-4 py-1 text-xs text-gray-400">
    <span>Per ball: ${betAmount.toFixed(2)}</span>
    <span className="text-white font-semibold">Total: ${(betAmount * ballCount).toFixed(2)}</span>
  </div>
)}
```

### 3.11 Add BettingRail Component (before closing </GameLayout>)
```typescript
// PSEUDOCODE: Add BettingRail at end of GameLayout, after the info button div

{/* BettingRail */}
<BettingRail
  betAmount={betAmount}
  onBetChange={setBetAmount}
  maxBet={maxBet}
  gameBalance={balance.game}
  walletBalance={walletBalance}
  houseBalance={balance.house}
  ledgerActor={ledgerActor}
  gameActor={actor}
  onBalanceRefresh={handleBalanceRefresh}
  disabled={isPlaying}
  multiplier={multipliers[4] || 0.2}  // Center multiplier as reference
  canisterId={PLINKO_BACKEND_CANISTER_ID}
  gameRoute="/plinko"
/>
```

### 3.12 Update Ball Count Slider (disable when no balance)
```typescript
// PSEUDOCODE: Update the disabled prop on the slider

<input
  type="range"
  min="1"
  max="30"
  value={ballCount}
  onChange={(e) => setBallCount(Number(e.target.value))}
  disabled={isPlaying || balance.game === 0n}  // Added balance check
  className="..."
/>
```

---

## Key Constraints

1. **Min Bet**: 1 USDT (Plinko minimum)
2. **Canister ID**: `weupr-2qaaa-aaaap-abl3q-cai`
3. **Fixed 8 Rows**: No risk level or row count selectors
4. **Multi-Ball Total**: `total_bet = bet_per_ball × ball_count`

---

## Deployment

This is **frontend-only** - no backend changes needed.

```bash
cd openhouse_frontend
npm run build
cd ..
./deploy.sh --frontend-only
```

## Verification

1. Visit https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io/plinko
2. Log in with Internet Identity
3. Deposit USDT using the + button
4. Select bet amount using chips
5. Drop balls and verify:
   - Bet is deducted from balance
   - Payout is added based on multiplier
   - Results show profit/loss in USDT
