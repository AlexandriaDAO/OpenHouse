# OpenHouse Animation & Micro-interactions Spec

## Objective
Transform the OpenHouse casino frontend from "functional but boring" to "delightful and polished" through Framer Motion animations and micro-interactions.

## Tech Stack
- **Animation library**: `framer-motion` (already installed, version 12.23.25)
- **Styling**: Tailwind CSS
- **Framework**: React 18 + TypeScript

## Design Language
- **Theme**: Hacker terminal / cyberpunk aesthetic
- **Primary color**: `dfinity-turquoise` (#39FF14 lime green)
- **Feel**: Snappy, responsive, satisfying clicks

---

## Priority 1: Button Micro-interactions

### Target: `src/components/game-ui/GameButton.tsx`
**Current state**: Plain CSS transitions (line 25: `transition`)
**Goal**: Add Framer Motion whileTap scale, whileHover glow

```tsx
import { motion } from 'framer-motion';
// Wrap button with motion.button
// Add: whileTap={{ scale: 0.97 }}
// Add: whileHover={{ scale: 1.02 }}
```

### Target: Direction buttons in `src/pages/dice/DiceGame.tsx` (lines 246-269)
**Current state**: Plain buttons with CSS transition
**Goal**: Add press feedback, active state animation

### Target: All game action buttons across pages
- Dice roll trigger
- Plinko drop
- Crash cashout
- Roulette spin

---

## Priority 2: Page Transitions

### Target: `src/App.tsx` and `src/components/Layout.tsx`
**Goal**: Animate route changes with fade + slight slide

**Pattern**:
```tsx
import { AnimatePresence, motion } from 'framer-motion';

// Wrap Routes with AnimatePresence
// Each page component gets motion.div wrapper with:
// initial={{ opacity: 0, y: 10 }}
// animate={{ opacity: 1, y: 0 }}
// exit={{ opacity: 0, y: -10 }}
// transition={{ duration: 0.2 }}
```

---

## Priority 3: Game State Animations

### Win/Loss Celebrations
**Target**: `src/pages/dice/DiceGame.tsx` result display (lines 213-242)
**Current**: `animate-in fade-in slide-in-from-bottom-2` (Tailwind)
**Goal**: Framer Motion with color pulse for wins

### Target: Win states across all games
- Dice: lines 213-242 (result display)
- Plinko: `src/components/game-specific/plinko/PlinkoResultPopup.tsx`
- Crash: Cashout success in `src/pages/Crash.tsx`
- Roulette: Win display

**Pattern for wins**:
```tsx
<motion.div
  initial={{ scale: 0.8, opacity: 0 }}
  animate={{ scale: 1, opacity: 1 }}
  transition={{ type: "spring", stiffness: 300, damping: 20 }}
>
```

---

## Priority 4: Loading Skeletons

### Target: `src/components/modals/LoadingModal.tsx`
**Current**: Basic spinner (line 21)
**Goal**: Pulse animation with Framer Motion

### Target: Game cards on homepage
**File**: `src/components/GameCard.tsx`
**Goal**: Add loading skeleton state

### Target: Balance displays
- `src/components/betting/BettingRail.tsx`
- Portfolio card loading states

**Pattern**:
```tsx
<motion.div
  animate={{ opacity: [0.5, 1, 0.5] }}
  transition={{ duration: 1.5, repeat: Infinity }}
  className="bg-gray-800 rounded"
/>
```

---

## Priority 5: Card Hover Effects

### Target: `src/components/GameCard.tsx`
**Current**: `.game-card` CSS class with hover
**Goal**: Framer Motion lift + shadow on hover

```tsx
<motion.div
  whileHover={{ y: -4, boxShadow: "0 10px 40px rgba(57, 255, 20, 0.15)" }}
  transition={{ type: "spring", stiffness: 400, damping: 25 }}
>
```

---

## Priority 6: Chip/Betting Animations

### Target: `src/components/betting/ChipStack.tsx`
**Goal**: Animate chip stacking when bet changes

### Target: `src/components/betting/ChipSelector.tsx`
**Goal**: Press feedback on chip selection

---

## Constraints

1. **Don't break existing functionality** - games must still work
2. **Keep animations fast** - max 300ms for micro-interactions
3. **Respect reduced motion** - check `prefers-reduced-motion`
4. **Mobile performance** - test on mobile, avoid heavy animations
5. **TypeScript strict** - maintain type safety

## Quality Gate

After each change:
```bash
cd openhouse_frontend && npm run build
```
Build must pass. If it fails, fix before continuing.

## Deployment

After build passes:
```bash
cd /home/theseus/alexandria/openhouse && ./deploy.sh
```

Test at: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io
