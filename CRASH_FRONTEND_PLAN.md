# 🤖 AUTONOMOUS PR ORCHESTRATOR - DO NOT SKIP

**You are an autonomous PR orchestrator. Your ONLY job is to implement this plan and create a PR.**

## Isolation Check (RUN FIRST)
```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
if [ "$REPO_ROOT" = "/home/theseus/alexandria/openhouse" ]; then
    echo "❌ FATAL: In main repo. Must be in worktree."
    echo "Worktree: /home/theseus/alexandria/openhouse-crash-frontend"
    exit 1
fi
echo "✅ In isolated worktree: $REPO_ROOT"
```

## Your Autonomous Workflow (NO QUESTIONS ALLOWED)
1. **Verify isolation** - You must be in worktree: `/home/theseus/alexandria/openhouse-crash-frontend`
2. **Implement feature** - Follow plan sections below
3. **Build & Deploy to Mainnet**:
   ```bash
   # Build frontend
   cd openhouse_frontend
   npm run build
   cd ..

   # Deploy to mainnet
   ./deploy.sh --frontend-only
   ```

4. **Verify deployment**:
   ```bash
   # Test the live site
   echo "Visit: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io/crash"
   ```

5. **Create PR** (MANDATORY):
   ```bash
   git add .
   git commit -m "feat: implement crash game frontend with ICP rocket ship

Implements complete crash game UI with animated ICP-themed rocket ship,
real-time multiplier graph, and transparent odds display.

Features:
- Animated rocket ship launch and crash sequence
- Real-time multiplier graph with crash point visualization
- Auto cash-out functionality
- Probability calculator
- Recent games history
- Full integration with crash_backend canister
- Consistent with Dice/Plinko UI patterns

Deployed to mainnet:
- Frontend: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io/crash
- Backend canister: fws6k-tyaaa-aaaap-qqc7q-cai"

   git push -u origin feature/crash-frontend

   gh pr create --title "feat: Crash Game Frontend with ICP Rocket Ship" --body "Implements CRASH_FRONTEND_PLAN.md

## Summary
Complete crash game frontend implementation with ICP-themed rocket ship animation, real-time multiplier graph, and transparent mathematical odds display.

## Features Implemented
- 🚀 Animated ICP-themed rocket ship (launches and crashes)
- 📈 Real-time multiplier graph with crash point visualization
- 🎯 Auto cash-out functionality
- 🎲 Probability calculator showing win chances
- 📊 Recent games history display
- ✅ Full integration with crash_backend canister
- 🎨 Consistent UI/UX with existing Dice and Plinko games

## Technical Details
- Created crash-specific components in \`components/game-specific/crash/\`
  - CrashRocket: SVG-based ICP rocket with launch/crash animations
  - CrashGraph: Real-time multiplier visualization with Canvas API
  - CrashProbabilityTable: Transparent odds display
- Integrated with existing game-ui components (GameLayout, GameButton, GameStats)
- Uses DFINITY brand colors (turquoise #29ABE2, red #ED0047)
- Follows established patterns from Dice/Plinko implementations

## Testing on Mainnet
Deployed to: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io/crash
Backend canister: fws6k-tyaaa-aaaap-qqc7q-cai

## Design Philosophy
- Simple, clean interface focusing on transparency
- Mathematical formula prominently displayed
- ICP branding throughout (rocket ship, colors)
- Consistent with OpenHouse casino aesthetic"
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

**Branch:** `feature/crash-frontend`
**Worktree:** `/home/theseus/alexandria/openhouse-crash-frontend`

---

# Implementation Plan: Crash Game Frontend with ICP Rocket Ship

## 1. Current State

### Backend Status (COMPLETE)
- ✅ **Canister ID**: `fws6k-tyaaa-aaaap-qqc7q-cai`
- ✅ **API Methods**:
  - `simulate_crash() -> Result<CrashResult, String>` - Returns crash point + randomness hash
  - `get_crash_formula() -> String` - Returns "crash = 0.99 / (1.0 - random)"
  - `get_expected_value() -> f64` - Returns 0.99
  - `get_win_probability(target: f64) -> Result<f64, String>` - P(crash ≥ target)
  - `get_probability_table() -> Vec<(f64, f64)>` - Common probabilities

### Frontend Status (PLACEHOLDER)
**File**: `openhouse_frontend/src/pages/Crash.tsx` (140 lines)
- ✅ Basic layout with GameLayout wrapper
- ✅ Backend connection test (greet method)
- ❌ No game logic
- ❌ No rocket animation
- ❌ No multiplier graph
- ❌ No betting controls

### Existing Patterns to Follow
**From Dice.tsx**:
- GameLayout wrapper with title, icon, description
- BetAmountInput with slider variant
- GameButton with loading states
- GameStats for displaying odds
- GameHistory for recent results
- State management hooks (useGameState, useGameMode)

**From Plinko.tsx**:
- Custom game-specific components in `components/game-specific/plinko/`
- Canvas-based animations (PlinkoBoard)
- Transparent formula display
- Multi-step animations

### Color Scheme (DFINITY Brand)
```javascript
{
  turquoise: '#29ABE2',  // Primary - rocket trails, highlights
  purple: '#3B00B9',     // Secondary - UI accents
  green: '#00E19B',      // Success - wins
  red: '#ED0047',        // Danger - crashes, losses
  orange: '#F15A24',     // Hover states
}
```

## 2. Implementation Plan

### 2.1 Create Game-Specific Components

#### File: `openhouse_frontend/src/components/game-specific/crash/CrashRocket.tsx`
**Purpose**: Animated ICP-themed rocket ship

```typescript
// PSEUDOCODE
import React from 'react';

interface CrashRocketProps {
  isLaunching: boolean;           // True during countdown/launch
  currentMultiplier: number;      // Current multiplier (1.00 - 100.00)
  crashPoint: number | null;      // Where it crashed (null if still flying)
  onCrashComplete: () => void;    // Callback when crash animation finishes
}

export const CrashRocket: React.FC<CrashRocketProps> = ({
  isLaunching,
  currentMultiplier,
  crashPoint,
  onCrashComplete
}) => {
  // State
  const [rocketPosition, setRocketPosition] = useState(0); // 0-100 (vertical position)
  const [isExploding, setIsExploding] = useState(false);

  // Animation effect
  useEffect(() => {
    if (isLaunching && !crashPoint) {
      // Animate rocket rising based on currentMultiplier
      // Position = log scale based on multiplier
      const position = calculateRocketPosition(currentMultiplier);
      setRocketPosition(position);
    }

    if (crashPoint && currentMultiplier >= crashPoint) {
      // Trigger explosion
      setIsExploding(true);
      setTimeout(() => {
        setIsExploding(false);
        setRocketPosition(0);
        onCrashComplete();
      }, 1000);
    }
  }, [isLaunching, currentMultiplier, crashPoint]);

  return (
    <div className="relative h-96 bg-gradient-to-b from-pure-black to-dfinity-navy">
      {/* Stars background */}
      <div className="absolute inset-0">
        {generateStars(50).map(star => (
          <div key={star.id} className="star" style={star.style} />
        ))}
      </div>

      {/* Rocket SVG */}
      <div
        className="rocket-container"
        style={{
          transform: `translateY(${100 - rocketPosition}%)`,
          transition: isLaunching ? 'transform 0.1s linear' : 'none'
        }}
      >
        {/* ICP-themed rocket SVG */}
        <svg width="60" height="80" viewBox="0 0 60 80">
          {/* Rocket body - DFINITY turquoise */}
          <path d="M30,0 L45,60 L15,60 Z" fill="#29ABE2" />

          {/* Rocket fins - DFINITY purple */}
          <path d="M15,60 L5,80 L15,70 Z" fill="#3B00B9" />
          <path d="M45,60 L55,80 L45,70 Z" fill="#3B00B9" />

          {/* ICP logo on body */}
          <circle cx="30" cy="30" r="8" fill="#FFFFFF" />
          <text x="30" y="35" fontSize="10" textAnchor="middle" fill="#29ABE2">
            ICP
          </text>

          {/* Flames - animated */}
          {isLaunching && !isExploding && (
            <g className="flames animate-pulse">
              <path d="M20,70 L25,80 L30,75 L35,80 L40,70" fill="#F15A24" />
              <path d="M22,75 L27,82 L30,78 L33,82 L38,75" fill="#ED0047" />
            </g>
          )}
        </svg>

        {/* Smoke trail */}
        {isLaunching && !isExploding && (
          <div className="absolute top-full left-1/2 -translate-x-1/2">
            <div className="smoke-particle animate-smoke" />
          </div>
        )}

        {/* Explosion effect */}
        {isExploding && (
          <div className="explosion-container">
            <div className="explosion-circle bg-dfinity-red" />
            <div className="explosion-circle bg-dfinity-orange" />
            <div className="explosion-circle bg-pure-white" />
          </div>
        )}
      </div>

      {/* Multiplier display on rocket */}
      {isLaunching && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="text-4xl font-bold text-dfinity-turquoise">
            {currentMultiplier.toFixed(2)}x
          </div>
        </div>
      )}
    </div>
  );
};

// Helper: Calculate rocket position from multiplier (log scale)
function calculateRocketPosition(multiplier: number): number {
  // 1.00x = 0%, 10.00x = 50%, 100.00x = 100%
  const logMult = Math.log10(multiplier);
  const logMax = Math.log10(100);
  return Math.min((logMult / logMax) * 100, 100);
}

// Helper: Generate star field
function generateStars(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    style: {
      position: 'absolute',
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      width: '2px',
      height: '2px',
      backgroundColor: 'white',
      opacity: Math.random() * 0.7 + 0.3,
    }
  }));
}
```

#### File: `openhouse_frontend/src/components/game-specific/crash/CrashGraph.tsx`
**Purpose**: Real-time multiplier graph with crash visualization

```typescript
// PSEUDOCODE
import React, { useRef, useEffect } from 'react';

interface CrashGraphProps {
  isPlaying: boolean;
  currentMultiplier: number;
  crashPoint: number | null;
  history: Array<{ multiplier: number; timestamp: number }>;
}

export const CrashGraph: React.FC<CrashGraphProps> = ({
  isPlaying,
  currentMultiplier,
  crashPoint,
  history
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw grid lines
    drawGrid(ctx, canvas.width, canvas.height);

    // Draw multiplier curve
    if (isPlaying) {
      drawMultiplierCurve(ctx, history, currentMultiplier, canvas.width, canvas.height);
    }

    // Draw crash point
    if (crashPoint) {
      drawCrashPoint(ctx, crashPoint, canvas.width, canvas.height);
    }
  }, [isPlaying, currentMultiplier, crashPoint, history]);

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={800}
        height={400}
        className="w-full h-full border border-pure-white/20"
      />

      {/* Axes labels */}
      <div className="absolute bottom-0 left-0 text-xs text-pure-white/60">
        Time (s)
      </div>
      <div className="absolute top-0 left-0 text-xs text-pure-white/60 rotate-90 origin-top-left">
        Multiplier
      </div>
    </div>
  );
};

function drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 1;

  // Horizontal lines (multiplier levels)
  for (let i = 0; i <= 10; i++) {
    const y = height - (i * height / 10);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // Vertical lines (time)
  for (let i = 0; i <= 10; i++) {
    const x = i * width / 10;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
}

function drawMultiplierCurve(
  ctx: CanvasRenderingContext2D,
  history: Array<{ multiplier: number; timestamp: number }>,
  currentMult: number,
  width: number,
  height: number
) {
  if (history.length === 0) return;

  ctx.strokeStyle = '#29ABE2'; // DFINITY turquoise
  ctx.lineWidth = 3;
  ctx.beginPath();

  // Draw curve based on history points
  history.forEach((point, index) => {
    const x = (index / history.length) * width;
    const y = height - (Math.log10(point.multiplier) / Math.log10(100)) * height;

    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });

  ctx.stroke();
}

function drawCrashPoint(
  ctx: CanvasRenderingContext2D,
  crashPoint: number,
  width: number,
  height: number
) {
  const y = height - (Math.log10(crashPoint) / Math.log10(100)) * height;

  // Red line at crash point
  ctx.strokeStyle = '#ED0047'; // DFINITY red
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(width, y);
  ctx.stroke();
  ctx.setLineDash([]);

  // Crash point label
  ctx.fillStyle = '#ED0047';
  ctx.font = 'bold 16px JetBrains Mono';
  ctx.fillText(`CRASH: ${crashPoint.toFixed(2)}x`, width - 150, y - 10);
}
```

#### File: `openhouse_frontend/src/components/game-specific/crash/CrashProbabilityTable.tsx`
**Purpose**: Display transparent odds for common multipliers

```typescript
// PSEUDOCODE
import React, { useEffect, useState } from 'react';
import useCrashActor from '../../../hooks/actors/useCrashActor';

export const CrashProbabilityTable: React.FC = () => {
  const { actor } = useCrashActor();
  const [probabilities, setProbabilities] = useState<Array<[number, number]>>([]);

  useEffect(() => {
    if (!actor) return;

    // Fetch probability table from backend
    actor.get_probability_table().then(setProbabilities);
  }, [actor]);

  return (
    <div className="card">
      <h3 className="font-bold mb-4 text-center text-dfinity-turquoise">
        Transparent Odds
      </h3>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-pure-white/20">
              <th className="text-left py-2">Target</th>
              <th className="text-left py-2">Win Chance</th>
              <th className="text-left py-2">Expected Return</th>
            </tr>
          </thead>
          <tbody>
            {probabilities.map(([target, prob]) => (
              <tr key={target} className="border-b border-pure-white/10">
                <td className="py-2 font-mono">{target.toFixed(2)}x</td>
                <td className="py-2">
                  <span className="text-dfinity-turquoise">
                    {(prob * 100).toFixed(2)}%
                  </span>
                </td>
                <td className="py-2">
                  <span className="text-pure-white/60">
                    {(prob * target).toFixed(4)}x
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Formula display */}
      <div className="mt-4 p-3 bg-pure-white/5 rounded">
        <div className="text-xs text-pure-white/60 mb-1">Formula:</div>
        <code className="text-sm font-mono text-dfinity-turquoise">
          crash = 0.99 / (1.0 - random)
        </code>
        <div className="text-xs text-pure-white/60 mt-2">
          Expected Value: 0.99 (exactly 1% house edge)
        </div>
      </div>
    </div>
  );
};
```

#### File: `openhouse_frontend/src/components/game-specific/crash/index.ts`
**Purpose**: Barrel export for crash components

```typescript
// PSEUDOCODE
export { CrashRocket } from './CrashRocket';
export { CrashGraph } from './CrashGraph';
export { CrashProbabilityTable } from './CrashProbabilityTable';
```

### 2.2 Update Main Game Page

#### File: `openhouse_frontend/src/pages/Crash.tsx` (COMPLETE REWRITE)
**Purpose**: Main crash game page with full functionality

```typescript
// PSEUDOCODE
import React, { useEffect, useState, useCallback } from 'react';
import useCrashActor from '../hooks/actors/useCrashActor';
import {
  GameLayout,
  GameButton,
  GameStats,
  GameHistory,
  type GameStat
} from '../components/game-ui';
import {
  CrashRocket,
  CrashGraph,
  CrashProbabilityTable
} from '../components/game-specific/crash';
import { useAuth } from '../providers/AuthProvider';

interface CrashGameResult {
  crash_point: number;
  randomness_hash: string;
  timestamp?: number;
  clientId?: string;
}

export const Crash: React.FC = () => {
  const { actor } = useCrashActor();
  const { isAuthenticated } = useAuth();

  // Game state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentMultiplier, setCurrentMultiplier] = useState(1.0);
  const [crashPoint, setCrashPoint] = useState<number | null>(null);
  const [targetCashout, setTargetCashout] = useState(2.0);
  const [autoCashout, setAutoCashout] = useState(false);
  const [gameError, setGameError] = useState('');
  const [history, setHistory] = useState<CrashGameResult[]>([]);
  const [graphHistory, setGraphHistory] = useState<Array<{ multiplier: number; timestamp: number }>>([]);

  // Start game
  const startGame = async () => {
    if (!actor) return;
    if (!isAuthenticated) {
      setGameError('Please log in to play');
      return;
    }

    setIsPlaying(true);
    setGameError('');
    setCrashPoint(null);
    setCurrentMultiplier(1.0);
    setGraphHistory([]);

    try {
      // Get crash point from backend
      const result = await actor.simulate_crash();

      if ('Ok' in result) {
        const crash = result.Ok.crash_point;
        setCrashPoint(crash);

        // Animate multiplier rise
        animateMultiplier(crash);

        // Add to history
        const gameResult: CrashGameResult = {
          ...result.Ok,
          timestamp: Date.now(),
          clientId: crypto.randomUUID()
        };
        setHistory(prev => [gameResult, ...prev.slice(0, 19)]);
      } else {
        setGameError(result.Err);
        setIsPlaying(false);
      }
    } catch (err) {
      setGameError(err instanceof Error ? err.message : 'Failed to start game');
      setIsPlaying(false);
    }
  };

  // Animate multiplier from 1.0 to crash point
  const animateMultiplier = (crash: number) => {
    const startTime = Date.now();
    const duration = Math.min(crash * 1000, 10000); // Max 10s animation

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Exponential curve: mult = 1.0 * e^(k*t) where k chosen so mult(duration) = crash
      const k = Math.log(crash) / duration;
      const mult = Math.exp(k * elapsed);

      setCurrentMultiplier(mult);
      setGraphHistory(prev => [...prev, { multiplier: mult, timestamp: elapsed }]);

      // Auto cash-out check
      if (autoCashout && mult >= targetCashout) {
        handleCashout();
        return;
      }

      // Check if crashed
      if (mult >= crash || progress >= 1) {
        setCurrentMultiplier(crash);
        setTimeout(() => setIsPlaying(false), 1000);
        return;
      }

      requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  };

  // Manual cash-out
  const handleCashout = () => {
    if (!isPlaying || !crashPoint) return;

    if (currentMultiplier < crashPoint) {
      // Successful cash-out
      setGameError('');
      // TODO: Process payout
      setIsPlaying(false);
    }
  };

  const handleCrashComplete = useCallback(() => {
    // Called when rocket explosion animation finishes
    setCurrentMultiplier(1.0);
    setCrashPoint(null);
    setGraphHistory([]);
  }, []);

  // Stats for display
  const stats: GameStat[] = [
    {
      label: 'Target Cash-out',
      value: `${targetCashout.toFixed(2)}x`,
      highlight: true,
      color: 'yellow'
    },
    {
      label: 'Win Chance',
      value: `${((0.99 / targetCashout) * 100).toFixed(2)}%`,
      highlight: true,
      color: 'green'
    },
    {
      label: 'House Edge',
      value: '1%',
      highlight: true,
      color: 'red'
    },
  ];

  // Custom history renderer
  const renderHistoryItem = (item: CrashGameResult) => (
    <>
      <span className="font-mono">{item.crash_point.toFixed(2)}x</span>
      <span className={item.crash_point >= 2.0 ? 'text-green-400' : 'text-red-400'}>
        {item.crash_point >= 2.0 ? '🚀' : '💥'}
      </span>
    </>
  );

  return (
    <GameLayout
      title="Crash"
      icon="🚀"
      description="Watch the rocket rise and cash out before it crashes!"
      minBet={1}
      maxWin={100}
      houseEdge={1}
    >
      {/* Rocket Animation */}
      <div className="card max-w-4xl mx-auto">
        <CrashRocket
          isLaunching={isPlaying}
          currentMultiplier={currentMultiplier}
          crashPoint={crashPoint}
          onCrashComplete={handleCrashComplete}
        />
      </div>

      {/* Multiplier Graph */}
      <div className="card max-w-4xl mx-auto">
        <h3 className="font-bold mb-4">Multiplier Graph</h3>
        <CrashGraph
          isPlaying={isPlaying}
          currentMultiplier={currentMultiplier}
          crashPoint={crashPoint}
          history={graphHistory}
        />
      </div>

      {/* Game Controls */}
      <div className="card max-w-2xl mx-auto">
        <div className="mb-6">
          <label className="block text-sm font-bold mb-3 text-center text-dfinity-turquoise">
            Target Cash-out Multiplier:
          </label>
          <input
            type="range"
            min="1.01"
            max="100"
            step="0.01"
            value={targetCashout}
            onChange={(e) => setTargetCashout(parseFloat(e.target.value))}
            disabled={isPlaying}
            className="slider-turquoise w-full"
          />
          <div className="text-center mt-2 text-2xl font-bold">
            {targetCashout.toFixed(2)}x
          </div>
        </div>

        <div className="mb-6">
          <label className="flex items-center justify-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoCashout}
              onChange={(e) => setAutoCashout(e.target.checked)}
              disabled={isPlaying}
              className="w-4 h-4"
            />
            Auto cash-out at target
          </label>
        </div>

        <GameStats stats={stats} />

        {!isPlaying ? (
          <GameButton
            onClick={startGame}
            disabled={!actor || !isAuthenticated}
            loading={false}
            label="LAUNCH ROCKET 🚀"
            icon="🚀"
          />
        ) : (
          <GameButton
            onClick={handleCashout}
            disabled={!crashPoint || currentMultiplier >= crashPoint}
            loading={false}
            label={`CASH OUT ${currentMultiplier.toFixed(2)}x`}
            icon="💰"
          />
        )}

        {gameError && (
          <div className="mt-4 text-red-400 text-sm text-center">
            {gameError}
          </div>
        )}
      </div>

      {/* Recent Games */}
      <div className="card max-w-2xl mx-auto">
        <GameHistory<CrashGameResult>
          items={history}
          maxDisplay={10}
          title="Recent Crashes"
          renderCustom={renderHistoryItem}
        />
      </div>

      {/* Probability Table */}
      <div className="max-w-2xl mx-auto">
        <CrashProbabilityTable />
      </div>
    </GameLayout>
  );
};
```

### 2.3 Add Crash-Specific CSS

#### File: `openhouse_frontend/src/components/game-specific/crash/CrashRocket.css`
**Purpose**: Animations for rocket, flames, explosion

```css
/* PSEUDOCODE */

/* Rocket smoke trail */
@keyframes smoke {
  0% {
    transform: translateY(0) scale(1);
    opacity: 0.8;
  }
  100% {
    transform: translateY(50px) scale(2);
    opacity: 0;
  }
}

.animate-smoke {
  animation: smoke 1s ease-out infinite;
}

.smoke-particle {
  width: 20px;
  height: 20px;
  background: radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 70%);
  border-radius: 50%;
}

/* Flames animation */
.flames {
  animation: flicker 0.2s ease-in-out infinite alternate;
}

@keyframes flicker {
  0% { opacity: 0.8; }
  100% { opacity: 1; }
}

/* Explosion effect */
.explosion-container {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.explosion-circle {
  position: absolute;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  animation: explode 1s ease-out forwards;
}

@keyframes explode {
  0% {
    transform: scale(0);
    opacity: 1;
  }
  100% {
    transform: scale(3);
    opacity: 0;
  }
}

/* Star twinkle */
.star {
  animation: twinkle 2s ease-in-out infinite;
}

@keyframes twinkle {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1; }
}
```

## 3. Testing Requirements

**NONE REQUIRED** - This is experimental pre-production. Manual verification only.

### Optional Manual Checks (Post-Deployment on Mainnet):
```bash
# Frontend build check
cd openhouse_frontend
npm run build

# Verify no TypeScript errors
npm run type-check  # (if available)

# Deploy to mainnet
cd ..
./deploy.sh --frontend-only
```

### Manual Testing Checklist:
1. Visit https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io/crash
2. Verify rocket appears and animations work
3. Click "LAUNCH ROCKET" - verify backend connection
4. Watch rocket animate from 1.0x to crash point
5. Test auto cash-out functionality
6. Verify probability table displays correctly
7. Check recent games history updates
8. Test on mobile viewport (responsive design)

## 4. Deployment Strategy

### Affected Canisters:
- ✅ **crash_backend** - No changes (already deployed)
- ✅ **openhouse_frontend** - New Crash.tsx implementation

### Deployment Commands:
```bash
# Build frontend
cd openhouse_frontend
npm run build

# Deploy frontend only (crash_backend unchanged)
cd ..
./deploy.sh --frontend-only

# Verify deployment
dfx canister --network ic status openhouse_frontend
```

### Post-Deployment Verification:
1. Visit: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io/crash
2. Check browser console for errors
3. Test rocket animation cycle
4. Verify backend API calls work
5. Test auto cash-out feature

## 5. File Tree Changes

### Before:
```
openhouse_frontend/src/
├── pages/
│   └── Crash.tsx (140 lines - placeholder)
├── components/
│   └── game-specific/
│       ├── dice/
│       └── plinko/
```

### After:
```
openhouse_frontend/src/
├── pages/
│   └── Crash.tsx (~350 lines - complete implementation)
├── components/
│   └── game-specific/
│       ├── crash/            # NEW FOLDER
│       │   ├── CrashRocket.tsx         (~200 lines)
│       │   ├── CrashRocket.css         (~80 lines)
│       │   ├── CrashGraph.tsx          (~150 lines)
│       │   ├── CrashProbabilityTable.tsx (~80 lines)
│       │   └── index.ts                (~3 lines)
│       ├── dice/
│       └── plinko/
```

## 6. Dependencies

### Existing (No New Installs Required):
- ✅ React + hooks
- ✅ TypeScript
- ✅ Tailwind CSS (DFINITY colors configured)
- ✅ @dfinity/agent (IC integration)
- ✅ ic-use-actor (useCrashActor hook exists)
- ✅ All game-ui components (GameLayout, GameButton, etc.)

### Optional (If Needed):
```bash
# None - all dependencies already in package.json
```

## 7. Design Principles

### Visual Design:
- **ICP Branding**: Rocket ship with ICP logo, DFINITY turquoise/red colors
- **Simplicity**: Clean interface, focus on rocket + multiplier
- **Transparency**: Formula and odds prominently displayed
- **Consistency**: Follows Dice/Plinko patterns (GameLayout wrapper, same controls)

### UX Flow:
1. User sees idle rocket on launchpad
2. Set target cash-out (1.01x - 100x slider)
3. Optional: Enable auto cash-out
4. Click "LAUNCH ROCKET 🚀"
5. Rocket animates upward as multiplier increases
6. Option 1: Manual "CASH OUT" button (if auto-cashout disabled)
7. Option 2: Auto cash-out at target (if enabled)
8. Rocket crashes at predetermined point (from backend)
9. Explosion animation, reset to idle
10. Result added to history

### Animation Details:
- **Launch**: Rocket rises smoothly with smoke trail
- **Flight**: Flames flicker, multiplier updates in real-time
- **Crash**: Red explosion effect, particle scatter
- **Graph**: Real-time line drawing showing multiplier curve

## 8. Code Quality Notes

### TypeScript Strict Mode:
- All components fully typed
- No `any` types except Canvas API (`ctx: CanvasRenderingContext2D`)
- Props interfaces for all components

### Performance:
- Canvas for graph (more efficient than SVG for real-time updates)
- RequestAnimationFrame for smooth 60fps animations
- Debounced state updates to prevent re-render storms

### Accessibility:
- Semantic HTML structure
- Keyboard navigation support
- Color contrast ratios meet WCAG AA
- Screen reader labels for controls

## 9. Future Enhancements (Out of Scope)

- [ ] Betting system integration (currently just simulation)
- [ ] Multiplayer chat
- [ ] Provable fairness verification UI
- [ ] Sound effects (rocket engine, explosion)
- [ ] Leaderboard (highest multipliers)
- [ ] Bet history with profit/loss tracking
- [ ] Mobile app (React Native)

## 10. Security Considerations

### Frontend Security:
- ✅ No sensitive data stored client-side
- ✅ All randomness from IC backend (not client-side)
- ✅ Auto cash-out executed client-side (no trust in backend timing)
- ✅ Input validation on target cash-out (1.01 - 100 range)

### IC Backend Security:
- ✅ Uses IC VRF for randomness (not manipulable)
- ✅ Stateless design (no state corruption risk)
- ✅ Formula transparency (users can verify fairness)

## 11. Success Criteria

### Implementation Complete When:
- ✅ All 4 crash components created (CrashRocket, CrashGraph, CrashProbabilityTable, index)
- ✅ Crash.tsx fully rewritten with game logic
- ✅ Rocket animation works (launch, flight, crash, explosion)
- ✅ Multiplier graph renders correctly
- ✅ Backend integration functional (simulate_crash, get_probability_table)
- ✅ Auto cash-out feature works
- ✅ Recent games history displays
- ✅ Deployed to mainnet and accessible at /crash route
- ✅ No console errors on production
- ✅ Responsive design works on mobile

### PR Ready When:
- ✅ All files committed to feature branch
- ✅ Frontend deployed to mainnet
- ✅ Manual testing on https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io/crash passes
- ✅ PR created with detailed description
- ✅ Screenshots/GIF of rocket animation included in PR

---

## Appendix A: Backend API Reference

### CrashResult Type
```rust
pub struct CrashResult {
    pub crash_point: f64,           // 1.00 - 100.00
    pub randomness_hash: String,    // SHA256 hash for verification
}
```

### Available Methods
```rust
// Main game method
simulate_crash() -> Result<CrashResult, String>

// Query methods
get_crash_formula() -> String              // "crash = 0.99 / (1.0 - random)"
get_expected_value() -> f64                // 0.99
get_win_probability(target: f64) -> Result<f64, String>  // P(crash ≥ target)
get_probability_table() -> Vec<(f64, f64)>  // [(1.1, 0.9), (2.0, 0.495), ...]

// Health check
greet(name: String) -> String
```

## Appendix B: DFINITY Color Palette

```javascript
{
  turquoise: '#29ABE2',  // Primary brand - rocket body, highlights
  purple: '#3B00B9',     // Secondary - rocket fins, accents
  green: '#00E19B',      // Success - wins, positive states
  red: '#ED0047',        // Danger - crashes, explosions, losses
  orange: '#F15A24',     // Hover/active - flames, buttons
  navy: '#0E031F',       // Background gradient
}
```

## Appendix C: Component Hierarchy

```
Crash.tsx (Page)
├── GameLayout (Wrapper)
│   ├── title: "Crash"
│   ├── icon: "🚀"
│   └── description: "Watch the rocket rise..."
├── CrashRocket (Animation)
│   ├── SVG rocket with ICP logo
│   ├── Flame animation
│   ├── Smoke trail particles
│   └── Explosion effect
├── CrashGraph (Visualization)
│   ├── Canvas-based real-time graph
│   ├── Grid lines
│   ├── Multiplier curve
│   └── Crash point marker
├── GameControls (Betting)
│   ├── Target slider (1.01 - 100x)
│   ├── Auto cash-out checkbox
│   ├── GameStats (odds display)
│   └── GameButton (Launch/Cash-out)
├── GameHistory (Recent games)
│   └── Last 10 crashes with multipliers
└── CrashProbabilityTable (Transparency)
    ├── Common multipliers table
    └── Formula display
```
