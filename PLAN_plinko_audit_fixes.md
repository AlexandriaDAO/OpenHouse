# AUTONOMOUS PR ORCHESTRATOR - DO NOT SKIP

**You are an autonomous PR orchestrator. Your ONLY job is to implement this plan and create a PR.**

## Isolation Check (RUN FIRST)
```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
if [ "$REPO_ROOT" = "/home/theseus/alexandria/openhouse" ]; then
    echo "FATAL: In main repo. Must be in worktree."
    echo "Worktree: /home/theseus/alexandria/openhouse-plinko-audit"
    exit 1
fi
echo "In isolated worktree: $REPO_ROOT"
```

## Your Autonomous Workflow (NO QUESTIONS ALLOWED)
1. **Verify isolation** - You must be in worktree: `/home/theseus/alexandria/openhouse-plinko-audit`
2. **Implement feature** - Follow plan sections below
3. **Build & Deploy to Mainnet**:
   ```bash
   cargo build --target wasm32-unknown-unknown --release
   ./deploy.sh --plinko-only
   ```
4. **Verify deployment**:
   ```bash
   dfx canister --network ic call weupr-2qaaa-aaaap-abl3q-cai get_multipliers '()'
   dfx canister --network ic call weupr-2qaaa-aaaap-abl3q-cai get_expected_value '()'
   ```
5. **Create PR** (MANDATORY):
   ```bash
   git add .
   git commit -m "fix(plinko): improve error handling and remove unused dependency"
   git push -u origin feature/plinko-audit-fixes
   gh pr create --title "fix(plinko): Security audit fixes" --body "Implements PLAN_plinko_audit_fixes.md

## Changes
- Change calculate_multiplier to return Result<f64, String> for explicit error handling
- Remove unused sha2 dependency
- Update all callers to handle Result type

## Security Audit Summary
- Randomness: SECURE (IC VRF, no fallback)
- House Edge: VERIFIED (exactly 1%)
- Formula: CORRECT (symmetric, transparent)

Deployed to mainnet:
- Plinko Backend: weupr-2qaaa-aaaap-abl3q-cai"
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

**Branch:** `feature/plinko-audit-fixes`
**Worktree:** `/home/theseus/alexandria/openhouse-plinko-audit`

---

# Implementation Plan: Plinko Backend Security Audit Fixes

## Background

A security audit of `plinko_backend/src/lib.rs` identified the following issues:

| Issue | Severity | Current Behavior | Fix |
|-------|----------|------------------|-----|
| Silent 0.0 for invalid position | MEDIUM | Returns 0.0 for position > 8 | Return `Result<f64, String>` |
| Unused sha2 dependency | LOW | Included but never used | Remove from Cargo.toml |

## Current State

### File: `plinko_backend/src/lib.rs`

**Lines 199-213** - Current calculate_multiplier:
```rust
pub fn calculate_multiplier(position: u8) -> f64 {
    // Validate position
    if position > 8 {
        return 0.0; // Invalid position  <-- SILENT FAILURE
    }

    // Pure mathematical formula
    let k = position as f64;
    let center = 4.0;
    let distance = (k - center).abs();
    let normalized = distance / 4.0;

    0.2 + 6.32 * normalized * normalized
}
```

**Callers that need updating:**
- Line 87: `drop_ball()` - `let multiplier = calculate_multiplier(final_position);`
- Line 134: `drop_multiple_balls()` - `let multiplier = calculate_multiplier(final_position);`
- Line 164: `get_multipliers()` - `(0..=8).map(calculate_multiplier).collect()`
- Line 186: `get_expected_value()` - `let multiplier = calculate_multiplier(pos as u8);`

### File: `plinko_backend/Cargo.toml`

**Line 13** - Unused dependency:
```toml
sha2 = "0.10"  # NOT USED ANYWHERE
```

---

## Implementation

### Task 1: Fix calculate_multiplier return type

**File:** `plinko_backend/src/lib.rs`

**Change lines 192-213:**
```rust
// BEFORE
/// Calculate multiplier using pure mathematical formula
/// M(k) = 0.2 + 6.32 × ((k - 4) / 4)²
pub fn calculate_multiplier(position: u8) -> f64 {
    if position > 8 {
        return 0.0;
    }
    let k = position as f64;
    let center = 4.0;
    let distance = (k - center).abs();
    let normalized = distance / 4.0;
    0.2 + 6.32 * normalized * normalized
}

// AFTER
/// Calculate multiplier using pure mathematical formula
/// M(k) = 0.2 + 6.32 × ((k - 4) / 4)²
///
/// Returns error for invalid positions (must be 0-8 for 8-row board)
pub fn calculate_multiplier(position: u8) -> Result<f64, String> {
    if position > 8 {
        return Err(format!("Invalid position {}: must be 0-8 for 8-row board", position));
    }
    let k = position as f64;
    let center = 4.0;
    let distance = (k - center).abs();
    let normalized = distance / 4.0;
    Ok(0.2 + 6.32 * normalized * normalized)
}
```

### Task 2: Update drop_ball() caller

**File:** `plinko_backend/src/lib.rs`

**Change line 87:**
```rust
// BEFORE
let multiplier = calculate_multiplier(final_position);

// AFTER
let multiplier = calculate_multiplier(final_position)
    .map_err(|e| format!("Multiplier calculation failed: {}", e))?;
```

### Task 3: Update drop_multiple_balls() caller

**File:** `plinko_backend/src/lib.rs`

**Change line 134:**
```rust
// BEFORE
let multiplier = calculate_multiplier(final_position);

// AFTER
let multiplier = calculate_multiplier(final_position)
    .map_err(|e| format!("Multiplier calculation failed for ball {}: {}", i, e))?;
```

### Task 4: Update get_multipliers() caller

**File:** `plinko_backend/src/lib.rs`

**Change lines 162-165:**
```rust
// BEFORE
#[query]
fn get_multipliers() -> Vec<f64> {
    (0..=8).map(calculate_multiplier).collect()
}

// AFTER
#[query]
fn get_multipliers() -> Vec<f64> {
    (0..=8)
        .map(|pos| calculate_multiplier(pos).unwrap_or(0.0))
        .collect()
}
```

**Note:** Using `unwrap_or(0.0)` here is safe because we're iterating 0..=8 which is always valid. The fallback is defensive only.

### Task 5: Update get_expected_value() caller

**File:** `plinko_backend/src/lib.rs`

**Change line 186:**
```rust
// BEFORE
let multiplier = calculate_multiplier(pos as u8);

// AFTER
let multiplier = calculate_multiplier(pos as u8).unwrap_or(0.0);
```

**Note:** Same defensive pattern - 0..=8 iteration is always valid.

### Task 6: Update tests

**File:** `plinko_backend/src/lib.rs`

**Change test at line 239-246:**
```rust
// BEFORE
let calculated = calculate_multiplier(pos as u8);

// AFTER
let calculated = calculate_multiplier(pos as u8)
    .expect("Valid position should not fail");
```

**Change test at line 275-276:**
```rust
// BEFORE
let left = calculate_multiplier(i);
let right = calculate_multiplier(8 - i);

// AFTER
let left = calculate_multiplier(i).expect("Valid position");
let right = calculate_multiplier(8 - i).expect("Valid position");
```

**Add new test for error case:**
```rust
#[test]
fn test_invalid_position_returns_error() {
    assert!(calculate_multiplier(9).is_err());
    assert!(calculate_multiplier(255).is_err());

    let err = calculate_multiplier(9).unwrap_err();
    assert!(err.contains("Invalid position"));
}
```

### Task 7: Remove unused sha2 dependency

**File:** `plinko_backend/Cargo.toml`

**Change lines 9-14:**
```toml
# BEFORE
[dependencies]
candid = "0.10"
ic-cdk = "0.19"
serde = { version = "1.0", features = ["derive"] }
sha2 = "0.10"

# AFTER
[dependencies]
candid = "0.10"
ic-cdk = "0.19"
serde = { version = "1.0", features = ["derive"] }
```

---

## Verification

After implementation, run:

```bash
# Build check
cargo build -p plinko_backend --target wasm32-unknown-unknown --release

# Run tests
cargo test -p plinko_backend

# Expected test output should include:
# - test_exact_multipliers ... ok
# - test_expected_value_exactly_point_99 ... ok
# - test_invalid_position_returns_error ... ok
```

---

## Files Modified

| File | Lines Changed | Change Type |
|------|---------------|-------------|
| `plinko_backend/src/lib.rs` | ~30 | Modify |
| `plinko_backend/Cargo.toml` | 1 | Remove line |

---

## Agent Discretion: Additional Improvements

**IMPORTANT:** If you identify any additional efficiencies, security improvements, or code quality enhancements that are not listed in this plan, you are encouraged to implement them. Document any additional changes in your commit message and PR description.

Examples of things to look for:
- Other unused dependencies
- Redundant code that could be simplified
- Additional edge cases that should be handled
- Documentation improvements
- Any other patterns from the security audit that weren't captured here

Use your judgment - if it improves the codebase without breaking functionality, include it.

---

## Deployment Notes

- **Canister:** `weupr-2qaaa-aaaap-abl3q-cai` (Plinko Backend)
- **Network:** Mainnet only
- **Impact:** None - these are internal improvements, API unchanged
