# Crash Game Probability Distribution Analysis

## Formula
```rust
let random = uniform(0.01, 1.00);  // Uniform distribution
let crash_multiplier = 0.99 / random;
```

## Probability Table: "What are the chances the crash is AT LEAST X?"

| Crash Point | Probability (≥ X) | Odds | Meaning |
|-------------|------------------|------|---------|
| **0.99x** | 100.00% | 1 in 1 | Minimum possible crash |
| **1.00x** | 98.99% | ~1 in 1 | Almost always reaches 1.00x |
| **1.10x** | 89.90% | ~9 in 10 | Very common |
| **1.20x** | 81.82% | ~4 in 5 | Very common |
| **1.50x** | 65.66% | ~2 in 3 | Common |
| **2.00x** | 48.99% | ~1 in 2 | **50/50 chance** |
| **2.50x** | 38.79% | ~2 in 5 | Moderate |
| **3.00x** | 32.32% | ~1 in 3 | Moderate |
| **4.00x** | 23.99% | ~1 in 4 | Less common |
| **5.00x** | 18.99% | ~1 in 5 | Less common |
| **10.00x** | 8.99% | ~1 in 11 | Rare |
| **20.00x** | 4.44% | ~1 in 23 | Very rare |
| **50.00x** | 0.99% | ~1 in 100 | Extremely rare |
| **99.00x** | 0.00% | 1 in ∞ | Maximum possible crash |

## Key Insights

### 1. **Median Crash Point: ~2.00x**
- 50% of games crash below 2.00x
- 50% of games crash above 2.00x

### 2. **Common Ranges**

| Range | Probability | How Often |
|-------|-------------|-----------|
| 0.99x - 1.50x | 34.34% | **1 in 3 games** |
| 1.50x - 3.00x | 33.34% | **1 in 3 games** |
| 3.00x - 10.00x | 23.33% | **1 in 4 games** |
| 10.00x - 99.00x | 8.99% | **1 in 11 games** |

### 3. **Probability of Reaching Popular Cashout Points**

| If you cash out at... | Chance of winning | Expected return per 1 ICP bet |
|----------------------|-------------------|-------------------------------|
| 1.10x | 89.90% | 0.989 ICP (1.1% loss)* |
| 1.50x | 65.66% | 0.985 ICP (1.5% loss) |
| 2.00x | 48.99% | 0.980 ICP (2.0% loss) |
| 3.00x | 32.32% | 0.970 ICP (3.0% loss) |
| 5.00x | 18.99% | 0.950 ICP (5.0% loss) |
| 10.00x | 8.99% | 0.899 ICP (10.1% loss) |

*The loss increases as you aim for higher multipliers due to compounding with the 1% house edge.

## Distribution Visualization (Text)

```
Crash Point Distribution (each █ = ~2% probability)

0.99-1.50x: █████████████████ (34%)
1.50-2.00x: ████████ (17%)
2.00-3.00x: ████████ (16%)
3.00-5.00x: ███████ (14%)
5.00-10.00x: █████ (10%)
10.0-20.0x: ██ (4%)
20.0-50.0x: ██ (4%)
50.0-99.0x: ▌ (1%)
```

## Mathematical Properties

### Probability Density Function (PDF)
```
f(x) = 0.99 / (x² × 0.99) = 1 / x²
```

This is a **power law distribution** (also called Pareto distribution).

### Cumulative Distribution Function (CDF)
```
P(crash ≥ x) = (0.99/x - 0.01) / 0.99
P(crash ≤ x) = 1 - P(crash ≥ x)
```

### Expected Value
```
E[crash] = ∫[0.99 to 99] (1/x²) × x dx
         = ∫[0.99 to 99] (1/x) dx
         = ln(99) - ln(0.99)
         = ln(100)
         ≈ 4.605
```

**But wait!** This seems high. Let me recalculate...

Actually, for the truncated distribution with random ∈ [0.01, 1.00]:
```
E[crash] = ∫[0.01 to 1.00] (0.99/r) × (1/0.99) dr
         = (1/0.99) × 0.99 × ∫[0.01 to 1.00] (1/r) dr
         = ∫[0.01 to 1.00] (1/r) dr
         = ln(1.00) - ln(0.01)
         = 0 - (-4.605)
         = 4.605
```

This means the **average crash point is ~4.60x**, but most games crash much earlier (median is 2.00x). This is characteristic of exponential/power-law distributions.

### Why This Distribution Makes Sense

1. **Feels Fair**: Lots of small wins, rare big wins (like real-world risk/reward)
2. **Exciting**: Always a chance for massive multipliers
3. **Predictable House Edge**: Exactly 1% reduction on every outcome
4. **Natural Distribution**: Follows power law (common in nature/finance)

## Comparison to Other Distributions

### If we used UNIFORM distribution (all crashes equally likely):
```
crash = 0.99 + random × 98.01  // Crashes between 0.99x and 99.00x
```
- P(crash ≥ 2.00x) = 98.0% (too easy!)
- P(crash ≥ 50.00x) = 50.0% (way too common!)
- Would feel unrealistic and boring

### If we used NORMAL distribution:
```
crash = gaussian(mean=5.0, std=2.0) × 0.99
```
- Most crashes cluster around 5.00x
- Very rare to get 1.00x or 50.00x
- Doesn't feel like a "risk" game

### Our EXPONENTIAL distribution:
```
crash = 0.99 / random
```
- ✅ Most games are quick (1-3x)
- ✅ Medium wins fairly common (3-10x)
- ✅ Big wins rare but possible (10-99x)
- ✅ Matches player psychology and real-world risk

## Verification Code

```rust
#[test]
fn test_crash_distribution() {
    let samples = 100_000;
    let mut under_2x = 0;
    let mut under_5x = 0;
    let mut under_10x = 0;
    let mut over_10x = 0;

    for _ in 0..samples {
        let random = random_float(0.01, 1.00);
        let crash = 0.99 / random;

        if crash < 2.0 { under_2x += 1; }
        if crash < 5.0 { under_5x += 1; }
        if crash < 10.0 { under_10x += 1; }
        if crash >= 10.0 { over_10x += 1; }
    }

    // Expected: ~51% under 2x, ~81% under 5x, ~91% under 10x, ~9% over 10x
    assert!((under_2x as f64 / samples as f64 - 0.51).abs() < 0.01);
    assert!((under_5x as f64 / samples as f64 - 0.81).abs() < 0.01);
    assert!((over_10x as f64 / samples as f64 - 0.09).abs() < 0.01);
}
```
