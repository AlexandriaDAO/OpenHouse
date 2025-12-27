import React, { useState, useCallback } from 'react';
import useRouletteActor from '@/hooks/actors/useRouletteActor';
import useLedgerActor from '@/hooks/actors/useLedgerActor';
import { GameLayout } from '@/components/game-ui';
import { BettingRail } from '@/components/betting';
import {
  RouletteWheel,
  BettingBoard,
  PlacedBet
} from '@/components/game-specific/roulette';
import { useGameBalance } from '@/providers/GameBalanceProvider';
import { useBalance } from '@/providers/BalanceProvider';
import { useAuth } from '@/providers/AuthProvider';
import { DECIMALS_PER_CKUSDT, formatUSDT } from '@/types/balance';
import { useBalanceRefresh } from '@/hooks/games';
import type { BetType, Bet, SpinResult } from '@/declarations/roulette_backend/roulette_backend.did';

const ROULETTE_BACKEND_CANISTER_ID = 'wvrcw-3aaaa-aaaah-arm4a-cai';

// Animation timing constants
const TIMING = {
  MIN_SPIN_DURATION: 2000,    // Minimum time ball spins before landing
  LANDING_DURATION: 4000,     // Time for ball to decelerate to position
  RESULT_DISPLAY: 6000,       // Time to show results before reset
};

// Animation state machine
type AnimationState =
  | 'idle'           // Ready to spin
  | 'waiting'        // Ball spinning, awaiting backend
  | 'landing'        // Got result, ball decelerating
  | 'showing_result' // Ball stopped, highlights active
  | 'resetting';     // Clearing for next spin

export function RouletteGame() {
  const { actor } = useRouletteActor();
  const { actor: ledgerActor } = useLedgerActor();
  const { isAuthenticated } = useAuth();

  // Balance
  const { balance: walletBalance, refreshBalance: refreshWalletBalance } = useBalance();
  const gameBalanceContext = useGameBalance('roulette');
  const balance = gameBalanceContext.balance;

  const handleBalanceRefresh = useCallback(() => {
    refreshWalletBalance();
    gameBalanceContext.refresh();
  }, [refreshWalletBalance, gameBalanceContext]);

  // Game State
  const [bets, setBets] = useState<PlacedBet[]>([]);
  const [chipBetAmount, setChipBetAmount] = useState(0);
  const [winningNumber, setWinningNumber] = useState<number | null>(null);
  const [lastResult, setLastResult] = useState<SpinResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [maxBet] = useState(100);

  // Animation state machine
  const [animationState, setAnimationState] = useState<AnimationState>('idle');

  // Balance management - periodic refresh and focus handler
  useBalanceRefresh({
    actor,
    refresh: gameBalanceContext.refresh,
  });

  const totalBetAmount = bets.reduce((sum, bet) => sum + bet.amount, 0);

  // Calculate max potential payout (sum of all bet payouts if they hit)
  const getPayoutMultiplier = (betType: BetType): number => {
    if ('Straight' in betType) return 36;
    if ('Split' in betType) return 18;
    if ('Street' in betType) return 12;
    if ('Corner' in betType) return 9;
    if ('SixLine' in betType) return 6;
    if ('Column' in betType) return 3;
    if ('Dozen' in betType) return 3;
    if ('Red' in betType || 'Black' in betType) return 2;
    if ('Odd' in betType || 'Even' in betType) return 2;
    if ('High' in betType || 'Low' in betType) return 2;
    return 2;
  };

  const maxPayout = bets.reduce((sum, bet) => sum + (bet.amount * getPayoutMultiplier(bet.betType)), 0);

  const handlePlaceBet = useCallback((newBet: PlacedBet) => {
    if (animationState !== 'idle') return;

    setBets(prevBets => {
      const existingIndex = prevBets.findIndex(b => {
        const bNumbers = [...b.numbers].sort().join(',');
        const newNumbers = [...newBet.numbers].sort().join(',');
        return bNumbers === newNumbers;
      });

      if (existingIndex >= 0) {
        const updated = [...prevBets];
        updated[existingIndex] = {
          ...updated[existingIndex],
          amount: updated[existingIndex].amount + newBet.amount
        };
        return updated;
      } else {
        return [...prevBets, newBet];
      }
    });
  }, [animationState]);

  const handleRemoveBet = useCallback((betToRemove: PlacedBet) => {
    if (animationState !== 'idle') return;

    setBets(prevBets => {
      const existingIndex = prevBets.findIndex(b => {
        const bNumbers = [...b.numbers].sort().join(',');
        const removeNumbers = [...betToRemove.numbers].sort().join(',');
        return bNumbers === removeNumbers;
      });

      if (existingIndex >= 0) {
        const updated = [...prevBets];
        const currentAmount = updated[existingIndex].amount;
        const removeAmount = chipBetAmount > 0 ? chipBetAmount : betToRemove.amount;

        if (currentAmount <= removeAmount) {
          updated.splice(existingIndex, 1);
        } else {
          updated[existingIndex] = {
            ...updated[existingIndex],
            amount: currentAmount - removeAmount
          };
        }
        return updated;
      }
      return prevBets;
    });
  }, [chipBetAmount, animationState]);

  const handleClearBets = useCallback(() => {
    if (animationState === 'idle') {
      setBets([]);
    }
  }, [animationState]);

  // Called when ball landing animation completes
  const handleAnimationComplete = useCallback(() => {
    setAnimationState('showing_result');

    // Auto-reset after showing results
    setTimeout(() => {
      setAnimationState('resetting');
      setTimeout(() => {
        setBets([]);
        setWinningNumber(null);
        setLastResult(null);
        setAnimationState('idle');
        gameBalanceContext.refresh();
      }, 500);
    }, TIMING.RESULT_DISPLAY);
  }, [gameBalanceContext]);

  const handleSpin = async () => {
    if (!actor || !isAuthenticated || animationState !== 'idle' || bets.length === 0) return;

    const totalBet = BigInt(Math.floor(totalBetAmount * DECIMALS_PER_CKUSDT));
    if (totalBet > balance.game) {
      setError('Insufficient balance for this bet');
      return;
    }

    // Phase 1: Start spinning immediately!
    setAnimationState('waiting');
    setError(null);
    setLastResult(null);
    setWinningNumber(null);

    const spinStartTime = Date.now();

    try {
      // Convert PlacedBet[] to Bet[] for backend
      const backendBets: Bet[] = bets.map(bet => ({
        bet_type: bet.betType,
        amount: BigInt(Math.floor(bet.amount * DECIMALS_PER_CKUSDT))
      }));

      const result = await actor.spin(backendBets);

      if ('Ok' in result) {
        const spinResult = result.Ok;

        // Ensure minimum spin time has elapsed for visual effect
        const elapsedTime = Date.now() - spinStartTime;
        const remainingWaitTime = Math.max(0, TIMING.MIN_SPIN_DURATION - elapsedTime);

        setTimeout(() => {
          // Phase 2: Got result, transition to landing
          setWinningNumber(spinResult.winning_number);
          setLastResult(spinResult);
          setAnimationState('landing');
        }, remainingWaitTime);

      } else if ('Err' in result) {
        setError(result.Err);
        setAnimationState('idle');
      }
    } catch (err) {
      setError('Failed to spin: ' + String(err));
      setAnimationState('idle');
    }
  };

  // Derived states for components
  const isSpinning = animationState !== 'idle';
  const isWaitingForResult = animationState === 'waiting';
  const isLanding = animationState === 'landing';
  const showResults = animationState === 'showing_result';

  // Button text based on state
  const getButtonText = () => {
    switch (animationState) {
      case 'waiting':
        return 'SPINNING...';
      case 'landing':
        return 'LANDING...';
      case 'showing_result':
        return 'RESULT';
      case 'resetting':
        return 'CLEARING...';
      default:
        return `SPIN ($${totalBetAmount.toFixed(2)})`;
    }
  };

  return (
    <GameLayout hideFooter noScroll>
      <div className="flex-1 flex flex-col items-center w-full max-w-7xl mx-auto px-2 sm:px-4 overflow-y-auto py-4">

        {!isAuthenticated && (
          <div className="text-center text-gray-400 text-sm py-2 mb-4">
            Please log in to play
          </div>
        )}

        {/* Wheel + Controls Section */}
        <div className="flex flex-col lg:flex-row items-center justify-center gap-4 lg:gap-8 mb-4">
          {/* Wheel */}
          <div className="flex-shrink-0">
            <RouletteWheel
              winningNumber={winningNumber}
              isWaitingForResult={isWaitingForResult}
              isLanding={isLanding}
              onAnimationComplete={handleAnimationComplete}
            />
          </div>

          {/* Controls & Info Panel */}
          <div className="flex flex-col items-center gap-3">
            {/* Result display */}
            {lastResult && showResults && (
              <div className="text-center animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="text-2xl font-bold">
                  {Number(lastResult.net_result) > 0 ? (
                    <span className="text-green-400">WON ${formatUSDT(lastResult.total_payout)}</span>
                  ) : Number(lastResult.net_result) < 0 ? (
                    <span className="text-red-400">LOST ${formatUSDT(lastResult.total_bet)}</span>
                  ) : (
                    <span className="text-gray-400">PUSH</span>
                  )}
                </div>
              </div>
            )}

            {/* Stats Row - Signature info bar */}
            <div className="flex items-center justify-between bg-[#0a0a14] rounded-lg p-3 border border-gray-800/50 w-full max-w-xs">
              <div className="flex flex-col items-center flex-1">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">Bets</span>
                <span className="text-yellow-400 font-mono font-bold">{bets.length}</span>
              </div>
              <div className="h-6 w-px bg-gray-800"></div>
              <div className="flex flex-col items-center flex-1">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">Total Bet</span>
                <span className="text-white font-mono font-bold">${totalBetAmount.toFixed(2)}</span>
              </div>
              <div className="h-6 w-px bg-gray-800"></div>
              <div className="flex flex-col items-center flex-1">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">Max Payout</span>
                <span className="text-dfinity-turquoise font-mono font-bold">${maxPayout.toFixed(2)}</span>
              </div>
              <div className="h-6 w-px bg-gray-800"></div>
              <div className="flex flex-col items-center flex-1">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">House Edge</span>
                <span className="text-red-400 font-mono font-bold">2.7%</span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex gap-3">
              <button
                onClick={handleClearBets}
                disabled={isSpinning || bets.length === 0}
                className="px-5 py-2.5 bg-gray-700 hover:bg-gray-600 rounded-lg font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                CLEAR BETS
              </button>
              <button
                onClick={handleSpin}
                disabled={isSpinning || !isAuthenticated || bets.length === 0}
                className={`px-8 py-2.5 rounded-lg font-bold text-lg shadow-lg transform transition disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 ${
                  isWaitingForResult || isLanding
                    ? 'bg-yellow-600 animate-pulse'
                    : showResults
                    ? 'bg-blue-600'
                    : 'bg-green-600 hover:bg-green-500 active:scale-95'
                }`}
              >
                {getButtonText()}
              </button>
            </div>

            {/* Error display */}
            {error && (
              <div className="text-red-400 bg-red-900/20 border border-red-900/50 p-3 rounded-lg text-sm max-w-xs">
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Betting board - clicking places chipBetAmount on that position */}
        <div className="mb-4">
          <BettingBoard
            bets={bets}
            chipValue={chipBetAmount}
            onPlaceBet={handlePlaceBet}
            onRemoveBet={handleRemoveBet}
            disabled={isSpinning || chipBetAmount === 0}
            winningNumber={winningNumber}
            showResults={showResults}
          />
        </div>
      </div>

      {/* Betting Rail - works like other games: chips accumulate, then place on board */}
      <div className="flex-shrink-0">
        <BettingRail
          betAmount={chipBetAmount}
          onBetChange={setChipBetAmount}
          maxBet={maxBet}
          gameBalance={balance.game}
          walletBalance={walletBalance}
          houseBalance={balance.house}
          ledgerActor={ledgerActor}
          gameActor={actor}
          onBalanceRefresh={handleBalanceRefresh}
          disabled={isSpinning}
          multiplier={35} // Max straight-up payout
          canisterId={ROULETTE_BACKEND_CANISTER_ID}
          isBalanceLoading={gameBalanceContext.isLoading}
          isBalanceInitialized={gameBalanceContext.isInitialized}
        />
      </div>
    </GameLayout>
  );
}
