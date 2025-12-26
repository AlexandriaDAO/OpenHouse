# Optimization Plan #3: SIMD-style Neighbor Counting

## 1. Proposal

Replace individual bit extraction for neighbor counting with a lookup table approach that processes 3 bits at a time.

**Current Implementation:**
```rust
// In compute_cell_fate() - 8 individual bit extractions
let (nw, n, ne, w, e, sw, s, se) = if bit_pos == 0 {
    // Left edge case
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
    // Right edge case - similar
} else {
    // Interior - 8 shift+mask operations
    (
        ((above >> (bit_pos - 1)) & 1) as u8,
        ((above >> bit_pos) & 1) as u8,
        ((above >> (bit_pos + 1)) & 1) as u8,
        // ... 5 more ...
    )
};

let alive_count = nw + n + ne + w + e + sw + s + se;  // 7 additions
```

**Proposed Implementation:**
```rust
// Pre-computed popcount for 3-bit and 2-bit patterns
static POPCOUNT_3: [u8; 8] = [0, 1, 1, 2, 1, 2, 2, 3];  // 0b000..0b111
static POPCOUNT_2: [u8; 4] = [0, 1, 1, 2];              // 0b00..0b11

fn count_neighbors_fast(
    bit_pos: usize,
    above: u64, same: u64, below: u64,
    left_above: u64, left_same: u64, left_below: u64,
    right_above: u64, right_same: u64, right_below: u64,
) -> u8 {
    if bit_pos == 0 {
        // Left edge - special handling
        count_neighbors_left_edge(above, same, below, left_above, left_same, left_below)
    } else if bit_pos == 63 {
        // Right edge - special handling
        count_neighbors_right_edge(above, same, below, right_above, right_same, right_below)
    } else {
        // Interior - use lookup tables
        let shift = bit_pos - 1;  // Get 3 bits centered on neighbor columns

        // Extract 3-bit patterns for each row
        let above_3 = ((above >> shift) & 0b111) as usize;
        let below_3 = ((below >> shift) & 0b111) as usize;

        // Same row needs to exclude center bit: mask with 0b101
        let same_2 = (((same >> shift) & 0b101) >> 1 | ((same >> shift) & 0b001)) as usize;

        POPCOUNT_3[above_3] + POPCOUNT_3[below_3] + POPCOUNT_2[same_2]
    }
}
```

## 2. Rationale

The current neighbor counting does:
- **8 shift operations** (one per neighbor)
- **8 mask operations** (& 1)
- **8 casts** (as u8)
- **7 additions**
- Total: **~31 operations per cell**

With lookup tables:
- **3 shift operations** (one per row)
- **3 mask operations**
- **3 table lookups**
- **2 additions**
- Total: **~11 operations per cell**

**Potential reduction: ~65% fewer operations in neighbor counting**

However, table lookups on IC's WASM interpreter may not be faster than arithmetic. Memory access patterns differ from native CPU execution.

**Goal:** Test whether lookup tables provide meaningful speedup on IC.

## 3a. Pseudocode Implementation Changes

```diff
+// Add lookup tables at module level
+static POPCOUNT_3: [u8; 8] = [0, 1, 1, 2, 1, 2, 2, 3];
+static POPCOUNT_2: [u8; 4] = [0, 1, 1, 2];

 fn compute_cell_fate(
     bit_pos: usize,
     above: u64, same: u64, below: u64,
     left_above: u64, left_same: u64, left_below: u64,
     right_above: u64, right_same: u64, right_below: u64,
     cell_idx: usize,
 ) -> CellFate {
     let currently_alive = (same >> bit_pos) & 1 == 1;

-    // Count alive neighbors using bit extraction
-    let (nw, n, ne, w, e, sw, s, se) = if bit_pos == 0 {
-        (
-            ((left_above >> 63) & 1) as u8,
-            ((above >> 0) & 1) as u8,
-            ((above >> 1) & 1) as u8,
-            ((left_same >> 63) & 1) as u8,
-            ((same >> 1) & 1) as u8,
-            ((left_below >> 63) & 1) as u8,
-            ((below >> 0) & 1) as u8,
-            ((below >> 1) & 1) as u8,
-        )
-    } else if bit_pos == 63 {
-        // ... right edge case ...
-    } else {
-        // ... interior case with 8 extractions ...
-    };
-
-    let alive_count = nw + n + ne + w + e + sw + s + se;
+    // Count neighbors using lookup table (interior) or individual bits (edges)
+    let alive_count = count_neighbors_fast(
+        bit_pos, above, same, below,
+        left_above, left_same, left_below,
+        right_above, right_same, right_below,
+    );

     match (currently_alive, alive_count) {
         (true, 2) | (true, 3) => CellFate::Survives,
         (false, 3) => {
-            // Birth - find majority owner among 3 parents
-            let (x, y) = idx_to_coords(cell_idx);
-            let owner = find_birth_owner(x, y, nw, n, ne, w, e, sw, s, se, cell_idx);
+            // Birth - need individual neighbor bits for ownership
+            let (x, y) = idx_to_coords(cell_idx);
+            let (nw, n, ne, w, e, sw, s, se) = extract_neighbor_bits(
+                bit_pos, above, same, below,
+                left_above, left_same, left_below,
+                right_above, right_same, right_below,
+            );
+            let owner = find_birth_owner(x, y, nw, n, ne, w, e, sw, s, se, cell_idx);
             CellFate::Birth(owner)
         }
         (true, _) => CellFate::Death,
         (false, _) => CellFate::StaysDead,
     }
 }

+#[inline(always)]
+fn count_neighbors_fast(
+    bit_pos: usize,
+    above: u64, same: u64, below: u64,
+    left_above: u64, left_same: u64, left_below: u64,
+    right_above: u64, right_same: u64, right_below: u64,
+) -> u8 {
+    if bit_pos == 0 || bit_pos == 63 {
+        // Edge cases: fall back to individual extraction
+        let (nw, n, ne, w, e, sw, s, se) = extract_neighbor_bits(
+            bit_pos, above, same, below,
+            left_above, left_same, left_below,
+            right_above, right_same, right_below,
+        );
+        nw + n + ne + w + e + sw + s + se
+    } else {
+        // Interior: use lookup tables
+        let shift = bit_pos - 1;
+        let above_3 = ((above >> shift) & 0b111) as usize;
+        let below_3 = ((below >> shift) & 0b111) as usize;
+        // Same row: bits at shift and shift+2 (excluding center at shift+1)
+        let left_bit = ((same >> shift) & 1) as u8;
+        let right_bit = ((same >> (shift + 2)) & 1) as u8;
+        POPCOUNT_3[above_3] + POPCOUNT_3[below_3] + left_bit + right_bit
+    }
+}

+#[inline(always)]
+fn extract_neighbor_bits(
+    bit_pos: usize,
+    above: u64, same: u64, below: u64,
+    left_above: u64, left_same: u64, left_below: u64,
+    right_above: u64, right_same: u64, right_below: u64,
+) -> (u8, u8, u8, u8, u8, u8, u8, u8) {
+    // Original 8-extraction logic moved here
+    if bit_pos == 0 {
+        // ... left edge ...
+    } else if bit_pos == 63 {
+        // ... right edge ...
+    } else {
+        // ... interior ...
+    }
+}
```

## 3b. Current Expenditure

**Measured from live benchmarks (3,376 generations, ~164 alive cells):**

| Operation | Instructions/gen |
|-----------|-----------------|
| `compute_fates` | **309,600** |
| `apply_changes` | **272,040** |
| `step_generation` | **584,900** |

**Estimating neighbor counting cost:**

`compute_fates` processes cells from the POTENTIAL bitmap. At ~164 alive cells, each with ~8 neighbors:
- Potential cells processed: ~164 + 8×164 = ~1,476 per generation
- Neighbor counting per cell: ~31 operations = ~40-60 instructions
- **Estimated neighbor counting: 59,040 - 88,560 instructions/gen**

**As percentage of compute_fates:** ~19% - 29%

**Note:** This is an estimate. To get precise data, we need to add a `NeighborCount` benchmark:

```rust
// Add this benchmark to measure accurately
pub enum BenchmarkOperation {
    // ... existing ...
    NeighborCount,
}

fn count_neighbors_fast(...) -> u8 {
    benchmark!(NeighborCount);  // Measure this specifically
    // ... implementation ...
}
```

**Limitation:** Adding the benchmark itself adds overhead (~200-500 instructions per call), which would skew the measurement significantly given the small per-call cost.

## 4. Expected Reduction

**Theoretical analysis:**

| Metric | Current | Proposed | Reduction |
|--------|---------|----------|-----------|
| Operations per cell | ~31 | ~11 | **65%** |
| Interior cells (62/64) | 97% | Use lookup | Faster |
| Edge cells (2/64) | 3% | Fallback | Same |
| Net neighbor counting | ~75K instr/gen | ~30K instr/gen | **~45K** |
| As % of compute_fates | 24% | 10% | **~14%** |

**BUT on IC's WASM interpreter:**
- Memory loads (table lookup) may be slower than register operations
- 8-byte static array should fit in cache, but WASM memory model differs
- Conditional branches (edge cases) add overhead

**Conservative estimate: 5-15% reduction in compute_fates**
- compute_fates savings: 15,480 - 46,440 instructions/gen
- Daily savings: 13.4B - 40.1B instructions
- **As % of total daily: 3-9%**

**How to verify with benchmarking:**

Since per-call benchmarking adds too much overhead, use aggregate comparison:

1. **Before change:**
   - Record `compute_fates` average from `get_benchmarks`
   - Current: ~309,600 instructions/gen

2. **After change:**
   - Deploy with lookup table implementation
   - Reset benchmarks
   - Wait for similar activity (~2-4 hours, similar alive cell count)
   - Compare `compute_fates` average

3. **Expected results:**
   - Optimistic: ~260,000 instructions/gen (16% reduction)
   - Realistic: ~280,000 instructions/gen (10% reduction)
   - Pessimistic: ~300,000+ instructions/gen (no improvement or regression)

## 5. Risks and Potential Breakage

### Risk Level: **LOW**

### Correctness Risk
**Risk:** Lookup table returns wrong neighbor count
- **Cause:** Off-by-one in bit extraction, wrong table values
- **Impact:** Game of Life rules violated, incorrect births/deaths
- **Mitigation:**
  - Unit tests for all 64 bit positions
  - Verify against original implementation for known patterns
  - Test edge cases (bit_pos 0, 1, 62, 63)

### Performance Regression Risk
**Risk:** Lookup tables slower than arithmetic on IC WASM
- **Cause:** Memory access pattern differences in WASM interpreter
- **Impact:** compute_fates becomes slower, increased costs
- **Mitigation:**
  - Deploy and benchmark immediately
  - Have rollback ready
  - Consider compile-time const evaluation if WASM supports it

### Birth Ownership Complication
**Risk:** `find_birth_owner` still needs individual neighbor bits
- **Cause:** Need to know which specific neighbors are alive for ownership
- **Impact:** Must extract bits twice for birth cases
- **Mitigation:**
  - Accept this overhead for births (minority of cells)
  - Alternative: Store both count and individual bits in lookup (larger table)

### Code Paths Affected

| Location | Current | Changed |
|----------|---------|---------|
| `compute_cell_fate()` | Extracts 8 bits | Calls `count_neighbors_fast()` |
| Birth case | Has neighbor bits | Must call `extract_neighbor_bits()` |

### Test Cases Required
1. Glider pattern - cells should move correctly
2. Blinker pattern - should oscillate
3. R-pentomino - complex evolution
4. Edge cells (x=0, x=511, y=0, y=511)
5. Corner cells (0,0), (0,511), (511,0), (511,511)
6. All 64 bit positions with various neighbor configurations

### Rollback Plan
1. Revert to original 8-extraction code
2. No state changes - pure algorithmic change
3. Simple git revert

### Alternative: Branchless Counting
If lookup tables don't help, try branchless bit counting:
```rust
// Count bits in 3-bit pattern without branches
fn popcount_3(x: u64) -> u8 {
    let x = x & 0b111;
    ((x & 1) + ((x >> 1) & 1) + ((x >> 2) & 1)) as u8
}
```
This avoids memory access but still reduces operation count.
