# Quadrant Domination - Frontend Implementation Guide

## Feature Overview

The Life1 game now has a **Quadrant Domination** system that creates natural game progression and win conditions. The 512x512 grid is divided into 16 quadrants (4x4 grid of 128x128 cells each). Players can claim quadrants by achieving territorial dominance and triggering a "wipe."

### Core Mechanics

1. **90% Domination Threshold**: When a player owns 90%+ of all cells (alive or dead) in a quadrant, they can trigger a "wipe"
2. **Cell Wipe**: Kills all cells in the quadrant, sets all territory to the wiper's ownership, points on cells preserved
3. **Quadrant Lock**: After wipe, the quadrant is "claimed" - other players cannot place cells inside
4. **Lock Breaking**: Lock breaks when owner's territory drops below 50% (from cells infiltrating from outside)
5. **Win Condition**: First player to claim all 16 quadrants wins, receives all points, game resets

### Strategic Considerations

- **Wipe is optional**: Players might not want to wipe because:
  - They lose their living cells (point generation stops)
  - The quadrant becomes a "honeypot" target for others
  - They can only wipe each quadrant once per game
- **Infiltration**: Other players must place cells OUTSIDE locked quadrants and let them naturally spread in via Game of Life rules
- **Endgame**: Claiming all 16 quadrants simultaneously is very difficult - requires defending while attacking

---

## Backend API

### Canister ID
```
pijnb-7yaaa-aaaae-qgcuq-cai
```

### New Methods

#### `get_quadrant_states(game_id: nat64) -> Result<Vec<QuadrantInfo>, String>` (Query)

Returns detailed state for all 16 quadrants. This is the primary method for frontend polling.

**Response Structure:**
```typescript
interface QuadrantInfo {
  id: number;                    // 0-15 (quadrant index)
  row: number;                   // 0-3 (grid row)
  col: number;                   // 0-3 (grid column)
  claimed_by: number;            // 0 = unclaimed, 1-10 = player ID
  territory_counts: number[];    // Territory per player [player1, player2, ..., player10]
  can_wipe: boolean[];          // Which players can wipe [p1_can, p2_can, ..., p10_can]
}
```

**Quadrant Layout (IDs):**
```
+----+----+----+----+
|  0 |  1 |  2 |  3 |   Row 0
+----+----+----+----+
|  4 |  5 |  6 |  7 |   Row 1
+----+----+----+----+
|  8 |  9 | 10 | 11 |   Row 2
+----+----+----+----+
| 12 | 13 | 14 | 15 |   Row 3
+----+----+----+----+
  Col0 Col1 Col2 Col3
```

**Grid Coordinates:**
- Quadrant 0: rows 0-127, cols 0-127
- Quadrant 1: rows 0-127, cols 128-255
- Quadrant 5: rows 128-255, cols 128-255
- Formula: `start_row = (id / 4) * 128`, `start_col = (id % 4) * 128`

#### `wipe_quadrant(quadrant_id: nat8) -> Result<WipeResult, String>` (Update)

Player-initiated action to wipe a quadrant they dominate.

**Request:** Single `nat8` (0-15)

**Response:**
```typescript
interface WipeResult {
  success: boolean;
  quadrant_id: number;
  cells_wiped: number;           // Always 16,384 (128x128)
  quadrant_now_claimed: boolean; // Always true on success
}
```

**Possible Errors:**
- `"Anonymous players not allowed."` - Must be authenticated
- `"Invalid quadrant ID. Must be 0-15, got X"` - Bad input
- `"Not a registered player. Join the game first."` - Not in game
- `"You have already wiped this quadrant."` - One wipe per quadrant per player
- `"Insufficient domination. Need 90%, have X%"` - Below threshold

### Updated Methods

#### `get_metadata(game_id: nat64)` (Query)

Now includes quadrant state in response:
```typescript
interface GameMetadata {
  // ... existing fields ...
  quadrants: QuadrantState[];  // NEW: Array of 16 quadrant states
}

interface QuadrantState {
  claimed_by: number;    // 0 = unclaimed, 1-10 = player
  wipe_history: number;  // Bitmask: bit N = player N+1 has wiped
}
```

---

## Current Game State (as of deployment)

From `get_quadrant_states` call:

| Quadrant | Location | Top Player | Their Territory | Can They Wipe? |
|----------|----------|------------|-----------------|----------------|
| Q0 | Top-left | Player 2 | 15,072 (92%) | **YES** |
| Q1 | | Player 2 | 7,522 (46%) | No |
| Q5 | | Player 2 | 7,299 (45%) | No |
| Q12 | Bottom-left | Player 5 | 10,423 (64%) | No |
| Q14 | | Player 6 | 9,745 (59%) | No |

**Observation:** Player 2 is very close to being able to wipe Q0 and already qualifies!

---

## Frontend UI Recommendations

### 1. Quadrant Grid Overlay

Display a 4x4 grid overlay on the main game view:
- **Unclaimed**: Subtle dashed border
- **Claimed**: Solid border in player's color
- **Claimable by current user**: Pulsing/glowing border

### 2. Minimap Enhancement

The existing minimap could show:
- Quadrant boundaries
- Color intensity based on domination level
- Icons/badges for claimed quadrants

### 3. Quadrant Info Panel

When hovering/clicking a quadrant, show:
- Domination breakdown (pie chart or bar)
- Top player and their percentage
- "WIPE" button if current user can wipe
- Lock status and owner if claimed

### 4. Wipe Button/Action

When player has 90%+ in a quadrant:
- Prominent "WIPE QUADRANT" button
- Confirmation dialog explaining consequences:
  - All cells will die
  - Territory becomes yours
  - Quadrant locks to you
  - You can only do this once per quadrant
- Animation when wipe executes (all cells dying, territory claiming)

### 5. Win Condition Display

- Progress indicator: "Quadrants Claimed: 3/16"
- When someone wins: Full-screen celebration
- Leaderboard showing winner's total points

### 6. Lock Visualization

For locked quadrants:
- Semi-transparent overlay in owner's color
- "LOCKED" badge
- Show owner's current territory % (and that it needs to drop below 50% to unlock)

### 7. Infiltration Guidance

Help players understand they must:
- Place cells OUTSIDE locked quadrants
- Let cells naturally spread via Game of Life rules
- Consider showing "entry points" or edges where infiltration is happening

---

## Polling Strategy

### Recommended Approach

1. **Use existing `get_metadata` polling** - Now includes basic quadrant state
2. **Call `get_quadrant_states` less frequently** - It's heavier (full territory count)
   - On initial load
   - Every 5-10 seconds during active play
   - Immediately after user places cells near quadrant boundaries
   - After any wipe action

### Performance Notes

- `get_quadrant_states` scans all 262,144 cells - use sparingly
- `get_metadata` is lightweight and includes `quadrants` array for basic state
- Territory counts are computed on-demand (not cached)

---

## Constants Reference

```typescript
const QUADRANT_SIZE = 128;        // 128x128 cells per quadrant
const QUADRANTS_PER_ROW = 4;      // 4x4 = 16 quadrants
const TOTAL_QUADRANTS = 16;
const QUADRANT_CELLS = 16_384;    // 128 * 128
const DOMINATION_THRESHOLD = 0.90; // 90% to wipe
const LOCK_THRESHOLD = 0.50;       // 50% to maintain lock
```

---

## Files Modified in Backend

- `life1_backend/src/lib.rs` - Core implementation (~300 lines added)
- `life1_backend/life1_backend.did` - Candid interface updates

Key sections in lib.rs:
- Lines 24-30: Quadrant constants
- Lines 111-169: QuadrantState, QuadrantInfo, WipeResult, WinResult types
- Lines 371-454: Helper functions (get_quadrant_id, count_territory, update_locks)
- Lines 456-577: Wipe and win logic
- Lines 731-827: `wipe_quadrant` update method
- Lines 884-937: `get_quadrant_states` query method

---

## Frontend Files to Modify

### Main Game Page
```
openhouse_frontend/src/pages/Life.tsx
```
This is the primary file containing the Life game UI. It already has:
- Grid rendering
- Minimap
- Cell placement logic
- Player color handling

### TypeScript Declarations (NEED REGENERATION)
```
openhouse_frontend/src/declarations/life1_backend/life1_backend.did.d.ts
```
**Important:** After backend deployment, regenerate declarations:
```bash
dfx generate life1_backend
cp -r src/declarations/life1_backend openhouse_frontend/src/declarations/
```

The new types that will be available after regeneration:
- `QuadrantState`
- `QuadrantInfo`
- `WipeResult`
- Updated `GameMetadata` with `quadrants` field

### Actor Hook
Check if there's a `useLife1Actor.ts` hook, or use the existing pattern from other games.

---

## Testing on Mainnet

```bash
# Get all quadrant states
dfx canister --network ic call pijnb-7yaaa-aaaae-qgcuq-cai get_quadrant_states '(0 : nat64)'

# Attempt to wipe quadrant 0 (will fail if you don't have 90%)
dfx canister --network ic call pijnb-7yaaa-aaaae-qgcuq-cai wipe_quadrant '(0 : nat8)'
```
