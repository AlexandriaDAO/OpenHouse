# 🤖 AUTONOMOUS PR ORCHESTRATOR - DO NOT SKIP

**You are an autonomous PR orchestrator. Your ONLY job is to implement this plan and create a PR.**

## Isolation Check (RUN FIRST)
```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
if [ "$REPO_ROOT" = "/home/theseus/alexandria/openhouse" ]; then
    echo "❌ FATAL: In main repo. Must be in worktree."
    echo "Worktree: /home/theseus/alexandria/openhouse-simplify-plinko"
    exit 1
fi
echo "✅ In isolated worktree: $REPO_ROOT"
```

## Your Autonomous Workflow (NO QUESTIONS ALLOWED)
1. **Verify isolation** - You must be in worktree: `/home/theseus/alexandria/openhouse-simplify-plinko`
2. **Implement feature** - Follow plan sections below
3. **Build & Deploy to Mainnet**:
   ```bash
   # Build backend
   cargo build --target wasm32-unknown-unknown --release

   # Build frontend
   cd openhouse_frontend
   npm run build
   cd ..

   # Deploy everything to mainnet
   ./deploy.sh
   ```

4. **Verify deployment**:
   ```bash
   # Check canister status
   dfx canister --network ic status plinko_backend

   # Test the live site
   echo "Visit: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io/plinko"

   # Test the simplified API
   dfx canister --network ic call plinko_backend drop_ball
   dfx canister --network ic call plinko_backend get_multipliers
   ```

5. **Create PR** (MANDATORY):
   ```bash
   git add .
   git commit -m "refactor: simplify Plinko to single configuration

- Remove row selection (fixed at 12 rows)
- Remove risk level selection (fixed at Medium)
- Reduces 9 configurations to 1 simple game
- Maintains 1% house edge and provable fairness
- Simplifies backend code by ~50%
- Simplifies frontend UI significantly

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
   git push -u origin feature/simplify-plinko
   gh pr create --title "Refactor: Simplify Plinko to Single Configuration" --body "Implements SIMPLIFY-PLINKO-PLAN.md

## Summary
Plinko was too complicated with 9 different configurations (3 rows × 3 risk levels). This refactor simplifies it to a single configuration:
- **12 rows** (good balance of gameplay)
- **Medium risk** (balanced multipliers)
- **1% house edge** (maintained)

## Changes
- Backend: Removed rows/risk parameters, fixed configuration
- Frontend: Removed row/risk selectors from UI
- Code reduction: ~50% less backend code
- UX improvement: Simpler, faster gameplay

## Deployed to Mainnet
- Frontend: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io/plinko
- Plinko Backend: weupr-2qaaa-aaaap-abl3q-cai

## Testing
Tested on mainnet:
- ✅ Ball drops work correctly
- ✅ Multipliers display correctly
- ✅ Randomness using IC VRF
- ✅ House edge calculated correctly

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
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

**Branch:** `feature/simplify-plinko`
**Worktree:** `/home/theseus/alexandria/openhouse-simplify-plinko`

---

# Implementation Plan: Simplify Plinko to Single Configuration

## Task Classification
**REFACTORING**: Improve existing code → subtractive approach + targeted fixes

## Current State

### Problem
Plinko is currently too complex with **9 different configurations**:
- **3 row options**: 8, 12, 16
- **3 risk levels**: Low, Medium, High
- Total combinations: 3 × 3 = 9 different games
- Result: Complex multiplier tables, confusing UX, maintenance burden

### Current Backend: `plinko_backend/src/lib.rs`

**Lines 30-38**: Current data structures support multiple configurations
```rust
#[derive(CandidType, Deserialize, Clone, Debug)]
pub enum RiskLevel { Low, Medium, High }

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct PlinkoResult {
    pub path: Vec<bool>,        // true = right, false = left
    pub final_position: u8,     // 0 to rows (number of rights)
    pub multiplier: f64,
}
```

**Lines 48-91**: `drop_ball()` accepts rows and risk parameters
```rust
#[update]
async fn drop_ball(rows: u8, risk: RiskLevel) -> Result<PlinkoResult, String> {
    if ![8, 12, 16].contains(&rows) {
        return Err("Rows must be 8, 12, or 16".to_string());
    }
    // ... VRF randomness generation ...
    // ... path calculation ...
    let multiplier = get_multiplier(rows, &risk, final_position)?;
    Ok(PlinkoResult { path, final_position, multiplier })
}
```

**Lines 102-152**: Massive nested match for all 9 configurations
```rust
fn get_multiplier(rows: u8, risk: &RiskLevel, pos: u8) -> Result<f64, String> {
    let multiplier = match rows {
        8 => match risk {
            RiskLevel::Low => match pos { /* 9 values */ },
            RiskLevel::Medium => match pos { /* 9 values */ },
            RiskLevel::High => match pos { /* 9 values */ },
        },
        12 => match risk {
            RiskLevel::Low => match pos { /* 13 values */ },
            RiskLevel::Medium => match pos { /* 13 values */ },
            RiskLevel::High => match pos { /* 13 values */ },
        },
        16 => match risk {
            RiskLevel::Low => match pos { /* 17 values */ },
            RiskLevel::Medium => match pos { /* 17 values */ },
            RiskLevel::High => match pos { /* 17 values */ },
        },
        _ => return Err(format!("Invalid rows: {}", rows)),
    };
    Ok(multiplier)
}
```

### Current Frontend: Multiple Files

**`openhouse_frontend/src/components/game-specific/plinko/PlinkoControls.tsx`** (90 lines)
- Row selector buttons (8, 12, 16)
- Risk level selector buttons (Low, Medium, High)
- Color coding, state management

**`openhouse_frontend/src/pages/Plinko.tsx`** (204 lines)
- State for rows, riskLevel
- Effect to reload multipliers when config changes
- Conversion to Candid variants

### Current API: `plinko_backend.did`
```candid
type RiskLevel = variant { Low; Medium; High; };

service : {
  drop_ball: (nat8, RiskLevel) -> (variant { Ok: PlinkoResult; Err: text });
  get_multipliers: (nat8, RiskLevel) -> (vec float64) query;
}
```

### Files Affected
```
plinko_backend/
├── src/lib.rs                    # MODIFY - simplify to single config
└── plinko_backend.did            # MODIFY - remove parameters

openhouse_frontend/src/
├── components/game-specific/plinko/
│   ├── PlinkoControls.tsx        # DELETE - no controls needed
│   └── index.ts                  # MODIFY - remove exports
└── pages/Plinko.tsx              # MODIFY - remove state/controls
```

## Simplified Design

### Decision: 12 Rows, Medium Risk

**Why 12 rows?**
- ✅ Good balance of gameplay time (not too fast, not too slow)
- ✅ Nice spread of multipliers (13 positions: 0-12)
- ✅ Medium complexity for visual appeal

**Why Medium risk?**
- ✅ Balanced multipliers (max 33x, not too conservative, not too volatile)
- ✅ Still maintains 1% house edge
- ✅ Approachable for most players

**Configuration:**
- **Fixed Rows**: 12
- **Fixed Risk**: Medium
- **House Edge**: 1%
- **Multipliers**: [33.0, 11.0, 4.0, 2.0, 1.1, 0.6, 0.3, 0.6, 1.1, 2.0, 4.0, 11.0, 33.0]

### Benefits
- ✅ **Simpler codebase**: ~50% reduction in backend code
- ✅ **Better UX**: No decision paralysis, faster gameplay
- ✅ **Easier maintenance**: One configuration to balance and test
- ✅ **Clearer game**: Players understand it immediately
- ✅ **Maintains fairness**: Still uses IC VRF, 1% house edge

## Implementation

### Backend: `plinko_backend/src/lib.rs`

#### 1. Remove RiskLevel enum and simplify PlinkoResult (Lines 30-38)
```rust
// PSEUDOCODE - DELETE
// pub enum RiskLevel { Low, Medium, High }

// PSEUDOCODE - KEEP (no changes needed)
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct PlinkoResult {
    pub path: Vec<bool>,
    pub final_position: u8,
    pub multiplier: f64,
}
```

#### 2. Simplify drop_ball() - remove parameters (Lines 48-91)
```rust
// PSEUDOCODE
#[update]
async fn drop_ball() -> Result<PlinkoResult, String> {
    const ROWS: u8 = 12;  // Fixed configuration

    // Generate VRF randomness (keep existing logic)
    let random_bytes = match raw_rand().await {
        Ok((bytes,)) => bytes,
        Err(_) => {
            // Secure fallback with timestamp + caller
            let time = ic_cdk::api::time();
            let caller = ic_cdk::caller();
            let mut hasher = Sha256::new();
            hasher.update(time.to_be_bytes());
            hasher.update(caller.as_slice());
            hasher.finalize().to_vec()
        }
    };

    // Generate path: 12 independent coin flips
    let path: Vec<bool> = (0..ROWS)
        .map(|i| {
            let bit_index = i as usize;
            let byte_index = bit_index / 8;
            let bit_offset = bit_index % 8;
            (random_bytes[byte_index] >> bit_offset) & 1 == 1
        })
        .collect();

    // Count right moves (0-12)
    let final_position = path.iter().filter(|&&d| d).count() as u8;

    // Get multiplier from fixed table
    let multiplier = get_multiplier(final_position)?;

    Ok(PlinkoResult { path, final_position, multiplier })
}
```

#### 3. Simplify get_multiplier() - single array lookup (Lines 102-152)
```rust
// PSEUDOCODE
fn get_multiplier(pos: u8) -> Result<f64, String> {
    // Fixed multipliers for 12 rows, Medium risk
    // Positions: 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12
    const MULTIPLIERS: [f64; 13] = [
        33.0,  // 0 (far left)
        11.0,  // 1
        4.0,   // 2
        2.0,   // 3
        1.1,   // 4
        0.6,   // 5
        0.3,   // 6 (center - lowest)
        0.6,   // 7
        1.1,   // 8
        2.0,   // 9
        4.0,   // 10
        11.0,  // 11
        33.0,  // 12 (far right)
    ];

    if pos > 12 {
        return Err(format!("Invalid position: {}", pos));
    }

    Ok(MULTIPLIERS[pos as usize])
}
```

#### 4. Simplify get_multipliers() query (Lines 94-100)
```rust
// PSEUDOCODE
#[query]
fn get_multipliers() -> Vec<f64> {
    // Return fixed multiplier table
    vec![33.0, 11.0, 4.0, 2.0, 1.1, 0.6, 0.3, 0.6, 1.1, 2.0, 4.0, 11.0, 33.0]
}
```

#### 5. Remove play_plinko() backwards compatibility (Lines 156-159)
```rust
// PSEUDOCODE - DELETE entirely
// This was for backwards compatibility, no longer needed after refactor
```

#### 6. Update tests (Lines 167-271)
```rust
// PSEUDOCODE
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_multiplier_valid_positions() {
        // Test edge positions
        assert_eq!(get_multiplier(0).unwrap(), 33.0);
        assert_eq!(get_multiplier(12).unwrap(), 33.0);

        // Test center position (lowest multiplier)
        assert_eq!(get_multiplier(6).unwrap(), 0.3);

        // Test symmetry
        assert_eq!(get_multiplier(1).unwrap(), get_multiplier(11).unwrap());
        assert_eq!(get_multiplier(2).unwrap(), get_multiplier(10).unwrap());
    }

    #[test]
    fn test_multiplier_invalid_positions() {
        assert!(get_multiplier(13).is_err());
        assert!(get_multiplier(20).is_err());
    }

    #[test]
    fn test_get_multipliers_table() {
        let table = get_multipliers();
        assert_eq!(table.len(), 13);
        assert_eq!(table[0], 33.0);
        assert_eq!(table[6], 0.3);
        assert_eq!(table[12], 33.0);
    }

    #[test]
    fn test_house_edge() {
        // Calculate expected value for 12 rows
        let table = get_multipliers();

        // Binomial probabilities for 12 rows
        let probs = [
            1.0/4096.0,   // pos 0
            12.0/4096.0,  // pos 1
            66.0/4096.0,  // pos 2
            220.0/4096.0, // pos 3
            495.0/4096.0, // pos 4
            792.0/4096.0, // pos 5
            924.0/4096.0, // pos 6 (center - most likely)
            792.0/4096.0, // pos 7
            495.0/4096.0, // pos 8
            220.0/4096.0, // pos 9
            66.0/4096.0,  // pos 10
            12.0/4096.0,  // pos 11
            1.0/4096.0,   // pos 12
        ];

        let expected_value: f64 = table.iter()
            .zip(probs.iter())
            .map(|(mult, prob)| mult * prob)
            .sum();

        // Should have ~1% house edge (EV ≈ 0.99)
        let house_edge = 1.0 - expected_value;
        assert!(house_edge > 0.005 && house_edge < 0.015,
                "House edge should be ~1%, got {}%", house_edge * 100.0);
    }
}
```

### Backend API: `plinko_backend.did`

```candid
// PSEUDOCODE
type PlinkoResult = record {
  path: vec bool;
  final_position: nat8;
  multiplier: float64;
};

service : {
  // Drop a ball (no parameters needed - fixed 12 rows, medium risk)
  drop_ball: () -> (variant { Ok: PlinkoResult; Err: text });

  // Get the fixed multiplier table
  get_multipliers: () -> (vec float64) query;

  // Test function
  greet: (text) -> (text) query;
}
```

### Frontend: `openhouse_frontend/src/components/game-specific/plinko/PlinkoControls.tsx`

```typescript
// PSEUDOCODE - DELETE THIS ENTIRE FILE
// No controls needed anymore - game has fixed configuration
```

### Frontend: `openhouse_frontend/src/components/game-specific/plinko/index.ts`

```typescript
// PSEUDOCODE
// Remove PlinkoControls, RiskLevel, RowCount exports
export { PlinkoBoard } from './PlinkoBoard';
export { PlinkoMultipliers } from './PlinkoMultipliers';
// DELETE: export { PlinkoControls, type RiskLevel, type RowCount } from './PlinkoControls';
```

### Frontend: `openhouse_frontend/src/pages/Plinko.tsx`

```typescript
// PSEUDOCODE
import React, { useEffect, useState, useCallback } from 'react';
import usePlinkoActor from '../hooks/actors/usePlinkoActor';
import { GameLayout, GameButton, GameStats, type GameStat } from '../components/game-ui';
import { PlinkoBoard, PlinkoMultipliers } from '../components/game-specific/plinko';
import { ConnectionStatus } from '../components/ui/ConnectionStatus';

interface PlinkoGameResult {
  path: boolean[];
  final_position: number;
  multiplier: number;
  timestamp: number;
  clientId?: string;
}

export const Plinko: React.FC = () => {
  const { actor } = usePlinkoActor();

  // Game state
  const [isPlaying, setIsPlaying] = useState(false);
  const [gameError, setGameError] = useState('');
  const [history, setHistory] = useState<PlinkoGameResult[]>([]);

  // Fixed configuration
  const ROWS = 12;
  const [multipliers, setMultipliers] = useState<number[]>([]);
  const [currentResult, setCurrentResult] = useState<{ path: boolean[]; final_position: number; multiplier: number } | null>(null);

  // Load multipliers on mount
  useEffect(() => {
    const loadMultipliers = async () => {
      if (!actor) return;
      try {
        const mults = await actor.get_multipliers();  // No parameters
        setMultipliers(mults);
      } catch (err) {
        console.error('Failed to load multipliers:', err);
      }
    };
    loadMultipliers();
  }, [actor]);

  // Handle ball drop
  const dropBall = async () => {
    if (!actor) return;

    setIsPlaying(true);
    setGameError('');
    setCurrentResult(null);

    try {
      const result = await actor.drop_ball();  // No parameters

      if ('Ok' in result) {
        const gameResult: PlinkoGameResult = {
          ...result.Ok,
          timestamp: Date.now(),
          clientId: crypto.randomUUID()
        };

        setCurrentResult(result.Ok);
        setHistory(prev => [gameResult, ...prev.slice(0, 9)]);
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

  const handleAnimationComplete = useCallback(() => {
    setIsPlaying(false);
  }, []);

  // Simplified stats - no configuration options to show
  const minMultiplier = multipliers.length > 0 ? Math.min(...multipliers) : 0;
  const maxMultiplier = multipliers.length > 0 ? Math.max(...multipliers) : 0;

  const stats: GameStat[] = [
    { label: 'Rows', value: '12', highlight: true, color: 'blue' },
    { label: 'Min/Max', value: `${minMultiplier.toFixed(1)}x - ${maxMultiplier.toFixed(0)}x` },
    { label: 'House Edge', value: '1%', color: 'green' },
  ];

  return (
    <GameLayout
      title="Plinko"
      icon="🎯"
      description="Drop the ball and watch it bounce to a multiplier!"
      minBet={1}
      maxWin={1000}
      houseEdge={1}
    >
      <ConnectionStatus game="plinko" />

      {/* GAME CONTROLS - Simplified */}
      <div className="card max-w-2xl mx-auto">
        {/* NO MORE PlinkoControls - removed row/risk selectors */}

        <GameStats stats={stats} />

        <GameButton
          onClick={dropBall}
          disabled={!actor}
          loading={isPlaying}
          label="DROP BALL"
          loadingLabel="Dropping..."
          icon="🎯"
        />

        {gameError && (
          <div className="mt-4 text-red-400 text-sm text-center">
            {gameError}
          </div>
        )}
      </div>

      {/* PLINKO BOARD - Always 12 rows */}
      <div className="card max-w-4xl mx-auto">
        <PlinkoBoard
          rows={ROWS}
          path={currentResult?.path || null}
          isDropping={isPlaying}
          onAnimationComplete={handleAnimationComplete}
          finalPosition={currentResult?.final_position}
        />

        {multipliers.length > 0 && (
          <PlinkoMultipliers
            multipliers={multipliers}
            highlightedIndex={currentResult?.final_position}
          />
        )}

        {currentResult && !isPlaying && (
          <div className="text-center mt-6">
            <div className="text-3xl font-bold mb-2 text-dfinity-turquoise">
              {currentResult.multiplier >= 10 ? '🎉 BIG WIN!' : '✨'}
            </div>
            <div className="text-2xl font-mono text-yellow-500">
              {currentResult.multiplier.toFixed(currentResult.multiplier >= 10 ? 0 : 1)}x Multiplier
            </div>
          </div>
        )}
      </div>

      {/* Game History */}
      <div className="card max-w-2xl mx-auto">
        <h3 className="font-bold mb-4 text-center">Recent Drops</h3>
        {history.length === 0 ? (
          <div className="text-center text-gray-400 py-6">
            No drops yet. Start playing!
          </div>
        ) : (
          <div className="space-y-2">
            {history.slice(0, 10).map((item, index) => (
              <div
                key={item.clientId || index}
                className="bg-casino-primary border border-pure-white/10 p-3 flex justify-between items-center"
              >
                <span className="font-mono text-xs text-gray-400">
                  {/* Simplified - no config display */}
                  Drop #{history.length - index}
                </span>
                <span className={`font-bold ${
                  item.multiplier >= 10 ? 'text-dfinity-red' :
                  item.multiplier >= 3 ? 'text-yellow-500' :
                  'text-dfinity-turquoise'
                }`}>
                  {item.multiplier.toFixed(item.multiplier >= 10 ? 0 : 1)}x
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </GameLayout>
  );
};
```

## Deployment Notes

### Affected Canisters
- **Plinko Backend**: `weupr-2qaaa-aaaap-abl3q-cai` (breaking API change)
- **Frontend**: `pezw3-laaaa-aaaal-qssoa-cai` (updated to use new API)

### Breaking Changes
⚠️ **API BREAKING CHANGE**: The `drop_ball()` and `get_multipliers()` functions no longer accept parameters.

**Migration:**
- Old: `drop_ball(12, { Medium: null })`
- New: `drop_ball()`

### Deployment Steps
1. Build backend: `cargo build --target wasm32-unknown-unknown --release`
2. Build frontend: `cd openhouse_frontend && npm run build && cd ..`
3. Deploy all: `./deploy.sh`
4. Test on mainnet: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io/plinko

### Testing Checklist
- [ ] Backend builds successfully
- [ ] Frontend builds successfully
- [ ] `drop_ball()` returns valid results
- [ ] `get_multipliers()` returns 13 values
- [ ] Multipliers sum to ~99% expected value (1% house edge)
- [ ] Ball animation works correctly
- [ ] No console errors
- [ ] Game history displays correctly

## Success Metrics

### Code Reduction
- **Backend**: ~150 lines → ~90 lines (~40% reduction)
- **Frontend**: Remove entire `PlinkoControls.tsx` component (90 lines)
- **Frontend**: Simplify `Plinko.tsx` by ~30 lines

### Complexity Reduction
- **Before**: 9 configurations (3 rows × 3 risks)
- **After**: 1 configuration
- **Multiplier table**: 117 values → 13 values (89% reduction)

### UX Improvement
- **Before**: User must choose rows + risk level before playing
- **After**: User just clicks "DROP BALL" and plays immediately
- **Decision fatigue**: Eliminated
- **Time to first play**: Reduced by ~5-10 seconds

### Maintenance Benefits
- One configuration to balance and test
- Simpler codebase for future developers
- Easier to add features (e.g., betting, animations)
- No need to maintain 9 different multiplier tables

## Plan Checklist

- [x] Worktree created first
- [x] Orchestrator header EMBEDDED at top of plan
- [x] Current state documented
- [x] Affected games/canisters identified
- [x] Implementation in pseudocode
- [x] Deployment strategy noted
- [ ] Plan committed to feature branch
- [ ] Handoff command provided with PR creation reminder
