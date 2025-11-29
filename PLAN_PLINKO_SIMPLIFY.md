# AUTONOMOUS PR ORCHESTRATOR - DO NOT SKIP

**You are an autonomous PR orchestrator. Your ONLY job is to implement this plan and create a PR.**

## Isolation Check (RUN FIRST)
```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
if [ "$REPO_ROOT" = "/home/theseus/alexandria/openhouse" ]; then
    echo "FATAL: In main repo. Must be in worktree."
    echo "Worktree: /home/theseus/alexandria/openhouse-plinko-simplify"
    exit 1
fi
echo "In isolated worktree: $REPO_ROOT"
```

## Your Autonomous Workflow (NO QUESTIONS ALLOWED)
1. **Verify isolation** - You must be in worktree: `/home/theseus/alexandria/openhouse-plinko-simplify`
2. **Implement feature** - Follow plan sections below
3. **Build & Deploy to Mainnet**:
   ```bash
   # Build plinko backend
   cargo build --target wasm32-unknown-unknown --release

   # Build frontend
   cd openhouse_frontend && npm run build && cd ..

   # Deploy to mainnet
   ./deploy.sh
   ```

4. **Verify deployment**:
   ```bash
   # Check plinko canister status
   dfx canister --network ic status plinko_backend

   # Test the live site
   echo "Visit: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io/plinko"
   ```

5. **Create PR** (MANDATORY):
   ```bash
   git add .
   git commit -m "refactor(plinko): simplify game to single-ball with 1% house edge"
   git push -u origin feature/plinko-simplify
   gh pr create --title "Refactor: Simplify Plinko to Pure Single-Ball Game" --body "$(cat <<'EOF'
## Summary
- Remove multi-ball feature from backend and frontend
- Delete dead code (PlinkoMotoko.tsx, Mines.tsx placeholder)
- Remove local game history tracking
- Simplify UI to show only last result (like Dice)
- Preserve pure mathematical formula with 1% house edge

## Test plan
- [ ] Visit https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io/plinko
- [ ] Drop single ball, verify animation works
- [ ] Verify multiplier displays correctly
- [ ] Confirm formula display shows: M(k) = 0.2 + 6.32 x ((k-4)/4)^2
- [ ] Check no multi-ball UI elements remain

Deployed to mainnet:
- Frontend: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io
- Plinko Backend: weupr-2qaaa-aaaap-abl3q-cai

Generated with Claude Code
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

**Branch:** `feature/plinko-simplify`
**Worktree:** `/home/theseus/alexandria/openhouse-plinko-simplify`

---

# Implementation Plan: Simplify Plinko to Pure Single-Ball Game

## Task Classification: REFACTORING
- Subtractive approach: remove complexity, delete dead code
- Target negative LOC (lines of code)

---

## 1. Current State Analysis

### Backend: `plinko_backend/src/lib.rs` (466 lines)
**Current Functions:**
- `drop_ball()` - Single ball drop (KEEP)
- `drop_balls(num_balls: u8)` - Multi-ball 1-10 (REMOVE)
- `get_multipliers()` - Query multipliers (KEEP)
- `get_formula()` - Query formula string (KEEP)
- `get_expected_value()` - Query EV (KEEP)
- `greet()` - Test function (KEEP)
- `calculate_multiplier()` - Internal function (KEEP)

**Types to Remove:**
- `MultiBallResult` struct

### Backend: `plinko_backend/plinko_backend.did`
**To Remove:**
- `MultiBallResult` type definition
- `drop_balls` function declaration

### Frontend Files
| File | Lines | Action |
|------|-------|--------|
| `pages/Plinko.tsx` | 368 | SIMPLIFY - remove history, multi-ball |
| `pages/PlinkoMotoko.tsx` | 397 | DELETE - dead code, uses wrong actor |
| `pages/Mines.tsx` | 1 | DELETE - just re-exports PlinkoMotoko |
| `components/game-specific/plinko/PlinkoBoard.tsx` | 276 | SIMPLIFY - single ball only |
| `components/game-specific/plinko/PlinkoMultipliers.tsx` | 57 | KEEP - already simple |
| `App.tsx` | 42 | MODIFY - remove dead routes |

### Routes to Remove
- `/plinko-motoko` - dead experimental route
- `/mines` - placeholder pointing to PlinkoMotoko

---

## 2. Implementation Steps

### Step 2.1: Backend - Remove Multi-Ball (`plinko_backend/src/lib.rs`)

```rust
// REMOVE: Lines 34-39 (MultiBallResult struct)
// DELETE THIS ENTIRE BLOCK:
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct MultiBallResult {
    pub balls: Vec<PlinkoResult>,
    pub total_multiplier: f64,
    pub average_multiplier: f64,
    pub ball_count: u8,
}

// REMOVE: Lines 96-158 (drop_balls function)
// DELETE THIS ENTIRE FUNCTION:
#[update]
async fn drop_balls(num_balls: u8) -> Result<MultiBallResult, String> {
    // ... entire function body ...
}
```

**KEEP everything else** - the `drop_ball()` function, multiplier calculation, tests, etc.

### Step 2.2: Backend - Update Candid Interface (`plinko_backend/plinko_backend.did`)

```candid
// BEFORE (current):
type PlinkoResult = record {
  path: vec bool;
  final_position: nat8;
  multiplier: float64;
  win: bool;
};

type MultiBallResult = record {     // <-- REMOVE
  balls: vec PlinkoResult;
  total_multiplier: float64;
  average_multiplier: float64;
  ball_count: nat8;
};

service : {
  drop_ball: () -> (variant { Ok: PlinkoResult; Err: text });
  drop_balls: (nat8) -> (variant { Ok: MultiBallResult; Err: text });  // <-- REMOVE
  get_multipliers: () -> (vec float64) query;
  get_formula: () -> (text) query;
  get_expected_value: () -> (float64) query;
  greet: (text) -> (text) query;
}

// AFTER (simplified):
type PlinkoResult = record {
  path: vec bool;
  final_position: nat8;
  multiplier: float64;
  win: bool;
};

service : {
  drop_ball: () -> (variant { Ok: PlinkoResult; Err: text });
  get_multipliers: () -> (vec float64) query;
  get_formula: () -> (text) query;
  get_expected_value: () -> (float64) query;
  greet: (text) -> (text) query;
}
```

### Step 2.3: Frontend - Delete Dead Files

```bash
# DELETE these files entirely:
rm openhouse_frontend/src/pages/PlinkoMotoko.tsx
rm openhouse_frontend/src/pages/Mines.tsx
```

### Step 2.4: Frontend - Update App.tsx

```typescript
// BEFORE:
import { PlinkoMotoko } from './pages/PlinkoMotoko';  // <-- REMOVE
import { Mines } from './pages/Mines';                // <-- REMOVE

<Route path="/plinko-motoko" element={<PlinkoMotoko />} />  // <-- REMOVE
<Route path="/mines" element={<Mines />} />                  // <-- REMOVE

// AFTER: Just remove those 4 lines
```

### Step 2.5: Frontend - Simplify PlinkoBoard.tsx

**Remove multi-ball state and animation logic:**

```typescript
// REMOVE these state variables:
const [balls, setBalls] = useState<BallState[]>([]);
const [completedCount, setCompletedCount] = useState(0);

// REMOVE the BallState interface

// REMOVE the multi-ball animation useEffect (lines 49-128)

// REMOVE the multi-ball rendering section (lines 229-255)

// REMOVE the multiResult prop from interface
interface PlinkoBoardProps {
  rows: number;
  path: boolean[] | null;
  isDropping: boolean;
  onAnimationComplete?: () => void;
  finalPosition?: number;
  // multiResult?: any;  <-- REMOVE
}

// KEEP: Single ball animation logic, peg rendering, single ball rendering
```

### Step 2.6: Frontend - Simplify Plinko.tsx (Main Page)

**REMOVE these state variables:**
```typescript
// REMOVE:
const [history, setHistory] = useState<PlinkoGameResult[]>([]);
const [ballCount, setBallCount] = useState(1);
const [currentMultiResult, setCurrentMultiResult] = useState<any>(null);
```

**SIMPLIFY dropBall function:**
```typescript
// PSEUDOCODE - Simplified version
const dropBall = async () => {
  if (!actor) return;

  setIsPlaying(true);
  setGameError('');
  setCurrentResult(null);

  try {
    // Use single ball method (not drop_balls)
    const result = await actor.drop_ball();

    if ('Ok' in result) {
      const gameResult: PlinkoGameResult = {
        ...result.Ok,
        timestamp: Date.now(),
      };
      setCurrentResult(gameResult);
    } else {
      setGameError(result.Err);
      setIsPlaying(false);
    }
  } catch (err) {
    console.error('Failed to drop ball:', err);
    setGameError(err instanceof Error ? err.message : 'Failed to drop ball');
    setIsPlaying(false);
  }
};
```

**REMOVE from JSX:**
- Ball Count Selector section (lines 163-189)
- Session Stats display (lines 208-212)
- Multi-Ball Result Display section (lines 271-329)
- Game History section (lines 332-365)

**KEEP:**
- Formula display
- Single DROP BALL button
- PlinkoBoard component (single ball)
- PlinkoMultipliers component
- Single result display (WIN/LOSS with multiplier)

### Step 2.7: Regenerate Frontend Declarations

After backend deployment:
```bash
# Copy updated declarations to frontend
cp -r src/declarations/plinko_backend openhouse_frontend/src/declarations/
```

---

## 3. Expected Line Count Changes

| File | Before | After | Change |
|------|--------|-------|--------|
| `plinko_backend/src/lib.rs` | 466 | ~400 | -66 |
| `plinko_backend/plinko_backend.did` | 33 | ~20 | -13 |
| `PlinkoMotoko.tsx` | 397 | 0 | -397 (DELETED) |
| `Mines.tsx` | 1 | 0 | -1 (DELETED) |
| `Plinko.tsx` | 368 | ~180 | -188 |
| `PlinkoBoard.tsx` | 276 | ~150 | -126 |
| `App.tsx` | 42 | 38 | -4 |
| **TOTAL** | | | **~-795 lines** |

---

## 4. Verification Checklist

After implementation:
- [ ] `cargo build --target wasm32-unknown-unknown` succeeds
- [ ] `npm run build` succeeds in openhouse_frontend
- [ ] No TypeScript errors
- [ ] `/plinko` route works
- [ ] `/plinko-motoko` route returns 404 (removed)
- [ ] `/mines` route returns 404 (removed)
- [ ] Drop ball animation works
- [ ] Multiplier display shows all 9 positions
- [ ] Formula displays correctly
- [ ] WIN/LOSS result displays after animation

---

## 5. Files Summary

### DELETE (2 files):
1. `openhouse_frontend/src/pages/PlinkoMotoko.tsx`
2. `openhouse_frontend/src/pages/Mines.tsx`

### MODIFY (5 files):
1. `plinko_backend/src/lib.rs` - Remove MultiBallResult, drop_balls()
2. `plinko_backend/plinko_backend.did` - Remove multi-ball types
3. `openhouse_frontend/src/App.tsx` - Remove dead routes
4. `openhouse_frontend/src/pages/Plinko.tsx` - Remove history, multi-ball, simplify
5. `openhouse_frontend/src/components/game-specific/plinko/PlinkoBoard.tsx` - Single ball only

### KEEP UNCHANGED:
- `openhouse_frontend/src/components/game-specific/plinko/PlinkoMultipliers.tsx`
- `openhouse_frontend/src/components/game-specific/plinko/PlinkoBoard.css`
- `openhouse_frontend/src/hooks/actors/usePlinkoActor.ts`
- All dice_backend files (DO NOT TOUCH)
- All crash_backend files
- All mines_backend files

---

## 6. Deployment Notes

**Affected Canisters:**
- Plinko Backend: `weupr-2qaaa-aaaap-abl3q-cai`
- Frontend: `pezw3-laaaa-aaaal-qssoa-cai`

**NOT Affected:**
- Dice Backend: `whchi-hyaaa-aaaao-a4ruq-cai` (DO NOT TOUCH)
- Crash Backend: `fws6k-tyaaa-aaaap-qqc7q-cai`
- Mines Backend: `wvrcw-3aaaa-aaaah-arm4a-cai`

**Deployment Command:**
```bash
# Deploy plinko backend and frontend only
./deploy.sh --plinko-only && ./deploy.sh --frontend-only
```

Or simply:
```bash
./deploy.sh
```
