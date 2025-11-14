# 🤖 AUTONOMOUS PR ORCHESTRATOR - DO NOT SKIP

**You are an autonomous PR orchestrator. Your ONLY job is to implement this plan and create a PR.**

## Isolation Check (RUN FIRST)
```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
if [ "$REPO_ROOT" = "/home/theseus/alexandria/openhouse" ]; then
    echo "❌ FATAL: In main repo. Must be in worktree."
    echo "Worktree: /home/theseus/alexandria/openhouse-design-refactor"
    exit 1
fi
echo "✅ In isolated worktree: $REPO_ROOT"
```

## Your Autonomous Workflow (NO QUESTIONS ALLOWED)
1. **Verify isolation** - You must be in worktree: `/home/theseus/alexandria/openhouse-design-refactor`
2. **Implement feature** - Follow plan sections below
3. **Build & Deploy to Mainnet**:
   ```bash
   # Frontend-only changes in this refactor
   cd openhouse_frontend
   npm run build
   cd ..
   ./deploy.sh --frontend-only
   ```

4. **Verify deployment**:
   ```bash
   # Check frontend status
   dfx canister --network ic status pezw3-laaaa-aaaal-qssoa-cai

   # Test the live site
   echo "Visit: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io"
   ```

5. **Create PR** (MANDATORY):
   ```bash
   git add .
   git commit -m "refactor: implement retro-cypherpunk design with DFINITY colors and realistic 3D dice"
   git push -u origin feature/retro-cypherpunk-design
   gh pr create --title "Refactor: Retro Arcade + Cypherpunk Design System" --body "Implements DESIGN_REFACTOR_PLAN.md

## Changes
- Black & white foundation with DFINITY color accents
- Monospace/pixel font typography
- Realistic 3D black/white dice floating in void
- Terminal-style UI components
- Updated color palette (turquoise #29ABE2, purple #3B00B9)

Deployed to mainnet:
- Frontend: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io
- Affected canisters: pezw3-laaaa-aaaal-qssoa-cai (frontend)"
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

**Branch:** `feature/retro-cypherpunk-design`
**Worktree:** `/home/theseus/alexandria/openhouse-design-refactor`

---

# Implementation Plan: Retro Arcade + Cypherpunk Design Refactor

## Design Vision

Transform OpenHouse Casino from generic dark casino aesthetic to **retro arcade + cypherpunk simplicity**:
- **Foundation**: Pure black (#000000) and white (#FFFFFF)
- **Accents**: DFINITY brand colors (turquoise #29ABE2, purple #3B00B9, green #00E19B, red #ED0047)
- **Typography**: Monospace (terminal feel) + pixel/bitmap fonts (arcade nostalgia)
- **Aesthetic**: Minimalist, high contrast, terminal-inspired UI

## Current State Documentation

### Current Color Palette (`tailwind.config.js`)
```javascript
colors: {
  casino: {
    primary: '#1a1a2e',    // Dark navy
    secondary: '#16213e',   // Dark blue-grey
    accent: '#0f3460',      // Deep blue
    highlight: '#e94560',   // Red/Pink
  }
}
```

### Current Typography (`index.css`)
- No custom fonts defined
- Using default Tailwind sans-serif stack

### Current Dice Animation (`components/game-specific/dice/DiceAnimation.css`)
- Purple gradient dice: `linear-gradient(135deg, #667eea 0%, #764ba2 100%)`
- Rounded cube with single face showing number
- Floating with 3D rotation animation
- Result glow effect with purple tint

### Affected Files
1. **Configuration**
   - `tailwind.config.js` - Color system overhaul
   - `index.css` - Typography, base styles

2. **Dice Game Components**
   - `components/game-specific/dice/DiceAnimation.tsx` - 3D dice structure
   - `components/game-specific/dice/DiceAnimation.css` - Realistic styling
   - `components/game-specific/dice/DiceControls.tsx` - Green/red button colors
   - `pages/Dice.tsx` - Layout adjustments

3. **Shared UI Components**
   - `components/game-ui/GameButton.tsx` - Terminal-style buttons
   - `components/game-ui/GameLayout.tsx` - Typography updates
   - `components/game-ui/GameStats.tsx` - Color updates
   - `components/Layout.tsx` - Header/footer styling
   - `pages/Home.tsx` - Feature cards styling

## Implementation Pseudocode

### 1. Update Color Palette (`tailwind.config.js`)

```javascript
// PSEUDOCODE
export default {
  content: [/* existing */],
  theme: {
    extend: {
      colors: {
        // DFINITY brand colors
        dfinity: {
          turquoise: '#29ABE2',  // Main brand color
          purple: '#3B00B9',      // Secondary/links
          green: '#00E19B',       // Success/positive
          red: '#ED0047',         // Error/negative
          orange: '#F15A24',      // Hover states
          navy: '#0E031F',        // Deep background
          gray: '#E6E6E6',        // Light UI elements
        },
        // Core monochrome
        'pure-black': '#000000',
        'pure-white': '#FFFFFF',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'IBM Plex Mono', 'monospace'],
        pixel: ['"Press Start 2P"', 'cursive'],
      }
    },
  },
  plugins: [],
}
```

### 2. Add Typography & Base Styles (`index.css`)

```css
/* PSEUDOCODE */

/* Import Google Fonts */
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Press+Start+2P&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    /* Pure black background */
    @apply bg-pure-black text-pure-white font-mono;
    /* Terminal scanline effect (optional subtle overlay) */
  }

  h1, h2, h3 {
    /* Pixel font for headers */
    @apply font-pixel;
  }
}

@layer components {
  .btn-primary {
    /* DFINITY turquoise with terminal borders */
    @apply bg-transparent border-2 border-dfinity-turquoise text-dfinity-turquoise;
    @apply hover:bg-dfinity-turquoise hover:text-pure-black;
    @apply font-mono font-bold py-2 px-6 transition-all duration-200;
    /* Sharp corners or minimal rounding */
  }

  .card {
    /* Monochrome card with subtle border */
    @apply bg-pure-black border border-pure-white/20 p-6;
    /* Remove heavy rounded-xl, use minimal or sharp edges */
  }

  .card-accent {
    /* Optional DFINITY color border for emphasis */
    @apply border-dfinity-turquoise;
  }
}
```

### 3. Realistic 3D Dice (`components/game-specific/dice/DiceAnimation.tsx`)

```typescript
// PSEUDOCODE
import React, { useEffect, useState, useRef } from 'react';
import './DiceAnimation.css';

// Keep existing animation timing constants
const ANIMATION_CONFIG = {/* existing */};

export const DiceAnimation: React.FC<DiceAnimationProps> = ({
  targetNumber,
  isRolling,
  onAnimationComplete
}) => {
  // Keep existing state and animation logic
  const [displayNumber, setDisplayNumber] = useState(0);
  const [animationPhase, setAnimationPhase] = useState<'idle' | 'rolling' | 'complete'>('idle');

  // Keep existing useEffect hooks for animation timing

  return (
    <div className="dice-container">
      {/* 3D dice cube with 6 faces */}
      <div className={`dice-cube ${animationPhase === 'rolling' ? 'rolling-animation' : ''}`}>

        {/* Front face (showing number) */}
        <div className="dice-face dice-face-front">
          {/* Render dots pattern based on displayNumber */}
          {/* For numbers 1-6: traditional dice dots */}
          {/* For numbers 0, 7-100: show number in center */}
          <DiceDots number={displayNumber} />
        </div>

        {/* Back face */}
        <div className="dice-face dice-face-back">
          <DiceDots number={7 - displayNumber} /> {/* Opposite face */}
        </div>

        {/* Right face */}
        <div className="dice-face dice-face-right">
          <DiceDots number={/* calculated */} />
        </div>

        {/* Left face */}
        <div className="dice-face dice-face-left">
          <DiceDots number={/* calculated */} />
        </div>

        {/* Top face */}
        <div className="dice-face dice-face-top">
          <DiceDots number={/* calculated */} />
        </div>

        {/* Bottom face */}
        <div className="dice-face dice-face-bottom">
          <DiceDots number={/* calculated */} />
        </div>
      </div>

      {/* Result glow with DFINITY turquoise */}
      {animationPhase === 'complete' && targetNumber !== null && (
        <div className="result-glow-turquoise"></div>
      )}
    </div>
  );
};

// Helper component for rendering dice dots
const DiceDots: React.FC<{ number: number }> = ({ number }) => {
  // PSEUDOCODE
  // For 1-6: render traditional dice dot patterns
  // For 0, 7-100: render number in monospace font

  if (number >= 1 && number <= 6) {
    // Return JSX with dot layout for traditional dice faces
    // Use absolute positioning to place black dots on white face
    return (/* dot pattern */);
  }

  return <span className="dice-number-display">{number}</span>;
};
```

### 4. Realistic 3D Dice Styles (`components/game-specific/dice/DiceAnimation.css`)

```css
/* PSEUDOCODE */

.dice-container {
  /* Pure black void background */
  display: flex;
  justify-content: center;
  align-items: center;
  height: 300px;
  position: relative;
  perspective: 1000px;
  background: #000000; /* Pure black void */
}

.dice-cube {
  /* 3D cube with all 6 faces */
  width: 150px;
  height: 150px;
  position: relative;
  transform-style: preserve-3d;
  transition: transform 0.1s ease-out;
}

.dice-cube.rolling-animation {
  /* Keep existing rotation animation */
  animation: dice-roll 2s cubic-bezier(0.68, -0.55, 0.265, 1.55);
}

@keyframes dice-roll {
  /* Keep existing keyframes */
}

/* Individual dice faces */
.dice-face {
  /* White cube face with black dots */
  position: absolute;
  width: 150px;
  height: 150px;
  background: #FFFFFF; /* Pure white */
  border: 2px solid #000000; /* Black edges */
  display: flex;
  align-items: center;
  justify-content: center;

  /* Subtle edge lighting for depth */
  box-shadow: inset 0 0 10px rgba(0, 0, 0, 0.1);
}

/* Position each face in 3D space */
.dice-face-front  { transform: rotateY(0deg) translateZ(75px); }
.dice-face-back   { transform: rotateY(180deg) translateZ(75px); }
.dice-face-right  { transform: rotateY(90deg) translateZ(75px); }
.dice-face-left   { transform: rotateY(-90deg) translateZ(75px); }
.dice-face-top    { transform: rotateX(90deg) translateZ(75px); }
.dice-face-bottom { transform: rotateX(-90deg) translateZ(75px); }

/* Dice dots */
.dice-dot {
  width: 20px;
  height: 20px;
  background: #000000; /* Black dots */
  border-radius: 50%;
  position: absolute;
}

/* Dot patterns for 1-6 (use absolute positioning) */
/* Example for "1" - center dot */
.dots-1 .dice-dot {
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

/* Add patterns for 2, 3, 4, 5, 6 with specific layouts */

/* Number display for 0, 7-100 */
.dice-number-display {
  font-family: 'JetBrains Mono', monospace;
  font-size: 2.5rem;
  font-weight: bold;
  color: #000000; /* Black on white face */
}

/* Result glow - DFINITY turquoise */
.result-glow-turquoise {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 200px;
  height: 200px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(41, 171, 226, 0.4) 0%, transparent 70%);
  animation: pulse-glow 1.5s ease-in-out infinite;
  pointer-events: none;
  z-index: -1;
}

@keyframes pulse-glow {
  /* Keep existing pulse animation */
}

/* Accessibility */
@media (prefers-reduced-motion: reduce) {
  .dice-cube.rolling-animation {
    animation: none;
  }
  .result-glow-turquoise {
    animation: none;
  }
}
```

### 5. Update Dice Controls (`components/game-specific/dice/DiceControls.tsx`)

```typescript
// PSEUDOCODE
export const DiceControls: React.FC<DiceControlsProps> = ({
  targetNumber,
  onTargetChange,
  direction,
  onDirectionChange,
  disabled = false,
}) => {
  return (
    <>
      {/* Target slider with DFINITY turquoise accent */}
      <div className="mb-4">
        <label className="block text-sm text-pure-white/60 mb-2 font-mono">
          Target: {targetNumber}
        </label>
        <input
          type="range"
          min="1"
          max="99"
          value={targetNumber}
          onChange={(e) => onTargetChange(parseInt(e.target.value))}
          className="w-full slider-turquoise" // Custom slider with turquoise accent
          disabled={disabled}
        />
      </div>

      {/* Over/Under buttons with green/red DFINITY colors */}
      <div className="mb-4">
        <div className="flex gap-2">
          <button
            onClick={() => onDirectionChange('Over')}
            disabled={disabled}
            className={`flex-1 py-3 font-mono font-bold border-2 transition ${
              direction === 'Over'
                ? 'bg-dfinity-green border-dfinity-green text-pure-black'
                : 'bg-transparent border-dfinity-green text-dfinity-green'
            }`}
          >
            OVER {targetNumber}
          </button>
          <button
            onClick={() => onDirectionChange('Under')}
            disabled={disabled}
            className={`flex-1 py-3 font-mono font-bold border-2 transition ${
              direction === 'Under'
                ? 'bg-dfinity-red border-dfinity-red text-pure-black'
                : 'bg-transparent border-dfinity-red text-dfinity-red'
            }`}
          >
            UNDER {targetNumber}
          </button>
        </div>
      </div>
    </>
  );
};
```

### 6. Update Game Button (`components/game-ui/GameButton.tsx`)

```typescript
// PSEUDOCODE
export const GameButton: React.FC<GameButtonProps> = ({
  onClick,
  disabled = false,
  loading = false,
  label,
  loadingLabel,
  variant = 'primary',
  fullWidth = true,
  icon,
}) => {
  const getButtonStyles = () => {
    const base = `font-mono font-bold py-4 text-xl transition border-2 ${fullWidth ? 'w-full' : ''}`;

    switch (variant) {
      case 'primary':
        // DFINITY turquoise terminal button
        return `${base} bg-transparent border-dfinity-turquoise text-dfinity-turquoise
                hover:bg-dfinity-turquoise hover:text-pure-black
                disabled:border-pure-white/20 disabled:text-pure-white/20`;
      case 'secondary':
        // Purple variant
        return `${base} bg-transparent border-dfinity-purple text-dfinity-purple
                hover:bg-dfinity-purple hover:text-pure-white`;
      case 'danger':
        // Red variant
        return `${base} bg-transparent border-dfinity-red text-dfinity-red
                hover:bg-dfinity-red hover:text-pure-white`;
      default:
        return base;
    }
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={getButtonStyles()}
    >
      {/* Keep existing content logic */}
    </button>
  );
};
```

### 7. Update Game Stats (`components/game-ui/GameStats.tsx`)

```typescript
// PSEUDOCODE
export const GameStats: React.FC<GameStatsProps> = ({
  stats,
  collapsible = true,
  defaultOpen = false,
  title = 'Odds & Payout',
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const getColorClass = (color?: GameStat['color'], highlight?: boolean) => {
    if (!highlight) return 'text-pure-white/60';

    switch (color) {
      case 'green':
        return 'text-dfinity-green';
      case 'red':
        return 'text-dfinity-red';
      case 'yellow':
        return 'text-dfinity-turquoise'; // Use turquoise instead of yellow
      case 'blue':
        return 'text-dfinity-purple';
      default:
        return 'text-dfinity-turquoise';
    }
  };

  const statsContent = (
    <div className="mt-2 grid grid-cols-3 gap-2 text-xs font-mono">
      {stats.map((stat, index) => (
        <div key={index} className="bg-pure-black border border-pure-white/10 p-2 text-center">
          <div className="text-pure-white/40 mb-1">{stat.label}</div>
          <div className={`font-bold ${getColorClass(stat.color, stat.highlight)}`}>
            {stat.value}
          </div>
        </div>
      ))}
    </div>
  );

  // Keep existing collapsible logic
};
```

### 8. Update Main Layout (`components/Layout.tsx`)

```typescript
// PSEUDOCODE
export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const isHome = location.pathname === '/';

  return (
    <div className="min-h-screen flex flex-col bg-pure-black">
      {/* Header with terminal aesthetic */}
      <header className="bg-pure-black border-b border-pure-white/20">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <span className="text-3xl">🎰</span>
              <div>
                <h1 className="text-2xl font-pixel">OpenHouse Casino</h1>
                <p className="text-xs text-dfinity-turquoise font-mono">
                  Transparent Odds • Provably Fair
                </p>
              </div>
            </Link>
            <AuthButton />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-8">
        {!isHome && (
          <div className="mb-6">
            <Link to="/" className="inline-flex items-center gap-2 text-pure-white/60 hover:text-dfinity-turquoise transition-colors font-mono">
              <span>←</span>
              <span>Back to Games</span>
            </Link>
          </div>
        )}
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-pure-black border-t border-pure-white/20 py-6">
        <div className="container mx-auto px-4 text-center text-pure-white/60 text-sm font-mono">
          <p>
            OpenHouse Casino - Open Source • Transparent Odds • Built on the{' '}
            <a
              href="https://internetcomputer.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-dfinity-turquoise hover:underline"
            >
              Internet Computer
            </a>
          </p>
          <p className="mt-2">All games use verifiable randomness (VRF) for provably fair results.</p>
        </div>
      </footer>
    </div>
  );
};
```

### 9. Update Home Page (`pages/Home.tsx`)

```typescript
// PSEUDOCODE
export const Home: React.FC = () => {
  return (
    <div className="space-y-8">
      {/* Hero Section with pixel font */}
      <div className="text-center space-y-4">
        <h1 className="text-5xl font-pixel">OpenHouse Casino</h1>
        <p className="text-xl text-pure-white/60 max-w-2xl mx-auto font-mono">
          Play provably fair games with transparent odds on the Internet Computer.
          All games use verifiable randomness (VRF) for guaranteed fairness.
        </p>
      </div>

      {/* Features with DFINITY colors */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
        <div className="card card-accent text-center">
          <div className="text-3xl mb-2">🔓</div>
          <h3 className="font-bold mb-1 font-mono">Open Source</h3>
          <p className="text-sm text-pure-white/60 font-mono">All code is public and auditable</p>
        </div>
        <div className="card card-accent text-center">
          <div className="text-3xl mb-2">✅</div>
          <h3 className="font-bold mb-1 font-mono">Provably Fair</h3>
          <p className="text-sm text-pure-white/60 font-mono">Verify every game result</p>
        </div>
        <div className="card card-accent text-center">
          <div className="text-3xl mb-2">📊</div>
          <h3 className="font-bold mb-1 font-mono">Transparent Odds</h3>
          <p className="text-sm text-pure-white/60 font-mono">Exact house edge displayed</p>
        </div>
      </div>

      {/* Games Grid */}
      <div>
        <h2 className="text-3xl font-pixel text-center mb-6">Choose Your Game</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {games.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}
        </div>
      </div>

      {/* Info Box with terminal styling */}
      <div className="card card-accent max-w-2xl mx-auto">
        <h3 className="font-bold mb-2 font-mono">🎮 How to Play</h3>
        <ol className="text-sm text-pure-white/60 space-y-1 list-decimal list-inside font-mono">
          <li>Browse games anonymously (optional authentication)</li>
          <li>Login with Internet Identity to place bets</li>
          <li>Select your game and place your bet in ICP</li>
          <li>Watch the game play out with verifiable randomness</li>
          <li>Win and collect your payout instantly!</li>
        </ol>
      </div>
    </div>
  );
};
```

### 10. Custom Slider Styles (Add to `index.css`)

```css
/* PSEUDOCODE - Range slider with DFINITY turquoise */
@layer components {
  .slider-turquoise {
    -webkit-appearance: none;
    appearance: none;
    background: transparent;
    outline: none;
  }

  .slider-turquoise::-webkit-slider-track {
    background: rgba(255, 255, 255, 0.1);
    height: 4px;
    border-radius: 2px;
  }

  .slider-turquoise::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 20px;
    height: 20px;
    background: #29ABE2; /* DFINITY turquoise */
    border: 2px solid #FFFFFF;
    cursor: pointer;
    border-radius: 50%;
  }

  .slider-turquoise::-moz-range-track {
    background: rgba(255, 255, 255, 0.1);
    height: 4px;
    border-radius: 2px;
  }

  .slider-turquoise::-moz-range-thumb {
    width: 20px;
    height: 20px;
    background: #29ABE2;
    border: 2px solid #FFFFFF;
    cursor: pointer;
    border-radius: 50%;
  }
}
```

## Deployment Notes

### Affected Canisters
- **Frontend only**: `pezw3-laaaa-aaaal-qssoa-cai`
- No backend changes required (pure visual refactor)

### Deployment Command
```bash
cd openhouse_frontend
npm run build
cd ..
./deploy.sh --frontend-only
```

### Testing Checklist
After deployment, manually verify on https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io:
- [ ] Black background with white text loads correctly
- [ ] DFINITY turquoise/purple/green/red colors appear in appropriate places
- [ ] Monospace and pixel fonts load from Google Fonts
- [ ] 3D dice shows realistic black/white cube (not purple gradient)
- [ ] Dice dots render correctly for numbers 1-6
- [ ] Dice rotates smoothly during roll animation
- [ ] Over/Under buttons show green/red colors
- [ ] All buttons have terminal-style borders
- [ ] Slider thumb is turquoise
- [ ] Layout header/footer use new typography
- [ ] Home page feature cards have updated styling
- [ ] Responsive design still works on mobile

## Design Rationale

### Why This Approach?
1. **Black & White Foundation**: Maximum contrast for accessibility, minimal aesthetic
2. **DFINITY Colors as Accents**: Honors the platform identity, creates brand cohesion
3. **Monospace Typography**: Terminal/hacker aesthetic, aligns with cypherpunk ethos
4. **Pixel Font Headers**: Retro arcade nostalgia without overwhelming UI
5. **Realistic Dice**: Traditional black/white dice is universally recognizable, floating in void creates focus
6. **Terminal Buttons**: Border-only buttons feel minimal and functional (cypherpunk)

### Color Usage Strategy
- **Turquoise (#29ABE2)**: Primary CTAs, links, main accents
- **Purple (#3B00B9)**: Secondary actions, hover states
- **Green (#00E19B)**: Success states, "Over" button, positive feedback
- **Red (#ED0047)**: Error states, "Under" button, losses
- **Orange (#F15A24)**: Reserved for special hover/active states

### Typography Hierarchy
- **Pixel (Press Start 2P)**: Game titles, main headers, brand elements
- **Monospace (JetBrains Mono)**: Body text, buttons, stats, UI elements
- **Purpose**: Pixel = attention/nostalgia, Mono = readability/function

## Future Enhancements (Not in This PR)
- Scanline overlay effect for terminal aesthetic
- Grid floor option beneath dice (Tron-style)
- Per-game color signatures (Crash=orange, Plinko=green, etc.)
- Particle effects for wins (optional, adds bundle size)
- Light/dark mode toggle (keeping dark as default)

## Files Modified Summary
1. `tailwind.config.js` - DFINITY color palette + fonts
2. `index.css` - Font imports, base styles, slider component
3. `components/game-specific/dice/DiceAnimation.tsx` - 6-face 3D cube structure
4. `components/game-specific/dice/DiceAnimation.css` - Realistic white/black styling
5. `components/game-specific/dice/DiceControls.tsx` - Green/red buttons
6. `components/game-ui/GameButton.tsx` - Terminal-style borders
7. `components/game-ui/GameStats.tsx` - DFINITY color mappings
8. `components/Layout.tsx` - Header/footer typography
9. `pages/Home.tsx` - Feature cards and typography

**Total Files Modified**: 9 frontend files
**Backend Changes**: None
**Breaking Changes**: None (pure visual refactor)
