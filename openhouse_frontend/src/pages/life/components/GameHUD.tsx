/**
 * GameHUD - Clean, informative heads-up display for Game of Life
 *
 * Displays essential game information at a glance:
 * - Player faction badge with element icon
 * - Generation counter with lag indicator
 * - Sync status indicator with reconnection feedback
 * - Transaction pending indicators
 * - Player stats (cells, territory, base coins)
 * - View mode indicator
 *
 * Uses Framer Motion for smooth transitions
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { RegionInfo } from '../../lifeConstants';

export interface SyncStatus {
  inSync: boolean;
  driftGens: number;
  lastLocalHash: string;
  lastBackendHash: string;
}

export interface PendingTransactions {
  isPlacingCells: boolean;
  isRequestingFaucet: boolean;
  isJoiningGame: boolean;
  pendingPlacementCount: number;
}

export interface GameHUDProps {
  // Player info
  myPlayerNum: number | null;
  region: RegionInfo | null;
  isSpectating: boolean;

  // Game state
  generation: bigint | number;
  localGeneration: bigint | number;
  lastSyncedGeneration: bigint | number;

  // Player stats
  myCellCount: number;
  myTerritoryCount: number;
  myBaseCoins: number;
  myWalletBalance: number;

  // View state
  viewMode: 'overview' | 'quadrant';
  currentQuadrant: number;

  // Sync status
  syncStatus: SyncStatus;
  lastSyncTime: number;

  // Transaction status
  pendingTransactions?: PendingTransactions;

  // Optional: wipe timer
  wipeInfo?: { quadrant: number; secondsUntil: number } | null;

  // Actions
  onJoinGame?: () => void;
}

const hudVariants = {
  hidden: { opacity: 0, y: -10 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 }
};

const statVariants = {
  pulse: {
    scale: [1, 1.05, 1],
    transition: { duration: 0.3 }
  }
};

// Enhanced sync status indicator with detailed feedback
const SyncIndicator: React.FC<{
  status: SyncStatus;
  lastSyncTime: number;
  localGeneration: bigint | number;
  lastSyncedGeneration: bigint | number;
  compact?: boolean;
}> = ({ status, lastSyncTime, localGeneration, lastSyncedGeneration, compact }) => {
  const timeSinceSync = Date.now() - lastSyncTime;
  const isStale = timeSinceSync > 5000; // 5 seconds without sync
  const isVeryStale = timeSinceSync > 15000; // 15 seconds - major connection issue

  // Calculate generation lag
  const localGen = typeof localGeneration === 'bigint' ? localGeneration : BigInt(localGeneration);
  const syncedGen = typeof lastSyncedGeneration === 'bigint' ? lastSyncedGeneration : BigInt(lastSyncedGeneration);
  const genLag = localGen > syncedGen ? Number(localGen - syncedGen) : 0;

  // Determine status color and message
  let color = 'bg-green-500';
  let title = 'Synced with blockchain';
  let pulseClass = '';
  let statusText = 'Live';
  let showLag = false;

  if (isVeryStale) {
    color = 'bg-red-600';
    title = 'Connection lost - check your network';
    pulseClass = 'animate-pulse';
    statusText = 'Offline';
  } else if (isStale) {
    color = 'bg-red-500';
    title = 'Connection lost - attempting to reconnect';
    pulseClass = 'animate-pulse';
    statusText = 'Reconnecting';
  } else if (!status.inSync || status.driftGens > 8) {
    color = 'bg-yellow-500';
    title = `Syncing... (${status.driftGens} generations behind)`;
    pulseClass = 'animate-pulse';
    statusText = 'Syncing';
    showLag = status.driftGens > 0;
  } else if (genLag > 10) {
    // Local simulation is running ahead of last sync
    color = 'bg-cyan-500';
    title = `Simulating ahead (+${genLag} generations)`;
    statusText = 'Sim';
    showLag = true;
  }

  return (
    <div className="flex items-center gap-1.5" title={title}>
      <div className={`w-2 h-2 rounded-full ${color} ${pulseClass}`} />
      {!compact && (
        <span className={`text-xs hidden sm:inline ${isStale ? 'text-red-400' : 'text-gray-500'}`}>
          {statusText}
          {showLag && !isStale && (
            <span className="text-cyan-400 ml-1">+{genLag}</span>
          )}
        </span>
      )}
    </div>
  );
};

// Transaction pending indicator
const TransactionIndicator: React.FC<{
  pending: PendingTransactions;
  compact?: boolean;
}> = ({ pending, compact }) => {
  const { isPlacingCells, isRequestingFaucet, isJoiningGame, pendingPlacementCount } = pending;
  const hasAnyPending = isPlacingCells || isRequestingFaucet || isJoiningGame;

  if (!hasAnyPending) return null;

  let label = 'Processing...';
  let icon = '⏳';
  if (isPlacingCells) {
    label = pendingPlacementCount > 0 ? `Placing ${pendingPlacementCount} cells` : 'Placing...';
    icon = '⚡';
  } else if (isJoiningGame) {
    label = 'Joining game...';
    icon = '🎮';
  } else if (isRequestingFaucet) {
    label = 'Faucet...';
    icon = '💰';
  }

  return (
    <motion.div
      className="flex items-center gap-1.5"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
    >
      <motion.span
        className="text-sm"
        animate={{ rotate: [0, 15, -15, 0] }}
        transition={{ duration: 0.5, repeat: Infinity, ease: "easeInOut" }}
      >
        {icon}
      </motion.span>
      {!compact && (
        <span className="text-xs text-amber-400">{label}</span>
      )}
    </motion.div>
  );
};

// Connection lost overlay - shown when severely disconnected
const ConnectionLostOverlay: React.FC<{
  timeSinceSync: number;
  onRetry?: () => void;
}> = ({ timeSinceSync, onRetry }) => {
  const seconds = Math.floor(timeSinceSync / 1000);

  return (
    <motion.div
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="bg-gray-900/95 border border-red-500/50 rounded-xl p-6 max-w-sm mx-4 text-center"
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', damping: 20 }}
      >
        <motion.div
          className="text-4xl mb-4"
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          📡
        </motion.div>
        <h3 className="text-lg font-bold text-red-400 mb-2">Connection Lost</h3>
        <p className="text-gray-400 text-sm mb-4">
          Unable to reach the blockchain for {seconds}s.<br />
          The game simulation continues locally.
        </p>
        <div className="flex items-center justify-center gap-2 mb-4">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <span className="text-xs text-red-400">Attempting to reconnect...</span>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm rounded-lg transition-colors"
          >
            Retry Now
          </button>
        )}
      </motion.div>
    </motion.div>
  );
};

// Faction badge component
const FactionBadge: React.FC<{ region: RegionInfo }> = ({ region }) => (
  <motion.div
    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border"
    style={{
      backgroundColor: `${region.primaryColor}15`,
      borderColor: `${region.primaryColor}40`,
    }}
    initial={{ scale: 0.9, opacity: 0 }}
    animate={{ scale: 1, opacity: 1 }}
    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
  >
    <span className="text-lg">{region.element}</span>
    <span className="font-medium text-sm" style={{ color: region.primaryColor }}>
      {region.name}
    </span>
  </motion.div>
);

// Stat pill component
const StatPill: React.FC<{
  label: string;
  value: string | number;
  color?: string;
  icon?: string;
  highlight?: boolean;
  warning?: boolean;
}> = ({ label, value, color, icon, highlight, warning }) => (
  <motion.div
    className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-mono ${
      highlight ? 'bg-white/10 border border-white/20' :
      warning ? 'bg-yellow-500/20 border border-yellow-500/30' :
      'bg-black/40'
    }`}
    whileHover={{ scale: 1.02 }}
    variants={statVariants}
  >
    {icon && <span className="opacity-70">{icon}</span>}
    <span className="text-gray-400">{label}</span>
    <span className={color || 'text-white'} style={color?.startsWith('#') ? { color } : undefined}>
      {typeof value === 'number' ? value.toLocaleString() : value}
    </span>
  </motion.div>
);

export const GameHUD: React.FC<GameHUDProps> = ({
  myPlayerNum,
  region,
  isSpectating,
  generation,
  localGeneration,
  lastSyncedGeneration,
  myCellCount,
  myTerritoryCount,
  myBaseCoins,
  myWalletBalance,
  viewMode,
  currentQuadrant,
  syncStatus,
  lastSyncTime,
  pendingTransactions,
  wipeInfo,
  onJoinGame,
}) => {
  const displayGen = typeof generation === 'bigint' ? generation.toString() : String(generation);
  const timeSinceSync = Date.now() - lastSyncTime;
  const showConnectionOverlay = timeSinceSync > 30000; // 30 seconds - show major overlay

  return (
    <>
      {/* Connection lost overlay for severe disconnection */}
      <AnimatePresence>
        {showConnectionOverlay && (
          <ConnectionLostOverlay timeSinceSync={timeSinceSync} />
        )}
      </AnimatePresence>

      {/* Desktop HUD - hidden on mobile (shown on lg and up) */}
      <motion.div
        className="hidden lg:flex absolute top-3 right-3 z-20 flex-col items-end gap-2"
        initial="hidden"
        animate="visible"
        variants={hudVariants}
        transition={{ staggerChildren: 0.05 }}
      >
        {/* Top row: Sync status + Transactions + Generation */}
        <motion.div
          className="flex items-center gap-3 bg-black/80 backdrop-blur-sm px-3 py-2 rounded-lg border border-white/10"
          variants={hudVariants}
        >
          <SyncIndicator
            status={syncStatus}
            lastSyncTime={lastSyncTime}
            localGeneration={localGeneration}
            lastSyncedGeneration={lastSyncedGeneration}
          />

          {/* Transaction indicator */}
          <AnimatePresence>
            {pendingTransactions && (pendingTransactions.isPlacingCells || pendingTransactions.isRequestingFaucet || pendingTransactions.isJoiningGame) && (
              <>
                <div className="w-px h-4 bg-white/20" />
                <TransactionIndicator pending={pendingTransactions} />
              </>
            )}
          </AnimatePresence>

          <div className="w-px h-4 bg-white/20" />

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400">Gen</span>
            <span className="font-mono text-sm text-cyan-400">{displayGen}</span>
          </div>

          <div className="w-px h-4 bg-white/20" />

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400">{viewMode === 'overview' ? 'World' : `Q${currentQuadrant}`}</span>
          </div>
        </motion.div>

        {/* Player faction badge (when playing) */}
        <AnimatePresence mode="wait">
          {region && myPlayerNum && (
            <motion.div
              key="faction"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <FactionBadge region={region} />
            </motion.div>
          )}

          {isSpectating && (
            <motion.div
              key="spectating"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-500/20 border border-purple-500/40"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <span className="text-purple-400">Spectating</span>
              {onJoinGame && (
                <button
                  onClick={onJoinGame}
                  className="px-2 py-0.5 text-xs bg-green-600 hover:bg-green-500 text-white rounded transition-colors"
                >
                  Join
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Player stats row (when playing) */}
        <AnimatePresence>
          {myPlayerNum && (
            <motion.div
              className="flex items-center gap-2 flex-wrap justify-end"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <StatPill
                label="Cells"
                value={myCellCount}
                color={region?.primaryColor}
                highlight={myCellCount === 0}
                warning={myCellCount > 0 && myCellCount < 10}
              />
              <StatPill
                label="Territory"
                value={myTerritoryCount}
                color={`${region?.primaryColor}99`}
              />
              <StatPill
                label="Base"
                value={myBaseCoins}
                icon="B"
                color="text-yellow-400"
                warning={myBaseCoins < 50}
              />
              <StatPill
                label="Wallet"
                value={myWalletBalance}
                icon="W"
                color="text-green-400"
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Wipe warning (when applicable) */}
        <AnimatePresence>
          {wipeInfo && wipeInfo.secondsUntil <= 30 && (
            <motion.div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${
                wipeInfo.secondsUntil <= 10
                  ? 'bg-red-500/30 border border-red-500/50 animate-pulse'
                  : 'bg-orange-500/20 border border-orange-500/40'
              }`}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              <span className="text-xs text-red-400">Quadrant {wipeInfo.quadrant} wipe in</span>
              <span className="font-mono text-sm text-red-300 font-bold">{wipeInfo.secondsUntil}s</span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Mobile HUD - compact version shown on small screens (hidden on lg and up) */}
      <motion.div
        className="lg:hidden absolute top-2 left-2 right-2 z-20 flex items-center justify-between gap-2"
        initial="hidden"
        animate="visible"
        variants={hudVariants}
      >
        {/* Left side: Sync + Transactions + Gen + Quadrant */}
        <motion.div
          className="flex items-center gap-2 bg-black/80 backdrop-blur-sm px-2 py-1.5 rounded-lg border border-white/10"
          variants={hudVariants}
        >
          <SyncIndicator
            status={syncStatus}
            lastSyncTime={lastSyncTime}
            localGeneration={localGeneration}
            lastSyncedGeneration={lastSyncedGeneration}
            compact
          />
          {/* Transaction indicator (compact) */}
          <AnimatePresence>
            {pendingTransactions && (pendingTransactions.isPlacingCells || pendingTransactions.isRequestingFaucet || pendingTransactions.isJoiningGame) && (
              <TransactionIndicator pending={pendingTransactions} compact />
            )}
          </AnimatePresence>
          <span className="font-mono text-xs text-cyan-400">{displayGen}</span>
          <span className="text-xs text-gray-500">{viewMode === 'overview' ? 'W' : `Q${currentQuadrant}`}</span>
        </motion.div>

        {/* Right side: Faction or Spectator badge */}
        <AnimatePresence mode="wait">
          {region && myPlayerNum && (
            <motion.div
              key="faction-mobile"
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg border bg-black/60"
              style={{
                backgroundColor: `${region.primaryColor}15`,
                borderColor: `${region.primaryColor}40`,
              }}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <span className="text-sm">{region.element}</span>
              <span className="text-xs font-medium" style={{ color: region.primaryColor }}>
                {myCellCount}
              </span>
            </motion.div>
          )}

          {isSpectating && (
            <motion.div
              key="spectating-mobile"
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-purple-500/20 border border-purple-500/40"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <span className="text-xs text-purple-400">Spectating</span>
              {onJoinGame && (
                <button
                  onClick={onJoinGame}
                  className="px-1.5 py-0.5 text-[10px] bg-green-600 text-white rounded"
                >
                  Join
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Mobile wipe warning - bottom position for visibility */}
      <AnimatePresence>
        {wipeInfo && wipeInfo.secondsUntil <= 30 && (
          <motion.div
            className={`lg:hidden absolute bottom-16 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-3 py-1.5 rounded-lg ${
              wipeInfo.secondsUntil <= 10
                ? 'bg-red-500/40 border border-red-500/60 animate-pulse'
                : 'bg-orange-500/30 border border-orange-500/50'
            }`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            <span className="text-xs text-red-300">Q{wipeInfo.quadrant} wipe</span>
            <span className="font-mono text-sm text-red-200 font-bold">{wipeInfo.secondsUntil}s</span>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default GameHUD;
