# Cosmic Encounters System - Crash Game

## Objective
Add dynamic space scenery that appears during flight based on altitude. Objects fade in at random positions, linger briefly, then fade out - like looking out a spaceship window as you travel through space. Higher altitudes = more frequent and exotic encounters.

**This is a VISIBLE, user-facing feature. The encounters should be noticeable and delightful, not subtle.**

## Key Files
- `openhouse_frontend/src/components/game-specific/crash/CrashCanvas.tsx` - Main canvas, add encounter system here
- `openhouse_frontend/src/components/game-specific/crash/CrashRocket.css` - Add fade animations
- `openhouse_frontend/public/cosmic/` - Create this folder for pixel art sprites (PNG)

## Constraints (DO NOT CHANGE)
- **Game logic** - All betting, payout calculations stay the same
- **Rocket rendering** - Don't modify rocket sprites or trajectory logic
- **Existing atmosphere** - Keep the gradient backgrounds, just layer encounters on top

---

## Core Mechanic: Probability Formula

**Base formula:** `encounterChance = 5% × (currentMultiplier / 10)`

| Multiplier | Chance per check | Example |
|------------|------------------|---------|
| 10x | 5% | Rare satellite |
| 25x | 12.5% | Occasional asteroid |
| 50x | 25% | Common at this height |
| 100x | 50% | Expect something cool |
| 200x+ | 100% (capped) | Guaranteed encounter |

**Check frequency:** Roll for encounter every 2-3 seconds of flight time (not every frame).

**Only track highest rocket:** Use `maxCurrentMultiplier` to determine altitude zone and probability.

---

## Priority 1: Encounter System Infrastructure
### Target: `CrashCanvas.tsx`

Create the core encounter state and logic. Add these near the top of the component:

```tsx
interface CosmicEncounter {
  id: string;
  type: EncounterType;
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  startTime: number;
  duration: number; // ms, typically 3000-6000
  scale: number; // size multiplier
}

type EncounterType =
  | 'satellite' | 'astronaut' | 'spaceStation'  // Low orbit (5x-20x)
  | 'asteroid' | 'comet' | 'moon'               // Deep space (20x-60x)
  | 'planet_ringed' | 'planet_gas' | 'alienProbe' // Outer system (60x-120x)
  | 'alienShip' | 'wormhole' | 'dysonSphere'    // Interstellar (120x-250x)
  | 'galaxy' | 'blackHole' | 'cosmicEntity';    // Cosmic (250x+)
```

Add state inside the component:
```tsx
const [encounters, setEncounters] = useState<CosmicEncounter[]>([]);
const lastEncounterCheckRef = useRef<number>(0);
```

**Encounter check function:**
```tsx
const checkForEncounter = useCallback((multiplier: number, now: number) => {
  // Only check every 2.5 seconds
  if (now - lastEncounterCheckRef.current < 2500) return;
  lastEncounterCheckRef.current = now;

  // Calculate probability: 5% * (multiplier / 10), capped at 100%
  const chance = Math.min(0.05 * (multiplier / 10), 1.0);

  if (Math.random() < chance) {
    const type = getEncounterTypeForAltitude(multiplier);
    const encounter: CosmicEncounter = {
      id: `enc-${Date.now()}-${Math.random()}`,
      type,
      x: 15 + Math.random() * 70, // Keep away from edges
      y: 10 + Math.random() * 60, // Upper portion of screen
      startTime: now,
      duration: 4000 + Math.random() * 3000, // 4-7 seconds visible
      scale: 0.8 + Math.random() * 0.4, // 0.8x to 1.2x size variation
    };
    setEncounters(prev => [...prev, encounter]);
  }
}, []);
```

---

## Priority 2: Altitude Zone Mapping
### Target: `CrashCanvas.tsx`

Add this function to map altitude to encounter types:

```tsx
const getEncounterTypeForAltitude = (multiplier: number): EncounterType => {
  if (multiplier < 20) {
    // Low orbit zone
    const options: EncounterType[] = ['satellite', 'satellite', 'astronaut', 'spaceStation'];
    return options[Math.floor(Math.random() * options.length)];
  } else if (multiplier < 60) {
    // Deep space zone
    const options: EncounterType[] = ['asteroid', 'asteroid', 'comet', 'moon', 'satellite'];
    return options[Math.floor(Math.random() * options.length)];
  } else if (multiplier < 120) {
    // Outer system zone
    const options: EncounterType[] = ['planet_ringed', 'planet_gas', 'alienProbe', 'asteroid', 'comet'];
    return options[Math.floor(Math.random() * options.length)];
  } else if (multiplier < 250) {
    // Interstellar zone
    const options: EncounterType[] = ['alienShip', 'wormhole', 'dysonSphere', 'planet_gas', 'alienProbe'];
    return options[Math.floor(Math.random() * options.length)];
  } else {
    // Cosmic zone (250x+)
    const options: EncounterType[] = ['galaxy', 'blackHole', 'cosmicEntity', 'wormhole', 'alienShip'];
    return options[Math.floor(Math.random() * options.length)];
  }
};
```

---

## Priority 3: Create Pixel Art Placeholder Sprites
### Target: Create `openhouse_frontend/public/cosmic/` directory

For now, create CSS-based placeholder visuals. We'll use inline SVG or styled divs until real pixel art is added.

Create a helper function to get placeholder styles:

```tsx
const getEncounterVisual = (type: EncounterType): { emoji: string; color: string; size: number } => {
  switch (type) {
    // Low orbit
    case 'satellite':
      return { emoji: '🛰️', color: '#88aacc', size: 32 };
    case 'astronaut':
      return { emoji: '👨‍🚀', color: '#ffffff', size: 36 };
    case 'spaceStation':
      return { emoji: '🏗️', color: '#cccccc', size: 40 };
    // Deep space
    case 'asteroid':
      return { emoji: '🪨', color: '#8b7355', size: 28 };
    case 'comet':
      return { emoji: '☄️', color: '#66ccff', size: 38 };
    case 'moon':
      return { emoji: '🌙', color: '#d4d4aa', size: 44 };
    // Outer system
    case 'planet_ringed':
      return { emoji: '🪐', color: '#e8c88a', size: 56 };
    case 'planet_gas':
      return { emoji: '🟠', color: '#e87040', size: 52 };
    case 'alienProbe':
      return { emoji: '🔷', color: '#44ffaa', size: 30 };
    // Interstellar
    case 'alienShip':
      return { emoji: '🛸', color: '#88ff88', size: 48 };
    case 'wormhole':
      return { emoji: '🌀', color: '#aa66ff', size: 60 };
    case 'dysonSphere':
      return { emoji: '⭕', color: '#ffcc00', size: 50 };
    // Cosmic
    case 'galaxy':
      return { emoji: '🌌', color: '#6644aa', size: 70 };
    case 'blackHole':
      return { emoji: '⚫', color: '#220033', size: 55 };
    case 'cosmicEntity':
      return { emoji: '👁️', color: '#ff44ff', size: 64 };
    default:
      return { emoji: '✨', color: '#ffffff', size: 24 };
  }
};
```

---

## Priority 4: Encounter Rendering
### Target: `CrashCanvas.tsx`

Add this JSX inside the main container div, AFTER the stars but BEFORE the canvas and rockets (around z-index 15):

```tsx
{/* Cosmic Encounters Layer - behind rockets, in front of stars */}
<div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 15 }}>
  {encounters.map(encounter => {
    const now = Date.now();
    const elapsed = now - encounter.startTime;
    const progress = elapsed / encounter.duration;

    // Skip expired encounters (cleanup will remove them)
    if (progress >= 1) return null;

    // Fade in for first 15%, full opacity middle, fade out last 20%
    let opacity = 1;
    if (progress < 0.15) {
      opacity = progress / 0.15; // Fade in
    } else if (progress > 0.8) {
      opacity = (1 - progress) / 0.2; // Fade out
    }

    const visual = getEncounterVisual(encounter.type);

    return (
      <div
        key={encounter.id}
        className="absolute cosmic-encounter"
        style={{
          left: `${encounter.x}%`,
          top: `${encounter.y}%`,
          transform: `translate(-50%, -50%) scale(${encounter.scale})`,
          opacity: opacity * 0.9,
          fontSize: `${visual.size}px`,
          filter: `drop-shadow(0 0 ${visual.size / 4}px ${visual.color})`,
          transition: 'opacity 0.3s ease-out',
        }}
      >
        <span role="img" aria-label={encounter.type}>
          {visual.emoji}
        </span>
      </div>
    );
  })}
</div>
```

---

## Priority 5: Cleanup and Reset Logic
### Target: `CrashCanvas.tsx`

Add cleanup effect to remove expired encounters:

```tsx
// Cleanup expired encounters periodically
useEffect(() => {
  const cleanup = setInterval(() => {
    const now = Date.now();
    setEncounters(prev => prev.filter(e => now - e.startTime < e.duration));
  }, 1000);
  return () => clearInterval(cleanup);
}, []);

// Clear all encounters when game resets (no rockets = new game)
useEffect(() => {
  if (rocketStates.length === 0) {
    setEncounters([]);
    lastEncounterCheckRef.current = 0;
  }
}, [rocketStates.length]);
```

---

## Priority 6: Hook Into Animation Loop
### Target: `CrashCanvas.tsx`

Find where `maxCurrentMultiplier` is calculated (around line 288-292) and add the encounter check nearby. Add this logic where the rocket states are being processed:

```tsx
// After the existing rocketStates.forEach loop that draws trajectories
// and before setRocketPositions, add:

// Check for cosmic encounters based on current max altitude
if (rocketStates.length > 0 && !allCrashed) {
  const currentMax = Math.max(...rocketStates.map(r => r.currentMultiplier), 1.0);
  checkForEncounter(currentMax, Date.now());
}
```

OR add it to a separate useEffect that runs when maxCurrentMultiplier changes:

```tsx
// Trigger encounter checks during active flight
useEffect(() => {
  if (rocketStates.length > 0 && !allCrashed) {
    checkForEncounter(maxCurrentMultiplier, Date.now());
  }
}, [maxCurrentMultiplier, rocketStates.length, allCrashed, checkForEncounter]);
```

---

## Priority 7: CSS Animations for Encounters
### Target: `CrashRocket.css`

Add these animations for the cosmic encounters:

```css
/* Cosmic encounter animations */
.cosmic-encounter {
  animation: encounterFloat 3s ease-in-out infinite;
}

@keyframes encounterFloat {
  0%, 100% {
    transform: translate(-50%, -50%) translateY(0px);
  }
  50% {
    transform: translate(-50%, -50%) translateY(-8px);
  }
}

/* Subtle glow pulse for special encounters */
@keyframes encounterGlow {
  0%, 100% {
    filter: drop-shadow(0 0 8px currentColor);
  }
  50% {
    filter: drop-shadow(0 0 16px currentColor);
  }
}

.cosmic-encounter-rare {
  animation: encounterFloat 3s ease-in-out infinite, encounterGlow 2s ease-in-out infinite;
}
```

---

## Quality Gate
```bash
cd openhouse_frontend && npm run build
```
Build must pass with no TypeScript errors.

## Testing Checklist
- [ ] Play game, reach 10x - should rarely see satellites (5% chance per 2.5s)
- [ ] Play game, reach 30x - should see asteroids/comets appearing
- [ ] Play game, reach 50x+ - encounters appear frequently, variety of types
- [ ] Play game, reach 100x+ - should see planets, alien ships often
- [ ] Encounters appear at RANDOM positions, not always same spot
- [ ] Encounters FADE IN smoothly, float gently, then FADE OUT
- [ ] Different encounter types appear at appropriate altitudes
- [ ] Encounters clear when game resets
- [ ] No performance issues with multiple encounters on screen
- [ ] Encounters don't block or obscure rockets

## Definition of Done
The user should be able to play the game and clearly notice:
1. At ~20x: Occasional satellites or astronauts drifting by
2. At ~50x: Asteroids and comets appearing
3. At ~100x: Planets visible in the background
4. At ~200x+: Alien ships, galaxies, exotic cosmic phenomena

**These should be VISIBLE and NOTICEABLE, not subtle. The player should think "cool, I see stuff in space!"**
