# 🤖 AUTONOMOUS PR ORCHESTRATOR - DO NOT SKIP

**You are an autonomous PR orchestrator. Your ONLY job is to implement this plan and create a PR.**

## Isolation Check (RUN FIRST)
```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
if [ "$REPO_ROOT" = "/home/theseus/alexandria/openhouse" ]; then
    echo "❌ FATAL: In main repo. Must be in worktree."
    echo "Worktree: /home/theseus/alexandria/openhouse-dice-ui-refactor"
    exit 1
fi
echo "✅ In isolated worktree: $REPO_ROOT"
```

## Your Autonomous Workflow (NO QUESTIONS ALLOWED)
1. **Verify isolation** - You must be in worktree: `/home/theseus/alexandria/openhouse-dice-ui-refactor`
2. **Implement feature** - Follow plan sections below
3. **Build & Deploy to Mainnet**:
   - Frontend changes:
     ```bash
     cd openhouse_frontend
     npm run build
     cd ..
     ./deploy.sh
     ```

4. **Verify deployment**:
   ```bash
   # Check canister status
   dfx canister --network ic status openhouse_frontend

   # Test the live site
   echo "Visit: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io/dice"
   ```

5. **Create PR** (MANDATORY):
   ```bash
   git add .
   git commit -m "refactor: compact dice game UI/UX redesign"
   git push -u origin feature/dice-ui-refactor
   gh pr create --title "Refactor: Dice Game UI/UX Compact Redesign" --body "Implements DICE_UI_REFACTOR_PLAN.md

Deployed to mainnet:
- Frontend: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io/dice
- Affected canisters: openhouse_frontend"
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

**Branch:** `feature/dice-ui-refactor`
**Worktree:** `/home/theseus/alexandria/openhouse-dice-ui-refactor`

---

# Implementation Plan

## Current State Documentation

### Files to Modify:
- `openhouse_frontend/src/pages/Dice.tsx` - Main dice page (lines 1-271)
- `openhouse_frontend/src/components/game-specific/dice/DiceAccountingPanel.tsx` - Fund management (lines 1-226)
- `openhouse_frontend/src/components/game-specific/dice/DiceControls.tsx` - Target & direction controls (lines 1-67)
- `openhouse_frontend/src/components/game-ui/BetAmountInput.tsx` - Bet amount input (lines 1-58)
- `openhouse_frontend/src/components/game-ui/GameStats.tsx` - Stats display (lines 1-73)

### UI/UX Problems Identified:
1. **Accounting Panel** (lines 136-223 in DiceAccountingPanel.tsx):
   - Takes full card width with massive padding
   - Balance boxes use `grid-cols-3` taking two rows
   - Deposit/withdraw inputs are full-width with large padding

2. **Betting Controls** (lines 201-236 in Dice.tsx):
   - Each element in separate large blocks
   - BetAmountInput uses text input instead of slider
   - Stats are in collapsible section adding extra clicks

3. **Screen Real Estate**:
   - Multiple `card max-w-2xl mx-auto` containers with excessive padding
   - Can't see dice animation and balances in same viewport
   - Too much vertical spacing between elements

## Refactoring Implementation (PSEUDOCODE)

### 1. Create Compact Accounting Bar: `DiceAccountingPanel.tsx` (MODIFY)
```typescript
// PSEUDOCODE - Replace lines 136-223
export const DiceAccountingPanel = () => {
  // Keep existing state and handlers (lines 17-120)

  return (
    // COMPACT HORIZONTAL BAR INSTEAD OF CARD
    <div className="bg-gray-900/50 border-b border-gray-700 px-4 py-2">
      {/* SINGLE ROW WITH ALL BALANCES + QUICK ACTIONS */}
      <div className="flex items-center justify-between max-w-6xl mx-auto">

        {/* LEFT: Compact Balance Display */}
        <div className="flex gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-gray-400">Wallet:</span>
            <span className="font-mono text-purple-400">{formatBalance(walletBalance)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-400">Game:</span>
            <span className="font-mono text-green-400">{formatBalance(gameBalance)}</span>
            <ConnectionStatusMini game="dice" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-400">House:</span>
            <span className="font-mono text-yellow-400">{formatBalance(houseBalance)}</span>
          </div>
        </div>

        {/* RIGHT: Quick Deposit/Withdraw Buttons with Inline Inputs */}
        <div className="flex gap-2">
          {/* Compact Deposit */}
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              className="w-20 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm"
              placeholder="0.1"
              min="0.1"
              step="0.01"
            />
            <button
              onClick={handleDeposit}
              disabled={isDepositing}
              className="px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded text-sm"
            >
              {isDepositing ? '...' : 'Deposit'}
            </button>
          </div>

          {/* Compact Withdraw */}
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              className="w-20 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm"
              placeholder="0.1"
              min="0.1"
              step="0.01"
            />
            <button
              onClick={handleWithdraw}
              disabled={isWithdrawing}
              className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm"
            >
              {isWithdrawing ? '...' : 'Withdraw'}
            </button>
          </div>
        </div>
      </div>

      {/* Inline error/success messages */}
      {(error || success) && (
        <div className="max-w-6xl mx-auto mt-1">
          {error && <span className="text-red-400 text-xs">{error}</span>}
          {success && <span className="text-green-400 text-xs">{success}</span>}
        </div>
      )}
    </div>
  );
};
```

### 2. Create Unified Betting Panel with Slider: `Dice.tsx` (MODIFY)
```typescript
// PSEUDOCODE - Replace lines 201-261
{/* UNIFIED COMPACT BETTING PANEL */}
<div className="card max-w-4xl mx-auto p-4">
  <div className="grid grid-cols-2 gap-4">

    {/* LEFT COLUMN: All Controls */}
    <div className="space-y-3">

      {/* BET AMOUNT SLIDER */}
      <div>
        <div className="flex justify-between items-center mb-1">
          <label className="text-xs text-gray-400">Bet Amount</label>
          <span className="font-mono text-sm">{betAmount.toFixed(2)} ICP</span>
        </div>
        <input
          type="range"
          min="0.01"
          max="1"
          step="0.01"
          value={betAmount}
          onChange={(e) => setBetAmount(parseFloat(e.target.value))}
          className="w-full slider-turquoise"
          disabled={isPlaying}
        />
      </div>

      {/* TARGET NUMBER SLIDER */}
      <div>
        <div className="flex justify-between items-center mb-1">
          <label className="text-xs text-gray-400">Target Number</label>
          <span className="font-mono text-sm">{targetNumber}</span>
        </div>
        <input
          type="range"
          min="1"
          max="99"
          value={targetNumber}
          onChange={(e) => setTargetNumber(parseInt(e.target.value))}
          className="w-full slider-turquoise"
          disabled={isPlaying}
        />
      </div>

      {/* DIRECTION TOGGLE - Compact */}
      <div className="flex gap-1">
        <button
          onClick={() => setDirection('Over')}
          disabled={isPlaying}
          className={`flex-1 py-2 text-xs font-mono font-bold border transition ${
            direction === 'Over'
              ? 'bg-green-600 border-green-600 text-white'
              : 'bg-transparent border-gray-600 text-gray-400'
          }`}
        >
          OVER {targetNumber}
        </button>
        <button
          onClick={() => setDirection('Under')}
          disabled={isPlaying}
          className={`flex-1 py-2 text-xs font-mono font-bold border transition ${
            direction === 'Under'
              ? 'bg-red-600 border-red-600 text-white'
              : 'bg-transparent border-gray-600 text-gray-400'
          }`}
        >
          UNDER {targetNumber}
        </button>
      </div>

      {/* ROLL BUTTON */}
      <button
        onClick={rollDice}
        disabled={!actor || isPlaying}
        className="w-full py-3 bg-dfinity-turquoise hover:bg-dfinity-turquoise/80
                   text-black font-bold rounded transition disabled:opacity-50"
      >
        {isPlaying ? '🎲 Rolling...' : '🎲 ROLL DICE'}
      </button>
    </div>

    {/* RIGHT COLUMN: Live Stats & Animation */}
    <div className="space-y-3">

      {/* INLINE STATS - Always visible */}
      <div className="bg-gray-900/50 rounded p-3">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <div className="text-gray-500 text-xs">Win Chance</div>
            <div className="font-mono text-yellow-400">{winChance.toFixed(2)}%</div>
          </div>
          <div>
            <div className="text-gray-500 text-xs">Multiplier</div>
            <div className="font-mono text-green-400">{multiplier.toFixed(2)}x</div>
          </div>
          <div>
            <div className="text-gray-500 text-xs">Potential Win</div>
            <div className="font-mono">{(betAmount * multiplier).toFixed(2)} ICP</div>
          </div>
          <div>
            <div className="text-gray-500 text-xs">House Edge</div>
            <div className="font-mono text-gray-400">3%</div>
          </div>
        </div>
      </div>

      {/* DICE ANIMATION - Smaller */}
      <div className="bg-gray-900/50 rounded p-3">
        <DiceAnimation
          targetNumber={animatingResult}
          isRolling={isPlaying}
          onAnimationComplete={handleAnimationComplete}
          size="small"  // Add size prop to animation component
        />

        {/* Result message inline */}
        {lastResult && !isPlaying && (
          <div className={`text-center mt-2 ${
            lastResult.is_win ? 'text-green-400' : 'text-red-400'
          }`}>
            <span className="text-lg font-bold">
              {lastResult.is_win ? '🎉 WIN' : '😢 LOSE'}
              {lastResult.is_win && ` +${(Number(lastResult.payout) / 100_000_000).toFixed(2)} ICP`}
            </span>
          </div>
        )}
      </div>

      {/* Error display */}
      {gameError && (
        <div className="text-red-400 text-xs">
          {gameError}
        </div>
      )}
    </div>
  </div>
</div>

{/* COMPACT HISTORY - Below main panel */}
<div className="mt-4 max-w-4xl mx-auto">
  <GameHistory
    items={history}
    maxDisplay={3}  // Reduce to 3 items
    title="Recent Rolls"
    renderCustom={renderHistoryItem}
    compact={true}  // Add compact mode
  />
</div>
```

### 3. Update DiceAnimation for Size Prop: `DiceAnimation.tsx` (MODIFY)
```typescript
// PSEUDOCODE - Add size prop support
interface DiceAnimationProps {
  targetNumber: number | null;
  isRolling: boolean;
  onAnimationComplete: () => void;
  size?: 'small' | 'medium' | 'large';  // NEW PROP
}

export const DiceAnimation: React.FC<DiceAnimationProps> = ({
  targetNumber,
  isRolling,
  onAnimationComplete,
  size = 'medium'  // Default to medium
}) => {
  // Calculate dimensions based on size
  const dimensions = {
    small: 'w-16 h-16',
    medium: 'w-24 h-24',
    large: 'w-32 h-32'
  };

  const fontSize = {
    small: 'text-xl',
    medium: 'text-3xl',
    large: 'text-4xl'
  };

  return (
    <div className={`${dimensions[size]} ${fontSize[size]} ...`}>
      {/* Existing animation logic with adjusted sizes */}
    </div>
  );
};
```

### 4. Update GameHistory for Compact Mode: `GameHistory.tsx` (MODIFY)
```typescript
// PSEUDOCODE - Add compact prop
interface GameHistoryProps {
  // ... existing props
  compact?: boolean;  // NEW PROP
}

export const GameHistory = ({ compact = false, ... }) => {
  return (
    <div className={compact ? 'p-2' : 'p-4'}>
      <h3 className={compact ? 'text-sm mb-2' : 'text-lg mb-4'}>
        {title}
      </h3>
      {/* Display items in horizontal row if compact, vertical list otherwise */}
      <div className={compact ? 'flex gap-2 overflow-x-auto' : 'space-y-2'}>
        {items.slice(0, maxDisplay).map((item) => (
          <div className={compact ? 'flex-shrink-0 px-2 py-1 bg-gray-800 rounded text-xs' : 'existing-style'}>
            {renderCustom(item)}
          </div>
        ))}
      </div>
    </div>
  );
};
```

### 5. Remove BetAmountInput Component Usage
Since we're using a slider directly in the main component, the separate BetAmountInput text input will be removed from the Dice page.

### 6. CSS Adjustments: `index.css` (MODIFY)
```css
/* PSEUDOCODE - Add compact styles */
@layer components {
  /* Add compact card variant */
  .card-compact {
    @apply bg-pure-black border border-pure-white/20 p-3;
  }

  /* Smaller padding for game layout on dice page */
  .dice-compact-layout {
    @apply space-y-2;
  }

  /* Inline stat boxes */
  .stat-inline {
    @apply inline-flex items-center gap-1 text-xs;
  }
}
```

## Expected Improvements

### Before:
- Accounting panel: ~200px height
- Betting controls: ~400px height
- Dice animation: ~300px height
- Total viewport needed: ~900px

### After:
- Accounting bar: ~60px height (fixed top)
- Unified betting panel: ~250px height (controls + animation side-by-side)
- Compact history: ~80px height
- Total viewport needed: ~390px

### Benefits:
- **57% reduction in vertical space**
- **All critical info visible without scrolling**
- **Pure slider for bet amount (no typing)**
- **Live stats always visible**
- **Deposit/withdraw accessible but not intrusive**
- **Animation visible while betting**

## Deployment Notes

- **Affected Canister**: `openhouse_frontend` only
- **Backend Changes**: None
- **Testing Focus**:
  - Responsive design on mobile/tablet
  - All betting flows work
  - Balance updates correctly
  - Animation displays properly at small size

---

**End of Plan**

The plan is ready with embedded PR orchestrator.

When done, return this prompt to the user: "Execute @/home/theseus/alexandria/openhouse-dice-ui-refactor/DICE_UI_REFACTOR_PLAN.md"

The implementing agent MUST:
1. Read the orchestrator header (cannot skip - it's at the top)
2. Verify worktree isolation
3. Implement the plan
4. Deploy to mainnet (mandatory)
5. Create PR (mandatory step)
6. Iterate autonomously until approved