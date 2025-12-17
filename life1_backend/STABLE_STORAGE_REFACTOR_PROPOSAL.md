# Proposal: Refactor Life1 Backend Stable Storage

## Problem Statement

When the `life1_backend` was upgraded with new fields added to the `Metadata` struct, **all player data was lost** except for players who joined after the upgrade.

### What Happened

**Before upgrade** (commit `1d3799b`):
```rust
struct Metadata {
    generation: u64,
    players: Vec<Principal>,
    balances: Vec<u64>,
    is_running: bool,
}
```

**After upgrade** (commit `a051489`):
```rust
struct Metadata {
    generation: u64,
    players: Vec<Principal>,
    balances: Vec<u64>,
    is_running: bool,
    checkpoint_timestamp_ns: u64,  // NEW
    quadrants: [QuadrantState; 16], // NEW
}
```

### Root Cause

The `Metadata` struct is stored as a **candid-encoded blob** in stable memory:

```rust
impl Storable for Metadata {
    fn to_bytes(&self) -> Cow<'_, [u8]> {
        Cow::Owned(candid::encode_one(self).unwrap())
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        candid::decode_one(&bytes).unwrap_or_default()  // <-- Silent failure!
    }
}
```

When the struct schema changed (new fields added), candid deserialization of the old data **failed silently** and returned `Metadata::default()` - an empty struct with no players.

### Why Cells Survived

The cell grid survived because it uses a **fixed-size structure** stored directly in `StableVec<Cell>`:

```rust
pub struct Cell(u16);  // Fixed 2 bytes, never changes
```

No candid encoding, no schema changes, no data loss.

---

## Proposed Solution

Store metadata the same way cells are stored: **fixed-size structures in separate stable memory regions**.

### New Storage Architecture

Instead of one candid blob, use separate stable structures for each data type:

| Data | Current Storage | Proposed Storage |
|------|----------------|------------------|
| Scalars (generation, timestamp, flags) | Candid blob | `StableCell<ScalarMetadata>` (24 bytes fixed) |
| Players | Candid blob | `StableVec<PlayerEntry>` (32 bytes each) |
| Balances | Candid blob | `StableVec<u64>` (8 bytes each) |
| Quadrants | Candid blob | `StableVec<QuadrantState>` (4 bytes each) |

### New Types

```rust
/// Scalar metadata - fixed 24 bytes
#[repr(C)]
struct ScalarMetadata {
    generation: u64,              // 8 bytes
    checkpoint_timestamp_ns: u64, // 8 bytes
    player_count: u8,             // 1 byte
    is_running: u8,               // 1 byte
    _padding: [u8; 6],            // 6 bytes
}

/// Player entry - fixed 32 bytes
#[repr(C)]
struct PlayerEntry {
    principal_len: u8,
    principal_bytes: [u8; 29],  // Principal max size
    _padding: [u8; 2],
}

/// QuadrantState - fixed 4 bytes (already exists, just add Storable)
#[repr(C)]
pub struct QuadrantState {
    pub claimed_by: u8,
    _padding: u8,
    pub wipe_history: u16,
}
```

### Memory Layout

```
Memory ID 30: STABLE_GRID      - Cell data (unchanged)
Memory ID 31: STABLE_SCALARS   - ScalarMetadata (24 bytes)
Memory ID 32: STABLE_PLAYERS   - PlayerEntry[] (up to 10 × 32 = 320 bytes)
Memory ID 33: STABLE_BALANCES  - u64[] (up to 10 × 8 = 80 bytes)
Memory ID 34: STABLE_QUADRANTS - QuadrantState[] (16 × 4 = 64 bytes)
```

---

## Benefits

1. **Schema-change resilient**: Adding new fields won't break existing data
2. **No silent failures**: Fixed-size reads either work or don't (no `unwrap_or_default`)
3. **Faster**: No candid encode/decode overhead
4. **Debuggable**: Can inspect individual fields in stable memory
5. **Future-proof**: Easy to add new memory regions for new features

---

## Risks & Mitigations

### Risk 1: Migration complexity
The upgrade will need to handle both old (candid blob) and new (fixed-size) formats.

**Mitigation**: Use new memory IDs (30+) so old data in memory IDs 20-21 is ignored. Fresh start with current state.

### Risk 2: Current player data
There's currently only 1 player, so migration is trivial.

**Mitigation**: Deploy when game has minimal active state, or manually reconstruct player list from cell ownership data.

### Risk 3: More code to maintain
Multiple stable structures instead of one blob.

**Mitigation**: The code is simpler (no candid), and the pattern is proven (cells already work this way).

---

## Alternative Approaches Considered

### 1. Use `Option<T>` for new fields in candid
```rust
struct Metadata {
    // ... existing fields ...
    checkpoint_timestamp_ns: Option<u64>,  // Backwards compatible
    quadrants: Option<[QuadrantState; 16]>,
}
```
**Rejected**: Still requires careful management of every schema change. Doesn't address the fundamental fragility.

### 2. Version the metadata blob
```rust
enum MetadataVersion {
    V1(MetadataV1),
    V2(MetadataV2),
}
```
**Rejected**: Adds complexity, still uses candid, still has migration logic for each version.

### 3. Keep current approach, be more careful
**Rejected**: Human error is inevitable. The current approach is a landmine waiting to explode.

---

## Implementation Plan

1. Add new fixed-size types with `Storable` impls
2. Add new memory IDs (30-34) and stable structures
3. Update `save_metadata()` to write to fixed-size structures
4. Update `load_metadata()` to read from fixed-size structures
5. Update `pre_upgrade` / `post_upgrade` to use new storage
6. Keep `CACHED_METADATA` heap cache for runtime performance
7. Test locally with `dfx deploy` cycles
8. Deploy to mainnet

---

## Questions for Review

1. Is the migration strategy sound (new memory IDs, ignore old data)?
2. Should we attempt to reconstruct player data from cell ownership?
3. Are the fixed-size type definitions correct (alignment, padding)?
4. Should we add versioning to the fixed-size structures for future flexibility?
