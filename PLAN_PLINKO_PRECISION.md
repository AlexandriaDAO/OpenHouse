# 🤖 AUTONOMOUS PR ORCHESTRATOR - DO NOT SKIP

**You are an autonomous PR orchestrator. Your ONLY job is to implement this plan and create a PR.**

## Isolation Check (RUN FIRST)
```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
if [ "$REPO_ROOT" = "/home/theseus/alexandria/openhouse" ]; then
    echo "❌ FATAL: In main repo. Must be in worktree."
    echo "Worktree: /home/theseus/alexandria/openhouse-plinko-precision"
    exit 1
fi
echo "✅ In isolated worktree: $REPO_ROOT"
```

## Your Autonomous Workflow (NO QUESTIONS ALLOWED)
1. **Verify isolation** - You must be in worktree: `/home/theseus/alexandria/openhouse-plinko-precision`
2. **Implement feature** - Follow plan sections below
3. **Build & Deploy to Mainnet**:
   ```bash
   # Build plinko backend
   cargo build --target wasm32-unknown-unknown --release

   # Deploy to mainnet
   ./deploy.sh --plinko-only
   ```

4. **Verify deployment**:
   ```bash
   # Test the multipliers query
   dfx canister --network ic call weupr-2qaaa-aaaap-abl3q-cai get_multipliers_bp
   dfx canister --network ic call weupr-2qaaa-aaaap-abl3q-cai get_expected_value

   # Verify expected value is still 0.99
   ```

5. **Create PR** (MANDATORY):
   ```bash
   git add .
   git commit -m "refactor(plinko): integer-precision multipliers for DeFi readiness"
   git push -u origin feature/plinko-precision
   gh pr create --title "Plinko: Integer-Precision Multipliers" --body "$(cat <<'EOF'
## Summary
- Converts floating-point multipliers to basis-point integers (10000 = 1.0x)
- Eliminates floating-point rounding errors for DeFi integration
- Extracts magic numbers into named constants
- Maintains backward compatibility with f64 getters

## Test plan
- [ ] `get_multipliers_bp()` returns correct integer values
- [ ] `get_multipliers()` still works (f64, for backward compat)
- [ ] `get_expected_value()` still returns 0.99
- [ ] `drop_ball()` returns correct results
- [ ] All existing tests pass

🤖 Generated with [Claude Code](https://claude.com/claude-code)
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
- ❌ NO questions ("should I?", "want me to?", "is it done?")
- ❌ NO skipping PR creation - it's MANDATORY
- ❌ NO stopping after implementation - create PR immediately
- ⚠️ MAINNET DEPLOYMENT: All changes go directly to production
- ✅ After sleep: IMMEDIATELY continue (no pause)
- ✅ ONLY stop at: approved, max iterations, or error

**Branch:** `feature/plinko-precision`
**Worktree:** `/home/theseus/alexandria/openhouse-plinko-precision`

---

# Implementation Plan: Integer-Precision Multipliers

## Task Classification
**REFACTORING** - Improve existing code for DeFi readiness without changing game behavior.

## Current State

**File:** `plinko_backend/src/lib.rs` (478 lines)

### Current Multiplier Calculation (lines 197-215)
```rust
pub fn calculate_multiplier(position: u8) -> Result<f64, String> {
    if position > 8 {
        return Err(format!("Invalid position {}: must be 0-8 for 8-row board", position));
    }
    let k = position as f64;
    let center = 4.0;                          // MAGIC NUMBER
    let distance = (k - center).abs();
    let normalized = distance / 4.0;           // MAGIC NUMBER (derived from rows)
    Ok(0.2 + 6.32 * normalized * normalized)   // MAGIC NUMBERS
}
```

**Problems:**
1. Magic numbers `4.0`, `0.2`, `6.32` are hardcoded
2. Uses f64 which causes precision loss in financial calculations
3. `get_multipliers()` (line 166-170) silently swallows errors with `unwrap_or(0.0)`

### Current Multiplier Values (f64)
| Position | Multiplier | Binomial Coeff | Probability |
|----------|------------|----------------|-------------|
| 0        | 6.52       | 1              | 1/256       |
| 1        | 3.755      | 8              | 8/256       |
| 2        | 1.78       | 28             | 28/256      |
| 3        | 0.595      | 56             | 56/256      |
| 4        | 0.2        | 70             | 70/256      |
| 5        | 0.595      | 56             | 56/256      |
| 6        | 1.78       | 28             | 28/256      |
| 7        | 3.755      | 8              | 8/256       |
| 8        | 6.52       | 1              | 1/256       |

### Mathematical Derivation for Integer Formula

Current formula: `M(k) = 0.2 + 6.32 × ((k - 4) / 4)²`

Rewrite for integers:
- Let `d = |k - 4|` (distance from center)
- `((k - 4) / 4)² = d² / 16`
- `M(k) = 0.2 + 6.32 × d² / 16`
- `M(k) = 0.2 + 0.395 × d²`

Scale by 10,000 (basis points):
- `M_bp(k) = 2000 + 3950 × d²`

**Verification:**
| Position | d   | d²  | 3950×d² | Result BP | As f64  |
|----------|-----|-----|---------|-----------|---------|
| 0        | 4   | 16  | 63200   | 65200     | 6.52    |
| 1        | 3   | 9   | 35550   | 37550     | 3.755   |
| 2        | 2   | 4   | 15800   | 17800     | 1.78    |
| 3        | 1   | 1   | 3950    | 5950      | 0.595   |
| 4        | 0   | 0   | 0       | 2000      | 0.2     |

This is **exact** - no floating point involved.

---

## Implementation

### 1. Add Constants Block (NEW - after line 24)

```rust
// PSEUDOCODE

/// Multiplier precision: 10000 basis points = 1.0x multiplier
/// Example: 65200 BP = 6.52x, 2000 BP = 0.2x
pub const MULTIPLIER_SCALE: u64 = 10_000;

/// Number of rows in the Plinko board (fixed configuration)
pub const ROWS: u8 = 8;

/// Number of possible final positions (0 to ROWS inclusive)
pub const NUM_POSITIONS: u8 = ROWS + 1;

/// Center position of the board
pub const CENTER_POSITION: u8 = ROWS / 2;

/// Minimum multiplier in basis points (center position = highest loss)
/// 2000 BP = 0.2x (80% loss at most probable position)
pub const MIN_MULTIPLIER_BP: u64 = 2_000;

/// Quadratic scaling factor in basis points
/// Derived: 6.32 * 10000 / 16 = 3950
/// This achieves exactly 0.99 expected value (1% house edge)
pub const QUADRATIC_FACTOR_BP: u64 = 3_950;

/// Binomial coefficients for 8 rows (Pascal's triangle row 8)
/// Used for probability calculations and EV verification
pub const BINOMIAL_COEFFICIENTS: [u64; 9] = [1, 8, 28, 56, 70, 56, 28, 8, 1];

/// Total paths through 8-row board (2^8 = 256)
pub const TOTAL_PATHS: u64 = 256;
```

### 2. Add Integer Multiplier Function (NEW)

```rust
// PSEUDOCODE

/// Calculate multiplier in basis points using pure integer arithmetic.
/// Returns multiplier scaled by MULTIPLIER_SCALE (10000).
///
/// Formula: M_bp(k) = MIN_MULTIPLIER_BP + QUADRATIC_FACTOR_BP × d²
/// Where d = |k - CENTER_POSITION|
///
/// Example: position 0 → 65200 BP (6.52x)
pub fn calculate_multiplier_bp(position: u8) -> Result<u64, String> {
    if position > ROWS {
        return Err(format!(
            "Invalid position {}: must be 0-{} for {}-row board",
            position, ROWS, ROWS
        ));
    }

    // Distance from center (0-4 for 8-row board)
    let distance = if position > CENTER_POSITION {
        position - CENTER_POSITION
    } else {
        CENTER_POSITION - position
    } as u64;

    // Pure integer formula: no floating point
    let distance_squared = distance * distance;
    Ok(MIN_MULTIPLIER_BP + QUADRATIC_FACTOR_BP * distance_squared)
}
```

### 3. Refactor Existing f64 Function (MODIFY lines 197-215)

```rust
// PSEUDOCODE

/// Calculate multiplier as f64 (for backward compatibility).
/// Delegates to integer function and converts.
///
/// DEPRECATED: Use calculate_multiplier_bp() for financial calculations.
pub fn calculate_multiplier(position: u8) -> Result<f64, String> {
    let bp = calculate_multiplier_bp(position)?;
    Ok(bp as f64 / MULTIPLIER_SCALE as f64)
}
```

### 4. Add New Query for Basis Point Multipliers (NEW)

```rust
// PSEUDOCODE

/// Get all multipliers in basis points for positions 0-8.
/// Returns exactly 9 values. Panics on invalid state (should never happen).
#[query]
fn get_multipliers_bp() -> Vec<u64> {
    (0..=ROWS)
        .map(|pos| {
            calculate_multiplier_bp(pos)
                .expect("Position 0-8 should always be valid")
        })
        .collect()
}
```

### 5. Fix get_multipliers() Error Handling (MODIFY lines 163-170)

```rust
// PSEUDOCODE

/// Get all multipliers as f64 for display (backward compatible).
/// Returns exactly 9 values.
#[query]
fn get_multipliers() -> Vec<f64> {
    (0..=ROWS)
        .map(|pos| {
            calculate_multiplier(pos)
                .expect("Position 0-8 should always be valid")
        })
        .collect()
}
```

### 6. Update get_formula() to Use Constants (MODIFY lines 172-177)

```rust
// PSEUDOCODE

/// Get the mathematical formula as a string.
/// Generated from constants to stay in sync with implementation.
#[query]
fn get_formula() -> String {
    format!(
        "M(k) = {} + {} × ((k - {}) / {})² [scale: {} BP = 1.0x]",
        MIN_MULTIPLIER_BP as f64 / MULTIPLIER_SCALE as f64,  // 0.2
        QUADRATIC_FACTOR_BP as f64 * 16.0 / MULTIPLIER_SCALE as f64,  // 6.32
        CENTER_POSITION,  // 4
        CENTER_POSITION,  // 4
        MULTIPLIER_SCALE  // 10000
    )
}
```

### 7. Update drop_ball() to Use Constants (MODIFY lines 66-98)

Replace hardcoded `ROWS: u8 = 8` with the module-level constant.

```rust
// PSEUDOCODE - line 67 changes from:
const ROWS: u8 = 8;
// to just using the module-level ROWS constant (delete this line)
```

### 8. Update drop_multiple_balls() Similarly (MODIFY lines 102-159)

Replace hardcoded `ROWS: u8 = 8` with module-level constant.

### 9. Update get_expected_value() to Use Constants (MODIFY lines 179-195)

```rust
// PSEUDOCODE

#[query]
fn get_expected_value() -> f64 {
    BINOMIAL_COEFFICIENTS.iter()
        .enumerate()
        .map(|(pos, &coeff)| {
            let probability = coeff as f64 / TOTAL_PATHS as f64;
            let multiplier = calculate_multiplier(pos as u8).unwrap_or(0.0);
            probability * multiplier
        })
        .sum()
}
```

### 10. Update Tests to Use Constants and Test Integer Function

Add to `mod tests`:

```rust
// PSEUDOCODE

#[test]
fn test_exact_multipliers_bp() {
    // Integer basis point values - no floating point tolerance needed
    let expected_bp: [u64; 9] = [65200, 37550, 17800, 5950, 2000, 5950, 17800, 37550, 65200];

    for (pos, &expected) in expected_bp.iter().enumerate() {
        let calculated = calculate_multiplier_bp(pos as u8).expect("Valid position");
        assert_eq!(
            calculated, expected,
            "Position {}: expected {} BP, got {} BP",
            pos, expected, calculated
        );
    }
}

#[test]
fn test_bp_to_f64_conversion_matches() {
    // Verify integer and float functions agree
    for pos in 0..=ROWS {
        let bp = calculate_multiplier_bp(pos).expect("Valid");
        let f64_val = calculate_multiplier(pos).expect("Valid");
        let converted = bp as f64 / MULTIPLIER_SCALE as f64;
        assert!(
            (f64_val - converted).abs() < 0.0001,
            "Position {}: f64={} converted={}",
            pos, f64_val, converted
        );
    }
}

#[test]
fn test_constants_consistency() {
    // Verify constants are internally consistent
    assert_eq!(NUM_POSITIONS as usize, BINOMIAL_COEFFICIENTS.len());
    assert_eq!(TOTAL_PATHS, BINOMIAL_COEFFICIENTS.iter().sum::<u64>());
    assert_eq!(CENTER_POSITION, ROWS / 2);
}
```

---

## Files Changed

| File | Change Type | Lines Changed |
|------|-------------|---------------|
| `plinko_backend/src/lib.rs` | MODIFY | ~50 lines added, ~20 lines modified |

## Deployment Notes

- **Affected canister:** `weupr-2qaaa-aaaap-abl3q-cai` (Plinko Backend)
- **Breaking changes:** None - all existing queries still work
- **New queries:** `get_multipliers_bp()` added
- **Behavioral change:** None - same game logic, same payouts

## Verification Commands

```bash
# After deployment, verify:

# 1. New BP query works
dfx canister --network ic call weupr-2qaaa-aaaap-abl3q-cai get_multipliers_bp
# Expected: (vec { 65200; 37550; 17800; 5950; 2000; 5950; 17800; 37550; 65200 })

# 2. Old f64 query still works
dfx canister --network ic call weupr-2qaaa-aaaap-abl3q-cai get_multipliers
# Expected: (vec { 6.52; 3.755; 1.78; 0.595; 0.2; 0.595; 1.78; 3.755; 6.52 })

# 3. Expected value unchanged
dfx canister --network ic call weupr-2qaaa-aaaap-abl3q-cai get_expected_value
# Expected: (0.99 : float64)

# 4. Drop ball still works
dfx canister --network ic call weupr-2qaaa-aaaap-abl3q-cai drop_ball
# Expected: Returns PlinkoResult with valid multiplier
```
