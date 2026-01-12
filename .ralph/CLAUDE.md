# Ralph Loop System

Ralph runs Claude in an infinite loop to autonomously complete tasks.

## How It Works

1. **SPEC.md** - Detailed guide with code file locations and implementation patterns
2. **PROGRESS.md** - Checklist tracking what's done and what's next
3. **prompt.md** - Short instructions (<150 words) telling the agent what to do

The loop reads prompt.md → agent picks next uncompleted item from PROGRESS.md → implements it → updates PROGRESS.md → repeats.

## Creating a New Category

```bash
mkdir .ralph-{name}
```

Create three files:

**SPEC.md** - The "pin" (detailed spec with file paths)
```markdown
# {Name} Spec
## Objective
What we're trying to achieve
## Key Files
- `src/path/to/file.tsx` - description
## Priority 1: {Task}
### Target: `filename.tsx`
Current state, goal, implementation pattern
```

**PROGRESS.md** - Tracks completion
```markdown
# Progress
## Completed
(none yet)
## Next Up
- [ ] Priority 1: {Task}
- [ ] Priority 2: {Task}
```

**prompt.md** - Keep it SHORT
```markdown
# Task
{One sentence description}
## Instructions
1. Read `.ralph-{name}/PROGRESS.md`
2. If ALL items complete, output "RALPH_COMPLETE" and stop
3. Read `.ralph-{name}/SPEC.md`
4. Pick NEXT uncompleted item
5. Implement it
6. Build: `cd openhouse_frontend && npm run build`
7. Update PROGRESS.md
## Rules
- One feature per session
- Build must pass
- DO NOT git commit
- DO deploy: `./deploy.sh`
```

## Running

```bash
./.ralph/loop.sh {name}           # unattended
./.ralph/loop.sh {name} --attended  # pause between iterations
```

## Key Principle

Simple prompts beat complex ones. The SPEC.md does the heavy lifting.

## For Proper PR Workflow

See `.claude/workflows/ralph-pursuit-methodology.md` to run Ralph in isolated worktrees instead of polluting the main repo. This enables:
- Clean PR reviews
- Parallel Ralph loops
- Easy rollback
- Proper git history
