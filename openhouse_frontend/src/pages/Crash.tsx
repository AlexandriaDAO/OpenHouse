import React, { useEffect, useState, useCallback } from 'react';
import useCrashActor from '../hooks/actors/useCrashActor';
import {
  GameLayout,
  GameButton,
  GameStats,
  GameHistory,
  type GameStat
} from '../components/game-ui';
import {
  CrashRocket,
  CrashGraph,
  CrashProbabilityTable
} from '../components/game-specific/crash';
import { useAuth } from '../providers/AuthProvider';

interface CrashGameResult {
  crash_point: number;
  randomness_hash: string;
  timestamp?: number;
  clientId?: string;
}

export const Crash: React.FC = () => {
  const { actor } = useCrashActor();
  const { isAuthenticated } = useAuth();

  // Game state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentMultiplier, setCurrentMultiplier] = useState(1.0);
  const [crashPoint, setCrashPoint] = useState<number | null>(null);
  const [targetCashout, setTargetCashout] = useState(2.0);
  const [autoCashout, setAutoCashout] = useState(false);
  const [gameError, setGameError] = useState('');
  const [history, setHistory] = useState<CrashGameResult[]>([]);
  const [graphHistory, setGraphHistory] = useState<Array<{ multiplier: number; timestamp: number }>>([]);

  // Start game
  const startGame = async () => {
    if (!actor) return;
    if (!isAuthenticated) {
      setGameError('Please log in to play');
      return;
    }

    setIsPlaying(true);
    setGameError('');
    setCrashPoint(null);
    setCurrentMultiplier(1.0);
    setGraphHistory([]);

    try {
      // Get crash point from backend
      const result = await actor.simulate_crash();

      if ('Ok' in result) {
        const crash = result.Ok.crash_point;
        setCrashPoint(crash);

        // Animate multiplier rise
        animateMultiplier(crash);

        // Add to history
        const gameResult: CrashGameResult = {
          ...result.Ok,
          timestamp: Date.now(),
          clientId: crypto.randomUUID()
        };
        setHistory(prev => [gameResult, ...prev.slice(0, 19)]);
      } else {
        setGameError(result.Err);
        setIsPlaying(false);
      }
    } catch (err) {
      setGameError(err instanceof Error ? err.message : 'Failed to start game');
      setIsPlaying(false);
    }
  };

  // Animate multiplier from 1.0 to crash point
  const animateMultiplier = (crash: number) => {
    const startTime = Date.now();
    const duration = Math.min(crash * 1000, 10000); // Max 10s animation

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Exponential curve: mult = 1.0 * e^(k*t) where k chosen so mult(duration) = crash
      const k = Math.log(crash) / duration;
      const mult = Math.exp(k * elapsed);

      setCurrentMultiplier(mult);
      setGraphHistory(prev => [...prev, { multiplier: mult, timestamp: elapsed }]);

      // Auto cash-out check
      if (autoCashout && mult >= targetCashout) {
        handleCashout();
        return;
      }

      // Check if crashed
      if (mult >= crash || progress >= 1) {
        setCurrentMultiplier(crash);
        setTimeout(() => setIsPlaying(false), 1000);
        return;
      }

      requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  };

  // Manual cash-out
  const handleCashout = () => {
    if (!isPlaying || !crashPoint) return;

    if (currentMultiplier < crashPoint) {
      // Successful cash-out
      setGameError('');
      // TODO: Process payout
      setIsPlaying(false);
    }
  };

  const handleCrashComplete = useCallback(() => {
    // Called when rocket explosion animation finishes
    setCurrentMultiplier(1.0);
    setCrashPoint(null);
    setGraphHistory([]);
  }, []);

  // Stats for display
  const stats: GameStat[] = [
    {
      label: 'Target Cash-out',
      value: `${targetCashout.toFixed(2)}x`,
      highlight: true,
      color: 'yellow'
    },
    {
      label: 'Win Chance',
      value: `${((0.99 / targetCashout) * 100).toFixed(2)}%`,
      highlight: true,
      color: 'green'
    },
    {
      label: 'House Edge',
      value: '1%',
      highlight: true,
      color: 'red'
    },
  ];

  // Custom history renderer
  const renderHistoryItem = (item: CrashGameResult) => (
    <div className="flex items-center justify-between w-full">
      <span className="font-mono">{item.crash_point.toFixed(2)}x</span>
      <span className={item.crash_point >= 2.0 ? 'text-green-400' : 'text-red-400'}>
        {item.crash_point >= 2.0 ? '🚀' : '💥'}
      </span>
    </div>
  );

  return (
    <GameLayout
      title="Crash"
      icon="🚀"
      description="Watch the rocket rise and cash out before it crashes!"
      minBet={1}
      maxWin={100}
      houseEdge={1}
    >
      {/* Rocket Animation */}
      <div className="card max-w-4xl mx-auto">
        <CrashRocket
          isLaunching={isPlaying}
          currentMultiplier={currentMultiplier}
          crashPoint={crashPoint}
          onCrashComplete={handleCrashComplete}
        />
      </div>

      {/* Multiplier Graph */}
      <div className="card max-w-4xl mx-auto">
        <h3 className="font-bold mb-4">Multiplier Graph</h3>
        <CrashGraph
          isPlaying={isPlaying}
          currentMultiplier={currentMultiplier}
          crashPoint={crashPoint}
          history={graphHistory}
        />
      </div>

      {/* Game Controls */}
      <div className="card max-w-2xl mx-auto">
        <div className="mb-6">
          <label className="block text-sm font-bold mb-3 text-center text-dfinity-turquoise">
            Target Cash-out Multiplier:
          </label>
          <input
            type="range"
            min="1.01"
            max="100"
            step="0.01"
            value={targetCashout}
            onChange={(e) => setTargetCashout(parseFloat(e.target.value))}
            disabled={isPlaying}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider-turquoise"
          />
          <div className="text-center mt-2 text-2xl font-bold">
            {targetCashout.toFixed(2)}x
          </div>
        </div>

        <div className="mb-6">
          <label className="flex items-center justify-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoCashout}
              onChange={(e) => setAutoCashout(e.target.checked)}
              disabled={isPlaying}
              className="w-4 h-4"
            />
            Auto cash-out at target
          </label>
        </div>

        <GameStats stats={stats} collapsible={false} />

        {!isPlaying ? (
          <GameButton
            onClick={startGame}
            disabled={!actor || !isAuthenticated}
            loading={false}
            label="LAUNCH ROCKET"
            icon="🚀"
          />
        ) : (
          <GameButton
            onClick={handleCashout}
            disabled={!crashPoint || currentMultiplier >= crashPoint}
            loading={false}
            label={`CASH OUT ${currentMultiplier.toFixed(2)}x`}
            icon="💰"
            variant="danger"
          />
        )}

        {gameError && (
          <div className="mt-4 text-red-400 text-sm text-center">
            {gameError}
          </div>
        )}
      </div>

      {/* Recent Games */}
      {history.length > 0 && (
        <div className="max-w-2xl mx-auto">
          <div className="card">
            <h3 className="text-sm font-bold mb-3 text-gray-400">Recent Crashes</h3>
            <div className="space-y-1">
              {history.slice(0, 10).map((item, index) => (
                <div
                  key={item.clientId || `item-${index}`}
                  className="flex items-center justify-between text-sm py-2 border-b border-gray-800"
                >
                  {renderHistoryItem(item)}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Probability Table */}
      <div className="max-w-2xl mx-auto">
        <CrashProbabilityTable />
      </div>
    </GameLayout>
  );
};
