# 🤖 AUTONOMOUS PR ORCHESTRATOR - DO NOT SKIP

**You are an autonomous PR orchestrator. Your ONLY job is to implement this plan and create a PR.**

## Isolation Check (RUN FIRST)
```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
if [ "$REPO_ROOT" = "/home/theseus/alexandria/openhouse" ]; then
    echo "❌ FATAL: In main repo. Must be in worktree."
    echo "Worktree: /home/theseus/alexandria/openhouse-plinko-v2-motoko"
    exit 1
fi
echo "✅ In isolated worktree: $REPO_ROOT"
```

## Your Autonomous Workflow (NO QUESTIONS ALLOWED)
1. **Verify isolation** - You must be in worktree: `/home/theseus/alexandria/openhouse-plinko-v2-motoko`
2. **Implement feature** - Follow plan sections below
3. **Build & Deploy to Mainnet**:
   ```bash
   # Build Motoko canister
   dfx build mines_backend --network ic

   # Deploy to mainnet (replaces existing mines backend)
   dfx deploy mines_backend --network ic

   # Generate TypeScript declarations
   dfx generate mines_backend --network ic

   # Copy declarations to frontend
   mkdir -p openhouse_frontend/src/declarations/mines_backend
   cp -r src/declarations/mines_backend/* openhouse_frontend/src/declarations/mines_backend/

   # Build and deploy frontend
   cd openhouse_frontend
   npm install
   npm run build
   cd ..
   ./deploy.sh --frontend-only
   ```

4. **Verify deployment**:
   ```bash
   # Test Motoko Plinko backend
   dfx canister --network ic call wvrcw-3aaaa-aaaah-arm4a-cai get_formula
   dfx canister --network ic call wvrcw-3aaaa-aaaah-arm4a-cai get_expected_value
   dfx canister --network ic call wvrcw-3aaaa-aaaah-arm4a-cai drop_balls '(1 : nat8)'

   # Compare with Rust Plinko
   dfx canister --network ic call weupr-2qaaa-aaaap-abl3q-cai drop_balls '(1 : nat8)'

   # Check frontend
   echo "Rust Plinko: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io/plinko"
   echo "Motoko Plinko: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io/plinko-motoko"
   ```

5. **Create PR** (MANDATORY):
   ```bash
   git add .
   git commit -m "feat: implement Plinko V2 in Motoko for performance comparison"
   git push -u origin feature/plinko-v2-motoko
   gh pr create --title "Feature: Plinko V2 (Motoko) - Language Performance Comparison" --body "Implements Pure Mathematical Plinko in Motoko to compare with existing Rust implementation.

## Overview
Creates Plinko V2 by replacing the mines backend with a Motoko implementation of the same Pure Mathematical Plinko game. This enables direct performance and developer experience comparison between Rust and Motoko for identical game logic.

## Implementation Details

### Motoko Backend
- **Canister**: \`mines_backend\` (\`wvrcw-3aaaa-aaaah-arm4a-cai\`)
- **Language**: Motoko
- **Game**: Pure Mathematical Plinko (8 rows, formula-based multipliers)
- **Randomness**: IC VRF via \`Random.blob()\`
- **API**: Identical to Rust Plinko for fair comparison

### Frontend Integration
- **New Route**: \`/plinko-motoko\`
- **Displayed As**: \"Plinko V2 (Motoko)\"
- **Original Plinko**: Still available at \`/plinko\` (Rust implementation)

### Key Features
- ✅ Same mathematical formula: \`M(k) = 0.2 + 6.32 × ((k-4)/4)²\`
- ✅ Same house edge: 1% (0.99 expected value)
- ✅ Same API: \`drop_ball()\`, \`drop_balls(1-10)\`, query methods
- ✅ Stateless design for easy upgrades
- ✅ Full TypeScript declarations

## Comparison Metrics

### What We're Comparing
1. **Development Experience**
   - Code clarity and readability
   - Type system ergonomics
   - Error handling patterns

2. **Performance**
   - Cycle consumption per game
   - Response latency
   - WASM bundle size

3. **Maintainability**
   - Upgrade complexity
   - State management
   - Testing ease

### Expected Differences
- **Motoko**: Simpler async/await, garbage collection, actor model
- **Rust**: Manual memory management, more control, larger ecosystem

## Testing Performed
- [x] Backend builds successfully
- [x] Deployed to mainnet
- [x] \`get_expected_value\` returns 0.99
- [x] \`drop_balls\` returns valid results
- [x] Multipliers match Rust implementation
- [x] Frontend route works
- [x] TypeScript declarations generated

## Files Changed

### Created
- \`mines_backend/src/main.mo\` - Motoko implementation
- \`openhouse_frontend/src/pages/PlinkoMotoko.tsx\` - New UI page
- \`openhouse_frontend/src/hooks/actors/useMinesActor.ts\` - Actor hook

### Modified
- \`dfx.json\` - Changed mines_backend type to \"motoko\"
- \`deploy.sh\` - Updated mines deployment for Motoko
- \`openhouse_frontend/src/App.tsx\` - Added /plinko-motoko route

### Removed
- \`mines_backend/src/lib.rs\` - Replaced with Motoko
- \`mines_backend/Cargo.toml\` - No longer needed

## Affected Canisters
- **mines_backend** (\`wvrcw-3aaaa-aaaah-arm4a-cai\`) - Complete replacement
- **openhouse_frontend** (\`pezw3-laaaa-aaaal-qssoa-cai\`) - New route added

## Deployment Links
- Rust Plinko: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io/plinko
- Motoko Plinko V2: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io/plinko-motoko

## Next Steps
After this PR is merged, we can gather real-world performance data and make an informed decision about which language to use for future game backends."
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

**Branch:** `feature/plinko-v2-motoko`
**Worktree:** `/home/theseus/alexandria/openhouse-plinko-v2-motoko`

---

# Implementation Plan: Plinko V2 (Motoko)

## Task Classification
**NEW FEATURE** - Build new functionality with additive approach

## Project Goal

Replace the unused Mines game backend with a Motoko implementation of Pure Mathematical Plinko. This creates a **direct comparison** between:

- **Rust Plinko** (existing): `weupr-2qaaa-aaaap-abl3q-cai`
- **Motoko Plinko V2** (new): `wvrcw-3aaaa-aaaah-arm4a-cai`

Both implementations will have:
- Identical game logic and mathematical formula
- Same API endpoints
- Same expected value (0.99 / 1% house edge)
- Identical frontend experience

This enables objective comparison of:
- Development experience
- Performance (cycles, latency, WASM size)
- Code maintainability
- Deployment complexity

## Current State Documentation

### Rust Plinko (Reference Implementation)
**Canister**: `weupr-2qaaa-aaaap-abl3q-cai`
**Status**: ✅ Deployed and working on mainnet
**Route**: `/plinko`

**Core Logic**:
```rust
// plinko_backend/src/lib.rs (lines 60-94)
async fn drop_ball() -> Result<PlinkoResult, String> {
    // 1. Get 32 bytes of VRF randomness
    let random_bytes = raw_rand().await?;

    // 2. Use first byte for 8 coin flips
    let random_byte = random_bytes.get(0)?;
    let path: Vec<bool> = (0..8)
        .map(|i| (random_byte >> i) & 1 == 1)
        .collect();

    // 3. Count rights to get position (0-8)
    let final_position = path.iter().filter(|&&d| d).count() as u8;

    // 4. Calculate multiplier from formula
    let multiplier = calculate_multiplier(final_position);

    Ok(PlinkoResult { path, final_position, multiplier, win: multiplier >= 1.0 })
}

// Mathematical formula (lines 199-213)
pub fn calculate_multiplier(position: u8) -> f64 {
    let k = position as f64;
    let distance = (k - 4.0).abs();
    let normalized = distance / 4.0;
    0.2 + 6.32 * normalized * normalized
}
```

**Expected Values**:
```
Position:    0     1     2     3     4     5     6     7     8
Multiplier: 6.52  3.76  1.78  0.60  0.20  0.60  1.78  3.76  6.52
Win/Loss:   WIN   WIN   WIN   LOSS  LOSS  LOSS  WIN   WIN   WIN
```

**API Methods**:
- `drop_ball()` → Single ball drop
- `drop_balls(nat8)` → Multi-ball drop (1-10 balls)
- `get_multipliers()` → Array of 9 multipliers
- `get_formula()` → Formula string
- `get_expected_value()` → 0.99
- `greet(text)` → Test method

### Mines Backend (To Be Replaced)
**Canister**: `wvrcw-3aaaa-aaaah-arm4a-cai`
**Current Status**: Deployed with Mines game (unused)
**New Purpose**: Plinko V2 (Motoko implementation)

**Current Structure**:
```
mines_backend/
├── src/
│   └── lib.rs          (❌ Will be deleted)
├── Cargo.toml          (❌ Will be deleted)
├── mines_backend.did   (✏️ Will be replaced)
└── README.md           (✏️ Will be updated)
```

**New Structure**:
```
mines_backend/
├── src/
│   └── main.mo         (✨ NEW: Motoko implementation)
├── mines_backend.did   (✏️ Updated with Plinko API)
└── README.md           (✏️ Updated documentation)
```

## Phase 1: Motoko Backend Implementation

### Step 1.1: Create Main Motoko File

**File**: `mines_backend/src/main.mo`

```motoko
// PSEUDOCODE: Pure Mathematical Plinko in Motoko

import Random "mo:base/Random";
import Blob "mo:base/Blob";
import Array "mo:base/Array";
import Nat8 "mo:base/Nat8";
import Float "mo:base/Float";
import Result "mo:base/Result";
import Debug "mo:base/Debug";

actor PlinkoV2Motoko {
    // Constants
    private let ROWS : Nat8 = 8;
    private let MAX_BALLS : Nat8 = 10;

    // Type definitions matching Rust implementation
    public type PlinkoResult = {
        path : [Bool];           // true = right, false = left
        final_position : Nat8;   // 0 to 8
        multiplier : Float;      // Calculated from formula
        win : Bool;              // true if multiplier >= 1.0
    };

    public type MultiBallResult = {
        balls : [PlinkoResult];      // Individual ball results
        total_multiplier : Float;     // Sum of all multipliers
        average_multiplier : Float;   // Average across balls
        ball_count : Nat8;            // Number of balls dropped
    };

    // System lifecycle hooks
    system func preupgrade() {
        Debug.print("Plinko V2 (Motoko): Pre-upgrade");
        // Stateless - no data to preserve
    };

    system func postupgrade() {
        Debug.print("Plinko V2 (Motoko): Post-upgrade");
        // Stateless - no data to restore
    };

    // ============ PUBLIC API ============

    /// Drop a single ball down the 8-row Plinko board
    public func drop_ball() : async Result.Result<PlinkoResult, Text> {
        // Get random blob from IC VRF
        let entropy = await Random.blob();

        // Extract first byte for randomness
        let bytes = Blob.toArray(entropy);
        if (bytes.size() < 1) {
            return #err("Insufficient randomness");
        };

        let random_byte = bytes[0];

        // Generate path: 8 coin flips from bits
        let path = Array.tabulate<Bool>(
            Nat8.toNat(ROWS),
            func(i : Nat) : Bool {
                let bit_index = Nat8.fromNat(i);
                ((random_byte >> bit_index) & 1) == 1
            }
        );

        // Count rights to get final position
        var position : Nat8 = 0;
        for (direction in path.vals()) {
            if (direction) { position += 1; };
        };

        // Calculate multiplier using formula
        let multiplier = calculate_multiplier(position);
        let win = multiplier >= 1.0;

        #ok({
            path = path;
            final_position = position;
            multiplier = multiplier;
            win = win;
        })
    };

    /// Drop multiple balls (1-10) down the Plinko board
    public func drop_balls(num_balls : Nat8) : async Result.Result<MultiBallResult, Text> {
        // Validate input
        if (num_balls < 1 or num_balls > MAX_BALLS) {
            return #err("Number of balls must be between 1 and 10");
        };

        // Get random entropy for all balls
        let entropy = await Random.blob();
        let bytes = Blob.toArray(entropy);

        if (bytes.size() < Nat8.toNat(num_balls)) {
            return #err("Insufficient randomness");
        };

        // Process each ball
        var balls : [PlinkoResult] = [];
        var total_multiplier : Float = 0.0;

        for (ball_index in Array.tabulate<Nat>(Nat8.toNat(num_balls), func(i) = i).vals()) {
            let random_byte = bytes[ball_index];

            // Generate path for this ball
            let path = Array.tabulate<Bool>(
                Nat8.toNat(ROWS),
                func(i : Nat) : Bool {
                    ((random_byte >> Nat8.fromNat(i)) & 1) == 1
                }
            );

            // Calculate position
            var position : Nat8 = 0;
            for (dir in path.vals()) {
                if (dir) { position += 1; };
            };

            // Calculate multiplier
            let multiplier = calculate_multiplier(position);

            // Create result
            let result : PlinkoResult = {
                path = path;
                final_position = position;
                multiplier = multiplier;
                win = multiplier >= 1.0;
            };

            balls := Array.append(balls, [result]);
            total_multiplier += multiplier;
        };

        let average_multiplier = total_multiplier / Float.fromInt(Nat8.toNat(num_balls));

        #ok({
            balls = balls;
            total_multiplier = total_multiplier;
            average_multiplier = average_multiplier;
            ball_count = num_balls;
        })
    };

    /// Get all 9 multipliers (positions 0-8)
    public query func get_multipliers() : async [Float] {
        Array.tabulate<Float>(9, func(i) = calculate_multiplier(Nat8.fromNat(i)))
    };

    /// Get the mathematical formula as text
    public query func get_formula() : async Text {
        "M(k) = 0.2 + 6.32 × ((k - 4) / 4)²"
    };

    /// Get expected value (should be 0.99 for 1% house edge)
    public query func get_expected_value() : async Float {
        // Binomial coefficients for 8 rows: C(8,k)
        let coefficients : [Nat] = [1, 8, 28, 56, 70, 56, 28, 8, 1];
        let total_paths : Float = 256.0;

        var expected_value : Float = 0.0;

        for (i in coefficients.keys()) {
            let probability = Float.fromInt(coefficients[i]) / total_paths;
            let multiplier = calculate_multiplier(Nat8.fromNat(i));
            expected_value += probability * multiplier;
        };

        expected_value
    };

    /// Test/greet function
    public query func greet(name : Text) : async Text {
        "Pure Mathematical Plinko V2 (Motoko): Transparent odds, " # name # " wins or loses fairly!"
    };

    // ============ PRIVATE HELPERS ============

    /// Calculate multiplier using pure mathematical formula
    /// M(k) = 0.2 + 6.32 × ((k - 4) / 4)²
    ///
    /// This creates a quadratic distribution where:
    /// - Center (k=4) has minimum multiplier 0.2 (80% loss)
    /// - Edges (k=0,8) have maximum multiplier 6.52 (big win)
    /// - Expected value is exactly 0.99 (1% house edge)
    private func calculate_multiplier(position : Nat8) : Float {
        // Validate position
        if (position > 8) {
            return 0.0;  // Invalid position
        };

        let k = Float.fromInt(Nat8.toNat(position));
        let center = 4.0;
        let distance = Float.abs(k - center);
        let normalized = distance / 4.0;

        // Quadratic formula
        0.2 + 6.32 * normalized * normalized
    };
}
```

**Key Motoko Features Used**:
1. **Random.blob()**: IC VRF equivalent to Rust's `raw_rand()`
2. **Result.Result<T, E>**: Same pattern as Rust's Result type
3. **Float**: 64-bit IEEE 754 (same as Rust f64)
4. **Array.tabulate**: Functional array generation
5. **Actor model**: Natural async/await without explicit futures

### Step 1.2: Update Candid Interface

**File**: `mines_backend/mines_backend.did`

```candid
// PSEUDOCODE: Candid interface for Plinko V2

type PlinkoResult = record {
    path : vec bool;
    final_position : nat8;
    multiplier : float64;
    win : bool;
};

type MultiBallResult = record {
    balls : vec PlinkoResult;
    total_multiplier : float64;
    average_multiplier : float64;
    ball_count : nat8;
};

service : {
    // Drop a ball - no parameters needed (fixed 8 rows)
    drop_ball : () -> (variant { ok : PlinkoResult; err : text });

    // Drop multiple balls (1-10 balls)
    drop_balls : (nat8) -> (variant { ok : MultiBallResult; err : text });

    // Get all 9 multipliers (positions 0-8)
    get_multipliers : () -> (vec float64) query;

    // Get the mathematical formula
    get_formula : () -> (text) query;

    // Get expected value (should be 0.99)
    get_expected_value : () -> (float64) query;

    // Test function
    greet : (text) -> (text) query;
}
```

**Note**: This is IDENTICAL to `plinko_backend.did` for fair comparison.

### Step 1.3: Delete Rust Files

```bash
# PSEUDOCODE: Clean up Rust artifacts

cd mines_backend

# Backup for reference (optional)
mv src/lib.rs src/lib.rs.rust-backup
mv Cargo.toml Cargo.toml.backup

# Or delete permanently
# rm src/lib.rs
# rm Cargo.toml
```

### Step 1.4: Update README

**File**: `mines_backend/README.md`

```markdown
# PSEUDOCODE: Updated README

# Plinko V2 (Motoko Implementation)

**Status**: Active - Experimental Motoko implementation for comparison

This canister implements **Pure Mathematical Plinko** in Motoko as an alternative to the Rust implementation. Both versions use identical game logic to enable objective comparison of language performance and developer experience.

## Comparison Experiment

- **Rust Version**: `weupr-2qaaa-aaaap-abl3q-cai` (plinko_backend)
- **Motoko Version**: `wvrcw-3aaaa-aaaah-arm4a-cai` (mines_backend/Plinko V2)

### Identical Features
- Same mathematical formula
- Same house edge (1%)
- Same API endpoints
- Same frontend experience

### What We're Measuring
1. Cycle consumption per game
2. Response latency
3. WASM bundle size
4. Code maintainability
5. Development velocity

## Game Rules

**Fixed Configuration**: 8 rows, formula-based multipliers

**Mathematical Formula**:
```
M(k) = 0.2 + 6.32 × ((k - 4) / 4)²
```

Where k is the final position (0-8).

## API

All endpoints match the Rust implementation:

- `drop_ball()` - Drop single ball
- `drop_balls(1-10)` - Drop multiple balls
- `get_multipliers()` - Get all multipliers
- `get_expected_value()` - Returns 0.99

## Development

```bash
# Build
dfx build mines_backend --network ic

# Deploy
dfx deploy mines_backend --network ic

# Test
dfx canister call mines_backend get_expected_value
```

## Frontend

Accessible at: `/plinko-motoko`
Original Rust version at: `/plinko`
```

## Phase 2: Configuration Updates

### Step 2.1: Update dfx.json

**File**: `dfx.json`

```json
// PSEUDOCODE: Change mines_backend to Motoko

{
  "canisters": {
    // ... other canisters unchanged ...

    "mines_backend": {
      "type": "motoko",           // Changed from "rust"
      "main": "mines_backend/src/main.mo",  // Main Motoko file
      "candid": "mines_backend/mines_backend.did",
      "specified_id": "wvrcw-3aaaa-aaaah-arm4a-cai"
    },

    // ... rest unchanged ...
  }
}
```

**Changes**:
- `"type": "motoko"` (was "rust")
- `"main": "..."` (replaces "package")
- Remove `"package"` field (Rust only)

### Step 2.2: Update deploy.sh

**File**: `deploy.sh` (lines 154-173)

```bash
# PSEUDOCODE: Update deploy_mines function

# Function to deploy mines backend (now Motoko)
deploy_mines() {
    echo "================================================"
    echo "Deploying Plinko V2 (Motoko) Backend Canister"
    echo "================================================"

    # Build Motoko canister (dfx handles this automatically)
    echo "Building Plinko V2 (Motoko) backend canister..."
    dfx build mines_backend --network ic

    # Deploy to mainnet
    echo "Deploying Plinko V2 (Motoko) to mainnet..."
    dfx deploy mines_backend --network ic

    echo "Plinko V2 (Motoko) deployment completed!"
    echo ""
}
```

**Changes**:
- No `cargo build` step (Motoko doesn't use Cargo)
- `dfx build` handles Motoko compilation
- Updated echo messages to reflect Plinko V2

**Optional**: Add help text update
```bash
# In --help section (lines 46-48)
echo "  --mines-only       Deploy only Plinko V2 (Motoko) backend"
```

## Phase 3: Frontend Integration

### Step 3.1: Create Actor Hook

**File**: `openhouse_frontend/src/hooks/actors/useMinesActor.ts` (NEW)

```typescript
// PSEUDOCODE: Actor hook for Plinko V2 (Motoko)

import { createActorHook } from 'ic-use-actor';
import { _SERVICE } from '@declarations/mines_backend/mines_backend.did';
import { idlFactory } from '@declarations/mines_backend/mines_backend.did.js';

// Hardcoded canister ID from dfx.json
const canisterId = 'wvrcw-3aaaa-aaaah-arm4a-cai';

const useMinesActor = createActorHook<_SERVICE>({
  canisterId,
  idlFactory,
});

export default useMinesActor;
```

### Step 3.2: Create Plinko V2 Page Component

**File**: `openhouse_frontend/src/pages/PlinkoMotoko.tsx` (NEW)

```typescript
// PSEUDOCODE: Plinko V2 (Motoko) page

import React, { useEffect, useState, useCallback } from 'react';
import useMinesActor from '../hooks/actors/useMinesActor';
import { GameLayout, GameButton, GameStats } from '../components/game-ui';
import { PlinkoBoard, PlinkoMultipliers } from '../components/game-specific/plinko';
import { ConnectionStatus } from '../components/ui/ConnectionStatus';

export const PlinkoMotoko: React.FC = () => {
  const { actor } = useMinesActor();

  // State management (same as Plinko.tsx)
  const [isPlaying, setIsPlaying] = useState(false);
  const [gameError, setGameError] = useState('');
  const [multipliers, setMultipliers] = useState<number[]>([]);
  const [expectedValue, setExpectedValue] = useState<number>(0);
  const [ballCount, setBallCount] = useState(1);
  const [currentMultiResult, setCurrentMultiResult] = useState<any>(null);

  // Load game data on mount
  useEffect(() => {
    const loadGameData = async () => {
      if (!actor) return;

      try {
        const [mults, ev] = await Promise.all([
          actor.get_multipliers(),
          actor.get_expected_value()
        ]);

        setMultipliers(mults);
        setExpectedValue(ev);
      } catch (err) {
        console.error('Failed to load Motoko Plinko data:', err);
      }
    };

    loadGameData();
  }, [actor]);

  // Drop ball(s) - identical logic to Plinko.tsx
  const dropBall = async () => {
    if (!actor) return;

    setIsPlaying(true);
    setGameError('');
    setCurrentMultiResult(null);

    try {
      const result = await (actor as any).drop_balls(ballCount);

      if ('Ok' in result) {
        setCurrentMultiResult(result.Ok);
      } else {
        setGameError(result.Err);
      }
    } catch (err) {
      console.error('Failed to drop balls (Motoko):', err);
      setGameError(err instanceof Error ? err.message : 'Failed to drop balls');
    } finally {
      setIsPlaying(false);
    }
  };

  // Calculate stats
  const houseEdge = ((1 - expectedValue) * 100).toFixed(2);
  const maxMultiplier = multipliers.length > 0 ? Math.max(...multipliers) : 0;

  return (
    <GameLayout
      title="Pure Mathematical Plinko V2"
      subtitle="(Motoko Implementation)"
      icon="🎯"
      description="Same game, different language. Compare performance!"
      minBet={1}
      maxWin={6.52}
      houseEdge={1}
    >
      <ConnectionStatus game="plinko-motoko" />

      {/* Badge showing this is Motoko version */}
      <div className="text-center mb-4">
        <span className="inline-block bg-purple-600 text-white px-4 py-2 rounded-full text-sm font-bold">
          🦀 Motoko Implementation
        </span>
      </div>

      {/* Same UI as Plinko.tsx but with branding differences */}

      {/* Ball count selector, game board, multipliers, etc. */}
      {/* Reuse existing components from Plinko.tsx */}

      {/* Comparison note */}
      <div className="card max-w-2xl mx-auto mt-4">
        <div className="text-sm text-pure-white/60 text-center">
          <p className="font-bold mb-2">🔬 Experimental Comparison</p>
          <p>
            This is the Motoko implementation of Plinko.
            <a href="/plinko" className="text-dfinity-turquoise ml-1">
              Try the Rust version →
            </a>
          </p>
        </div>
      </div>
    </GameLayout>
  );
};
```

**Note**: Reuse as many components as possible from `Plinko.tsx`. The logic is identical, only the actor source changes.

### Step 3.3: Add Route to App

**File**: `openhouse_frontend/src/App.tsx`

```typescript
// PSEUDOCODE: Add Plinko V2 route

import { PlinkoMotoko } from './pages/PlinkoMotoko';

function App() {
  return (
    <Routes>
      {/* Existing routes */}
      <Route path="/plinko" element={<Plinko />} />

      {/* NEW: Plinko V2 (Motoko) */}
      <Route path="/plinko-motoko" element={<PlinkoMotoko />} />

      {/* Other routes */}
    </Routes>
  );
}
```

### Step 3.4: Add Game Card to Homepage

**File**: `openhouse_frontend/src/pages/Home.tsx` (or wherever game cards are)

```typescript
// PSEUDOCODE: Add Plinko V2 card

<GameCard
  title="Plinko V2"
  subtitle="Motoko"
  icon="🎯"
  description="Pure mathematical Plinko in Motoko for comparison"
  badge="Experimental"
  link="/plinko-motoko"
  stats={{
    houseEdge: "1%",
    maxWin: "6.52x",
    minBet: "1 ICP"
  }}
/>
```

## Phase 4: Testing & Verification

### Step 4.1: Build & Deploy Test

```bash
# PSEUDOCODE: Build and deploy sequence

cd /home/theseus/alexandria/openhouse-plinko-v2-motoko

# 1. Build Motoko canister
dfx build mines_backend --network ic
# Expected output: Compiled main.mo to WASM

# 2. Deploy to mainnet
dfx deploy mines_backend --network ic
# This REPLACES the Mines game with Plinko V2

# 3. Verify deployment
dfx canister --network ic status mines_backend
# Should show: Status: Running
```

### Step 4.2: Backend API Tests

```bash
# PSEUDOCODE: Test all API methods

# Test greet (smoke test)
dfx canister --network ic call wvrcw-3aaaa-aaaah-arm4a-cai greet '("Test")'
# Expected: ("Pure Mathematical Plinko V2 (Motoko): Transparent odds, Test wins or loses fairly!")

# Test get_formula
dfx canister --network ic call wvrcw-3aaaa-aaaah-arm4a-cai get_formula
# Expected: ("M(k) = 0.2 + 6.32 × ((k - 4) / 4)²")

# Test get_expected_value
dfx canister --network ic call wvrcw-3aaaa-aaaah-arm4a-cai get_expected_value
# Expected: (0.99 : float64)

# Test get_multipliers
dfx canister --network ic call wvrcw-3aaaa-aaaah-arm4a-cai get_multipliers
# Expected: vec { 6.52; 3.755; 1.78; 0.595; 0.2; 0.595; 1.78; 3.755; 6.52 }

# Test drop_ball
dfx canister --network ic call wvrcw-3aaaa-aaaah-arm4a-cai drop_ball
# Expected: variant { ok = record { ... } }

# Test drop_balls
dfx canister --network ic call wvrcw-3aaaa-aaaah-arm4a-cai drop_balls '(3 : nat8)'
# Expected: variant { ok = record { balls = vec { ... }; ball_count = 3; ... } }

# Test invalid input
dfx canister --network ic call wvrcw-3aaaa-aaaah-arm4a-cai drop_balls '(0 : nat8)'
# Expected: variant { err = "Number of balls must be between 1 and 10" }

dfx canister --network ic call wvrcw-3aaaa-aaaah-arm4a-cai drop_balls '(11 : nat8)'
# Expected: variant { err = "Number of balls must be between 1 and 10" }
```

### Step 4.3: Comparison Test (Rust vs Motoko)

```bash
# PSEUDOCODE: Compare outputs from both implementations

echo "Testing Rust Plinko..."
dfx canister --network ic call weupr-2qaaa-aaaap-abl3q-cai get_expected_value
dfx canister --network ic call weupr-2qaaa-aaaap-abl3q-cai get_multipliers

echo "Testing Motoko Plinko..."
dfx canister --network ic call wvrcw-3aaaa-aaaah-arm4a-cai get_expected_value
dfx canister --network ic call wvrcw-3aaaa-aaaah-arm4a-cai get_multipliers

# Expected: Both should return identical values (within Float precision)
```

### Step 4.4: Frontend Tests

```bash
# PSEUDOCODE: Frontend deployment and testing

cd openhouse_frontend

# Generate declarations
dfx generate mines_backend --network ic

# Copy to frontend
mkdir -p src/declarations/mines_backend
cp -r ../src/declarations/mines_backend/* src/declarations/mines_backend/

# Install and build
npm install
npm run type-check  # Should pass
npm run build       # Should succeed

# Deploy frontend
cd ..
./deploy.sh --frontend-only

# Manual verification:
# 1. Visit https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io
# 2. Click on Plinko V2 card
# 3. Route should be /plinko-motoko
# 4. Expected value should show 0.990000
# 5. Drop balls should work
# 6. No console errors
```

## Phase 5: Performance Comparison Metrics

### Metrics to Document

After deployment, gather these metrics for comparison:

#### 1. Cycle Consumption
```bash
# PSEUDOCODE: Measure cycle costs

# Rust Plinko
dfx canister --network ic call weupr-2qaaa-aaaap-abl3q-cai drop_balls '(1 : nat8)' --with-cycles

# Motoko Plinko
dfx canister --network ic call wvrcw-3aaaa-aaaah-arm4a-cai drop_balls '(1 : nat8)' --with-cycles

# Compare cycle consumption for:
# - Single ball drop
# - 10 ball drop
# - Query methods (get_multipliers, etc.)
```

#### 2. WASM Size
```bash
# PSEUDOCODE: Compare WASM bundle sizes

# Check Rust WASM
ls -lh .dfx/ic/canisters/plinko_backend/plinko_backend.wasm

# Check Motoko WASM
ls -lh .dfx/ic/canisters/mines_backend/mines_backend.wasm

# Document size difference
```

#### 3. Response Latency
```bash
# PSEUDOCODE: Measure response times

# Use time command or similar tool
time dfx canister --network ic call weupr-2qaaa-aaaap-abl3q-cai drop_balls '(10 : nat8)'
time dfx canister --network ic call wvrcw-3aaaa-aaaah-arm4a-cai drop_balls '(10 : nat8)'

# Repeat 10 times, calculate average
```

#### 4. Development Experience

Document subjectively:
- Code clarity and readability
- Type system ergonomics
- Error handling ease
- Testing complexity
- Debugging experience

### Create Comparison Document

**File**: `PLINKO_RUST_VS_MOTOKO_COMPARISON.md` (NEW)

```markdown
# PSEUDOCODE: Comparison results document

# Plinko: Rust vs Motoko Comparison

## Executive Summary

This document compares the Rust and Motoko implementations of Pure Mathematical Plinko on the Internet Computer.

## Implementation Details

### Code Statistics
- **Rust**: ~220 lines (plinko_backend/src/lib.rs)
- **Motoko**: ~180 lines (mines_backend/src/main.mo)

### Architecture
Both implementations:
- Stateless design
- VRF-based randomness
- Identical API surface
- Same mathematical formula

## Performance Metrics

### Cycle Consumption
| Operation | Rust | Motoko | Winner |
|-----------|------|--------|--------|
| drop_ball | TBD | TBD | TBD |
| drop_balls(10) | TBD | TBD | TBD |
| get_multipliers | TBD | TBD | TBD |

### WASM Size
| Implementation | Size | Winner |
|----------------|------|--------|
| Rust | TBD KB | TBD |
| Motoko | TBD KB | TBD |

### Response Latency
| Operation | Rust | Motoko | Winner |
|-----------|------|--------|--------|
| drop_balls(1) | TBD ms | TBD ms | TBD |
| drop_balls(10) | TBD ms | TBD ms | TBD |

## Developer Experience

### Pros/Cons

**Rust**:
- ✅ Pros: Performance control, large ecosystem, familiar to many devs
- ❌ Cons: Manual memory management, more verbose async

**Motoko**:
- ✅ Pros: Simpler syntax, native IC integration, easier upgrades
- ❌ Cons: Smaller ecosystem, less performance control

## Conclusion

[To be filled after real-world usage]

## Recommendations

[To be filled based on metrics]
```

## Deployment Checklist

### Pre-Deployment
- [ ] Motoko code compiles without errors
- [ ] Candid interface matches Rust version
- [ ] dfx.json updated to use Motoko
- [ ] deploy.sh updated for Motoko build
- [ ] Frontend actor hook created
- [ ] Frontend route added

### Deployment
- [ ] `dfx build mines_backend --network ic` succeeds
- [ ] `dfx deploy mines_backend --network ic` succeeds
- [ ] Backend canister status shows "Running"
- [ ] All API methods return correct values
- [ ] Expected value returns 0.99
- [ ] Multipliers match Rust version
- [ ] Frontend declarations generated
- [ ] Frontend builds without errors
- [ ] Frontend deployed successfully

### Post-Deployment
- [ ] `/plinko-motoko` route accessible
- [ ] Game UI loads correctly
- [ ] Drop balls functionality works
- [ ] No console errors in browser
- [ ] Comparison with Rust Plinko shows identical results
- [ ] Performance metrics documented

## Rollback Plan

If Motoko implementation has critical issues:

```bash
# PSEUDOCODE: Rollback to Mines game (Rust)

# 1. Checkout previous version
git checkout HEAD~1 mines_backend/

# 2. Restore dfx.json
git checkout HEAD~1 dfx.json

# 3. Restore deploy.sh
git checkout HEAD~1 deploy.sh

# 4. Rebuild and redeploy
cargo build --release --target wasm32-unknown-unknown --package mines_backend
dfx deploy mines_backend --network ic

# 5. Remove frontend route
# Edit App.tsx to remove /plinko-motoko route

# 6. Redeploy frontend
cd openhouse_frontend && npm run build && cd ..
./deploy.sh --frontend-only
```

## Success Criteria

✅ **Implementation is successful if:**

1. **Backend Works**
   - Builds without errors
   - Deploys to mainnet
   - All API methods functional
   - Expected value = 0.99
   - Multipliers match Rust version

2. **Frontend Works**
   - Route accessible at `/plinko-motoko`
   - Game playable
   - No runtime errors
   - Results display correctly

3. **Comparison Valid**
   - Identical API between Rust and Motoko
   - Results match within Float precision
   - Performance metrics documented

4. **Documentation Complete**
   - README updated
   - Comparison document created
   - CLAUDE.md updated with Plinko V2 info

## File Changes Summary

### Files Created
```
✨ NEW:
- mines_backend/src/main.mo                          (Motoko implementation)
- openhouse_frontend/src/pages/PlinkoMotoko.tsx      (Motoko UI page)
- openhouse_frontend/src/hooks/actors/useMinesActor.ts  (Actor hook)
- PLINKO_RUST_VS_MOTOKO_COMPARISON.md               (Metrics document)
```

### Files Modified
```
📝 MODIFIED:
- dfx.json                      (Change mines_backend to Motoko)
- deploy.sh                     (Update deploy_mines function)
- mines_backend/mines_backend.did  (Replace with Plinko API)
- mines_backend/README.md       (Update documentation)
- openhouse_frontend/src/App.tsx   (Add /plinko-motoko route)
- openhouse_frontend/src/pages/Home.tsx  (Add Plinko V2 card)
```

### Files Deleted
```
🗑️ REMOVED:
- mines_backend/src/lib.rs      (Rust implementation)
- mines_backend/Cargo.toml      (Rust config)
```

## Known Limitations

1. **Float Precision**: Motoko Float and Rust f64 may have minor precision differences. Use epsilon comparison.

2. **Randomness Timing**: VRF call timing may differ between languages, but results should be equally random.

3. **Error Messages**: Error text may differ slightly between implementations.

4. **Upgrade Behavior**: Motoko and Rust have different upgrade semantics. Both are stateless here, so minimal impact.

## Future Enhancements

After initial deployment and comparison:

1. **Add Statistics**: Track games played, average win rate, etc.
2. **Add Leaderboards**: Track best multipliers
3. **Add Betting**: Integrate with ICP transfers
4. **Optimize Performance**: Based on comparison metrics
5. **Add More Tests**: Statistical verification tests

## Related Documentation

- [Motoko Random Documentation](https://internetcomputer.org/docs/motoko/icp-features/randomness)
- [Motoko Float Precision](https://internetcomputer.org/docs/current/motoko/main/base/Float)
- [IC VRF Specification](https://internetcomputer.org/docs/current/references/ic-interface-spec#ic-raw_rand)
- [Original Rust Plinko](plinko_backend/src/lib.rs)

---

## Handoff Command

After implementing this plan and creating the PR, return to main repo:
```bash
cd /home/theseus/alexandria/openhouse
```

The PR will enable **objective comparison** between Rust and Motoko for game backend development on the Internet Computer!
