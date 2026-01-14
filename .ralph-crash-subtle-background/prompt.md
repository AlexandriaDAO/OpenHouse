# Task
Remove cosmic encounters from Crash game and make background subtle.

## Instructions
1. Read `.ralph-crash-subtle-background/PROGRESS.md`
2. If ALL items marked `[x]`, output "RALPH_COMPLETE" and stop
3. Read `.ralph-crash-subtle-background/SPEC.md`
4. Pick NEXT uncompleted `[ ]` item
5. Find the code pattern in SPEC.md (line numbers are approximate - use the code snippets to locate)
6. DELETE or MODIFY as specified
7. Build: `cd openhouse_frontend && npm run build`
8. If build fails, fix immediately (likely missed a reference)
9. Mark item `[x]` in PROGRESS.md with brief note

## Critical Notes
- Line numbers SHIFT after deletions - use code patterns to find targets
- Priority 3 requires KEEPING Z_INDEX (just remove ENCOUNTERS key)
- Build after EVERY priority to catch errors early
- When all tasks done: `./deploy.sh` then output "RALPH_COMPLETE"

## Rules
- One priority per iteration
- Build MUST pass before marking complete
- DO NOT git commit
- Test at: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io

## Files
- `openhouse_frontend/src/components/game-specific/crash/CrashCanvas.tsx`
- `openhouse_frontend/src/components/game-specific/crash/CrashRocket.css`
