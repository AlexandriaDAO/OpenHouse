# Ralph Pursuit Methodology

**Purpose:** Transform feature requests into Ralph loop specs for autonomous execution in isolated worktrees.

**Key Difference from Plan-Pursuit:** Instead of writing a `PLAN_*.md` for an agent to implement, you create Ralph spec files (SPEC.md, PROGRESS.md, prompt.md) that drive an autonomous loop.

## Workflow

### 1. Sync Main Repo (MANDATORY FIRST)
```bash
cd /home/theseus/alexandria/openhouse
git checkout master
git pull
```

### 2. Create Isolated Worktree
```bash
git worktree add ../openhouse-[feature] -b feature/[feature-name] master
cd ../openhouse-[feature]
mkdir .ralph-[feature]
```

### 3. Research Phase
Explore the codebase to understand:
- Which files need changes
- Current implementation patterns
- Dependencies and constraints

```bash
# Find related files
rg "keyword" --files-with-matches

# Read implementations
cat src/path/to/file.tsx
```

### 4. Create Ralph Spec Files

Create these three files in `.ralph-[feature]/`:

**SPEC.md** - The detailed "pin" with strong file linkage
```markdown
# [Feature] Spec

## Objective
[Clear description of what we're building]

## Key Files
- `src/path/file.tsx` - [what it does, current state]
- `src/other/file.ts` - [what it does, current state]

## Priority 1: [First Task]
### Target: `src/path/file.tsx`
**Current state:** [what exists now]
**Goal:** [what we want]
**Pattern:**
\`\`\`tsx
// Example implementation approach
\`\`\`

## Priority 2: [Second Task]
...

## Constraints
- [Don't break X]
- [Must maintain Y]
- [Performance requirement Z]

## Quality Gate
\`\`\`bash
cd openhouse_frontend && npm run build
\`\`\`
```

**PROGRESS.md** - Task tracker
```markdown
# Progress

## Completed
(none yet)

## Next Up
- [ ] Priority 1: [Task description]
- [ ] Priority 2: [Task description]
- [ ] Priority 3: [Task description]
```

**prompt.md** - Short loop instructions
```markdown
# Task
[One sentence: what the loop is doing]

## Instructions
1. Read `.ralph-[feature]/PROGRESS.md`
2. If ALL items complete, output "RALPH_COMPLETE" and stop
3. Read `.ralph-[feature]/SPEC.md`
4. Pick NEXT uncompleted item
5. Implement with TypeScript
6. Build: `cd openhouse_frontend && npm run build`
7. If build fails, fix it
8. Update PROGRESS.md

## Rules
- One feature per session
- Build must pass
- DO NOT git commit
- DO deploy: `./deploy.sh`
- Test at: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io
```

**loop.sh** - Copy or create the runner
```bash
cp /home/theseus/alexandria/openhouse/.ralph/loop.sh .ralph-[feature]/
```

### 5. Present Spec for User Review (MANDATORY)

**DO NOT run the loop yourself.** Present a summary to the user:

```markdown
## Ralph Spec Ready for Review

**Feature:** [name]
**Worktree:** `/home/theseus/alexandria/openhouse-[feature]`
**Branch:** `feature/[feature-name]`

### Tasks (from PROGRESS.md)
1. [ ] [Priority 1 task]
2. [ ] [Priority 2 task]
3. [ ] [Priority 3 task]

### Key Files Affected
- `src/path/file.tsx` - [what changes]
- `src/other/file.ts` - [what changes]

### Constraints
- [Key constraint 1]
- [Key constraint 2]

---

**To run the loop:**
\`\`\`bash
cd /home/theseus/alexandria/openhouse-[feature]
./.ralph-[feature]/loop.sh
\`\`\`

**To run attended (pause between iterations):**
\`\`\`bash
./.ralph-[feature]/loop.sh --attended
\`\`\`

Want me to adjust the spec before you run it?
```

### 6. User Runs Loop (When Ready)

User decides when to start:
```bash
cd /home/theseus/alexandria/openhouse-[feature]
./.ralph-[feature]/loop.sh
```

### 7. After Loop Completes

User reviews and creates PR:
```bash
# Review changes
git diff

# Commit
git add .
git commit -m "feat: [description]"
git push -u origin feature/[feature-name]

# Create PR
gh pr create --title "[Feature]" --body "## Summary
Ralph-automated implementation.

## Tasks Completed
- [x] Task 1
- [x] Task 2

## Live at
https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io
"
```

### 8. Cleanup (After PR Merged)
```bash
cd /home/theseus/alexandria/openhouse
git worktree remove ../openhouse-[feature]
git branch -d feature/[feature-name]
```

---

## Planner Checklist

- [ ] Main repo synced (`git pull`)
- [ ] Worktree created and switched to
- [ ] Codebase researched (files identified, patterns understood)
- [ ] SPEC.md created with file linkage
- [ ] PROGRESS.md created with prioritized tasks
- [ ] prompt.md created (short, <150 words)
- [ ] loop.sh copied to worktree
- [ ] **Summary presented to user for review**
- [ ] User informed how to run the loop
- [ ] **DID NOT run the loop** (user's decision)

---

## Key Differences from Plan-Pursuit

| Aspect | Plan-Pursuit | Ralph-Pursuit |
|--------|--------------|---------------|
| Output | PLAN_*.md with pseudocode | SPEC.md + PROGRESS.md + prompt.md |
| Execution | Agent reads plan, implements | Loop runs autonomously |
| Iterations | Single pass | Multiple passes until done |
| Commits | Agent commits each change | No commits during loop |
| User control | Less (agent runs) | More (user starts loop) |
