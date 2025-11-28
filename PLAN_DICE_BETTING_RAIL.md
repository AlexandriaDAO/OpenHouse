# AUTONOMOUS PR ORCHESTRATOR - DO NOT SKIP

**You are an autonomous PR orchestrator. Your ONLY job is to implement this plan and create a PR.**

## Isolation Check (RUN FIRST)
```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
if [ "$REPO_ROOT" = "/home/theseus/alexandria/openhouse" ]; then
    echo "FATAL: In main repo. Must be in worktree."
    echo "Worktree: /home/theseus/alexandria/openhouse-betting-rail"
    exit 1
fi
echo "In isolated worktree: $REPO_ROOT"
```

## Your Autonomous Workflow (NO QUESTIONS ALLOWED)
1. **Verify isolation** - You must be in worktree: `/home/theseus/alexandria/openhouse-betting-rail`
2. **Implement feature** - Follow plan sections below
3. **Build & Deploy to Mainnet**:
   ```bash
   cd openhouse_frontend
   npm run build
   cd ..
   ./deploy.sh --frontend-only
   ```
4. **Verify deployment**:
   ```bash
   echo "Visit: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io/dice"
   ```
5. **Create PR** (MANDATORY):
   ```bash
   git add .
   git commit -m "feat(dice): Add poker table betting rail UI"
   git push -u origin feature/dice-betting-rail
   gh pr create --title "Dice: Poker Table Betting Rail" --body "$(cat <<'EOF'
   ## Summary
   Separates dice game UI into clean game area + fixed-bottom poker table betting rail.

   - Main area: dice animation, Over/Under controls, target slider, Roll button
   - Bottom rail: chips, bet amount, balances, deposit/cashout (casino green felt aesthetic)

   ## Changes
   - NEW: `BettingRail.tsx` - Reusable poker table style betting component
   - NEW: `BettingRail.css` - Curved green felt styling
   - MODIFIED: `DiceGame.tsx` - Refactored to use new layout split

   ## Test Plan
   - [ ] Verify chip selection works (all 5 denominations)
   - [ ] Verify LIFO undo (click bet to remove last chip)
   - [ ] Verify deposit flow (+ Chips button)
   - [ ] Verify cash out flow
   - [ ] Verify betting rail is fixed at bottom on scroll
   - [ ] Test on mobile (responsive layout)

   Deployed to mainnet: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io/dice

   Implements PLAN_DICE_BETTING_RAIL.md
   EOF
   )"
   ```
6. **Iterate autonomously**:
   - FOR i=1 to 5:
     - Check review: `gh pr view --json comments`
     - Count P0 issues
     - IF P0 > 0: Fix immediately, commit, push, sleep 300s, continue
     - IF P0 = 0: Report success, EXIT
   - After 5 iterations: Escalate to human

## CRITICAL RULES
- NO questions ("should I?", "want me to?", "is it done?")
- NO skipping PR creation - it's MANDATORY
- NO stopping after implementation - create PR immediately
- MAINNET DEPLOYMENT: All changes go directly to production
- After sleep: IMMEDIATELY continue (no pause)
- ONLY stop at: approved, max iterations, or error

**Branch:** `feature/dice-betting-rail`
**Worktree:** `/home/theseus/alexandria/openhouse-betting-rail`

---

# Implementation Plan: Dice Poker Table Betting Rail

## Overview

Refactor the Dice game UI to separate gameplay from betting interface by creating a fixed-bottom "poker table" style betting rail.

## Design Decisions (User Confirmed)

| Aspect | Decision |
|--------|----------|
| Layout Split | Game + Roll button in main area; chips, balances, deposit/cashout in rail |
| Rail Position | Fixed to viewport bottom (always visible) |
| Texture | Stylized CSS gradients (not photorealistic) |
| Felt Color | Classic casino green (#1a472a) |
| Chip Style | Flat design (no drop shadows) |
| Rail Border | Curved top edge only (no wood/leather trim) |

---

## Current State

### Files to Reference (port logic from these)
- `openhouse_frontend/src/components/game-specific/dice/ChipBetting.tsx` - Chip selection, LIFO undo, auto-consolidation
- `openhouse_frontend/src/components/game-specific/dice/chipConfig.ts` - Chip denominations, `decomposeIntoChips()`
- `openhouse_frontend/src/components/game-specific/dice/ChipStack.tsx` - Visual chip stack rendering
- `openhouse_frontend/src/pages/dice/DiceGame.tsx` - Deposit/withdraw logic, balance display, game state

### Key Patterns to Preserve
- LIFO chip history for undo functionality
- Auto-consolidation: 10 white -> 1 red, 10 red -> 1 blue, etc.
- ICRC2 approve flow for deposits
- House limit warnings (yellow = approaching, red = danger)
- Low balance deposit animation pulse

---

## Implementation

### Phase 1: Create BettingRail Component

#### File: `openhouse_frontend/src/components/game-ui/BettingRail.tsx` (NEW)

```typescript
// PSEUDOCODE

import { useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { CHIP_DENOMINATIONS, decomposeIntoChips } from '../game-specific/dice/chipConfig';
import { ChipStack } from '../game-specific/dice/ChipStack';
import './BettingRail.css';

interface BettingRailProps {
  betAmount: number;
  onBetChange: (amount: number) => void;
  maxBet: number;
  gameBalance: bigint;
  walletBalance: bigint | null;
  houseBalance: bigint;
  ledgerActor: any;
  gameActor: any;
  onBalanceRefresh: () => void;
  disabled?: boolean;
  multiplier: number;
}

export function BettingRail(props: BettingRailProps) {
  // === Internal State ===
  // chipHistory: number[] - LIFO stack for undo
  // showDepositModal: boolean
  // depositAmount: string
  // depositStep: 'idle' | 'approving' | 'depositing'
  // isDepositing, isWithdrawing: boolean
  // error, success: string | null
  // showDepositAnimation: boolean (pulse when low balance)

  // === Chip Logic (port from ChipBetting.tsx) ===
  // addChip(chip): Add chip value, push to history, call onBetChange
  // undoLastChip(): Pop from history, subtract from bet
  // clearBet(): Reset history and bet to 0
  // canAddChip(chip): Check if adding would exceed maxBet or gameBalance

  // === Deposit Logic (port from DiceGame.tsx) ===
  // handleDeposit():
  //   1. Convert depositAmount to bigint with DECIMALS_PER_CKUSDT
  //   2. Call ledgerActor.icrc2_approve() for gameActor canister
  //   3. Call gameActor.deposit_to_balance()
  //   4. Call onBalanceRefresh()
  //   5. Close modal

  // === Withdraw Logic (port from DiceGame.tsx) ===
  // handleWithdrawAll():
  //   1. Call gameActor.withdraw_from_balance(gameBalance)
  //   2. Call onBalanceRefresh()

  // === House Limit Calculation ===
  // houseLimitStatus: Calculate based on bet vs house balance
  // Show warning badge if approaching or at limit

  // === Decompose bet for display ===
  // displayChips = useMemo(() => decomposeIntoChips(betAmount), [betAmount])

  return (
    <>
      {/* Fixed bottom container */}
      <div className="fixed bottom-0 left-0 right-0 z-40">
        {/* Curved top edge */}
        <div className="betting-rail-curve" />

        {/* Main rail surface */}
        <div className="betting-rail">
          <div className="container mx-auto px-4 py-3">

            {/* Desktop Layout: 3 columns */}
            <div className="hidden md:grid md:grid-cols-[auto_1fr_auto] gap-6 items-center">

              {/* Column 1: Chip Selector */}
              <div className="flex gap-2">
                {CHIP_DENOMINATIONS.map(chip => (
                  <button
                    key={chip.color}
                    onClick={() => addChip(chip)}
                    disabled={disabled || !canAddChip(chip.value)}
                    className="chip-button"
                  >
                    <img src={chip.topImg} alt={chip.label} className="w-12 h-12" />
                  </button>
                ))}
              </div>

              {/* Column 2: Current Bet Display */}
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={undoLastChip}
                  disabled={chipHistory.length === 0}
                  className="flex items-center gap-2"
                >
                  {displayChips.length > 0 && (
                    <ChipStack chips={displayChips} size="sm" />
                  )}
                  <span className="font-mono text-xl font-bold text-white">
                    ${betAmount.toFixed(2)}
                  </span>
                </button>
                <span className="text-xs text-gray-400">max ${maxBet.toFixed(2)}</span>
                <button
                  onClick={clearBet}
                  disabled={betAmount === 0}
                  className="text-xs text-gray-400 hover:text-white"
                >
                  Clear
                </button>
              </div>

              {/* Column 3: Action Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDepositModal(true)}
                  className={`px-4 py-2 rounded font-bold ${
                    showDepositAnimation
                      ? 'bg-yellow-500 text-black deposit-button-pulse'
                      : 'bg-dfinity-turquoise text-black'
                  }`}
                >
                  + Chips
                </button>
                <button
                  onClick={handleWithdrawAll}
                  disabled={isWithdrawing || gameBalance === 0n}
                  className="px-4 py-2 border border-gray-600 rounded text-gray-300 hover:text-white"
                >
                  Cash Out
                </button>
              </div>

            </div>

            {/* Mobile Layout: Stacked */}
            <div className="md:hidden space-y-3">
              {/* Row 1: Chips (condensed) + Bet amount */}
              <div className="flex items-center gap-3">
                <div className="flex gap-1">
                  {/* Show 3 main chips + expand */}
                  {[CHIP_DENOMINATIONS[1], CHIP_DENOMINATIONS[2], CHIP_DENOMINATIONS[3]].map(chip => (
                    <button
                      key={chip.color}
                      onClick={() => addChip(chip)}
                      disabled={disabled || !canAddChip(chip.value)}
                      className="chip-button p-1"
                    >
                      <img src={chip.topImg} alt={chip.label} className="w-10 h-10" />
                    </button>
                  ))}
                  <button className="p-1 text-gray-400">...</button>
                </div>
                <div className="flex-1 text-right">
                  <span className="font-mono text-lg font-bold">${betAmount.toFixed(2)}</span>
                  <span className="text-xs text-gray-500 block">max ${maxBet.toFixed(2)}</span>
                </div>
              </div>

              {/* Row 2: Action buttons */}
              <div className="flex gap-2">
                <button className="flex-1 py-2 text-sm font-bold rounded bg-dfinity-turquoise text-black">
                  + Chips
                </button>
                <button className="flex-1 py-2 text-sm border border-gray-600 rounded text-gray-400">
                  Clear
                </button>
                <button className="flex-1 py-2 text-sm border border-gray-600 rounded text-gray-400">
                  Cash Out
                </button>
              </div>
            </div>

            {/* Bottom Info Row */}
            <div className="flex items-center justify-between text-xs mt-2 pt-2 border-t border-gray-800/50 text-gray-400">
              <span>Chips: <span className="text-white font-mono">${formatUSDT(gameBalance)}</span></span>
              <span>Wallet: <span className="text-white font-mono">${formatUSDT(walletBalance)}</span></span>
              {houseLimitStatus !== 'ok' && (
                <span className={houseLimitStatus === 'danger' ? 'text-red-400' : 'text-yellow-400'}>
                  House limit {houseLimitStatus}
                </span>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* Deposit Modal (portal to body) */}
      {showDepositModal && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 max-w-sm w-full mx-4">
            <h3 className="text-xl font-bold mb-4">Buy Chips</h3>
            {/* Amount input */}
            {/* Approve + Deposit flow */}
            {/* Error/success messages */}
            {/* Close button */}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
```

#### File: `openhouse_frontend/src/components/game-ui/BettingRail.css` (NEW)

```css
/* PSEUDOCODE - Poker table aesthetic */

/* Curved top edge - elliptical curve */
.betting-rail-curve {
  height: 16px;
  background: linear-gradient(
    to bottom,
    transparent 0%,
    #1a472a 100%
  );
  border-top-left-radius: 50% 100%;
  border-top-right-radius: 50% 100%;
  position: relative;
}

/* Subtle accent line at curve peak */
.betting-rail-curve::after {
  content: '';
  position: absolute;
  top: 0;
  left: 10%;
  right: 10%;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.12),
    transparent
  );
  border-top-left-radius: 50% 100%;
  border-top-right-radius: 50% 100%;
}

/* Main felt surface - gradient for depth */
.betting-rail {
  background: linear-gradient(
    180deg,
    #1a472a 0%,
    #153d24 50%,
    #122f1c 100%
  );
  box-shadow:
    0 -4px 20px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.03);
}

/* Chip button interactions */
.chip-button {
  transition: transform 0.15s ease, filter 0.15s ease;
  border-radius: 50%;
}

.chip-button:hover:not(:disabled) {
  transform: translateY(-4px);
  filter: brightness(1.1);
}

.chip-button:active:not(:disabled) {
  transform: translateY(-2px);
}

.chip-button:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

/* Pulsing animation for low balance */
@keyframes deposit-pulse {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(234, 179, 8, 0.5);
  }
  50% {
    box-shadow: 0 0 0 10px rgba(234, 179, 8, 0);
  }
}

.deposit-button-pulse {
  animation: deposit-pulse 2s ease-in-out infinite;
}
```

#### File: `openhouse_frontend/src/components/game-ui/index.ts` (MODIFY)

```typescript
// PSEUDOCODE - Add export
export { BettingRail } from './BettingRail';
```

---

### Phase 2: Refactor DiceGame.tsx

#### File: `openhouse_frontend/src/pages/dice/DiceGame.tsx` (MODIFY)

```typescript
// PSEUDOCODE - Key changes

// REMOVE these imports:
// - ChipBetting (replaced by BettingRail)

// ADD these imports:
import { BettingRail } from '../../components/game-ui';

// REMOVE these state variables:
// - showDepositModal, depositAmount, depositStep
// - accountingError, accountingSuccess
// - showDepositAnimation
// - isDepositing, isWithdrawing
// - chipHistory (now internal to BettingRail)

// REMOVE these handlers:
// - handleDeposit() - moved to BettingRail
// - handleWithdrawAll() - moved to BettingRail

// ADD this callback for BettingRail:
const handleBalanceRefresh = useCallback(() => {
  refreshWalletBalance();
  gameBalanceContext.refresh();
}, [refreshWalletBalance, gameBalanceContext]);

// RESTRUCTURE the JSX:
return (
  <GameLayout minBet={0.01} maxWin={10} houseEdge={0.99}>

    {/* Main Game Area - Centered, single column */}
    <div className="max-w-2xl mx-auto pb-48"> {/* pb-48 for rail clearance */}

      {/* Auth check (keep existing) */}
      {!isAuthenticated && (
        <div className="text-center text-gray-400 mb-6">
          Please log in to play
        </div>
      )}

      {/* Dice Animation - Larger, centered */}
      <div className="flex flex-col items-center justify-center min-h-[350px] bg-black/20 rounded-xl border border-gray-800/50 p-6 relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-dfinity-turquoise/5 to-purple-900/10 pointer-events-none" />

        {/* Dice component - scale up */}
        <div className="scale-125 mb-8 relative z-10">
          <DiceAnimation
            targetNumber={animatingResult}
            isRolling={isPlaying}
            onAnimationComplete={handleAnimationComplete}
          />
        </div>

        {/* Result Display */}
        <div className="h-24 flex items-center justify-center w-full relative z-10">
          {lastResult && !isPlaying ? (
            <div className={`text-center ${lastResult.is_win ? 'text-green-400' : 'text-red-400'}`}>
              <div className="text-4xl font-black">
                {lastResult.is_win ? 'YOU WON!' : 'YOU LOST'}
              </div>
              {lastResult.is_win && (
                <div className="text-2xl font-mono text-dfinity-turquoise">
                  +{formatUSDT(lastResult.payout)}
                </div>
              )}
            </div>
          ) : !isPlaying && (
            <div className="text-gray-600 text-sm italic">Ready to roll...</div>
          )}
        </div>
      </div>

      {/* Controls Section */}
      <div className="mt-6 space-y-4">

        {/* Over/Under + Target Slider (keep existing DiceControls) */}
        <DiceControls
          targetNumber={targetNumber}
          onTargetChange={setTargetNumber}
          direction={direction}
          onDirectionChange={setDirection}
          disabled={isPlaying}
        />

        {/* Payout Preview Line */}
        <div className="flex items-center justify-between text-xs px-1">
          <div className="flex items-center gap-4 text-gray-400">
            <span>
              <span className="text-yellow-400 font-bold">{winChance.toFixed(0)}%</span> chance
            </span>
            <span>
              <span className="text-green-400 font-bold">{multiplier.toFixed(2)}x</span> payout
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-dfinity-turquoise font-mono font-bold">
              Win ${(betAmount * multiplier).toFixed(2)}
            </span>
            <button
              onClick={() => setShowOddsExplainer(true)}
              className="text-gray-500 hover:text-dfinity-turquoise"
            >
              ?
            </button>
          </div>
        </div>

        {/* Roll Button (keep existing GameButton) */}
        <GameButton
          onClick={rollDice}
          disabled={!actor || betAmount === 0 || !isAuthenticated}
          loading={isPlaying}
          label="ROLL DICE"
          loadingLabel="Rolling..."
        />

        {/* Error Display (game errors only) */}
        {gameError && (
          <div className="p-3 bg-red-900/20 border border-red-500/30 rounded text-red-400 text-sm">
            {gameError}
          </div>
        )}

      </div>

      {/* Odds Explainer Modal (keep existing) */}
      {showOddsExplainer && (
        <OddsExplainerModal onClose={() => setShowOddsExplainer(false)} />
      )}

    </div>

    {/* Betting Rail - Fixed bottom */}
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
      multiplier={multiplier}
    />

  </GameLayout>
);
```

---

## Visual Reference

```
+------------------------------------------------------------------+
|                        OPENHOUSE DICE                             |
+------------------------------------------------------------------+
|                                                                   |
|                      +------------------+                         |
|                      |                  |                         |
|                      |       47         |  <- Large dice          |
|                      |                  |                         |
|                      +------------------+                         |
|                                                                   |
|                       YOU WON! +$1.98                             |
|                                                                   |
|                    [ OVER ]    [ UNDER ]                          |
|                                                                   |
|                    Target: 50  ====*====                          |
|                                                                   |
|                    49% | 2.02x | Win $2.02                        |
|                                                                   |
|                    +-----------------------+                      |
|                    |      ROLL DICE        |                      |
|                    +-----------------------+                      |
|                                                                   |
+==================================================================+
|  /~~~~~~~~~~ curved green felt edge ~~~~~~~~~~\                  |
|                                                                   |
|  [.01][.10][1][5][10]     $1.00      [+ Chips] [Cash Out]        |
|                           max $4.95  [   Clear Bet     ]          |
|                                                                   |
|  Chips: $12.50  |  Wallet: $87.50  |  House: OK                  |
+==================================================================+
```

---

## Deployment Notes

- **Affected**: Frontend only (no backend changes)
- **Deploy command**: `./deploy.sh --frontend-only`
- **Test URL**: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io/dice
- **Canister**: `pezw3-laaaa-aaaal-qssoa-cai`

## Reusability

BettingRail is designed to be game-agnostic. Future games (crash, plinko, mines) can adopt it by passing their specific:
- `gameActor` (different canister per game)
- `maxBet` calculation
- `multiplier` for house limit display
