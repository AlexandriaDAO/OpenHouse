# Subtle Ambient Space Background Spec

## Objective

Remove the Cosmic Encounters system (planets, galaxies, black holes popping in during flight) and make the background subtle. Result: clean "rockets in space" aesthetic where rockets are the visual focus.

## Key Files

- `openhouse_frontend/src/components/game-specific/crash/CrashCanvas.tsx` (1303 lines)
- `openhouse_frontend/src/components/game-specific/crash/CrashRocket.css` (281 lines)

---

## Priority 1: Remove SPACE_ASSETS and getRandomSpaceAsset

### Target: `CrashCanvas.tsx` lines 13-28

**DELETE this entire block:**
```typescript
// ============================================
// Space Asset Configuration - celestial object images
// ============================================
const SPACE_ASSETS = {
  planets: ['planet0.png', 'planet1.png', 'planet2.png', 'planet3.png', 'planet4.png', 'planet5.png'],
  galaxies: ['galaxy0.png', 'galaxy1.png', 'galaxy2.png', 'galaxy3.png', 'galaxy5.png'],
  blackholes: ['blackhole0.png', 'blackhole1.png', 'blackhole2.png', 'blackhole3.png'],
  nebulas: ['nebula0.png', 'nebula1.png'],
} as const;

// Get a random space asset path from a category
const getRandomSpaceAsset = (category: keyof typeof SPACE_ASSETS): string => {
  const assets = SPACE_ASSETS[category];
  const randomIndex = Math.floor(Math.random() * assets.length);
  return `/space-stuff/${assets[randomIndex]}`;
};
```

---

## Priority 2: Remove Space Asset Preloading

### Target: `CrashCanvas.tsx` lines 65-80 (inside preloadAllRocketImages function)

**DELETE this block** (keep the rocket preloading, just remove space-stuff):
```typescript
  // Preload space-stuff images for cosmic encounters
  const spaceCategories: (keyof typeof SPACE_ASSETS)[] = ['planets', 'galaxies', 'blackholes', 'nebulas'];
  for (const category of spaceCategories) {
    for (const asset of SPACE_ASSETS[category]) {
      const path = `/space-stuff/${asset}`;
      if (!preloadedImages.has(path)) {
        const img = new Image();
        imagePromises.push(new Promise((resolve) => {
          img.onload = () => resolve();
          img.onerror = () => resolve();
          img.src = path;
        }));
        preloadedImages.set(path, img);
      }
    }
  }
```

---

## Priority 3: Remove Encounter Config and Types

### Target: `CrashCanvas.tsx` lines 101-155

**DELETE this entire block** (from comment header through CosmicEncounter interface):
```typescript
// ============================================
// Cosmic Encounters System - space objects that appear during flight
// ============================================

// Z-index hierarchy for proper layering
const Z_INDEX = {
  STARS: 5,
  NEBULA: 8,
  CANVAS: 10,
  ENCOUNTERS: 15,      // Behind rockets
  ROCKETS_FLYING: 20,
  ROCKETS_CRASHED: 22,
  UI: 30,
} as const;

// Encounter spawn configuration
const ENCOUNTER_CONFIG = {
  MAX_ON_SCREEN: 6,           // Prevent visual clutter
  CHECK_INTERVAL_MS: 1500,    // How often to roll for new encounter
  BASE_CHANCE: 0.10,          // 10% base probability
  CHANCE_PER_MULT: 0.02,      // +2% per multiplier
  MAX_CHANCE: 0.50,           // Cap at 50% to prevent spam
  X_SPAWN_MIN: 20,            // Avoid left edge (rocket start area)
  X_SPAWN_RANGE: 60,          // Spawn in center 60% of screen
  Y_SPAWN_MIN: 5,             // Start near top for downward drift
  Y_SPAWN_RANGE: 50,          // Upper half of screen
  DURATION_MIN_MS: 5000,      // Minimum visibility time
  DURATION_VARIANCE_MS: 3000, // Random additional duration
} as const;

// Animation class mappings (static, defined once)
// All image-based encounters - spinning cosmic objects
const SPIN_ENCOUNTER_TYPES = new Set(['wormhole', 'galaxy', 'blackHole', 'nebula']);
const RARE_ENCOUNTER_TYPES = new Set(['blackHole', 'wormhole', 'galaxy']);

// Simplified encounter types - all image-based celestial objects only
type EncounterType =
  | 'planet_small' | 'planet_large'    // Planets at various distances
  | 'nebula'                            // Ethereal cosmic clouds
  | 'wormhole' | 'blackHole'           // Cosmic phenomena
  | 'galaxy';                          // Distant galaxies

interface CosmicEncounter {
  id: string;
  type: EncounterType;
  x: number; // starting percentage 0-100
  y: number; // starting percentage 0-100
  startTime: number;
  duration: number; // ms, typically 3000-6000
  scale: number; // size multiplier
  velocityX: number; // drift speed in % per second (negative = left)
  velocityY: number; // drift speed in % per second (positive = down)
  imagePath: string; // path to PNG for this celestial object
  baseSize: number; // base size in pixels (varies for visual interest)
}
```

**THEN ADD BACK** (we still need Z_INDEX for rockets):
```typescript
// Z-index hierarchy for proper layering
const Z_INDEX = {
  STARS: 5,
  NEBULA: 8,
  CANVAS: 10,
  ROCKETS_FLYING: 20,
  ROCKETS_CRASHED: 22,
  UI: 30,
} as const;
```

---

## Priority 4: Remove Encounter Functions

### Target: `CrashCanvas.tsx` lines 167-223

**DELETE this entire block:**
```typescript
// Get encounter type based on current altitude (multiplier)
// All encounters are now image-based celestial objects
const getEncounterTypeForAltitude = (multiplier: number): EncounterType => {
  // ... entire function body ...
};

// Visual properties for image-based encounters only
interface EncounterVisual {
  imagePath: string;
  color: string; // glow color
  baseSize: number; // base size in pixels
  sizeVariance: number; // random variance range (±)
}

// Get visual properties for each encounter type - all image-based
const getEncounterVisual = (encounterType: EncounterType): EncounterVisual => {
  // ... entire switch statement ...
};
```

---

## Priority 5: Remove Encounter State

### Target: `CrashCanvas.tsx` lines 269-271

**DELETE these two lines:**
```typescript
  // Cosmic Encounters state - space objects that appear during flight
  const [encounters, setEncounters] = useState<CosmicEncounter[]>([]);
  const lastEncounterCheckRef = useRef<number>(0);
```

---

## Priority 6: Remove checkForEncounter Callback

### Target: `CrashCanvas.tsx` lines 373-423

**DELETE the entire useCallback:**
```typescript
  // Check for cosmic encounter based on current multiplier
  const checkForEncounter = useCallback((multiplier: number, now: number, currentCount: number) => {
    // ... entire callback body ...
  }, []);
```

---

## Priority 7: Remove Encounter Cleanup Effects

### Target: `CrashCanvas.tsx` lines 432-447

**DELETE these two useEffects:**
```typescript
  // Cleanup expired cosmic encounters periodically
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

## Priority 8: Remove Encounter Refs and Interval

### Target: `CrashCanvas.tsx` lines 454-476

**DELETE these lines:**
```typescript
  const encountersRef = useRef(encounters);
  encountersRef.current = encounters;

  // Trigger encounter checks during active flight
  // Uses an interval that reads from ref to avoid constant recreation
  useEffect(() => {
    // Check for encounters every 500ms
    const encounterInterval = setInterval(() => {
      const rockets = rocketStatesRef.current;
      if (rockets.length === 0) return;

      const currentMax = Math.max(...rockets.map(r => r.currentMultiplier), 1.0);
      const allRocketsCrashed = rockets.every(r => r.isCrashed);
      const currentEncounterCount = encountersRef.current.length;

      // Only check for encounters during active flight (not after all crashed)
      if (!allRocketsCrashed) {
        checkForEncounter(currentMax, Date.now(), currentEncounterCount);
      }
    }, 500);

    return () => clearInterval(encounterInterval);
  }, [checkForEncounter]);
```

---

## Priority 9: Remove Encounter Rendering Layer

### Target: `CrashCanvas.tsx` lines 1098-1180

**DELETE the entire Cosmic Encounters Layer div:**
```typescript
      {/* Cosmic Encounters Layer - behind rockets, in front of canvas */}
      <div
        className="absolute inset-0 pointer-events-none overflow-hidden"
        style={{ zIndex: Z_INDEX.ENCOUNTERS }}
      >
        {encounters.map(encounter => {
          // ... entire rendering logic ...
        })}
      </div>
```

---

## Priority 10: Remove Encounter CSS

### Target: `CrashRocket.css` lines 224-265

**DELETE this entire block:**
```css
/* ====================================
   Cosmic Encounter Animations
   Celestial objects that appear during flight (all image-based)
   ==================================== */

/* Base animation for celestial objects - subtle glow pulse */
.cosmic-encounter-image {
  animation: imageEncounterPulse 3s ease-in-out infinite;
}

@keyframes imageEncounterPulse {
  0%, 100% {
    filter: brightness(0.95);
  }
  50% {
    filter: brightness(1.1);
  }
}

/* Slow majestic spin for galaxies, black holes, wormholes, nebulas */
.cosmic-encounter-spin {
  animation: encounterSpin 12s linear infinite;
}

@keyframes encounterSpin {
  from { rotate: 0deg; }
  to { rotate: 360deg; }
}

/* Enhanced glow for rare celestial encounters */
.cosmic-encounter-rare {
  animation: imageEncounterGlow 2s ease-in-out infinite;
}

@keyframes imageEncounterGlow {
  0%, 100% {
    filter: brightness(1) saturate(1.1);
  }
  50% {
    filter: brightness(1.25) saturate(1.2);
  }
}
```

---

## Priority 11: Reduce Nebula Opacity (SUBTLE BACKGROUND)

### Target: `CrashCanvas.tsx` line 710

**CHANGE:**
```typescript
  const nebulaOpacity = deepSpaceProgress * 0.35;
```

**TO:**
```typescript
  const nebulaOpacity = deepSpaceProgress * 0.15;
```

### Also reduce nebula element opacities throughout lines 815-884

**Line 823** - Purple nebula: change `${nebulaOpacity}` usages to be more subtle:
```typescript
background: `radial-gradient(ellipse at center, rgba(60, 20, 80, ${nebulaOpacity * 0.6}) 0%, rgba(30, 15, 60, ${nebulaOpacity * 0.3}) 40%, transparent 70%)`,
```

**Line 836** - Cyan nebula:
```typescript
background: `radial-gradient(ellipse at center, rgba(20, 50, 70, ${nebulaOpacity * 0.5}) 0%, rgba(15, 35, 55, ${nebulaOpacity * 0.25}) 50%, transparent 75%)`,
```

**Line 849** - Galaxy cluster:
```typescript
background: `radial-gradient(ellipse at center, rgba(80, 40, 100, ${nebulaOpacity * 0.4}) 0%, transparent 60%)`,
```

**Lines 865, 878** - Deep cosmic veils (500x+): reduce those opacity multipliers by 40-50%.

---

## Priority 12 (Optional): Add Ultra-Distant Star Layer

### Target: `CrashCanvas.tsx` lines 1237, 1252-1274

**Update the Star interface** (line 1237) to include 'cosmic':
```typescript
  layer: 'cosmic' | 'distant' | 'mid' | 'near';
```

**Add cosmic layer to generateStarLayers()** (inside the layers object):
```typescript
  const layers: Record<'cosmic' | 'distant' | 'mid' | 'near', StarLayerConfig> = {
    cosmic: {
      count: 80,
      sizeRange: [0.3, 0.6],
      opacityRange: [0.1, 0.2],
      twinkleDuration: 6,
      driftSpeed: 0,
    },
    distant: { /* existing */ },
    // ...
  };
```

**Also update the forEach call** to include 'cosmic':
```typescript
  (Object.keys(layers) as Array<'cosmic' | 'distant' | 'mid' | 'near'>).forEach((layerName) => {
```

**Add to CrashRocket.css** (after the twinkle-near keyframes):
```css
/* Cosmic layer stars: very slow, very subtle */
@keyframes twinkle-cosmic {
  0%, 100% { opacity: 0.1; }
  50% { opacity: 0.2; }
}
```

---

## Constraints

- Build must pass: `cd openhouse_frontend && npm run build`
- No console errors
- Stars and atmosphere must still work
- Rockets must be clearly visible and the focal point

## Quality Gate

```bash
cd openhouse_frontend && npm run build
```

After deployment verify at https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io:
- No planets/galaxies/black holes appear during flight
- Nebulas barely visible (subtle glow, not distracting)
- Stars twinkling at all multiplier levels
- Rockets clearly the visual focus
- No console errors
