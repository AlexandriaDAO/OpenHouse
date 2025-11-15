# 🤖 AUTONOMOUS PR ORCHESTRATOR - DO NOT SKIP

**You are an autonomous PR orchestrator. Your ONLY job is to implement this plan and create a PR.**

## Isolation Check (RUN FIRST)
```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
if [ "$REPO_ROOT" = "/home/theseus/alexandria/openhouse" ]; then
    echo "❌ FATAL: In main repo. Must be in worktree."
    echo "Worktree: /home/theseus/alexandria/openhouse-dice-frontend-simplify"
    exit 1
fi
echo "✅ In isolated worktree: $REPO_ROOT"
```

## Your Autonomous Workflow (NO QUESTIONS ALLOWED)
1. **Verify isolation** - You must be in worktree: `/home/theseus/alexandria/openhouse-dice-frontend-simplify`
2. **Implement feature** - Follow plan sections below
3. **Build & Deploy to Mainnet**:
   - Frontend changes:
     ```bash
     cd openhouse_frontend
     npm run build
     cd ..
     ./deploy.sh --frontend-only
     ```

4. **Verify deployment**:
   ```bash
   # Test the live site
   echo "Visit: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io/dice"
   ```

5. **Create PR** (MANDATORY):
   ```bash
   git add .
   git commit -m "feat(dice): update frontend to reflect simplified 0.99% house edge model"
   git push -u origin feature/dice-frontend-simplified-odds
   gh pr create --title "Update Dice Frontend for Simplified Odds Model" --body "Updates the dice game frontend to reflect the simplified odds model from PR #25.

Deployed to mainnet:
- Frontend: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io/dice
- Affected canisters: Frontend (pezw3-laaaa-aaaal-qssoa-cai)

## Changes
- Updated house edge display from 3% to 0.99%
- Corrected min bet from 1 ICP to 0.01 ICP
- Corrected max win from 100x to 10 ICP
- Added UI explanation for exact hit = house wins mechanic
- Enhanced win/loss messaging to show exact hits
- Added informational tooltips about the simplified odds model"
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

**Branch:** `feature/dice-frontend-simplified-odds`
**Worktree:** `/home/theseus/alexandria/openhouse-dice-frontend-simplify`

---

# Implementation Plan: Dice Frontend Simplified Odds

## Task Classification
**REFACTORING**: Update existing frontend to match simplified backend model (0.99% house edge)

## Context: PR #25 Backend Changes

The backend was simplified in PR #25 with these key changes:

1. **Simplified House Edge**: Changed from complex 3% model to 0.99% implicit edge
2. **Exact Hit = House Wins**: When roll == target number, house always wins
3. **Clean Multipliers**: Formula `100 / winning_numbers` produces: 2x, 4x, 5x, 10x, 20x, 50x, 100x
4. **New Field**: `is_house_hit: bool` tracks when exact hit occurs
5. **Updated Constants**:
   - MIN_BET: 0.01 ICP (was displayed as 1 ICP in frontend)
   - MAX_WIN: 10 ICP (was displayed as 100x in frontend)
   - House edge: 0.99% (was displayed as 3% in frontend)

## Current State Documentation

### Files Requiring Changes

#### 1. `openhouse_frontend/src/pages/Dice.tsx`
**Lines 278-280** - Incorrect game metadata:
```typescript
<GameLayout
  title="Dice"
  icon="🎲"
  description="Roll the dice and predict over or under!"
  minBet={1}        // ❌ WRONG: Should be 0.01
  maxWin={100}      // ❌ WRONG: Should say "10 ICP" not "100x"
  houseEdge={3}     // ❌ WRONG: Should be 0.99
>
```

**Line 49** - `house_edge_actual` field exists but is unused (for future detailed history)

**Lines 336-349** - Win/loss message doesn't explain exact hits:
```typescript
{gameState.lastResult && !gameState.isPlaying && (
  <div className={`text-center mt-6 ${
    gameState.lastResult.is_win ? 'text-green-400' : 'text-red-400'
  }`}>
    <div className="text-3xl font-bold mb-2">
      {gameState.lastResult.is_win ? '🎉 WIN!' : '😢 LOSE'}
    </div>
    {gameState.lastResult.is_win && (
      <div className="text-xl">
        +{(Number(gameState.lastResult.payout) / 100_000_000).toFixed(2)} ICP
      </div>
    )}
  </div>
)}
```
Missing: No indication when loss is due to exact hit vs. wrong prediction

**Line 257** - Win chance display doesn't explain the exact hit mechanic:
```typescript
{ label: 'Win Chance', value: `${winChance.toFixed(2)}%`, highlight: true, color: 'yellow' },
```

**Line 19-32** - `DiceGameResult` interface matches backend (already has `is_house_hit` field support)

#### 2. `openhouse_frontend/src/components/game-specific/dice/DiceControls.tsx`
**Lines 1-67** - No changes needed, already correct

#### 3. `openhouse_frontend/src/components/game-ui/GameLayout.tsx`
**Line 36** - Displays house edge but format is fine, just needs correct value passed

#### 4. `openhouse_frontend/src/pages/Home.tsx`
**Line 42** - Dice game card shows incorrect metadata:
```typescript
{
  name: 'Dice',
  description: 'Roll and predict!',
  icon: '🎲',
  path: '/dice',
  minBet: 1,        // ❌ WRONG: Should be 0.01
  maxWin: 100,      // ❌ WRONG: Should be 10
  houseEdge: 3,     // ❌ WRONG: Should be 0.99
}
```

## Implementation Pseudocode

### 1. Update Game Metadata: `openhouse_frontend/src/pages/Dice.tsx`

```typescript
// PSEUDOCODE - Lines 273-281
<GameLayout
  title="Dice"
  icon="🎲"
  description="Roll 0-100, predict over or under. Exact hit = house wins!"  // Updated description
  minBet={0.01}     // FIXED: Correct min bet
  maxWin={10}       // FIXED: Changed to max win in ICP (note: GameLayout might need prop name change)
  houseEdge={0.99}  // FIXED: Simplified house edge
>
```

**Note**: Check if `GameLayout.tsx` `maxWin` prop should be renamed to `maxWinICP` or keep as is with updated value.

### 2. Enhance Win/Loss Messaging: `openhouse_frontend/src/pages/Dice.tsx`

```typescript
// PSEUDOCODE - Lines 336-360
{gameState.lastResult && !gameState.isPlaying && (
  <div className={`text-center mt-6 ${
    gameState.lastResult.is_win ? 'text-green-400' : 'text-red-400'
  }`}>
    <div className="text-3xl font-bold mb-2">
      {gameState.lastResult.is_win ? '🎉 WIN!' : '😢 LOSE'}
    </div>

    {/* NEW: Show exact hit message */}
    {!gameState.lastResult.is_win && gameState.lastResult.is_house_hit && (
      <div className="text-lg text-yellow-400 mb-2">
        🎯 Exact Hit! (House Wins)
      </div>
    )}

    {/* Show payout for wins */}
    {gameState.lastResult.is_win && (
      <div className="text-xl">
        +{(Number(gameState.lastResult.payout) / 100_000_000).toFixed(4)} ICP
      </div>
    )}

    {/* Show roll details */}
    <div className="text-sm text-gray-400 mt-2">
      Rolled: {gameState.lastResult.rolled_number} |
      Target: {gameState.lastResult.target_number} |
      Direction: {gameState.lastResult.direction.Over ? 'Over' : 'Under'}
    </div>
  </div>
)}
```

### 3. Add Informational Tooltip/Help Text: `openhouse_frontend/src/pages/Dice.tsx`

```typescript
// PSEUDOCODE - After GameStats component (around line 310)
<GameStats stats={stats} />

{/* NEW: Add help text explaining simplified odds */}
<div className="text-xs text-gray-400 text-center mt-2 p-2 bg-gray-800/50 rounded">
  💡 <strong>How it works:</strong> Choose a target number and direction.
  If you roll exactly on the target, the house wins (0.99% edge).
  Otherwise, standard over/under rules apply.
  Clean multipliers: {multiplier.toFixed(2)}x = 100 ÷ {direction === 'Over' ? (100 - targetNumber) : targetNumber} winning numbers.
</div>

<GameButton
  onClick={rollDice}
  ...
/>
```

### 4. Update Home Page Game Card: `openhouse_frontend/src/pages/Home.tsx`

```typescript
// PSEUDOCODE - Around line 38-48
{
  name: 'Dice',
  description: 'Roll 0-100, predict over/under!',  // Can keep concise or update
  icon: '🎲',
  path: '/dice',
  minBet: 0.01,      // FIXED
  maxWin: 10,        // FIXED: Now represents max win in ICP
  houseEdge: 0.99,   // FIXED
}
```

### 5. Update GameLayout Prop Documentation (Optional)

```typescript
// PSEUDOCODE - openhouse_frontend/src/components/game-ui/GameLayout.tsx
// Lines 8-10, 18-20, 36

interface GameLayoutProps {
  title: string;
  icon?: string;
  description?: string;
  children: ReactNode;
  minBet?: number;
  maxWin?: number;      // Could add comment: "Max win in ICP for dice, multiplier for others"
  houseEdge?: number;
}

export const GameLayout: React.FC<GameLayoutProps> = ({
  title,
  icon,
  description,
  children,
  minBet = 1,
  maxWin = 1000,
  houseEdge = 3,      // Default still 3 for other games
}) => {
  // ... existing code

  {/* Line 36 - update footer display logic */}
  <div className="text-center text-xs text-gray-500 mt-6">
    Min: {minBet} ICP • Max Win: {maxWin}{title === 'Dice' ? ' ICP' : 'x'} • House Edge: {houseEdge}%
  </div>
}
```

## Affected Files Summary

### Files to Modify:
1. ✏️ `openhouse_frontend/src/pages/Dice.tsx` (primary changes)
2. ✏️ `openhouse_frontend/src/pages/Home.tsx` (metadata update)
3. ✏️ `openhouse_frontend/src/components/game-ui/GameLayout.tsx` (optional display enhancement)

### Files Verified (No Changes):
- ✅ `openhouse_frontend/src/components/game-specific/dice/DiceControls.tsx`
- ✅ `openhouse_frontend/src/components/game-specific/dice/DiceAnimation.tsx`
- ✅ `openhouse_frontend/src/components/game-specific/dice/DiceAccountingPanel.tsx`
- ✅ Backend already updated in PR #25

## Testing on Mainnet

After deployment, manually verify on https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io/dice:

### Test Cases:
1. **Verify Metadata Display**:
   - Check footer shows: "Min: 0.01 ICP • Max Win: 10 ICP • House Edge: 0.99%"
   - Check home page game card shows correct values

2. **Test Exact Hit Mechanic**:
   - Set target to 50, direction to Over
   - Play multiple games until you hit exactly 50
   - Verify "🎯 Exact Hit! (House Wins)" message appears
   - Verify payout is 0

3. **Test Clean Multipliers**:
   - Target 50, Over: Should show 2.00x (100 / 50)
   - Target 50, Under: Should show 2.00x (100 / 50)
   - Target 10, Under: Should show 10.00x (100 / 10)
   - Target 90, Over: Should show 10.00x (100 / 10)
   - Target 20, Under: Should show 5.00x (100 / 20)

4. **Test Win Chance Display**:
   - Target 50, Over: 49.50% (50 winning numbers / 101 total)
   - Target 50, Under: 49.50% (50 winning numbers / 101 total)
   - Verify percentages are accurate

5. **Test Help Text**:
   - Verify informational tooltip displays correct formula
   - Verify it updates dynamically with target changes

## Deployment Strategy

```bash
# Build frontend
cd openhouse_frontend
npm run build
cd ..

# Deploy frontend only (dice backend unchanged)
./deploy.sh --frontend-only
```

## Success Criteria

- ✅ All displayed metadata matches backend constants
- ✅ Exact hit mechanic is clearly communicated to users
- ✅ Help text explains the simplified 0.99% house edge model
- ✅ Clean multipliers are displayed (whole numbers when applicable)
- ✅ No TypeScript errors
- ✅ Frontend builds successfully
- ✅ Live site reflects all changes correctly

## Complexity Reduction Achieved

**Before**: Complex 3% house edge calculation, unclear odds, incorrect metadata displayed

**After**:
- Simple 0.99% edge (1 in 101 outcomes)
- Clear "exact hit = house wins" messaging
- Accurate metadata (0.01 ICP min, 10 ICP max, 0.99% edge)
- Educational tooltips explaining the math
- Reduced user confusion about odds and multipliers
