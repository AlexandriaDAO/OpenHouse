# Optimization Plan #1: Unified Owner Bitmap

## 1. Proposal

Replace the O(8) `find_owner()` function with an O(1) lookup using a pre-computed owner array.

**Current Implementation:**
```rust
fn find_owner(x: u16, y: u16) -> Option<usize> {
    for player in 0..MAX_PLAYERS {  // O(8) scan
        if player_owns(player, x, y) {
            return Some(player);
        }
    }
    None
}
```

**Proposed Implementation:**
```rust
thread_local! {
    static OWNER: RefCell<[u8; 262_144]> = RefCell::new([255u8; 262_144]);
}

fn find_owner(x: u16, y: u16) -> Option<usize> {
    let idx = (y as usize) * 512 + (x as usize);
    let owner = OWNER.with(|o| o.borrow()[idx]);
    if owner == 255 { None } else { Some(owner as usize) }
}
```

## 2. Rationale

The `find_owner()` function is called **~2,500 times per generation** (estimated) to determine cell ownership during:
- Death processing (to decrement cell counts) - ~500 calls
- Birth processing (`find_birth_owner` queries up to 3 alive neighbors per birth) - ~1,500 calls
- Territory change checks (to identify old owner before takeover) - ~500 calls

Each call currently does an O(8) scan through player territory bitmaps, costing ~399 instructions per call. With an O(1) lookup, this drops to ~50 instructions.

**Goal:** Reduce daily cycle burn by eliminating redundant bitmap scans.

## 3a. Pseudocode Implementation Changes

```diff
 // lib.rs - Add new storage
 thread_local! {
     static ALIVE: RefCell<[u64; TOTAL_WORDS]> = RefCell::new([0u64; TOTAL_WORDS]);
     static TERRITORY: RefCell<[PlayerTerritory; MAX_PLAYERS]> = ...;
+    static OWNER: RefCell<[u8; TOTAL_CELLS]> = RefCell::new([255u8; TOTAL_CELLS]);
     ...
 }

 // find_owner - Replace O(8) scan with O(1) lookup
-fn find_owner(x: u16, y: u16) -> Option<usize> {
-    benchmark!(FindOwner);
-    for player in 0..MAX_PLAYERS {
-        if player_owns(player, x, y) {
-            return Some(player);
-        }
-    }
-    None
-}
+fn find_owner(x: u16, y: u16) -> Option<usize> {
+    benchmark!(FindOwner);
+    let idx = coords_to_idx(x, y);
+    OWNER.with(|o| {
+        let owner = o.borrow()[idx];
+        if owner == 255 { None } else { Some(owner as usize) }
+    })
+}

 // set_territory - Also update OWNER array
 fn set_territory(player: usize, x: u16, y: u16) {
     TERRITORY.with(|territory| {
         // ... existing chunk logic ...
     });
+    OWNER.with(|o| {
+        let idx = coords_to_idx(x, y);
+        o.borrow_mut()[idx] = player as u8;
+    });
 }

 // clear_territory - Also update OWNER array
 fn clear_territory(player: usize, x: u16, y: u16) {
     TERRITORY.with(|territory| {
         // ... existing chunk logic ...
     });
+    OWNER.with(|o| {
+        let idx = coords_to_idx(x, y);
+        o.borrow_mut()[idx] = 255;
+    });
 }

 // eliminate_player - Clear OWNER entries BEFORE resetting territory
 fn eliminate_player(player: usize) {
     // 1. Kill ALL player's alive cells (existing logic unchanged)
     TERRITORY.with(|territory| {
         let territory = territory.borrow();
         let pt = &territory[player];
         // ... iterate chunks to kill cells ...
     });

-    // 2. Clear territory completely (current: just resets to default)
+    // 2. Clear OWNER entries by iterating player's territory chunks
+    //    MUST happen BEFORE resetting territory to default
+    TERRITORY.with(|territory| {
+        let territory = territory.borrow();
+        let pt = &territory[player];
+
+        let mut chunk_idx_iter = pt.chunk_mask;
+        let mut vec_idx = 0;
+
+        while chunk_idx_iter != 0 {
+            let chunk_idx = chunk_idx_iter.trailing_zeros() as usize;
+            chunk_idx_iter &= chunk_idx_iter - 1;
+
+            let chunk = &pt.chunks[vec_idx];
+            let chunk_base_x = (chunk_idx % CHUNKS_PER_ROW) * 64;
+            let chunk_base_y = (chunk_idx / CHUNKS_PER_ROW) * 64;
+
+            for local_y in 0..64 {
+                let mut word = chunk[local_y];
+                while word != 0 {
+                    let local_x = word.trailing_zeros() as usize;
+                    word &= word - 1;
+
+                    let x = (chunk_base_x + local_x) as u16;
+                    let y = (chunk_base_y + local_y) as u16;
+                    let idx = coords_to_idx(x, y);
+
+                    OWNER.with(|o| {
+                        o.borrow_mut()[idx] = 255;
+                    });
+                }
+            }
+            vec_idx += 1;
+        }
+    });

+    // 3. NOW safe to reset territory to default
     TERRITORY.with(|territory| {
         territory.borrow_mut()[player] = PlayerTerritory::default();
     });

-    // 3. Clear player data
+    // 4. Clear player data (unchanged)
     BASES.with(|bases| { ... });
     PLAYERS.with(|players| { ... });
     // ...
 }

 // wipe_quadrant - NO OWNER changes needed
 // Territory survives wipes (intentional gameplay mechanic)
 // Only ALIVE bitmap is cleared; OWNER stays intact
 fn wipe_quadrant(quadrant: u8) {
     // ... existing logic kills cells but preserves territory ...
     // OWNER unchanged - players retain territory claims in wiped quadrants
 }

 // join_game - Initialize OWNER for base area
 fn join_game(x: i32, y: i32) -> Result<u8, String> {
     // ... existing validation and base creation ...

     // Clear enemy territory from base area (existing loop)
     for dy in 0..BASE_SIZE {
         for dx in 0..BASE_SIZE {
             // ... existing clear_territory calls already update OWNER via clear_territory ...
         }
     }

     // Initialize 6x6 interior territory (existing loop)
     for dy in 1..7u16 {
         for dx in 1..7u16 {
             // ... existing set_territory calls already update OWNER via set_territory ...
         }
     }
 }

 // Stable storage - Add OWNER to pre_upgrade/post_upgrade
 #[pre_upgrade]
 fn pre_upgrade() {
     let state = (
         // ... existing state ...
+        OWNER.with(|o| o.borrow().to_vec()),
     );
     // ... serialize ...
 }

 #[post_upgrade]
 fn post_upgrade() {
     // ... deserialize and restore OWNER ...
 }
```

## 3b. Current Expenditure

**Estimated from code analysis (~2,500 calls/gen):**

| Metric | Value |
|--------|-------|
| `find_owner` calls per generation | **~2,500** |
| Breakdown: deaths | ~500 |
| Breakdown: birth neighbors (3 per birth × ~500 births) | ~1,500 |
| Breakdown: territory change checks | ~500 |
| Instructions per call (average) | **399** |
| Instructions per call (min/max) | 366 / 808 |
| **Total per generation** | **~997,500 instructions** |
| Total per tick (8 generations) | ~7,980,000 instructions |
| Total per day (864,000 generations) | **~862B instructions** |

**As percentage of step_generation (584,900 instr/gen):** ~170% (majority of cost!)
**As percentage of estimated daily total (~1T instructions):** ~86%

**Note:** Original benchmark showed 181 calls/gen during low-activity period. Real-world with typical GOL dynamics has much higher call volume.

## 4. Expected Reduction

**Post-optimization estimate:**

| Metric | Current | Proposed | Reduction |
|--------|---------|----------|-----------|
| Instructions per call | 399 | ~50 | **87%** |
| Instructions per generation | ~997,500 | ~125,000 | **87%** |
| Daily instructions | ~862B | ~108B | **~754B saved** |

**Net savings:** ~754B instructions/day (theoretical)

**BUT: Additional overhead from keeping OWNER in sync:**
- `set_territory`: +1 array write (~20 instructions)
- `clear_territory`: +1 array write (~20 instructions)
- Called same ~2,500 times/gen = ~50,000 additional instructions/gen

**Adjusted net savings:**
- Per generation: 997,500 - 125,000 - 50,000 = **~822,500 instructions saved**
- Per day: **~711B instructions saved**
- **As % of daily total: ~71%**

**How to verify with benchmarking:**
1. Implement changes
2. Reset benchmarks: `dfx canister --network ic call life1_backend reset_benchmarks`
3. Wait for activity (ensure active gameplay with ~500+ births/deaths per generation)
4. Compare `find_owner` stats in `get_benchmarks`:
   - Expect: ~50 instructions/call (down from 399)
   - Total cycles/gen should drop by ~800K

## 5. Risks and Potential Breakage

### Risk Level: **MEDIUM**

### Synchronization Issues
**Risk:** OWNER array gets out of sync with TERRITORY bitmaps
- **Cause:** Any code path that modifies TERRITORY without updating OWNER
- **Impact:** `find_owner()` returns wrong owner, corrupts game state
- **Mitigation:**
  - Audit all callers of `set_territory`, `clear_territory`, `eliminate_player`
  - OWNER updates are internal to set_territory/clear_territory (automatic sync)
  - `eliminate_player` requires special handling (iterate before reset)
  - Add debug assertions in test builds to verify sync

### Memory Increase
**Risk:** +256KB heap usage
- **Current OWNER array:** 262,144 bytes (256KB)
- **Impact:** IC canisters have 4GB heap limit; this is 0.006% of limit
- **Mitigation:** Acceptable trade-off for performance

### Stable Storage Size
**Risk:** Larger upgrade memory requirements
- **Impact:** +256KB to stable memory during upgrades
- **Mitigation:** Acceptable; already storing much larger TERRITORY data

### Code Paths Requiring Updates

| Location | Current Behavior | Required Change |
|----------|-----------------|-----------------|
| `set_territory()` | Updates TERRITORY bitmap | Also update OWNER[idx] = player |
| `clear_territory()` | Clears TERRITORY bitmap | Also update OWNER[idx] = 255 |
| `eliminate_player()` | Resets territory to default | **Iterate chunks to clear OWNER entries BEFORE reset** |
| `wipe_quadrant()` | Kills cells, preserves territory | **No OWNER change** (territory survives wipes) |
| `join_game()` | Sets initial base territory | Already uses set_territory/clear_territory (automatic) |
| `pre_upgrade()` | Saves state | Must save OWNER array |
| `post_upgrade()` | Restores state | Must restore OWNER array |

### Edge Cases to Test
1. Player elimination - all their OWNER entries cleared? (critical sync point)
2. Quadrant wipe - OWNER entries **preserved** (territory survives wipe)?
3. Territory takeover (birth on enemy territory) - OWNER updated to new owner?
4. Multiple overlapping changes in single generation
5. Upgrade/restore cycle - OWNER state preserved?
6. New player joins on territory owned by another - OWNER correctly cleared for overlapping cells?

### Rollback Plan
If bugs discovered post-deployment:
1. Revert to previous code (OWNER array unused)
2. `find_owner()` falls back to O(8) scan
3. No data corruption since TERRITORY is still authoritative
