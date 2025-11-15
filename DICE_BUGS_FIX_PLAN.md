# 🤖 AUTONOMOUS PR ORCHESTRATOR - DO NOT SKIP

**You are an autonomous PR orchestrator. Your ONLY job is to implement this plan and create a PR.**

## Isolation Check (RUN FIRST)
```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
if [ "$REPO_ROOT" = "/home/theseus/alexandria/openhouse" ]; then
    echo "❌ FATAL: In main repo. Must be in worktree."
    echo "Worktree: /home/theseus/alexandria/openhouse-dice-fixes"
    exit 1
fi
echo "✅ In isolated worktree: $REPO_ROOT"
```

## Your Autonomous Workflow (NO QUESTIONS ALLOWED)
1. **Verify isolation** - You must be in worktree: `/home/theseus/alexandria/openhouse-dice-fixes`
2. **Implement feature** - Follow plan sections below
3. **Build & Deploy to Mainnet**:
   - Backend changes:
     ```bash
     # Build affected backend(s)
     cargo build --target wasm32-unknown-unknown --release

     # Deploy to mainnet (deploys all canisters - simplest approach)
     ./deploy.sh
     ```
   - Frontend changes:
     ```bash
     cd openhouse_frontend
     npm run build
     cd ..
     ./deploy.sh
     ```
   - Both backend + frontend:
     ```bash
     cargo build --target wasm32-unknown-unknown --release
     cd openhouse_frontend && npm run build && cd ..
     ./deploy.sh
     ```

4. **Verify deployment**:
   ```bash
   # Check canister status
   dfx canister --network ic status dice_backend

   # Test the live site
   echo "Visit: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io"
   ```

5. **Create PR** (MANDATORY):
   ```bash
   git add .
   git commit -m "fix: resolve dice game balance and deserialization issues"
   git push -u origin feature/dice-bug-fixes
   gh pr create --title "Fix: Dice Game Critical Bugs" --body "Implements DICE_BUGS_FIX_PLAN.md

Deployed to mainnet:
- Frontend: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io
- Affected canisters: dice_backend (whchi-hyaaa-aaaao-a4ruq-cai)"
   ```

6. **Iterate autonomously**:
   - FOR i=1 to 5:
     - Check review: `gh pr view [NUM] --json comments`
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

**Branch:** `feature/dice-bug-fixes`
**Worktree:** `/home/theseus/alexandria/openhouse-dice-fixes`

---

# Implementation Plan

## Task Classification: BUG FIX
Restore broken behavior with minimal changes - targeting 3 critical issues

## Current State Documentation

### Issue 1: House Balance Shows 0.00 on Page Load
**Location:** `dice_backend/src/accounting.rs:336` and frontend balance fetching
**Problem:** The cached house balance starts at 0 and is only refreshed every 30 seconds via heartbeat
**Impact:** Users can't play immediately after page load, get "Bet too large" error

### Issue 2: Deserialization Panic - Missing game_id Field
**Location:** `dice_backend/src/lib.rs:149:40`
**Error:** `Panicked at 'called Result::unwrap() on an Err value: Error("missing field game_id"...)`
**Problem:** The `DiceResult` struct (lines 136-153) doesn't have a `game_id` field but old data in storage expects it
**Impact:** `get_recent_games()` crashes, game history not available

### Issue 3: Practice Mode Confusion
**Location:** `openhouse_frontend/src/hooks/games/useGameMode.ts:10`
**Current Logic:** `isPracticeMode = mode === 'practice' || !isAuthenticated`
**Problem:** Mode toggle UI exists but is effectively redundant - logged out = practice, logged in = real
**User Confusion:** Toggle gives false impression that logged-in users can choose practice mode

## Implementation Pseudocode

### Backend: `dice_backend/src/lib.rs` (MODIFY)
```rust
// PSEUDOCODE - Add game_id field to DiceResult struct (line ~137)
#[derive(CandidType, Deserialize, Clone)]
pub struct DiceResult {
    pub game_id: u64,  // ADD THIS LINE - fixes deserialization
    pub player: Principal,
    pub bet_amount: u64,
    // ... rest of existing fields unchanged
}

// PSEUDOCODE - Update play_dice function to set game_id (line ~520)
let result = DiceResult {
    game_id: game_id,  // ADD THIS LINE - populate the field
    player: caller,
    bet_amount,
    // ... rest of existing field assignments unchanged
};
```

### Backend: `dice_backend/src/lib.rs` (MODIFY)
```rust
// PSEUDOCODE - Add immediate balance refresh on init (line ~192)
#[init]
fn init() {
    ic_cdk::println!("Dice Game Backend Initialized");

    // ADD: Spawn immediate balance refresh
    ic_cdk::spawn(async {
        accounting::refresh_canister_balance().await;
    });
}

// PSEUDOCODE - Add post_upgrade balance refresh (line ~980)
#[post_upgrade]
fn post_upgrade() {
    // ... existing migration code ...

    // ADD at end: Spawn immediate balance refresh
    ic_cdk::spawn(async {
        accounting::refresh_canister_balance().await;
    });
}
```

### Frontend: `openhouse_frontend/src/hooks/games/useGameMode.ts` (MODIFY)
```typescript
// PSEUDOCODE - Remove redundant mode state, simplify logic
export const useGameMode = () => {
  const { isAuthenticated } = useAuth();

  // REMOVE mode state and toggle
  // const [mode, setMode] = useState<GameMode>('practice');

  // Always derive mode from auth state
  const mode: GameMode = isAuthenticated ? 'real' : 'practice';
  const isPracticeMode = !isAuthenticated;

  // Remove mode change handler
  // const handleModeChange = useCallback(...);

  return {
    mode,
    isPracticeMode,
    isAuthenticated,
    // Remove onModeChange and error
  };
};
```

### Frontend: `openhouse_frontend/src/components/game-ui/GameModeToggle.tsx` (DELETE)
```typescript
// PSEUDOCODE
// DELETE entire file - no longer needed
// Users will see practice mode when logged out, real mode when logged in
```

### Frontend: `openhouse_frontend/src/pages/Dice.tsx` (MODIFY)
```typescript
// PSEUDOCODE - Remove GameModeToggle component (line ~297)
// REMOVE: <GameModeToggle ... />
// Keep BetAmountInput but update isPracticeMode prop
```

### Frontend: `openhouse_frontend/src/providers/GameBalanceProvider.tsx` (MODIFY)
```typescript
// PSEUDOCODE - Add retry mechanism for initial balance fetch
const fetchBalances = useCallback(async (game: GameType): Promise<BalanceFetchResult> => {
  // ADD retry logic for zero balance
  let retries = 0;
  const maxRetries = 3;

  while (retries < maxRetries) {
    try {
      // ... existing balance fetch code ...

      // If house balance is 0, retry after delay
      if (houseBalance === BigInt(0) && retries < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        retries++;
        continue;
      }

      return { game, user, house, wallet };
    } catch (error) {
      // ... existing error handling ...
    }
  }
});
```

## Testing Requirements

**NONE REQUIRED** - This is experimental pre-production. Manual verification only.

Optional manual checks:
```bash
# Build backend
cargo build --target wasm32-unknown-unknown --release

# Build frontend
cd openhouse_frontend && npm run build

# Test canister calls
dfx canister --network ic call whchi-hyaaa-aaaao-a4ruq-cai get_recent_games '(10)'
dfx canister --network ic call whchi-hyaaa-aaaao-a4ruq-cai get_house_balance
```

## Deployment Notes
- **Affected Canisters:** dice_backend only (whchi-hyaaa-aaaao-a4ruq-cai)
- **Frontend Changes:** Yes - removal of mode toggle, balance retry logic
- **Migration:** DiceResult struct change is backward-compatible (adding field)
- **Rollback:** Can revert if issues, old games missing game_id will show as 0

## Expected Outcomes
1. **House balance:** Shows correct value immediately or within 3 seconds
2. **Game history:** Loads without deserialization errors
3. **Practice mode:** Clear UX - logged out = practice, logged in = real money
4. **User experience:** No confusing toggle, no misleading 0.00 balance errors