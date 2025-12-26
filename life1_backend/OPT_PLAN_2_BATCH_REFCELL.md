# Optimization Plan #2: Batch RefCell Borrows

## 1. Proposal

Restructure `apply_changes()` and related functions to borrow all required `RefCell`s once at the start of each major phase, rather than repeatedly inside loops.

**Current Pattern:**
```rust
for &cell_idx in deaths {
    let (x, y) = idx_to_coords(cell_idx);

    if let Some(owner) = find_owner(x, y) {
        CELL_COUNTS.with(|cc| {       // Borrow #1
            cc.borrow_mut()[owner] -= 1;
        });                            // Release #1

        let count = CELL_COUNTS.with(|cc| cc.borrow()[owner]);  // Borrow #2, Release #2
        if count == 0 {
            BASES.with(|bases| {      // Borrow #3
                if bases.borrow()[owner].is_some() {
                    ZERO_CELLS_SINCE.with(|zcs| {  // Borrow #4
                        zcs.borrow_mut()[owner] = Some(ic_cdk::api::time());
                    });                             // Release #4
                }
            });                        // Release #3
        }
    }
    // ... more borrows for alive, potential, etc.
}
```

**Proposed Pattern:**
```rust
// Borrow all at start
CELL_COUNTS.with(|cc| {
BASES.with(|bases| {
ZERO_CELLS_SINCE.with(|zcs| {
ALIVE.with(|alive| {
    let mut cc = cc.borrow_mut();
    let bases = bases.borrow();
    let mut zcs = zcs.borrow_mut();
    let mut alive = alive.borrow_mut();

    for &cell_idx in deaths {
        // Use already-borrowed refs directly
        let (x, y) = idx_to_coords(cell_idx);
        if let Some(owner) = find_owner(x, y) {
            if cc[owner] > 0 { cc[owner] -= 1; }
            if cc[owner] == 0 && bases[owner].is_some() {
                zcs[owner] = Some(ic_cdk::api::time());
            }
        }
        // ... use alive directly ...
    }
})})})}); // Release all at end
```

## 2. Rationale

`RefCell::borrow()` and `borrow_mut()` have overhead:
- Atomic read/modify/write for borrow count
- Branch to check for panic on double-mutable-borrow
- In IC's WASM interpreter, this overhead is amplified

**Current pattern causes repeated overhead:**
- Each iteration through deaths/births does ~4-8 borrow operations
- With ~181 births/deaths per generation (estimated from find_owner calls)
- That's ~1,000-1,500 borrow/release cycles per generation

**Goal:** Reduce borrow overhead from O(n) to O(1) per function.

## 3a. Pseudocode Implementation Changes

```diff
 fn apply_changes(births: &[(usize, usize)], deaths: &[usize], survivors: &[usize]) {
-    // Clear NEXT_POTENTIAL
-    NEXT_POTENTIAL.with(|np| {
-        np.borrow_mut().fill(0);
-    });
-
-    let mut territory_changes = TerritoryChanges::new();
-
-    // Apply deaths
-    for &cell_idx in deaths {
-        let (x, y) = idx_to_coords(cell_idx);
-
-        if let Some(owner) = find_owner(x, y) {
-            CELL_COUNTS.with(|cc| {
-                let mut cc = cc.borrow_mut();
-                if cc[owner] > 0 { cc[owner] -= 1; }
-            });
-
-            let count = CELL_COUNTS.with(|cc| cc.borrow()[owner]);
-            if count == 0 {
-                BASES.with(|bases| {
-                    if bases.borrow()[owner].is_some() {
-                        ZERO_CELLS_SINCE.with(|zcs| {
-                            zcs.borrow_mut()[owner] = Some(ic_cdk::api::time());
-                        });
-                    }
-                });
-            }
-        }
-        clear_alive_idx(cell_idx);
-        mark_neighbors_potential(cell_idx);
-    }
-    // ... similar for births and survivors ...
+    // Batch all borrows at start
+    NEXT_POTENTIAL.with(|next_potential| {
+    CELL_COUNTS.with(|cell_counts| {
+    BASES.with(|bases| {
+    ZERO_CELLS_SINCE.with(|zero_cells_since| {
+    ALIVE.with(|alive| {
+    POTENTIAL.with(|potential| {
+    TERRITORY.with(|territory| {
+    PLAYERS.with(|players| {
+    WALLETS.with(|wallets| {
+        let mut np = next_potential.borrow_mut();
+        let mut cc = cell_counts.borrow_mut();
+        let bases_ref = bases.borrow();
+        let mut zcs = zero_cells_since.borrow_mut();
+        let mut alive = alive.borrow_mut();
+        let mut potential = potential.borrow_mut();
+        let mut territory = territory.borrow_mut();
+        let players_ref = players.borrow();
+        let mut wallets = wallets.borrow_mut();
+
+        np.fill(0);
+        let mut territory_changes = TerritoryChanges::new();
+        let now = ic_cdk::api::time();
+
+        // Process deaths with pre-borrowed refs
+        for &cell_idx in deaths {
+            let (x, y) = idx_to_coords(cell_idx);
+
+            // find_owner needs territory - use inline version
+            let owner = find_owner_inline(&territory, x, y);
+            if let Some(owner) = owner {
+                if cc[owner] > 0 { cc[owner] -= 1; }
+                if cc[owner] == 0 && bases_ref[owner].is_some() {
+                    zcs[owner] = Some(now);
+                }
+            }
+
+            // clear_alive - inline
+            let word_idx = cell_idx >> 6;
+            let bit_pos = cell_idx & 63;
+            alive[word_idx] &= !(1u64 << bit_pos);
+
+            // mark_neighbors_potential - inline
+            mark_neighbors_potential_inline(&mut np, cell_idx);
+        }
+
+        // Process births with pre-borrowed refs
+        for &(cell_idx, new_owner) in births {
+            // ... similar inlined operations ...
+        }
+
+        // Process survivors
+        for &cell_idx in survivors {
+            mark_with_neighbors_potential_inline(&mut np, cell_idx);
+        }
+
+        // Swap buffers
+        std::mem::swap(&mut *potential, &mut *np);
+    })})})})})})})})}); // Release all
 }

+// New inline helper - avoids RefCell borrow
+fn find_owner_inline(territory: &[PlayerTerritory; MAX_PLAYERS], x: u16, y: u16) -> Option<usize> {
+    for player in 0..MAX_PLAYERS {
+        if player_owns_inline(&territory[player], x, y) {
+            return Some(player);
+        }
+    }
+    None
+}
```

## 3b. Current Expenditure

**Measured from live benchmarks (3,376 generations):**

| Operation | Instructions/gen |
|-----------|-----------------|
| `apply_changes` total | **272,040** |
| `compute_fates` total | **309,600** |
| `step_generation` total | **584,900** |
| `tick` total (8 gens) | **4,693,000** |

**Estimated RefCell overhead:**

Current code structure calls `RefCell::borrow()` or `borrow_mut()` approximately:
- Deaths loop: ~6 borrows × ~100 deaths = 600 borrows
- Births loop: ~8 borrows × ~100 births = 800 borrows
- Survivors loop: ~2 borrows × ~500 survivors = 1,000 borrows
- **Total: ~2,400 borrow operations per generation**

At ~20-30 instructions per borrow/release cycle on IC WASM:
- **Estimated overhead: 48,000 - 72,000 instructions/gen**
- **As % of apply_changes: 17.6% - 26.5%**
- **As % of step_generation: 8.2% - 12.3%**

**Note:** This is an estimate. To get precise measurements, we would need to add a `RefCellBorrow` benchmark operation, which would add overhead itself.

## 4. Expected Reduction

**Post-optimization estimate:**

With batch borrows:
- ~9 borrows total (one per RefCell) instead of ~2,400
- Overhead reduced from ~60,000 to ~270 instructions/gen

| Metric | Current (Est.) | Proposed | Reduction |
|--------|----------------|----------|-----------|
| Borrow operations/gen | ~2,400 | ~9 | **99.6%** |
| Borrow overhead/gen | ~60,000 | ~270 | **~59,730** |
| As % of apply_changes | ~22% | ~0.1% | **~22%** |
| Daily savings | ~51.6B | - | **~51.6B instructions** |

**Realistic adjustment:**
- Inlining helper functions adds some code duplication overhead
- Breaking up the nested `.with()` closures is complex
- Realistic savings: **15-20% of apply_changes = 40-55K instructions/gen**

**Daily savings:** ~34.5B - 47.5B instructions (**~7-10% of total**)

**How to verify with benchmarking:**
1. Implement changes
2. Reset benchmarks: `dfx canister --network ic call life1_backend reset_benchmarks`
3. Wait for similar activity level (~2-4 hours)
4. Compare `apply_changes` stats in `get_benchmarks`:
   - Expect: ~220,000-235,000 instructions/gen (down from 272,040)
   - Variance in recent_samples should also decrease

## 5. Risks and Potential Breakage

### Risk Level: **MEDIUM-HIGH**

### Borrow Conflicts
**Risk:** Holding multiple mutable borrows at once can cause panics
- **Cause:** If any called function tries to borrow something we're already holding
- **Example:** `find_owner()` borrows TERRITORY; if we hold TERRITORY mutably, panic
- **Mitigation:**
  - Must inline or rewrite all helper functions to take references
  - Careful audit of what each helper function accesses
  - Test thoroughly with debug assertions

### Code Complexity
**Risk:** Deeply nested `.with()` closures are hard to read/maintain
- **Impact:** Future modifications become error-prone
- **Mitigation:**
  - Consider extracting to a struct that holds all borrows
  - Or use `thread_local!` with `Cell` for simple counters
  - Document the borrow order clearly

### Functions Requiring Inlining

| Function | Currently Accesses | Must Inline |
|----------|-------------------|-------------|
| `find_owner()` | TERRITORY | Yes |
| `player_owns()` | TERRITORY | Yes |
| `set_territory()` | TERRITORY | Yes |
| `clear_territory()` | TERRITORY | Yes |
| `clear_alive_idx()` | ALIVE | Yes |
| `set_alive_idx()` | ALIVE | Yes |
| `mark_neighbors_potential()` | POTENTIAL/NEXT_POTENTIAL | Yes |
| `in_protection_zone()` | BASES | Yes |
| `eliminate_player()` | Multiple | Must be called outside batch |

### Borrow Order Requirements
To avoid deadlocks/panics, borrows must be in consistent order:
```
1. NEXT_POTENTIAL
2. CELL_COUNTS
3. BASES (immutable)
4. ZERO_CELLS_SINCE
5. ALIVE
6. POTENTIAL
7. TERRITORY
8. PLAYERS (immutable)
9. WALLETS
```

### Edge Cases to Test
1. Siege mechanic (birth in protection zone) - requires BASES, WALLETS
2. Player elimination during apply_changes - must defer to after loop
3. Grace period trigger - requires BASES, ZERO_CELLS_SINCE
4. Territory changes batch - must track affected players
5. Concurrent modifications from place_cells (should be blocked by generation lock)

### Alternative: Partial Batching
If full batching is too risky, can batch selectively:
- Batch deaths loop only (simpler)
- Batch births loop only
- Leave complex paths (siege, elimination) unbatched

### Rollback Plan
If bugs discovered post-deployment:
1. Revert to unbatched version (simple code rollback)
2. No state corruption - just a performance regression
3. Can do partial rollback (keep some batching, revert others)
