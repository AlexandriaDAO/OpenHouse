# Roulette Mobile UI Refactoring Plan

## Executive Summary

The current roulette UI has critical mobile usability issues. The betting board is scaled down to 68% to fit on screen, making numbers nearly unreadable and cutting off 0, 1, 2, 3 from view. This plan provides exhaustive detail for a complete mobile-first redesign.

---

## Current State Analysis

### Screenshots Analysis

**Screenshot 1 - Numbers Tab:**
- Numbers grid visible: 4-36 (0, 1, 2, 3 are CUT OFF - not visible!)
- Grid is scaled to 68% (`scale-[0.68]`) making tap targets ~27px instead of 40px
- Zero is rendered but positioned off-screen to the left
- 2:1 column bets barely visible on right edge
- User cannot scroll to see missing numbers

**Screenshot 2 - Outside Tab:**
- Shows Dozens (1st 12, 2nd 12, 3rd 12) with 2:1 label
- Shows "Even Money (1:1)" label but THE ACTUAL BUTTONS ARE MISSING from view
- Red/Black/Even/Odd/Low/High buttons exist but may be cut off below fold

**Bottom Betting Rail:**
- CLR button, $0.00 bet amount, MAX button
- "+/- CHIPS $7.76" - user balance
- "HOUSE $897.02" - house balance
- Circular BET button (dashed border)
- 3 chip denominations on right side (vertical stack)

### Current Code Structure

```
openhouse_frontend/src/
├── pages/
│   └── roulette/
│       └── RouletteGame.tsx          # Main game component
├── components/
│   ├── game-specific/
│   │   └── roulette/
│   │       ├── BettingBoard.tsx      # THE PROBLEM FILE - betting grid
│   │       ├── RouletteWheel.tsx     # Animated wheel (working fine)
│   │       ├── rouletteConstants.ts  # Colors, wheel numbers
│   │       └── useRouletteAnimation.ts
│   └── betting/
│       ├── BettingRail.tsx           # Bottom betting controls
│       ├── ChipStack.tsx             # Visual chip pile
│       └── ChipSelector.tsx          # Chip denomination buttons
```

### Critical Issues Identified

| Issue | Severity | Location | Description |
|-------|----------|----------|-------------|
| Numbers 0-3 not visible | **CRITICAL** | BettingBoard.tsx:354-361 | Zero rendered but cut off, no scroll |
| Grid scaled to 68% | HIGH | BettingBoard.tsx:355 | `scale-[0.68]` makes everything tiny |
| No Split bet UI | HIGH | BettingBoard.tsx | Backend supports Split bets, UI doesn't |
| No Corner bet UI | HIGH | BettingBoard.tsx | Backend supports Corner bets, UI doesn't |
| No Street bet UI | HIGH | BettingBoard.tsx | Backend supports Street bets, UI doesn't |
| No SixLine bet UI | MEDIUM | BettingBoard.tsx | Backend supports SixLine bets, UI doesn't |
| Even money bets hidden | HIGH | BettingBoard.tsx:281-310 | May be below fold on mobile |
| Tap targets too small | HIGH | BettingBoard.tsx:206 | 40px * 0.68 = 27px (min should be 44px) |
| No haptic feedback | LOW | BettingBoard.tsx | Mobile users expect tap feedback |
| Long-press doesn't work | MEDIUM | BettingBoard.tsx:376 | Says "Long press to remove" but uses contextmenu |

---

## Proposed Solution Architecture

### Design Philosophy

1. **Mobile-First**: Design for 375px width first, scale up for desktop
2. **Touch-Optimized**: Minimum 44px tap targets (Apple HIG)
3. **Progressive Disclosure**: Show essential bets first, advanced bets on demand
4. **Scrollable, Not Scaled**: Use horizontal scroll instead of shrinking
5. **Gesture-Based**: Swipe, tap, long-press for intuitive interaction

### New Component Structure

```
components/game-specific/roulette/
├── BettingBoard/
│   ├── index.tsx                    # Main container with mobile detection
│   ├── MobileBettingBoard.tsx       # NEW: Mobile-optimized version
│   ├── DesktopBettingBoard.tsx      # Existing desktop logic, cleaned up
│   ├── components/
│   │   ├── NumberCell.tsx           # Individual number button
│   │   ├── ZeroCell.tsx             # Special zero styling
│   │   ├── OutsideBetButton.tsx     # Red/Black/Even/Odd etc
│   │   ├── DozenButton.tsx          # 1st/2nd/3rd 12
│   │   ├── ColumnButton.tsx         # 2:1 column bets
│   │   ├── ChipOnBoard.tsx          # Chip visualization on bet
│   │   ├── SplitBetOverlay.tsx      # NEW: Interactive split bet zones
│   │   ├── CornerBetOverlay.tsx     # NEW: Interactive corner bet zones
│   │   └── StreetBetOverlay.tsx     # NEW: Interactive street bet zones
│   ├── hooks/
│   │   ├── useBetPlacement.ts       # Bet logic extracted
│   │   ├── useGestures.ts           # NEW: Touch gesture handling
│   │   └── useHaptics.ts            # NEW: Vibration feedback
│   └── styles/
│       ├── mobile.css               # Mobile-specific styles
│       └── animations.css           # Win/lose animations
```

---

## Detailed Implementation Plan

### Phase 1: Mobile Number Grid Redesign

#### 1.1 Remove Scaling, Add Horizontal Scroll

**Current problematic code (BettingBoard.tsx:354-361):**
```tsx
// BAD: Scaling makes everything tiny
<div className="origin-top-left scale-[0.68] sm:scale-[0.85]"
     style={{ width: 'calc(100% / 0.68)', maxWidth: '570px' }}>
```

**New approach:**
```tsx
// GOOD: Horizontal scroll with proper touch targets
<div className="overflow-x-auto snap-x snap-mandatory
               scrollbar-hide -mx-4 px-4">
  <div className="flex gap-0.5 min-w-max">
    {/* Zero first, always visible */}
    <ZeroCell ... />
    {/* Numbers in scrollable grid */}
    <div className="grid grid-rows-3 grid-flow-col gap-0.5">
      {numbers.map(num => <NumberCell key={num} ... />)}
    </div>
  </div>
</div>
```

#### 1.2 New NumberCell Component

**File: `components/NumberCell.tsx`**

```tsx
interface NumberCellProps {
  number: number;
  isRed: boolean;
  isWinner: boolean;
  betAmount: number;
  onTap: () => void;
  onLongPress: () => void;
  disabled: boolean;
}

export const NumberCell: React.FC<NumberCellProps> = ({
  number, isRed, isWinner, betAmount, onTap, onLongPress, disabled
}) => {
  const longPressTimer = useRef<NodeJS.Timeout>();

  const handleTouchStart = () => {
    longPressTimer.current = setTimeout(() => {
      onLongPress();
      // Haptic feedback
      if (navigator.vibrate) navigator.vibrate(50);
    }, 500);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      // Short tap = place bet
      onTap();
      if (navigator.vibrate) navigator.vibrate(10);
    }
  };

  return (
    <button
      className={`
        relative
        w-11 h-11              /* 44px - minimum touch target */
        min-w-[44px]           /* Prevent shrinking */
        flex items-center justify-center
        text-white font-bold text-base
        rounded-sm
        transition-transform active:scale-95
        ${isRed ? 'bg-red-600' : 'bg-zinc-900'}
        ${isWinner ? 'ring-2 ring-yellow-400 animate-pulse' : ''}
        ${disabled ? 'opacity-50' : 'active:brightness-125'}
      `}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={() => clearTimeout(longPressTimer.current)}
      disabled={disabled}
    >
      {number}
      {betAmount > 0 && <ChipOnBoard amount={betAmount} />}
    </button>
  );
};
```

#### 1.3 Zero Cell (Special Styling)

**File: `components/ZeroCell.tsx`**

```tsx
export const ZeroCell: React.FC<ZeroCellProps> = (props) => {
  return (
    <button
      className={`
        w-11 h-[136px]         /* Height spans 3 rows + gaps */
        bg-green-600
        text-white font-bold text-lg
        rounded-l-lg
        flex items-center justify-center
        writing-mode-vertical   /* Vertical text */
        ${props.isWinner ? 'ring-2 ring-yellow-400 animate-pulse' : ''}
      `}
      {...touchHandlers}
    >
      0
      {props.betAmount > 0 && <ChipOnBoard amount={props.betAmount} />}
    </button>
  );
};
```

### Phase 2: Outside Bets Section

#### 2.1 Dedicated Outside Bets Component

The current tabbed approach is confusing. Instead, use a **sticky bottom section** that's always visible:

**File: `components/OutsideBetsBar.tsx`**

```tsx
export const OutsideBetsBar: React.FC<Props> = ({ bets, chipValue, onPlaceBet, disabled }) => {
  return (
    <div className="sticky bottom-[140px] left-0 right-0 bg-zinc-900/95 backdrop-blur
                    border-t border-zinc-700 px-2 py-2 z-30">
      {/* Row 1: Dozens */}
      <div className="flex gap-1 mb-1">
        <DozenButton label="1st 12" dozen={1} ... />
        <DozenButton label="2nd 12" dozen={2} ... />
        <DozenButton label="3rd 12" dozen={3} ... />
      </div>

      {/* Row 2: Even money bets - 2x3 grid */}
      <div className="grid grid-cols-6 gap-1">
        <OutsideBetButton label="1-18" betType={{ Low: null }} />
        <OutsideBetButton label="EVEN" betType={{ Even: null }} />
        <OutsideBetButton label="RED" betType={{ Red: null }} className="bg-red-600" />
        <OutsideBetButton label="BLACK" betType={{ Black: null }} className="bg-black" />
        <OutsideBetButton label="ODD" betType={{ Odd: null }} />
        <OutsideBetButton label="19-36" betType={{ High: null }} />
      </div>
    </div>
  );
};
```

#### 2.2 Individual Outside Bet Button

```tsx
export const OutsideBetButton: React.FC<Props> = ({
  label, betType, betAmount, isWinner, onTap, className
}) => {
  return (
    <button
      className={`
        h-10
        flex items-center justify-center
        text-white text-xs font-bold
        rounded
        transition-all
        ${className || 'bg-zinc-800'}
        ${isWinner ? 'ring-2 ring-green-400' : ''}
      `}
      onClick={onTap}
    >
      {label}
      {betAmount > 0 && (
        <span className="ml-1 text-yellow-400">${betAmount}</span>
      )}
    </button>
  );
};
```

### Phase 3: Advanced Bet Types (Split, Corner, Street, SixLine)

The backend supports these bet types but the UI completely ignores them. This is a significant feature gap.

#### 3.1 Split Bet Overlay System

Split bets are placed on the line BETWEEN two numbers. We need invisible touch targets on the edges.

**File: `components/SplitBetOverlay.tsx`**

```tsx
// Split bets are placed by tapping the EDGE between two numbers
// We render invisible tap zones on all valid split positions

interface SplitZone {
  numbers: [number, number];
  position: { top: string; left: string; width: string; height: string };
}

const HORIZONTAL_SPLITS: SplitZone[] = [
  // Between 1 and 2 (vertical adjacent in layout)
  { numbers: [1, 2], position: { top: '66%', left: '0', width: '100%', height: '12px' } },
  { numbers: [2, 3], position: { top: '33%', left: '0', width: '100%', height: '12px' } },
  // ... all valid splits
];

const VERTICAL_SPLITS: SplitZone[] = [
  // Between 1 and 4 (horizontal adjacent in layout)
  { numbers: [1, 4], position: { top: '0', left: '100%', width: '12px', height: '100%' } },
  // ... all valid splits
];

export const SplitBetOverlay: React.FC<Props> = ({ onPlaceSplit, bets }) => {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Render tap zones for all valid split positions */}
      {ALL_SPLITS.map(split => (
        <button
          key={`${split.numbers[0]}-${split.numbers[1]}`}
          className="absolute pointer-events-auto bg-transparent
                     hover:bg-yellow-400/30 active:bg-yellow-400/50
                     z-20"
          style={split.position}
          onClick={() => onPlaceSplit(split.numbers)}
        >
          {/* Show chip if bet placed */}
          {getBetAmount(split.numbers) > 0 && (
            <ChipOnBoard amount={getBetAmount(split.numbers)} size="sm" />
          )}
        </button>
      ))}
    </div>
  );
};
```

#### 3.2 Corner Bet Overlay

Corner bets are placed at the intersection of 4 numbers.

```tsx
const CORNER_POSITIONS = [
  { topLeft: 1, numbers: [1, 2, 4, 5], position: { top: '66%', left: '100%' } },
  { topLeft: 2, numbers: [2, 3, 5, 6], position: { top: '33%', left: '100%' } },
  // ... valid corners (top-left must be in column 1 or 2, not column 3)
];

export const CornerBetOverlay: React.FC<Props> = ({ onPlaceCorner }) => {
  return (
    <>
      {CORNER_POSITIONS.map(corner => (
        <button
          key={corner.topLeft}
          className="absolute w-6 h-6 -translate-x-1/2 -translate-y-1/2
                     rounded-full pointer-events-auto
                     hover:bg-yellow-400/30 active:bg-yellow-400/50
                     z-30"
          style={{ top: corner.position.top, left: corner.position.left }}
          onClick={() => onPlaceCorner(corner.numbers)}
        />
      ))}
    </>
  );
};
```

#### 3.3 Street Bet (Row of 3)

Street bets are placed on the edge of the first number in a row of 3.

```tsx
const STREET_STARTS = [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34];

export const StreetBetOverlay: React.FC<Props> = ({ onPlaceStreet }) => {
  return (
    <>
      {STREET_STARTS.map(start => (
        <button
          key={start}
          className="absolute h-full w-3 -left-1.5
                     hover:bg-yellow-400/30 active:bg-yellow-400/50
                     pointer-events-auto z-20"
          onClick={() => onPlaceStreet([start, start + 1, start + 2])}
        />
      ))}
    </>
  );
};
```

### Phase 4: Mobile Gesture System

#### 4.1 Gesture Hook

**File: `hooks/useGestures.ts`**

```tsx
interface GestureHandlers {
  onTap: () => void;
  onLongPress: () => void;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}

export function useGestures(handlers: GestureHandlers) {
  const touchStart = useRef<{ x: number; y: number; time: number } | null>(null);
  const longPressTimer = useRef<NodeJS.Timeout>();

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const touch = e.touches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };

    longPressTimer.current = setTimeout(() => {
      handlers.onLongPress();
      touchStart.current = null; // Prevent tap after long press
    }, 500);
  }, [handlers]);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    clearTimeout(longPressTimer.current);

    if (!touchStart.current) return;

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStart.current.x;
    const deltaY = touch.clientY - touchStart.current.y;
    const deltaTime = Date.now() - touchStart.current.time;

    // Detect swipe (>50px horizontal, <30px vertical, <300ms)
    if (Math.abs(deltaX) > 50 && Math.abs(deltaY) < 30 && deltaTime < 300) {
      if (deltaX > 0) handlers.onSwipeRight?.();
      else handlers.onSwipeLeft?.();
    }
    // Detect tap (<10px movement, <500ms)
    else if (Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10 && deltaTime < 500) {
      handlers.onTap();
    }

    touchStart.current = null;
  }, [handlers]);

  return { handleTouchStart, handleTouchEnd };
}
```

#### 4.2 Haptic Feedback Hook

**File: `hooks/useHaptics.ts`**

```tsx
export function useHaptics() {
  const vibrate = useCallback((pattern: number | number[]) => {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  }, []);

  return {
    light: () => vibrate(10),      // Chip placed
    medium: () => vibrate(30),     // Chip removed
    heavy: () => vibrate([50, 50, 50]), // Win
    error: () => vibrate([100, 50, 100]), // Error
  };
}
```

### Phase 5: Layout Restructure

#### 5.1 New Mobile Layout

**File: `MobileBettingBoard.tsx`**

```tsx
export const MobileBettingBoard: React.FC<Props> = (props) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="flex flex-col h-full">
      {/* Roulette Wheel - Fixed at top, smaller on mobile */}
      <div className="flex-shrink-0 flex justify-center py-2">
        <RouletteWheel size="small" {...wheelProps} />
      </div>

      {/* Number Grid - Scrollable */}
      <div className="flex-1 overflow-y-auto px-2">
        {/* Zero + Numbers in horizontal scroll container */}
        <div className="overflow-x-auto pb-2 scrollbar-hide">
          <div className="flex gap-0.5 min-w-max">
            <ZeroCell {...zeroProps} />
            <div className="grid grid-rows-3 grid-flow-col gap-0.5">
              {NUMBERS.map(num => (
                <NumberCell key={num} number={num} {...cellProps} />
              ))}
            </div>
            {/* Column bets at end */}
            <div className="flex flex-col gap-0.5">
              <ColumnButton column={3} label="2:1" />
              <ColumnButton column={2} label="2:1" />
              <ColumnButton column={1} label="2:1" />
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="text-center text-xs text-zinc-500 py-1">
          ← Swipe to see all numbers →
        </div>

        {/* Advanced bets toggle */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full py-2 text-xs text-zinc-400 border-t border-zinc-800"
        >
          {showAdvanced ? '▼ Hide' : '▶ Show'} Split/Corner/Street Bets
        </button>

        {showAdvanced && (
          <div className="py-2 text-xs text-zinc-400">
            <p>Tap edges between numbers for Split bets (17:1)</p>
            <p>Tap corners for Corner bets (8:1)</p>
            <p>Tap left edge for Street bets (11:1)</p>
          </div>
        )}
      </div>

      {/* Outside Bets - Sticky above betting rail */}
      <OutsideBetsBar {...outsideBetsProps} />

      {/* Betting Rail - Fixed at bottom (existing component) */}
      {/* Height: ~140px */}
    </div>
  );
};
```

#### 5.2 Screen Real Estate Allocation (Mobile)

```
┌─────────────────────────────────────┐
│         Roulette Wheel (120px)      │  Fixed
├─────────────────────────────────────┤
│                                     │
│     Number Grid (scrollable)        │  Flexible
│     ← 0 │ 3 6 9 12 15 18 21 24 → │  (touch to scroll)
│        │ 2 5 8 11 14 17 20 23    │
│        │ 1 4 7 10 13 16 19 22    │
│                                     │
│     ← Swipe to see all numbers →    │
│                                     │
├─────────────────────────────────────┤
│  1st12  │  2nd12  │  3rd12  (32px) │  Sticky
│ 1-18│EVEN│RED│BLK│ODD│19-36 (40px) │
├─────────────────────────────────────┤
│                                     │
│  CLR $0.00 MAX    [BET]    [chips] │  Fixed
│  +/- CHIPS $7.76                    │  (~140px)
│  ⌂  HOUSE $897.02                   │
│                                     │
└─────────────────────────────────────┘
```

### Phase 6: Betting Rail Improvements

#### 6.1 Reduce Betting Rail Height

Current betting rail is ~140px. Can be reduced to ~100px on mobile:

```tsx
// In BettingRail.tsx - mobile section
<div className="md:hidden fixed bottom-0 left-0 right-0 z-50">
  <div className="h-[100px] bg-zinc-900 border-t border-zinc-800 px-2 py-1">
    <div className="flex items-center h-full gap-2">
      {/* Left: Compact balances */}
      <div className="flex flex-col text-xs">
        <span className="text-zinc-400">CHIPS: <span className="text-yellow-400">${chips}</span></span>
        <span className="text-zinc-400">HOUSE: ${house}</span>
      </div>

      {/* Center: Bet amount + BET button */}
      <div className="flex-1 flex items-center justify-center gap-2">
        <button onClick={clearBet} className="text-xs px-2 py-1 bg-zinc-800 rounded">CLR</button>
        <span className="text-lg font-bold">${betAmount}</span>
        <button onClick={setMax} className="text-xs px-2 py-1 bg-zinc-800 rounded">MAX</button>
      </div>

      {/* Right: Chips */}
      <div className="flex flex-col gap-1">
        {CHIPS.map(chip => (
          <ChipButton key={chip.value} {...chip} size="xs" />
        ))}
      </div>
    </div>
  </div>
</div>
```

### Phase 7: Visual Polish

#### 7.1 Win/Loss Animations

```css
/* animations.css */

@keyframes win-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(250, 204, 21, 0.7); }
  50% { box-shadow: 0 0 0 10px rgba(250, 204, 21, 0); }
}

@keyframes chip-bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}

@keyframes lose-shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-4px); }
  75% { transform: translateX(4px); }
}

.winner-cell {
  animation: win-pulse 1s ease-in-out infinite;
}

.winning-chip {
  animation: chip-bounce 0.5s ease-in-out 3;
}

.losing-bet {
  animation: lose-shake 0.3s ease-in-out;
}
```

#### 7.2 Loading States

```tsx
// Skeleton loader while wheel is processing
const SpinSkeleton = () => (
  <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
    <div className="flex flex-col items-center gap-2">
      <div className="w-12 h-12 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin" />
      <span className="text-yellow-400 font-bold animate-pulse">SPINNING...</span>
    </div>
  </div>
);
```

---

## Implementation Checklist

### Phase 1: Core Grid Fix (Priority: CRITICAL)
- [ ] Create `NumberCell.tsx` component with 44px minimum tap target
- [ ] Create `ZeroCell.tsx` component
- [ ] Replace scaling with horizontal scroll container
- [ ] Add scroll indicator ("← Swipe →")
- [ ] Test on iPhone SE (375px width) - smallest common device
- [ ] Test on Android (360px width)

### Phase 2: Outside Bets (Priority: HIGH)
- [ ] Create `OutsideBetsBar.tsx` as sticky component
- [ ] Create `DozenButton.tsx` component
- [ ] Create `OutsideBetButton.tsx` component
- [ ] Position above betting rail (sticky)
- [ ] Test all 9 outside bet types work correctly

### Phase 3: Advanced Bets (Priority: MEDIUM)
- [ ] Create `SplitBetOverlay.tsx` with all valid split positions
- [ ] Create `CornerBetOverlay.tsx` with all valid corner positions
- [ ] Create `StreetBetOverlay.tsx` with all valid street positions
- [ ] Add `SixLineBetOverlay.tsx`
- [ ] Add toggle to show/hide advanced bet zones
- [ ] Test bet placement for each type

### Phase 4: Gestures & Feedback (Priority: MEDIUM)
- [ ] Implement `useGestures.ts` hook
- [ ] Implement `useHaptics.ts` hook
- [ ] Add haptic feedback to chip placement
- [ ] Add haptic feedback to wins
- [ ] Test long-press to remove bet

### Phase 5: Layout (Priority: HIGH)
- [ ] Restructure `MobileBettingBoard.tsx` layout
- [ ] Reduce betting rail height to 100px
- [ ] Test full layout on multiple devices
- [ ] Ensure wheel is visible while betting

### Phase 6: Polish (Priority: LOW)
- [ ] Add win/lose animations
- [ ] Add loading skeleton
- [ ] Add sound effects (optional)
- [ ] Performance optimization (memoization)

---

## Testing Matrix

| Device | Width | Test Cases |
|--------|-------|------------|
| iPhone SE | 375px | All numbers visible via scroll, tap targets ≥44px |
| iPhone 14 | 390px | Same as above |
| iPhone 14 Pro Max | 430px | Slightly larger cells possible |
| Pixel 7 | 412px | Android touch handling |
| Galaxy S23 | 360px | Smallest Android, must work |
| iPad Mini | 768px | Can show full grid without scroll |

### Manual Test Checklist

- [ ] Can see and bet on number 0
- [ ] Can see and bet on numbers 1, 2, 3
- [ ] Can scroll to see numbers 34, 35, 36
- [ ] Can place bet on Red
- [ ] Can place bet on 1st 12
- [ ] Can place Split bet between 1 and 2
- [ ] Can place Corner bet on 1-2-4-5
- [ ] Long-press removes bet
- [ ] Haptic feedback on bet placement
- [ ] Win animation shows correctly
- [ ] Lose animation shows correctly

---

## Migration Strategy

1. **Create new components** alongside existing ones (non-breaking)
2. **Add feature flag** `USE_NEW_MOBILE_BOARD` in config
3. **A/B test** if possible (show old vs new to different users)
4. **Gradual rollout**: 10% → 50% → 100%
5. **Remove old code** after 2 weeks stable

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Touch targets still too small | Users can't bet | Enforce 44px minimum in CSS, test on real devices |
| Scroll confusing to users | Users don't find numbers | Add visual scroll indicator, haptic at edges |
| Advanced bets too complex | Users don't use them | Hide by default, progressive disclosure |
| Performance issues | Laggy scrolling | Virtualize number grid if needed, memoize |
| Breaking existing functionality | Lost bets | Keep old code as fallback, feature flag |

---

## Appendix: Backend Bet Types Reference

The backend (`roulette_backend`) supports these bet types that the UI must handle:

```rust
type BetType = variant {
    Straight: nat8;                    // Single number (0-36) - 35:1
    Split: record { nat8; nat8 };      // Two adjacent numbers - 17:1
    Street: nat8;                      // Row of 3 (start num) - 11:1
    Corner: nat8;                      // 4 numbers (top-left) - 8:1
    SixLine: nat8;                     // 6 numbers (start num) - 5:1
    Column: nat8;                      // 12 numbers (1-3) - 2:1
    Dozen: nat8;                       // 12 numbers (1-3) - 2:1
    Red;                               // 18 red numbers - 1:1
    Black;                             // 18 black numbers - 1:1
    Even;                              // 18 even numbers - 1:1
    Odd;                               // 18 odd numbers - 1:1
    Low;                               // 1-18 - 1:1
    High;                              // 19-36 - 1:1
};
```

**Currently implemented in UI:** Straight, Column, Dozen, Red, Black, Even, Odd, Low, High
**NOT implemented in UI:** Split, Street, Corner, SixLine

---

## Author Notes

This refactor is critical for launch. The current mobile experience is essentially broken - users cannot access 4 numbers (0, 1, 2, 3) which represent 10.8% of the wheel. The scaling approach was a quick fix that doesn't work on smaller phones.

The new approach prioritizes:
1. **Accessibility** - All numbers reachable
2. **Usability** - Large tap targets
3. **Discoverability** - Outside bets always visible
4. **Completeness** - All backend bet types supported

Estimated effort: 3-5 days for a skilled React developer familiar with the codebase.
