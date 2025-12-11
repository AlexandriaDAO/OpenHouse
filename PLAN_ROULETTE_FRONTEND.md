# 🤖 AUTONOMOUS PR ORCHESTRATOR - DO NOT SKIP

**You are an autonomous PR orchestrator. Your ONLY job is to implement this plan and create a PR.**

## Isolation Check (RUN FIRST)
```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
if [ "$REPO_ROOT" = "/home/theseus/alexandria/openhouse" ]; then
    echo "❌ FATAL: In main repo. Must be in worktree."
    echo "Worktree: /home/theseus/alexandria/openhouse-roulette-frontend"
    exit 1
fi
echo "✅ In isolated worktree: $REPO_ROOT"
```

## Your Autonomous Workflow (NO QUESTIONS ALLOWED)

1. **Verify isolation** - You must be in worktree: `/home/theseus/alexandria/openhouse-roulette-frontend`

2. **Implement feature** - Follow plan sections below (6 phases)

3. **Build & Deploy to Mainnet**:
   ```bash
   # Frontend build
   cd openhouse_frontend
   npm run build
   cd ..

   # Deploy to mainnet
   ./deploy.sh --frontend-only
   ```

4. **Verify deployment**:
   ```bash
   # Check frontend canister
   dfx canister --network ic status pezw3-laaaa-aaaal-qssoa-cai

   # Test the live site
   echo "Visit: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io/roulette"
   ```

5. **Create PR** (MANDATORY):
   ```bash
   git add .
   git commit -m "feat: rebuild roulette frontend for European roulette backend

Replace Blackjack UI with proper European Roulette:
- Hybrid SVG betting table + Canvas wheel animation
- All 13 bet types (straight, split, street, corner, etc.)
- Dark cyberpunk theme matching Plinko
- Click-to-bet interface with chip visualization
- 2.5s wheel spin with smooth easing
- Result popup and winning zone highlighting

Implements PLAN_ROULETTE_FRONTEND.md"

   git push -u origin feature/roulette-frontend-european

   gh pr create --title "feat: European Roulette frontend (replace Blackjack UI)" --body "Implements complete European Roulette frontend to match the existing backend.

## Summary
The current roulette frontend implements Blackjack (cards, dealer hands), but the backend implements European Roulette (wheel, number betting). This PR completely rebuilds the frontend.

## Changes
- **9 new components**: RouletteGame, WheelCanvas, RouletteBettingTable, TableGrid, BetZones, PlacedChips, RouletteResultPopup, constants, utils
- **Deleted 3 Blackjack components**: Card.tsx, Hand.tsx, RouletteTable.tsx
- **Hybrid rendering**: SVG for betting table, Canvas for wheel
- **All 13 bet types**: Straight, Split, Street, Corner, SixLine, Column, Dozen, Red, Black, Even, Odd, Low, High
- **~1500-2000 LOC**: TypeScript + React + Tailwind

## Deployed to Mainnet
- Frontend: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io/roulette
- Canister: pezw3-laaaa-aaaal-qssoa-cai

## Testing
- [ ] All 13 bet types functional
- [ ] Wheel spins smoothly (60fps)
- [ ] Mobile responsive
- [ ] Matches Plinko visual style
- [ ] Balance tracking works
- [ ] Error handling graceful"
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

**Branch:** `feature/roulette-frontend-european`
**Worktree:** `/home/theseus/alexandria/openhouse-roulette-frontend`

---

# European Roulette Frontend - Implementation Plan

## Task Classification
**NEW FEATURE** - Build new European Roulette UI (replaces Blackjack mismatch)

## Current State

### Backend (European Roulette) - ALREADY DEPLOYED
- **Canister ID**: `wvrcw-3aaaa-aaaah-arm4a-cai`
- **Game Type**: European Roulette (0-36, single zero)
- **API Method**: `spin(bets: Vec<Bet>) -> Result<SpinResult, String>`
- **Bet Types**: 13 variants
  - Inside: Straight, Split, Street, Corner, SixLine
  - Outside: Column, Dozen, Red, Black, Even, Odd, Low, High
- **Max Bets**: 20 per spin
- **House Edge**: 2.70%
- **Backend Files**:
  - `/home/theseus/alexandria/openhouse/roulette_backend/src/lib.rs` - API endpoints
  - `/home/theseus/alexandria/openhouse/roulette_backend/src/game.rs` - Spin logic
  - `/home/theseus/alexandria/openhouse/roulette_backend/src/board.rs` - Board layout helpers
  - `/home/theseus/alexandria/openhouse/roulette_backend/src/types.rs` - Type definitions

### Frontend (CURRENT - CRITICAL MISMATCH)
- **Status**: ⚠️ Implements BLACKJACK, not roulette!
- **Current Files** (TO BE REPLACED):
  ```
  openhouse_frontend/src/
  ├── pages/roulette/
  │   └── RouletteGame.tsx (Blackjack game page)
  ├── components/game-specific/roulette/
  │   ├── Card.tsx (Blackjack cards)
  │   ├── Hand.tsx (Blackjack hands with score)
  │   └── RouletteTable.tsx (Blackjack dealer vs player)
  ```
- **Existing Infrastructure** (TO BE REUSED):
  - `useRouletteActor()` - Already configured at `openhouse_frontend/src/hooks/actors/useRouletteActor.ts`
  - `GameBalanceProvider` - Balance tracking
  - `BettingRail` - Betting UI component
  - `GameLayout` - Page wrapper
  - TypeScript declarations at `openhouse_frontend/src/declarations/roulette_backend/`

### Tech Stack
- React 18.3.1 + TypeScript + Vite
- Tailwind CSS 3.4.1 (dfinity-turquoise #39FF14 accent)
- Framer Motion 12.23.25 (for result popups)
- No new dependencies needed

### Design Decisions (From User)
1. **Rendering**: Hybrid SVG (table) + Canvas (wheel)
2. **Animation**: Simple 2.5s spin (no physics engine)
3. **Betting UI**: Click-to-bet traditional table
4. **Visual Style**: Dark cyberpunk (match Plinko)

## File Tree Changes

### Before (Current Blackjack UI)
```
openhouse_frontend/src/
├── pages/roulette/
│   ├── RouletteGame.tsx (387 lines - Blackjack)
│   └── index.ts
├── components/game-specific/roulette/
│   ├── Card.tsx (98 lines - Blackjack)
│   ├── Hand.tsx (142 lines - Blackjack)
│   └── RouletteTable.tsx (256 lines - Blackjack)
```

### After (New European Roulette UI)
```
openhouse_frontend/src/
├── pages/roulette/
│   ├── RouletteGame.tsx (REPLACED - ~400 lines)
│   └── index.ts (modified)
├── components/game-specific/roulette/
│   ├── index.ts (NEW - exports)
│   ├── RouletteWheel.tsx (NEW - ~100 lines)
│   ├── WheelCanvas.tsx (NEW - ~300 lines)
│   ├── RouletteBettingTable.tsx (NEW - ~200 lines)
│   ├── TableGrid.tsx (NEW - ~250 lines)
│   ├── BetZones.tsx (NEW - ~200 lines)
│   ├── PlacedChips.tsx (NEW - ~150 lines)
│   ├── RouletteResultPopup.tsx (NEW - ~100 lines)
│   ├── constants.ts (NEW - ~80 lines)
│   └── utils.ts (NEW - ~120 lines)
```

**Net Change**: Delete 3 files (883 LOC), Create 10 files (~1900 LOC)

## Implementation Plan (6 Phases)

### Phase 1: Foundation - Constants & Types

**File**: `openhouse_frontend/src/components/game-specific/roulette/constants.ts` (NEW)

```typescript
// PSEUDOCODE

// European wheel number order (clockwise from 0)
export const EUROPEAN_LAYOUT = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
  5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
];

// Red numbers from backend board.rs
export const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

// Black numbers from backend board.rs
export const BLACK_NUMBERS = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];

// SVG Table layout dimensions
export const TABLE_LAYOUT = {
  WIDTH: 800,
  HEIGHT: 400,
  PADDING: 20,

  GRID: {
    X: 120,
    Y: 60,
    CELL_WIDTH: 40,
    CELL_HEIGHT: 50,
    ROWS: 3,
    COLS: 12,
  },

  ZERO: {
    X: 120,
    Y: 10,
    WIDTH: 480,
    HEIGHT: 40,
  },

  OUTSIDE: {
    X: 620,
    Y: 60,
    WIDTH: 120,
    CELL_HEIGHT: 50,
  },
};

// Animation constants
export const SPIN_DURATION = 2500; // 2.5 seconds
export const TOTAL_ROTATIONS = 5;

// Color theme (match Plinko cyberpunk)
export const THEME = {
  numberRed: '#ED0047',
  numberBlack: '#000000',
  numberGreen: '#00E19B',
  accentGlow: '#39FF14',
  table: '#0a0a14',
};

// Helper: Get color for number
export function getNumberColor(num: number): string {
  // If 0: green
  // If in RED_NUMBERS: red
  // Else: black
}

// Helper: Calculate angle for wheel number
export function getAngleForNumber(num: number): number {
  // Find index in EUROPEAN_LAYOUT
  // Return angle: (index / 37) * 360
}
```

---

**File**: `openhouse_frontend/src/components/game-specific/roulette/utils.ts` (NEW)

```typescript
// PSEUDOCODE
import type { Bet, SpinResult } from '../../declarations/roulette_backend/roulette_backend.did.d.ts';

// Map zone ID to backend Bet type
export function mapUIBetToBackend(zoneId: string, amount: bigint): Bet {
  // Parse zoneId:
  // "straight-17" → { bet_type: { Straight: 17 }, amount }
  // "red" → { bet_type: { Red: null }, amount }
  // "split-4-5" → { bet_type: { Split: [4, 5] }, amount }
  // "street-1" → { bet_type: { Street: 1 }, amount }
  // "corner-10" → { bet_type: { Corner: 10 }, amount }
  // "sixline-1" → { bet_type: { SixLine: 1 }, amount }
  // "column-1" → { bet_type: { Column: 1 }, amount }
  // "dozen-1" → { bet_type: { Dozen: 1 }, amount }
  // "even", "odd", "low", "high", "black" → respective variants
}

// Calculate which zones won
export function getWinningZones(result: SpinResult): string[] {
  const zones = [`straight-${result.winning_number}`];

  // Add color
  if (result.color === 'Red') zones.push('red');
  if (result.color === 'Black') zones.push('black');

  // Add even/odd (0 doesn't count)
  if (result.winning_number % 2 === 0 && result.winning_number !== 0) zones.push('even');
  if (result.winning_number % 2 === 1) zones.push('odd');

  // Add low/high
  if (result.winning_number >= 1 && result.winning_number <= 18) zones.push('low');
  if (result.winning_number >= 19) zones.push('high');

  // Add column (1,2,3 based on position)
  const col = getColumnForNumber(result.winning_number);
  if (col) zones.push(`column-${col}`);

  // Add dozen (1,2,3)
  const dozen = getDozenForNumber(result.winning_number);
  if (dozen) zones.push(`dozen-${dozen}`);

  // Add street, split, corner, sixline if applicable (complex logic)

  return zones;
}

// Calculate chip position on SVG table
export function getChipPosition(zoneId: string): { x: number, y: number } {
  // Parse zoneId and return SVG coordinates
  // Use TABLE_LAYOUT constants
  // For "straight-17": grid position
  // For "red": outside bet position
  // For "split-4-5": between cells
  // etc.
}

// Helper: Get column number (1, 2, or 3)
function getColumnForNumber(num: number): number | null {
  // Column 1: 1, 4, 7, ..., 34
  // Column 2: 2, 5, 8, ..., 35
  // Column 3: 3, 6, 9, ..., 36
  // 0: null
}

// Helper: Get dozen number (1, 2, or 3)
function getDozenForNumber(num: number): number | null {
  // Dozen 1: 1-12
  // Dozen 2: 13-24
  // Dozen 3: 25-36
  // 0: null
}
```

---

### Phase 2: Static SVG Table

**File**: `openhouse_frontend/src/components/game-specific/roulette/TableGrid.tsx` (NEW)

```typescript
// PSEUDOCODE
import { TABLE_LAYOUT, getNumberColor } from './constants';

export function TableGrid() {
  // Render SVG viewBox 800x400

  // Render zero slot at top (green, spans width)
  // <rect x={ZERO.X} y={ZERO.Y} width={ZERO.WIDTH} height={ZERO.HEIGHT} fill={green} />
  // <text>0</text>

  // Render 3x12 number grid
  for (let col = 0; col < 12; col++) {
    for (let row = 0; row < 3; row++) {
      const number = col * 3 + (3 - row); // Roulette layout
      const x = GRID.X + col * GRID.CELL_WIDTH;
      const y = GRID.Y + row * GRID.CELL_HEIGHT;
      const color = getNumberColor(number);

      // <rect x={x} y={y} width={CELL_WIDTH} height={CELL_HEIGHT} fill={color} />
      // <text>{number}</text>
    }
  }

  // Render column bets at bottom (1, 2, 3)
  // Render dozen bets on side

  // Render outside bets on right side
  // - Red/Black (stacked)
  // - Even/Odd (stacked)
  // - Low/High (stacked)

  // Style: Tailwind classes for borders, text
  // className="border border-white/20"
}
```

---

**File**: `openhouse_frontend/src/components/game-specific/roulette/BetZones.tsx` (NEW)

```typescript
// PSEUDOCODE
import { TABLE_LAYOUT } from './constants';

interface BetZonesProps {
  onBetClick: (zoneId: string) => void;
  hoveredZone: string | null;
  onHover: (zoneId: string | null) => void;
  winningZones: string[];
}

export function BetZones({ onBetClick, hoveredZone, onHover, winningZones }: BetZonesProps) {
  // Render invisible clickable rectangles over each bet area

  // Straight bets (37 zones for 0-36)
  for (each number 0-36) {
    const { x, y } = getNumberPosition(number);
    // <rect x={x} y={y} width={CELL_WIDTH} height={CELL_HEIGHT}
    //   fill="transparent"
    //   onClick={() => onBetClick(`straight-${number}`)}
    //   onMouseEnter={() => onHover(`straight-${number}`)}
    //   className={hoveredZone === `straight-${number}` ? "fill-white/10" : ""}
    //   className={winningZones.includes(`straight-${number}`) ? "fill-green-500/30" : ""}
    // />
  }

  // Split bets (horizontal and vertical between numbers)
  // Render thin rectangles between cells
  // onClick with zoneId like "split-4-5"

  // Street bets (rows of 3)
  // Corner bets (2x2 squares)
  // SixLine bets (2 rows of 3)

  // Column bets (3 zones at bottom)
  // Dozen bets (3 zones on side)

  // Outside bets (red, black, even, odd, low, high)
  for (each outside bet) {
    // <rect onClick={() => onBetClick('red')} .../>
  }
}
```

---

**File**: `openhouse_frontend/src/components/game-specific/roulette/RouletteBettingTable.tsx` (NEW)

```typescript
// PSEUDOCODE
import { TableGrid } from './TableGrid';
import { BetZones } from './BetZones';
import { PlacedChips } from './PlacedChips';

interface RouletteBettingTableProps {
  placedBets: Array<{ zoneId: string, amount: bigint }>;
  onBetClick: (zoneId: string) => void;
  onChipClick: (zoneId: string) => void;
  hoveredZone: string | null;
  onHover: (zoneId: string | null) => void;
  winningZones: string[];
}

export function RouletteBettingTable(props: RouletteBettingTableProps) {
  return (
    <div className="relative w-full max-w-4xl mx-auto">
      <svg viewBox="0 0 800 400" className="w-full h-auto">
        {/* Static table layout */}
        <TableGrid />

        {/* Clickable bet zones */}
        <BetZones
          onBetClick={props.onBetClick}
          hoveredZone={props.hoveredZone}
          onHover={props.onHover}
          winningZones={props.winningZones}
        />

        {/* Visual chips on bets */}
        <PlacedChips
          bets={props.placedBets}
          onChipClick={props.onChipClick}
        />
      </svg>
    </div>
  );
}
```

---

### Phase 3: Chip Visualization

**File**: `openhouse_frontend/src/components/game-specific/roulette/PlacedChips.tsx` (NEW)

```typescript
// PSEUDOCODE
import { getChipPosition } from './utils';
import { formatUSDT } from '../../utils/currency';

interface PlacedChipsProps {
  bets: Array<{ zoneId: string, amount: bigint }>;
  onChipClick: (zoneId: string) => void;
}

export function PlacedChips({ bets, onChipClick }: PlacedChipsProps) {
  // Group bets by zoneId (stack multiple bets on same zone)
  const betsByZone = groupBetsByZone(bets);

  return (
    <g className="placed-chips">
      {Object.entries(betsByZone).map(([zoneId, totalAmount]) => {
        const { x, y } = getChipPosition(zoneId);

        return (
          <g key={zoneId} transform={`translate(${x}, ${y})`}>
            {/* Chip circle (scale 60% of BettingRail size) */}
            <circle
              r={15}
              fill={getChipColor(totalAmount)}
              stroke="#FFF"
              strokeWidth={2}
              onClick={() => onChipClick(zoneId)}
              className="cursor-pointer hover:opacity-80"
            />

            {/* Amount text */}
            <text
              textAnchor="middle"
              y={5}
              fontSize={10}
              fill="white"
              className="font-mono"
            >
              {formatUSDT(totalAmount)}
            </text>
          </g>
        );
      })}
    </g>
  );
}

// Helper: Group bets by zone, sum amounts
function groupBetsByZone(bets) {
  // Reduce bets array into { [zoneId]: totalAmount }
}

// Helper: Get chip color based on amount
function getChipColor(amount: bigint): string {
  // White: < 1 USDT
  // Red: 1-10 USDT
  // Green: 10-100 USDT
  // Blue: 100-1000 USDT
  // Black: >= 1000 USDT
}
```

---

### Phase 4: Canvas Wheel Animation

**File**: `openhouse_frontend/src/components/game-specific/roulette/WheelCanvas.tsx` (NEW)

```typescript
// PSEUDOCODE
import { useRef, useEffect } from 'react';
import { EUROPEAN_LAYOUT, SPIN_DURATION, TOTAL_ROTATIONS, getNumberColor, getAngleForNumber } from './constants';

interface WheelCanvasProps {
  targetNumber: number | null;
  isSpinning: boolean;
  onSpinComplete: () => void;
}

export function WheelCanvas({ targetNumber, isSpinning, onSpinComplete }: WheelCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const wheelRotationRef = useRef<number>(0);
  const ballRotationRef = useRef<number>(0);

  // Animation loop
  useEffect(() => {
    if (!isSpinning || !targetNumber) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const targetAngle = getAngleForNumber(targetNumber);
    startTimeRef.current = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const progress = Math.min(elapsed / SPIN_DURATION, 1);

      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);

      // Wheel rotation (clockwise)
      wheelRotationRef.current = (TOTAL_ROTATIONS * 360 * eased + targetAngle) * (Math.PI / 180);

      // Ball rotation (counter-clockwise, slower)
      ballRotationRef.current = -wheelRotationRef.current * 0.7;

      // Render
      drawWheel(ctx, canvas.width, canvas.height, wheelRotationRef.current, ballRotationRef.current);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        onSpinComplete();
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isSpinning, targetNumber, onSpinComplete]);

  // Render static wheel when not spinning
  useEffect(() => {
    if (isSpinning) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    drawWheel(ctx, canvas.width, canvas.height, wheelRotationRef.current, ballRotationRef.current);
  }, [isSpinning]);

  return (
    <canvas
      ref={canvasRef}
      width={400}
      height={400}
      className="w-full max-w-md mx-auto"
    />
  );
}

// Draw wheel on canvas
function drawWheel(ctx: CanvasRenderingContext2D, width: number, height: number, wheelRotation: number, ballRotation: number) {
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(centerX, centerY) * 0.8;

  // Clear canvas
  ctx.clearRect(0, 0, width, height);

  // Draw outer rim (metallic silver)
  ctx.strokeStyle = '#C0C0C0';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.stroke();

  // Draw pockets (37 wedges)
  const pocketAngle = (Math.PI * 2) / 37;

  for (let i = 0; i < 37; i++) {
    const number = EUROPEAN_LAYOUT[i];
    const angle = wheelRotation + i * pocketAngle;
    const color = getNumberColor(number);

    // Draw wedge
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, angle, angle + pocketAngle);
    ctx.closePath();
    ctx.fill();

    // Draw number text (white)
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(angle + pocketAngle / 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(number.toString(), radius * 0.7, 5);
    ctx.restore();
  }

  // Draw ball (titanium gradient)
  const ballRadius = 12;
  const ballX = centerX + Math.cos(ballRotation) * radius * 0.95;
  const ballY = centerY + Math.sin(ballRotation) * radius * 0.95;

  // Shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.beginPath();
  ctx.arc(ballX + 2, ballY + 2, ballRadius, 0, Math.PI * 2);
  ctx.fill();

  // Ball with gradient
  const gradient = ctx.createRadialGradient(
    ballX - 4, ballY - 4, 2,
    ballX, ballY, ballRadius
  );
  gradient.addColorStop(0, '#FFFFFF');
  gradient.addColorStop(0.5, '#E2E8F0');
  gradient.addColorStop(1, '#94A3B8');

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(ballX, ballY, ballRadius, 0, Math.PI * 2);
  ctx.fill();
}
```

---

**File**: `openhouse_frontend/src/components/game-specific/roulette/RouletteWheel.tsx` (NEW)

```typescript
// PSEUDOCODE
import { WheelCanvas } from './WheelCanvas';

interface RouletteWheelProps {
  targetNumber: number | null;
  isSpinning: boolean;
  onSpinComplete: () => void;
}

export function RouletteWheel({ targetNumber, isSpinning, onSpinComplete }: RouletteWheelProps) {
  return (
    <div className="relative">
      {/* Canvas wheel */}
      <WheelCanvas
        targetNumber={targetNumber}
        isSpinning={isSpinning}
        onSpinComplete={onSpinComplete}
      />

      {/* Winning number display (overlay) */}
      {targetNumber !== null && !isSpinning && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-black/80 px-6 py-3 rounded-lg border border-dfinity-turquoise">
          <div className="text-2xl font-bold text-white font-mono">
            {targetNumber}
          </div>
        </div>
      )}
    </div>
  );
}
```

---

### Phase 5: Main Game Page & Backend Integration

**File**: `openhouse_frontend/src/pages/roulette/RouletteGame.tsx` (REPLACE)

```typescript
// PSEUDOCODE - COMPLETE REWRITE
import { useState, useEffect, useRef } from 'react';
import { GameLayout } from '../../components/Layout';
import { RouletteWheel } from '../../components/game-specific/roulette/RouletteWheel';
import { RouletteBettingTable } from '../../components/game-specific/roulette/RouletteBettingTable';
import { RouletteResultPopup } from '../../components/game-specific/roulette/RouletteResultPopup';
import { BettingRail } from '../../components/betting/BettingRail';
import { useRouletteActor } from '../../hooks/actors/useRouletteActor';
import { useLedgerActor } from '../../hooks/actors/useLedgerActor';
import { useAuth } from '../../providers/AuthProvider';
import { useBalance } from '../../providers/BalanceProvider';
import { useGameBalance } from '../../providers/GameBalanceProvider';
import { mapUIBetToBackend, getWinningZones } from '../../components/game-specific/roulette/utils';
import { formatUSDT } from '../../utils/currency';
import type { Bet, SpinResult } from '../../declarations/roulette_backend/roulette_backend.did.d.ts';

export default function RouletteGame() {
  // Actors
  const { actor } = useRouletteActor();
  const { actor: ledgerActor } = useLedgerActor();
  const { principal } = useAuth();

  // Balance
  const { walletBalance } = useBalance();
  const gameBalanceContext = useGameBalance('roulette');
  const balance = gameBalanceContext.balances;

  // Betting state
  const [betAmount, setBetAmount] = useState(0.01);
  const [placedBets, setPlacedBets] = useState<Array<{ zoneId: string, amount: bigint }>>([]);
  const [totalBetAmount, setTotalBetAmount] = useState(0n);

  // Game state
  const [isSpinning, setIsSpinning] = useState(false);
  const [spinResult, setSpinResult] = useState<SpinResult | null>(null);
  const [showResultPopup, setShowResultPopup] = useState(false);
  const [gameError, setGameError] = useState('');

  // Wheel animation
  const [targetNumber, setTargetNumber] = useState<number | null>(null);

  // Visual feedback
  const [hoveredZone, setHoveredZone] = useState<string | null>(null);
  const [winningZones, setWinningZones] = useState<string[]>([]);

  // Refs
  const maxBet = useRef(1000n); // TODO: Calculate from house balance

  // Update total bet amount when bets change
  useEffect(() => {
    const total = placedBets.reduce((sum, bet) => sum + bet.amount, 0n);
    setTotalBetAmount(total);
  }, [placedBets]);

  // Handle bet placement
  const handleBetClick = (zoneId: string) => {
    if (isSpinning) return;

    // Check max 20 bets
    if (placedBets.length >= 20) {
      setGameError('Maximum 20 bets per spin');
      return;
    }

    // Add bet
    const betAmountBigInt = BigInt(Math.floor(betAmount * 1e8));
    setPlacedBets([...placedBets, { zoneId, amount: betAmountBigInt }]);
  };

  // Handle chip removal
  const handleChipClick = (zoneId: string) => {
    // Remove last bet with this zoneId
    const index = placedBets.findLastIndex(bet => bet.zoneId === zoneId);
    if (index !== -1) {
      setPlacedBets(placedBets.filter((_, i) => i !== index));
    }
  };

  // Handle spin
  const handleSpin = async () => {
    if (!actor || placedBets.length === 0) return;

    try {
      setIsSpinning(true);
      setGameError('');
      setWinningZones([]);

      // Validate balance
      if (totalBetAmount > balance.game) {
        throw new Error('Insufficient balance');
      }

      // Convert UI bets to backend format
      const backendBets: Bet[] = placedBets.map(bet =>
        mapUIBetToBackend(bet.zoneId, bet.amount)
      );

      // Call backend
      const result = await actor.spin(backendBets);

      if ('Err' in result) {
        throw new Error(result.Err);
      }

      const spinResult = result.Ok;
      setSpinResult(spinResult);
      setTargetNumber(spinResult.winning_number);

      // Wheel animation will complete, then onSpinComplete fires

    } catch (error) {
      setGameError(error.message || 'Spin failed');
      setIsSpinning(false);
    }
  };

  // Handle spin animation complete
  const handleSpinComplete = () => {
    if (!spinResult) return;

    // Calculate winning zones
    const zones = getWinningZones(spinResult);
    setWinningZones(zones);

    // Show result popup
    setShowResultPopup(true);

    // Refresh balance
    gameBalanceContext.fetchBalances();

    // Auto-clear bets after 3 seconds
    setTimeout(() => {
      setPlacedBets([]);
      setIsSpinning(false);
    }, 3000);
  };

  return (
    <GameLayout noScroll>
      <div className="flex flex-col min-h-screen bg-gradient-to-b from-pure-black to-dfinity-navy">
        {/* Wheel section */}
        <div className="flex-shrink-0 py-8">
          <RouletteWheel
            targetNumber={targetNumber}
            isSpinning={isSpinning}
            onSpinComplete={handleSpinComplete}
          />
        </div>

        {/* Spin button */}
        <div className="flex justify-center py-4">
          <button
            onClick={handleSpin}
            disabled={isSpinning || placedBets.length === 0}
            className="px-12 py-4 bg-dfinity-turquoise text-black font-bold text-xl rounded-lg hover:bg-dfinity-green disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSpinning ? 'SPINNING...' : `SPIN (${formatUSDT(totalBetAmount)})`}
          </button>
        </div>

        {/* Betting table */}
        <div className="flex-1 py-8 px-4">
          <RouletteBettingTable
            placedBets={placedBets}
            onBetClick={handleBetClick}
            onChipClick={handleChipClick}
            hoveredZone={hoveredZone}
            onHover={setHoveredZone}
            winningZones={winningZones}
          />
        </div>

        {/* Error display */}
        {gameError && (
          <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-red-500/90 text-white px-6 py-3 rounded-lg">
            {gameError}
          </div>
        )}

        {/* Result popup */}
        <RouletteResultPopup
          show={showResultPopup}
          spinResult={spinResult}
          onHide={() => setShowResultPopup(false)}
        />
      </div>

      {/* Betting rail (bottom fixed) */}
      <BettingRail
        betAmount={betAmount}
        onBetChange={setBetAmount}
        maxBet={Number(maxBet.current) / 1e8}
        gameBalance={balance.game}
        walletBalance={walletBalance}
        houseBalance={balance.house}
        ledgerActor={ledgerActor}
        gameActor={actor}
        onBalanceRefresh={() => gameBalanceContext.fetchBalances()}
        disabled={isSpinning}
        multiplier={35} // Max payout (straight bet)
        canisterId={'wvrcw-3aaaa-aaaah-arm4a-cai'}
        isBalanceLoading={gameBalanceContext.isLoading}
        isBalanceInitialized={gameBalanceContext.isInitialized}
      />
    </GameLayout>
  );
}
```

---

### Phase 6: Result Popup & Polish

**File**: `openhouse_frontend/src/components/game-specific/roulette/RouletteResultPopup.tsx` (NEW)

```typescript
// PSEUDOCODE
import { motion, AnimatePresence } from 'framer-motion';
import { formatUSDT } from '../../utils/currency';
import type { SpinResult } from '../../declarations/roulette_backend/roulette_backend.did.d.ts';
import { getNumberColor } from './constants';

interface RouletteResultPopupProps {
  show: boolean;
  spinResult: SpinResult | null;
  onHide: () => void;
}

export function RouletteResultPopup({ show, spinResult, onHide }: RouletteResultPopupProps) {
  if (!spinResult) return null;

  const isWin = spinResult.net_result > 0n;
  const netResult = spinResult.net_result;

  // Auto-dismiss after 3 seconds
  useEffect(() => {
    if (show) {
      const timer = setTimeout(onHide, 3000);
      return () => clearTimeout(timer);
    }
  }, [show, onHide]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          className="fixed inset-0 flex items-center justify-center pointer-events-none z-50"
        >
          <div className={`
            bg-black/90 backdrop-blur-lg
            border-2 ${isWin ? 'border-dfinity-green' : 'border-dfinity-red'}
            rounded-2xl px-12 py-8
            shadow-2xl
          `}>
            {/* Winning number */}
            <div className="text-center mb-4">
              <div className="text-6xl font-bold font-mono" style={{ color: getNumberColor(spinResult.winning_number) }}>
                {spinResult.winning_number}
              </div>
              <div className="text-sm text-gray-400 mt-2">
                {spinResult.color}
              </div>
            </div>

            {/* Net result */}
            <div className="text-center">
              <div className={`text-4xl font-bold ${isWin ? 'text-dfinity-green' : 'text-dfinity-red'}`}>
                {isWin ? '+' : ''}{formatUSDT(netResult)}
              </div>
              <div className="text-sm text-gray-400 mt-1">
                Total Payout: {formatUSDT(spinResult.total_payout)}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

---

**File**: `openhouse_frontend/src/components/game-specific/roulette/index.ts` (NEW)

```typescript
// PSEUDOCODE
export { RouletteWheel } from './RouletteWheel';
export { WheelCanvas } from './WheelCanvas';
export { RouletteBettingTable } from './RouletteBettingTable';
export { TableGrid } from './TableGrid';
export { BetZones } from './BetZones';
export { PlacedChips } from './PlacedChips';
export { RouletteResultPopup } from './RouletteResultPopup';
export * from './constants';
export * from './utils';
```

---

**File**: `openhouse_frontend/src/pages/roulette/index.ts` (MODIFY)

```typescript
// PSEUDOCODE
// Change import from './RouletteGame' to './RouletteGame'
export { default } from './RouletteGame';
```

---

### Files to Delete (Blackjack Components)

1. `openhouse_frontend/src/components/game-specific/roulette/Card.tsx`
2. `openhouse_frontend/src/components/game-specific/roulette/Hand.tsx`
3. `openhouse_frontend/src/components/game-specific/roulette/RouletteTable.tsx`

**Command**: `rm openhouse_frontend/src/components/game-specific/roulette/Card.tsx openhouse_frontend/src/components/game-specific/roulette/Hand.tsx openhouse_frontend/src/components/game-specific/roulette/RouletteTable.tsx`

---

## Deployment Strategy

### Affected Components
- **Frontend only** - No backend changes
- **Canister**: `pezw3-laaaa-aaaal-qssoa-cai` (OpenHouse Frontend)

### Build & Deploy Commands
```bash
# Build frontend
cd openhouse_frontend
npm run build

# Deploy to mainnet
cd ..
./deploy.sh --frontend-only
```

### Verification
```bash
# Check frontend canister status
dfx canister --network ic status pezw3-laaaa-aaaal-qssoa-cai

# Visit live site
echo "Test at: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io/roulette"
```

---

## Testing Checklist (Manual - No Automated Tests)

After deployment, manually verify on mainnet:

- [ ] Route `/roulette` loads without errors
- [ ] Roulette wheel renders (Canvas)
- [ ] Betting table renders (SVG) with all 37 numbers + outside bets
- [ ] Click number → chip appears
- [ ] Click chip → chip removed
- [ ] Click SPIN → wheel spins for 2.5s
- [ ] Winning number highlighted
- [ ] Result popup shows with correct payout
- [ ] Balance updates after spin
- [ ] All 13 bet types work:
  - [ ] Straight (single number)
  - [ ] Red/Black
  - [ ] Even/Odd
  - [ ] Low/High
  - [ ] Column (3 types)
  - [ ] Dozen (3 types)
  - [ ] Split (test one)
  - [ ] Street (test one)
  - [ ] Corner (test one)
  - [ ] SixLine (test one)
- [ ] Mobile responsive (320px width)
- [ ] Error states (insufficient balance, max 20 bets)

---

## Risk Mitigation

1. **Bet zone click detection** - Split/street/corner zones overlap
   - Solution: Render split zones as thin rectangles between cells
   - Test: Click between two numbers should register split bet

2. **Canvas animation performance** - Must maintain 60fps
   - Solution: Use requestAnimationFrame, keep draw calls minimal
   - Test: Open DevTools Performance tab during spin

3. **Mobile touch targets** - Minimum 44px for accessibility
   - Solution: Scale SVG cells appropriately on mobile
   - Test: Touch each number on iPhone SE (smallest screen)

4. **Type mapping** - UI bet format → backend Candid format
   - Solution: Comprehensive mapUIBetToBackend function with all 13 types
   - Test: Place each bet type, inspect network request payload

---

## Success Criteria

✅ Frontend builds without errors
✅ Deploys to mainnet successfully
✅ All 13 bet types functional
✅ Wheel animation smooth (60fps)
✅ Mobile responsive
✅ Matches Plinko dark cyberpunk aesthetic
✅ Balance tracking accurate
✅ Error handling graceful

---

## Handoff Instructions

1. **Create worktree** first:
   ```bash
   cd /home/theseus/alexandria/openhouse
   git worktree add ../openhouse-roulette-frontend -b feature/roulette-frontend-european master
   cd ../openhouse-roulette-frontend
   ```

2. **Implement** all 6 phases sequentially

3. **Deploy to mainnet** (mandatory)

4. **Create PR** (mandatory - see orchestrator header)

5. **Iterate** autonomously until approved

**Execute this plan by running the orchestrator workflow at the top of this file.**
