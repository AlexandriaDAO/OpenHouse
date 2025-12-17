# Life2 Garbage Collection Feature

## Overview

Implement a periodic garbage collection mechanism that removes small, isolated, stable patterns (blocks, blinkers, etc.) to prevent the board from filling up with debris. The 512x512 grid is divided into 16 quadrants (4x4 layout, each 128x128 cells). Every 5 minutes, we identify "stale" quadrants (no activity) and remove garbage patterns from them while preserving larger player-built structures.

## Goal

1. **Reduce cycle burn** from ~$2,500/year to ~$500/year by eliminating compute on stable garbage patterns
2. **Keep the board playable** by clearing debris that blocks new placements
3. **Preserve player investments** by only killing small isolated garbage, not bases or complex structures

## The Problem

Without cleanup, the grid fills with "garbage":
- Blocks (2x2 still lifes)
- Blinkers (period-2 oscillators)
- Beehives, loafs, boats, and other small stable patterns

These emerge from collisions and consume compute cycles forever, even though they're not interesting gameplay.

## The Solution: Targeted Garbage Collection

### What Gets Killed

A pattern is garbage if ALL of these are true:
1. **Small**: 4 or fewer connected cells
2. **Isolated**: No other alive cells within 4 cells in any direction
3. **Stale**: Located in a quadrant with no activity for 5 minutes

### What Gets Preserved

- Patterns larger than 4 cells (player bases, complex structures)
- Small patterns near other alive cells (might be part of something bigger)
- Anything in active quadrants (players are engaged there)

### Visual Example

```
Stale quadrant after 5 minutes:

    □□           ← 4 cells, isolated = GARBAGE (kill)
    □□

                        ▪
                       ▪▪▪     ← 15 cells = PRESERVED (too big)
         □□            ▪▪▪▪
         □□  ←─────────▪▪▪
          ↑
     4 cells, but neighbor is 2 cells away = PRESERVED (not isolated)
```

## Algorithm (Plain English)

```
Every 5 minutes:

Step 1: Check each quadrant
  - Did ANY cell change (birth or death) in this quadrant in the last 5 minutes?
  - If yes: skip this quadrant, it's active
  - If no: this quadrant is "stale", go to Step 2

Step 2: Find clumps of alive cells in the stale quadrant
  - Start at any alive cell
  - Find all alive cells connected to it (touching horizontally, vertically, or diagonally)
  - That group is one "clump"
  - Repeat until all clumps are found

Step 3: For each clump, ask two questions
  Question A: Is it small?
    - Count the cells in the clump
    - Small = 4 or fewer cells

  Question B: Is it lonely?
    - Look 4 cells out in every direction from the clump
    - Are there any OTHER alive cells nearby?
    - Lonely = no other alive cells within 4 cells

Step 4: Kill or spare
  - If small AND lonely: kill it (it's garbage)
  - If big OR has neighbors: spare it (might be important)

Step 5: Cleanup
  - Remove killed cells from the potential set
  - Reset activity flags for next 5-minute window
```

## Why This Works (Cost Analysis)

### Without garbage collection

Say 1,000 blocks and 500 blinkers scattered around:
- Each adds ~10-12 cells to the potential set
- ~17,000 cells checked every generation just for garbage
- At 10 generations/second: 17,000 × 3,000 = **51,000,000 checks per 5 minutes**

### With garbage collection

One-time cost every 5 minutes:
- Check 16 quadrant flags: ~16 operations
- Scan stale quadrants for clumps: ~50,000 operations
- Check isolation for small clumps: ~50,000 operations
- **Total GC cost: ~100,000 operations**

After cleanup (assuming 80% of garbage is in stale quadrants):
- Potential set reduced by ~14,000 cells
- Ongoing cost: 3,000 × 3,000 = **9,000,000 checks per 5 minutes**

**Result: ~5x reduction in compute for garbage processing**

The key insight: GC runs once per 5 minutes. Simulation runs 3,000 times. Even expensive GC pays for itself many times over.

## Implementation Outline

### 1. Quadrant Activity Tracking

Track whether each quadrant had ANY cell change (birth or death) since the last GC pass. This is the "staleness" signal - no per-cell tracking needed.

- 16 boolean flags (one per quadrant)
- Set flag to `true` when any cell in that quadrant changes
- Reset all flags to `false` after each GC pass
- On init/upgrade, set all flags to `true` (grace period)

### 2. Activity Detection

During simulation, when a cell is born or dies:
- Calculate which quadrant it's in
- Mark that quadrant as active

This is O(1) per cell change - negligible overhead.

### 3. Garbage Collection Pass (every 5 minutes)

For each stale quadrant:
1. Scan for alive cells
2. Flood-fill to find connected components
3. For small components (≤4 cells), check isolation
4. Kill isolated small components
5. Update potential set for killed cells

### 4. Connected Component Detection

Use flood-fill starting from any alive cell:
- Mark cell as visited
- Recursively visit all 8 neighbors that are alive and unvisited
- Collect all cells in the component
- Early exit if component exceeds 4 cells (not garbage)

### 5. Isolation Check

For a small component, check if any OTHER alive cell exists within 4 cells:
- For each cell in the component, check a 9x9 area centered on it
- If any alive cell found that's not part of this component, it's not isolated
- Optimization: can exit early on first neighbor found

### 6. Killing Garbage

When killing a garbage pattern:
- Set alive bit to false (preserve owner and coins)
- Remove from potential set
- Add neighbors to potential set (they might now change)

## State to Add

```
New thread_local variables:
- QUADRANT_ACTIVITY: [bool; 16] - has quadrant had activity since last GC?
- LAST_GC_TIME_NS: u64 - timestamp for UI countdown

New constants:
- QUADRANT_SIZE: 128
- QUADRANTS_PER_SIDE: 4
- TOTAL_QUADRANTS: 16
- GC_INTERVAL_SECS: 300 (5 minutes)
- GARBAGE_MAX_SIZE: 4
- ISOLATION_DISTANCE: 4
```

## What's NOT Persisted

Activity flags and GC timestamp are NOT persisted across upgrades. On upgrade:
- All quadrants get a fresh 5-minute grace period (flags start as `true`)
- GC timer restarts from zero

This is fine - worst case is garbage survives one extra cycle after upgrade.

## Edge Cases

### Patterns spanning quadrant boundaries
- A pattern split across two quadrants might have half wiped if one quadrant is stale
- This is acceptable: the remaining half will either die naturally or regenerate

### Large garbage accumulation in active quadrants
- Garbage mixed with player activity won't be cleaned
- Acceptable tradeoff: players are engaged there, they can deal with it
- Most garbage accumulates in abandoned areas anyway

### Very active board with no stale quadrants
- GC pass is very cheap (just check 16 flags, all true, done)
- No unnecessary work

## Testing

After deployment:
1. Place a few blocks in an empty quadrant, wait 5 minutes → should be killed
2. Place a large structure (>4 cells) in empty quadrant, wait 5 minutes → should survive
3. Place a block next to a larger structure, wait 5 minutes → should survive (not isolated)
4. Place cells and keep interacting → quadrant stays active, nothing killed
5. Verify potential set shrinks after GC removes garbage
