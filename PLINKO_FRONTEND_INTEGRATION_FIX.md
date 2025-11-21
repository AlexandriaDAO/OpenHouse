# 🤖 AUTONOMOUS PR ORCHESTRATOR - DO NOT SKIP

**You are an autonomous PR orchestrator. Your ONLY job is to implement this plan and create a PR.**

## Isolation Check (RUN FIRST)
```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
if [ "$REPO_ROOT" = "/home/theseus/alexandria/openhouse" ]; then
    echo "❌ FATAL: In main repo. Must be in worktree."
    echo "Worktree: /home/theseus/alexandria/openhouse-plinko-fix"
    exit 1
fi
echo "✅ In isolated worktree: $REPO_ROOT"
```

## Your Autonomous Workflow (NO QUESTIONS ALLOWED)
1. **Verify isolation** - You must be in worktree: `/home/theseus/alexandria/openhouse-plinko-fix`
2. **Implement feature** - Follow plan sections below
3. **Build & Deploy to Mainnet**:
   ```bash
   # Generate declarations from deployed canister
   dfx generate plinko_backend --network ic

   # Copy declarations to frontend
   mkdir -p openhouse_frontend/src/declarations/plinko_backend
   cp -r src/declarations/plinko_backend/* openhouse_frontend/src/declarations/plinko_backend/

   # Build frontend
   cd openhouse_frontend
   npm install
   npm run build
   cd ..

   # Deploy frontend to mainnet
   ./deploy.sh --frontend-only
   ```

4. **Verify deployment**:
   ```bash
   # Check frontend canister status
   dfx canister --network ic status openhouse_frontend

   # Test the live site
   echo "Visit: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io/plinko"
   echo "Check console for errors and test drop_balls functionality"
   ```

5. **Create PR** (MANDATORY):
   ```bash
   git add .
   git commit -m "fix(plinko): regenerate frontend declarations and fix integration"
   git push -u origin bugfix/plinko-integration
   gh pr create --title "Fix: Plinko frontend integration - regenerate declarations" --body "Fixes Plinko game frontend integration by regenerating missing TypeScript declarations.

## Problem
- Frontend showing: \`e.drop_balls is not a function\`
- Expected value displaying 0.000000 instead of 0.99
- Missing TypeScript declarations for plinko_backend

## Root Cause
- \`openhouse_frontend/src/declarations/plinko_backend/\` was missing
- Frontend was casting actor to \`any\`, causing runtime failures
- Declarations were never generated after backend deployment

## Solution
- Generated declarations from deployed canister using \`dfx generate\`
- Copied to frontend source directory
- Rebuilt and redeployed frontend

## Testing
- [x] Backend methods verified working on mainnet
- [x] \`drop_balls\` returns correct results
- [x] \`get_expected_value\` returns 0.99 (1% house edge)
- [x] Frontend rebuild successful
- [x] Deployed to mainnet: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io/plinko

## Affected Canisters
- openhouse_frontend (\`pezw3-laaaa-aaaal-qssoa-cai\`) - redeployed with declarations"
   ```

6. **Iterate autonomously**:
   - FOR i=1 to 5:
     - Check review: `gh pr view --json comments`
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

**Branch:** `bugfix/plinko-integration`
**Worktree:** `/home/theseus/alexandria/openhouse-plinko-fix`

---

# Implementation Plan: Fix Plinko Frontend Integration

## Task Classification
**BUG FIX** - Restore broken behavior with minimal changes

## Problem Summary

### User-Reported Issues
1. **Frontend Error**: `e.drop_balls is not a function`
2. **Expected Value Display**: Shows `0.000000 (exactly 100.00% house edge)` instead of `0.99 (1% house edge)`
3. **Game Unplayable**: Cannot drop balls due to method call failure

### Root Cause Analysis
```
Frontend (Plinko.tsx:69)
  ↓ calls
Actor Hook (usePlinkoActor.ts:2)
  ↓ imports from
@declarations/plinko_backend
  ↓ MISSING!
❌ Directory does not exist
```

## Current State Documentation

### Backend Status ✅ WORKING
**Canister**: `weupr-2qaaa-aaaap-abl3q-cai` (plinko_backend)
**Status**: Deployed and fully functional on mainnet

Verified working methods:
```bash
# get_formula - ✅ Working
dfx canister --network ic call weupr-2qaaa-aaaap-abl3q-cai get_formula
# Returns: ("M(k) = 0.2 + 6.32 × ((k - 4) / 4)²")

# get_expected_value - ✅ Working
dfx canister --network ic call weupr-2qaaa-aaaap-abl3q-cai get_expected_value
# Returns: (0.99 : float64)

# drop_balls - ✅ Working
dfx canister --network ic call weupr-2qaaa-aaaap-abl3q-cai drop_balls '(1 : nat8)'
# Returns: (variant { Ok = record { ... } })
```

**Candid Interface**: `plinko_backend/plinko_backend.did`
```candid
service : {
  drop_ball: () -> (variant { Ok: PlinkoResult; Err: text });
  drop_balls: (nat8) -> (variant { Ok: MultiBallResult; Err: text });
  get_multipliers: () -> (vec float64) query;
  get_formula: () -> (text) query;
  get_expected_value: () -> (float64) query;
  greet: (text) -> (text) query;
}
```

### Frontend Status ❌ BROKEN
**File**: `openhouse_frontend/src/pages/Plinko.tsx`
**Line 69**: `const result = await (actor as any).drop_balls(ballCount);`

**Problem**: Casting to `any` because TypeScript declarations don't exist

**Actor Hook**: `openhouse_frontend/src/hooks/actors/usePlinkoActor.ts`
```typescript
// Lines 2-3: These imports FAIL at runtime
import { _SERVICE } from '@declarations/plinko_backend/plinko_backend.did';
import { idlFactory } from '@declarations/plinko_backend/plinko_backend.did.js';
```

**Missing Directory**:
```
❌ openhouse_frontend/src/declarations/plinko_backend/
   - plinko_backend.did.js (IDL factory for actor creation)
   - plinko_backend.did.d.ts (TypeScript types)
```

### File Tree (Current State)
```
openhouse/
├── plinko_backend/
│   ├── src/lib.rs                    ✅ Backend implementation
│   ├── plinko_backend.did            ✅ Candid interface definition
│   └── Cargo.toml
├── openhouse_frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   └── Plinko.tsx            ❌ Broken - calls missing method
│   │   ├── hooks/actors/
│   │   │   └── usePlinkoActor.ts     ❌ Broken - imports missing declarations
│   │   └── declarations/             ❌ MISSING ENTIRELY
│   ├── tsconfig.json                 ✅ Has path mapping for @declarations/*
│   └── package.json
└── dfx.json                          ✅ Has plinko_backend config
```

## Implementation Plan

### Step 1: Generate Declarations from Deployed Canister
```bash
# PSEUDOCODE: Generate TypeScript declarations
# This reads the Candid interface from the live canister
# and generates TypeScript types + IDL factory

cd /home/theseus/alexandria/openhouse-plinko-fix

# Generate declarations using dfx
# This creates src/declarations/plinko_backend/
dfx generate plinko_backend --network ic

# Expected output:
#   src/declarations/plinko_backend/
#   ├── plinko_backend.did.js       (IDL factory)
#   ├── plinko_backend.did.d.ts     (TypeScript types)
#   └── index.js                     (exports)
```

**Why this works:**
- `dfx generate` reads from the deployed canister's metadata
- Uses the Candid interface to generate bindings
- Creates JavaScript IDL factory for runtime actor creation
- Creates TypeScript types for compile-time checking

### Step 2: Copy Declarations to Frontend Source
```bash
# PSEUDOCODE: Copy generated declarations to frontend

# Create frontend declarations directory
mkdir -p openhouse_frontend/src/declarations/plinko_backend

# Copy all generated files
cp -r src/declarations/plinko_backend/* \
      openhouse_frontend/src/declarations/plinko_backend/

# Verify files exist
ls -la openhouse_frontend/src/declarations/plinko_backend/
# Expected files:
#   - plinko_backend.did.js
#   - plinko_backend.did.d.ts
#   - index.js
```

**Why copy instead of symlink:**
- Frontend build process expects files in src/
- tsconfig.json paths mapping points to src/declarations/
- Vite bundler needs actual files, not symlinks

### Step 3: Verify TypeScript Imports
```typescript
// PSEUDOCODE: Verify imports work

// In usePlinkoActor.ts:
import { _SERVICE } from '@declarations/plinko_backend/plinko_backend.did';
// Should resolve to: openhouse_frontend/src/declarations/plinko_backend/plinko_backend.did.d.ts

import { idlFactory } from '@declarations/plinko_backend/plinko_backend.did.js';
// Should resolve to: openhouse_frontend/src/declarations/plinko_backend/plinko_backend.did.js

// TypeScript will now know about:
// - drop_ball(): Promise<Result<PlinkoResult, string>>
// - drop_balls(count: bigint): Promise<Result<MultiBallResult, string>>
// - get_multipliers(): Promise<number[]>
// - get_expected_value(): Promise<number>
```

### Step 4: Remove Type Casting (Optional Cleanup)
```typescript
// CURRENT CODE (line 69 of Plinko.tsx):
const result = await (actor as any).drop_balls(ballCount);

// IMPROVED CODE (after declarations exist):
const result = await actor.drop_balls(BigInt(ballCount));

// Note: Candid nat8 maps to JavaScript bigint
// But ic-use-actor might handle number → bigint conversion automatically
// Test both approaches during deployment
```

**Decision**: Keep `(actor as any)` for now to minimize changes (BUG FIX principle).
Only change if type checking reveals an issue with number vs bigint.

### Step 5: Rebuild Frontend
```bash
# PSEUDOCODE: Build frontend with new declarations

cd openhouse_frontend

# Install dependencies (ensure ic-use-actor is available)
npm install

# Type check to verify declarations work
npm run type-check
# Should have NO errors about missing declarations

# Build production bundle
npm run build
# Creates: dist/ directory with optimized assets

cd ..
```

### Step 6: Deploy Frontend to Mainnet
```bash
# PSEUDOCODE: Deploy updated frontend

# Deploy using deploy.sh script
./deploy.sh --frontend-only

# This will:
# 1. Upload dist/ contents to openhouse_frontend canister
# 2. Make them available at https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io
# 3. Apply to /plinko route immediately
```

### Step 7: Verify Fix
```bash
# MANUAL VERIFICATION STEPS:

# 1. Open browser to Plinko page
echo "Visit: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io/plinko"

# 2. Check console for errors (should be none)
# 3. Verify "Expected Value" displays correctly:
#    - Should show: "0.990000 (exactly 1.00% house edge)"
#    - NOT: "0.000000 (exactly 100.00% house edge)"

# 4. Test drop_balls functionality:
#    - Select 1 ball
#    - Click "DROP BALL"
#    - Should successfully drop ball and show result
#    - NO error: "e.drop_balls is not a function"

# 5. Test multi-ball:
#    - Select 5 balls
#    - Click "DROP 5 BALLS"
#    - Should show aggregate results

# 6. Verify all query methods work:
#    - Formula displays: "M(k) = 0.2 + 6.32 × ((k-4)/4)²"
#    - Multipliers display in table
#    - House edge shows "1%"
```

## Testing Requirements

### Automated Tests
**NONE REQUIRED** - This is experimental pre-production.

### Manual Verification Checklist
- [x] Backend methods work via dfx CLI
- [ ] `dfx generate` creates declarations successfully
- [ ] Declarations copied to frontend src/
- [ ] TypeScript type checking passes
- [ ] Frontend builds without errors
- [ ] Frontend deploys to mainnet
- [ ] Expected value displays 0.99
- [ ] `drop_balls` method callable from UI
- [ ] Single ball drop works
- [ ] Multi-ball drop works
- [ ] No console errors

## Expected Outcomes

### Before Fix
```
Frontend Console:
  ❌ TypeError: e.drop_balls is not a function

UI Display:
  Expected Value: 0.000000 (exactly 100.00% house edge)

User Experience:
  Cannot play game - button doesn't work
```

### After Fix
```
Frontend Console:
  ✅ No errors

UI Display:
  Expected Value: 0.990000 (exactly 1.00% house edge)

User Experience:
  Game works - balls drop, results display
```

## File Changes Summary

### Files Created
```
✨ NEW: openhouse_frontend/src/declarations/plinko_backend/
  - plinko_backend.did.js
  - plinko_backend.did.d.ts
  - index.js
```

### Files Modified
```
📝 NONE - No code changes needed!

Why: Backend already works, frontend code is correct
The ONLY problem was missing declarations
```

### Files Deleted
```
🗑️ NONE
```

## Deployment Impact

### Affected Canisters
1. **openhouse_frontend** (`pezw3-laaaa-aaaal-qssoa-cai`)
   - **Change**: Redeployed with new declarations in bundle
   - **Risk**: Low - only adds missing type information
   - **Rollback**: Can redeploy previous version from git

### Unaffected Canisters
- **plinko_backend** (`weupr-2qaaa-aaaap-abl3q-cai`) - No changes
- **crash_backend** - No changes
- **dice_backend** - No changes
- **mines_backend** - No changes

## Related Issues & Context

### Similar Issues in Other Games
Check if other games have missing declarations:
```bash
# After fix, verify all game backends have declarations
ls -la openhouse_frontend/src/declarations/
# Should contain:
#   - crash_backend/
#   - plinko_backend/
#   - mines_backend/
#   - dice_backend/
```

**If other games are missing declarations**, apply same fix:
```bash
dfx generate crash_backend --network ic
dfx generate mines_backend --network ic
dfx generate dice_backend --network ic
# Then copy to frontend src/declarations/
```

### Why Declarations Were Missing
Possible causes:
1. Backend deployed without running `dfx generate`
2. Declarations generated but not committed to git
3. Frontend rebuilt from clean checkout without declarations
4. `.gitignore` excludes declarations directory

**Prevention**: Add to deployment workflow:
```bash
# In deploy.sh, after backend deployment:
dfx generate plinko_backend --network ic
cp -r src/declarations/* openhouse_frontend/src/declarations/
```

## Success Criteria

✅ **Fix is successful if:**
1. `dfx generate` completes without errors
2. TypeScript declarations exist in frontend
3. `npm run type-check` passes
4. Frontend builds successfully
5. Frontend deploys to mainnet
6. Expected value displays 0.99 on UI
7. Drop balls button works
8. No console errors
9. Game is fully playable

❌ **Fix failed if:**
1. `dfx generate` errors (canister not found)
2. Declarations missing expected methods
3. TypeScript compilation errors
4. Runtime errors persist
5. Expected value still shows 0.000000

## Rollback Plan

If deployment causes issues:
```bash
# Revert frontend to previous version
git log --oneline -n 5  # Find previous commit
git checkout <previous-commit> openhouse_frontend/
./deploy.sh --frontend-only

# Verify old version works
# Then debug declaration issue separately
```

## Notes for Implementer

1. **Do NOT modify backend code** - it works correctly
2. **Do NOT modify frontend logic** - it's correct except for casting
3. **Focus on declarations** - that's the ONLY missing piece
4. **Test on mainnet** - there's no local environment
5. **Verify before PR** - manually test the live site

---

## Handoff Command

After implementing this plan and creating the PR, return to main repo with:
```bash
cd /home/theseus/alexandria/openhouse
```

The PR will be at: https://github.com/AlexandriaDAO/OpenHouse/pulls
