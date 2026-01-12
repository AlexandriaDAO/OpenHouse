# OpenHouse Frontend - Claude Deployment Guide

## 🎰 CRITICAL: Mainnet-Only Frontend

**⚠️ IMPORTANT: There is no local testing environment. ALL testing happens on mainnet.**

This repository contains only the **frontend** for the OpenHouse casino platform. The backend canisters are maintained separately in the [OpenHouse-backend](https://github.com/AlexandriaDAO/OpenHouse-backend) repository.

## 🎯 Project Philosophy

**"Open House"** - A play on words:
- We're **the house** (casino)
- Everything is **open-source** with transparent odds
- All games are **provably fair** using IC's VRF

## 🚀 Quick Start

```bash
# Deploy frontend to mainnet
./deploy.sh

# Deploy with tests
./deploy.sh --test
```

## 📦 Canister Architecture

| Component | Canister ID | Purpose | URL |
|-----------|-------------|---------|-----|
| **OpenHouse Frontend** | `pezw3-laaaa-aaaal-qssoa-cai` | Multi-game router UI | https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io |

**Note:** Backend canisters are deployed separately from the [OpenHouse-backend](https://github.com/AlexandriaDAO/OpenHouse-backend) repo.

### Frontend Routes
- `/` - Game selection homepage
- `/dice` - Dice game interface
- `/plinko` - Plinko game interface
- `/crash` - Crash game interface
- `/roulette` - Roulette game interface
- `/life` - Game of Life interface

## 🎮 Games Overview

The frontend connects to the following backend canisters (maintained in OpenHouse-backend repo):

| Game | Backend Canister ID |
|------|---------------------|
| Dice | `whchi-hyaaa-aaaao-a4ruq-cai` |
| Plinko | `weupr-2qaaa-aaaap-abl3q-cai` |
| Crash | `fws6k-tyaaa-aaaap-qqc7q-cai` |
| Roulette | `wvrcw-3aaaa-aaaah-arm4a-cai` |
| Life1 | `pijnb-7yaaa-aaaae-qgcuq-cai` |
| Life2 | `qoski-4yaaa-aaaai-q4g4a-cai` |
| Life3 | `66p3s-uaaaa-aaaad-ac47a-cai` |

## 🏗️ Development Workflow

### Step 1: Make Frontend Changes
```bash
# Frontend changes
cd openhouse_frontend
vim src/App.tsx
vim src/components/...
```

### Step 2: Build Locally (Optional)
```bash
cd openhouse_frontend
npm install
npm run build
```

### Step 3: Deploy to Mainnet (MANDATORY)
```bash
./deploy.sh
```

### Step 4: Test on Mainnet
```bash
# Run automated tests
./deploy.sh --test

# Or manually check
open https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io
```

### Step 5: Commit Changes
```bash
git add .
git commit -m "feat: update OpenHouse frontend"
git push
```

## 🐛 Common Issues & Solutions

### Issue: Deployment fails with permission error
**Solution:** Ensure using daopad identity
```bash
export DFX_WARNING=-mainnet_plaintext_identity
dfx identity use daopad
./deploy.sh
```

### Issue: Frontend can't call backend methods
**Solution:** Check backend canister IDs in your frontend code match the production canisters. Backend canisters are maintained in the [OpenHouse-backend](https://github.com/AlexandriaDAO/OpenHouse-backend) repo.

### Issue: Build fails
**Solution:** Check Node.js version and dependencies
```bash
cd openhouse_frontend
rm -rf node_modules
npm install
npm run build
```

## 📝 Deployment Checklist

Before each deployment:
- [ ] Test frontend build locally: `npm run build`
- [ ] Check for TypeScript errors
- [ ] Verify all routes work
- [ ] Check responsive design
- [ ] Verify backend canister IDs are correct

After deployment:
- [ ] Run tests: `./deploy.sh --test`
- [ ] Verify frontend at https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io
- [ ] Test each game's UI functionality
- [ ] Check all routes work correctly
- [ ] Test on mobile devices

## 🔗 Resources

- **Live Frontend**: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io
- **Backend Repo**: https://github.com/AlexandriaDAO/OpenHouse-backend
- **IC Dashboard**: https://dashboard.internetcomputer.org
- **Frontend Canister**: https://dashboard.internetcomputer.org/canister/pezw3-laaaa-aaaal-qssoa-cai

## ⚡ Key Principles

1. **ALWAYS deploy to mainnet** - No local environment exists
2. **Frontend-only repo** - Backend is maintained separately in OpenHouse-backend
3. **Coordinate with backend** - If backend APIs change, frontend needs updates
4. **Test on mainnet immediately** - Every change is live
5. **Document everything** - Future developers need context

---

**Remember**: You're working directly on mainnet. Every deployment affects real users immediately.

**Note**: This repository contains only the frontend. For backend changes, see the [OpenHouse-backend](https://github.com/AlexandriaDAO/OpenHouse-backend) repository.
