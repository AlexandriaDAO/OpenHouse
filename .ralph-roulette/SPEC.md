# Roulette Polish Spec

## Objective
Transform the roulette game from functional to stunning. Focus on visual polish, animation refinement, and delightful details.

## Key Files

### Core Components
- `src/components/game-specific/roulette/RouletteWheel.tsx` - SVG wheel rendering
- `src/components/game-specific/roulette/useRouletteAnimation.ts` - Animation logic
- `src/components/game-specific/roulette/rouletteConstants.ts` - Colors, dimensions, timing
- `src/pages/roulette/RouletteGame.tsx` - Main game page

### Betting Board
- `src/components/game-specific/roulette/BettingBoard/MobileBettingBoard.tsx`
- `src/components/game-specific/roulette/BettingBoard/components/*.tsx`

---

## Priority 1: Wheel Visual Enhancement

### Target: `RouletteWheel.tsx`

**Current state**: Basic SVG with simple radial gradients
**Goal**: Rich, casino-quality wheel with depth and realism

Ideas:
- Add subtle 3D bevel effect to pocket segments
- Enhance gold rim with metallic shine gradient
- Add shadow under the ball for depth
- Improve number text legibility (slight text shadow)
- Add decorative spokes between hub and pockets
- Subtle reflection/highlight on the wheel surface

**Pattern**:
```tsx
// Enhanced gradient example
<radialGradient id="pocketRedGradient" cx="50%" cy="30%">
  <stop offset="0%" stopColor="#DC2626" />
  <stop offset="70%" stopColor="#B91C1C" />
  <stop offset="100%" stopColor="#7F1D1D" />
</radialGradient>
```

---

## Priority 2: Ball Animation Polish

### Target: `useRouletteAnimation.ts` and `RouletteWheel.tsx`

**Current state**: Smooth easing but mechanical feel
**Goal**: More realistic ball behavior

Ideas:
- Add subtle ball "wobble" during high-speed spin (tiny radius oscillation)
- Ball shadow that elongates during fast spin
- Slight bounce when ball settles into pocket
- Ball trail/blur effect during fast spin (SVG filter or multiple balls with opacity)
- More dramatic "settling" animation with micro-bounces

---

## Priority 3: Result Celebration

### Target: `RouletteWheel.tsx` (result overlay) and `RouletteGame.tsx`

**Current state**: Basic black circle overlay with pulsing number (line 260-274)
**Goal**: Exciting win celebration, clear loss indication

Ideas:
- Winning pocket glows and pulses
- Confetti or particle burst on big wins
- Result overlay scales in with spring animation
- Color-coded result (red number pulses red, black pulses white, green for 0)
- Show payout calculation animation

---

## Priority 4: Recent Results History

### Target: `RouletteGame.tsx`

**Current state**: `recentResults` state exists (line 51) but is NOT displayed anywhere
**Goal**: Add a visual history strip showing recent winning numbers

Ideas:
- Horizontal strip of recent numbers (last 10-15)
- Color-coded circles (red/black/green)
- Subtle entrance animation for new results
- Optional: hot/cold number indication

**Location**: Above or below the wheel, or in a sidebar on desktop

---

## Priority 5: Betting Board Interaction Polish

### Target: `RouletteGame.tsx` betting buttons (mobile lines 309-425, desktop lines 579-696)

**Current state**: Basic buttons with opacity changes
**Goal**: Satisfying chip placement feel

Ideas:
- Chip "drop" animation when placing bet (scale from 0.5 to 1 with bounce)
- Ripple effect on number tap
- Highlight winning numbers on the board after result
- Smooth chip stack growth animation when adding to existing bet
- Subtle hover glow on desktop

---

## Priority 6: State Transition Polish

### Target: `RouletteGame.tsx`

**Current state**: Abrupt transitions between idle/spinning/landing/result
**Goal**: Smooth, cinematic transitions

Ideas:
- Dim the betting board slightly during spin (focus on wheel)
- "NO MORE BETS" overlay when spin starts
- Smooth fade between states
- Anticipation build-up during landing phase

---

## Constraints

1. **Don't break game logic** - All bets must still work correctly
2. **Performance** - Keep animations smooth on mobile
3. **TypeScript strict** - Maintain type safety
4. **framer-motion** - Use for React animations (already installed)
5. **SVG animations** - Use CSS or SMIL for wheel internals where appropriate

## Quality Gate

```bash
cd openhouse_frontend && npm run build
```

Build must pass.

## Deployment

```bash
cd /home/theseus/alexandria/openhouse && ./deploy.sh
```

Test at: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io/roulette
