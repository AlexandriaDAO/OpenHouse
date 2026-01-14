# AUTONOMOUS PR ORCHESTRATOR - DO NOT SKIP

**You are an autonomous PR orchestrator. Your ONLY job is to implement this plan and create a PR.**

## Isolation Check (RUN FIRST)
```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
if [ "$REPO_ROOT" = "/home/theseus/alexandria/openhouse" ]; then
    echo "FATAL: In main repo. Must be in worktree."
    echo "Worktree: /home/theseus/alexandria/openhouse-crash-background"
    exit 1
fi
echo "In isolated worktree: $REPO_ROOT"
```

## Your Autonomous Workflow (NO QUESTIONS ALLOWED)
1. **Verify isolation** - You must be in worktree: `/home/theseus/alexandria/openhouse-crash-background`
2. **Implement feature** - Follow plan sections below
3. **Build & Deploy to Mainnet**:
   ```bash
   cd openhouse_frontend && npm run build && cd ..
   ./deploy.sh
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
   git commit -m "refactor(crash): subtle ambient background replacing cosmic encounters"
   git push -u origin feature/crash-subtle-background
   gh pr create --title "Crash: Subtle Ambient Space Background" --body "$(cat <<'EOF'
## Summary
- Removes distracting cosmic encounters (planets, galaxies, black holes)
- Implements subtle ambient space background that doesn't compete with rockets
- Adds parallax star depth and gentle nebula glow that fades into background
- Creates "rockets flying through space" feel inspired by Smash Bros backgrounds

Deployed to mainnet:
- Frontend: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io
EOF
)"
   ```

6. **Iterate autonomously**:
   - FOR i=1 to 5:
     - Check review: `gh pr view [NUM] --json comments`
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

**Branch:** `feature/crash-subtle-background`
**Worktree:** `/home/theseus/alexandria/openhouse-crash-background`

---

# Implementation Plan: Subtle Ambient Space Background

## Problem Statement

The current Cosmic Encounters system has several issues:
1. **Awkward timing**: Planets/objects spawn based on probability checks every 500ms, appearing suddenly
2. **Full opacity**: Objects fade to 100% opacity, drawing more attention than the rockets
3. **Static sizing**: Despite variance (baseSize +/- sizeVariance), objects feel repetitive
4. **Disconnected**: Celestial objects feel unrelated to the core rocket experience
5. **Distracting**: Background competes with rockets rather than supporting them

**Goal**: Create a "Super Smash Bros" style background - interesting but unobtrusive. Just rockets flying through space.

## Current State Analysis

### Files to Modify
- `openhouse_frontend/src/components/game-specific/crash/CrashCanvas.tsx` (lines 16-223, 269-271, 374-476, 1098-1180)
- `openhouse_frontend/src/components/game-specific/crash/CrashRocket.css` (lines 224-265)

### Current Cosmic Encounters System (TO BE REMOVED)
```typescript
// Lines 16-28: SPACE_ASSETS configuration
const SPACE_ASSETS = {
  planets: ['planet0.png', ...],  // 6 planets
  galaxies: ['galaxy0.png', ...], // 5 galaxies
  blackholes: [...],              // 4 black holes
  nebulas: [...]                  // 2 nebulas
};

// Lines 102-129: Encounter spawn configuration
const ENCOUNTER_CONFIG = {
  MAX_ON_SCREEN: 6,
  CHECK_INTERVAL_MS: 1500,
  BASE_CHANCE: 0.10,       // 10% base spawn chance
  CHANCE_PER_MULT: 0.02,   // +2% per multiplier level
  // ...
};

// Lines 136-155: CosmicEncounter type and interface
// Lines 167-223: Altitude-based encounter spawning logic
// Lines 269-271: State management for encounters
// Lines 374-476: Encounter spawn checking and lifecycle
// Lines 1098-1180: Encounter rendering with drift/fade effects
```

### What Works Well (KEEP)
1. **Layered star system** (lines 1227-1300): Three-depth parallax stars (distant/mid/near)
2. **Atmosphere gradient** (lines 618-687): Smooth color transitions based on altitude
3. **Horizon glow** (lines 750-773): Layered atmospheric glow at low altitude
4. **Nebula backgrounds** (lines 812-935): Subtle blurred nebula glow at high multipliers
5. **Star parallax drift** (lines 780-810): Stars drift at high multipliers

## Implementation Strategy

### Phase 1: Remove Cosmic Encounters System

Delete the following from `CrashCanvas.tsx`:

1. **Lines 16-28**: Remove `SPACE_ASSETS` object and `getRandomSpaceAsset()` function
2. **Lines 66-80**: Remove space asset preloading from `preloadAllRocketImages()`
3. **Lines 102-155**: Remove `ENCOUNTER_CONFIG`, encounter type definitions, and `CosmicEncounter` interface
4. **Lines 167-223**: Remove `getEncounterTypeForAltitude()` and `getEncounterVisual()` functions
5. **Lines 269-271**: Remove `encounters` state and `lastEncounterCheckRef`
6. **Lines 374-423**: Remove `checkForEncounter()` callback
7. **Lines 433-447**: Remove encounter cleanup effects
8. **Lines 454-476**: Remove encounter check interval
9. **Lines 1098-1180**: Remove entire Cosmic Encounters rendering layer

Delete from `CrashRocket.css`:

1. **Lines 224-265**: Remove `.cosmic-encounter-*` animation classes

### Phase 2: Enhance Ambient Background

Enhance the remaining background systems for a more subtle, immersive feel:

#### 2A: Reduce Nebula Opacity (SUBTLE is key)

```typescript
// PSEUDOCODE - Line ~710
// Current: nebulaOpacity = deepSpaceProgress * 0.35
// Change to much subtler values:
const nebulaOpacity = deepSpaceProgress * 0.15;  // Was 0.35
```

```typescript
// PSEUDOCODE - Lines ~815-884 (nebula divs)
// Reduce all nebula opacities by ~60%
// Purple nebula: rgba(60, 20, 80, ${nebulaOpacity}) -> multiply nebulaOpacity by 0.4
// Cyan nebula: ${nebulaOpacity * 0.8} -> * 0.3
// Galaxy glow: ${nebulaOpacity * 0.6} -> * 0.2
// Deep cosmic veils (500x+): reduce proportionally
```

#### 2B: Add Subtle Particle Drift (Optional Enhancement)

Instead of prominent celestial objects, add very subtle floating dust particles:

```typescript
// PSEUDOCODE - New component inside CrashCanvas
// Very subtle dust particles that drift past at high multipliers
// Only visible at 50x+ when deep in space
// Max opacity: 0.15 (barely visible, adds texture)
// Size: 1-3px
// Count: 20-30 particles
// Drift: follow star parallax pattern but faster

interface SpaceDust {
  id: string;
  x: number;      // 0-100%
  y: number;      // 0-100%
  size: number;   // 1-3px
  opacity: number; // 0.05-0.15
  speed: number;  // drift speed multiplier
}

// Spawn dust particles once, let them drift with parallax
// No spawning/despawning during flight - static set that drifts
```

#### 2C: Enhance Star Layer for More Depth

```typescript
// PSEUDOCODE - Lines ~1252-1275
// Add a 4th "ultra-distant" star layer with more stars, smaller size, less opacity
// This creates richer background texture without being distracting

const layers: Record<'cosmic' | 'distant' | 'mid' | 'near', StarLayerConfig> = {
  cosmic: {    // NEW - ultra far background stars
    count: 80,
    sizeRange: [0.3, 0.6],
    opacityRange: [0.1, 0.2],
    twinkleDuration: 6,  // Very slow twinkle
    driftSpeed: 0,       // No parallax
  },
  distant: { /* existing */ },
  mid: { /* existing */ },
  near: { /* existing - consider reducing count to 10 */ },
};
```

### Phase 3: Fine-tune Transitions

```typescript
// PSEUDOCODE - Smoother nebula transitions at altitude boundaries
// Add easing to nebula opacity based on multiplier bands
// Prevents sudden appearance/disappearance

const getSmoothedNebulaOpacity = (multiplier: number) => {
  if (multiplier < 15) return 0;  // No nebula below 15x
  if (multiplier < 25) {
    // Fade in from 15x to 25x
    return ((multiplier - 15) / 10) * 0.15;
  }
  // Full subtle opacity above 25x
  return Math.min(0.15, Math.log10(multiplier / 20) * 0.1);
};
```

## Code Changes Summary

### CrashCanvas.tsx Changes

| Section | Line Range | Action |
|---------|------------|--------|
| SPACE_ASSETS | 16-28 | DELETE |
| Space preloading | 66-80 | DELETE |
| ENCOUNTER_CONFIG | 102-129 | DELETE |
| Encounter types | 131-155 | DELETE |
| getEncounterTypeForAltitude | 167-187 | DELETE |
| getEncounterVisual | 189-223 | DELETE |
| encounters state | 269-271 | DELETE |
| checkForEncounter | 374-423 | DELETE |
| encounter cleanup | 433-447 | DELETE |
| encounter interval | 454-476 | DELETE |
| Encounter render layer | 1098-1180 | DELETE |
| nebulaOpacity | ~710 | MODIFY: 0.35 -> 0.15 |
| nebula elements | 815-884 | MODIFY: reduce opacities |
| Star layers | 1252-1275 | MODIFY: add cosmic layer |

**Estimated impact**: ~200 lines removed, ~30 lines modified, ~20 lines added = **-150 LOC**

### CrashRocket.css Changes

| Section | Line Range | Action |
|---------|------------|--------|
| cosmic-encounter animations | 224-265 | DELETE |

**Estimated impact**: -41 lines

## Testing Checklist (Manual Verification)

After deployment, verify on https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io:

- [ ] No planets/galaxies/black holes appear during flight
- [ ] Stars visible and twinkling at all multiplier levels
- [ ] Nebula glow is subtle, not distracting (barely noticeable)
- [ ] Rockets are clearly the visual focus
- [ ] Background transitions smoothly with altitude
- [ ] No console errors
- [ ] Performance feels smooth (no extra state updates from encounter system)

## Visual Goals

| Aspect | Before | After |
|--------|--------|-------|
| Celestial objects | Planets, galaxies, black holes pop in | None - clean space |
| Background focus | Competing with rockets | Supporting rockets |
| Opacity levels | Objects reach 100% | Max nebula ~15% |
| Animation | Spinning objects, spawn/despawn | Gentle star twinkle, subtle drift |
| Overall feel | "Space theme park" | "Rockets in the void" |

## Files Affected

1. `openhouse_frontend/src/components/game-specific/crash/CrashCanvas.tsx`
2. `openhouse_frontend/src/components/game-specific/crash/CrashRocket.css`

## Deployment Notes

- Frontend-only change
- No backend canister updates needed
- Deploy with: `./deploy.sh`
