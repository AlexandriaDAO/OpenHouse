import React, { useEffect, useState, useCallback } from 'react';
import useRouletteActor from '@/hooks/actors/useRouletteActor';
import useLedgerActor from '@/hooks/actors/useLedgerActor';
import { GameLayout } from '@/components/game-ui';
import { BettingRail } from '@/components/betting';
import {
  RouletteWheel,
  BettingBoard,
  ChipSelector,
  PreviousNumbers,
  PlacedBet
} from '@/components/game-specific/roulette';
import { useGameBalance } from '@/providers/GameBalanceProvider';
import { useBalance } from '@/providers/BalanceProvider';
import { useAuth } from '@/providers/AuthProvider';
import { DECIMALS_PER_CKUSDT, formatUSDT } from '@/types/balance';
import type { BetType, Bet, SpinResult } from '@/declarations/roulette_backend/roulette_backend.did';

const ROULETTE_BACKEND_CANISTER_ID = 'wvrcw-3aaaa-aaaah-arm4a-cai';

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
  const [chipValue, setChipValue] = useState(1);
  const [isSpinning, setIsSpinning] = useState(false);
  const [winningNumber, setWinningNumber] = useState<number | null>(null);
  const [lastResult, setLastResult] = useState<SpinResult | null>(null);
  const [previousNumbers, setPreviousNumbers] = useState<{ number: number; color: any }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [maxBet] = useState(100); // Could be dynamic based on house balance

  // Update balances periodically
  useEffect(() => {
    if (actor) {
      const interval = setInterval(() => gameBalanceContext.refresh().catch(console.error), 30000);
      return () => clearInterval(interval);
    }
  }, [actor]);

  const totalBetAmount = bets.reduce((sum, bet) => sum + bet.amount, 0);

  const handlePlaceBet = useCallback((newBet: PlacedBet) => {
    if (isSpinning) return;

    setBets(prevBets => {
      // Check if bet already exists for these numbers
      const existingIndex = prevBets.findIndex(b => {
        const bNumbers = b.numbers.sort().join(',');
        const newNumbers = newBet.numbers.sort().join(',');
        return bNumbers === newNumbers;
      });

      if (existingIndex >= 0) {
        // Add to existing bet
        const updated = [...prevBets];
        updated[existingIndex] = {
          ...updated[existingIndex],
          amount: updated[existingIndex].amount + newBet.amount
        };
        return updated;
      } else {
        // New bet
        return [...prevBets, newBet];
      }
    });
  }, [isSpinning]);

  const handleRemoveBet = useCallback((betToRemove: PlacedBet) => {
    if (isSpinning) return;

    setBets(prevBets => {
      const existingIndex = prevBets.findIndex(b => {
        const bNumbers = b.numbers.sort().join(',');
        const removeNumbers = betToRemove.numbers.sort().join(',');
        return bNumbers === removeNumbers;
      });

      if (existingIndex >= 0) {
        const updated = [...prevBets];
        const currentAmount = updated[existingIndex].amount;

        if (currentAmount <= chipValue) {
          // Remove bet entirely
          updated.splice(existingIndex, 1);
        } else {
          // Reduce bet amount
          updated[existingIndex] = {
            ...updated[existingIndex],
            amount: currentAmount - chipValue
          };
        }
        return updated;
      }
      return prevBets;
    });
  }, [chipValue, isSpinning]);

  const handleClearBets = useCallback(() => {
    if (!isSpinning) {
      setBets([]);
    }
  }, [isSpinning]);

  const handleSpin = async () => {
    if (!actor || !isAuthenticated || isSpinning || bets.length === 0) return;

    const totalBet = BigInt(Math.floor(totalBetAmount * DECIMALS_PER_CKUSDT));
    if (totalBet > balance.game) {
      setError('Insufficient balance for this bet');
      return;
    }

    setIsSpinning(true);
    setError(null);
    setLastResult(null);

    try {
      // Convert PlacedBet[] to Bet[] for backend
      const backendBets: Bet[] = bets.map(bet => ({
        bet_type: bet.betType,
        amount: BigInt(Math.floor(bet.amount * DECIMALS_PER_CKUSDT))
      }));

      const result = await actor.spin(backendBets);

      if ('Ok' in result) {
        const spinResult = result.Ok;
        setWinningNumber(spinResult.winning_number);
        setLastResult(spinResult);

        // Add to previous numbers
        setPreviousNumbers(prev => [
          ...prev,
          { number: spinResult.winning_number, color: spinResult.color }
        ]);

        // Clear bets after spin completes (10 seconds)
        setTimeout(() => {
          setBets([]);
          setIsSpinning(false);
          gameBalanceContext.refresh();
        }, 10000);

      } else if ('Err' in result) {
        setError(result.Err);
        setIsSpinning(false);
      }
    } catch (err) {
      setError('Failed to spin: ' + String(err));
      setIsSpinning(false);
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

        {/* Wheel */}
        <div className="mb-6">
          <RouletteWheel winningNumber={winningNumber} isSpinning={isSpinning} />
        </div>

        {/* Result display */}
        {lastResult && !isSpinning && (
          <div className="mb-4 text-center animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="text-2xl font-bold mb-2">
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

        {/* Previous numbers */}
        <div className="w-full max-w-3xl mb-4">
          <PreviousNumbers numbers={previousNumbers} />
        </div>

        {/* Chip selector */}
        <div className="mb-4">
          <ChipSelector
            selectedValue={chipValue}
            onSelect={setChipValue}
            disabled={isSpinning}
          />
        </div>

        {/* Betting board */}
        <div className="mb-4">
          <BettingBoard
            bets={bets}
            chipValue={chipValue}
            onPlaceBet={handlePlaceBet}
            onRemoveBet={handleRemoveBet}
            disabled={isSpinning}
          />
        </div>

        {/* Controls */}
        <div className="flex gap-4 mb-4">
          <button
            onClick={handleClearBets}
            disabled={isSpinning || bets.length === 0}
            className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            CLEAR BETS
          </button>
          <button
            onClick={handleSpin}
            disabled={isSpinning || !isAuthenticated || bets.length === 0}
            className="px-12 py-3 bg-green-600 hover:bg-green-500 rounded-lg font-bold text-xl shadow-lg transform active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
          >
            {isSpinning ? 'SPINNING...' : `SPIN ($${totalBetAmount.toFixed(2)})`}
          </button>
        </div>

        {/* Current bet summary */}
        {bets.length > 0 && (
          <div className="bg-black/30 rounded-lg p-3 mb-4 max-w-md w-full">
            <div className="text-xs text-gray-400 mb-2">ACTIVE BETS:</div>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {bets.map((bet, idx) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span className="text-gray-300">{bet.displayText}</span>
                  <span className="text-white font-bold">${bet.amount.toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-gray-700 mt-2 pt-2 flex justify-between font-bold">
              <span>TOTAL:</span>
              <span className="text-dfinity-turquoise">${totalBetAmount.toFixed(2)}</span>
            </div>
          </div>
        )}

        {/* Error display */}
        {error && (
          <div className="text-red-400 bg-red-900/20 border border-red-900/50 p-4 rounded-lg mb-4 max-w-md">
            {error}
          </div>
        )}
      </div>

      {/* Betting Rail */}
      <div className="flex-shrink-0">
        <BettingRail
          betAmount={totalBetAmount}
          onBetChange={() => {}} // Bets managed via chip placement
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
