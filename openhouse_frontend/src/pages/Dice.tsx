import React, { useEffect, useState, useCallback } from 'react';
import useDiceActor from '../hooks/actors/useDiceActor';
import { useAuth } from '../providers/AuthProvider';
import type { Principal } from '@dfinity/principal';
import { DiceAnimation } from '../components/DiceAnimation';

const MAX_HISTORY_DISPLAY = 5;

interface GameResult {
  player: Principal;
  bet_amount: bigint;
  target_number: number;
  direction: { Over: null } | { Under: null };
  rolled_number: number;
  win_chance: number;
  multiplier: number;
  payout: bigint;
  is_win: boolean;
  timestamp: bigint;
}

interface GameResultWithId extends GameResult {
  clientId: string;
}

export const Dice: React.FC = () => {
  const { actor } = useDiceActor();
  const { isAuthenticated } = useAuth();

  // Game state
  const [betAmount, setBetAmount] = useState(1);
  const [targetNumber, setTargetNumber] = useState(50);
  const [direction, setDirection] = useState<'Over' | 'Under'>('Over');
  const [winChance, setWinChance] = useState(0);
  const [multiplier, setMultiplier] = useState(0);
  const [isRolling, setIsRolling] = useState(false);
  const [lastResult, setLastResult] = useState<GameResult | null>(null);
  const [gameHistory, setGameHistory] = useState<GameResultWithId[]>([]);
  const [gameError, setGameError] = useState('');
  const [animatingResult, setAnimatingResult] = useState<number | null>(null);
  const [showOdds, setShowOdds] = useState(false);

  // Mode toggle: 'practice' or 'real'
  const [mode, setMode] = useState<'practice' | 'real'>('practice');
  const isPracticeMode = mode === 'practice' || !isAuthenticated;

  // Memoized animation complete handler
  const handleAnimationComplete = useCallback(() => {
    setIsRolling(false);
  }, []);

  // Calculate odds when target or direction changes
  useEffect(() => {
    let cancelled = false;
    const currentActor = actor;

    const updateOdds = async () => {
      if (!currentActor) return;

      try {
        const directionVariant = direction === 'Over' ? { Over: null } : { Under: null };
        const result = await currentActor.calculate_payout_info(targetNumber, directionVariant);

        if (!cancelled && 'Ok' in result) {
          const [chance, mult] = result.Ok;
          setWinChance(chance * 100);
          setMultiplier(mult);
        } else if (!cancelled && 'Err' in result) {
          setGameError(result.Err);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to calculate odds:', err);
        }
      }
    };

    updateOdds();

    return () => {
      cancelled = true;
    };
  }, [targetNumber, direction, actor]);

  // Load game history on mount
  useEffect(() => {
    const loadHistory = async () => {
      if (!actor) return;

      try {
        const history = await actor.get_recent_games(10);
        const historyWithIds = history.map((game: GameResult) => ({
          ...game,
          clientId: crypto.randomUUID()
        }));
        setGameHistory(historyWithIds);
      } catch (err) {
        console.error('Failed to load history:', err);
      }
    };

    loadHistory();
  }, [actor]);

  // Handle dice roll (supports both practice and real mode)
  const rollDice = async () => {
    if (!actor) return;

    // Validate bet amount
    if (betAmount < 0.1 || betAmount > 100) {
      setGameError('Bet amount must be between 0.1 and 100 ICP');
      return;
    }

    setIsRolling(true);
    setGameError('');
    setLastResult(null);
    setAnimatingResult(null); // Reset animation

    try {
      const betAmountE8s = BigInt(Math.floor(betAmount * 100_000_000));
      const directionVariant = direction === 'Over' ? { Over: null } : { Under: null };

      // In practice mode (not authenticated), still call backend but it won't affect real balances
      const result = await actor.play_dice(betAmountE8s, targetNumber, directionVariant);

      if ('Ok' in result) {
        // Trigger animation with the result and set result immediately
        setAnimatingResult(result.Ok.rolled_number);
        setLastResult(result.Ok);
        setGameHistory(prev => [{...result.Ok, clientId: crypto.randomUUID()}, ...prev.slice(0, 9)]);
        // isRolling will be set to false by animation complete callback
      } else {
        setGameError(result.Err);
        setIsRolling(false);
        setAnimatingResult(null); // Reset animation on error
      }
    } catch (err) {
      console.error('Failed to roll dice:', err);
      setGameError(err instanceof Error ? err.message : 'Failed to roll dice');
      setIsRolling(false);
      setAnimatingResult(null); // Reset animation on error
    }
  };

  // Handle mode toggle
  const handleModeToggle = (newMode: 'practice' | 'real') => {
    if (newMode === 'real' && !isAuthenticated) {
      setGameError('Please login to use Real Mode');
      return;
    }
    setMode(newMode);
    setGameError('');
  };

  return (
    <div className="space-y-6">
      {/* Game Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-4">🎲 Dice</h1>

        {/* Simplified mode toggle - just icons */}
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => handleModeToggle('practice')}
            className={`px-4 py-2 rounded-lg transition ${
              mode === 'practice' ? 'bg-yellow-600' : 'bg-gray-700'
            }`}
            title="Practice Mode"
            aria-label="Switch to Practice Mode"
          >
            🎮
          </button>
          <button
            onClick={() => handleModeToggle('real')}
            disabled={!isAuthenticated}
            className={`px-4 py-2 rounded-lg transition ${
              mode === 'real' && isAuthenticated ? 'bg-green-600' : 'bg-gray-700'
            }`}
            title={!isAuthenticated ? 'Login for Real Mode' : 'Real Mode'}
            aria-label={!isAuthenticated ? 'Login required for Real Mode' : 'Switch to Real Mode'}
          >
            💰
          </button>
        </div>
      </div>

      {/* BETTING CONTROLS */}
      <div className="card max-w-2xl mx-auto">
        {/* Bet Amount */}
        <div className="mb-4">
          <label className="block text-sm text-gray-400 mb-2">
            Bet {isPracticeMode ? '(Practice)' : ''}
          </label>
          <input
            type="number"
            min="0.1"
            max="100"
            step="0.1"
            value={betAmount}
            onChange={(e) => setBetAmount(parseFloat(e.target.value) || 0)}
            className="w-full bg-casino-primary border border-casino-accent rounded px-4 py-3 text-lg"
            disabled={isRolling}
          />
        </div>

        {/* Target Number */}
        <div className="mb-4">
          <label className="block text-sm text-gray-400 mb-2">
            Target: {targetNumber}
          </label>
          <input
            type="range"
            min="1"
            max="99"
            value={targetNumber}
            onChange={(e) => setTargetNumber(parseInt(e.target.value))}
            className="w-full"
            disabled={isRolling}
          />
        </div>

        {/* Direction - Over/Under */}
        <div className="mb-4">
          <div className="flex gap-2">
            <button
              onClick={() => setDirection('Over')}
              disabled={isRolling}
              className={`flex-1 py-3 rounded font-bold transition ${
                direction === 'Over' ? 'bg-green-600' : 'bg-gray-700'
              }`}
            >
              OVER {targetNumber}
            </button>
            <button
              onClick={() => setDirection('Under')}
              disabled={isRolling}
              className={`flex-1 py-3 rounded font-bold transition ${
                direction === 'Under' ? 'bg-red-600' : 'bg-gray-700'
              }`}
            >
              UNDER {targetNumber}
            </button>
          </div>
        </div>

        {/* Collapsible Odds Display */}
        <div className="mb-6">
          <button
            onClick={() => setShowOdds(!showOdds)}
            className="text-xs text-gray-400 hover:text-gray-300 transition flex items-center gap-1"
            type="button"
          >
            <span>{showOdds ? '▼' : '▶'}</span>
            <span>Odds & Payout</span>
          </button>

          {showOdds && (
            <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
              <div className="bg-casino-primary rounded p-2 text-center">
                <div className="text-gray-500 mb-1">Win Chance</div>
                <div className="font-bold text-casino-highlight">
                  {(winChance || 0).toFixed(2)}%
                </div>
              </div>
              <div className="bg-casino-primary rounded p-2 text-center">
                <div className="text-gray-500 mb-1">Multiplier</div>
                <div className="font-bold text-green-400">
                  {(multiplier || 0).toFixed(2)}x
                </div>
              </div>
              <div className="bg-casino-primary rounded p-2 text-center">
                <div className="text-gray-500 mb-1">Win Amount</div>
                <div className="font-bold">
                  {((betAmount || 0) * (multiplier || 0)).toFixed(2)}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Roll Button */}
        <button
          onClick={rollDice}
          disabled={isRolling || !actor}
          className="w-full bg-casino-highlight hover:bg-casino-highlight/80 disabled:bg-gray-700 text-white font-bold py-4 rounded-lg text-xl"
        >
          {isRolling ? '🎲 Rolling...' : '🎲 ROLL'}
        </button>

        {gameError && (
          <div className="mt-4 text-red-400 text-sm text-center">
            {gameError}
          </div>
        )}
      </div>

      {/* Dice Animation - Always visible, shows rolling state */}
      <div className="card max-w-2xl mx-auto">
        <DiceAnimation
          targetNumber={animatingResult}
          isRolling={isRolling}
          onAnimationComplete={handleAnimationComplete}
        />

        {/* Show win/loss message below dice after animation */}
        {lastResult && !isRolling && (
          <div className={`text-center mt-6 ${
            lastResult.is_win ? 'text-green-400' : 'text-red-400'
          }`}>
            <div className="text-3xl font-bold mb-2">
              {lastResult.is_win ? '🎉 WIN!' : '😢 LOSE'}
            </div>
            {lastResult.is_win && (
              <div className="text-xl">
                +{(Number(lastResult.payout) / 100_000_000).toFixed(2)} ICP
              </div>
            )}
          </div>
        )}
      </div>

      {/* GAME HISTORY */}
      {gameHistory.length > 0 && (
        <div className="card max-w-2xl mx-auto">
          <h3 className="text-sm font-bold mb-3 text-gray-400">Recent Rolls</h3>

          <div className="space-y-1">
            {gameHistory.slice(0, MAX_HISTORY_DISPLAY).map((game) => (
              <div key={game.clientId} className="flex items-center justify-between text-sm py-2 border-b border-gray-800">
                <span className="font-mono">{game.rolled_number}</span>
                <span className={game.is_win ? 'text-green-400' : 'text-red-400'}>
                  {game.is_win ? '✓' : '✗'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Game Info - Minimal */}
      <div className="text-center text-xs text-gray-500 mt-6">
        Min: 1 ICP • Max Win: 100x • House Edge: 3%
      </div>
    </div>
  );
};
