# Game of Life UI Polish Spec

## Overview

This is a **multiplayer territorial warfare** variant of Conway's Game of Life:
- 512x512 grid, 16 quadrants, up to 9 players
- 8 elemental factions (Earth, Water, Fire, Stone, Light, Ice, Plasma, Void)
- Territory control + coin economy
- Strategic pattern placement (gliders, guns, puffers)

**Current state**: Desktop only, functional but dense UI, ~3,700 lines in main file

## Key Files

### Core
- `src/pages/Life.tsx` - Main game (3,689 lines - very large)
- `src/pages/lifeConstants.ts` - Colors, grid config
- `src/components/LifeGameCard.tsx` - Homepage card

### Rendering (Canvas 2D)
- `src/pages/life/rendering/territoryRenderer.ts` - Territory patterns
- `src/pages/life/rendering/elements/*.ts` - 8 element renderers

### Components
- `src/pages/life/components/RegionSelectionModal.tsx`
- `src/pages/life/components/EliminationModal.tsx`

### Engine
- `src/pages/life/engine/OptimisticSimulation.ts` - Local sim for smooth rendering
- `src/pages/life/state/GameStateManager.ts`

### Tutorial
- `src/pages/life/tutorial/RiskTutorial.tsx`

---

## Priority 1: HUD Clarity

### Target: `Life.tsx`

**Current state**: Dense, unclear information hierarchy
**Goal**: Clean HUD showing essential info at a glance

Add/improve:
- Player stats panel (coins, territory %, cells alive)
- Turn/generation counter
- Sync status indicator (connected, syncing, error)
- Current element/faction badge
- Zoom level indicator

**Pattern**: Use Framer Motion for smooth HUD transitions

---

## Priority 2: Minimap

### Target: `Life.tsx`

**Current state**: No minimap exists
**Goal**: Small overview showing full 512x512 grid with territory colors

Features:
- Corner-positioned minimap (128x128 or 64x64 pixels)
- Color-coded regions by owner
- Current viewport indicator (rectangle showing visible area)
- Click to pan to location
- Collapsible on mobile

---

## Priority 3: Pattern Library UI

### Target: `Life.tsx` or new component

**Current state**: 60+ patterns available but no visible selection UI
**Goal**: Browsable pattern picker

Features:
- Categorized patterns (Still Lifes, Oscillators, Spaceships, Guns, etc.)
- Pattern preview thumbnails
- Quick-select favorites
- Search/filter
- Animated preview on hover

Location: `src/pages/life/patterns/` has the data

---

## Priority 4: Element Visual Effects

### Target: `src/pages/life/rendering/elements/*.ts`

**Current state**: Good base textures, but static
**Goal**: Subtle animated effects per element

Ideas per element:
- **Fire**: Flickering glow, ember particles
- **Water**: Shimmer/wave animation
- **Plasma**: Electric crackle effect
- **Light**: Radiant pulse
- **Ice**: Crystalline sparkle
- **Void**: Dark energy wisps
- **Earth**: Subtle grass sway
- **Stone**: None (static fits theme)

Note: These are Canvas-based, so use frame-based animation in render loop

---

## Priority 5: Game State Transitions

### Target: `Life.tsx`

**Current state**: Functional but abrupt state changes
**Goal**: Smooth transitions between game phases

States to polish:
- Joining game → Region selection
- Region selection → Game start
- Active play → Elimination
- Victory/defeat screens

Use Framer Motion AnimatePresence for overlays

---

## Priority 6: Mobile Responsiveness

### Target: `Life.tsx`, `LifeGameCard.tsx`

**Current state**: Desktop only, card says "Desktop Only"
**Goal**: Basic mobile support (even if simplified)

Considerations:
- Touch controls for pan/zoom
- Simplified HUD for small screens
- Portrait-friendly layout
- Reduced render quality option for performance

---

## Priority 7: Network Sync Feedback

### Target: `Life.tsx`

**Current state**: Optimistic simulation runs but no visible sync status
**Goal**: Clear feedback on network state

Add:
- Sync indicator (green dot when synced, yellow when syncing)
- Generation lag indicator
- Reconnection UI if disconnected
- Transaction pending indicator

---

## Constraints

1. **Don't break game logic** - Backend sync must still work
2. **Performance** - 512x512 grid = 262,144 cells, keep it smooth
3. **Canvas rendering** - Element effects must work in Canvas 2D context
4. **TypeScript strict** - Maintain types
5. **Framer Motion** - Use for React UI animations (not canvas internals)

## Quality Gate

```bash
cd openhouse_frontend && npm run build
```

## Deployment

```bash
cd /home/theseus/alexandria/openhouse && ./deploy.sh
```

Test at: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io/life
