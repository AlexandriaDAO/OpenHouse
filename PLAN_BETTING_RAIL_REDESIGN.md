# AUTONOMOUS PR ORCHESTRATOR - DO NOT SKIP

**You are an autonomous PR orchestrator. Your ONLY job is to implement this plan and create a PR.**

## Isolation Check (RUN FIRST)
```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
if [ "$REPO_ROOT" = "/home/theseus/alexandria/openhouse" ]; then
    echo "FATAL: In main repo. Must be in worktree."
    echo "Worktree: /home/theseus/alexandria/openhouse-betting-rail-redesign-gemini"
    exit 1
fi
echo "In isolated worktree: $REPO_ROOT"
```

## Your Autonomous Workflow (NO QUESTIONS ALLOWED)
1. **Verify isolation** - You must be in worktree: `/home/theseus/alexandria/openhouse-betting-rail-redesign-gemini`
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
   echo "Visit: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io/dice"
   ```
5. **Create PR** (MANDATORY):
   ```bash
   git add .
   git commit -m "refactor(betting-rail): Complete UI overhaul - buttons, layout, refresh"
   git push -u origin feature/betting-rail-redesign-gemini
   gh pr create --title "Refactor: Betting Rail Complete UI Overhaul" --body "Implements PLAN_BETTING_RAIL_REDESIGN.md

   ## Summary
   - Bottom-anchored layout (chips grow upward, controls fixed)
   - Unified refresh button for all balances
   - New button hierarchy (primary/secondary/accent/tertiary)
   - Hybrid style: cyberpunk + minimal + casino
   - Same styling for desktop and mobile

   ## Changes
   - BettingRail.css: New button system, layout fixes
   - BettingRail.tsx: Restructure layout, move refresh, apply new classes
   - InteractiveChipStack.tsx: Adjust for bottom-anchored layout

   Deployed to mainnet:
   - Frontend: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io"
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

**Branch:** `feature/betting-rail-redesign-gemini`
**Worktree:** `/home/theseus/alexandria/openhouse-betting-rail-redesign-gemini`

---

# Implementation Plan: Betting Rail Complete UI Overhaul

## Task Classification
**REFACTORING** - Improve existing code with targeted fixes for UX issues

## Goals
1. **Fix layout instability** - Bottom-anchor controls so chips grow upward without shifting content
2. **Unify refresh button** - Single prominent button that clearly refreshes ALL balances
3. **Improve button visibility** - Make max/clear/cashout more visible and accessible
4. **Consistent button styling** - Unified button system with clear hierarchy
5. **Hybrid aesthetic** - Cyberpunk (glow) + minimal (clean) + casino (gold accents)

---

## Current Issues

### Issue 1: Layout Instability (Lines 193-224 in BettingRail.tsx)
The chip stack is at the top of the rail, pushing content down as chips are added.
```tsx
// CURRENT - chips at top, pushes content
<div className="flex flex-col items-center gap-1">
  <InteractiveChipStack ... />      // This grows and pushes everything
  <div>$X.XX max clear</div>
</div>
```

### Issue 2: Refresh Button Placement (Lines 236-247)
Refresh button is only next to "House", making users think it only refreshes House.
```tsx
// CURRENT - confusing placement
<div>House: <span>${formatUSDT(houseBalance)}</span>
  <button onClick={onBalanceRefresh}>...</button>  // Only here!
</div>
```

### Issue 3: Invisible Buttons (Lines 207-222)
Max/clear buttons use `text-[10px]` (10 pixels!) and `text-gray-500` (low contrast).
```tsx
// CURRENT - tiny and invisible
<button className="text-gray-500 hover:text-green-400 text-[10px] ...">
  max ${maxBet.toFixed(2)}
</button>
```

### Issue 4: Inconsistent Button Styles (Lines 272-290)
Each button has completely different styling - no visual hierarchy.

---

## Implementation

### Step 1: Add New Button CSS Classes

**File:** `openhouse_frontend/src/components/game-ui/BettingRail.css`

Add these new classes (keep existing chip animations):

```css
/* ========================================
   RAIL BUTTONS - New Unified System
   ======================================== */

/* Base button - shared styles */
.rail-btn {
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  transition: all 0.2s ease;
  cursor: pointer;
  font-family: 'JetBrains Mono', monospace;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

/* Primary - Buy Chips (green, prominent) */
.rail-btn-primary {
  background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
  color: white;
  border: 1px solid rgba(34, 197, 94, 0.3);
  box-shadow: 0 0 12px rgba(34, 197, 94, 0.2);
}

.rail-btn-primary:hover:not(:disabled) {
  box-shadow: 0 0 20px rgba(34, 197, 94, 0.4);
  transform: translateY(-1px);
}

/* Secondary - Cash Out (gold/amber outline, casino feel) */
.rail-btn-secondary {
  background: transparent;
  color: #fbbf24;
  border: 1px solid rgba(251, 191, 36, 0.4);
}

.rail-btn-secondary:hover:not(:disabled) {
  background: rgba(251, 191, 36, 0.1);
  border-color: #fbbf24;
  box-shadow: 0 0 12px rgba(251, 191, 36, 0.2);
}

/* Accent - Be The House (turquoise with glow, brand color) */
.rail-btn-accent {
  background: linear-gradient(135deg, #39FF14 0%, #00d4aa 100%);
  color: #000;
  border: 1px solid rgba(57, 255, 20, 0.3);
  box-shadow: 0 0 12px rgba(57, 255, 20, 0.2);
  font-weight: 700;
}

.rail-btn-accent:hover:not(:disabled) {
  box-shadow: 0 0 20px rgba(57, 255, 20, 0.4);
  transform: translateY(-1px);
}

/* Tertiary - Max/Clear (subtle but visible) */
.rail-btn-tertiary {
  background: rgba(255, 255, 255, 0.05);
  color: #9ca3af;
  border: 1px solid rgba(255, 255, 255, 0.15);
  padding: 4px 10px;
  font-size: 10px;
}

.rail-btn-tertiary:hover:not(:disabled) {
  color: white;
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.3);
}

/* Clear variant - red on hover */
.rail-btn-tertiary.rail-btn-danger:hover:not(:disabled) {
  color: #f87171;
  border-color: rgba(248, 113, 113, 0.3);
  background: rgba(248, 113, 113, 0.1);
}

/* Disabled state for all */
.rail-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
  transform: none !important;
  box-shadow: none !important;
}

/* Icon button (refresh) */
.rail-btn-icon {
  padding: 4px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #6b7280;
  transition: all 0.15s ease;
}

.rail-btn-icon:hover {
  color: white;
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
}

/* ========================================
   BALANCE PANEL
   ======================================== */

.balance-panel {
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 8px 12px;
}

.balance-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
  padding-bottom: 4px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.balance-label {
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #6b7280;
}
```

### Step 2: Restructure Layout (Bottom-Anchored)

**File:** `openhouse_frontend/src/components/game-ui/BettingRail.tsx`

**DESKTOP Layout (Lines 188-295):**

```tsx
// PSEUDOCODE - New structure

{/* Fixed bottom container - DESKTOP */}
<div className="hidden md:block fixed bottom-0 left-0 right-0 z-40">
  <div className="betting-rail">
    <div className="container mx-auto px-6 py-3">

      {/* BOTTOM ROW - Fixed, never moves */}
      <div className="flex items-end justify-between">

        {/* LEFT: Balance Panel with unified refresh */}
        <div className="balance-panel w-44">
          <div className="balance-header">
            <span className="balance-label">Balances</span>
            <button
              onClick={onBalanceRefresh}
              className="rail-btn-icon"
              title="Refresh all balances"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 12c0-4.4 3.6-8 8-8 3.1 0 5.8 1.8 7.1 4.4M20 12c0 4.4-3.6 8-8 8-3.1 0-5.8-1.8-7.1-4.4"/>
                <path d="M20 4v4h-4M4 20v-4h4"/>
              </svg>
            </button>
          </div>
          <div className="space-y-1 text-xs">
            <div className="text-gray-400">
              Chips: <span className="text-white font-mono">${formatUSDT(gameBalance)}</span>
            </div>
            <div className="text-gray-500">
              Wallet: <span className="text-gray-400 font-mono">${formatUSDT(walletBalance)}</span>
            </div>
            <div className="text-gray-500">
              House: <span className="text-gray-400 font-mono">${formatUSDT(houseBalance)}</span>
            </div>
          </div>
        </div>

        {/* CENTER: Bet Display + Chips */}
        <div className="flex flex-col items-center">
          {/* Chip Stack - grows upward */}
          <div className="mb-2">
            <InteractiveChipStack
              amount={betAmount}
              onRemoveChip={removeChip}
              disabled={disabled}
              maxChipsPerPile={8}
            />
          </div>

          {/* Bet Amount + Max/Clear */}
          <div className="flex items-center gap-2 mb-3">
            <div className="text-white font-mono font-bold text-xl">
              ${betAmount.toFixed(2)}
            </div>
            <button
              onClick={() => onBetChange(Math.min(maxBet, gameBalanceUSDT))}
              disabled={disabled || betAmount >= maxBet || betAmount >= gameBalanceUSDT}
              className="rail-btn-tertiary"
            >
              MAX
            </button>
            {betAmount > 0 && (
              <button
                onClick={clearBet}
                disabled={disabled}
                className="rail-btn-tertiary rail-btn-danger"
              >
                CLEAR
              </button>
            )}
          </div>

          {/* Chip Buttons Row */}
          <div className="flex items-center gap-2">
            {CHIP_DENOMINATIONS.map(chip => (
              <button
                key={chip.color}
                onClick={() => addChip(chip)}
                disabled={disabled || !canAddChip(chip.value)}
                className="chip-button"
                title={`Add $${chip.value.toFixed(2)}`}
              >
                <img
                  src={chip.topImg}
                  alt={chip.label}
                  className="w-12 h-12 object-contain"
                />
              </button>
            ))}
          </div>
        </div>

        {/* RIGHT: Action Buttons */}
        <div className="flex flex-col items-end gap-2 w-44">
          <button
            onClick={() => setShowDepositModal(true)}
            className={`rail-btn rail-btn-primary ${showDepositAnimation ? 'deposit-button-pulse' : ''}`}
          >
            + Buy Chips
          </button>
          <button
            onClick={handleWithdrawAll}
            disabled={isWithdrawing || gameBalance === 0n}
            className="rail-btn rail-btn-secondary"
          >
            Cash Out
          </button>
          <button
            onClick={() => navigate(isLiquidityRoute ? '/dice' : '/dice/liquidity')}
            className="rail-btn rail-btn-accent"
          >
            {isLiquidityRoute ? 'Play Game' : 'Be The House'}
          </button>
        </div>
      </div>
    </div>
  </div>
</div>
```

**MOBILE Layout (Lines 297-385):**

Apply the same changes to mobile:
- Same balance panel structure with unified refresh
- Same button classes (rail-btn-primary, etc.)
- Same layout principle (controls fixed, chips above)

```tsx
// PSEUDOCODE - Mobile structure

{/* MOBILE: Bottom bar */}
<div className="md:hidden fixed bottom-0 left-0 right-0 z-50">
  <div className="betting-rail">
    <div className="px-4 py-2">

      {/* Top row: Balances + Actions */}
      <div className="flex items-start justify-between mb-2">
        {/* Left: Balance panel (compact) */}
        <div className="balance-panel flex-1 mr-2">
          <div className="balance-header">
            <span className="balance-label">Balances</span>
            <button onClick={onBalanceRefresh} className="rail-btn-icon">
              <svg className="w-3 h-3">...</svg>
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1 text-[10px]">
            <div>Chips: <span className="text-white">${formatUSDT(gameBalance)}</span></div>
            <div>Wallet: ${formatUSDT(walletBalance)}</div>
            <div>House: ${formatUSDT(houseBalance)}</div>
          </div>
        </div>

        {/* Right: Actions (stacked) */}
        <div className="flex flex-col gap-1">
          <button onClick={() => setShowDepositModal(true)} className="rail-btn rail-btn-primary text-[10px] py-1 px-2">
            + Buy
          </button>
          <button onClick={handleWithdrawAll} disabled={...} className="rail-btn rail-btn-secondary text-[10px] py-1 px-2">
            Cash
          </button>
          <button onClick={() => navigate(...)} className="rail-btn rail-btn-accent text-[10px] py-1 px-2">
            {isLiquidityRoute ? 'Play' : 'House'}
          </button>
        </div>
      </div>

      {/* Center: Stack + Amount */}
      <div className="flex flex-col items-center">
        <InteractiveChipStack ... />
        <div className="flex items-center gap-2 my-1">
          <div className="text-white font-mono font-bold">${betAmount.toFixed(2)}</div>
          <button className="rail-btn-tertiary text-[9px]">MAX</button>
          {betAmount > 0 && <button className="rail-btn-tertiary rail-btn-danger text-[9px]">CLEAR</button>}
        </div>
      </div>

      {/* Chip buttons */}
      <div className="flex justify-center gap-1">
        {CHIP_DENOMINATIONS.map(chip => (
          <button key={chip.color} className="chip-button">
            <img src={chip.topImg} className="w-10 h-10" />
          </button>
        ))}
      </div>
    </div>
  </div>
</div>
```

### Step 3: Update InteractiveChipStack (if needed)

**File:** `openhouse_frontend/src/components/game-ui/InteractiveChipStack.tsx`

The component should work with the new layout. Only adjust if needed:
- Ensure chips render correctly when positioned above controls
- Keep existing animations

---

## Files to Modify

| File | Action | Key Changes |
|------|--------|-------------|
| `BettingRail.css` | Add classes | New `.rail-btn-*` system, `.balance-panel` |
| `BettingRail.tsx` | Restructure | Layout reorder, apply classes, move refresh |
| `InteractiveChipStack.tsx` | Review | Likely no changes needed |

---

## Visual Result

**Before:**
```
┌─ Curved felt rail ─────────────────────────────┐
│  [Chips grow and push everything down]         │
│  Chips: $X  Wallet: $Y  House: $Z [refresh]   │ <- refresh only for House?
│  [tiny max] [tiny clear]                       │ <- hard to see
│  [chip buttons]                                │
│  + Buy Chips   Cash Out   Be The House         │ <- inconsistent styles
└────────────────────────────────────────────────┘
```

**After:**
```
┌─ Clean dark rail ──────────────────────────────┐
│           [Chip stack grows upward]            │
│  ┌─────────┐                    ┌────────────┐ │
│  │Balances↺│  $10.00  MAX CLEAR │ + Buy Chips│ │ <- unified refresh
│  │Chips $X │  [chip buttons]    │  Cash Out  │ │ <- visible buttons
│  │Wallet $Y│                    │ Be The House│ │ <- consistent styles
│  │House $Z │                    └────────────┘ │
│  └─────────┘                                   │
└────────────────────────────────────────────────┘
```

---

## Deployment Notes

- **Affected canisters:** Frontend only (`pezw3-laaaa-aaaal-qssoa-cai`)
- **No backend changes required**
- **Test at:** https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io/dice
- **Mobile test:** Same URL on mobile device/emulator
