# 🤖 AUTONOMOUS PR ORCHESTRATOR - DO NOT SKIP

**You are an autonomous PR orchestrator. Your ONLY job is to implement this plan and create a PR.**

## Isolation Check (RUN FIRST)
```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
if [ "$REPO_ROOT" = "/home/theseus/alexandria/openhouse" ]; then
    echo "❌ FATAL: In main repo. Must be in worktree."
    echo "Worktree: /home/theseus/alexandria/openhouse-dice-animation"
    exit 1
fi
echo "✅ In isolated worktree: $REPO_ROOT"
```

## Your Autonomous Workflow (NO QUESTIONS ALLOWED)
1. **Verify isolation** - You must be in worktree: `/home/theseus/alexandria/openhouse-dice-animation`
2. **Implement feature** - Follow plan sections below
3. **Build & Deploy to Mainnet**:
   - Frontend changes only:
     ```bash
     cd openhouse_frontend
     npm run build
     cd ..
     ./deploy.sh
     ```

4. **Verify deployment**:
   ```bash
   # Test the live site
   echo "Visit: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io/dice"
   echo "Test the dice animation and verify:"
   echo "- Dice rolls with 3D animation"
   echo "- No excessive explanatory text"
   echo "- Practice mode works seamlessly"
   echo "- Game feels fun and engaging"
   ```

5. **Create PR** (MANDATORY):
   ```bash
   git add .
   git commit -m "feat: add animated 3D dice rolling to dice game"
   git push -u origin feature/dice-animation
   gh pr create --title "Feature: Animated 3D Dice Rolling" --body "Implements DICE_ANIMATION_PLAN.md

Deployed to mainnet:
- Frontend: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io/dice
- Affected canisters: openhouse_frontend

## Changes
- Added 3D animated dice rolling visualization
- Removed excessive explanatory text and math details
- Streamlined practice mode UI (less obtrusive)
- Made the game feel more engaging and game-like
- Preserved all functionality while improving UX

## Testing
Manual testing on mainnet at /dice route."
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

**Branch:** `feature/dice-animation`
**Worktree:** `/home/theseus/alexandria/openhouse-dice-animation`

---

# Implementation Plan

## Current State Analysis

### File Structure
```
openhouse_frontend/
├── src/
│   └── pages/
│       └── Dice.tsx          (MODIFY - main dice game component)
```

### Current Issues (Lines from Dice.tsx)

1. **Line 170-180**: Header section is too explanatory
   - Shows "🎲 Dice Game" with subtitle "Roll over or under your target number!"
   - This is obvious and unnecessary

2. **Line 210-286**: Practice Mode Info card is too verbose
   - Long explanation about virtual ICP (lines 267-286)
   - Takes up significant screen space
   - Distracts from the game

3. **Line 289-426**: Betting controls section shows too many mathematical details
   - Win Chance percentage (lines 376-381)
   - Multiplier display (lines 383-389)
   - Potential Win calculation (lines 391-397)
   - Makes it feel like a spreadsheet, not a game

4. **Line 428-462**: Result display is just a number
   - Shows rolled number as text: `{lastResult.rolled_number}` (line 438)
   - No visual dice representation
   - No rolling animation
   - Very anti-climactic

5. **Line 217-263**: Backend connection status is developer-focused
   - Not user-friendly
   - Should be hidden or minimized

### What Users Want
- Visual, animated dice rolling (like real casino dice)
- Less text, more action
- Practice mode that doesn't feel like a tutorial
- Instant gratification from seeing dice tumble and land
- Fun, engaging experience

## Implementation Plan (Pseudocode)

### Part 1: Create DiceAnimation Component

**NEW FILE: `openhouse_frontend/src/components/DiceAnimation.tsx`**

```typescript
// PSEUDOCODE
import React, { useEffect, useState } from 'react';

interface DiceAnimationProps {
  targetNumber: number | null;
  isRolling: boolean;
  onAnimationComplete?: () => void;
}

export const DiceAnimation: React.FC<DiceAnimationProps> = ({
  targetNumber,
  isRolling,
  onAnimationComplete
}) => {
  // State for current displayed number during animation
  const [displayNumber, setDisplayNumber] = useState(0);
  const [animationPhase, setAnimationPhase] = useState<'idle' | 'rolling' | 'complete'>('idle');

  useEffect(() => {
    if (isRolling) {
      // Start rolling animation
      setAnimationPhase('rolling');

      // Rapidly cycle through random numbers for ~2 seconds
      let frameCount = 0;
      const maxFrames = 60; // 2 seconds at 30fps

      const interval = setInterval(() => {
        // Generate random number 0-100 for visual effect
        setDisplayNumber(Math.floor(Math.random() * 101));
        frameCount++;

        if (frameCount >= maxFrames) {
          clearInterval(interval);
        }
      }, 33); // ~30fps

      return () => clearInterval(interval);
    }
  }, [isRolling]);

  useEffect(() => {
    if (targetNumber !== null && animationPhase === 'rolling') {
      // After backend returns result, slow down and land on target
      setTimeout(() => {
        setDisplayNumber(targetNumber);
        setAnimationPhase('complete');
        onAnimationComplete?.();
      }, 2100); // Slightly after rolling animation ends
    }
  }, [targetNumber, animationPhase, onAnimationComplete]);

  // Reset when not rolling
  useEffect(() => {
    if (!isRolling && animationPhase === 'complete') {
      setTimeout(() => {
        setAnimationPhase('idle');
      }, 2000); // Keep result visible for 2s
    }
  }, [isRolling, animationPhase]);

  return (
    <div className="dice-container">
      {/* 3D Dice Visualization */}
      <div className={`dice-cube ${animationPhase === 'rolling' ? 'rolling-animation' : ''}`}>
        {/* Main dice display */}
        <div className="dice-face">
          <span className="dice-number">{displayNumber}</span>
        </div>

        {/* Visual effects during roll */}
        {animationPhase === 'rolling' && (
          <div className="rolling-effects">
            {/* Blur, rotation, scaling effects */}
          </div>
        )}
      </div>

      {/* Result indicator when complete */}
      {animationPhase === 'complete' && targetNumber !== null && (
        <div className="result-glow">
          {/* Glow effect around final number */}
        </div>
      )}
    </div>
  );
};
```

**NEW FILE: `openhouse_frontend/src/components/DiceAnimation.css`**

```css
/* PSEUDOCODE - CSS for 3D dice animation */

.dice-container {
  /* Center the dice */
  display: flex;
  justify-content: center;
  align-items: center;
  height: 300px;
  perspective: 1000px; /* Enable 3D transforms */
}

.dice-cube {
  /* Style the dice as a 3D cube */
  width: 150px;
  height: 150px;
  position: relative;
  transform-style: preserve-3d;
  transition: transform 0.1s ease-out;
}

.dice-cube.rolling-animation {
  /* Rapid rotation during roll */
  animation: dice-roll 2s cubic-bezier(0.68, -0.55, 0.265, 1.55);
}

@keyframes dice-roll {
  0% {
    transform: rotateX(0deg) rotateY(0deg) rotateZ(0deg);
  }
  100% {
    transform: rotateX(720deg) rotateY(720deg) rotateZ(360deg);
  }
}

.dice-face {
  /* Front face of dice showing the number */
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 20px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
}

.dice-number {
  /* The number on the dice */
  font-size: 4rem;
  font-weight: bold;
  color: white;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
}

.rolling-effects {
  /* Motion blur and effects during roll */
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  filter: blur(3px);
  opacity: 0.7;
}

.result-glow {
  /* Glow effect when dice lands on result */
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 200px;
  height: 200px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(102, 126, 234, 0.4) 0%, transparent 70%);
  animation: pulse-glow 1.5s ease-in-out infinite;
}

@keyframes pulse-glow {
  0%, 100% {
    opacity: 0.4;
    transform: translate(-50%, -50%) scale(1);
  }
  50% {
    opacity: 0.8;
    transform: translate(-50%, -50%) scale(1.1);
  }
}
```

### Part 2: Simplify Dice.tsx

**MODIFY: `openhouse_frontend/src/pages/Dice.tsx`**

Changes to make:

1. **Remove/Simplify Header (lines 168-215)**
```typescript
// PSEUDOCODE - Replace verbose header

// OLD (DELETE):
<div className="text-center">
  <div className="text-6xl mb-4">🎲</div>
  <div className="flex items-center justify-center gap-3 mb-2">
    <h1 className="text-4xl font-bold">Dice Game</h1>
    {isPracticeMode && (<span>PRACTICE MODE</span>)}
  </div>
  <p className="text-gray-400">Roll over or under your target number!</p>
  {/* Mode toggle buttons */}
  {/* Practice mode explanation */}
</div>

// NEW (REPLACE WITH):
<div className="text-center">
  <h1 className="text-3xl font-bold mb-4">🎲 Dice</h1>

  {/* Simplified mode toggle - just icons */}
  <div className="flex items-center justify-center gap-2">
    <button
      onClick={() => handleModeToggle('practice')}
      className={`px-4 py-2 rounded-lg transition ${
        mode === 'practice' ? 'bg-yellow-600' : 'bg-gray-700'
      }`}
      title="Practice Mode"
    >
      🎮
    </button>
    <button
      onClick={() => handleModeToggle('real')}
      disabled={!isAuthenticated}
      className={`px-4 py-2 rounded-lg transition ${
        mode === 'real' && isAuthenticated ? 'bg-green-600' : 'bg-gray-700'
      }`}
      title={!isAuthenticated ? 'Login for Real Mode' : 'Real Mode'}
    >
      💰
    </button>
  </div>
</div>
```

2. **Hide/Minimize Backend Connection Status (lines 217-263)**
```typescript
// PSEUDOCODE - Make connection status minimal

// OLD (DELETE entire card)

// NEW (REPLACE WITH):
{error && (
  <div className="text-center text-red-400 text-sm">
    ⚠️ Connection issue - please refresh
  </div>
)}
```

3. **Remove Practice Mode Info Card (lines 265-287)**
```typescript
// PSEUDOCODE - Delete the entire verbose practice mode explanation card

// DELETE lines 265-287 entirely
```

4. **Simplify Betting Controls (lines 289-426)**
```typescript
// PSEUDOCODE - Remove mathematical details, keep only essential controls

// OLD (DELETE the entire right column showing odds/multiplier/potential win)

// NEW (REPLACE WITH):
<div className="card max-w-2xl mx-auto">
  {/* Bet Amount */}
  <div className="mb-4">
    <label className="block text-sm text-gray-400 mb-2">
      Bet {isPracticeMode ? '(Practice)' : ''}
    </label>
    <input
      type="number"
      min="0.1"
      max="100"
      step="0.1"
      value={betAmount}
      onChange={(e) => setBetAmount(parseFloat(e.target.value) || 0)}
      className="w-full bg-casino-primary border border-casino-accent rounded px-4 py-3 text-lg"
      disabled={isRolling}
    />
  </div>

  {/* Target Number - simplified to just number input or buttons */}
  <div className="mb-4">
    <label className="block text-sm text-gray-400 mb-2">
      Target: {targetNumber}
    </label>
    <input
      type="range"
      min="1"
      max="99"
      value={targetNumber}
      onChange={(e) => setTargetNumber(parseInt(e.target.value))}
      className="w-full"
      disabled={isRolling}
    />
  </div>

  {/* Direction - Over/Under */}
  <div className="mb-6">
    <div className="flex gap-2">
      <button
        onClick={() => setDirection('Over')}
        disabled={isRolling}
        className={`flex-1 py-3 rounded font-bold transition ${
          direction === 'Over' ? 'bg-green-600' : 'bg-gray-700'
        }`}
      >
        OVER {targetNumber}
      </button>
      <button
        onClick={() => setDirection('Under')}
        disabled={isRolling}
        className={`flex-1 py-3 rounded font-bold transition ${
          direction === 'Under' ? 'bg-red-600' : 'bg-gray-700'
        }`}
      >
        UNDER {targetNumber}
      </button>
    </div>
  </div>

  {/* Roll Button */}
  <button
    onClick={rollDice}
    disabled={isRolling || !actor}
    className="w-full bg-casino-highlight hover:bg-casino-highlight/80 disabled:bg-gray-700 text-white font-bold py-4 rounded-lg text-xl"
  >
    {isRolling ? '🎲 Rolling...' : '🎲 ROLL'}
  </button>

  {gameError && (
    <div className="mt-4 text-red-400 text-sm text-center">
      {gameError}
    </div>
  )}
</div>
```

5. **Replace Result Display with Dice Animation (lines 428-462)**
```typescript
// PSEUDOCODE - Replace static number with animated dice

// Import the new DiceAnimation component at top
import { DiceAnimation } from '../components/DiceAnimation';

// Add state to manage animation
const [animatingResult, setAnimatingResult] = useState<number | null>(null);

// Modify rollDice function to trigger animation
const rollDice = async () => {
  // ... existing validation ...

  setIsRolling(true);
  setGameError('');
  setLastResult(null);
  setAnimatingResult(null); // Reset animation

  try {
    // ... existing API call ...

    if ('Ok' in result) {
      // Trigger animation with the result
      setAnimatingResult(result.Ok.rolled_number);

      // Set result after brief delay for animation
      setTimeout(() => {
        setLastResult(result.Ok);
        setGameHistory(prev => [{...result.Ok, clientId: crypto.randomUUID()}, ...prev.slice(0, 9)]);
      }, 2200);
    } else {
      setGameError(result.Err);
      setIsRolling(false);
    }
  } catch (err) {
    // ... existing error handling ...
    setIsRolling(false);
  }
};

// OLD (DELETE lines 428-462 - the static result display)

// NEW (REPLACE WITH):
{/* Dice Animation - Always visible, shows rolling state */}
<div className="card max-w-2xl mx-auto">
  <DiceAnimation
    targetNumber={animatingResult}
    isRolling={isRolling}
    onAnimationComplete={() => setIsRolling(false)}
  />

  {/* Show win/loss message below dice after animation */}
  {lastResult && !isRolling && (
    <div className={`text-center mt-6 ${
      lastResult.is_win ? 'text-green-400' : 'text-red-400'
    }`}>
      <div className="text-3xl font-bold mb-2">
        {lastResult.is_win ? '🎉 WIN!' : '😢 LOSE'}
      </div>
      {lastResult.is_win && (
        <div className="text-xl">
          +{(Number(lastResult.payout) / 100_000_000).toFixed(2)} ICP
        </div>
      )}
    </div>
  )}
</div>
```

6. **Simplify Game History (lines 464-511)**
```typescript
// PSEUDOCODE - Keep history but make it more compact

// Replace the detailed table with a simpler list view
// Show just: Roll number, Direction arrow, Result (win/loss icon)
// Remove detailed columns for bet amount, target, etc.

<div className="card max-w-2xl mx-auto">
  <h3 className="text-sm font-bold mb-3 text-gray-400">Recent Rolls</h3>

  <div className="space-y-1">
    {gameHistory.slice(0, 5).map((game) => (
      <div key={game.clientId} className="flex items-center justify-between text-sm py-2 border-b border-gray-800">
        <span className="font-mono">{game.rolled_number}</span>
        <span className={game.is_win ? 'text-green-400' : 'text-red-400'}>
          {game.is_win ? '✓' : '✗'}
        </span>
      </div>
    ))}
  </div>
</div>
```

7. **Remove or Minimize Game Information Card (lines 513-538)**
```typescript
// PSEUDOCODE - Either delete entirely or collapse to single line

// DELETE lines 513-538 (entire Game Information card)
// OR replace with minimal info:

<div className="text-center text-xs text-gray-500 mt-6">
  Min: 1 ICP • Max Win: 100x • House Edge: 3%
</div>
```

### Part 3: Import and Configure Dice Animation CSS

**MODIFY: `openhouse_frontend/src/pages/Dice.tsx`**

```typescript
// PSEUDOCODE - Add CSS import at top of file

// Add to imports section:
import '../components/DiceAnimation.css';
```

### Part 4: Update Package Dependencies (if needed)

**CHECK: `openhouse_frontend/package.json`**

```bash
# PSEUDOCODE - Ensure React and animation libraries are available

# Most likely no new dependencies needed since we're using:
# - CSS animations (built-in)
# - React hooks (already available)
# - Standard DOM APIs

# If smooth animations need optimization, MAY add:
# npm install framer-motion
# (But try CSS-only approach first)
```

## Testing Strategy

Since this is mainnet-only deployment, manual testing checklist:

### Manual Testing Checklist

1. **Visual Verification** (after deployment)
   - Visit https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io/dice
   - Verify dice animation appears
   - Verify 3D rotation effect works
   - Verify number cycling during roll

2. **Interaction Testing**
   - Click "🎲 ROLL" button
   - Verify dice starts spinning
   - Verify backend returns result
   - Verify dice lands on correct number
   - Verify win/loss message appears

3. **Practice Mode**
   - Verify practice mode toggle works
   - Verify can play without login
   - Verify results appear correctly

4. **Real Mode** (if authenticated)
   - Switch to real mode
   - Verify can place real bet
   - Verify ICP transaction works

5. **Responsive Design**
   - Test on mobile viewport
   - Test on tablet viewport
   - Test on desktop viewport

6. **Edge Cases**
   - Rapid clicking roll button
   - Changing bet during roll
   - Network error handling

## Deployment Notes

### Affected Components
- **Frontend Canister**: `pezw3-laaaa-aaaal-qssoa-cai`
- **Route**: `/dice`
- **Backend**: No changes (dice_backend unchanged)

### Build Commands
```bash
cd openhouse_frontend
npm run build
cd ..
./deploy.sh --frontend-only
```

### Rollback Plan
If issues occur:
```bash
git revert HEAD
cd openhouse_frontend && npm run build && cd ..
./deploy.sh --frontend-only
```

## Success Criteria

✅ Dice game shows 3D animated rolling dice
✅ No excessive explanatory text ("Roll over or under...")
✅ Practice mode works but is less obtrusive
✅ Game feels engaging and fun
✅ All core functionality preserved (betting, results, history)
✅ Responsive on all screen sizes
✅ No console errors
✅ Fast performance (animations smooth at 30fps+)

## File Summary

**Files to Modify:**
- `openhouse_frontend/src/pages/Dice.tsx` - Simplify UI, integrate animation

**Files to Create:**
- `openhouse_frontend/src/components/DiceAnimation.tsx` - New dice animation component
- `openhouse_frontend/src/components/DiceAnimation.css` - Animation styles

**Files Unchanged:**
- `dice_backend/**` - No backend changes needed
- All other game files

## Estimated Impact

- **LOC Changed**: ~200 lines removed, ~150 lines added
- **Net LOC**: -50 (simpler codebase)
- **User Experience**: Significantly improved
- **Performance**: Minimal impact (CSS animations are GPU-accelerated)
- **Maintenance**: Easier (less verbose code)
