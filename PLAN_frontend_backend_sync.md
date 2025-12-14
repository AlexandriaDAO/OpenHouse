# AUTONOMOUS PR ORCHESTRATOR - DO NOT SKIP

**You are an autonomous PR orchestrator. Your ONLY job is to implement this plan and create a PR.**

## Isolation Check (RUN FIRST)
```bash
REPO_ROOT=$(git rev-parse --show-toplevel)
if [ "$REPO_ROOT" = "/home/theseus/alexandria/openhouse" ]; then
    echo "FATAL: In main repo. Must be in worktree."
    echo "Worktree: /home/theseus/alexandria/openhouse-life-sync"
    exit 1
fi
echo "In isolated worktree: $REPO_ROOT"
```

## Your Autonomous Workflow (NO QUESTIONS ALLOWED)
1. **Verify isolation** - You must be in worktree: `/home/theseus/alexandria/openhouse-life-sync`
2. **Implement feature** - Follow plan sections below
3. **Build & Deploy to Mainnet**:
   ```bash
   cd openhouse_frontend && npm run build && cd ..
   ./deploy.sh --frontend-only
   ```
4. **Verify deployment**:
   ```bash
   echo "Visit: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io/life"
   ```
5. **Create PR** (MANDATORY):
   ```bash
   git add .
   git commit -m "feat(life): add multiplayer sync with polling"
   git push -u origin feature/life-frontend-backend-sync
   gh pr create --title "Life: Frontend-Backend Multiplayer Sync" --body "$(cat <<'EOF'
## Summary
- Connects Life.tsx frontend to life1_backend canister
- Adds Internet Identity authentication
- Implements lobby mode (list/create/join games)
- Polling-based sync for multiplayer placements (1 second intervals)

## Test plan
- [ ] Open /life in two browser tabs
- [ ] Login with II in both
- [ ] Tab 1: Create game
- [ ] Tab 2: Join game
- [ ] Both: Place patterns, verify sync within 1-2 seconds

Deployed to mainnet:
- Frontend: https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io/life
- Backend: pijnb-7yaaa-aaaae-qgcuq-cai

Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
   ```

## CRITICAL RULES
- NO questions ("should I?", "want me to?", "is it done?")
- NO skipping PR creation - it's MANDATORY
- NO stopping after implementation - create PR immediately
- MAINNET DEPLOYMENT: All changes go directly to production
- ONLY stop at: approved, max iterations, or error

**Branch:** `feature/life-frontend-backend-sync`
**Worktree:** `/home/theseus/alexandria/openhouse-life-sync`

---

# Implementation Plan

## Summary
Connect Life.tsx frontend to life1_backend canister (pijnb-7yaaa-aaaae-qgcuq-cai) for multiplayer using polling-based sync.

## Current State

**Backend API (already deployed):**
- `create_game(name, config)` → game_id
- `join_game(game_id)`
- `start_game(game_id)`
- `place_pattern(game_id, pattern_name, x, y, at_generation)` → placement_index
- `get_placements_since(game_id, since_index)` query
- `list_games()` query
- `get_game(game_id)` query

**Frontend (Life.tsx):**
- Has grid, territory, pattern placement working locally
- Player colors 1-4 hardcoded
- Declarations already copied to `openhouse_frontend/src/declarations/life1_backend/`

## Files to Modify

### 1. `openhouse_frontend/src/pages/Life.tsx` (MODIFY)

#### 1.1 Update Imports
```typescript
// PSEUDOCODE - Add at top
import { AuthClient } from '@dfinity/auth-client';
import { Actor, HttpAgent, ActorSubclass } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import { idlFactory, _SERVICE, Placement, GameStatus } from '../declarations/life1_backend';

const LIFE1_CANISTER_ID = 'pijnb-7yaaa-aaaae-qgcuq-cai';
```

#### 1.2 Add Auth & Lobby State
```typescript
// PSEUDOCODE - Add after existing state
const [mode, setMode] = useState<'lobby' | 'game'>('lobby');
const [authClient, setAuthClient] = useState<AuthClient | null>(null);
const [isAuthenticated, setIsAuthenticated] = useState(false);
const [actor, setActor] = useState<ActorSubclass<_SERVICE> | null>(null);
const [myPrincipal, setMyPrincipal] = useState<Principal | null>(null);

// Lobby state
const [games, setGames] = useState<Array<[bigint, string, GameStatus, number]>>([]);
const [currentGameId, setCurrentGameId] = useState<bigint | null>(null);
const [newGameName, setNewGameName] = useState('');

// Multiplayer sync state
const [placementIndex, setPlacementIndex] = useState<bigint>(BigInt(0));
const [playerColorMap, setPlayerColorMap] = useState<Map<string, number>>(new Map());
```

#### 1.3 Auth Initialization
```typescript
// PSEUDOCODE - Add useEffect for auth
useEffect(() => {
  AuthClient.create().then(client => {
    setAuthClient(client);
    if (client.isAuthenticated()) {
      setupActor(client);
    }
  });
}, []);

const handleLogin = async () => {
  if (!authClient) return;
  await authClient.login({
    identityProvider: 'https://identity.ic0.app',
    onSuccess: () => setupActor(authClient)
  });
};

const setupActor = (client: AuthClient) => {
  const identity = client.getIdentity();
  const agent = new HttpAgent({ identity, host: 'https://icp0.io' });
  const newActor = Actor.createActor<_SERVICE>(idlFactory, {
    agent,
    canisterId: LIFE1_CANISTER_ID
  });
  setActor(newActor);
  setMyPrincipal(identity.getPrincipal());
  setIsAuthenticated(true);
};
```

#### 1.4 Lobby Functions
```typescript
// PSEUDOCODE - Add lobby management
const fetchGames = async () => {
  if (!actor) return;
  const gamesList = await actor.list_games();
  setGames(gamesList);
};

const handleCreateGame = async () => {
  if (!actor || !newGameName.trim()) return;
  const result = await actor.create_game(newGameName, {
    width: gridSize.cols,
    height: gridSize.rows,
    max_players: 4,
    generations_limit: []
  });
  if ('Ok' in result) {
    await actor.start_game(result.Ok);
    setCurrentGameId(result.Ok);
    setMode('game');
  }
};

const handleJoinGame = async (gameId: bigint) => {
  if (!actor) return;
  const result = await actor.join_game(gameId);
  if ('Ok' in result) {
    setCurrentGameId(gameId);
    // Load game state and init player color map from game.players
    const gameResult = await actor.get_game(gameId);
    if ('Ok' in gameResult) {
      const game = gameResult.Ok;
      const colorMap = new Map<string, number>();
      game.players.forEach((p, i) => colorMap.set(p.toText(), i + 1));
      setPlayerColorMap(colorMap);
    }
    setMode('game');
  }
};
```

#### 1.5 Polling Loop
```typescript
// PSEUDOCODE - Add polling useEffect
useEffect(() => {
  if (!actor || currentGameId === null || mode !== 'game') return;

  const pollInterval = setInterval(async () => {
    const result = await actor.get_placements_since(currentGameId, placementIndex);
    if ('Ok' in result && result.Ok.length > 0) {
      for (const placement of result.Ok) {
        applyPlacement(placement);
      }
      setPlacementIndex(placementIndex + BigInt(result.Ok.length));
    }
  }, 1000);

  return () => clearInterval(pollInterval);
}, [actor, currentGameId, placementIndex, mode]);
```

#### 1.6 Apply Remote Placements
```typescript
// PSEUDOCODE - Add applyPlacement function
const getPlayerNumber = (principal: Principal): number => {
  const key = principal.toText();
  if (playerColorMap.has(key)) return playerColorMap.get(key)!;
  const nextNum = playerColorMap.size + 1;
  setPlayerColorMap(new Map(playerColorMap.set(key, nextNum)));
  return nextNum;
};

const applyPlacement = (placement: Placement) => {
  // Skip own placements (already applied locally)
  if (myPrincipal && placement.player.toText() === myPrincipal.toText()) return;

  const pattern = PATTERNS.find(p => p.name === placement.pattern_name);
  if (!pattern) return;

  const coords = parseRLE(pattern.rle);
  const playerNum = getPlayerNumber(placement.player);

  setGrid(currentGrid => {
    const newGrid = currentGrid.map(r => [...r]);
    coords.forEach(([dx, dy]) => {
      const newRow = (placement.y + dy + gridSize.rows) % gridSize.rows;
      const newCol = (placement.x + dx + gridSize.cols) % gridSize.cols;
      if (newGrid[newRow]) newGrid[newRow][newCol] = playerNum;
    });
    return newGrid;
  });

  setTerritory(currentTerritory => {
    const newTerritory = currentTerritory.map(r => [...r]);
    coords.forEach(([dx, dy]) => {
      const newRow = (placement.y + dy + gridSize.rows) % gridSize.rows;
      const newCol = (placement.x + dx + gridSize.cols) % gridSize.cols;
      if (newTerritory[newRow]) newTerritory[newRow][newCol] = playerNum;
    });
    return newTerritory;
  });
};
```

#### 1.7 Modify handleCanvasClick
```typescript
// PSEUDOCODE - Update handleCanvasClick to send to backend
const handleCanvasClick = async (e: React.MouseEvent<HTMLCanvasElement>) => {
  // ... existing local placement logic stays the same ...

  // After local placement, send to backend if in multiplayer
  if (actor && currentGameId !== null) {
    await actor.place_pattern(
      currentGameId,
      selectedPattern.name,
      col,
      row,
      BigInt(generation)
    );
  }
};
```

#### 1.8 Add Lobby UI
```typescript
// PSEUDOCODE - Add lobby view in render
// If not authenticated, show login button
// If authenticated but mode === 'lobby', show:
//   - List of games with Join buttons
//   - Create game input + button
//   - Refresh games button
// If mode === 'game', show existing game canvas + controls

{!isAuthenticated ? (
  <div className="flex flex-col items-center justify-center h-full gap-4">
    <h2>Conway's Game of Life - Multiplayer</h2>
    <button onClick={handleLogin} className="btn-primary">
      Login with Internet Identity
    </button>
  </div>
) : mode === 'lobby' ? (
  <div className="flex flex-col gap-4 p-6">
    <h2>Game Lobby</h2>
    <div>Principal: {myPrincipal?.toText().slice(0, 10)}...</div>

    {/* Create game */}
    <div className="flex gap-2">
      <input value={newGameName} onChange={e => setNewGameName(e.target.value)} placeholder="Game name" />
      <button onClick={handleCreateGame}>Create Game</button>
    </div>

    {/* Games list */}
    <div className="space-y-2">
      {games.map(([id, name, status, playerCount]) => (
        <div key={id.toString()} className="flex justify-between items-center p-2 bg-white/5 rounded">
          <span>{name} ({playerCount} players)</span>
          <button onClick={() => handleJoinGame(id)}>Join</button>
        </div>
      ))}
    </div>
    <button onClick={fetchGames}>Refresh</button>
  </div>
) : (
  // Existing game UI
  <div className="flex flex-col h-[calc(100vh-120px)]">
    {/* ... existing game canvas and controls ... */}
  </div>
)}
```

## Deployment

```bash
cd /home/theseus/alexandria/openhouse-life-sync
cd openhouse_frontend && npm run build && cd ..
./deploy.sh --frontend-only
```

## Testing

1. Open https://pezw3-laaaa-aaaal-qssoa-cai.icp0.io/life in two browser tabs
2. Login with Internet Identity in both
3. Tab 1: Create a new game
4. Tab 2: Refresh and join the game
5. Both tabs: Place patterns
6. Verify patterns appear in both tabs within 1-2 seconds
