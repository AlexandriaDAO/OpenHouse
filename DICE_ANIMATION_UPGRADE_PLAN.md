# 🤖 AUTONOMOUS PR ORCHESTRATOR - DO NOT SKIP

**You are an autonomous PR orchestrator. Your ONLY job is to implement this plan and create a PR.**

## Isolation Check (RUN FIRST)
```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
if [ "$REPO_ROOT" = "/home/theseus/alexandria/openhouse" ]; then
    echo "❌ FATAL: In main repo. Must be in worktree."
    echo "Worktree: /home/theseus/alexandria/openhouse-dice-anim"
    exit 1
fi
echo "✅ In isolated worktree: $REPO_ROOT"
```

## Your Autonomous Workflow (NO QUESTIONS ALLOWED)
1. **Verify isolation** - You must be in worktree: `/home/theseus/alexandria/openhouse-dice-anim`
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
   # Check canister status
   dfx canister --network ic status openhouse_frontend

   # Test the live site
   echo "Visit: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io"
   ```

5. **Create PR** (MANDATORY):
   ```bash
   git add .
   git commit -m "feat(dice): upgrade 3D dice animation visual quality"
   git push -u origin feature/dice-animation-upgrade
   gh pr create --title "feat(dice): Upgrade 3D Dice Animation" --body "Implements DICE_ANIMATION_UPGRADE_PLAN.md

   Deployed to mainnet:
   - Frontend: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io
   - Upgraded visual styling for 3D dice cube
   - Added smoother rolling and landing animations"
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

**Branch:** `feature/dice-animation-upgrade`
**Worktree:** `/home/theseus/alexandria/openhouse-dice-anim`

---

# Implementation Plan

## 1. Current State
- **File**: `openhouse_frontend/src/components/game-specific/dice/DiceAnimation.tsx`
- **File**: `openhouse_frontend/src/components/game-specific/dice/DiceAnimation.css`
- **Behavior**: Basic 3D cube with number swapping.
- **Goal**: Create a polished, "casino-grade" 3D animation with better physics simulation (via CSS) and visual styling.

## 2. Implementation Steps

### A. Enhance CSS (`openhouse_frontend/src/components/game-specific/dice/DiceAnimation.css`)
- **Colors**: Use neon cyan/turquoise accents matching DFINITY branding.
- **Animation**: 
  - `tumble`: Complex 3D rotation (X, Y, Z axes) for "rolling" state.
  - `land`: A scale/bounce effect when the dice stops.
  - `glow`: Pulse effect for winning rolls.
- **Structure**: Ensure `.dice-cube` preserves 3d and faces are positioned correctly.

### B. Update Component (`openhouse_frontend/src/components/game-specific/dice/DiceAnimation.tsx`)
- **Logic**:
  - `rolling` state: Triggers the `tumble` animation loop.
  - `complete` state: Removes tumble, snaps to identity rotation (0,0,0), and triggers `land` animation.
  - Display the target number on the **Front** face immediately upon completion so the user sees the result clearly.
- **Refinement**:
  - Keep the "random number shuffling" on faces during the roll for added visual noise/excitement.

## 3. Pseudocode

### `DiceAnimation.css`
```css
/* PSEUDOCODE - CSS */
.dice-container {
  perspective: 1000px;
  height: 200px; /* Ensure enough space */
  display: flex;
  justify-content: center;
  align-items: center;
}

.dice-cube {
  width: 100px;
  height: 100px;
  position: relative;
  transform-style: preserve-3d;
  transition: transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

/* Random tumbling */
.rolling-animation {
  animation: tumble 0.8s infinite linear;
}

@keyframes tumble {
  0% { transform: rotateX(0) rotateY(0) rotateZ(0); }
  25% { transform: rotateX(90deg) rotateY(180deg) rotateZ(45deg); }
  50% { transform: rotateX(180deg) rotateY(360deg) rotateZ(90deg); }
  75% { transform: rotateX(270deg) rotateY(540deg) rotateZ(135deg); }
  100% { transform: rotateX(360deg) rotateY(720deg) rotateZ(180deg); }
}

/* Landing pop */
.landing-animation {
  animation: land 0.4s ease-out forwards;
}

@keyframes land {
  0% { transform: scale(0.8); }
  50% { transform: scale(1.1); }
  100% { transform: scale(1); }
}

.dice-face {
  position: absolute;
  width: 100px;
  height: 100px;
  background: rgba(20, 20, 30, 0.95); /* Dark background */
  border: 2px solid #00d1ff; /* Cyan border */
  box-shadow: 0 0 15px rgba(0, 209, 255, 0.2);
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 40px;
  font-weight: bold;
  color: #fff;
  backface-visibility: hidden; /* Or visible if we want transparency */
}

/* Face positions */
.dice-face-front  { transform: rotateY(0deg) translateZ(50px); }
.dice-face-back   { transform: rotateY(180deg) translateZ(50px); }
.dice-face-right  { transform: rotateY(90deg) translateZ(50px); }
.dice-face-left   { transform: rotateY(-90deg) translateZ(50px); }
.dice-face-top    { transform: rotateX(90deg) translateZ(50px); }
.dice-face-bottom { transform: rotateX(-90deg) translateZ(50px); }
```

### `DiceAnimation.tsx`
```tsx
// PSEUDOCODE
// Imports...

export const DiceAnimation: React.FC<DiceAnimationProps> = ({
  targetNumber,
  isRolling,
  onAnimationComplete
}) => {
  const [animationPhase, setAnimationPhase] = useState('idle');
  const [displayNumber, setDisplayNumber] = useState(0); // Front face number
  
  // Rolling effect: shuffle numbers purely for visual noise
  useEffect(() => {
    if (isRolling) {
      setAnimationPhase('rolling');
      const interval = setInterval(() => {
         setDisplayNumber(Math.floor(Math.random() * 101));
      }, 50);
      return () => clearInterval(interval);
    }
  }, [isRolling]);

  // Stopping effect
  useEffect(() => {
    if (targetNumber !== null && isRolling) {
      // Wait a tiny bit if needed, then snap
      setTimeout(() => {
         setAnimationPhase('complete');
         setDisplayNumber(targetNumber); // Force result to front
         onAnimationComplete?.();
      }, 500);
    }
  }, [targetNumber, isRolling]);

  return (
    <div className="dice-container">
      <div className={`dice-cube ${animationPhase === 'rolling' ? 'rolling-animation' : ''} ${animationPhase === 'complete' ? 'landing-animation' : ''}`}>
         <div className="dice-face dice-face-front">
            <DiceDots number={displayNumber} />
         </div>
         {/* Other faces can just show random/placeholder numbers or opposite faces */}
         <div className="dice-face dice-face-back">
            <DiceDots number={(displayNumber + 50) % 100} />
         </div>
         {/* ... other faces ... */}
      </div>
    </div>
  );
}
```
