# 🤖 AUTONOMOUS PR ORCHESTRATOR - DO NOT SKIP

**You are an autonomous PR orchestrator. Your ONLY job is to implement this plan and create a PR.**

## Isolation Check (RUN FIRST)
```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
if [ "$REPO_ROOT" = "/home/theseus/alexandria/openhouse" ]; then
    echo "❌ FATAL: In main repo. Must be in worktree."
    echo "Worktree: /home/theseus/alexandria/openhouse-crash-precommit"
    exit 1
fi
echo "✅ In isolated worktree: $REPO_ROOT"
```

## Your Autonomous Workflow (NO QUESTIONS ALLOWED)
1. **Verify isolation** - You must be in worktree: `/home/theseus/alexandria/openhouse-crash-precommit`
2. **Implement feature** - Follow plan sections below
3. **Build & Deploy to Mainnet**:
   ```bash
   # Build backend
   cargo build --target wasm32-unknown-unknown --release

   # Build frontend
   cd openhouse_frontend
   npm run build
   cd ..

   # Deploy to mainnet
   ./deploy.sh
   ```

4. **Verify deployment**:
   ```bash
   # Test backend
   dfx canister --network ic call fws6k-tyaaa-aaaap-qqc7q-cai play_crash '(2.5 : float64)'

   # Test frontend
   echo "Visit: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io/crash"
   ```

5. **Create PR** (MANDATORY):
   ```bash
   git add .
   git commit -m "$(cat <<'EOF'
fix: implement secure pre-commitment for crash game

Fixes critical security vulnerability where crash point was revealed
before user decision, allowing exploitation.

Security Changes:
- Backend now requires pre-commitment: user sets target before launch
- New play_crash(target) method replaces simulate_crash()
- Crash point safely revealed after user commits to target
- Animation shows accurate crash with milestone when passing target

Implementation:
- Backend: New play_crash() with target validation
- Frontend: User sets target before clicking "Launch Rocket"
- Animation: Visual celebration when rocket passes target
- UX: Clear indication of win/loss after rocket crashes

Deployed to mainnet:
- Backend: fws6k-tyaaa-aaaap-qqc7q-cai
- Frontend: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io/crash

Closes security issue from PR #49 discussion.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
   git push -u origin feature/crash-secure-precommit

   gh pr create --title "fix: Secure Pre-Commitment for Crash Game" --body "$(cat <<'EOF'
Implements CRASH_SECURE_PRECOMMIT_PLAN.md

## Security Issue
PR #49 introduced a critical exploit: frontend called `simulate_crash()` at game start, revealing crash point before user decision. This allowed users to inspect DevTools and only play favorable outcomes.

## Solution: Pre-Commitment
User must commit to target multiplier BEFORE the rocket launches:
1. User sets target (e.g., 2.5x) via slider
2. User clicks "Launch Rocket"
3. Backend generates crash point, safely returns it (user already committed!)
4. Frontend animates rocket to crash point
5. Visual milestone shows when rocket passes target
6. Rocket continues to crash point with explosion

## Technical Changes

### Backend (`crash_backend/src/lib.rs`)
- **NEW**: `play_crash(target: f64) -> PlayCrashResult`
  - Validates target (1.01 - 100.0)
  - Generates crash point using IC VRF
  - Returns { crash_point, won, payout, hash }
- **DEPRECATED**: `simulate_crash()` (kept for backwards compatibility)
- Updated `.did` file with new interface

### Frontend (`openhouse_frontend/src/pages/Crash.tsx`)
- Target selection BEFORE launch (not during flight)
- Calls `play_crash(targetCashout)` instead of `simulate_crash()`
- Animation includes "CASH OUT!" milestone when passing target
- Clear win/loss indication after crash
- Removed exploitable mid-flight cash-out button

### Animation Behavior
**User wins (target 2.5x, crash 4.2x):**
```
1.0x → 1.5x → 2.0x → 2.5x ✅ CASH OUT!
       → 3.0x → 3.5x → 4.2x 💥 CRASHED!
Result: "You won! Cashed out at 2.5x"
```

**User loses (target 2.5x, crash 2.1x):**
```
1.0x → 1.5x → 2.0x → 2.1x 💥 CRASHED!
Result: "You lost! Rocket crashed at 2.1x"
```

## Security Analysis
✅ **User commits to target before crash generation**
✅ **Backend can safely reveal crash point**
✅ **No way to inspect and exploit**
✅ **Still provably fair (hash commitment)**
✅ **Animation remains visually exciting**

## Testing on Mainnet
```bash
# Test new backend method
dfx canister --network ic call fws6k-tyaaa-aaaap-qqc7q-cai play_crash '(2.5 : float64)'

# Expected response:
(
  variant {
    Ok = record {
      crash_point = 3.21 : float64;
      won = true : bool;
      target_multiplier = 2.5 : float64;
      payout = 250 : nat64;
      randomness_hash = "abc123...";
    }
  }
)
```

Frontend: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io/crash

## Design Philosophy
Hybrid approach combining:
- **Dice game**: Pre-commitment security model
- **Crash game**: Exciting rocket animation and visual tension

User still experiences anticipation watching rocket approach target, but commits before any information is revealed.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
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

**Branch:** `feature/crash-secure-precommit`
**Worktree:** `/home/theseus/alexandria/openhouse-crash-precommit`

---

# Implementation Plan: Secure Pre-Commitment Crash Game

## 1. Security Issue Summary

**Vulnerability in PR #49:**
Frontend calls `simulate_crash()` at game start, receiving crash point before user makes decision. User can inspect DevTools/network requests to see crash point and only play favorable outcomes.

**Root Cause:**
The game tried to combine:
- Real-time interactive gameplay (user decides during animation)
- Pre-computed crash point (for provable fairness)
- No WebSockets on IC (can't stream updates)

These constraints are fundamentally incompatible without polling or exploitation risk.

## 2. Current State

### Backend Status
**File:** `crash_backend/src/lib.rs` (521 lines)

**Current API:**
```rust
simulate_crash() -> Result<CrashResult, String>
  Returns: { crash_point, randomness_hash }
```

**Problem:** Returns crash point immediately, before user commits to decision.

**Other methods (keep unchanged):**
- `get_crash_formula()` - Returns formula string
- `get_expected_value()` - Returns 0.99
- `get_win_probability(target)` - Calculate win probability
- `get_probability_table()` - Common probability examples
- `greet(name)` - Test function

### Frontend Status
**File:** `openhouse_frontend/src/pages/Crash.tsx` (283 lines)

**Current Flow (EXPLOITABLE):**
1. User clicks "Launch Rocket"
2. Frontend calls `simulate_crash()`
3. Backend returns crash point (e.g., 2.45x)
4. Frontend stores in state: `setCrashPoint(2.45)`
5. User can inspect DevTools and see crash point before cashing out
6. **EXPLOIT:** User only cashes out if crash point is favorable

**Components Affected:**
- `startGame()` function - Currently calls `simulate_crash()`
- `handleCashout()` function - Should be removed (no mid-flight decisions)
- Target slider - Currently adjustable during flight (should be locked)
- Animation - Currently tries to hide crash point (impossible)

### Supporting Components (NO CHANGES)
- `CrashRocket.tsx` - Rocket animation component (works as-is)
- `CrashGraph.tsx` - Multiplier graph (works as-is)
- `CrashProbabilityTable.tsx` - Odds display (works as-is)

## 3. Solution Architecture

### Pre-Commitment Model

**Key Insight:** User must commit to target BEFORE crash point is generated.

**Secure Flow:**
1. User sets target multiplier (e.g., 2.5x)
2. User clicks "Launch Rocket"
3. Backend generates crash point using IC VRF
4. Backend checks: `crash_point >= target ? WIN : LOSS`
5. Backend safely returns crash point (user already committed!)
6. Frontend animates rocket from 1.0x to crash point
7. Visual milestone at target (if won)
8. Rocket continues to crash point

**Why This Is Secure:**
- User decision made BEFORE crash point exists
- Backend can reveal crash point without exploitation risk
- Still provably fair (hash commitment)
- Still visually exciting (watch rocket approach target)

## 4. Implementation Details

### 4.1 Backend Changes

#### File: `crash_backend/src/lib.rs`

##### New Struct (add after line 32)
```rust
// PSEUDOCODE
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct PlayCrashResult {
    pub crash_point: f64,              // Where it crashed
    pub won: bool,                     // Did user win?
    pub target_multiplier: f64,        // User's target
    pub payout: u64,                   // Payout in e8s (0 if lost)
    pub randomness_hash: String,       // IC randomness hash
}
```

##### New Method (add after line 75)
```rust
// PSEUDOCODE
/// Play crash game with pre-committed target
/// User must set target before game starts (no mid-flight decisions)
/// Returns outcome after rocket crashes
#[update]
async fn play_crash(target_multiplier: f64) -> Result<PlayCrashResult, String> {
    // Validate target is in valid range
    if target_multiplier < 1.01 {
        return Err("Target must be at least 1.01x".to_string());
    }
    if target_multiplier > MAX_CRASH {
        return Err(format!("Target cannot exceed {}x", MAX_CRASH));
    }
    if !target_multiplier.is_finite() {
        return Err("Target must be a finite number".to_string());
    }

    // Get randomness from IC VRF
    let random_bytes = raw_rand().await
        .map_err(|e| format!("Randomness unavailable: {:?}", e))?
        .0;

    // Convert to float and calculate crash point
    let random = bytes_to_float(&random_bytes)?;
    let crash_point = calculate_crash_point(random);

    // Determine outcome
    let won = crash_point >= target_multiplier;

    // Calculate payout (for now, simple 1 ICP bet)
    // In future: integrate with actual betting system
    let payout = if won {
        (target_multiplier * 100_000_000.0) as u64  // Convert to e8s
    } else {
        0
    };

    // Create hash for provable fairness
    let randomness_hash = create_randomness_hash(&random_bytes);

    Ok(PlayCrashResult {
        crash_point,
        won,
        target_multiplier,
        payout,
        randomness_hash,
    })
}
```

##### Keep Old Method (for backwards compatibility)
```rust
// Line 54: Keep simulate_crash() as-is
// Mark as deprecated in comments but don't remove yet
// Frontend will migrate to play_crash()
```

#### File: `crash_backend/crash_backend.did`

##### Update Interface (replace entire file)
```candid
// PSEUDOCODE
type CrashResult = record {
  crash_point: float64;
  randomness_hash: text;
};

type PlayCrashResult = record {
  crash_point: float64;
  won: bool;
  target_multiplier: float64;
  payout: nat64;
  randomness_hash: text;
};

service : {
  // NEW: Secure pre-commitment method
  play_crash: (float64) -> (variant { Ok: PlayCrashResult; Err: text });

  // DEPRECATED: Old method (kept for compatibility)
  simulate_crash: () -> (variant { Ok: CrashResult; Err: text });

  // Query methods (unchanged)
  get_crash_formula: () -> (text) query;
  get_expected_value: () -> (float64) query;
  get_win_probability: (float64) -> (variant { Ok: float64; Err: text }) query;
  get_probability_table: () -> (vec record { float64; float64 }) query;
  greet: (text) -> (text) query;
}
```

### 4.2 Frontend Changes

#### File: `openhouse_frontend/src/pages/Crash.tsx`

##### Update Interfaces (lines 17-22)
```typescript
// PSEUDOCODE
interface PlayCrashResult {
  crash_point: number;
  won: boolean;
  target_multiplier: number;
  payout: bigint;
  randomness_hash: string;
}

interface CrashGameResult extends PlayCrashResult {
  timestamp: number;
  clientId: string;
}
```

##### Update State (lines 28-36)
```typescript
// PSEUDOCODE
// Remove: autoCashout state (no longer needed)
// Keep:
const [isPlaying, setIsPlaying] = useState(false);
const [currentMultiplier, setCurrentMultiplier] = useState(1.0);
const [crashPoint, setCrashPoint] = useState<number | null>(null);
const [targetCashout, setTargetCashout] = useState(2.5);  // Default 2.5x
const [gameError, setGameError] = useState('');
const [history, setHistory] = useState<CrashGameResult[]>([]);
const [graphHistory, setGraphHistory] = useState<Array<{ multiplier: number; timestamp: number }>>([]);

// NEW:
const [gameResult, setGameResult] = useState<PlayCrashResult | null>(null);
const [passedTarget, setPassedTarget] = useState(false);
```

##### Rewrite startGame() (lines 38-78)
```typescript
// PSEUDOCODE
const startGame = async () => {
  if (!actor) return;
  if (!isAuthenticated) {
    setGameError('Please log in to play');
    return;
  }

  // Reset state
  setIsPlaying(true);
  setGameError('');
  setCrashPoint(null);
  setCurrentMultiplier(1.0);
  setGraphHistory([]);
  setPassedTarget(false);
  setGameResult(null);

  try {
    // Call new secure method with pre-committed target
    const result = await actor.play_crash(targetCashout);

    if ('Ok' in result) {
      const gameData = result.Ok;
      setCrashPoint(gameData.crash_point);
      setGameResult(gameData);

      // Animate to conclusion
      animateToConclusion(gameData.crash_point, gameData.target_multiplier, gameData.won);

      // Add to history
      const historyItem: CrashGameResult = {
        ...gameData,
        timestamp: Date.now(),
        clientId: crypto.randomUUID()
      };
      setHistory(prev => [historyItem, ...prev.slice(0, 19)]);
    } else {
      setGameError(result.Err);
      setIsPlaying(false);
    }
  } catch (err) {
    setGameError(err instanceof Error ? err.message : 'Failed to start game');
    setIsPlaying(false);
  }
};
```

##### Rewrite Animation (replace animateMultiplier)
```typescript
// PSEUDOCODE
const animateToConclusion = (crashPoint: number, target: number, won: boolean) => {
  const startTime = Date.now();
  const duration = Math.min(crashPoint * 1000, 10000); // Max 10s

  const animate = () => {
    const elapsed = Date.now() - startTime;

    // Exponential curve
    const k = Math.log(crashPoint) / duration;
    const mult = Math.exp(k * elapsed);

    setCurrentMultiplier(mult);
    setGraphHistory(prev => [...prev, { multiplier: mult, timestamp: elapsed }]);

    // Check if we passed the target (show milestone)
    if (won && mult >= target && !passedTarget) {
      setPassedTarget(true);
      // Visual effect will be shown in JSX
    }

    // Continue until crash
    if (mult < crashPoint) {
      requestAnimationFrame(animate);
    } else {
      setCurrentMultiplier(crashPoint);
      setTimeout(() => {
        setIsPlaying(false);
      }, 2000); // Pause to show result
    }
  };

  requestAnimationFrame(animate);
};
```

##### Remove handleCashout() (lines 116-125)
```typescript
// REMOVE ENTIRELY
// No mid-flight decisions allowed in pre-commitment model
```

##### Update JSX - Controls Section (lines 196-256)
```typescript
// PSEUDOCODE
<div className="card max-w-2xl mx-auto">
  <div className="mb-6">
    <label className="block text-sm font-bold mb-3 text-center text-dfinity-turquoise">
      Set Your Target (before launch):
    </label>
    <input
      type="range"
      min="1.01"
      max="100"
      step="0.01"
      value={targetCashout}
      onChange={(e) => setTargetCashout(parseFloat(e.target.value))}
      disabled={isPlaying}  // LOCKED during flight
      className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider-turquoise"
    />
    <div className="text-center mt-2 text-2xl font-bold">
      {targetCashout.toFixed(2)}x
    </div>
  </div>

  {/* Remove auto-cashout checkbox */}

  <GameStats stats={stats} collapsible={false} />

  {/* Single button - no mid-flight cashout */}
  <GameButton
    onClick={startGame}
    disabled={!actor || !isAuthenticated || isPlaying}
    loading={isPlaying}
    label={isPlaying ? "ROCKET FLYING..." : "LAUNCH ROCKET"}
    loadingLabel="FLYING..."
    icon="🚀"
  />

  {/* Show result after crash */}
  {gameResult && !isPlaying && (
    <div className={`mt-4 p-4 rounded ${gameResult.won ? 'bg-green-900/20 border border-green-500' : 'bg-red-900/20 border border-red-500'}`}>
      <div className="text-center">
        {gameResult.won ? (
          <>
            <div className="text-2xl mb-2">🎉 YOU WON!</div>
            <div>Cashed out at {gameResult.target_multiplier.toFixed(2)}x</div>
            <div className="text-sm text-gray-400">
              (Rocket crashed at {gameResult.crash_point.toFixed(2)}x)
            </div>
          </>
        ) : (
          <>
            <div className="text-2xl mb-2">💥 CRASHED!</div>
            <div>Rocket crashed at {gameResult.crash_point.toFixed(2)}x</div>
            <div className="text-sm text-gray-400">
              (Your target was {gameResult.target_multiplier.toFixed(2)}x)
            </div>
          </>
        )}
      </div>
    </div>
  )}

  {gameError && (
    <div className="mt-4 text-red-400 text-sm text-center">
      {gameError}
    </div>
  )}
</div>
```

##### Update JSX - Rocket Display (add milestone effect)
```typescript
// PSEUDOCODE
{/* In the rocket/graph section */}
{passedTarget && isPlaying && (
  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
    <div className="bg-green-500/20 border-2 border-green-400 rounded-lg p-6 animate-pulse">
      <div className="text-3xl font-bold text-green-400">
        ✅ TARGET REACHED!
      </div>
      <div className="text-xl text-green-300 mt-2">
        Cashed out at {targetCashout.toFixed(2)}x
      </div>
    </div>
  </div>
)}
```

## 5. Testing Requirements

**NONE REQUIRED** - This is experimental pre-production. Manual verification only.

### Optional Manual Checks (Post-Deployment)

```bash
# Backend validation
dfx canister --network ic call fws6k-tyaaa-aaaap-qqc7q-cai play_crash '(2.5 : float64)'
dfx canister --network ic call fws6k-tyaaa-aaaap-qqc7q-cai play_crash '(50.0 : float64)'

# Frontend build check
cd openhouse_frontend
npm run build
```

### Manual Testing Checklist (On Mainnet)

1. Visit https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io/crash
2. Set target to 2.0x
3. Click "Launch Rocket"
4. Verify rocket animates to crash point
5. If win: Check green "TARGET REACHED!" appears at 2.0x
6. Verify final result shows win/loss correctly
7. Check DevTools: crash point should ONLY appear after launch
8. Try multiple games with different targets
9. Verify history updates correctly

## 6. Deployment Strategy

### Affected Canisters
- ✅ **crash_backend** - New `play_crash()` method
- ✅ **openhouse_frontend** - Pre-commitment UI flow

### Deployment Commands
```bash
# From worktree root
cargo build --target wasm32-unknown-unknown --release

cd openhouse_frontend
npm install  # If needed
npm run build
cd ..

./deploy.sh

# Verify
dfx canister --network ic status crash_backend
dfx canister --network ic status openhouse_frontend
```

### Post-Deployment Verification
```bash
# Test new method
dfx canister --network ic call fws6k-tyaaa-aaaap-qqc7q-cai play_crash '(2.5 : float64)'

# Expected response structure:
# (variant { Ok = record { crash_point = X.XX; won = true/false; ... } })

# Frontend check
echo "Visit: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io/crash"
```

## 7. Security Analysis

### Before (EXPLOITABLE)
```
User → Click "Launch" → Backend returns crash_point immediately
     → User inspects DevTools → Sees crash_point before decision
     → User exploits: only cash out if favorable
```

### After (SECURE)
```
User → Set target (e.g., 2.5x) → Click "Launch"
     → Backend generates crash_point AFTER target committed
     → Backend returns result (safe, user already committed)
     → Frontend animates with accurate crash
```

### Verification
- ✅ User cannot see crash point before committing
- ✅ Backend validates target is reasonable (1.01-100x)
- ✅ Provably fair via hash commitment
- ✅ Still 1% house edge (formula unchanged)
- ✅ Animation remains engaging

## 8. File Tree Changes

### Before
```
crash_backend/src/lib.rs (521 lines)
  - simulate_crash() -> Returns crash point immediately

openhouse_frontend/src/pages/Crash.tsx (283 lines)
  - Calls simulate_crash()
  - Allows mid-flight cashout
  - Auto-cashout feature
```

### After
```
crash_backend/src/lib.rs (~600 lines)
  - play_crash(target) -> NEW secure method
  - simulate_crash() -> KEPT for compatibility
  - PlayCrashResult struct -> NEW

crash_backend/crash_backend.did
  - Added PlayCrashResult type
  - Added play_crash method
  - Marked simulate_crash as deprecated

openhouse_frontend/src/pages/Crash.tsx (~320 lines)
  - Uses play_crash(target)
  - Pre-commitment flow
  - Milestone animation
  - Result display after crash
  - REMOVED: handleCashout(), autoCashout
```

## 9. User Experience Comparison

### Before (Exploitable)
1. User clicks "Launch"
2. Rocket starts rising
3. User can click "Cash Out" anytime
4. **Problem:** DevTools shows crash point

### After (Secure)
1. User sets target (e.g., 2.5x)
2. User clicks "Launch Rocket"
3. Rocket animates from 1.0x upward
4. At 2.5x: "✅ TARGET REACHED!" appears (if won)
5. Rocket continues to crash point
6. Result displayed: "You won! Cashed out at 2.5x"

**Key Difference:** Decision made BEFORE animation, not during.

## 10. Success Criteria

### Implementation Complete When:
- ✅ Backend has `play_crash(target)` method
- ✅ Backend validates target range (1.01-100x)
- ✅ Frontend uses pre-commitment flow
- ✅ Target slider locked during flight
- ✅ Milestone animation shows when passing target
- ✅ Result displayed clearly after crash
- ✅ No mid-flight cashout button
- ✅ DevTools inspection shows crash point AFTER launch only
- ✅ Deployed to mainnet successfully
- ✅ Manual testing passes on production

### PR Ready When:
- ✅ All files committed to feature branch
- ✅ Deployed to mainnet
- ✅ Manual testing on https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io/crash
- ✅ PR created with security explanation
- ✅ No TypeScript errors
- ✅ No Rust compiler warnings

## 11. Future Enhancements (Out of Scope)

- [ ] Integrate with actual ICP betting system
- [ ] Add betting amounts (currently hardcoded 1 ICP)
- [ ] Sound effects for milestone and crash
- [ ] Statistics tracking (win rate, total games, etc.)
- [ ] Multiplayer view (see other players' targets)
- [ ] Configurable animation speed
- [ ] Mobile optimization

## 12. Notes

- This fixes a **critical P0 security issue** from PR #49
- Pre-commitment model is industry standard for provably fair games
- Animation remains visually engaging despite pre-commitment
- House edge formula unchanged (still 1% as proven in tests)
- Backwards compatible: old `simulate_crash()` kept for now
- Future migrations can deprecate old method entirely
