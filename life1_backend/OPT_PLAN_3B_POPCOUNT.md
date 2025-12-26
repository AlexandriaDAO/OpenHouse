# Optimization Plan #3B: Native WASM Popcount

## 1. Summary

Replace individual bit extraction for neighbor counting with WASM's native `i64.popcnt` instruction via Rust's `count_ones()`.

**Key insight:** WASM has native popcount instructions (`i32.popcnt`, `i64.popcnt`) that compile to single instructions. Unlike lookup tables, these require no memory access and have predictable performance on IC's interpreter.

## 2. Benchmark Results (Native x86)

```
=== All bit positions (0-63) ===
Current (8 extractions):     39.23ms  (baseline)
Lookup table:                34.25ms  (87.3%)
count_ones() / popcount:     34.75ms  (88.6%)
Branchless:                  40.50ms  (103.2%)

=== Interior only (bit_pos 1-62, 97% of cells) ===
Current (8 extractions):     42.64ms  (baseline)
count_ones() / popcount:     39.91ms  (93.6%)
```

**Native results:** Popcount is ~11% faster, lookup is ~13% faster.

However, on IC's WASM interpreter:
- **Lookup tables require memory loads** - interpreter overhead for memory access
- **Popcount is a single WASM opcode** - minimal interpreter overhead

**Expected on IC:** Popcount should outperform lookup due to simpler instruction trace.

## 3. WASM Instruction Comparison

### Current Approach (Interior Cell)
```wasm
;; 8x: (local.get $word) (local.get $bit_pos) (i64.shr_u) (i64.const 1) (i64.and) (i32.wrap_i64)
;; 7x: (i32.add)
;; Total: ~24 instructions
```

### Lookup Table Approach (Interior Cell)
```wasm
;; 2x shifts + masks: ~8 instructions
;; 2x memory loads: (i32.load8_u offset=...) - interpreter overhead
;; 4x additions: ~4 instructions
;; Total: ~14 instructions + 2 memory loads
```

### Popcount Approach (Interior Cell)
```wasm
;; 3x: (local.get $word) (local.get $shift) (i64.shr_u) (i64.const 7) (i64.and) (i64.popcnt) (i32.wrap_i64)
;; 2x: (i32.add)
;; Total: ~11 instructions, NO memory access
```

## 4. Implementation

### 4a. Core Function

```rust
#[inline(always)]
fn count_neighbors_popcount(
    bit_pos: usize,
    above: u64, same: u64, below: u64,
    left_above: u64, left_same: u64, left_below: u64,
    right_above: u64, right_same: u64, right_below: u64,
) -> u8 {
    if bit_pos == 0 {
        // Left edge: combine bits from left_* words and main words
        let above_bits = ((left_above >> 63) & 1) | ((above & 0b11) << 1);
        let same_bits = ((left_same >> 63) & 1) | (((same >> 1) & 1) << 2);
        let below_bits = ((left_below >> 63) & 1) | ((below & 0b11) << 1);
        (above_bits.count_ones() + same_bits.count_ones() + below_bits.count_ones()) as u8
    } else if bit_pos == 63 {
        // Right edge: combine bits from main words and right_* words
        let above_bits = ((above >> 62) & 0b11) | ((right_above & 1) << 2);
        let same_bits = ((same >> 62) & 1) | ((right_same & 1) << 2);
        let below_bits = ((below >> 62) & 0b11) | ((right_below & 1) << 2);
        (above_bits.count_ones() + same_bits.count_ones() + below_bits.count_ones()) as u8
    } else {
        // Interior: all neighbors in the 3 main words
        let shift = bit_pos - 1;
        let above_3 = (above >> shift) & 0b111;  // 3 bits from above row
        let below_3 = (below >> shift) & 0b111;  // 3 bits from below row
        let same_2 = (same >> shift) & 0b101;    // 2 bits from same row (exclude center)
        (above_3.count_ones() + same_2.count_ones() + below_3.count_ones()) as u8
    }
}
```

### 4b. Integration with compute_cell_fate

```rust
fn compute_cell_fate(
    bit_pos: usize,
    above: u64, same: u64, below: u64,
    left_above: u64, left_same: u64, left_below: u64,
    right_above: u64, right_same: u64, right_below: u64,
    cell_idx: usize,
) -> CellFate {
    let currently_alive = (same >> bit_pos) & 1 == 1;

    // Fast path: use popcount for neighbor count
    let alive_count = count_neighbors_popcount(
        bit_pos, above, same, below,
        left_above, left_same, left_below,
        right_above, right_same, right_below,
    );

    match (currently_alive, alive_count) {
        (true, 2) | (true, 3) => CellFate::Survives,
        (false, 3) => {
            // Birth: need individual bits for ownership determination
            // This is the slow path, but births are minority of processed cells
            let (x, y) = idx_to_coords(cell_idx);
            let (nw, n, ne, w, e, sw, s, se) = extract_neighbor_bits(
                bit_pos, above, same, below,
                left_above, left_same, left_below,
                right_above, right_same, right_below,
            );
            let owner = find_birth_owner(x, y, nw, n, ne, w, e, sw, s, se, cell_idx);
            CellFate::Birth(owner)
        }
        (true, _) => CellFate::Death,
        (false, _) => CellFate::StaysDead,
    }
}

/// Extracts individual neighbor bits (needed only for births)
#[inline(always)]
fn extract_neighbor_bits(
    bit_pos: usize,
    above: u64, same: u64, below: u64,
    left_above: u64, left_same: u64, left_below: u64,
    right_above: u64, right_same: u64, right_below: u64,
) -> (u8, u8, u8, u8, u8, u8, u8, u8) {
    if bit_pos == 0 {
        (
            ((left_above >> 63) & 1) as u8,
            ((above >> 0) & 1) as u8,
            ((above >> 1) & 1) as u8,
            ((left_same >> 63) & 1) as u8,
            ((same >> 1) & 1) as u8,
            ((left_below >> 63) & 1) as u8,
            ((below >> 0) & 1) as u8,
            ((below >> 1) & 1) as u8,
        )
    } else if bit_pos == 63 {
        (
            ((above >> 62) & 1) as u8,
            ((above >> 63) & 1) as u8,
            ((right_above >> 0) & 1) as u8,
            ((same >> 62) & 1) as u8,
            ((right_same >> 0) & 1) as u8,
            ((below >> 62) & 1) as u8,
            ((below >> 63) & 1) as u8,
            ((right_below >> 0) & 1) as u8,
        )
    } else {
        (
            ((above >> (bit_pos - 1)) & 1) as u8,
            ((above >> bit_pos) & 1) as u8,
            ((above >> (bit_pos + 1)) & 1) as u8,
            ((same >> (bit_pos - 1)) & 1) as u8,
            ((same >> (bit_pos + 1)) & 1) as u8,
            ((below >> (bit_pos - 1)) & 1) as u8,
            ((below >> bit_pos) & 1) as u8,
            ((below >> (bit_pos + 1)) & 1) as u8,
        )
    }
}
```

## 5. Expected Impact

### Operation Count

| Approach | Interior Ops | Memory Access | WASM Instructions |
|----------|-------------|---------------|-------------------|
| Current | ~31 | 0 | ~24 |
| Lookup | ~14 | 2 loads | ~14 + mem overhead |
| **Popcount** | ~11 | **0** | **~11** |

### Cell Fate Distribution

Typical game state (~164 alive cells, ~1,476 potential cells):

| Fate | % of Cells | Popcount Path | Bit Extract Path |
|------|-----------|---------------|------------------|
| StaysDead | ~85% | ✓ Fast | ✗ Skip |
| Survives | ~10% | ✓ Fast | ✗ Skip |
| Death | ~3% | ✓ Fast | ✗ Skip |
| **Birth** | **~2%** | ✓ Fast | ✓ Needed |

**Only ~2% of cells need individual bit extraction (births).**

### Estimated Savings

From benchmark data:
- `compute_fates`: 309,600 instructions/gen
- Neighbor counting: ~19-29% of that = ~59,000-90,000 instr/gen
- With popcount (~55% reduction in counting): ~32,000-49,000 saved
- **Net reduction in compute_fates: ~10-16%**

Daily savings (864,000 generations):
- Conservative: 27.6B instructions
- Optimistic: 42.3B instructions
- **As % of total daily: ~6-9%**

## 6. Advantages Over Lookup Table (OPT_PLAN_3)

| Metric | Lookup Table | Popcount |
|--------|-------------|----------|
| Memory access | 2 loads/cell | **0** |
| Code size | +static arrays | **Minimal** |
| WASM support | Memory ops | **Native opcode** |
| IC interpreter | Mem load overhead | **Optimized** |
| Edge handling | Same complexity | Same |
| Birth handling | Same cost | Same |

## 7. Risks

### Low Risk
- **Correctness:** Popcount is mathematically identical to individual counting
- **Rollback:** Pure algorithmic change, git revert

### Medium Risk
- **IC-specific behavior:** IC's interpreter may handle popcnt differently than expected
- **Mitigation:** A/B benchmark on IC before full commit

### Addressed from Original Plan
- **Birth double-extraction:** Accepted; only ~2% of cells affected
- **Edge cases:** Still handled separately (3.125% of cells)

## 8. Testing Requirements

1. **Unit tests:** All 64 bit positions with various patterns
2. **Pattern tests:** Glider, blinker, R-pentomino
3. **Edge tests:** Cells at x=0, x=511, y=0, y=511, corners
4. **IC benchmark:** Deploy, reset benchmarks, compare `compute_fates` average

### Verification Test

```rust
#[test]
fn test_popcount_matches_current() {
    for bit_pos in 0..64 {
        for pattern in [0u64, !0u64, 0xAAAAAAAAAAAAAAAA, 0x5555555555555555] {
            let current = count_neighbors_current(bit_pos, pattern, pattern, pattern, ...);
            let popcount = count_neighbors_popcount(bit_pos, pattern, pattern, pattern, ...);
            assert_eq!(current, popcount, "bit_pos={}, pattern={:#x}", bit_pos, pattern);
        }
    }
}
```

## 9. IC Benchmark Protocol

```bash
# Before deployment
dfx canister --network ic call life1_backend get_benchmark_report

# Deploy with popcount optimization
dfx canister --network ic install life1_backend --mode upgrade

# Reset benchmarks
dfx canister --network ic call life1_backend reset_benchmarks

# Wait 2-4 hours for similar activity
# Check results
dfx canister --network ic call life1_backend get_benchmark_report
```

**Expected compute_fates improvement:**
- Optimistic: ~260,000 instr/gen (16% reduction)
- Realistic: ~280,000 instr/gen (10% reduction)
- Pessimistic: ~300,000+ instr/gen (no improvement)

## 10. Implementation Checklist

- [x] Add `count_neighbors_popcount()` function
- [x] Add `extract_neighbor_bits()` function
- [x] Modify `compute_cell_fate()` to use popcount for counting
- [x] Add unit tests for all bit positions
- [ ] Run local benchmark (neighbor_bench.rs)
- [ ] Deploy to IC
- [ ] Reset benchmarks and measure
- [ ] Compare results to baseline
- [ ] Document final performance delta
