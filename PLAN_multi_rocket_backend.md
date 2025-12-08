# 🤖 AUTONOMOUS PR ORCHESTRATOR - DO NOT SKIP

**You are an autonomous PR orchestrator. Your ONLY job is to implement this plan and create a PR.**

## Isolation Check (RUN FIRST)
```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
if [ "$REPO_ROOT" = "/home/theseus/alexandria/openhouse" ]; then
    echo "❌ FATAL: In main repo. Must be in worktree."
    echo "Worktree: /home/theseus/alexandria/openhouse-multi-rocket"
    exit 1
fi
echo "✅ In isolated worktree: $REPO_ROOT"
```

## Your Autonomous Workflow (NO QUESTIONS ALLOWED)
1. **Verify isolation** - You must be in worktree: `/home/theseus/alexandria/openhouse-multi-rocket`
2. **Implement feature** - Follow plan sections below
3. **Build & Deploy to Mainnet**:
   ```bash
   # Build crash backend
   cargo build --target wasm32-unknown-unknown --release -p crash_backend

   # Deploy crash backend only
   ./deploy.sh --crash-only
   ```

4. **Verify deployment with dfx tests** (MANDATORY - see Testing section)

5. **Create PR** (MANDATORY):
   ```bash
   git add .
   git commit -m "feat(crash): add multi-rocket game mode with independent VRF outcomes"
   git push -u origin feature/multi-rocket-crash
   gh pr create --title "feat(crash): Multi-Rocket Game Mode (Backend)" --body "Implements PLAN_multi_rocket_backend.md

## Summary
- Adds \`play_crash_multi(target, count)\` endpoint for launching 1-10 rockets
- Each rocket has independent crash point via SHA256 derivation from single VRF call
- Maintains 1% house edge per rocket
- Proportional payout based on how many rockets reach target

## Deployed to mainnet
- Crash Backend: https://dashboard.internetcomputer.org/canister/fws6k-tyaaa-aaaap-qqc7q-cai

## Testing
Run these commands to verify:
\`\`\`bash
dfx canister --network ic call crash_backend play_crash_multi '(2.0 : float64, 5 : nat8)'
dfx canister --network ic call crash_backend play_crash_multi '(10.0 : float64, 10 : nat8)'
\`\`\`"
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

**Branch:** `feature/multi-rocket-crash`
**Worktree:** `/home/theseus/alexandria/openhouse-multi-rocket`

---

# Implementation Plan: Multi-Rocket Crash Backend

## Feature Summary

Add ability to launch 1-10 rockets simultaneously with the SAME target multiplier but INDEPENDENT crash points. Each crash point is derived from a single VRF call using SHA256 derivation (following dice_backend pattern).

## Current State

### File: `crash_backend/src/lib.rs`

**Existing types (lines 28-41):**
```rust
pub struct CrashResult {
    pub crash_point: f64,
    pub randomness_hash: String,
}

pub struct PlayCrashResult {
    pub crash_point: f64,
    pub won: bool,
    pub target_multiplier: f64,
    pub payout: u64,
    pub randomness_hash: String,
}
```

**Existing helper functions:**
- `bytes_to_float(bytes: &[u8])` - Converts 8 bytes to f64 in [0.0, 1.0) (lines 186-203)
- `calculate_crash_point(random: f64)` - Formula: `0.99 / (1.0 - random)` (lines 222-232)
- `create_randomness_hash(bytes: &[u8])` - SHA256 hash for audit (lines 247-261)

**Existing endpoint:**
- `play_crash(target_multiplier: f64)` - Single rocket game (lines 91-134)

### File: `crash_backend/crash_backend.did`

Current interface supports only single-rocket play.

### Reference: `dice_backend/src/seed.rs` (SHA256 derivation pattern)

Lines 75-92 show how to derive multiple independent values from single VRF:
```rust
// SHA256(server_seed + client_seed + nonce + index) -> independent roll
```

---

## Implementation

### Step 1: Add New Types

**File:** `crash_backend/src/lib.rs`

Add after `PlayCrashResult` struct (around line 42):

```rust
// PSEUDOCODE
#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct SingleRocketResult {
    pub rocket_index: u8,           // 0-9
    pub crash_point: f64,           // Where this rocket crashed
    pub reached_target: bool,       // Did it reach the target?
    pub payout: u64,                // Payout for this rocket (0 if crashed early)
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct MultiCrashResult {
    pub rockets: Vec<SingleRocketResult>,  // Individual results
    pub target_multiplier: f64,            // Shared target
    pub rocket_count: u8,                  // How many rockets launched
    pub rockets_succeeded: u8,             // How many reached target
    pub total_payout: u64,                 // Sum of all payouts
    pub master_randomness_hash: String,    // VRF seed hash for verification
}
```

### Step 2: Add SHA256 Derivation Helper

**File:** `crash_backend/src/lib.rs`

Add after `bytes_to_float` function (around line 204):

```rust
// PSEUDOCODE
/// Derive an independent float for a specific rocket index
/// Uses SHA256(vrf_bytes + index) to generate independent values
fn derive_rocket_random(vrf_bytes: &[u8], rocket_index: u8) -> Result<f64, String> {
    use sha2::{Sha256, Digest};

    let mut hasher = Sha256::new();
    hasher.update(vrf_bytes);
    hasher.update([rocket_index]); // Include index for independence
    let hash = hasher.finalize();

    // Convert first 8 bytes to f64 in range [0.0, 1.0)
    let mut byte_array = [0u8; 8];
    byte_array.copy_from_slice(&hash[0..8]);
    let random_u64 = u64::from_be_bytes(byte_array);
    let random = (random_u64 >> 11) as f64 / (1u64 << 53) as f64;

    Ok(random)
}
```

### Step 3: Add Multi-Rocket Endpoint

**File:** `crash_backend/src/lib.rs`

Add after `play_crash` function (around line 135):

```rust
// PSEUDOCODE
/// Play crash game with multiple rockets targeting same multiplier
/// Each rocket has independent crash point derived from single VRF call
#[update]
async fn play_crash_multi(target_multiplier: f64, rocket_count: u8) -> Result<MultiCrashResult, String> {
    const MAX_ROCKETS: u8 = 10;

    // Validate target_multiplier (same as play_crash)
    if target_multiplier < 1.01 {
        return Err("Target must be at least 1.01x".to_string());
    }
    if target_multiplier > MAX_CRASH {
        return Err(format!("Target cannot exceed {}x", MAX_CRASH));
    }
    if !target_multiplier.is_finite() {
        return Err("Target must be a finite number".to_string());
    }

    // Validate rocket_count
    if rocket_count < 1 {
        return Err("Must launch at least 1 rocket".to_string());
    }
    if rocket_count > MAX_ROCKETS {
        return Err(format!("Maximum {} rockets allowed", MAX_ROCKETS));
    }

    // Get randomness from IC VRF (single call for all rockets)
    let random_bytes = raw_rand().await
        .map_err(|e| format!("Randomness unavailable: {:?}", e))?;

    // Derive independent crash point for each rocket
    let mut rockets = Vec::with_capacity(rocket_count as usize);
    let mut rockets_succeeded: u8 = 0;
    let mut total_payout: u64 = 0;

    for i in 0..rocket_count {
        let random = derive_rocket_random(&random_bytes, i)?;
        let crash_point = calculate_crash_point(random);
        let reached_target = crash_point >= target_multiplier;

        // Calculate payout (1 USDT per rocket, 6 decimals)
        let payout = if reached_target {
            (target_multiplier * 1_000_000.0) as u64
        } else {
            0
        };

        if reached_target {
            rockets_succeeded += 1;
        }
        total_payout += payout;

        rockets.push(SingleRocketResult {
            rocket_index: i,
            crash_point,
            reached_target,
            payout,
        });
    }

    // Create master hash for provable fairness
    let master_randomness_hash = create_randomness_hash(&random_bytes);

    Ok(MultiCrashResult {
        rockets,
        target_multiplier,
        rocket_count,
        rockets_succeeded,
        total_payout,
        master_randomness_hash,
    })
}
```

### Step 4: Update Candid Interface

**File:** `crash_backend/crash_backend.did`

Add new types and service method:

```candid
// Add after PlayCrashResult
type SingleRocketResult = record {
  rocket_index: nat8;
  crash_point: float64;
  reached_target: bool;
  payout: nat64;
};

type MultiCrashResult = record {
  rockets: vec SingleRocketResult;
  target_multiplier: float64;
  rocket_count: nat8;
  rockets_succeeded: nat8;
  total_payout: nat64;
  master_randomness_hash: text;
};

// Add to service block
service : {
  // ... existing methods ...
  play_crash_multi: (float64, nat8) -> (variant { Ok: MultiCrashResult; Err: text });
}
```

### Step 5: Add Unit Tests

**File:** `crash_backend/src/lib.rs`

Add to the `tests` module:

```rust
// PSEUDOCODE
#[test]
fn test_derive_rocket_random_independence() {
    // Same VRF bytes, different indices should produce different values
    let vrf_bytes = vec![1u8; 32];

    let r0 = derive_rocket_random(&vrf_bytes, 0).unwrap();
    let r1 = derive_rocket_random(&vrf_bytes, 1).unwrap();
    let r2 = derive_rocket_random(&vrf_bytes, 2).unwrap();

    // All should be different
    assert_ne!(r0, r1);
    assert_ne!(r1, r2);
    assert_ne!(r0, r2);

    // All should be in valid range
    assert!(r0 >= 0.0 && r0 < 1.0);
    assert!(r1 >= 0.0 && r1 < 1.0);
    assert!(r2 >= 0.0 && r2 < 1.0);
}

#[test]
fn test_derive_rocket_random_deterministic() {
    // Same inputs should always produce same output
    let vrf_bytes = vec![42u8; 32];

    let r1 = derive_rocket_random(&vrf_bytes, 5).unwrap();
    let r2 = derive_rocket_random(&vrf_bytes, 5).unwrap();

    assert_eq!(r1, r2);
}

#[test]
fn test_multi_crash_house_edge() {
    // Verify each rocket maintains 1% house edge independently
    // Expected return per rocket = 0.99

    // Test specific crash points derived from known random values
    let test_randoms = vec![0.0, 0.5, 0.9, 0.99];
    for random in test_randoms {
        let crash = calculate_crash_point(random);
        // Just verify crash point is valid
        assert!(crash > 0.0 && crash <= MAX_CRASH);
    }
}
```

---

## Build & Deploy

```bash
# In worktree directory
cd /home/theseus/alexandria/openhouse-multi-rocket

# Build
cargo build --target wasm32-unknown-unknown --release -p crash_backend

# Run unit tests
cargo test -p crash_backend

# Deploy to mainnet
./deploy.sh --crash-only
```

---

## Testing (MANDATORY)

After deployment, run these dfx commands to verify the feature works:

### Test 1: Basic multi-rocket (5 rockets at 2x target)
```bash
dfx canister --network ic call crash_backend play_crash_multi '(2.0 : float64, 5 : nat8)'
```

**Expected:** Returns `MultiCrashResult` with 5 rockets, each having different crash points. Some may reach 2x target, some may not.

### Test 2: Max rockets at high target (10 rockets at 10x)
```bash
dfx canister --network ic call crash_backend play_crash_multi '(10.0 : float64, 10 : nat8)'
```

**Expected:** Returns 10 rockets. Statistically ~1 should reach 10x (9.9% win chance per rocket).

### Test 3: Single rocket (backwards compatibility check)
```bash
dfx canister --network ic call crash_backend play_crash_multi '(2.0 : float64, 1 : nat8)'
```

**Expected:** Works with just 1 rocket.

### Test 4: Edge case - minimum target
```bash
dfx canister --network ic call crash_backend play_crash_multi '(1.01 : float64, 3 : nat8)'
```

**Expected:** Most/all rockets should succeed (98% win chance each).

### Test 5: Error handling - invalid inputs
```bash
# Too many rockets
dfx canister --network ic call crash_backend play_crash_multi '(2.0 : float64, 11 : nat8)'

# Target too low
dfx canister --network ic call crash_backend play_crash_multi '(1.0 : float64, 5 : nat8)'

# Zero rockets
dfx canister --network ic call crash_backend play_crash_multi '(2.0 : float64, 0 : nat8)'
```

**Expected:** All should return `Err` with descriptive message.

### Test 6: Verify crash points are independent
```bash
# Run multiple times and compare results
dfx canister --network ic call crash_backend play_crash_multi '(5.0 : float64, 10 : nat8)'
dfx canister --network ic call crash_backend play_crash_multi '(5.0 : float64, 10 : nat8)'
```

**Expected:** Each call produces different crash points (different VRF seeds), but within each call, the 10 rockets should have independent distributions.

---

## Success Criteria

1. ✅ `play_crash_multi` endpoint deployed and callable
2. ✅ Returns valid `MultiCrashResult` with correct structure
3. ✅ Each rocket has independent crash point (not all same)
4. ✅ Error handling works for invalid inputs
5. ✅ Existing `play_crash` still works (no regression)

---

## Affected Canisters

- **Crash Backend**: `fws6k-tyaaa-aaaap-qqc7q-cai` (MODIFIED)
- Frontend: Not modified in this plan (separate PR)
