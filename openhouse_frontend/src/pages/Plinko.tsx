import React, { useEffect, useState, useCallback } from 'react';
import usePlinkoActor from '../hooks/actors/usePlinkoActor';
import { GameLayout, GameButton, GameStats, type GameStat } from '../components/game-ui';
import { PlinkoBoard, PlinkoMultipliers } from '../components/game-specific/plinko';
import { ConnectionStatus } from '../components/ui/ConnectionStatus';

interface PlinkoGameResult {
  path: boolean[];
  final_position: number;
  multiplier: number;
  timestamp: number;
  clientId?: string;
}

export const Plinko: React.FC = () => {
  const { actor } = usePlinkoActor();

  // Game state
  const [isPlaying, setIsPlaying] = useState(false);
  const [gameError, setGameError] = useState('');
  const [history, setHistory] = useState<PlinkoGameResult[]>([]);

  // Fixed configuration (8 rows, no user choice)
  const ROWS = 8;
  const [multipliers, setMultipliers] = useState<number[]>([]);
  const [currentResult, setCurrentResult] = useState<{ path: boolean[]; final_position: number; multiplier: number } | null>(null);

  // Load multipliers once on mount
  useEffect(() => {
    const loadMultipliers = async () => {
      if (!actor) return;
      try {
        const mults = await actor.get_multipliers();  // No parameters!
        setMultipliers(mults);
      } catch (err) {
        console.error('Failed to load multipliers:', err);
      }
    };
    loadMultipliers();
  }, [actor]);

  // Handle ball drop
  const dropBall = async () => {
    if (!actor) return;

    setIsPlaying(true);
    setGameError('');
    setCurrentResult(null);

    try {
      const result = await actor.drop_ball();  // No parameters!

      if ('Ok' in result) {
        const gameResult: PlinkoGameResult = {
          ...result.Ok,
          timestamp: Date.now(),
          clientId: crypto.randomUUID()
        };

        setCurrentResult(result.Ok);
        setHistory(prev => [gameResult, ...prev.slice(0, 9)]);
      } else {
        setGameError(result.Err);
        setIsPlaying(false);
      }
    } catch (err) {
      console.error('Failed to drop ball:', err);
      setGameError(err instanceof Error ? err.message : 'Failed to drop ball');
      setIsPlaying(false);
    }
  };

  const handleAnimationComplete = useCallback(() => {
    setIsPlaying(false);
  }, []);

  // Simple stats
  const minMultiplier = multipliers.length > 0 ? Math.min(...multipliers) : 0;
  const maxMultiplier = multipliers.length > 0 ? Math.max(...multipliers) : 0;

  const stats: GameStat[] = [
    { label: 'Max Win', value: `${maxMultiplier.toFixed(0)}x`, highlight: true, color: 'red' },
    { label: 'House Edge', value: '1%', highlight: true, color: 'green' },
    { label: 'Rows', value: '8' },
  ];

  return (
    <GameLayout
      title="Plinko"
      icon="🎯"
      description="Drop the ball and watch it bounce to a mathematically fair multiplier!"
      minBet={1}
      maxWin={253}
      houseEdge={1}
    >
      <ConnectionStatus game="plinko" />

      {/* HOW IT WORKS - Transparency Section */}
      <div className="card max-w-2xl mx-auto mb-6">
        <h3 className="font-bold mb-3 text-center text-dfinity-turquoise">How Plinko Odds Work</h3>
        <div className="text-sm text-pure-white/80 space-y-2">
          <p>
            The ball bounces randomly at each peg with a 50/50 chance of going left or right.
            There are <strong>256 possible paths</strong> (2^8).
          </p>
          <p>
            Landing on the edges is rare (only 1 path), so those positions pay <strong>253.44x</strong>.
            The center is most common (70 paths), so it pays <strong>3.62x</strong>.
          </p>
          <p className="font-mono text-xs bg-pure-black/30 p-2 rounded">
            Multiplier = (256 ÷ paths to position) × 0.99
          </p>
          <p>
            The <strong>0.99 multiplier</strong> gives the house a fair 1% edge—completely transparent
            and mathematically provable. You can verify this yourself!
          </p>
        </div>
      </div>

      {/* GAME CONTROLS - Simplified, no configuration */}
      <div className="card max-w-2xl mx-auto">
        <GameStats stats={stats} />

        <GameButton
          onClick={dropBall}
          disabled={!actor}
          loading={isPlaying}
          label="DROP BALL"
          loadingLabel="Dropping..."
          icon="🎯"
        />

        {gameError && (
          <div className="mt-4 text-red-400 text-sm text-center">
            {gameError}
          </div>
        )}
      </div>

      {/* PLINKO BOARD - Always 8 rows */}
      <div className="card max-w-4xl mx-auto">
        <PlinkoBoard
          rows={ROWS}
          path={currentResult?.path || null}
          isDropping={isPlaying}
          onAnimationComplete={handleAnimationComplete}
          finalPosition={currentResult?.final_position}
        />

        {/* Multiplier display with probabilities */}
        {multipliers.length > 0 && (
          <div className="mt-4">
            <PlinkoMultipliers
              multipliers={multipliers}
              highlightedIndex={currentResult?.final_position}
            />
            {/* Optionally show probabilities */}
            <div className="text-xs text-pure-white/40 text-center mt-2 font-mono">
              Probabilities: 0.4% | 3.1% | 10.9% | 21.9% | 27.3% | 21.9% | 10.9% | 3.1% | 0.4%
            </div>
          </div>
        )}

        {/* Win message */}
        {currentResult && !isPlaying && (
          <div className="text-center mt-6">
            <div className="text-3xl font-bold mb-2 text-dfinity-turquoise">
              {currentResult.multiplier >= 30 ? '🎉 BIG WIN!' : '✨'}
            </div>
            <div className="text-2xl font-mono text-yellow-500">
              {currentResult.multiplier.toFixed(2)}x Multiplier
            </div>
          </div>
        )}
      </div>

      {/* Game History */}
      <div className="card max-w-2xl mx-auto">
        <h3 className="font-bold mb-4 text-center">Recent Drops</h3>
        {history.length === 0 ? (
          <div className="text-center text-gray-400 py-6">
            No drops yet. Start playing!
          </div>
        ) : (
          <div className="space-y-2">
            {history.slice(0, 10).map((item, index) => (
              <div
                key={item.clientId || index}
                className="bg-casino-primary border border-pure-white/10 p-3 flex justify-between items-center"
              >
                <span className="font-mono text-xs text-gray-400">
                  Position {item.final_position}
                </span>
                <span className={`font-bold ${
                  item.multiplier >= 30 ? 'text-dfinity-red' :
                  item.multiplier >= 9 ? 'text-yellow-500' :
                  'text-dfinity-turquoise'
                }`}>
                  {item.multiplier.toFixed(2)}x
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </GameLayout>
  );
};
