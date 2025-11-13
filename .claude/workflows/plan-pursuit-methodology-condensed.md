# Plan-Pursuit Methodology (Condensed) - OpenHouse Casino

**Purpose:** Transform feature requests into exhaustive implementation plans for autonomous execution.

## Task Classification

**NEW FEATURE**: Build new functionality → additive approach
**REFACTORING**: Improve existing code → subtractive + targeted fixes
**BUG FIX**: Restore broken behavior → minimal changes

## Workflow Steps

### 1. Sync Main Repo Master (MANDATORY FIRST STEP)
```bash
# Ensure main repo master is up to date
cd /home/theseus/alexandria/openhouse
git checkout master
git pull
```
**CRITICAL**: Main repo master is READ-ONLY. Never commit there. Only `git pull`.

### 2. Create Worktree (MANDATORY SECOND STEP)
```bash
cd /home/theseus/alexandria/openhouse
git worktree add ../openhouse-[FEATURE] -b feature/[feature-name] master
cd ../openhouse-[FEATURE]
```
All planning happens IN the worktree, not main repo.

### 3. Research (30-60 min)
```bash
# Find all related files
rg "keyword" --files-with-matches

# Read existing game implementations
rg "keyword" crash_backend/ plinko_backend/ mines_backend/ dice_backend/

# Test canister APIs before implementing
dfx canister --network ic call fws6k-tyaaa-aaaap-qqc7q-cai <method> '(args)'  # Crash
dfx canister --network ic call weupr-2qaaa-aaaap-abl3q-cai <method> '(args)'  # Plinko
dfx canister --network ic call wvrcw-3aaaa-aaaah-arm4a-cai <method> '(args)'  # Mines
dfx canister --network ic call whchi-hyaaa-aaaao-a4ruq-cai <method> '(args)'  # Dice
```

### 4. Document Current State
- File tree (before/after)
- Existing implementations with line numbers
- Dependencies and constraints
- Which games/canisters are affected
- For refactoring: list dead code, duplicates, complexity

### 5. Plan Implementation
Use PSEUDOCODE for all code:
```markdown
## Backend: `crash_backend/src/lib.rs` (NEW/MODIFY)
\`\`\`rust
// PSEUDOCODE
pub async fn new_game_feature() -> Result<T> {
    // Step-by-step logic
    // Use IC VRF for randomness
    // Apply house edge correctly
}
\`\`\`

## Frontend: `openhouse_frontend/src/components/Game.tsx` (NEW/MODIFY)
\`\`\`typescript
// PSEUDOCODE
export function GameComponent() {
    // Implementation steps
    // Connect to backend canister
    // Handle ICP transactions
}
\`\`\`
```

### 6. Testing Requirements

**NONE REQUIRED** - This is experimental pre-production. Manual verification only.

Optional manual checks:
```bash
# Build check
cargo build --target wasm32-unknown-unknown

# Frontend build check
cd openhouse_frontend && npm run build
```

### 7. Embed Orchestrator (MANDATORY TOP OF PLAN)
Every plan MUST start with this exact header (fill in placeholders):
```markdown
# 🤖 AUTONOMOUS PR ORCHESTRATOR - DO NOT SKIP

**You are an autonomous PR orchestrator. Your ONLY job is to implement this plan and create a PR.**

## Isolation Check (RUN FIRST)
\`\`\`bash
REPO_ROOT=$(git rev-parse --show-toplevel)
if [ "$REPO_ROOT" = "/home/theseus/alexandria/openhouse" ]; then
    echo "❌ FATAL: In main repo. Must be in worktree."
    echo "Worktree: /home/theseus/alexandria/openhouse-[FEATURE]"
    exit 1
fi
echo "✅ In isolated worktree: $REPO_ROOT"
\`\`\`

## Your Autonomous Workflow (NO QUESTIONS ALLOWED)
1. **Verify isolation** - You must be in worktree: `/home/theseus/alexandria/openhouse-[FEATURE]`
2. **Implement feature** - Follow plan sections below
3. **Build & Deploy to Mainnet**:
   - Backend changes:
     \`\`\`bash
     # Build affected backend(s)
     cargo build --target wasm32-unknown-unknown --release

     # Deploy to mainnet (deploys all canisters - simplest approach)
     ./deploy.sh
     \`\`\`
   - Frontend changes:
     \`\`\`bash
     cd openhouse_frontend
     npm run build
     cd ..
     ./deploy.sh
     \`\`\`
   - Both backend + frontend:
     \`\`\`bash
     cargo build --target wasm32-unknown-unknown --release
     cd openhouse_frontend && npm run build && cd ..
     ./deploy.sh
     \`\`\`

4. **Verify deployment**:
   \`\`\`bash
   # Check canister status
   dfx canister --network ic status [canister_name]

   # Test the live site
   echo "Visit: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io"
   \`\`\`

5. **Create PR** (MANDATORY):
   \`\`\`bash
   git add .
   git commit -m "[Descriptive message]"
   git push -u origin feature/[feature-name]
   gh pr create --title "[Feature]: [Title]" --body "Implements [PLAN].md

Deployed to mainnet:
- Frontend: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io
- Affected canisters: [list canisters]"
   \`\`\`

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

**Branch:** `feature/[feature-name]`
**Worktree:** `/home/theseus/alexandria/openhouse-[FEATURE]`

---

# Implementation Plan

[Plan sections follow below...]
```

**Template Structure:**
1. Orchestrator header (above) at top
2. Current state documentation
3. Implementation pseudocode
4. Deployment notes (which canisters affected)

### 8. Commit Plan & Handoff
```bash
git add [PLAN].md
git commit -m "Add implementation plan for [feature]"
git push -u origin feature/[name]
```

**Final response:**
```
The plan is ready with embedded PR orchestrator.

When done, return this prompt to the user: "Execute @/home/theseus/alexandria/openhouse-[FEATURE]/[PLAN].md"

The implementing agent MUST:
1. Read the orchestrator header (cannot skip - it's at the top)
2. Verify worktree isolation
3. Implement the plan
4. Deploy to mainnet (mandatory)
5. Create PR (mandatory step)
6. Iterate autonomously until approved
```
Then STOP. Do not implement.

## Refactoring Rules

**DO:**
- Delete dead code first
- Fix in place (modify existing files)
- Consolidate duplicates (N→1)
- Target negative LOC

**DON'T:**
- Build new infrastructure alongside old
- Create utilities without adoption
- Add "Phase 1 foundations"
- Create more files than deleted

## OpenHouse-Specific Notes

### Canister IDs
- **Crash Backend**: `fws6k-tyaaa-aaaap-qqc7q-cai`
- **Plinko Backend**: `weupr-2qaaa-aaaap-abl3q-cai`
- **Mines Backend**: `wvrcw-3aaaa-aaaah-arm4a-cai`
- **Dice Backend**: `whchi-hyaaa-aaaao-a4ruq-cai`
- **Frontend**: `pezw3-laaaa-aaaal-qssoa-cai`

### Frontend Development
```bash
# Development with hot reload
cd openhouse_frontend
npm run dev

# Production build (before deployment)
npm run build
```

### Deployment Strategy
```bash
# Deploy everything (simplest - recommended)
./deploy.sh

# Or use specific flags if needed
./deploy.sh --crash-only      # Crash game backend only
./deploy.sh --plinko-only     # Plinko game backend only
./deploy.sh --mines-only      # Mines game backend only
./deploy.sh --dice-only       # Dice game backend only
./deploy.sh --frontend-only   # Frontend only
```

### Game Design Principles
- **House Edge**: Always 3% (transparent)
- **Randomness**: Use IC VRF (`ic_cdk::api::management_canister::main::raw_rand()`)
- **Min Bet**: 1 ICP across all games
- **Provably Fair**: Commit-reveal for verification
- **Transparent Odds**: All multiplier tables public

### Multi-Game Changes
When a change affects multiple games:
1. List all affected games in plan
2. Show pseudocode for each game backend
3. Deploy with `./deploy.sh` (deploys all - simplest)
4. In PR body, list which games/features were updated

## Plan Checklist

- [ ] Worktree created first
- [ ] Orchestrator header EMBEDDED at top of plan (not referenced)
- [ ] Current state documented
- [ ] Affected games/canisters identified
- [ ] Implementation in pseudocode
- [ ] Deployment strategy noted
- [ ] Plan committed to feature branch
- [ ] Handoff command provided with PR creation reminder

## Critical Reminders

- **Mainnet-only**: No local testing - all changes go to production
- **Plan in worktree**: Never pollute main repo
- **Use pseudocode**: Implementer writes real code
- **One responsibility**: You plan, they implement
- **Isolation mandatory**: Multiple agents work in parallel
- **VRF for randomness**: Never use weak randomness sources
- **3% house edge**: Maintain across all games for consistency
