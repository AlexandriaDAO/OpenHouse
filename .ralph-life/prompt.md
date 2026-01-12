# Task

You are polishing the Game of Life UI in the OpenHouse frontend.

## Instructions

1. Read `.ralph-life/PROGRESS.md` - see what's done
2. If ALL items are complete, output exactly "RALPH_COMPLETE" and stop
3. Read `.ralph-life/SPEC.md` - detailed guide
4. Pick the NEXT uncompleted item
5. Implement it with TypeScript
6. Run `cd openhouse_frontend && npm run build`
7. If build fails, fix it
8. Update `.ralph-life/PROGRESS.md` - mark complete

## Rules

- One feature per session
- Build must pass
- Don't break game logic or backend sync
- Canvas animations go in render loop, React animations use framer-motion
- Keep performance smooth (262,144 cells)
- DO NOT git commit
- DO deploy: `./deploy.sh`
- Test at: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io/life

## Context

This is a multiplayer territorial warfare game with 8 elemental factions.
Main file is `src/pages/Life.tsx` (3,689 lines).
Rendering is Canvas 2D based.
