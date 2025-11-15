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
   - Backend changes:
     ```bash
     # Build affected backend(s)
     cargo build --target wasm32-unknown-unknown --release

     # Deploy to mainnet (deploys all canisters - simplest approach)
     ./deploy.sh
     ```
   - Frontend changes:
     ```bash
     cd openhouse_frontend
     npm run build
     cd ..
     ./deploy.sh
     ```
   - Both backend + frontend:
     ```bash
     cargo build --target wasm32-unknown-unknown --release
     cd openhouse_frontend && npm run build && cd ..
     ./deploy.sh
     ```

4. **Verify deployment**:
   ```bash
   # Check canister status
   dfx canister --network ic status plinko_backend

   # Test the live site
   echo "Visit: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io"
   ```

5. **Create PR** (MANDATORY):
   ```bash
   git add .
   git commit -m "fix(plinko): export drop_ball method and generate declarations"
   git push -u origin feature/plinko-drop-ball-fix
   gh pr create --title "Fix: Plinko drop_ball method not exported" --body "Implements PLINKO_DROP_BALL_FIX_PLAN.md

Deployed to mainnet:
- Frontend: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io
- Affected canisters: plinko_backend (weupr-2qaaa-aaaap-abl3q-cai)"
   ```

6. **Iterate autonomously**:
   - FOR i=1 to 5:
     - Check review: `gh pr view [NUM] --json comments`
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

**Branch:** `feature/plinko-drop-ball-fix`
**Worktree:** `/home/theseus/alexandria/openhouse-plinko-fix`

---

# Implementation Plan

## Current State Documentation

### Problem
The frontend is trying to call `drop_ball` method on the Plinko backend canister, but it's failing with:
```
Error from Canister weupr-2qaaa-aaaap-abl3q-cai: Canister has no update method 'drop_ball'
```

### Investigation Results
1. **Backend Code** (`plinko_backend/src/lib.rs:48-49`):
   - The `drop_ball` function EXISTS in the code
   - It's marked with `#[update]` decorator
   - The .did file also defines `drop_ball` method

2. **Deployed Canister** (`weupr-2qaaa-aaaap-abl3q-cai`):
   - `get_multipliers` works ✅
   - `greet` works ✅
   - `drop_ball` DOES NOT work ❌ (method not found)
   - `play_plinko` unknown (needs testing)

3. **Frontend** (`openhouse_frontend/src/pages/Plinko.tsx:63`):
   - Trying to call `actor.drop_ball(rows, riskVariant)`
   - Missing declarations in `openhouse_frontend/src/declarations/`
   - No `src/declarations/` directory exists

### Root Cause
The backend code has `drop_ball` defined but it wasn't exported properly during the last deployment. The canister on mainnet doesn't have this method available. Additionally, the frontend is missing the necessary declaration files.

## Implementation Steps

### Step 1: Fix Backend Export Issue
The backend code looks correct with `#[update]` decorator, but we need to ensure it's properly exported by redeploying.

**No code changes needed** - Just rebuild and redeploy.

### Step 2: Generate and Copy Declarations
After deployment, dfx should generate declarations. We need to ensure they're copied to the frontend.

### Step 3: Verify All Methods Work
Test that both `drop_ball` and `play_plinko` work after deployment.

## Deployment Notes
- **Affected Canister**: `plinko_backend` (weupr-2qaaa-aaaap-abl3q-cai)
- **Frontend**: Will receive updated declarations
- **Risk**: Low - Only redeploying existing code with proper exports

## Testing Checklist
- [ ] `drop_ball` method callable via dfx
- [ ] `play_plinko` method callable via dfx
- [ ] Frontend can successfully drop balls
- [ ] Declarations properly generated and copied
- [ ] No errors in browser console

## Implementation Commands

### 1. Build Plinko Backend
```bash
cd /home/theseus/alexandria/openhouse-plinko-fix
cargo build --target wasm32-unknown-unknown --release --manifest-path plinko_backend/Cargo.toml
```

### 2. Deploy to Mainnet
```bash
./deploy.sh --plinko-only
```

### 3. Test Methods
```bash
# Test drop_ball
dfx canister --network ic call weupr-2qaaa-aaaap-abl3q-cai drop_ball '(8, variant { Low })'

# Test play_plinko
dfx canister --network ic call weupr-2qaaa-aaaap-abl3q-cai play_plinko '(8, variant { Low })'
```

### 4. Verify Frontend Works
```bash
# Build frontend with new declarations
cd openhouse_frontend && npm run build && cd ..
./deploy.sh --frontend-only
```

## Success Criteria
1. Both `drop_ball` and `play_plinko` methods work via dfx CLI
2. Frontend Plinko game works without console errors
3. Ball drops successfully and shows results
4. Declarations exist in `openhouse_frontend/src/declarations/`