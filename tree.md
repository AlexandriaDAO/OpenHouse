# OpenHouse Casino - Project Structure

Generated on: 2025-11-13T13:00:55.154Z

```
├── .claude/
│   ├── settings.local.json (37 lines)
│   └── workflows/
│       └── plan-pursuit-methodology-condensed.md (289 lines)
├── CLAUDE.md (347 lines)
├── Cargo.toml (13 lines)
├── DAOPAD_DEPLOYMENT_ANALYSIS.md (581 lines)
├── DAOPAD_DEPLOYMENT_EXECUTIVE_SUMMARY.txt (319 lines)
├── DICE_GAME_IMPLEMENTATION_PLAN.md (633 lines)
├── INSTANT_DICE_RANDOMNESS_PLAN.md (436 lines)
├── canister_ids.json (17 lines)
├── crash_backend/
│   ├── Cargo.toml (17 lines)
│   ├── crash_backend.did (49 lines)
│   └── src/
│       └── lib.rs (292 lines)
├── daopad_deployment_analysis.md (581 lines)
├── daopad_deployment_summary.txt (317 lines)
├── deploy.sh (315 lines)
├── dfx.json (48 lines)
├── dice_backend/
│   ├── Cargo.toml (18 lines)
│   ├── dice_backend.did (44 lines)
│   └── src/
│       └── lib.rs (651 lines)
├── mines_backend/
│   ├── Cargo.toml (17 lines)
│   ├── mines_backend.did (30 lines)
│   └── src/
│       └── lib.rs (185 lines)
├── openhouse_frontend/
│   ├── BALANCE_GUIDE.md (297 lines)
│   ├── build-auth.js (16 lines)
│   ├── index.html (15 lines)
│   ├── package.json (33 lines)
│   ├── postcss.config.js (7 lines)
│   ├── src/
│   │   ├── App.tsx (35 lines)
│   │   ├── components/
│   │   │   ├── AuthButton.tsx (120 lines)
│   │   │   ├── GameCard.tsx (42 lines)
│   │   │   └── Layout.tsx (64 lines)
│   │   ├── declarations/
│   │   │   ├── crash_backend/
│   │   │   │   ├── crash_backend.did (49 lines)
│   │   │   │   ├── crash_backend.did.d.ts (51 lines)
│   │   │   │   ├── crash_backend.did.js (66 lines)
│   │   │   │   ├── index.d.ts (51 lines)
│   │   │   │   └── index.js (43 lines)
│   │   │   ├── crash_frontend/
│   │   │   │   ├── crash_frontend.did (268 lines)
│   │   │   │   ├── crash_frontend.did.d.ts (247 lines)
│   │   │   │   ├── crash_frontend.did.js (299 lines)
│   │   │   │   ├── index.d.ts (51 lines)
│   │   │   │   └── index.js (43 lines)
│   │   │   ├── dice_backend/
│   │   │   │   ├── dice_backend.did (39 lines)
│   │   │   │   ├── dice_backend.did.d.ts (43 lines)
│   │   │   │   ├── dice_backend.did.js (48 lines)
│   │   │   │   ├── index.d.ts (51 lines)
│   │   │   │   └── index.js (43 lines)
│   │   │   ├── mines_backend/
│   │   │   │   ├── index.d.ts (51 lines)
│   │   │   │   ├── index.js (43 lines)
│   │   │   │   ├── mines_backend.did (30 lines)
│   │   │   │   ├── mines_backend.did.d.ts (34 lines)
│   │   │   │   └── mines_backend.did.js (31 lines)
│   │   │   ├── openhouse_frontend/
│   │   │   │   ├── index.d.ts (51 lines)
│   │   │   │   ├── index.js (43 lines)
│   │   │   │   ├── openhouse_frontend.did (268 lines)
│   │   │   │   ├── openhouse_frontend.did.d.ts (247 lines)
│   │   │   │   └── openhouse_frontend.did.js (299 lines)
│   │   │   └── plinko_backend/
│   │   │       ├── index.d.ts (51 lines)
│   │   │       ├── index.js (43 lines)
│   │   │       ├── plinko_backend.did (37 lines)
│   │   │       ├── plinko_backend.did.d.ts (38 lines)
│   │   │       └── plinko_backend.did.js (45 lines)
│   │   ├── hooks/
│   │   │   └── actors/
│   │   │       ├── useCrashActor.ts (14 lines)
│   │   │       ├── useDiceActor.ts (14 lines)
│   │   │       ├── useLedgerActor.ts (14 lines)
│   │   │       ├── useMinesActor.ts (14 lines)
│   │   │       └── usePlinkoActor.ts (14 lines)
│   │   ├── index.css (28 lines)
│   │   ├── main.tsx (11 lines)
│   │   ├── pages/
│   │   │   ├── Crash.tsx (140 lines)
│   │   │   ├── Dice.tsx (547 lines)
│   │   │   ├── Home.tsx (103 lines)
│   │   │   ├── Mines.tsx (144 lines)
│   │   │   └── Plinko.tsx (148 lines)
│   │   ├── providers/
│   │   │   ├── ActorProvider.tsx (104 lines)
│   │   │   ├── AuthProvider.tsx (127 lines)
│   │   │   └── BalanceProvider.tsx (83 lines)
│   │   ├── types/
│   │   │   └── ledger.ts (35 lines)
│   │   ├── types.ts (19 lines)
│   │   └── utils/
│   │       └── ledgerIdl.ts (24 lines)
│   ├── tailwind.config.js (21 lines)
│   ├── tsconfig.json (33 lines)
│   ├── tsconfig.node.json (11 lines)
│   └── vite.config.ts (34 lines)
├── package.json (22 lines)
├── plinko_backend/
│   ├── Cargo.toml (17 lines)
│   ├── plinko_backend.did (37 lines)
│   └── src/
│       └── lib.rs (323 lines)
├── scripts/
├── src/
│   ├── crash_backend/
│   │   ├── Cargo.toml (15 lines)
│   │   ├── crash_backend.did (4 lines)
│   │   └── src/
│   │       └── lib.rs (5 lines)
│   ├── crash_frontend/
│   │   ├── index.html (21 lines)
│   │   ├── package.json (31 lines)
│   │   ├── public/
│   │   │   ├── .ic-assets.json5 (54 lines)
│   │   │   ├── favicon.ico (4 lines)
│   │   │   └── logo2.svg (38 lines)
│   │   ├── src/
│   │   │   ├── App.jsx (32 lines)
│   │   │   ├── index.scss (42 lines)
│   │   │   ├── main.jsx (11 lines)
│   │   │   └── vite-env.d.ts (2 lines)
│   │   ├── tsconfig.json (22 lines)
│   │   └── vite.config.js (45 lines)
│   └── declarations/
│       ├── crash_backend/
│       │   ├── crash_backend.did (49 lines)
│       │   ├── crash_backend.did.d.ts (51 lines)
│       │   ├── crash_backend.did.js (66 lines)
│       │   ├── index.d.ts (51 lines)
│       │   └── index.js (43 lines)
│       ├── crash_frontend/
│       │   ├── crash_frontend.did (268 lines)
│       │   ├── crash_frontend.did.d.ts (247 lines)
│       │   ├── crash_frontend.did.js (299 lines)
│       │   ├── index.d.ts (51 lines)
│       │   └── index.js (43 lines)
│       ├── dice_backend/
│       │   ├── dice_backend.did (39 lines)
│       │   ├── dice_backend.did.d.ts (43 lines)
│       │   ├── dice_backend.did.js (48 lines)
│       │   ├── index.d.ts (51 lines)
│       │   └── index.js (43 lines)
│       ├── mines_backend/
│       │   ├── index.d.ts (51 lines)
│       │   ├── index.js (43 lines)
│       │   ├── mines_backend.did (30 lines)
│       │   ├── mines_backend.did.d.ts (34 lines)
│       │   └── mines_backend.did.js (31 lines)
│       ├── openhouse_frontend/
│       │   ├── index.d.ts (51 lines)
│       │   ├── index.js (43 lines)
│       │   ├── openhouse_frontend.did (268 lines)
│       │   ├── openhouse_frontend.did.d.ts (247 lines)
│       │   └── openhouse_frontend.did.js (299 lines)
│       └── plinko_backend/
│           ├── index.d.ts (51 lines)
│           ├── index.js (43 lines)
│           ├── plinko_backend.did (37 lines)
│           ├── plinko_backend.did.d.ts (38 lines)
│           └── plinko_backend.did.js (45 lines)
└── tsconfig.json (12 lines)

```

## Summary

This tree shows the complete file structure of the OpenHouse Casino project with line counts for each file.

### Key Directories:
- `crash_backend/` - Crash game backend canister
- `plinko_backend/` - Plinko game backend canister
- `mines_backend/` - Mines game backend canister
- `dice_backend/` - Dice game backend canister
- `openhouse_frontend/` - Multi-game frontend interface
- `scripts/` - Utility scripts

**Note:** Some files and directories are excluded based on hardcoded patterns.
