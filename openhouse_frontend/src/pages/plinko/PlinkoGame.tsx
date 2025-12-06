import React, { useEffect, useState, useCallback } from 'react';
import usePlinkoActor from '../../hooks/actors/usePlinkoActor';
import useLedgerActor from '../../hooks/actors/useLedgerActor';
import { GameLayout } from '../../components/game-ui';
import { BettingRail } from '../../components/betting';
import { PlinkoBoard, PlinkoBall, PLINKO_LAYOUT } from '../../components/game-specific/plinko';
import { useGameBalance } from '../../providers/GameBalanceProvider';
import { useBalance } from '../../providers/BalanceProvider';
import { useAuth } from '../../providers/AuthProvider';
import { DECIMALS_PER_CKUSDT } from '../../types/balance';

const ROWS = 8;
const PLINKO_BACKEND_CANISTER_ID = 'weupr-2qaaa-aaaap-abl3q-cai';

interface AnimatingBall {
  id: number;
  path: boolean[];
}

export const Plinko: React.FC = () => {
  const { actor } = usePlinkoActor();
  const { actor: ledgerActor } = useLedgerActor();
  const { isAuthenticated } = useAuth();
  
  // Balance State
  const { balance: walletBalance, refreshBalance: refreshWalletBalance } = useBalance();
  const gameBalanceContext = useGameBalance('plinko');
  const balance = gameBalanceContext.balance;

  const handleBalanceRefresh = useCallback(async () => {
    refreshWalletBalance();
    gameBalanceContext.refresh();
  }, [refreshWalletBalance, gameBalanceContext]);

  // Game state
  const [isPlaying, setIsPlaying] = useState(false);
  const [ballCount, setBallCount] = useState(1);
  const [betAmount, setBetAmount] = useState(0.01);
  const [maxBet, setMaxBet] = useState(100);
  const [multipliers, setMultipliers] = useState<number[]>([]);
  const [gameError, setGameError] = useState('');

  // Animation state
  const [animatingBalls, setAnimatingBalls] = useState<AnimatingBall[]>([]);
  const [nextBallId, setNextBallId] = useState(0);

  // Load multipliers on mount
  useEffect(() => {
    async function loadMultipliers() {
      if (!actor) return;
      try {
        const multsBp = await actor.get_multipliers_bp();
        const mults = Array.from(multsBp).map(bp => Number(bp) / 10000);
        setMultipliers(mults);
      } catch (err) {
        console.error("Failed to load multipliers", err);
      }
    }
    loadMultipliers();
  }, [actor]);

  // Max bet calculation
  useEffect(() => {
    const updateMaxBet = async () => {
      if (!actor) return;
      try {
        const result = await actor.get_max_bet_per_ball(ballCount);
        if ('Ok' in result) {
          const maxBetUSDT = (Number(result.Ok) / DECIMALS_PER_CKUSDT) * 0.95;
          const newMaxBet = Math.max(0.01, maxBetUSDT);
          setMaxBet(newMaxBet);
          if (betAmount > newMaxBet) {
            setBetAmount(newMaxBet);
          }
        }
      } catch (err) {
        console.error('Failed to get max bet:', err);
        setMaxBet(10);
      }
    };
    updateMaxBet();
  }, [actor, ballCount, betAmount]);

  // Drop balls handler
  const dropBalls = async () => {
    if (!actor || isPlaying) return;

    if (!isAuthenticated) {
      setGameError('Please log in to play.');
      return;
    }
    
    if (balance.game === 0n) {
      setGameError('No chips! Buy chips below.');
      return;
    }

    setIsPlaying(true);
    setGameError('');

    try {
      const betAmountE8s = BigInt(Math.floor(betAmount * DECIMALS_PER_CKUSDT));
      
      // Call backend based on ball count
      let results: { path: boolean[] }[] = [];
      
      if (ballCount === 1) {
        const result = await actor.play_plinko(betAmountE8s);
        if ('Ok' in result) {
          results = [{ path: result.Ok.path }];
        } else {
          throw new Error(result.Err);
        }
      } else {
        const result = await actor.play_multi_plinko(ballCount, betAmountE8s);
        if ('Ok' in result) {
          results = result.Ok.results.map(r => ({ path: r.path }));
        } else {
          throw new Error(result.Err);
        }
      }

      // Create animating balls from backend paths
      const newBalls: AnimatingBall[] = results.map((r, i) => ({
        id: nextBallId + i,
        path: r.path,
      }));

      setAnimatingBalls(prev => [...prev, ...newBalls]);
      setNextBallId(prev => prev + ballCount);

      // We don't wait for animations to finish to set isPlaying false,
      // because we want to allow rapid fire if needed? 
      // The plan said "setIsPlaying(false)" in "handleBallComplete" when NO balls are left.
      // But typically we want to block "Play" until backend returns.
      // Once backend returns, we start animation. The user can technically play again if we allow it.
      // But to be safe/simple, let's keep isPlaying true until ALL balls finish, 
      // OR allow concurrent plays if we handle IDs correctly.
      // Plan implementation suggests:
      /*
        setAnimatingBalls(newBalls);
        // ...
        handleBallComplete -> if (prev.length === 0) setIsPlaying(false);
      */
      // This implies we block until animation ends.
      // However, if we append balls (`setAnimatingBalls(prev => [...prev, ...newBalls])`), 
      // we can support concurrent drops!
      // But the state logic `setIsPlaying` might disable controls.
      // If we want to allow spamming "Drop", we shouldn't disable controls based on `animatingBalls.length`.
      // But `dropBalls` checks `if (isPlaying) return;`.
      // So effectively it IS blocking.
      
      // Refresh balance after expected duration
      const durationMs = (results[0].path.length * PLINKO_LAYOUT.MS_PER_ROW) + (results.length * PLINKO_LAYOUT.BALL_STAGGER_MS);
      setTimeout(() => {
        gameBalanceContext.refresh();
      }, durationMs + 500);

    } catch (err) {
      setGameError(err instanceof Error ? err.message : 'Failed to play');
      setIsPlaying(false);
    }
  };

  // Handle ball animation complete
  const handleBallComplete = useCallback((ballId: number, finalSlot: number) => {
    setAnimatingBalls(prev => {
      const remaining = prev.filter(b => b.id !== ballId);
      if (remaining.length === 0) {
        setIsPlaying(false);
      }
      return remaining;
    });
  }, []);

  return (
    <GameLayout
      hideFooter
      noScroll
    >
      <div className="flex-1 flex flex-col items-center justify-center px-2 pb-40 overflow-hidden w-full">
        {/* Game Board Area */}
        <div className="card max-w-4xl mx-auto relative p-0 overflow-hidden bg-transparent border-none shadow-none">
          
          {/* Click to drop area */}
          <div 
            className={`cursor-pointer transition-transform duration-100 ${isPlaying ? 'cursor-default' : 'active:scale-95'}`}
            onClick={dropBalls}
            style={{ width: '400px', maxWidth: '100%' }}
          >
            <div style={{ aspectRatio: '400/440' }}>
              <svg viewBox={`0 0 ${PLINKO_LAYOUT.BOARD_WIDTH} ${PLINKO_LAYOUT.BOARD_HEIGHT}`} className="w-full h-full overflow-visible">
                {/* Static board */}
                <PlinkoBoard rows={ROWS} multipliers={multipliers} />

                {/* Animated balls */}
                {animatingBalls.map((ball, index) => (
                  <PlinkoBall
                    key={ball.id}
                    id={ball.id}
                    path={ball.path}
                    onComplete={handleBallComplete}
                    staggerDelay={index * (PLINKO_LAYOUT.BALL_STAGGER_MS / 1000)}
                  />
                ))}
              </svg>
            </div>

            {/* Tap to Play Hint */}
            {!isPlaying && isAuthenticated && balance.game > 0n && (
              <div className="absolute top-1/4 left-1/2 transform -translate-x-1/2 text-[10px] text-gray-500 font-mono tracking-widest opacity-60 pointer-events-none">
                TAP TO DROP
              </div>
            )}
          </div>
        </div>

        {/* Ball count selector - Below board */}
        <div className="w-full max-w-md mx-auto mt-4 px-4">
          <div className="flex items-center justify-between bg-[#0a0a14] p-3 rounded-lg border border-gray-800/50">
            <span className="text-xs text-gray-500 uppercase">Balls</span>
            <div className="flex items-center flex-1 mx-4">
              <input
                type="range"
                min={1}
                max={10}
                value={ballCount}
                onChange={(e) => setBallCount(Number(e.target.value))}
                disabled={isPlaying}
                className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>
            <span className="text-lg text-white font-mono font-bold w-6 text-center">{ballCount}</span>
          </div>
        </div>

        {gameError && (
          <div className="text-red-400 text-center mt-2 bg-red-900/10 p-2 rounded">{gameError}</div>
        )}
      </div>

      {/* Betting Controls */}
      <div className="flex-shrink-0">
        <BettingRail
          betAmount={betAmount}
          onBetChange={setBetAmount}
          maxBet={maxBet}
          gameBalance={balance.game}
          walletBalance={walletBalance}
          houseBalance={balance.house}
          ledgerActor={ledgerActor}
          gameActor={actor}
          onBalanceRefresh={handleBalanceRefresh}
          disabled={isPlaying}
          multiplier={multipliers[Math.floor(multipliers.length / 2)] || 0.2}
          canisterId={PLINKO_BACKEND_CANISTER_ID}
          isBalanceLoading={gameBalanceContext.isLoading}
          isBalanceInitialized={gameBalanceContext.isInitialized}
        />
      </div>
    </GameLayout>
  );
};