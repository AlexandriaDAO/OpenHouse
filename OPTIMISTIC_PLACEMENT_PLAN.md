# Optimistic Placement Fix Plan

## Problem Statement

When a player places cells:
1. Cells appear immediately and start simulating locally
2. 1-3 seconds later, backend confirms placement
3. Next sync overwrites local state with backend state
4. Cells "snap back" to their original position (or disappear)

**Root Cause**: Local simulation advances placed cells, but backend hasn't received them yet. Sync replaces our optimistic state with stale backend state.

---

## Current Flow (Broken)

```
T+0ms:     User places glider at (100, 100)
           → Cells added to localCells[]
           → Local sim starts moving them immediately

T+125ms:   Local sim step 1: glider moves to (101, 101)
T+250ms:   Local sim step 2: glider moves to (102, 102)
...
T+2000ms:  Backend responds to place_cells() call
           → Sync happens with backend state
           → Backend state has glider at (100, 100) - just placed!
           → Local state snaps back to (100, 100)
           → Visual "teleport backward"
```

---

## Proposed Solution: Pending Placement System

### Concept

Treat freshly placed cells as "pending" until backend confirms simulation has caught up:

1. **Pending cells render as static preview** (pulsing, no simulation)
2. **Pending cells are excluded from sync overwrites**
3. **Once backend generation catches up, cells become "live"**

### New Flow (Fixed)

```
T+0ms:     User places glider at (100, 100)
           → Cells added to pendingCells[] with metadata:
             { cells: [...], placedAtGen: 78800, confirmed: false }
           → Render as pulsing preview (not in localCells yet)

T+125ms:   Local sim runs - pending cells NOT simulated
T+250ms:   Local sim runs - pending cells still static
...
T+2000ms:  Backend responds: place_cells() succeeded
           → Mark placement as confirmed: true
           → Still render as preview until backend catches up

T+2500ms:  Sync arrives: backend at gen 78808
           → Backend state now includes our placed cells!
           → Merge pending cells into localCells
           → Remove from pendingCells[]
           → Cells now simulate normally
```

---

## Implementation Details

### Files to Modify

| File | Changes |
|------|---------|
| `Life.tsx` | Add pending placement state, modify sync logic |
| `life/engine/types.ts` | Add `PendingPlacement` interface |
| `life/engine/OptimisticSimulation.ts` | Add pending cell management |

### New Types

```typescript
// life/engine/types.ts

interface PendingPlacement {
  id: string;                    // Unique ID for this placement
  cells: Array<[number, number]>; // Grid coordinates
  owner: number;                  // Player who placed
  placedAtGen: bigint;           // Backend generation when placed
  placedAtTime: number;          // Timestamp for timeout
  confirmed: boolean;            // Backend acknowledged the call
  patternName: string;           // For display purposes
}
```

### Sync Logic Changes

```typescript
// In processBackendState():

// 1. Check if any pending placements can be "graduated" to live
for (const pending of this.pendingPlacements) {
  if (pending.confirmed && state.generation >= pending.placedAtGen + 8n) {
    // Backend has simulated past our placement point
    // Cells should now be in backend state - remove from pending
    this.graduatePending(pending.id);
  }
}

// 2. When applying sync, preserve pending cell positions
// Don't overwrite cells that are in pendingPlacements
for (const pending of this.pendingPlacements) {
  for (const [x, y] of pending.cells) {
    const idx = y * GRID_SIZE + x;
    // Keep the pending cell alive in our local state
    // even if backend state says it's dead/different
    newCells[idx] = { owner: pending.owner, alive: true };
  }
}
```

### Rendering Changes

```typescript
// In drawCells():

// Render pending placements with distinct visual:
// - Pulsing opacity (existing previewPulse logic)
// - Slight glow or outline
// - Does NOT move (static position)

for (const pending of pendingPlacements) {
  for (const [x, y] of pending.cells) {
    const pulseOpacity = 0.5 + 0.3 * Math.sin(previewPulse * 0.1);
    ctx.fillStyle = `rgba(${playerColor}, ${pulseOpacity})`;
    ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
  }
}
```

---

## Edge Cases

### 1. Placement Timeout
If backend never confirms after 10 seconds:
- Show error toast
- Remove from pending
- Refund coins locally (will correct on next sync)

### 2. Placement Rejected
If backend returns error:
- Remove from pending immediately
- Show error message
- Don't add to localCells

### 3. Multiple Rapid Placements
Each placement gets unique ID and tracked separately.
Graduate them in order as backend catches up.

### 4. Player Disconnects
On reconnect, pending placements are lost.
Backend state is authoritative - if placement succeeded, it will appear.
If it failed, coins are refunded by backend.

---

## Visual States

| State | Appearance | Behavior |
|-------|------------|----------|
| **Preview** (before confirm) | Pulsing, semi-transparent | Static, click to place |
| **Pending** (confirmed, waiting for sync) | Pulsing, solid color | Static, no simulation |
| **Live** (graduated) | Solid color | Normal simulation |

---

## Step-by-Step Implementation

### Step 1: Add Pending State to Life.tsx

```typescript
// New state for pending placements (distinct from preview pendingPlacements)
const [confirmedPlacements, setConfirmedPlacements] = useState<PendingPlacement[]>([]);
```

### Step 2: Modify confirmPlacement()

```typescript
// After backend returns success:
setConfirmedPlacements(prev => [...prev, {
  id: placementId,
  cells: cellsPlaced,
  owner: myPlayerNum,
  placedAtGen: localGeneration,  // Track when we placed
  placedAtTime: Date.now(),
  confirmed: true,
  patternName: pattern.name,
}]);

// DON'T add to localCells yet - keep as pending
```

### Step 3: Modify Sync Logic

```typescript
// In sync effect, after applying backend state:

// Graduate placements that backend has caught up to
setConfirmedPlacements(prev => {
  const stillPending: PendingPlacement[] = [];

  for (const p of prev) {
    // Backend needs to be at least 8 gens past our placement
    // to ensure cells have been simulated
    if (state.generation >= p.placedAtGen + 8n) {
      // Graduated - cells are now in backend state
      console.log('[PLACEMENT:graduated]', { id: p.id, cells: p.cells.length });
    } else {
      stillPending.push(p);
    }
  }

  return stillPending;
});

// Preserve pending cells in local state
setLocalCells(cells => {
  const newCells = sparseToDense(state);

  for (const p of confirmedPlacements) {
    for (const [x, y] of p.cells) {
      const idx = y * GRID_SIZE + x;
      newCells[idx] = { owner: p.owner, alive: true };
    }
  }

  return newCells;
});
```

### Step 4: Modify Rendering

```typescript
// In drawCells(), render confirmed pending cells with pulsing effect
for (const placement of confirmedPlacements) {
  const age = Date.now() - placement.placedAtTime;
  const pulse = Math.sin(age * 0.005) * 0.2 + 0.8;  // 0.6 to 1.0

  for (const [x, y] of placement.cells) {
    if (x >= startX && x < startX + width && y >= startY && y < startY + height) {
      const screenX = (x - startX) * cellSize;
      const screenY = (y - startY) * cellSize;

      ctx.globalAlpha = pulse;
      ctx.fillStyle = PLAYER_COLORS[placement.owner];
      ctx.fillRect(screenX, screenY, cellSize - gap, cellSize - gap);
      ctx.globalAlpha = 1.0;
    }
  }
}
```

---

## Testing Checklist

- [ ] Place cells → see pulsing static preview
- [ ] Wait for backend confirm → cells still pulsing, not moving
- [ ] Wait for sync to catch up → cells start moving normally
- [ ] Place during high latency → cells remain static until graduated
- [ ] Rapid placements → all tracked and graduated in order
- [ ] Placement fails → pending removed, error shown
- [ ] Timeout after 10s → pending removed, error shown

---

## Success Criteria

1. **No snap-back**: Placed cells never teleport backward
2. **Clear feedback**: Player knows cells are "pending" vs "live"
3. **Smooth transition**: Cells start moving naturally when graduated
4. **Resilient**: Handles high latency, failures, rapid placements

---

## Files Summary

```
openhouse_frontend/src/pages/
├── Life.tsx                          # Main changes: pending state, sync logic, rendering
├── life/
│   └── engine/
│       ├── types.ts                  # Add PendingPlacement interface
│       └── OptimisticSimulation.ts   # Optional: move pending logic here
└── lifeConstants.ts                  # No changes needed
```

---

## Notes

- This is a UX improvement, not a correctness fix (backend is always authoritative)
- The pulsing effect reuses existing `previewPulse` animation logic
- Consider adding a small "Placing..." indicator near pending cells
- Could extend to show "X cells pending" in the UI somewhere
