# Life2: Observations vs Plan

Observations from initial deployment on 2025-12-17.

## Deployment Context

- Canister ID: `qoski-4yaaa-aaaai-q4g4a-cai`
- Initial cycles: 1T (added after first depletion)
- After reinstall: 0.6T cycles

## Observation 1: Legacy Data Migration Issue

**Expected:** Fresh deploy with empty grid.

**Actual:** The canister had existing stable memory from the old dense implementation (u16 cells). The `post_upgrade` function read this as u8 cells, causing bit misinterpretation:
- Old format: `bits 4-10 = points (0-127)`
- New format: `bit 4 = alive`

Result: ~105,000 "phantom" alive cells appeared, causing the grid to be 40% populated instead of empty.

**Resolution:** Used `--mode reinstall` to wipe stable memory.

**Cycles lost:** ~400B cycles burned in ~10 minutes processing 105K cells.

## Observation 2: Idle Burn Rate

**Expected (from plan):** Not explicitly stated for idle.

**Actual:** 22M cycles/day with 0 alive cells.

**Assessment:** This appears reasonable for timer overhead.

## Observation 3: Active Burn Rate

**Expected (from plan):**
| Population | Potential | Cycles/sec | Annual Cost |
|------------|-----------|------------|-------------|
| 5,000 alive | ~20,000 | 3.4M | ~$139 |

**Actual (measured with ~1,400 alive cells, ~7,500 potential):**
| Metric | Value |
|--------|-------|
| Cycles burned in 10 seconds | ~613M |
| Burn rate | ~61M cycles/sec |
| Projected daily | ~5.3T cycles/day |
| Projected annual | ~$2,500/year |

**Ratio:** Actual burn rate is ~18x higher than plan estimated for a smaller population.

## Observation 4: Population Dynamics

**Measured population over 15 seconds:**
- Alive cells: 1,351 - 1,468 (oscillating)
- Potential cells: 7,251 - 7,798 (oscillating)
- Potential:Alive ratio: ~5.3:1

**Assessment:** Population is stable and ratio is reasonable. The sparse optimization is working (not processing all 262K cells).

## Observation 5: Generation Rate

**Expected:** 10 generations/second (batched as 10 gens per 1-second tick).

**Actual:** ~14 generations/second observed (140 gens in 10 seconds).

**Assessment:** Slightly faster than expected, possibly due to timer variance or catch-up after queries.

## Implementation Differences from Plan

The deployed code includes changes not in the original plan:

1. **Two-pass algorithm:** Computes all cell fates first, then applies changes. This ensures correct simultaneous updates but allocates a `Vec<(usize, CellChange)>` each generation.

2. **Admin authentication:** `pause_game`, `resume_game`, `reset_game` now require admin principal.

3. **User authentication:** `join_game` and `place_cells` reject anonymous callers.

## Cost Comparison

| Scenario | Plan Estimate | Actual Measured |
|----------|---------------|-----------------|
| Idle (0 cells) | Not stated | ~22M cycles/day (~$0.01/day) |
| Light use (1.4K alive) | ~$70/year | ~$2,500/year |
| Moderate use (5K alive) | ~$139/year | Not yet measured |

## Open Questions

1. Is the Vec allocation in two-pass causing significant overhead?
2. Is the timer execution itself costly?
3. Are query calls during measurement inflating the observed burn rate?
4. What is the actual compute cost per potential cell processed?

## Raw Data

```
Canister status at time of measurement:
- Status: Running
- Balance: 516B cycles (after starting with 600B)
- Memory Size: 2.2 MB
- Idle cycles burned per day: 22M
- Alive cells: ~1,400
- Potential cells: ~7,500
- Generation: ~19,000
```
