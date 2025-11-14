import React, { useEffect, useState, useCallback } from 'react';
import useDiceActor from '../hooks/actors/useDiceActor';
import {
  GameLayout,
  GameModeToggle,
  GameHistory,
} from '../components/game-ui';
import { DiceAnimation, DiceAccountingPanel, type DiceDirection } from '../components/game-specific/dice';
import { useGameMode, useGameState } from '../hooks/games';
import { useGameBalance } from '../providers/GameBalanceProvider';
import { ConnectionStatus } from '../components/ui/ConnectionStatus';
import type { Principal } from '@dfinity/principal';

interface DiceGameResult {
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
  clientId?: string;
}

export const Dice: React.FC = () => {
  const { actor } = useDiceActor();
  const gameMode = useGameMode();
  const gameState = useGameState<DiceGameResult>();
  // Use global balance state
  const gameBalanceContext = useGameBalance('dice');
  const balance = gameBalanceContext.balance;
  const refreshBalance = gameBalanceContext.refresh;
  const optimisticUpdate = gameBalanceContext.optimisticUpdate;
  // Note: Disabled useGameHistory to prevent infinite loop - using gameState.history instead
  // const { history } = useGameHistory<DiceGameResult>(actor, 'get_recent_games', 10);

  // Dice-specific state
  const [targetNumber, setTargetNumber] = useState(50);
  const [direction, setDirection] = useState<DiceDirection>('Over');
  const [winChance, setWinChance] = useState(0);
  const [multiplier, setMultiplier] = useState(0);
  const [animatingResult, setAnimatingResult] = useState<number | null>(null);

  // Calculate odds when target or direction changes
  useEffect(() => {
    const updateOdds = async () => {
      if (!actor) return;

      try {
        const directionVariant = direction === 'Over' ? { Over: null } : { Under: null };
        const result = await actor.calculate_payout_info(targetNumber, directionVariant);

        if ('Ok' in result) {
          const [chance, mult] = result.Ok;
          setWinChance(chance * 100);
          setMultiplier(mult);
        } else if ('Err' in result) {
          gameState.setGameError(result.Err);
        }
      } catch (err) {
        console.error('Failed to calculate odds:', err);
      }
    };

    updateOdds();
  }, [targetNumber, direction, actor]);

  // Load initial game history on mount
  useEffect(() => {
    const loadHistory = async () => {
      if (!actor) return;

      try {
        const games = await actor.get_recent_games(10);
        // Add each game to history with a unique ID
        games.forEach((game: DiceGameResult) => {
          gameState.addToHistory({
            ...game,
            clientId: crypto.randomUUID()
          });
        });
      } catch (err) {
        console.error('Failed to load game history:', err);
      }
    };

    loadHistory();
  }, [actor]); // Only depend on actor, not gameState to avoid loops

  // Load initial balances on mount
  useEffect(() => {
    refreshBalance();
  }, [actor]); // eslint-disable-line react-hooks/exhaustive-deps

  // Refresh callback for accounting panel
  const handleBalanceChange = useCallback(async () => {
    await refreshBalance();
  }, [refreshBalance]);

  // Handle dice roll
  const rollDice = async () => {
    if (!actor || !gameState.validateBet()) return;

    gameState.setIsPlaying(true);
    gameState.clearErrors();
    setAnimatingResult(null);

    try {
      const betAmountE8s = BigInt(Math.floor(gameState.betAmount * 100_000_000));
      const directionVariant = direction === 'Over' ? { Over: null } : { Under: null };

      // Generate client seed for provable fairness
      const randomBytes = new Uint8Array(16);
      crypto.getRandomValues(randomBytes);
      const clientSeed = Array.from(randomBytes, byte => byte.toString(16).padStart(2, '0')).join('');

      const result = await actor.play_dice(betAmountE8s, targetNumber, directionVariant, clientSeed);

      if ('Ok' in result) {
        setAnimatingResult(result.Ok.rolled_number);
        gameState.addToHistory(result.Ok);

        // Apply optimistic update immediately
        if (result.Ok.is_win) {
          // Win: add payout to game balance
          optimisticUpdate({
            field: 'game',
            amount: result.Ok.payout,
            operation: 'add'
          });
        } else {
          // Loss: subtract bet from game balance
          optimisticUpdate({
            field: 'game',
            amount: result.Ok.bet_amount,
            operation: 'subtract'
          });
        }

        // Note: Background verification is handled automatically by GameBalanceProvider
      } else {
        gameState.setGameError(result.Err);
        gameState.setIsPlaying(false);
      }
    } catch (err) {
      console.error('Failed to roll dice:', err);
      gameState.setGameError(err instanceof Error ? err.message : 'Failed to roll dice');
      gameState.setIsPlaying(false);
    }
  };

  const handleAnimationComplete = useCallback(() => {
    gameState.setIsPlaying(false);
  }, []);

  // Custom renderer for history items
  const renderHistoryItem = (item: DiceGameResult) => (
    <>
      <span className="font-mono">{item.rolled_number}</span>
      <span className={item.is_win ? 'text-green-400' : 'text-red-400'}>
        {item.is_win ? '✓' : '✗'}
      </span>
    </>
  );

  return (
    <GameLayout
      title="Dice"
      icon="🎲"
      description="Roll the dice and predict over or under!"
      minBet={1}
      maxWin={100}
      houseEdge={3}
    >
      <GameModeToggle {...gameMode} />

      {/* CONNECTION STATUS */}
      <ConnectionStatus game="dice" />

      {/* ACCOUNTING PANEL */}
      <DiceAccountingPanel
        gameBalance={balance.game}
        onBalanceChange={handleBalanceChange}
      />

      {/* UNIFIED COMPACT BETTING PANEL */}
      <div className="card max-w-4xl mx-auto p-4">
        <div className="grid grid-cols-2 gap-4">

          {/* LEFT COLUMN: All Controls */}
          <div className="space-y-3">

            {/* BET AMOUNT SLIDER */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs text-gray-400">Bet Amount</label>
                <span className="font-mono text-sm">{gameState.betAmount.toFixed(2)} ICP</span>
              </div>
              <input
                type="range"
                min="0.01"
                max="1"
                step="0.01"
                value={gameState.betAmount}
                onChange={(e) => gameState.setBetAmount(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider-turquoise"
                disabled={gameState.isPlaying}
              />
            </div>

            {/* TARGET NUMBER SLIDER */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs text-gray-400">Target Number</label>
                <span className="font-mono text-sm">{targetNumber}</span>
              </div>
              <input
                type="range"
                min="1"
                max="99"
                value={targetNumber}
                onChange={(e) => setTargetNumber(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider-turquoise"
                disabled={gameState.isPlaying}
              />
            </div>

            {/* DIRECTION TOGGLE - Compact */}
            <div className="flex gap-1">
              <button
                onClick={() => setDirection('Over')}
                disabled={gameState.isPlaying}
                className={`flex-1 py-2 text-xs font-mono font-bold border transition rounded ${
                  direction === 'Over'
                    ? 'bg-green-600 border-green-600 text-white'
                    : 'bg-transparent border-gray-600 text-gray-400'
                }`}
              >
                OVER {targetNumber}
              </button>
              <button
                onClick={() => setDirection('Under')}
                disabled={gameState.isPlaying}
                className={`flex-1 py-2 text-xs font-mono font-bold border transition rounded ${
                  direction === 'Under'
                    ? 'bg-red-600 border-red-600 text-white'
                    : 'bg-transparent border-gray-600 text-gray-400'
                }`}
              >
                UNDER {targetNumber}
              </button>
            </div>

            {/* ROLL BUTTON */}
            <button
              onClick={rollDice}
              disabled={!actor || gameState.isPlaying}
              className="w-full py-3 bg-dfinity-turquoise hover:bg-dfinity-turquoise/80
                        text-black font-bold rounded transition disabled:opacity-50"
            >
              {gameState.isPlaying ? '🎲 Rolling...' : '🎲 ROLL DICE'}
            </button>
          </div>

          {/* RIGHT COLUMN: Live Stats & Animation */}
          <div className="space-y-3">

            {/* INLINE STATS - Always visible */}
            <div className="bg-gray-900/50 rounded p-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <div className="text-gray-500 text-xs">Win Chance</div>
                  <div className="font-mono text-yellow-400">{winChance.toFixed(2)}%</div>
                </div>
                <div>
                  <div className="text-gray-500 text-xs">Multiplier</div>
                  <div className="font-mono text-green-400">{multiplier.toFixed(2)}x</div>
                </div>
                <div>
                  <div className="text-gray-500 text-xs">Potential Win</div>
                  <div className="font-mono">{(gameState.betAmount * multiplier).toFixed(2)} ICP</div>
                </div>
                <div>
                  <div className="text-gray-500 text-xs">House Edge</div>
                  <div className="font-mono text-gray-400">3%</div>
                </div>
              </div>
            </div>

            {/* DICE ANIMATION - Smaller */}
            <div className="bg-gray-900/50 rounded p-3">
              <DiceAnimation
                targetNumber={animatingResult}
                isRolling={gameState.isPlaying}
                onAnimationComplete={handleAnimationComplete}
                size="small"
              />

              {/* Result message inline */}
              {gameState.lastResult && !gameState.isPlaying && (
                <div className={`text-center mt-2 ${
                  gameState.lastResult.is_win ? 'text-green-400' : 'text-red-400'
                }`}>
                  <span className="text-lg font-bold">
                    {gameState.lastResult.is_win ? '🎉 WIN' : '😢 LOSE'}
                    {gameState.lastResult.is_win && ` +${(Number(gameState.lastResult.payout) / 100_000_000).toFixed(2)} ICP`}
                  </span>
                </div>
              )}
            </div>

            {/* Error display */}
            {gameState.gameError && (
              <div className="text-red-400 text-xs">
                {gameState.gameError}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* COMPACT HISTORY - Below main panel */}
      <div className="mt-4 max-w-4xl mx-auto">
        <GameHistory<DiceGameResult>
          items={gameState.history}
          maxDisplay={3}
          title="Recent Rolls"
          renderCustom={renderHistoryItem}
          compact={true}
        />
      </div>
    </GameLayout>
  );
};