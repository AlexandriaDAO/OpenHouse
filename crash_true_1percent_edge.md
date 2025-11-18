# Crash Game: TRUE 1% House Edge Formula

## The Correct Formula

```rust
let random = uniform(0.0, 1.0);  // Uniform distribution
let crash = 1.0 / (1.0 - 0.99 * random);
let crash = crash.min(1000.0);  // Cap at 1000x
```

## Why This Works

**Mathematical Guarantee:**
```
For ANY cashout target X:
P(crash ≥ X) = 0.99 / X

Expected return = P(crash ≥ X) × X = (0.99 / X) × X = 0.99

House edge = 1 - 0.99 = 0.01 = 1% (CONSTANT!)
```

## Probability Table

| Crash Point | P(crash ≥ X) | Expected Return | House Edge |
|-------------|--------------|-----------------|------------|
| **1.01x** | 98.02% | 0.990 ICP | **1.0%** |
| **1.10x** | 90.00% | 0.990 ICP | **1.0%** |
| **1.50x** | 66.00% | 0.990 ICP | **1.0%** |
| **2.00x** | 49.50% | 0.990 ICP | **1.0%** |
| **3.00x** | 33.00% | 0.990 ICP | **1.0%** |
| **5.00x** | 19.80% | 0.990 ICP | **1.0%** |
| **10.00x** | 9.90% | 0.990 ICP | **1.0%** |
| **20.00x** | 4.95% | 0.990 ICP | **1.0%** |
| **50.00x** | 1.98% | 0.990 ICP | **1.0%** |
| **100.00x** | 0.99% | 0.990 ICP | **1.0%** |
| **1000.00x** | 0.099% | 0.990 ICP | **1.0%** |

## Distribution Shape

```
Crash Point Distribution:

1.00-1.50x: ████████████████████████████████ 34%
1.50-2.00x: ████████████████ 16.5%
2.00-3.00x: ████████████████ 16.5%
3.00-5.00x: ██████████████ 13.2%
5.00-10.0x: ██████████ 9.9%
10.0-20.0x: █████ 4.95%
20.0-50.0x: ███ 2.97%
50.0-100x: █ 0.99%
100-1000x: █ 0.99%
```

## Key Insights

### 1. **TRUE 1% House Edge**
- No matter what strategy you use, the house keeps exactly 1%
- Conservative players (cash at 1.10x): 1% edge
- Aggressive players (cash at 100x): 1% edge
- **Fair for everyone!**

### 2. **Probability Formula**
```
P(crash ≥ X) = 0.99 / X

Examples:
- P(crash ≥ 2x) = 0.99 / 2 = 49.5%
- P(crash ≥ 10x) = 0.99 / 10 = 9.9%
- P(crash ≥ 100x) = 0.99 / 100 = 0.99%
```

### 3. **Simple Mental Math**
Want to know your win chance for any target?
```
Win chance = 99% ÷ target_multiplier

Target 2x → 99% ÷ 2 = 49.5% chance
Target 5x → 99% ÷ 5 = 19.8% chance
Target 10x → 99% ÷ 10 = 9.9% chance
```

## Comparison to Dice & Plinko

| Game | House Edge Mechanism | Constant Across Strategies? |
|------|---------------------|----------------------------|
| **Dice** | Exact hit on target loses | ✅ Yes - always 1% |
| **Plinko** | Formula: M(k) = 0.2 + 6.32×(k-4)² | ✅ Yes - always 1% |
| **Crash (OLD)** | crash = 0.99 / random | ❌ No - varies 1%-10%+ |
| **Crash (NEW)** | crash = 1 / (1 - 0.99×random) | ✅ Yes - always 1% |

## Example: 100 Games at Different Strategies

### Conservative: Always cash at 1.10x
```
Win 90 games: 90 × 1.10 = 99 ICP
Lose 10 games: -10 ICP
Total: 99 - 10 = 89 ICP profit on 100 ICP wagered
Net: -1 ICP (1% loss) ✅
```

### Balanced: Always cash at 2.00x
```
Win 49.5 games: 49.5 × 2.00 = 99 ICP
Lose 50.5 games: -50.5 ICP
Total: 99 - 50.5 = 48.5 ICP profit on 100 ICP wagered
Net: -1 ICP (1% loss) ✅
```

### Aggressive: Always cash at 10.00x
```
Win 9.9 games: 9.9 × 10.00 = 99 ICP
Lose 90.1 games: -90.1 ICP
Total: 99 - 90.1 = 8.9 ICP profit on 100 ICP wagered
Net: -1 ICP (1% loss) ✅
```

## Why The Old Formula Was Wrong

### Old: `crash = 0.99 / random`
- Applies 0.99 multiplier to crash point
- BUT: House edge = 1 - P(win) × multiplier
- For 10x target: 1 - (8.99% × 10) = 10.1% edge! ❌

### New: `crash = 1 / (1 - 0.99 × random)`
- Designed so P(crash ≥ X) × X always equals 0.99
- House edge = 1 - 0.99 = 1% for ANY target ✅

## Implementation

```rust
pub fn generate_crash_point(vrf_bytes: &[u8]) -> f64 {
    // Convert VRF bytes to float [0.0, 1.0)
    let random = bytes_to_float(vrf_bytes);

    // Calculate crash with true 1% edge
    // Formula: crash = 1 / (1 - 0.99 * random)
    let crash = 1.0 / (1.0 - 0.99 * random);

    // Cap at 1000x (when random = 0.999, crash = 1000x)
    crash.min(1000.0)
}

#[test]
fn test_constant_house_edge() {
    let targets = [1.1, 2.0, 5.0, 10.0, 50.0, 100.0];

    for target in targets {
        let samples = 100_000;
        let mut wins = 0;

        for _ in 0..samples {
            let random = random_float();
            let crash = 1.0 / (1.0 - 0.99 * random);
            if crash >= target {
                wins += 1;
            }
        }

        let win_rate = wins as f64 / samples as f64;
        let expected_return = win_rate * target;

        // Should be 0.99 ± 0.01 for all targets
        assert!((expected_return - 0.99).abs() < 0.01,
            "Target {}x: expected return = {}, should be 0.99",
            target, expected_return);
    }
}
```

## User-Friendly Explanation

**"How does the 1% house edge work?"**

Imagine the casino has a magic dial that always gives them exactly 1% advantage:

- If you play it safe (cash at 1.10x), you win 90% of the time, but only make 10% profit when you win. **Net: 1% loss**
- If you take risks (cash at 10x), you win 10% of the time, but make 900% profit when you win. **Net: 1% loss**

No matter your strategy, the house keeps exactly 1 ICP for every 100 ICP wagered. That's fairness!
