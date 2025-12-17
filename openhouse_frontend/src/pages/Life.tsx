import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { AuthClient } from '@dfinity/auth-client';
import { Actor, HttpAgent, ActorSubclass } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import { idlFactory } from '../declarations/life1_backend';
import type { _SERVICE, GameState, Cell, QuadrantInfo } from '../declarations/life1_backend/life1_backend.did.d';

// Import constants and types from separate file
import {
  LIFE1_CANISTER_ID,
  GRID_SIZE,
  QUADRANT_SIZE,
  QUADRANTS_PER_ROW,
  TOTAL_QUADRANTS,
  GRID_WIDTH,
  GRID_HEIGHT,
  QUADRANT_CELLS,
  DOMINATION_THRESHOLD,
  QUADRANT_POLL_INTERVAL,
  LOCAL_TICK_MS,
  BACKEND_SYNC_MS,
  GRID_COLOR,
  SWIPE_THRESHOLD,
  DEAD_COLOR,
  GOLD_BORDER_MIN_OPACITY,
  GOLD_BORDER_MAX_OPACITY,
  PLAYER_COLORS,
  TERRITORY_COLORS,
  CATEGORY_INFO,
  PATTERNS,
  type ViewMode,
  type PatternCategory,
  type PatternInfo,
  type PendingPlacement,
} from './lifeConstants';

// Import utility functions from separate file
import { parseRLE, rotatePattern } from './lifeUtils';

// Small preview canvas for patterns
const PatternPreview: React.FC<{ pattern: [number, number][]; color: string }> = ({ pattern, color }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const size = 40; // 40x40 preview canvas

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || pattern.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Calculate bounding box
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const [x, y] of pattern) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    const patternWidth = maxX - minX + 1;
    const patternHeight = maxY - minY + 1;

    // Calculate cell size to fit pattern in canvas with padding
    const padding = 2;
    const availableSize = size - padding * 2;
    const cellSize = Math.min(availableSize / patternWidth, availableSize / patternHeight, 6);

    // Center the pattern
    const offsetX = (size - patternWidth * cellSize) / 2;
    const offsetY = (size - patternHeight * cellSize) / 2;

    // Clear canvas
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, size, size);

    // Draw cells
    ctx.fillStyle = color;
    const gap = cellSize > 3 ? 1 : 0;
    for (const [x, y] of pattern) {
      const px = offsetX + (x - minX) * cellSize;
      const py = offsetY + (y - minY) * cellSize;
      ctx.fillRect(px, py, cellSize - gap, cellSize - gap);
    }

    // Draw border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, size - 1, size - 1);
  }, [pattern, color]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className="rounded"
      style={{ width: size, height: size }}
    />
  );
};

export const Life: React.FC = () => {
  // Canvas refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasSizeRef = useRef({ width: 0, height: 0 });

  // Pattern state
  const [selectedPattern, setSelectedPattern] = useState<PatternInfo>(PATTERNS[0]);
  const [selectedCategory, setSelectedCategory] = useState<PatternCategory | 'all'>('all');
  const [parsedPattern, setParsedPattern] = useState<[number, number][]>([]);

  // Quadrant-based view state
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [viewX, setViewX] = useState(0);     // 0, 128, 256, or 384
  const [viewY, setViewY] = useState(0);     // 0, 128, 256, or 384

  // Touch handling for swipe navigation
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  // Derived: current quadrant number (0-15)
  const currentQuadrant = (viewY / QUADRANT_SIZE) * QUADRANTS_PER_ROW + (viewX / QUADRANT_SIZE);

  // Auth state
  const [authClient, setAuthClient] = useState<AuthClient | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [actor, setActor] = useState<ActorSubclass<_SERVICE> | null>(null);
  const [myPrincipal, setMyPrincipal] = useState<Principal | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Game state from backend - now uses unified GameState with Cell array
  const [gameState, setGameState] = useState<GameState | null>(null);
  // Local cells - now comes from WebSocket (Fly.io simulation server)
  const [localCells, setLocalCells] = useState<Cell[]>([]);
  const [myPlayerNum, setMyPlayerNum] = useState<number | null>(null);
  const [myBalance, setMyBalance] = useState(1000);

  // WebSocket connection to Fly.io simulation server (Hybrid Architecture)
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const wsReconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [placementError, setPlacementError] = useState<string | null>(null);

  // Pending placements - accumulate patterns before confirming
  const [pendingPlacements, setPendingPlacements] = useState<PendingPlacement[]>([]);
  const nextPlacementIdRef = useRef(0);
  const [isConfirmingPlacement, setIsConfirmingPlacement] = useState(false);
  const [previewPulse, setPreviewPulse] = useState(0); // For animation

  // Pattern rotation: 0=0°, 1=90°, 2=180°, 3=270° clockwise
  const [rotation, setRotation] = useState(0);

  // Game management state
  const [currentGameId, setCurrentGameId] = useState<bigint | null>(BigInt(0));
  const [mode, setMode] = useState<'lobby' | 'game'>('game');
  const [games, setGames] = useState<any[]>([]);
  const [newGameName, setNewGameName] = useState('');

  // Quadrant domination state
  const [quadrantStates, setQuadrantStates] = useState<QuadrantInfo[]>([]);
  const [selectedQuadrantForInfo, setSelectedQuadrantForInfo] = useState<number | null>(null);
  const [isWiping, setIsWiping] = useState(false);
  const [wipeConfirmQuadrant, setWipeConfirmQuadrant] = useState<number | null>(null);
  const [wipeError, setWipeError] = useState<string | null>(null);
  const [wipeSuccess, setWipeSuccess] = useState<string | null>(null);

  // Simulation control - always running
  const [isRunning, setIsRunning] = useState(true);
  const [, forceRender] = useState(0);

  // Sidebar collapsed state with localStorage persistence
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('life-sidebar-collapsed');
    return saved === 'true';
  });

  // Mobile bottom bar expanded state
  const [mobileExpanded, setMobileExpanded] = useState(false);

  // Persist sidebar state
  useEffect(() => {
    localStorage.setItem('life-sidebar-collapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  // Parse pattern on selection change (reset rotation too)
  useEffect(() => {
    setParsedPattern(parseRLE(selectedPattern.rle));
    setRotation(0);
  }, [selectedPattern]);

  // Get rotated pattern (rotatePattern imported from lifeUtils)
  const rotatedPattern = useMemo(() =>
    rotatePattern(parsedPattern, rotation),
    [parsedPattern, rotation]
  );

  // Cycle rotation
  const cycleRotation = useCallback(() => {
    setRotation(r => (r + 1) % 4);
  }, []);

  // Pulse animation for pending placements
  useEffect(() => {
    if (pendingPlacements.length === 0) return;
    const interval = setInterval(() => {
      setPreviewPulse(p => (p + 1) % 60); // 60 frames per cycle at ~16ms
    }, 16);
    return () => clearInterval(interval);
  }, [pendingPlacements.length]);

  // Navigate to adjacent quadrant with toroidal wrapping
  const navigateQuadrant = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    const step = QUADRANT_SIZE;
    const maxPos = GRID_SIZE - QUADRANT_SIZE; // 384

    switch (direction) {
      case 'up':
        setViewY(y => y === 0 ? maxPos : y - step);
        break;
      case 'down':
        setViewY(y => y === maxPos ? 0 : y + step);
        break;
      case 'left':
        setViewX(x => x === 0 ? maxPos : x - step);
        break;
      case 'right':
        setViewX(x => x === maxPos ? 0 : x + step);
        break;
    }
  }, []);

  // Jump to specific quadrant (0-15)
  const jumpToQuadrant = useCallback((quadrant: number) => {
    const qRow = Math.floor(quadrant / QUADRANTS_PER_ROW);
    const qCol = quadrant % QUADRANTS_PER_ROW;
    setViewX(qCol * QUADRANT_SIZE);
    setViewY(qRow * QUADRANT_SIZE);
    setViewMode('quadrant');
  }, []);

  // Toggle between overview and quadrant view
  const toggleViewMode = useCallback(() => {
    setViewMode(mode => mode === 'overview' ? 'quadrant' : 'overview');
  }, []);

  // Touch/Swipe navigation for mobile
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current || viewMode !== 'quadrant') return;

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;

    // Determine swipe direction (if significant)
    if (Math.abs(deltaX) > SWIPE_THRESHOLD || Math.abs(deltaY) > SWIPE_THRESHOLD) {
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        // Horizontal swipe - swipe left means go right (reveal content to the right)
        navigateQuadrant(deltaX < 0 ? 'right' : 'left');
      } else {
        // Vertical swipe - swipe up means go down
        navigateQuadrant(deltaY < 0 ? 'down' : 'up');
      }
    }

    touchStartRef.current = null;
  }, [viewMode, navigateQuadrant]);

  // Auth initialization
  useEffect(() => {
    AuthClient.create().then(client => {
      setAuthClient(client);
      if (client.isAuthenticated()) setupActor(client);
    });
  }, []);

  const handleLogin = async () => {
    if (!authClient) return;
    setIsLoading(true);
    try {
      await authClient.login({
        identityProvider: 'https://identity.ic0.app',
        onSuccess: () => setupActor(authClient),
        onError: (err) => { setError(`Login failed: ${err}`); setIsLoading(false); }
      });
    } catch (err) {
      setError(`Login failed: ${err}`);
      setIsLoading(false);
    }
  };

  const setupActor = (client: AuthClient) => {
    const identity = client.getIdentity();
    const agent = new HttpAgent({ identity, host: 'https://icp-api.io' });
    const newActor = Actor.createActor<_SERVICE>(idlFactory, { agent, canisterId: LIFE1_CANISTER_ID });
    setActor(newActor);
    setMyPrincipal(identity.getPrincipal());
    setIsAuthenticated(true);
    setIsLoading(false);
  };

  // Fetch games for lobby
  const fetchGames = useCallback(async () => {
    if (!actor) return;
    setIsLoading(true);
    try {
      const gamesList = await actor.list_games();
      setGames(gamesList);
      setError(null);
    } catch (err) {
      setError(`Failed to fetch games: ${err}`);
    }
    setIsLoading(false);
  }, [actor]);

  useEffect(() => {
    if (isAuthenticated && actor) fetchGames();
  }, [isAuthenticated, actor, fetchGames]);

  // Simulation runs locally - backend handles its own tick rate

  // Create game
  const handleCreateGame = async () => {
    if (!actor || !newGameName.trim()) return;
    const trimmedName = newGameName.trim();
    if (trimmedName.length > 50 || !/^[a-zA-Z0-9\s\-_]+$/.test(trimmedName)) {
      setError('Invalid game name');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const result = await actor.create_game(trimmedName, {
        width: GRID_WIDTH, height: GRID_HEIGHT, max_players: 10, generations_limit: []
      });
      if ('Ok' in result) {
        const gameId = result.Ok;
        await actor.start_game(gameId);
        setCurrentGameId(gameId);
        setMyPlayerNum(1);
        setMode('game');
        setNewGameName('');
      } else {
        setError(`Failed: ${result.Err}`);
      }
    } catch (err) {
      setError(`Failed: ${err}`);
    }
    setIsLoading(false);
  };

  // Join game
  const handleJoinGame = async (gameId: bigint) => {
    if (!actor) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await actor.join_game(gameId);
      if ('Ok' in result) {
        setCurrentGameId(gameId);
        setMyPlayerNum(result.Ok);
        // Fetch initial state
        const stateResult = await actor.get_state(gameId);
        if ('Ok' in stateResult) {
          setGameState(stateResult.Ok);
          // Update my balance
          const myIdx = stateResult.Ok.players.findIndex(
            p => p.toText() === myPrincipal?.toText()
          );
          if (myIdx >= 0) {
            setMyBalance(Number(stateResult.Ok.balances[myIdx]));
          }
        }
        setMode('game');
      } else {
        setError(`Failed: ${result.Err}`);
      }
    } catch (err) {
      setError(`Failed: ${err}`);
    }
    setIsLoading(false);
  };

  const handleLeaveGame = () => {
    setMode('lobby');
    setCurrentGameId(null);
    setGameState(null);
    setIsRunning(false);
    fetchGames();
  };

  // Canvas sizing
  useEffect(() => {
    if (!isAuthenticated) return;
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const updateSize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      const width = Math.floor(rect.width);
      const height = Math.floor(rect.height);
      if (width === 0 || height === 0) return;
      if (canvasSizeRef.current.width === width && canvasSizeRef.current.height === height) return;

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      canvasSizeRef.current = { width, height };
      forceRender(n => n + 1);
    };

    const observer = new ResizeObserver(updateSize);
    observer.observe(container);
    updateSize();
    const t1 = setTimeout(updateSize, 50);
    const t2 = setTimeout(updateSize, 200);

    return () => {
      observer.disconnect();
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [isAuthenticated]);

  // Backend sync - balances and player info only (Hybrid Architecture)
  // Grid state comes from WebSocket to Fly.io, balances come from IC canister
  useEffect(() => {
    if (!actor || !isAuthenticated) return;

    let cancelled = false;

    const syncBalances = async () => {
      if (cancelled) return;

      try {
        // Use lightweight metadata for balance and player info
        const metaResult = await actor.get_metadata(currentGameId);

        if ('Ok' in metaResult && !cancelled) {
          const meta = metaResult.Ok;

          // Update player info
          const myIdx = meta.players.findIndex(
            p => p.toText() === myPrincipal?.toText()
          );
          if (myIdx >= 0) {
            setMyPlayerNum(myIdx + 1);
            setMyBalance(Number(meta.balances[myIdx]));
          }

          // Update game metadata (but NOT cells - those come from WebSocket)
          setGameState(prev => prev ? {
            ...prev,
            players: meta.players,
            balances: Array.from(meta.balances),
            is_running: meta.is_running,
          } : prev);
        }
      } catch (err) {
        console.error('Balance sync error:', err);
      }
    };

    // Initial sync
    syncBalances();

    // Periodic sync every 5 seconds
    const syncInterval = setInterval(syncBalances, BACKEND_SYNC_MS);

    return () => {
      cancelled = true;
      clearInterval(syncInterval);
    };
  }, [actor, currentGameId, myPrincipal, isAuthenticated]);

  // NOTE: Quadrant states polling disabled - backend methods not yet implemented
  // TODO: Re-enable when get_quadrant_states and wipe_quadrant are added to life1_backend

  // Wipe quadrant function - disabled until backend support is added
  const handleWipeQuadrant = useCallback(async (_quadrantId: number) => {
    setWipeError('Quadrant wipe feature not yet available');
  }, []);

  // Get player's claimable quadrants count (for win condition display)
  const myClaimedQuadrants = useMemo(() => {
    if (!myPlayerNum || quadrantStates.length === 0) return 0;
    return quadrantStates.filter(q => q.claimed_by === myPlayerNum).length;
  }, [quadrantStates, myPlayerNum]);

  // Get quadrant info for current view
  const currentQuadrantInfo = useMemo(() => {
    return quadrantStates.find(q => q.id === currentQuadrant);
  }, [quadrantStates, currentQuadrant]);

  // Check if current player can wipe any quadrant
  const canWipeQuadrants = useMemo(() => {
    if (!myPlayerNum || quadrantStates.length === 0) return [];
    return quadrantStates.filter(q => q.can_wipe[myPlayerNum - 1]);
  }, [quadrantStates, myPlayerNum]);

  // Track if we have cells (stable reference to avoid unnecessary effect reruns)
  const hasCells = localCells.length > 0;

  // WebSocket connection to Fly.io simulation server
  // Receives real-time grid state updates (Hybrid Architecture)
  useEffect(() => {
    if (!isAuthenticated) return;

    // Fly.io WebSocket URL - will be configured for production
    const WS_URL = process.env.REACT_APP_LIFE_WS_URL || 'wss://openhouse-life.fly.dev/ws';

    const connectWebSocket = () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) return;

      console.log('Connecting to simulation server:', WS_URL);
      const ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        setWsConnected(true);
        ws.send(JSON.stringify({ type: 'Subscribe' }));
        console.log('Connected to simulation server');
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === 'FullState') {
            // Initial state on connect - cells are packed u16 values
            const cells: Cell[] = msg.cells.map((packed: number) => ({
              owner: packed & 0x0F,
              points: (packed >> 4) & 0x7F,
              alive: (packed & (1 << 11)) !== 0,
            }));
            setLocalCells(cells);
            setGameState(prev => prev ? {
              ...prev,
              generation: BigInt(msg.generation),
            } : {
              cells: cells,
              width: msg.width,
              height: msg.height,
              generation: BigInt(msg.generation),
              players: [],
              balances: [],
              is_running: true,
              checkpoint_timestamp_ns: BigInt(0),
            });
            console.log(`Received full state: gen=${msg.generation}, cells=${cells.length}`);
          } else if (msg.type === 'Delta') {
            // Incremental updates - apply changed cells
            setLocalCells(cells => {
              const newCells = [...cells];
              for (const [idx, packed] of msg.changed_cells) {
                if (idx < newCells.length) {
                  newCells[idx] = {
                    owner: packed & 0x0F,
                    points: (packed >> 4) & 0x7F,
                    alive: (packed & (1 << 11)) !== 0,
                  };
                }
              }
              return newCells;
            });
            setGameState(prev => prev ? {
              ...prev,
              generation: BigInt(msg.generation),
            } : prev);
          }
        } catch (err) {
          console.error('WebSocket message parse error:', err);
        }
      };

      ws.onerror = (err) => {
        console.error('WebSocket error:', err);
      };

      ws.onclose = () => {
        setWsConnected(false);
        console.log('Disconnected from simulation server');

        // Auto-reconnect after 2 seconds
        if (wsReconnectTimeoutRef.current) {
          clearTimeout(wsReconnectTimeoutRef.current);
        }
        wsReconnectTimeoutRef.current = setTimeout(connectWebSocket, 2000);
      };

      wsRef.current = ws;
    };

    connectWebSocket();

    return () => {
      if (wsReconnectTimeoutRef.current) {
        clearTimeout(wsReconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [isAuthenticated]);

  // NOTE: Local simulation removed - Fly.io handles all simulation
  // Grid state comes from WebSocket connection above

  // Helper to draw cells within a region
  const drawCells = useCallback((
    ctx: CanvasRenderingContext2D,
    startX: number,
    startY: number,
    width: number,
    height: number,
    cellSize: number
  ) => {
    const cells = localCells;

    // Draw territory (owner > 0, regardless of alive)
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const gridRow = startY + row;
        const gridCol = startX + col;
        const idx = gridRow * GRID_SIZE + gridCol;
        const cell = cells[idx];

        if (cell && cell.owner > 0) {
          ctx.fillStyle = TERRITORY_COLORS[cell.owner] || 'rgba(255,255,255,0.1)';
          ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
        }
      }
    }

    // Draw living cells
    const gap = cellSize > 2 ? 1 : 0;
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const gridRow = startY + row;
        const gridCol = startX + col;
        const idx = gridRow * GRID_SIZE + gridCol;
        const cell = cells[idx];

        if (cell && cell.alive && cell.owner > 0) {
          ctx.fillStyle = PLAYER_COLORS[cell.owner] || '#FFFFFF';
          ctx.fillRect(
            col * cellSize,
            row * cellSize,
            cellSize - gap,
            cellSize - gap
          );
        }
      }
    }

    // Draw gold borders for cells with points (only in quadrant view where cells are large enough)
    if (cellSize > 3) {
      for (let row = 0; row < height; row++) {
        for (let col = 0; col < width; col++) {
          const gridRow = startY + row;
          const gridCol = startX + col;
          const idx = gridRow * GRID_SIZE + gridCol;
          const cell = cells[idx];

          if (cell && cell.points > 0) {
            const opacity = Math.min(
              GOLD_BORDER_MAX_OPACITY,
              GOLD_BORDER_MIN_OPACITY + (cell.points / 10) * 0.1
            );
            ctx.strokeStyle = `rgba(255, 215, 0, ${opacity})`;
            ctx.lineWidth = Math.min(3, 1 + Math.floor(cell.points / 5));
            ctx.strokeRect(
              col * cellSize + 1,
              row * cellSize + 1,
              cellSize - 2,
              cellSize - 2
            );
          }
        }
      }
    }
  }, [localCells]);

  // Draw 4x4 quadrant grid lines (overview mode)
  const drawQuadrantGrid = useCallback((ctx: CanvasRenderingContext2D, cellSize: number) => {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 2;

    for (let i = 1; i < QUADRANTS_PER_ROW; i++) {
      const pos = i * QUADRANT_SIZE * cellSize;

      // Vertical line
      ctx.beginPath();
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, GRID_SIZE * cellSize);
      ctx.stroke();

      // Horizontal line
      ctx.beginPath();
      ctx.moveTo(0, pos);
      ctx.lineTo(GRID_SIZE * cellSize, pos);
      ctx.stroke();
    }
  }, []);

  // Draw quadrant overlays (claimed status, domination %) in overview mode
  const drawQuadrantOverlays = useCallback((ctx: CanvasRenderingContext2D, cellSize: number) => {
    if (quadrantStates.length === 0) return;

    const quadrantPixelSize = QUADRANT_SIZE * cellSize;

    for (const qInfo of quadrantStates) {
      const qRow = qInfo.row;
      const qCol = qInfo.col;
      const x = qCol * quadrantPixelSize;
      const y = qRow * quadrantPixelSize;

      if (qInfo.claimed_by > 0) {
        // Claimed quadrant - overlay with owner's color
        const ownerColor = PLAYER_COLORS[qInfo.claimed_by] || '#FFFFFF';
        ctx.fillStyle = ownerColor;
        ctx.globalAlpha = 0.25;
        ctx.fillRect(x, y, quadrantPixelSize, quadrantPixelSize);
        ctx.globalAlpha = 1;

        // Draw border in owner's color
        ctx.strokeStyle = ownerColor;
        ctx.lineWidth = 4;
        ctx.strokeRect(x + 2, y + 2, quadrantPixelSize - 4, quadrantPixelSize - 4);

        // Draw "LOCKED" text
        ctx.fillStyle = ownerColor;
        ctx.font = `bold ${Math.floor(quadrantPixelSize * 0.12)}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('LOCKED', x + quadrantPixelSize / 2, y + quadrantPixelSize / 2);
      } else {
        // Unclaimed - check for domination
        const territoryCounts = Array.from(qInfo.territory_counts);
        const dominantPlayer = territoryCounts
          .map((count, idx) => ({ player: idx + 1, count }))
          .filter(p => p.count > 0)
          .sort((a, b) => b.count - a.count)[0];

        if (dominantPlayer) {
          const dominationPct = dominantPlayer.count / QUADRANT_CELLS;

          if (dominationPct >= DOMINATION_THRESHOLD) {
            // Can be wiped - show strong indicator
            const playerColor = PLAYER_COLORS[dominantPlayer.player] || '#FFFFFF';
            ctx.strokeStyle = playerColor;
            ctx.lineWidth = 4;
            ctx.setLineDash([10, 5]);
            ctx.strokeRect(x + 2, y + 2, quadrantPixelSize - 4, quadrantPixelSize - 4);
            ctx.setLineDash([]);

            // Show percentage
            ctx.fillStyle = playerColor;
            ctx.font = `bold ${Math.floor(quadrantPixelSize * 0.1)}px monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${Math.floor(dominationPct * 100)}%`, x + quadrantPixelSize / 2, y + quadrantPixelSize * 0.4);
            ctx.fillText('WIPE?', x + quadrantPixelSize / 2, y + quadrantPixelSize * 0.6);
          } else if (dominationPct >= 0.5) {
            // Significant presence - show percentage
            const playerColor = PLAYER_COLORS[dominantPlayer.player] || '#FFFFFF';
            ctx.fillStyle = playerColor;
            ctx.globalAlpha = 0.7;
            ctx.font = `bold ${Math.floor(quadrantPixelSize * 0.08)}px monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${Math.floor(dominationPct * 100)}%`, x + quadrantPixelSize / 2, y + quadrantPixelSize / 2);
            ctx.globalAlpha = 1;
          }
        }
      }
    }
  }, [quadrantStates]);

  // Draw current quadrant status overlay (in quadrant view mode)
  const drawCurrentQuadrantStatus = useCallback((ctx: CanvasRenderingContext2D, cellSize: number) => {
    if (!currentQuadrantInfo) return;

    const size = QUADRANT_SIZE * cellSize;

    if (currentQuadrantInfo.claimed_by > 0) {
      // Draw locked indicator at top
      const ownerColor = PLAYER_COLORS[currentQuadrantInfo.claimed_by] || '#FFFFFF';
      ctx.fillStyle = ownerColor;
      ctx.globalAlpha = 0.15;
      ctx.fillRect(0, 0, size, size);
      ctx.globalAlpha = 1;

      // Border
      ctx.strokeStyle = ownerColor;
      ctx.lineWidth = 6;
      ctx.strokeRect(3, 3, size - 6, size - 6);
    } else if (myPlayerNum && currentQuadrantInfo.can_wipe[myPlayerNum - 1]) {
      // Player can wipe - pulsing green border
      ctx.strokeStyle = '#39FF14';
      ctx.lineWidth = 4;
      ctx.setLineDash([15, 8]);
      ctx.strokeRect(2, 2, size - 4, size - 4);
      ctx.setLineDash([]);
    }
  }, [currentQuadrantInfo, myPlayerNum]);

  // Draw cell grid lines (quadrant mode only)
  const drawGridLines = useCallback((ctx: CanvasRenderingContext2D, cellSize: number, gridWidth: number, gridHeight: number) => {
    if (cellSize < 4) return; // Skip grid lines when cells are too small

    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 1;

    for (let i = 0; i <= gridWidth; i++) {
      ctx.beginPath();
      ctx.moveTo(i * cellSize, 0);
      ctx.lineTo(i * cellSize, gridHeight * cellSize);
      ctx.stroke();
    }
    for (let i = 0; i <= gridHeight; i++) {
      ctx.beginPath();
      ctx.moveTo(0, i * cellSize);
      ctx.lineTo(gridWidth * cellSize, i * cellSize);
      ctx.stroke();
    }
  }, []);

  // Draw preview cells with pulsing animation (handles both single mode and batch mode)
  const drawPreviewCells = useCallback((
    ctx: CanvasRenderingContext2D,
    startX: number,
    startY: number,
    cellSize: number,
    pulse: number
  ) => {
    const cells = localCells;
    const pulseAlpha = 0.4 + 0.4 * Math.sin((pulse / 60) * Math.PI * 2); // Pulse between 0.4 and 0.8
    // Use white when player number is not yet known from backend
    const playerColor = myPlayerNum !== null ? (PLAYER_COLORS[myPlayerNum] || '#FFFFFF') : '#FFFFFF';

    // Collect all pending cell positions for overlap detection between placements
    const allPendingCells: Set<string> = new Set();
    for (const placement of pendingPlacements) {
      for (const [gridCol, gridRow] of placement.cells) {
        allPendingCells.add(`${gridCol},${gridRow}`);
      }
    }

    // Count occurrences of each cell position to detect internal overlaps
    const cellCounts: Map<string, number> = new Map();
    for (const placement of pendingPlacements) {
      for (const [gridCol, gridRow] of placement.cells) {
        const key = `${gridCol},${gridRow}`;
        cellCounts.set(key, (cellCounts.get(key) || 0) + 1);
      }
    }

    // Draw all pending placements
    for (const placement of pendingPlacements) {
      for (const [gridCol, gridRow] of placement.cells) {
        const localCol = gridCol - startX;
        const localRow = gridRow - startY;

        // Skip if outside current view
        if (localCol < 0 || localCol >= QUADRANT_SIZE || localRow < 0 || localRow >= QUADRANT_SIZE) continue;

        const idx = gridRow * GRID_SIZE + gridCol;
        const existingCell = cells[idx];
        const cellKey = `${gridCol},${gridRow}`;

        // Check for conflicts: alive cells OR duplicate pending cells
        const hasAliveConflict = existingCell && existingCell.alive;
        const hasDuplicateConflict = (cellCounts.get(cellKey) || 0) > 1;
        const hasConflict = hasAliveConflict || hasDuplicateConflict;

        if (hasConflict) {
          ctx.fillStyle = `rgba(255, 60, 60, ${pulseAlpha})`;
        } else {
          const rgb = playerColor.match(/\w\w/g)?.map(x => parseInt(x, 16)) || [57, 255, 20];
          ctx.fillStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${pulseAlpha})`;
        }

        const gap = cellSize > 2 ? 1 : 0;
        ctx.fillRect(localCol * cellSize, localRow * cellSize, cellSize - gap, cellSize - gap);

        ctx.strokeStyle = hasConflict ? '#FF3C3C' : '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 3]);
        ctx.strokeRect(localCol * cellSize + 1, localRow * cellSize + 1, cellSize - 2, cellSize - 2);
        ctx.setLineDash([]);
      }
    }
  }, [localCells, myPlayerNum, pendingPlacements]);


  // Main draw function - simplified for quadrant-based navigation
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const { width: displayWidth, height: displayHeight } = canvasSizeRef.current;
    if (!canvas || displayWidth === 0 || displayHeight === 0 || localCells.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Clear canvas
    ctx.fillStyle = DEAD_COLOR;
    ctx.fillRect(0, 0, displayWidth, displayHeight);

    // Use the smaller dimension to ensure square cells
    const canvasSize = Math.min(displayWidth, displayHeight);

    if (viewMode === 'overview') {
      // Overview: show all 512×512, each cell is tiny
      const cellSize = canvasSize / GRID_SIZE;

      // Center the grid if canvas is not square
      const offsetX = (displayWidth - canvasSize) / 2;
      const offsetY = (displayHeight - canvasSize) / 2;
      ctx.save();
      ctx.translate(offsetX, offsetY);

      drawCells(ctx, 0, 0, GRID_SIZE, GRID_SIZE, cellSize);
      drawQuadrantGrid(ctx, cellSize);

      // Draw quadrant domination overlays
      drawQuadrantOverlays(ctx, cellSize);

      // Highlight current quadrant position
      const qRow = viewY / QUADRANT_SIZE;
      const qCol = viewX / QUADRANT_SIZE;
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 3;
      ctx.strokeRect(
        qCol * QUADRANT_SIZE * cellSize,
        qRow * QUADRANT_SIZE * cellSize,
        QUADRANT_SIZE * cellSize,
        QUADRANT_SIZE * cellSize
      );

      // Boundary
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 2;
      ctx.strokeRect(0, 0, GRID_SIZE * cellSize, GRID_SIZE * cellSize);

      ctx.restore();
    } else {
      // Quadrant: show 128×128, cells are larger
      const cellSize = canvasSize / QUADRANT_SIZE;

      // Center the grid if canvas is not square
      const offsetX = (displayWidth - canvasSize) / 2;
      const offsetY = (displayHeight - canvasSize) / 2;
      ctx.save();
      ctx.translate(offsetX, offsetY);

      drawCells(ctx, viewX, viewY, QUADRANT_SIZE, QUADRANT_SIZE, cellSize);
      drawGridLines(ctx, cellSize, QUADRANT_SIZE, QUADRANT_SIZE);

      // Draw preview cells on top
      drawPreviewCells(ctx, viewX, viewY, cellSize, previewPulse);

      // Draw current quadrant status overlay (locked/can wipe)
      drawCurrentQuadrantStatus(ctx, cellSize);

      // Boundary
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 2;
      ctx.strokeRect(0, 0, QUADRANT_SIZE * cellSize, QUADRANT_SIZE * cellSize);

      ctx.restore();
    }
  }, [viewMode, viewX, viewY, localCells, drawCells, drawQuadrantGrid, drawGridLines, drawPreviewCells, previewPulse, drawQuadrantOverlays, drawCurrentQuadrantStatus]);

  useEffect(() => { draw(); }, [draw]);

  // Click handler for quadrant-based navigation and preview placement
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!actor) return;
    if (isConfirmingPlacement) return; // Don't allow new clicks while confirming

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const { width: displayWidth, height: displayHeight } = canvasSizeRef.current;
    const canvasSize = Math.min(displayWidth, displayHeight);
    const offsetX = (displayWidth - canvasSize) / 2;
    const offsetY = (displayHeight - canvasSize) / 2;

    const x = e.clientX - rect.left - offsetX;
    const y = e.clientY - rect.top - offsetY;

    // Ignore clicks outside the grid
    if (x < 0 || y < 0 || x >= canvasSize || y >= canvasSize) return;

    if (viewMode === 'overview') {
      // Click in overview = jump to that quadrant
      const cellSize = canvasSize / GRID_SIZE;
      const gridCol = Math.floor(x / cellSize);
      const gridRow = Math.floor(y / cellSize);
      const quadrant = Math.floor(gridRow / QUADRANT_SIZE) * QUADRANTS_PER_ROW
                     + Math.floor(gridCol / QUADRANT_SIZE);
      jumpToQuadrant(quadrant);
    } else {
      // Click in quadrant = set preview or add to batch
      const cellSize = canvasSize / QUADRANT_SIZE;
      const localCol = Math.floor(x / cellSize);
      const localRow = Math.floor(y / cellSize);
      const gridCol = viewX + localCol;
      const gridRow = viewY + localRow;

      // Validate coordinates
      if (gridCol < 0 || gridCol >= GRID_SIZE || gridRow < 0 || gridRow >= GRID_SIZE) return;

      // Convert rotated pattern to absolute coordinates with toroidal wrapping
      const cellsToPlace: [number, number][] = rotatedPattern.map(([dx, dy]) => [
        (gridCol + dx + GRID_SIZE) % GRID_SIZE,
        (gridRow + dy + GRID_SIZE) % GRID_SIZE
      ]);

      // Add pattern to pending placements
      const newPlacement: PendingPlacement = {
        id: `placement-${nextPlacementIdRef.current++}`,
        cells: cellsToPlace,
        patternName: selectedPattern.name,
        centroid: [gridCol, gridRow],
      };
      setPendingPlacements(prev => [...prev, newPlacement]);
      setPlacementError(null);
    }
  };

  // Confirm placement - send all pending placements to IC canister (Hybrid Architecture)
  // IC records the event, Fly.io polls for events and applies them, WebSocket pushes updates
  // Cells will appear via WebSocket in ~1-2 seconds after IC confirms the event
  const confirmPlacement = useCallback(async () => {
    const cellsToPlace: [number, number][] = pendingPlacements.flatMap(p => p.cells);

    if (!actor || cellsToPlace.length === 0 || isConfirmingPlacement) return;

    const cost = cellsToPlace.length;

    // Check if player has enough points
    if (myBalance < cost) {
      setPlacementError(`Not enough points. Need ${cost}, have ${myBalance}`);
      return;
    }

    // Check for conflicts with current local state (from WebSocket)
    const conflicts = cellsToPlace.filter(([col, row]) => {
      const idx = row * GRID_SIZE + col;
      return localCells[idx]?.alive;
    });

    if (conflicts.length > 0) {
      setPlacementError(`${conflicts.length} cell(s) overlap with existing alive cells. Reposition or wait for cells to die.`);
      return;
    }

    // Check for internal overlaps between placements
    if (pendingPlacements.length > 1) {
      const seen = new Set<string>();
      let duplicates = 0;
      for (const [col, row] of cellsToPlace) {
        const key = `${col},${row}`;
        if (seen.has(key)) duplicates++;
        seen.add(key);
      }
      if (duplicates > 0) {
        setPlacementError(`${duplicates} cell(s) overlap between placements. Remove overlapping patterns.`);
        return;
      }
    }

    setIsConfirmingPlacement(true);
    setPlacementError(null);

    try {
      // In hybrid architecture, place_cells just records an event - no simulation
      // The expected_generation is used for optimistic concurrency control
      const currentGen = gameState?.generation ? BigInt(gameState.generation) : BigInt(0);
      const result = await actor.place_cells(currentGameId, cellsToPlace, currentGen);

      if ('Err' in result) {
        let errorMsg = result.Err;
        if (errorMsg.includes('alive cells')) {
          errorMsg = 'Placement failed: Another player placed cells there. Try a different position.';
        } else if (errorMsg.includes('Insufficient')) {
          errorMsg = 'Not enough points. Your balance may have changed.';
        }
        setPlacementError(errorMsg);
      } else {
        const { placed_count, new_balance } = result.Ok;

        // Update balance from IC response (authoritative source)
        setMyBalance(Number(new_balance));

        // If this is our first placement, fetch metadata to get player number
        if (myPlayerNum === null) {
          try {
            const metaResult = await actor.get_metadata(currentGameId);
            if ('Ok' in metaResult) {
              const myIdx = metaResult.Ok.players.findIndex(
                p => p.toText() === myPrincipal?.toText()
              );
              if (myIdx >= 0) {
                setMyPlayerNum(myIdx + 1);
              }
            }
          } catch (err) {
            console.error('Failed to fetch player number:', err);
          }
        }

        // Clear pending placements - cells will appear via WebSocket from Fly.io
        // Fly.io polls IC events, applies them, and broadcasts via WebSocket
        setPendingPlacements([]);
        setPlacementError(null);

        console.log(`Placed ${placed_count} cells - waiting for WebSocket update from Fly.io`);
      }
    } catch (err) {
      console.error('Place error:', err);
      setPlacementError(`Network error: ${err}. Please try again.`);
    } finally {
      setIsConfirmingPlacement(false);
    }
  }, [actor, pendingPlacements, isConfirmingPlacement, myBalance, localCells, currentGameId, myPlayerNum, myPrincipal, gameState]);

  // Clear all pending placements
  const cancelPreview = useCallback(() => {
    setPendingPlacements([]);
    setPlacementError(null);
  }, []);

  // Remove a specific placement from batch (by ID)
  const removePlacement = useCallback((placementId: string) => {
    setPendingPlacements(prev => prev.filter(p => p.id !== placementId));
  }, []);

  // Keyboard navigation and preview shortcuts
  // NOTE: This useEffect must come AFTER confirmPlacement and cancelPreview are defined
  // to avoid temporal dead zone issues in the minified bundle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture if typing in input
      if (e.target instanceof HTMLInputElement) return;

      const hasPendingPlacements = pendingPlacements.length > 0;

      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          e.preventDefault();
          if (viewMode === 'quadrant' && !hasPendingPlacements) navigateQuadrant('up');
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          e.preventDefault();
          if (viewMode === 'quadrant' && !hasPendingPlacements) navigateQuadrant('down');
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          e.preventDefault();
          if (viewMode === 'quadrant' && !hasPendingPlacements) navigateQuadrant('left');
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          e.preventDefault();
          if (viewMode === 'quadrant' && !hasPendingPlacements) navigateQuadrant('right');
          break;
        case ' ':  // Space to toggle view mode
        case 'Tab':
          e.preventDefault();
          if (!hasPendingPlacements) toggleViewMode();
          break;
        case 'Enter':
          // Confirm all pending placements
          if (hasPendingPlacements && !isConfirmingPlacement) {
            e.preventDefault();
            confirmPlacement();
          }
          break;
        case 'Escape':
          // Clear all pending placements
          if (hasPendingPlacements) {
            e.preventDefault();
            cancelPreview();
          }
          break;
        case 'r':
        case 'R':
          // Rotate pattern 90° clockwise
          if (viewMode === 'quadrant') {
            e.preventDefault();
            cycleRotation();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode, navigateQuadrant, toggleViewMode, pendingPlacements.length, isConfirmingPlacement, confirmPlacement, cancelPreview, cycleRotation]);

  // Controls - simulation now runs on Fly.io server (Hybrid Architecture)
  // These controls are kept for UI consistency but don't affect server-side simulation
  const handlePlayPause = () => {
    // In hybrid architecture, simulation always runs on Fly.io at 10 gen/sec
    // This toggle only affects local UI state (if we add client-side pause later)
    setIsRunning(!isRunning);
  };

  const handleStep = () => {
    // In hybrid architecture, stepping is not supported
    // Simulation runs continuously on Fly.io at 10 gen/sec
    console.log('Step not available - simulation runs on Fly.io server');
  };

  const handleClear = () => {
    // In hybrid architecture, clearing is not supported from frontend
    // The grid state is managed by Fly.io server
    console.log('Clear not available - grid managed by Fly.io server');
  };

  // Cell counts - uses localCells for live updates
  const cellCounts = localCells.reduce((acc, cell) => {
    if (cell.alive && cell.owner > 0) acc[cell.owner] = (acc[cell.owner] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);

  const territoryCounts = localCells.reduce((acc, cell) => {
    if (cell.owner > 0) acc[cell.owner] = (acc[cell.owner] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);

  // Points stored in territory (sum of cell.points per player)
  const pointsInTerritory = localCells.reduce((acc, cell) => {
    if (cell.owner > 0 && cell.points > 0) acc[cell.owner] = (acc[cell.owner] || 0) + cell.points;
    return acc;
  }, {} as Record<number, number>);

  // Total points in game (for conservation check)
  const totalPointsInCells = Object.values(pointsInTerritory).reduce((a, b) => a + b, 0);
  // Convert BigUint64Array/bigint[] to regular number array for safe iteration
  const balancesArray = gameState?.balances ? Array.from(gameState.balances).map(b => Number(b)) : [];
  const totalPointsInWallets = balancesArray.reduce((a, b) => a + b, 0);
  const totalPoints = totalPointsInCells + totalPointsInWallets;

  const filteredPatterns = selectedCategory === 'all'
    ? PATTERNS : PATTERNS.filter(p => p.category === selectedCategory);

  // Memoized Minimap - renders quadrant heatmap
  const minimapRef = useRef<HTMLCanvasElement>(null);

  // Draw minimap when localCells, currentQuadrant, or quadrantStates change
  useEffect(() => {
    const canvas = minimapRef.current;
    if (!canvas || localCells.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = canvas.width;
    const quadSize = size / QUADRANTS_PER_ROW;

    // Clear
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, size, size);

    // Draw each quadrant with domination/claimed status
    for (let q = 0; q < TOTAL_QUADRANTS; q++) {
      const qRow = Math.floor(q / QUADRANTS_PER_ROW);
      const qCol = q % QUADRANTS_PER_ROW;
      const qInfo = quadrantStates.find(qs => qs.id === q);

      const x = qCol * quadSize + 1;
      const y = qRow * quadSize + 1;
      const w = quadSize - 2;
      const h = quadSize - 2;

      if (qInfo && qInfo.claimed_by > 0) {
        // Claimed quadrant - show owner's color with lock pattern
        const ownerColor = PLAYER_COLORS[qInfo.claimed_by] || '#FFFFFF';
        ctx.fillStyle = ownerColor;
        ctx.globalAlpha = 0.6;
        ctx.fillRect(x, y, w, h);
        ctx.globalAlpha = 1;

        // Draw lock icon (small padlock shape)
        ctx.fillStyle = '#000';
        ctx.font = `${Math.floor(quadSize * 0.4)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('L', x + w / 2, y + h / 2);
      } else {
        // Unclaimed - show cell density heatmap
        const startY = qRow * QUADRANT_SIZE;
        const startX = qCol * QUADRANT_SIZE;
        let livingCells = 0;
        for (let row = startY; row < startY + QUADRANT_SIZE; row++) {
          for (let col = startX; col < startX + QUADRANT_SIZE; col++) {
            const cell = localCells[row * GRID_SIZE + col];
            if (cell && cell.alive && cell.owner > 0) livingCells++;
          }
        }
        const density = livingCells / QUADRANT_CELLS;
        const alpha = Math.min(0.8, density * 2);
        ctx.fillStyle = `rgba(57, 255, 20, ${alpha})`;
        ctx.fillRect(x, y, w, h);

        // If a player has 90%+ territory, show pulsing indicator
        if (qInfo) {
          const totalTerritory = Array.from(qInfo.territory_counts).reduce((a, b) => a + b, 0);
          const dominantPlayer = Array.from(qInfo.territory_counts)
            .map((count, idx) => ({ player: idx + 1, count }))
            .sort((a, b) => b.count - a.count)[0];

          if (dominantPlayer && dominantPlayer.count / QUADRANT_CELLS >= DOMINATION_THRESHOLD) {
            // Show domination indicator (player can wipe)
            const playerColor = PLAYER_COLORS[dominantPlayer.player] || '#FFFFFF';
            ctx.strokeStyle = playerColor;
            ctx.lineWidth = 2;
            ctx.setLineDash([3, 2]);
            ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
            ctx.setLineDash([]);
          }
        }
      }
    }

    // Highlight current quadrant
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 3;
    const curRow = Math.floor(currentQuadrant / QUADRANTS_PER_ROW);
    const curCol = currentQuadrant % QUADRANTS_PER_ROW;
    ctx.strokeRect(curCol * quadSize, curRow * quadSize, quadSize, quadSize);

    // Draw grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= QUADRANTS_PER_ROW; i++) {
      const pos = i * quadSize;
      ctx.beginPath();
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, pos);
      ctx.lineTo(size, pos);
      ctx.stroke();
    }
  }, [localCells, currentQuadrant, quadrantStates]);

  const handleMinimapClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = minimapRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const quadSize = canvas.width / QUADRANTS_PER_ROW;

    const qCol = Math.floor(x / quadSize);
    const qRow = Math.floor(y / quadSize);
    const quadrant = qRow * QUADRANTS_PER_ROW + qCol;

    jumpToQuadrant(quadrant);
  }, [jumpToQuadrant]);

  // Login screen
  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-80px)] gap-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white mb-2">Conway's Game of Life</h1>
          <p className="text-gray-400">{GRID_WIDTH}x{GRID_HEIGHT} Persistent World</p>
          <p className="text-gray-500 text-sm mt-2">10 players max - your cells, your territory</p>
        </div>
        <button
          onClick={handleLogin}
          disabled={isLoading}
          className="px-6 py-3 rounded-lg font-mono text-lg bg-dfinity-turquoise/20 text-dfinity-turquoise border border-dfinity-turquoise/50 hover:bg-dfinity-turquoise/30 transition-all disabled:opacity-50"
        >
          {isLoading ? 'Connecting...' : 'Login with Internet Identity'}
        </button>
        {error && <p className="text-red-400 text-sm">{error}</p>}
      </div>
    );
  }

  // Game view - fullscreen with collapsible sidebar
  return (
    <div className="flex flex-col h-[calc(100vh-80px)]">
      {/* Error display - keep at top */}
      {error && (
        <div className="p-2 bg-red-500/20 border border-red-500/50 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Main content area */}
      <div className="flex flex-1 min-h-0">
        {/* Desktop Sidebar - inline to prevent remounting */}
        <div className={`
          hidden lg:flex flex-col
          ${sidebarCollapsed ? 'w-12' : 'w-72'}
          transition-all duration-300 ease-in-out
          bg-black border-r border-white/20
          overflow-hidden flex-shrink-0
        `}>
          {/* Toggle button */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-3 hover:bg-white/10 flex items-center justify-center border-b border-white/20"
          >
            <span className="text-gray-400 text-lg">{sidebarCollapsed ? '»' : '«'}</span>
          </button>

          {/* Content - hidden when collapsed */}
          <div className={`${sidebarCollapsed ? 'hidden' : 'flex flex-col'} flex-1 overflow-y-auto p-3`}>
            {/* Info Section */}
            <div className="mb-4">
              <h1 className="text-lg font-bold text-white">Game of Life</h1>
              <p className="text-gray-500 text-xs">
                {myPlayerNum ? (
                  <>You are Player {myPlayerNum} <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: PLAYER_COLORS[myPlayerNum] }}></span></>
                ) : (
                  'Place cells to join'
                )}
              </p>
              <div className="mt-2 text-sm font-mono space-y-1">
                <div className="text-gray-400">
                  Gen: <span className="text-dfinity-turquoise">{gameState?.generation.toString() || 0}</span>
                </div>
                <div className="text-gray-400">Players: {gameState?.players.length || 0}/10</div>
              </div>
              {/* Player stats table */}
              <div className="mt-3">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-500">
                      <th className="text-left font-normal pb-1"></th>
                      <th className="text-right font-normal pb-1 px-1">Terr</th>
                      <th className="text-right font-normal pb-1 px-1">Cells</th>
                      <th className="text-right font-normal pb-1 px-1">Pts</th>
                      <th className="text-right font-normal pb-1 px-1">Wallet</th>
                    </tr>
                  </thead>
                  <tbody>
                    {balancesArray.map((wallet, idx) => {
                      const playerNum = idx + 1;
                      const territory = territoryCounts[playerNum] || 0;
                      const cells = cellCounts[playerNum] || 0;
                      const pts = pointsInTerritory[playerNum] || 0;
                      return (
                        <tr key={playerNum} className="border-t border-gray-800">
                          <td className="py-0.5">
                            <div className="flex items-center gap-1">
                              <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: PLAYER_COLORS[playerNum] }} />
                              <span className="text-gray-400">P{playerNum}</span>
                            </div>
                          </td>
                          <td className="text-right px-1" style={{ color: PLAYER_COLORS[playerNum], opacity: 0.6 }}>
                            {territory.toLocaleString()}
                          </td>
                          <td className="text-right px-1" style={{ color: PLAYER_COLORS[playerNum] }}>
                            {cells.toLocaleString()}
                          </td>
                          <td className="text-right px-1 text-yellow-500">
                            {pts}
                          </td>
                          <td className="text-right px-1 text-green-400">
                            {wallet.toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="text-xs text-gray-600 mt-2 border-t border-gray-700 pt-2">
                  Total: <span className="text-yellow-500">{totalPoints.toLocaleString()}</span> pts
                  <span className="text-gray-600 ml-1">({totalPointsInCells} + {totalPointsInWallets})</span>
                </div>
              </div>
            </div>

            {/* Minimap - inline canvas */}
            <div className="minimap-container mb-4">
              <div className="text-xs text-gray-400 mb-1">World Map</div>
              <canvas
                ref={minimapRef}
                width={120}
                height={120}
                className="cursor-pointer border border-gray-700 rounded"
                onClick={handleMinimapClick}
              />
              <div className="text-xs text-gray-500 mt-1">
                Q{currentQuadrant} ({viewX}, {viewY})
              </div>
            </div>

            {/* Quadrant Domination Section */}
            <div className="quadrant-domination mb-4 p-2 bg-gray-900/50 rounded border border-gray-700">
              <div className="text-xs text-gray-400 mb-2 font-semibold">Quadrant Domination</div>

              {/* Win condition progress */}
              {myPlayerNum && (
                <div className="mb-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-400">Your Claimed:</span>
                    <span className={`font-mono ${myClaimedQuadrants === TOTAL_QUADRANTS ? 'text-yellow-400' : 'text-white'}`}>
                      {myClaimedQuadrants}/{TOTAL_QUADRANTS}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-800 rounded-full mt-1">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${(myClaimedQuadrants / TOTAL_QUADRANTS) * 100}%`,
                        backgroundColor: PLAYER_COLORS[myPlayerNum] || '#39FF14'
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Current quadrant info */}
              {viewMode === 'quadrant' && currentQuadrantInfo && (
                <div className="text-xs mt-2 pt-2 border-t border-gray-700">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-gray-400">Q{currentQuadrant} Status:</span>
                    <span className={currentQuadrantInfo.claimed_by > 0 ? 'text-red-400' : 'text-green-400'}>
                      {currentQuadrantInfo.claimed_by > 0 ? `Locked (P${currentQuadrantInfo.claimed_by})` : 'Open'}
                    </span>
                  </div>

                  {/* Territory breakdown for current quadrant */}
                  {currentQuadrantInfo.claimed_by === 0 && (
                    <div className="mt-2 space-y-1">
                      {Array.from(currentQuadrantInfo.territory_counts)
                        .map((count, idx) => ({ player: idx + 1, count }))
                        .filter(p => p.count > 0)
                        .sort((a, b) => b.count - a.count)
                        .slice(0, 3)
                        .map(p => {
                          const pct = (p.count / QUADRANT_CELLS) * 100;
                          return (
                            <div key={p.player} className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: PLAYER_COLORS[p.player] }} />
                              <div className="flex-1 h-1 bg-gray-800 rounded-full">
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${pct}%`,
                                    backgroundColor: PLAYER_COLORS[p.player],
                                    opacity: pct >= 90 ? 1 : 0.6
                                  }}
                                />
                              </div>
                              <span className={`w-10 text-right ${pct >= 90 ? 'text-green-400 font-bold' : 'text-gray-400'}`}>
                                {pct.toFixed(0)}%
                              </span>
                            </div>
                          );
                        })
                      }
                    </div>
                  )}

                  {/* Wipe button */}
                  {myPlayerNum && currentQuadrantInfo.can_wipe[myPlayerNum - 1] && currentQuadrantInfo.claimed_by === 0 && (
                    <button
                      onClick={() => setWipeConfirmQuadrant(currentQuadrant)}
                      disabled={isWiping}
                      className="w-full mt-3 px-3 py-2 bg-green-600 hover:bg-green-500 rounded text-white text-sm font-mono transition-all disabled:opacity-50"
                    >
                      {isWiping ? 'Wiping...' : `WIPE Q${currentQuadrant}`}
                    </button>
                  )}
                </div>
              )}

              {/* Can wipe other quadrants indicator */}
              {canWipeQuadrants.length > 0 && viewMode === 'overview' && (
                <div className="text-xs mt-2 pt-2 border-t border-gray-700">
                  <div className="text-green-400 mb-1">Ready to wipe:</div>
                  <div className="flex flex-wrap gap-1">
                    {canWipeQuadrants.map(q => (
                      <button
                        key={q.id}
                        onClick={() => jumpToQuadrant(q.id)}
                        className="px-2 py-1 bg-green-600/30 border border-green-500/50 rounded text-green-400 text-xs font-mono hover:bg-green-600/50"
                      >
                        Q{q.id}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Navigation Controls - inline */}
            <div className="navigation-controls mb-4">
              <button
                onClick={toggleViewMode}
                className="w-full mb-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm font-mono"
              >
                {viewMode === 'overview' ? 'Enter Quadrant' : 'View Overview'}
              </button>

              {viewMode === 'quadrant' && (
                <div className="grid grid-cols-3 gap-1 mt-2">
                  <div />
                  <button onClick={() => navigateQuadrant('up')} className="p-2 bg-white/10 hover:bg-white/20 rounded text-white text-center">^</button>
                  <div />
                  <button onClick={() => navigateQuadrant('left')} className="p-2 bg-white/10 hover:bg-white/20 rounded text-white text-center">&lt;</button>
                  <div className="p-2 bg-gray-800 rounded text-gray-600 text-center">o</div>
                  <button onClick={() => navigateQuadrant('right')} className="p-2 bg-white/10 hover:bg-white/20 rounded text-white text-center">&gt;</button>
                  <div />
                  <button onClick={() => navigateQuadrant('down')} className="p-2 bg-white/10 hover:bg-white/20 rounded text-white text-center">v</button>
                  <div />
                </div>
              )}

              <div className="text-xs text-gray-500 mt-2">
                {viewMode === 'quadrant'
                  ? 'Arrow keys / WASD to navigate'
                  : 'Click quadrant to enter'}
              </div>
            </div>

            {/* Pattern Section */}
            <div className="flex-1">
              <div className="text-xs text-gray-400 mb-2">Patterns</div>
              {/* Category filter buttons - vertical stack */}
              <div className="flex flex-col gap-1 mb-3">
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={`px-3 py-1.5 rounded text-xs font-mono transition-all text-left ${
                    selectedCategory === 'all'
                      ? 'bg-white/20 text-white border border-white/30'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  All Patterns
                </button>
                {(Object.keys(CATEGORY_INFO) as PatternCategory[]).map((cat) => {
                  const info = CATEGORY_INFO[cat];
                  return (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3 py-1.5 rounded text-xs font-mono transition-all border text-left ${
                        selectedCategory === cat ? info.color : 'text-gray-400 border-transparent hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {info.icon} {info.label}
                    </button>
                  );
                })}
              </div>
              {/* Pattern buttons - grid layout */}
              <div className="grid grid-cols-2 gap-1">
                {filteredPatterns.map((pattern) => {
                  const catInfo = CATEGORY_INFO[pattern.category];
                  const isSelected = selectedPattern.name === pattern.name;
                  return (
                    <button
                      key={pattern.name}
                      onClick={() => setSelectedPattern(pattern)}
                      className={`px-2 py-1.5 rounded text-xs font-mono transition-all border ${
                        isSelected
                          ? catInfo.color + ' ring-1 ring-white/30'
                          : 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10'
                      }`}
                      title={pattern.description}
                    >
                      {pattern.name}
                    </button>
                  );
                })}
              </div>
              {/* Selected pattern info */}
              <div className="mt-3 pt-3 border-t border-white/10 text-xs">
                <div className={`font-mono ${CATEGORY_INFO[selectedPattern.category].color.split(' ')[0]}`}>
                  {selectedPattern.name} ({parsedPattern.length} cells)
                </div>
                <div className="text-gray-500 mt-1">{selectedPattern.description}</div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-gray-400">Rotation:</span>
                  <button
                    onClick={cycleRotation}
                    className="px-2 py-0.5 bg-white/10 hover:bg-white/20 rounded text-white font-mono"
                  >
                    {['0°', '90°', '180°', '270°'][rotation]}
                  </button>
                  <span className="text-gray-500 text-[10px]">(R key)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Collapsed indicators - shown when collapsed */}
          <div className={`${sidebarCollapsed ? 'flex flex-col items-center py-4 gap-2' : 'hidden'}`}>
            <div className="text-xs text-gray-400">G</div>
            <div className="text-dfinity-turquoise text-xs font-mono">{gameState?.generation.toString() || 0}</div>
            <div className="text-xs text-gray-400 mt-2">P</div>
            <div className="text-white text-xs font-mono">{gameState?.players.length || 0}</div>
            {myPlayerNum && (
              <>
                <div className="text-xs text-gray-400 mt-2">You</div>
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: PLAYER_COLORS[myPlayerNum] }} />
              </>
            )}
          </div>
        </div>

        {/* Canvas Container */}
        <div className="flex-1 flex flex-col relative bg-black">
          {/* WebSocket connection status indicator (Hybrid Architecture) */}
          <div className={`absolute top-2 left-2 z-10 flex items-center gap-2 px-2 py-1 rounded text-xs font-mono ${
            wsConnected
              ? 'bg-green-900/80 text-green-400 border border-green-500/50'
              : 'bg-red-900/80 text-red-400 border border-red-500/50 animate-pulse'
          }`}>
            <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-400' : 'bg-red-400'}`} />
            <span>{wsConnected ? 'Live' : 'Reconnecting...'}</span>
            {wsConnected && gameState?.generation && (
              <span className="text-gray-400">Gen {gameState.generation.toString()}</span>
            )}
          </div>

          {/* Quick wipe indicator - top right overlay (only shown when can wipe) */}
          {myPlayerNum && currentQuadrantInfo?.can_wipe[myPlayerNum - 1] && viewMode === 'quadrant' && (
            <div className="absolute top-2 right-2 z-10">
              <button
                onClick={() => setWipeConfirmQuadrant(currentQuadrant)}
                className="px-3 py-2 bg-green-600 hover:bg-green-500 rounded text-white text-sm font-mono animate-pulse"
              >
                WIPE Q{currentQuadrant}
              </button>
            </div>
          )}

          {/* Wipe confirmation dialog */}
          {wipeConfirmQuadrant !== null && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80">
              <div className="bg-gray-900 border-2 border-yellow-500 rounded-lg p-6 max-w-md mx-4">
                <h3 className="text-xl font-bold text-yellow-400 mb-4">Confirm Quadrant Wipe</h3>
                <p className="text-white mb-4">
                  You are about to <span className="text-red-400 font-bold">WIPE Quadrant {wipeConfirmQuadrant}</span>.
                </p>
                <div className="text-sm text-gray-400 mb-4 space-y-2">
                  <p>This action will:</p>
                  <ul className="list-disc list-inside space-y-1 text-gray-300">
                    <li><span className="text-red-400">Kill all cells</span> in the quadrant (yours and others')</li>
                    <li><span className="text-green-400">Claim all territory</span> as yours</li>
                    <li><span className="text-yellow-400">Lock the quadrant</span> - others cannot place cells inside</li>
                    <li><span className="text-orange-400">Points are preserved</span> in the territory</li>
                  </ul>
                  <p className="mt-2 text-yellow-500 font-semibold">
                    Warning: You can only wipe each quadrant ONCE per game!
                  </p>
                </div>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setWipeConfirmQuadrant(null)}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-white text-sm font-mono"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleWipeQuadrant(wipeConfirmQuadrant)}
                    disabled={isWiping}
                    className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded text-white text-sm font-mono disabled:opacity-50"
                  >
                    {isWiping ? 'Wiping...' : 'WIPE QUADRANT'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Wipe success toast */}
          {wipeSuccess && (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 bg-green-600/90 border border-green-400 text-white px-4 py-3 rounded-lg text-sm max-w-md flex items-center gap-3">
              <span>{wipeSuccess}</span>
              <button onClick={() => setWipeSuccess(null)} className="text-white/80 hover:text-white font-bold">x</button>
            </div>
          )}

          {/* Wipe error toast */}
          {wipeError && (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 bg-red-600/90 border border-red-400 text-white px-4 py-3 rounded-lg text-sm max-w-md flex items-center gap-3">
              <span>{wipeError}</span>
              <button onClick={() => setWipeError(null)} className="text-white/80 hover:text-white font-bold">x</button>
            </div>
          )}

          {/* Pending placements panel */}
          {pendingPlacements.length > 0 && viewMode === 'quadrant' && (
            <div className="absolute top-12 left-2 z-10 bg-black/90 border border-white/30 text-white px-4 py-3 rounded-lg text-sm max-w-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-dfinity-turquoise">
                  {pendingPlacements.length} pattern{pendingPlacements.length > 1 ? 's' : ''}
                </span>
                <span className="text-gray-400">
                  Cost: <span className={myBalance >= pendingPlacements.reduce((sum, p) => sum + p.cells.length, 0) ? 'text-green-400' : 'text-red-400'}>
                    {pendingPlacements.reduce((sum, p) => sum + p.cells.length, 0)}
                  </span> / {myBalance} pts
                </span>
              </div>

              {/* List of pending placements */}
              <div className="max-h-32 overflow-y-auto mb-2 space-y-1">
                {pendingPlacements.map((placement, idx) => (
                  <div key={placement.id} className="flex items-center justify-between bg-white/5 px-2 py-1 rounded text-xs">
                    <span className="text-gray-300">
                      {idx + 1}. {placement.patternName} ({placement.cells.length} cells)
                    </span>
                    <button
                      onClick={() => removePlacement(placement.id)}
                      className="text-red-400 hover:text-red-300 px-1"
                      title="Remove this placement"
                    >
                      x
                    </button>
                  </div>
                ))}
              </div>

              {/* Next pattern preview with rotation */}
              <div className="flex items-center gap-3 mb-2 p-2 bg-white/5 rounded">
                <div className="flex-shrink-0">
                  <PatternPreview pattern={rotatedPattern} color={myPlayerNum !== null ? PLAYER_COLORS[myPlayerNum] : '#FFFFFF'} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-gray-400">Next: {selectedPattern.name}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <button
                      onClick={cycleRotation}
                      className="px-2 py-0.5 bg-white/10 hover:bg-white/20 rounded text-white font-mono text-xs"
                    >
                      {['0°', '90°', '180°', '270°'][rotation]}
                    </button>
                    <span className="text-gray-500 text-[10px]">R to rotate</span>
                  </div>
                </div>
              </div>

              {/* Error message */}
              {placementError && (
                <div className="text-red-400 text-xs mb-2 bg-red-500/20 px-2 py-1 rounded">
                  {placementError}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2">
                <button
                  onClick={confirmPlacement}
                  disabled={isConfirmingPlacement || myBalance < pendingPlacements.reduce((sum, p) => sum + p.cells.length, 0)}
                  className={`px-4 py-1.5 rounded font-mono text-sm transition-all ${
                    isConfirmingPlacement
                      ? 'bg-gray-600 text-gray-400 cursor-wait'
                      : myBalance < pendingPlacements.reduce((sum, p) => sum + p.cells.length, 0)
                      ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                      : 'bg-green-600 hover:bg-green-500 text-white'
                  }`}
                >
                  {isConfirmingPlacement ? 'Placing...' : pendingPlacements.length > 1 ? 'Confirm All' : 'Confirm'}
                </button>
                <button
                  onClick={cancelPreview}
                  disabled={isConfirmingPlacement}
                  className="px-4 py-1.5 rounded font-mono text-sm bg-gray-700 hover:bg-gray-600 text-white transition-all disabled:opacity-50"
                >
                  {pendingPlacements.length > 1 ? 'Clear All' : 'Cancel'}
                </button>
              </div>

              <div className="text-xs text-gray-500 mt-2">
                Click grid to add more patterns
              </div>
            </div>
          )}

          {/* Placement error toast (when no placements pending) */}
          {placementError && pendingPlacements.length === 0 && (
            <div className="absolute top-12 left-2 z-10 bg-red-500/80 text-white px-3 py-2 rounded text-sm flex items-center gap-2">
              {placementError}
              <button onClick={() => setPlacementError(null)} className="font-bold hover:text-red-200">x</button>
            </div>
          )}

          {/* Canvas */}
          <div ref={containerRef} className="flex-1 w-full h-full min-h-0">
            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              onContextMenu={(e) => e.preventDefault()}
              className={`w-full h-full ${viewMode === 'quadrant' ? 'cursor-crosshair' : 'cursor-pointer'}`}
              style={{ display: 'block' }}
            />
          </div>
        </div>
      </div>

      {/* Mobile Bottom Bar - inline to prevent remounting */}
      <div className="lg:hidden bg-black border-t border-white/20">
        {/* Collapsed view - just expand button */}
        <div className="flex items-center justify-between p-2">
          <div className="flex items-center gap-2 text-xs font-mono text-gray-400">
            {myPlayerNum && (
              <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: PLAYER_COLORS[myPlayerNum] }} />
            )}
            <span>Patterns</span>
          </div>
          <button
            onClick={() => setMobileExpanded(!mobileExpanded)}
            className="p-2 text-gray-400 hover:text-white"
          >
            {mobileExpanded ? 'v' : '^'}
          </button>
        </div>

        {/* Expanded view */}
        {mobileExpanded && (
          <div className="p-3 border-t border-white/10 max-h-64 overflow-y-auto">

            {/* Territory/cell stats in row */}
            <div className="flex gap-4 mb-3 text-xs overflow-x-auto">
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Territory:</span>
                {Object.entries(territoryCounts).slice(0, 4).map(([player, count]) => (
                  <div key={player} className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-sm opacity-50" style={{ backgroundColor: PLAYER_COLORS[parseInt(player)] }} />
                    <span style={{ color: PLAYER_COLORS[parseInt(player)] }}>{count}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Cells:</span>
                {Object.entries(cellCounts).slice(0, 4).map(([player, count]) => (
                  <div key={`cell-${player}`} className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: PLAYER_COLORS[parseInt(player)] }} />
                    <span style={{ color: PLAYER_COLORS[parseInt(player)] }}>{count}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Category filters */}
            <div className="flex gap-2 mb-2 overflow-x-auto pb-1">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-2 py-1 rounded text-xs font-mono whitespace-nowrap ${
                  selectedCategory === 'all' ? 'bg-white/20 text-white' : 'text-gray-400'
                }`}
              >
                All
              </button>
              {(Object.keys(CATEGORY_INFO) as PatternCategory[]).map((cat) => {
                const info = CATEGORY_INFO[cat];
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2 py-1 rounded text-xs font-mono whitespace-nowrap border ${
                      selectedCategory === cat ? info.color : 'text-gray-400 border-transparent'
                    }`}
                  >
                    {info.icon} {info.label}
                  </button>
                );
              })}
            </div>
            {/* Horizontal scrolling pattern selector */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              {filteredPatterns.map((pattern) => {
                const catInfo = CATEGORY_INFO[pattern.category];
                const isSelected = selectedPattern.name === pattern.name;
                return (
                  <button
                    key={pattern.name}
                    onClick={() => setSelectedPattern(pattern)}
                    className={`px-3 py-1.5 rounded text-xs font-mono whitespace-nowrap border ${
                      isSelected
                        ? catInfo.color + ' ring-1 ring-white/30'
                        : 'bg-white/5 text-gray-300 border-white/10'
                    }`}
                  >
                    {pattern.name}
                  </button>
                );
              })}
            </div>
            {/* Selected pattern info */}
            <div className="text-xs text-gray-400 mt-2 flex items-center gap-2 flex-wrap">
              <span>
                Selected: <span className={CATEGORY_INFO[selectedPattern.category].color.split(' ')[0]}>{selectedPattern.name}</span> ({parsedPattern.length} cells)
              </span>
              <button
                onClick={cycleRotation}
                className="px-2 py-0.5 bg-white/10 hover:bg-white/20 rounded text-white font-mono text-[10px]"
              >
                {['0°', '90°', '180°', '270°'][rotation]}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
