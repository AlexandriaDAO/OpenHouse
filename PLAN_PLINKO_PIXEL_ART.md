# AUTONOMOUS PR ORCHESTRATOR - DO NOT SKIP

**You are an autonomous PR orchestrator. Your ONLY job is to implement this plan and create a PR.**

## Isolation Check (RUN FIRST)
```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
if [ "$REPO_ROOT" = "/home/theseus/alexandria/openhouse" ]; then
    echo "FATAL: In main repo. Must be in worktree."
    echo "Worktree: /home/theseus/alexandria/openhouse-pixel-plinko"
    exit 1
fi
echo "In isolated worktree: $REPO_ROOT"
```

## Your Autonomous Workflow (NO QUESTIONS ALLOWED)
1. **Verify isolation** - You must be in worktree: `/home/theseus/alexandria/openhouse-pixel-plinko`
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
   echo "Visit: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io/plinko"
   ```
5. **Create PR** (MANDATORY):
   ```bash
   git add .
   git commit -m "feat(plinko): pixel art visual overhaul"
   git push -u origin feature/plinko-pixel-art
   gh pr create --title "Plinko: Pixel Art Visual Overhaul" --body "$(cat <<'EOF'
## Summary
- Transforms Plinko game from generic vector graphics to cohesive pixel art style
- Uses NEAREST neighbor scaling for crisp pixel rendering
- All elements (pegs, ball, slots, bucket) rendered as pixel art
- Adds pixel font for multiplier text

## Changes
- `LayoutConfig.ts`: Add pixel art constants and color palette
- `PegRenderer.ts`: Pixel circle pegs instead of smooth circles
- `BallRenderer.ts`: Pixel ball with simple highlight
- `SlotRenderer.ts`: Sharp-cornered slots with pixel font
- `BucketRenderer.ts`: Simplified pixel bucket
- `PlinkoPixiApp.ts`: Set NEAREST scale mode

## Test plan
- [ ] Visit https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io/plinko
- [ ] Verify pegs render as crisp pixel circles
- [ ] Verify ball animates smoothly with pixel aesthetic
- [ ] Verify slots display multipliers in pixel font
- [ ] Verify bucket interaction works
- [ ] Test drop ball functionality

Deployed to mainnet:
- Frontend: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io

Generated with Claude Code
EOF
)"
   ```
6. **Iterate autonomously** - Fix any P0 review issues

## CRITICAL RULES
- NO questions ("should I?", "want me to?")
- NO skipping PR creation
- MAINNET DEPLOYMENT: All changes go directly to production
- ONLY stop at: approved, max iterations, or error

**Branch:** `feature/plinko-pixel-art`
**Worktree:** `/home/theseus/alexandria/openhouse-pixel-plinko`

---

# Implementation Plan: Plinko Pixel Art Transformation

## Task Classification
**REFACTORING** - Transform existing vector graphics to pixel art style (visual change only, no logic changes)

## Current State

### Files to Modify
```
openhouse_frontend/src/components/game-specific/plinko/pixi/
├── LayoutConfig.ts      # Add pixel constants, color palette
├── PegRenderer.ts       # Replace smooth circles with pixel circles
├── BallRenderer.ts      # Replace smooth ball with pixel ball
├── SlotRenderer.ts      # Replace rounded rects with pixel boxes
├── BucketRenderer.ts    # Simplify to pixel bucket
└── PlinkoPixiApp.ts     # Set NEAREST scale mode
```

### Current Implementation
- All elements drawn with Pixi.js Graphics API (smooth vector shapes)
- Anti-aliased circles for pegs and ball
- Rounded rectangles for slots
- JetBrains Mono font for text
- Generic dark theme colors

## Design Decisions

### Approach: Code-Based Pixel Art (No PNG Assets)
Drawing pixel art programmatically is simpler than managing sprite sheets:
- No asset loading/bundling complexity
- Easy to adjust colors and sizes
- Everything stays in version control as code

### Pixel Scale: 4x
Each "game pixel" = 4x4 actual pixels. This provides:
- Good visibility at the 400x420 canvas size
- Clear retro aesthetic
- Easy math (positions divisible by 4)

### Color Palette (Limited 8-Color)
```typescript
PIXEL_COLORS = {
  BLACK: 0x0a0a14,        // Background (keep current)
  DARK_GRAY: 0x2a2a3e,    // Slot background, bucket
  MID_GRAY: 0x4a4a6e,     // Borders, shadows
  LIGHT_GRAY: 0x8888aa,   // Peg shadow
  WHITE: 0xe8e8e8,        // Pegs
  GOLD: 0xffd700,         // Ball, highlights
  GREEN: 0x22c55e,        // Win slots
  RED: 0xef4444,          // Lose indicator (if needed)
}
```

## Implementation

### Step 1: LayoutConfig.ts - Add Pixel Constants

```typescript
// PSEUDOCODE - Add to LayoutConfig.ts

// Pixel scale - each "pixel" is 4x4 actual pixels
export const PIXEL_SCALE = 4;

// Snap to pixel grid
export function snapToPixelGrid(value: number): number {
  return Math.round(value / PIXEL_SCALE) * PIXEL_SCALE;
}

// Pixel art color palette
export const PIXEL_COLORS = {
  BLACK: 0x0a0a14,
  DARK_GRAY: 0x2a2a3e,
  MID_GRAY: 0x4a4a6e,
  LIGHT_GRAY: 0x8888aa,
  WHITE: 0xe8e8e8,
  GOLD: 0xffd700,
  GREEN: 0x22c55e,
  RED: 0xef4444,
} as const;

// Update existing LAYOUT to use pixel-friendly values
// Ensure PEG_RADIUS, BALL_RADIUS, SLOT dimensions are multiples of PIXEL_SCALE
```

### Step 2: PlinkoPixiApp.ts - Set NEAREST Scale Mode

```typescript
// PSEUDOCODE - Modify init() in PlinkoPixiApp.ts

import { SCALE_MODES, BaseTexture } from 'pixi.js';

async init(container: HTMLElement): Promise<void> {
  // Set default scale mode to NEAREST for crisp pixels
  // In Pixi v8, this is done differently than v7
  // Use textureSource.scaleMode = 'nearest' when creating textures
  // Or set on the Application options

  await this.app.init({
    width: LAYOUT.CANVAS_WIDTH,
    height: LAYOUT.CANVAS_HEIGHT,
    backgroundColor: PIXEL_COLORS.BLACK,
    antialias: false,  // CRITICAL: Disable antialiasing for pixel art
    resolution: 1,     // Use 1:1 resolution for crisp pixels
    autoDensity: false,
    // ... rest of config
  });

  // ... rest of init
}
```

### Step 3: PegRenderer.ts - Pixel Circle Pegs

```typescript
// PSEUDOCODE - Replace smooth circles with pixel circles

// Draw a pixel circle (filled)
// For a radius of 8px (2 pixel-units at 4x scale), draw a simple pattern:
//   XX
//  XXXX
//  XXXX
//   XX

function drawPixelCircle(graphics: Graphics, cx: number, cy: number, radius: number): void {
  const ps = PIXEL_SCALE; // 4

  // Simple 8px diameter pixel circle (2 "pixels" radius)
  // Pattern (each X is a 4x4 block):
  //   XX
  //  XXXX
  //  XXXX
  //   XX

  // Top row (2 blocks)
  graphics.rect(cx - ps, cy - ps * 2, ps * 2, ps);

  // Middle rows (4 blocks each)
  graphics.rect(cx - ps * 2, cy - ps, ps * 4, ps);
  graphics.rect(cx - ps * 2, cy, ps * 4, ps);

  // Bottom row (2 blocks)
  graphics.rect(cx - ps, cy + ps, ps * 2, ps);
}

async init(parent: Container, centerX: number): Promise<void> {
  // Create pegs using pixel circles instead of smooth circles
  const pegsGraphics = new Graphics();

  for (let row = 0; row <= this.rows; row++) {
    for (let col = 0; col <= row; col++) {
      const x = snapToPixelGrid(centerX + (col - row / 2) * LAYOUT.PEG_SPACING_X);
      const y = snapToPixelGrid(LAYOUT.DROP_ZONE_HEIGHT + row * LAYOUT.PEG_SPACING_Y);

      drawPixelCircle(pegsGraphics, x, y, LAYOUT.PEG_RADIUS);
    }
  }

  pegsGraphics.fill({ color: PIXEL_COLORS.WHITE });

  // Simple 1-pixel offset shadow (draw first, behind pegs)
  const shadowGraphics = new Graphics();
  // Same loops but offset by PIXEL_SCALE and darker color

  this.container.addChild(shadowGraphics);
  this.container.addChild(pegsGraphics);
  parent.addChild(this.container);
}
```

### Step 4: BallRenderer.ts - Pixel Ball

```typescript
// PSEUDOCODE - Replace smooth ball with pixel ball

function createPixelBall(): Graphics {
  const ball = new Graphics();
  const ps = PIXEL_SCALE;

  // 12px diameter ball (3 "pixels" radius)
  // Pattern:
  //   XXX
  //  XXXXX
  //  XXXXX
  //  XXXXX
  //   XXX

  // Draw main ball shape
  ball.rect(-ps, -ps * 2, ps * 2, ps);           // Top
  ball.rect(-ps * 2, -ps, ps * 4, ps * 3);       // Middle 3 rows
  ball.rect(-ps, ps * 2, ps * 2, ps);            // Bottom
  ball.fill({ color: PIXEL_COLORS.GOLD });

  // Simple highlight (top-left pixel)
  ball.rect(-ps, -ps, ps, ps);
  ball.fill({ color: 0xffffff, alpha: 0.5 });

  return ball;
}

dropBall(id: number, path: boolean[]): void {
  const ballContainer = new Container();
  const ballGraphics = createPixelBall();
  ballContainer.addChild(ballGraphics);

  // Position snapped to grid
  ballContainer.position.set(
    snapToPixelGrid(this.centerX),
    snapToPixelGrid(LAYOUT.DROP_ZONE_HEIGHT - LAYOUT.BALL_RADIUS * 2)
  );

  // ... rest of dropBall logic unchanged
}

update(deltaMS: number): void {
  // Same animation logic, but snap final positions to pixel grid
  // Remove rotation (doesn't work well with pixel art)

  this.balls.forEach((ball) => {
    if (ball.landed) return;

    // ... progress calculation unchanged

    // Snap position to pixel grid for crisp rendering
    const x = snapToPixelGrid(calculateBallX(ball.path, ball.currentRow, ball.progress, this.centerX));
    const y = snapToPixelGrid(calculateBallY(ball.currentRow, ball.progress));

    ball.container.position.set(x, y);

    // NO rotation for pixel art
    // ball.container.rotation = 0;
  });
}
```

### Step 5: SlotRenderer.ts - Pixel Slots with Pixel Font

```typescript
// PSEUDOCODE - Replace rounded rects with sharp pixel boxes

async init(parent: Container, centerX: number, rows: number): Promise<void> {
  // Use sharp rectangles instead of rounded
  const textStyle = new TextStyle({
    fontFamily: '"Press Start 2P", monospace',  // Pixel font (load via CSS)
    fontSize: 8,  // Small for pixel aesthetic
    fontWeight: 'normal',
    fill: 0xffffff,
  });

  for (let i = 0; i < numSlots; i++) {
    const x = snapToPixelGrid(centerX + (i - this.rows / 2) * LAYOUT.PEG_SPACING_X);
    const multiplier = this.multipliers[i] ?? 0.2;
    const isWin = multiplier >= 1.0;

    const slotGraphic = new Graphics();
    slotGraphic.position.set(x, slotY);

    // Sharp rectangle (no rounding)
    slotGraphic.rect(
      -LAYOUT.SLOT_WIDTH / 2,
      0,
      LAYOUT.SLOT_WIDTH,
      LAYOUT.SLOT_HEIGHT
    );
    slotGraphic.fill({ color: isWin ? 0x1a3d2e : PIXEL_COLORS.DARK_GRAY });

    // 1-pixel border (using PIXEL_SCALE)
    slotGraphic.rect(-LAYOUT.SLOT_WIDTH / 2, 0, LAYOUT.SLOT_WIDTH, PIXEL_SCALE);  // Top
    slotGraphic.rect(-LAYOUT.SLOT_WIDTH / 2, LAYOUT.SLOT_HEIGHT - PIXEL_SCALE, LAYOUT.SLOT_WIDTH, PIXEL_SCALE);  // Bottom
    slotGraphic.rect(-LAYOUT.SLOT_WIDTH / 2, 0, PIXEL_SCALE, LAYOUT.SLOT_HEIGHT);  // Left
    slotGraphic.rect(LAYOUT.SLOT_WIDTH / 2 - PIXEL_SCALE, 0, PIXEL_SCALE, LAYOUT.SLOT_HEIGHT);  // Right
    slotGraphic.fill({ color: isWin ? PIXEL_COLORS.GREEN : PIXEL_COLORS.MID_GRAY });

    // ... text creation with pixel font
  }
}
```

### Step 6: BucketRenderer.ts - Simplified Pixel Bucket

```typescript
// PSEUDOCODE - Simplify bucket to rectangular pixel shape

async init(parent: Container, centerX: number): Promise<void> {
  // Simple rectangular bucket instead of trapezoid
  // Easier to render as pixel art

  this.bucketBody.clear();

  // Main body - simple rectangle
  this.bucketBody.rect(
    -LAYOUT.BUCKET_WIDTH / 2,
    10,
    LAYOUT.BUCKET_WIDTH,
    LAYOUT.BUCKET_HEIGHT - 10
  );
  this.bucketBody.fill({ color: PIXEL_COLORS.DARK_GRAY });

  // Pixel border (draw 4 sides separately for crisp edges)
  const ps = PIXEL_SCALE;
  // Top border
  this.bucketBody.rect(-LAYOUT.BUCKET_WIDTH / 2, 10, LAYOUT.BUCKET_WIDTH, ps);
  // Bottom border
  this.bucketBody.rect(-LAYOUT.BUCKET_WIDTH / 2, LAYOUT.BUCKET_HEIGHT - ps, LAYOUT.BUCKET_WIDTH, ps);
  // Left border
  this.bucketBody.rect(-LAYOUT.BUCKET_WIDTH / 2, 10, ps, LAYOUT.BUCKET_HEIGHT - 10);
  // Right border
  this.bucketBody.rect(LAYOUT.BUCKET_WIDTH / 2 - ps, 10, ps, LAYOUT.BUCKET_HEIGHT - 10);
  this.bucketBody.fill({ color: PIXEL_COLORS.MID_GRAY });

  // Simple rectangular doors instead of angled
  // ... simplified door rendering

  // "DROP" label with pixel font
  this.labelText = new Text({
    text: 'DROP',
    style: new TextStyle({
      fontFamily: '"Press Start 2P", monospace',
      fontSize: 10,
      fill: 0xffffff,
    }),
  });
}
```

### Step 7: Load Pixel Font (index.css or PlinkoGame.tsx)

```css
/* PSEUDOCODE - Add to index.css or create font import */

@import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');

/* OR use local fallback if Google Fonts unavailable */
```

## Deployment Notes

**Affected Components:**
- Frontend only (no backend changes)
- Plinko game visual rendering

**Canister:**
- Frontend: `pezw3-laaaa-aaaal-qssoa-cai`

**Deploy Command:**
```bash
cd openhouse_frontend && npm run build && cd .. && ./deploy.sh --frontend-only
```

## Verification Checklist

After deployment:
- [ ] Pegs render as crisp pixel circles (not smooth)
- [ ] Ball is a pixel ball with simple highlight
- [ ] Ball animation is smooth (positions snapped to grid)
- [ ] Slots have sharp corners (no rounding)
- [ ] Multiplier text uses pixel font
- [ ] Bucket is simplified rectangle with pixel border
- [ ] DROP button interaction still works
- [ ] Overall aesthetic is cohesive retro/pixel style
- [ ] No blurry edges on any elements

## Rollback Plan

If visual issues occur:
```bash
git revert HEAD
cd openhouse_frontend && npm run build && cd ..
./deploy.sh --frontend-only
```
