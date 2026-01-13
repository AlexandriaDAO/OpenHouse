# Task
Add "Cosmic Encounters" system to Crash game: space objects (satellites, planets, aliens, galaxies) that appear during flight based on altitude. Higher multiplier = more frequent and exotic encounters.

## Instructions
1. Read `.ralph/PROGRESS.md`
2. If ALL items complete, output "RALPH_COMPLETE" and stop
3. Read `.ralph/SPEC.md` - it has detailed code examples for each priority
4. Pick NEXT uncompleted item
5. Implement with TypeScript following the patterns in SPEC.md
6. Build: `cd openhouse_frontend && npm run build`
7. If build fails, fix it
8. Update PROGRESS.md with what you did
9. Deploy: `./deploy.sh`

## Rules
- One priority per iteration
- Build must pass before deploying
- DO NOT git commit
- Test at: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io/crash
- DO NOT change: game logic, rocket images, betting UI

## Key Requirement
The encounters must be VISIBLE and NOTICEABLE - not subtle. Use emoji placeholders (🛰️🪐🛸🌌) until real pixel art is added. Players should clearly see objects appearing and fading as they fly through space.
