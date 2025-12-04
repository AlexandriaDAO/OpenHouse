# OpenHouse Actor Architecture Refactoring Plan

## Executive Summary

**Current Status**: OpenHouse frontend uses a hybrid approach - it has `ic-use-actor` and `ic-use-identity` libraries copied from Alexandria, and already follows ~80% of the Alexandria pattern. However, the `useGameActor` hook is broken (using non-existent `useActor` from ic-use-actor), causing all liquidity features to fail.

**Goal**: Complete the refactoring to fully mirror Alexandria's gold-standard actor architecture, fixing the broken liquidity features and improving maintainability.

---

## Current State Analysis

### ✅ What's Already Good (Already Matches Alexandria)

1. **ic-use-identity Library** - Already present and functional
   - Location: `openhouse_frontend/src/lib/ic-use-identity/`
   - Has XState store, hooks, initialization promises
   - Matches Alexandria implementation

2. **Individual Actor Hooks** - Already using `createActorHook` pattern
   ```typescript
   // ✅ CORRECT - Already using Alexandria pattern
   const useDiceActor = createActorHook<_SERVICE>({
     canisterId: 'whchi-hyaaa-aaaao-a4ruq-cai',
     idlFactory,
   });
   ```

3. **ActorProvider Component** - Already exists and mirrors Alexandria
   - Uses `ensureAllInitialized()` and `authenticateAll()`
   - Has interceptor system for session expiry
   - Returns null (side-effect component)

4. **IdentityProvider Setup** - Properly initialized in App.tsx

5. **AuthProvider Wrapper** - Provides convenience hooks around identity

### ❌ What's Broken

1. **useGameActor Hook** - Tries to use non-existent `useActor` API
   ```typescript
   // ❌ BROKEN - ic-use-actor doesn't export useActor
   const { actor: rawActor } = useActor(config?.canisterId || '');
   ```

   **Impact**: All liquidity features are broken because they depend on this hook:
   - `usePoolStats.ts`
   - `useApyData.ts`
   - `useDepositFlow.ts`
   - `useWithdrawalFlow.ts`
   - `PendingWithdrawalRecovery.tsx`

2. **Liquidity Pages** - Completely non-functional
   - `/dice/liquidity`
   - `/plinko/liquidity`
   - `/blackjack/liquidity`

### ⚠️ What Could Be Improved (Minor)

1. **No Central Actor Export** - Actors not exported from barrel file
   - Currently: `import useDice from '@/hooks/actors/useDiceActor'`
   - Alexandria: `import { useDice, useAlex } from '@/hooks/actors'`

2. **GameBalanceProvider** - Separate provider could be merged into main BalanceProvider

---

## Problem Deep Dive: Why useGameActor is Broken

### The Goal
Create a hook that accepts a `GameType` ('dice' | 'plinko' | 'blackjack') and returns the appropriate actor, avoiding code duplication in liquidity components.

### Why It Broke
```typescript
// ❌ This doesn't exist in ic-use-actor
import { useActor } from 'ic-use-actor';
const { actor } = useActor(canisterId);
```

The `ic-use-actor` library only exports:
- `createActorHook` - Creates a hook for a specific canister
- `ensureAllInitialized` - Global function
- `authenticateAll` - Global function

It does NOT provide a way to dynamically fetch an actor by canister ID at runtime.

### Alexandria's Solution
Alexandria doesn't have this problem because they don't use a dynamic `useGameActor` - they import specific hooks directly:

```typescript
// Alexandria pattern - import specific hooks
import { useAlex, useUser, useLbry } from '@/hooks/actors';

const Component = () => {
  const { actor: alexActor } = useAlex();
  const { actor: userActor } = useUser();
  // ...
};
```

For shared components that need flexibility, they pass actors as props or use hook composition.

---

## Proposed Solutions (3 Options)

### Option 1: Hook Map Pattern (RECOMMENDED)

**Approach**: Create a mapping from game ID to actor hooks, use in custom hook.

```typescript
// hooks/actors/index.ts
export { default as useDice } from './useDiceActor';
export { default as usePlinko } from './usePlinkoActor';
export { default as useBlackjack } from './useBlackjackActor';
export { default as useCrash } from './useCrashActor';
export { default as useLedger } from './useLedgerActor';

// hooks/actors/useGameActor.ts
import { GameType } from '@/types/balance';
import useDice from './useDiceActor';
import usePlinko from './usePlinkoActor';
import useBlackjack from './useBlackjackActor';

export function useGameActor(gameId: GameType) {
  const dice = useDice();
  const plinko = usePlinko();
  const blackjack = useBlackjack();

  const actorMap = {
    dice,
    plinko,
    blackjack,
  };

  return actorMap[gameId];
}
```

**Pros**:
- ✅ Simple, works with existing architecture
- ✅ Type-safe
- ✅ Minimal changes required
- ✅ Compatible with ic-use-actor's design

**Cons**:
- ⚠️ Initializes all game actors even if only using one
- ⚠️ Slight performance overhead (negligible in practice)

**Performance Note**: This is exactly what Alexandria does in `ActorProvider` - it calls ALL actor hooks at once. The `ic-use-actor` library is designed for this - actors share global state and don't re-initialize.

---

### Option 2: Static Method Pattern

**Approach**: Use the static `ensureInitialized()` method on individual hooks.

```typescript
// hooks/actors/useGameActor.ts
import { GameType } from '@/types/balance';
import useDice from './useDiceActor';
import usePlinko from './usePlinkoActor';
import useBlackjack from './useBlackjackActor';

// Map game IDs to static actor initialization
const actorHooks = {
  dice: useDice,
  plinko: usePlinko,
  blackjack: useBlackjack,
};

export function useGameActor(gameId: GameType) {
  const [actor, setActor] = useState(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const hook = actorHooks[gameId];
    if (!hook) return;

    hook.ensureInitialized().then((actorInstance) => {
      setActor(actorInstance);
      setIsReady(true);
    });
  }, [gameId]);

  return { actor, isReady };
}
```

**Pros**:
- ✅ Only initializes requested actor
- ✅ More efficient theoretically

**Cons**:
- ❌ More complex implementation
- ❌ Async state management in hook
- ❌ Doesn't follow Alexandria pattern
- ❌ Potential for race conditions

---

### Option 3: Eliminate useGameActor Entirely (MOST ALEXANDRIA-LIKE)

**Approach**: Refactor liquidity components to import specific actor hooks, use props or context to pass game config.

```typescript
// Before (broken):
const { actor } = useGameActor(gameId);

// After (Alexandria pattern):
// In liquidity/DicePoolStats.tsx
import useDice from '@/hooks/actors/useDiceActor';
const { actor } = useDice();

// In liquidity/PlinkoPoolStats.tsx
import usePlinko from '@/hooks/actors/usePlinkoActor';
const { actor } = usePlinko();
```

**Pros**:
- ✅ Matches Alexandria exactly
- ✅ Most explicit and clear
- ✅ No abstraction overhead
- ✅ Type-safe at compile time

**Cons**:
- ❌ More code duplication in liquidity components
- ❌ Requires refactoring 6+ files
- ❌ Loses generic `GameLiquidity` component

---

## Recommendation: Hybrid Approach (Option 1 + Refinements)

**Use Option 1** (Hook Map Pattern) because:
1. Minimal code changes
2. Preserves generic `GameLiquidity` component
3. Matches how Alexandria's `ActorProvider` works
4. Performance impact is negligible (actors share global state)

**Plus these Alexandria-style improvements**:
1. Add barrel export for actors
2. Add static method usage examples in docs
3. Consider refactoring high-traffic components to direct imports later

---

## Implementation Plan

### Phase 1: Fix useGameActor (Immediate - 30 minutes)

**Files to Change**: 1
- `src/hooks/actors/useGameActor.ts`

**Change**:
```typescript
import { GameType } from '../../types/balance';
import useDice from './useDiceActor';
import usePlinko from './usePlinkoActor';
import useBlackjack from './useBlackjackActor';

export function useGameActor(gameId: GameType) {
  const dice = useDice();
  const plinko = usePlinko();
  const blackjack = useBlackjack();

  const actorMap = {
    dice,
    plinko,
    blackjack,
  };

  return actorMap[gameId];
}
```

**Validation**:
```bash
npm run build  # Should succeed
# Test /dice/liquidity page
# Test /plinko/liquidity page
```

---

### Phase 2: Add Barrel Export (Optional - 10 minutes)

**New File**: `src/hooks/actors/index.ts`
```typescript
export { default as useDice } from './useDiceActor';
export { default as usePlinko } from './usePlinkoActor';
export { default as useBlackjack } from './useBlackjackActor';
export { default as useCrash } from './useCrashActor';
export { default as useLedger } from './useLedgerActor';
export { useGameActor } from './useGameActor';
```

**Update imports across codebase**:
```typescript
// Before:
import useDice from '@/hooks/actors/useDiceActor';

// After:
import { useDice } from '@/hooks/actors';
```

---

### Phase 3: Documentation (Optional - 20 minutes)

Create `docs/ACTOR_ARCHITECTURE.md` explaining:
1. How actor initialization works
2. When to use specific vs generic actor hooks
3. How to add new game canisters
4. Debugging tips for actor issues

---

## Testing Plan

### Unit Tests
```typescript
describe('useGameActor', () => {
  it('returns dice actor for dice game', () => {
    const { result } = renderHook(() => useGameActor('dice'));
    expect(result.current.actor).toBeDefined();
  });

  it('returns plinko actor for plinko game', () => {
    const { result } = renderHook(() => useGameActor('plinko'));
    expect(result.current.actor).toBeDefined();
  });
});
```

### Integration Tests
1. Navigate to `/dice/liquidity`
2. Login with Internet Identity
3. Verify pool stats load
4. Attempt deposit flow (stop before confirmation)
5. Verify no console errors
6. Repeat for `/plinko/liquidity` and `/blackjack/liquidity`

---

## Migration Path from Current Stub

**Current State** (temporary stub):
```typescript
export function useGameActor(_gameId: GameType) {
  return { actor: null, isReady: false };
}
```

**After Phase 1**:
```typescript
export function useGameActor(gameId: GameType) {
  const dice = useDice();
  const plinko = usePlinko();
  const blackjack = useBlackjack();

  return {
    dice,
    plinko,
    blackjack,
  }[gameId];
}
```

**Backward Compatibility**: 100% - all consuming code works unchanged

---

## Risk Analysis

### Low Risk
- **Phase 1** (Fix useGameActor): Very low risk, simple mapping
- **Phase 2** (Barrel exports): Zero risk, purely organizational

### No Risk
- Performance: ic-use-actor actors share state globally, multiple calls are cheap
- Memory: Actors are singletons, no duplication
- Authentication: Actors are authenticated once via `authenticateAll()`

---

## Comparison: OpenHouse vs Alexandria

| Feature | Alexandria | OpenHouse (Current) | OpenHouse (After Phase 1) |
|---------|-----------|---------------------|---------------------------|
| **ic-use-actor** | ✅ | ✅ | ✅ |
| **ic-use-identity** | ✅ | ✅ | ✅ |
| **ActorProvider** | ✅ | ✅ | ✅ |
| **Interceptors** | ✅ | ✅ | ✅ |
| **authenticateAll** | ✅ | ✅ | ✅ |
| **Barrel exports** | ✅ | ❌ | ⚠️ (Phase 2) |
| **Dynamic actor access** | ❌ (not needed) | ❌ (broken) | ✅ |
| **Liquidity features** | N/A | ❌ | ✅ |

---

## Success Criteria

### Must Have (Phase 1)
- [ ] `npm run build` succeeds
- [ ] No console errors on liquidity pages
- [ ] Pool stats load correctly
- [ ] Deposit/withdrawal flows initiate (can abort before signing)

### Nice to Have (Phase 2)
- [ ] Barrel export file created
- [ ] Updated imports across codebase
- [ ] Documentation added

### Validation
- [ ] All liquidity pages work: `/dice/liquidity`, `/plinko/liquidity`, `/blackjack/liquidity`
- [ ] No TypeScript errors
- [ ] No runtime errors in browser console
- [ ] Authentication flows work (login → see position → logout)

---

## Alternative: Long-term Ideal (If Refactoring Everything)

If we wanted to be 100% Alexandria-like and eliminate `useGameActor` entirely:

```typescript
// Create game-specific liquidity components
// src/components/liquidity/dice/DicePoolStats.tsx
import { useDice } from '@/hooks/actors';

export function DicePoolStats() {
  const { actor } = useDice();
  const stats = await actor.get_pool_stats();
  return <PoolStatsDisplay stats={stats} />;
}

// src/components/liquidity/plinko/PlinkoPoolStats.tsx
import { usePlinko } from '@/hooks/actors';

export function PlinkoPoolStats() {
  const { actor } = usePlinko();
  const stats = await actor.get_pool_stats();
  return <PoolStatsDisplay stats={stats} />;
}
```

**Tradeoff**: More explicit (good), but more code duplication (bad for maintenance).

**Verdict**: Not worth it for OpenHouse because:
1. All games share identical liquidity interface
2. Generic `GameLiquidity` component reduces code by ~60%
3. Alexandria doesn't have this use case (their canisters have different interfaces)

---

## Conclusion

**Recommended Action**: Implement Phase 1 (Fix useGameActor)

**Timeline**: 30 minutes

**Confidence**: Very high - simple, low-risk change

**Alignment with Alexandria**: 95% aligned after Phase 1, 100% aligned after Phase 2

The OpenHouse frontend already follows Alexandria's architecture very closely. The only missing piece is fixing the broken `useGameActor` hook, which is a 5-line change.
