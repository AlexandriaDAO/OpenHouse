import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useRouletteActor from '@/hooks/actors/useRouletteActor';
import useLedgerActor from '@/hooks/actors/useLedgerActor';
import { GameLayout } from '@/components/game-ui';
import { BettingRail } from '@/components/betting';
import {
  RouletteWheel,
  BettingBoard,
  PlacedBet
} from '@/components/game-specific/roulette';
import { BettingCell, ZeroCell, OutsideBetCell } from '@/components/game-specific/roulette/BettingCell';
import { useGameBalance } from '@/providers/GameBalanceProvider';
import { useBalance } from '@/providers/BalanceProvider';
import { useAuth } from '@/providers/AuthProvider';
import { DECIMALS_PER_CKUSDT, formatUSDT } from '@/types/balance';
import { useBalanceRefresh } from '@/hooks/games';
import type { BetType, Bet, SpinResult } from '@/declarations/roulette_backend/roulette_backend.did';

const ROULETTE_BACKEND_CANISTER_ID = 'wvrcw-3aaaa-aaaah-arm4a-cai';

const TIMING = {
  MIN_SPIN_DURATION: 2000,
  LANDING_DURATION: 4000,
  RESULT_DISPLAY: 6000,
};

type AnimationState = 'idle' | 'waiting' | 'landing' | 'showing_result' | 'resetting';

const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

// Round to 2 decimal places to avoid floating point precision issues
const roundCents = (amount: number): number => Math.round(amount * 100) / 100;

// Recent Results History Strip Component
interface RecentResultsProps {
  results: number[];
  maxDisplay?: number;
}

function RecentResults({ results, maxDisplay = 12 }: RecentResultsProps) {
  if (results.length === 0) return null;

  const getNumberColor = (num: number) => {
    if (num === 0) return 'bg-green-600';
    return RED_NUMBERS.has(num) ? 'bg-red-600' : 'bg-zinc-800';
  };

  const getBorderColor = (num: number, isFirst: boolean) => {
    if (num === 0) return isFirst ? 'border-green-400' : 'border-green-500/60';
    if (RED_NUMBERS.has(num)) return isFirst ? 'border-red-400' : 'border-red-500/60';
    return isFirst ? 'border-zinc-400' : 'border-zinc-500/60';
  };

  const getGlowColor = (num: number) => {
    if (num === 0) return '#22c55e';
    return RED_NUMBERS.has(num) ? '#ef4444' : '#71717a';
  };

  const displayResults = results.slice(0, maxDisplay);

  return (
    <div className="flex items-center justify-center gap-1.5 px-3 py-2 bg-zinc-900/70 rounded-xl backdrop-blur-sm border border-zinc-700/40 shadow-lg">
      <span className="text-zinc-400 text-[10px] sm:text-xs font-semibold tracking-wider mr-1.5 hidden sm:inline uppercase">History</span>
      <div className="flex items-center gap-1.5 overflow-hidden">
        {displayResults.map((num, index) => (
          <motion.div
            key={`${num}-${index}-${results.length}`}
            initial={index === 0 ? { scale: 0, opacity: 0, x: -10 } : false}
            animate={{ scale: 1, opacity: 1, x: 0 }}
            transition={{
              type: 'spring',
              stiffness: 500,
              damping: 25,
              delay: index === 0 ? 0 : 0,
            }}
            className={`
              w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center
              ${getNumberColor(num)} border-2 ${getBorderColor(num, index === 0)}
              text-white text-[11px] sm:text-sm font-bold
              ${index === 0 ? 'ring-2 ring-white/30 scale-110' : ''}
              transition-all duration-200
            `}
            style={{
              opacity: Math.max(0.5, 1 - (index * 0.05)),
              boxShadow: index === 0
                ? `0 0 14px ${getGlowColor(num)}, 0 0 6px ${getGlowColor(num)}, inset 0 1px 2px rgba(255,255,255,0.2)`
                : 'inset 0 1px 2px rgba(255,255,255,0.1)',
              textShadow: '0 1px 2px rgba(0,0,0,0.5)',
            }}
          >
            {num}
          </motion.div>
        ))}
      </div>
      {results.length > maxDisplay && (
        <span className="text-zinc-400 text-[10px] sm:text-xs ml-1.5 font-medium">+{results.length - maxDisplay}</span>
      )}
    </div>
  );
}

// "NO MORE BETS" Overlay Component
interface NoMoreBetsOverlayProps {
  show: boolean;
}

function NoMoreBetsOverlay({ show }: NoMoreBetsOverlayProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <motion.div
            className="bg-black/70 backdrop-blur-sm px-6 py-3 rounded-lg border border-yellow-500/50"
            initial={{ scale: 0.8, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.8, y: -20, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          >
            <motion.span
              className="text-yellow-400 font-black text-lg sm:text-xl tracking-widest"
              animate={{
                textShadow: [
                  '0 0 10px rgba(250, 204, 21, 0.5)',
                  '0 0 20px rgba(250, 204, 21, 0.8)',
                  '0 0 10px rgba(250, 204, 21, 0.5)',
                ],
              }}
              transition={{ duration: 1, repeat: Infinity }}
            >
              NO MORE BETS
            </motion.span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Anticipation pulse overlay during landing phase
interface AnticipationOverlayProps {
  show: boolean;
}

function AnticipationOverlay({ show }: AnticipationOverlayProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="absolute inset-0 z-10 pointer-events-none rounded-lg"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
        >
          <motion.div
            className="absolute inset-0 border-2 border-yellow-500/30 rounded-lg"
            animate={{
              boxShadow: [
                'inset 0 0 20px rgba(250, 204, 21, 0.1)',
                'inset 0 0 40px rgba(250, 204, 21, 0.2)',
                'inset 0 0 20px rgba(250, 204, 21, 0.1)',
              ],
            }}
            transition={{ duration: 0.8, repeat: Infinity }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function RouletteGame() {
  const { actor } = useRouletteActor();
  const { actor: ledgerActor } = useLedgerActor();
  const { isAuthenticated } = useAuth();

  const { balance: walletBalance, refreshBalance: refreshWalletBalance } = useBalance();
  const gameBalanceContext = useGameBalance('roulette');
  const balance = gameBalanceContext.balance;

  // State declarations - must come before callbacks that reference them
  const [bets, setBets] = useState<PlacedBet[]>([]);
  const [chipBetAmount, setChipBetAmount] = useState(0.01);
  const [winningNumber, setWinningNumber] = useState<number | null>(null);
  const [lastResult, setLastResult] = useState<SpinResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [maxBet] = useState(100);
  const [animationState, setAnimationState] = useState<AnimationState>('idle');
  const [recentResults, setRecentResults] = useState<number[]>([]);
  const [boardTab, setBoardTab] = useState<'low' | 'high'>('low');

  const handleBalanceRefresh = useCallback(() => {
    refreshWalletBalance();
    gameBalanceContext.refresh();
  }, [refreshWalletBalance, gameBalanceContext]);

  useBalanceRefresh({ actor, refresh: gameBalanceContext.refresh });

  const totalBetAmount = bets.reduce((sum, bet) => sum + bet.amount, 0);

  const getPayoutMultiplier = (betType: BetType): number => {
    if ('Straight' in betType) return 36;
    if ('Split' in betType) return 18;
    if ('Street' in betType) return 12;
    if ('Corner' in betType) return 9;
    if ('SixLine' in betType) return 6;
    if ('Column' in betType) return 3;
    if ('Dozen' in betType) return 3;
    return 2;
  };

  const maxPayout = bets.reduce((sum, bet) => sum + (bet.amount * getPayoutMultiplier(bet.betType)), 0);

  // House limit is 15% of pool, we use 10% for safety margin
  const houseBalanceUSD = Number(balance.house) / DECIMALS_PER_CKUSDT;
  const maxAllowedPayout = houseBalanceUSD * 0.10;
  const exceedsHouseLimit = maxPayout > maxAllowedPayout && maxAllowedPayout > 0;

  const handlePlaceBet = useCallback((newBet: PlacedBet) => {
    if (animationState !== 'idle') return;
    setBets(prevBets => {
      const existingIndex = prevBets.findIndex(b =>
        [...b.numbers].sort().join(',') === [...newBet.numbers].sort().join(',')
      );
      if (existingIndex >= 0) {
        const updated = [...prevBets];
        updated[existingIndex] = { ...updated[existingIndex], amount: roundCents(updated[existingIndex].amount + newBet.amount) };
        return updated;
      }
      return [...prevBets, newBet];
    });
  }, [animationState]);

  const handleRemoveBet = useCallback((betToRemove: PlacedBet) => {
    if (animationState !== 'idle') return;
    setBets(prevBets => {
      const existingIndex = prevBets.findIndex(b =>
        [...b.numbers].sort().join(',') === [...betToRemove.numbers].sort().join(',')
      );
      if (existingIndex >= 0) {
        const updated = [...prevBets];
        const currentAmount = updated[existingIndex].amount;
        const removeAmount = chipBetAmount > 0 ? chipBetAmount : betToRemove.amount;
        if (currentAmount <= removeAmount) {
          updated.splice(existingIndex, 1);
        } else {
          updated[existingIndex] = { ...updated[existingIndex], amount: roundCents(currentAmount - removeAmount) };
        }
        return updated;
      }
      return prevBets;
    });
  }, [chipBetAmount, animationState]);

  const handleClearBets = useCallback(() => {
    if (animationState === 'idle') setBets([]);
  }, [animationState]);

  const handleAnimationComplete = useCallback(() => {
    setAnimationState('showing_result');
    // Add to recent results - use functional update with duplicate check
    if (winningNumber !== null) {
      setRecentResults(prev => {
        // Prevent duplicate if the last entry is the same number
        // This can happen if the callback fires twice
        if (prev[0] === winningNumber) {
          return prev; // Already added, skip
        }
        return [winningNumber, ...prev].slice(0, 15);
      });
    }
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
  }, [gameBalanceContext, winningNumber]);

  const handleSpin = async () => {
    if (!actor || !isAuthenticated || animationState !== 'idle' || bets.length === 0) return;
    const totalBet = BigInt(Math.floor(totalBetAmount * DECIMALS_PER_CKUSDT));
    if (totalBet > balance.game) {
      setError('Insufficient balance');
      return;
    }

    setAnimationState('waiting');
    setError(null);
    setLastResult(null);
    setWinningNumber(null);
    const spinStartTime = Date.now();

    try {
      const backendBets: Bet[] = bets.map(bet => ({
        bet_type: bet.betType,
        amount: BigInt(Math.floor(bet.amount * DECIMALS_PER_CKUSDT))
      }));
      const result = await actor.spin(backendBets);

      if ('Ok' in result) {
        const elapsedTime = Date.now() - spinStartTime;
        const remainingWaitTime = Math.max(0, TIMING.MIN_SPIN_DURATION - elapsedTime);
        setTimeout(() => {
          setWinningNumber(result.Ok.winning_number);
          setLastResult(result.Ok);
          setAnimationState('landing');
        }, remainingWaitTime);
      } else if ('Err' in result) {
        setError(result.Err);
        setAnimationState('idle');
      }
    } catch (err) {
      setError('Spin failed: ' + String(err));
      setAnimationState('idle');
    }
  };

  const isSpinning = animationState !== 'idle';
  const isWaitingForResult = animationState === 'waiting';
  const isLanding = animationState === 'landing';
  const showResults = animationState === 'showing_result';

  const getButtonText = () => {
    switch (animationState) {
      case 'waiting': return 'SPINNING...';
      case 'landing': return 'LANDING...';
      case 'showing_result': return 'RESULT';
      case 'resetting': return 'CLEARING...';
      default:
        if (exceedsHouseLimit) return 'PAYOUT TOO HIGH';
        return bets.length > 0 ? `SPIN $${totalBetAmount.toFixed(2)}` : 'PLACE BETS';
    }
  };

  return (
    <GameLayout hideFooter noScroll>
      {/* ===== MOBILE LAYOUT ===== */}
      <div className="md:hidden flex flex-col h-full overflow-hidden">
        {/* Wheel section - COMPACT with flex-none */}
        <div className="flex-none flex flex-col items-center py-1">
          {/* Recent Results History */}
          <RecentResults results={recentResults} maxDisplay={8} />

          <RouletteWheel
            winningNumber={winningNumber}
            isWaitingForResult={isWaitingForResult}
            isLanding={isLanding}
            onAnimationComplete={handleAnimationComplete}
          />

          {/* Compact stats - single line */}
          <div className="text-center text-xs py-1">
            {lastResult && showResults ? (
              <motion.div
                className="flex items-center justify-center gap-2"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                {Number(lastResult.net_result) > 0 ? (
                  <span className="text-green-400 font-black">WIN +{formatUSDT(lastResult.total_payout)}</span>
                ) : (
                  <span className="text-red-400 font-black">LOSE -{formatUSDT(lastResult.total_bet)}</span>
                )}
              </motion.div>
            ) : (
              <div className="flex items-center justify-center gap-2">
                <span><span className="text-yellow-400 font-bold">{bets.length}</span> bets</span>
                <span className="text-white font-bold">${totalBetAmount.toFixed(2)}</span>
                {(isWaitingForResult || isLanding) && (
                  <span className="text-yellow-400 animate-pulse text-xs">
                    {isWaitingForResult ? 'Spinning...' : 'Landing...'}
                  </span>
                )}
              </div>
            )}
            {exceedsHouseLimit && (
              <span className="text-red-400 text-xs block">
                Max ${maxPayout.toFixed(2)} &gt; limit ${maxAllowedPayout.toFixed(2)}
              </span>
            )}
            {error && <span className="text-red-400 text-xs block">{error}</span>}
          </div>
        </div>

        {/* Visual separator - simplified */}
        <div className="h-px mx-2 bg-gradient-to-r from-transparent via-zinc-600/50 to-transparent" />

        {/* Betting table - takes remaining space, scrollable */}
        <motion.div
          className="flex-1 min-h-0 flex flex-col px-2 overflow-y-auto relative bg-zinc-900/30 rounded-xl mx-1 py-2 border border-zinc-800/50"
          animate={{
            opacity: isSpinning && !showResults ? 0.5 : 1,
            filter: isSpinning && !showResults ? 'grayscale(0.3)' : 'grayscale(0)',
          }}
          transition={{ duration: 0.4, ease: 'easeInOut' }}
        >
          {/* NO MORE BETS overlay */}
          <NoMoreBetsOverlay show={isWaitingForResult} />

          {/* Anticipation overlay during landing */}
          <AnticipationOverlay show={isLanding} />

          {/* Tab buttons */}
          <div className="flex gap-1.5 mb-1.5">
            <button
              onClick={() => setBoardTab('low')}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
                boardTab === 'low'
                  ? 'text-white shadow-lg border border-green-500/30'
                  : 'bg-zinc-800/80 text-zinc-400 hover:bg-zinc-700/80 border border-zinc-700/50'
              }`}
              style={boardTab === 'low' ? {
                background: 'linear-gradient(to bottom, #16a34a 0%, #15803d 50%, #166534 100%)',
                boxShadow: '0 4px 12px rgba(22, 163, 74, 0.3)'
              } : undefined}
            >
              0-18
            </button>
            <button
              onClick={() => setBoardTab('high')}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
                boardTab === 'high'
                  ? 'text-white shadow-lg border border-green-500/30'
                  : 'bg-zinc-800/80 text-zinc-400 hover:bg-zinc-700/80 border border-zinc-700/50'
              }`}
              style={boardTab === 'high' ? {
                background: 'linear-gradient(to bottom, #16a34a 0%, #15803d 50%, #166534 100%)',
                boxShadow: '0 4px 12px rgba(22, 163, 74, 0.3)'
              } : undefined}
            >
              19-36
            </button>
          </div>

          {/* Payout legend */}
          <div className="flex justify-center flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-zinc-500 mb-1.5 px-1">
            <span>Straight <span className="text-yellow-400 font-semibold">35:1</span></span>
            <span>Dozen/Col <span className="text-yellow-400 font-semibold">2:1</span></span>
            <span>Even Bets <span className="text-yellow-400 font-semibold">1:1</span></span>
          </div>

          {/* Number grid */}
          <div className="flex gap-1 mb-1">
            {/* Zero - only on low tab */}
            {boardTab === 'low' && (
              <ZeroCell
                amount={bets.find(b => b.numbers.length === 1 && b.numbers[0] === 0)?.amount || 0}
                isWinner={showResults && winningNumber === 0}
                disabled={isSpinning || chipBetAmount === 0}
                onClick={() => handlePlaceBet({ betType: { Straight: 0 }, amount: chipBetAmount, numbers: [0], displayText: '0' })}
                isMobile={true}
              />
            )}

            {/* Numbers 6 columns */}
            <div className="flex-1 flex flex-col gap-1">
              {[
                boardTab === 'low' ? [3, 6, 9, 12, 15, 18] : [21, 24, 27, 30, 33, 36],
                boardTab === 'low' ? [2, 5, 8, 11, 14, 17] : [20, 23, 26, 29, 32, 35],
                boardTab === 'low' ? [1, 4, 7, 10, 13, 16] : [19, 22, 25, 28, 31, 34],
              ].map((row, rowIdx) => (
                <div key={rowIdx} className="flex gap-1">
                  {row.map(num => {
                    const isRed = RED_NUMBERS.has(num);
                    const amount = bets.find(b => b.numbers.length === 1 && b.numbers[0] === num)?.amount || 0;
                    const isWinner = showResults && winningNumber === num;
                    return (
                      <BettingCell
                        key={num}
                        label={`${num}`}
                        bgColor={isRed ? 'bg-red-700' : 'bg-zinc-900'}
                        amount={amount}
                        isWinner={isWinner}
                        disabled={isSpinning || chipBetAmount === 0}
                        onClick={() => handlePlaceBet({ betType: { Straight: num }, amount: chipBetAmount, numbers: [num], displayText: `${num}` })}
                        heightClass="h-11"
                        isMobile={true}
                      />
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Column bets - only on high tab */}
            {boardTab === 'high' && (
              <div className="flex flex-col gap-1">
                {[3, 2, 1].map(col => {
                  const nums = Array.from({length: 12}, (_, i) => col + i * 3);
                  const amount = bets.find(b => [...b.numbers].sort().join(',') === [...nums].sort().join(','))?.amount || 0;
                  const isWinner = showResults && winningNumber !== null && nums.includes(winningNumber);
                  return (
                    <OutsideBetCell
                      key={col}
                      label="2:1"
                      bgColor="bg-zinc-800"
                      amount={amount}
                      isWinner={isWinner}
                      disabled={isSpinning || chipBetAmount === 0}
                      onClick={() => handlePlaceBet({ betType: { Column: col }, amount: chipBetAmount, numbers: nums, displayText: `Col ${col}` })}
                      isMobile={true}
                      heightClass="h-11"
                      widthClass="w-10"
                    />
                  );
                })}
              </div>
            )}
          </div>

          {/* Outside bets - Dozens */}
          <div className="flex gap-1 mb-1">
            {[
              { label: '1st 12', nums: Array.from({length: 12}, (_, i) => i + 1), v: 1 },
              { label: '2nd 12', nums: Array.from({length: 12}, (_, i) => i + 13), v: 2 },
              { label: '3rd 12', nums: Array.from({length: 12}, (_, i) => i + 25), v: 3 },
            ].map(({ label, nums, v }) => {
              const amount = bets.find(b => [...b.numbers].sort().join(',') === [...nums].sort().join(','))?.amount || 0;
              const isWinner = showResults && winningNumber !== null && nums.includes(winningNumber);
              return (
                <OutsideBetCell
                  key={label}
                  label={label}
                  bgColor="bg-zinc-800"
                  amount={amount}
                  isWinner={isWinner}
                  disabled={isSpinning || chipBetAmount === 0}
                  onClick={() => handlePlaceBet({ betType: { Dozen: v }, amount: chipBetAmount, numbers: nums, displayText: label })}
                  isMobile={true}
                  heightClass="h-10"
                />
              );
            })}
          </div>

          {/* Outside bets - Even money */}
          <div className="grid grid-cols-6 gap-1 mb-2">
            {[
              { label: '1-18', nums: Array.from({length: 18}, (_, i) => i + 1), bt: { Low: null } as BetType, bg: 'bg-zinc-800' },
              { label: 'EVEN', nums: Array.from({length: 36}, (_, i) => i + 1).filter(n => n % 2 === 0), bt: { Even: null } as BetType, bg: 'bg-zinc-800' },
              { label: 'RED', nums: [...RED_NUMBERS], bt: { Red: null } as BetType, bg: 'bg-red-700' },
              { label: 'BLK', nums: Array.from({length: 36}, (_, i) => i + 1).filter(n => !RED_NUMBERS.has(n)), bt: { Black: null } as BetType, bg: 'bg-zinc-900' },
              { label: 'ODD', nums: Array.from({length: 36}, (_, i) => i + 1).filter(n => n % 2 === 1), bt: { Odd: null } as BetType, bg: 'bg-zinc-800' },
              { label: '19-36', nums: Array.from({length: 18}, (_, i) => i + 19), bt: { High: null } as BetType, bg: 'bg-zinc-800' },
            ].map(({ label, nums, bt, bg }) => {
              const amount = bets.find(b => [...b.numbers].sort().join(',') === [...nums].sort().join(','))?.amount || 0;
              const isWinner = showResults && winningNumber !== null && nums.includes(winningNumber);
              return (
                <OutsideBetCell
                  key={label}
                  label={label}
                  bgColor={bg}
                  amount={amount}
                  isWinner={isWinner}
                  disabled={isSpinning || chipBetAmount === 0}
                  onClick={() => handlePlaceBet({ betType: bt, amount: chipBetAmount, numbers: nums, displayText: label })}
                  isMobile={true}
                  heightClass="h-10"
                />
              );
            })}
          </div>

          {/* Spin + Clear buttons */}
          <div className="flex gap-2 mb-2">
            {bets.length > 0 && (
              <button
                onClick={handleClearBets}
                disabled={isSpinning}
                className="px-4 py-3 rounded-xl font-bold text-sm disabled:opacity-40 transition-all border border-zinc-600/50 hover:border-zinc-500"
                style={{
                  background: 'linear-gradient(to bottom, #3f3f46 0%, #27272a 50%, #18181b 100%)',
                  color: '#a1a1aa'
                }}
              >
                CLEAR
              </button>
            )}
            <motion.button
              onClick={handleSpin}
              disabled={isSpinning || !isAuthenticated || bets.length === 0 || exceedsHouseLimit}
              className={`flex-1 py-3.5 rounded-xl font-black text-lg tracking-wide disabled:opacity-40 disabled:shadow-none transition-all ${
                isSpinning ? 'animate-pulse' : ''
              }`}
              style={isSpinning ? {
                background: 'linear-gradient(to bottom, #eab308 0%, #ca8a04 50%, #a16207 100%)',
                boxShadow: '0 4px 16px rgba(234, 179, 8, 0.3)',
                border: '1px solid rgba(250, 204, 21, 0.3)'
              } : {
                background: 'linear-gradient(to bottom, #22c55e 0%, #16a34a 50%, #15803d 100%)',
                boxShadow: '0 4px 16px rgba(22, 163, 74, 0.4)',
                border: '1px solid rgba(74, 222, 128, 0.3)'
              }}
              whileHover={(isSpinning || !isAuthenticated || bets.length === 0 || exceedsHouseLimit) ? {} : { scale: 1.02 }}
              whileTap={(isSpinning || !isAuthenticated || bets.length === 0 || exceedsHouseLimit) ? {} : { scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            >
              {getButtonText()}
            </motion.button>
          </div>
        </motion.div>

        {/* Betting Rail */}
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
            multiplier={35}
            canisterId={ROULETTE_BACKEND_CANISTER_ID}
            isBalanceLoading={gameBalanceContext.isLoading}
            isBalanceInitialized={gameBalanceContext.isInitialized}
          />
        </div>
      </div>

      {/* ===== DESKTOP LAYOUT ===== */}
      <div className="hidden md:flex flex-col h-full overflow-y-auto pb-28">
        {/* Wheel section */}
        <div className="flex-shrink-0 flex flex-col items-center py-2">
          {/* Recent Results History */}
          <RecentResults results={recentResults} maxDisplay={15} />

          <RouletteWheel
            winningNumber={winningNumber}
            isWaitingForResult={isWaitingForResult}
            isLanding={isLanding}
            onAnimationComplete={handleAnimationComplete}
          />

          {/* Result or stats */}
          <div className="text-center mt-2">
            {lastResult && showResults ? (
              <motion.div
                className="flex flex-col items-center"
                initial={{ scale: 0.8, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                {Number(lastResult.net_result) > 0 ? (
                  <>
                    <motion.span
                      className="text-green-400 text-3xl font-black tracking-wider"
                      initial={{ scale: 0.5 }}
                      animate={{ scale: [0.5, 1.2, 1] }}
                      transition={{ duration: 0.3, delay: 0.1 }}
                    >
                      WIN
                    </motion.span>
                    <motion.span
                      className="text-green-400 text-2xl font-bold"
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: 0.2 }}
                    >
                      +{formatUSDT(lastResult.total_payout)}
                    </motion.span>
                  </>
                ) : (
                  <>
                    <motion.span
                      className="text-red-400 text-3xl font-black tracking-wider"
                      initial={{ scale: 0.5 }}
                      animate={{ scale: [0.5, 1.1, 1] }}
                      transition={{ duration: 0.3, delay: 0.1 }}
                    >
                      LOSE
                    </motion.span>
                    <motion.span
                      className="text-red-400 text-2xl font-bold"
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: 0.2 }}
                    >
                      -{formatUSDT(lastResult.total_bet)}
                    </motion.span>
                  </>
                )}
              </motion.div>
            ) : (
              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center justify-center gap-6 text-base">
                  <span><span className="text-yellow-400 font-bold">{bets.length}</span> bets</span>
                  <span className="text-white font-bold">${totalBetAmount.toFixed(2)}</span>
                  <span className="text-zinc-500">Max win: <span className={exceedsHouseLimit ? 'text-red-400' : 'text-cyan-400'}>${maxPayout.toFixed(2)}</span></span>
                  {(isWaitingForResult || isLanding) && (
                    <span className="text-yellow-400 animate-pulse">
                      {isWaitingForResult ? 'Spinning...' : 'Landing...'}
                    </span>
                  )}
                </div>
                {exceedsHouseLimit && (
                  <span className="text-red-400 text-sm">
                    Exceeds house limit of ${maxAllowedPayout.toFixed(2)}
                  </span>
                )}
              </div>
            )}
          </div>
          {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
        </div>

        {/* Visual separator */}
        <div className="w-full max-w-2xl mx-auto px-4 mb-3">
          <div className="h-px bg-gradient-to-r from-transparent via-zinc-600/50 to-transparent" />
        </div>

        {/* Betting table */}
        <motion.div
          className="flex-1 flex flex-col items-center px-4 max-w-2xl mx-auto w-full relative bg-zinc-900/30 rounded-xl py-3 border border-zinc-800/50"
          animate={{
            opacity: isSpinning && !showResults ? 0.5 : 1,
            filter: isSpinning && !showResults ? 'grayscale(0.3)' : 'grayscale(0)',
          }}
          transition={{ duration: 0.4, ease: 'easeInOut' }}
        >
          {/* NO MORE BETS overlay */}
          <NoMoreBetsOverlay show={isWaitingForResult} />

          {/* Anticipation overlay during landing */}
          <AnticipationOverlay show={isLanding} />

          {/* Tab buttons */}
          <div className="flex gap-2 mb-3 w-full">
            <button
              onClick={() => setBoardTab('low')}
              className={`flex-1 py-2.5 text-base font-bold rounded-lg transition-all ${
                boardTab === 'low'
                  ? 'text-white shadow-lg border border-green-500/30'
                  : 'bg-zinc-800/80 text-zinc-400 hover:bg-zinc-700/80 border border-zinc-700/50'
              }`}
              style={boardTab === 'low' ? {
                background: 'linear-gradient(to bottom, #16a34a 0%, #15803d 50%, #166534 100%)',
                boxShadow: '0 4px 12px rgba(22, 163, 74, 0.4)'
              } : undefined}
            >
              0-18
            </button>
            <button
              onClick={() => setBoardTab('high')}
              className={`flex-1 py-2.5 text-base font-bold rounded-lg transition-all ${
                boardTab === 'high'
                  ? 'text-white shadow-lg border border-green-500/30'
                  : 'bg-zinc-800/80 text-zinc-400 hover:bg-zinc-700/80 border border-zinc-700/50'
              }`}
              style={boardTab === 'high' ? {
                background: 'linear-gradient(to bottom, #16a34a 0%, #15803d 50%, #166534 100%)',
                boxShadow: '0 4px 12px rgba(22, 163, 74, 0.4)'
              } : undefined}
            >
              19-36
            </button>
          </div>

          {/* Payout legend */}
          <div className="flex justify-center gap-4 text-xs text-zinc-500 mb-2">
            <span>Straight: <span className="text-yellow-400 font-semibold">35:1</span></span>
            <span>Dozen/Col: <span className="text-yellow-400 font-semibold">2:1</span></span>
            <span>Even Bets: <span className="text-yellow-400 font-semibold">1:1</span></span>
          </div>

          {/* Number grid */}
          <div className="flex gap-2 mb-2 w-full">
            {/* Zero - only on low tab */}
            {boardTab === 'low' && (
              <ZeroCell
                amount={bets.find(b => b.numbers.length === 1 && b.numbers[0] === 0)?.amount || 0}
                isWinner={showResults && winningNumber === 0}
                disabled={isSpinning || chipBetAmount === 0}
                onClick={() => handlePlaceBet({ betType: { Straight: 0 }, amount: chipBetAmount, numbers: [0], displayText: '0' })}
                isMobile={false}
              />
            )}

            {/* Numbers 6 columns */}
            <div className="flex-1 flex flex-col gap-2">
              {[
                boardTab === 'low' ? [3, 6, 9, 12, 15, 18] : [21, 24, 27, 30, 33, 36],
                boardTab === 'low' ? [2, 5, 8, 11, 14, 17] : [20, 23, 26, 29, 32, 35],
                boardTab === 'low' ? [1, 4, 7, 10, 13, 16] : [19, 22, 25, 28, 31, 34],
              ].map((row, rowIdx) => (
                <div key={rowIdx} className="flex gap-2">
                  {row.map(num => {
                    const isRed = RED_NUMBERS.has(num);
                    const amount = bets.find(b => b.numbers.length === 1 && b.numbers[0] === num)?.amount || 0;
                    const isWinner = showResults && winningNumber === num;
                    return (
                      <BettingCell
                        key={num}
                        label={`${num}`}
                        bgColor={isRed ? 'bg-red-700' : 'bg-zinc-900'}
                        amount={amount}
                        isWinner={isWinner}
                        disabled={isSpinning || chipBetAmount === 0}
                        onClick={() => handlePlaceBet({ betType: { Straight: num }, amount: chipBetAmount, numbers: [num], displayText: `${num}` })}
                        heightClass="h-12"
                        isMobile={false}
                      />
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Column bets - only on high tab */}
            {boardTab === 'high' && (
              <div className="flex flex-col gap-2">
                {[3, 2, 1].map(col => {
                  const nums = Array.from({length: 12}, (_, i) => col + i * 3);
                  const amount = bets.find(b => [...b.numbers].sort().join(',') === [...nums].sort().join(','))?.amount || 0;
                  const isWinner = showResults && winningNumber !== null && nums.includes(winningNumber);
                  return (
                    <OutsideBetCell
                      key={col}
                      label="2:1"
                      bgColor="bg-zinc-800"
                      amount={amount}
                      isWinner={isWinner}
                      disabled={isSpinning || chipBetAmount === 0}
                      onClick={() => handlePlaceBet({ betType: { Column: col }, amount: chipBetAmount, numbers: nums, displayText: `Col ${col}` })}
                      isMobile={false}
                      heightClass="h-12"
                      widthClass="w-14"
                    />
                  );
                })}
              </div>
            )}
          </div>

          {/* Outside bets - Dozens */}
          <div className="flex gap-2 mb-2 w-full">
            {[
              { label: '1st 12', nums: Array.from({length: 12}, (_, i) => i + 1), v: 1 },
              { label: '2nd 12', nums: Array.from({length: 12}, (_, i) => i + 13), v: 2 },
              { label: '3rd 12', nums: Array.from({length: 12}, (_, i) => i + 25), v: 3 },
            ].map(({ label, nums, v }) => {
              const amount = bets.find(b => [...b.numbers].sort().join(',') === [...nums].sort().join(','))?.amount || 0;
              const isWinner = showResults && winningNumber !== null && nums.includes(winningNumber);
              return (
                <OutsideBetCell
                  key={label}
                  label={label}
                  bgColor="bg-zinc-800"
                  amount={amount}
                  isWinner={isWinner}
                  disabled={isSpinning || chipBetAmount === 0}
                  onClick={() => handlePlaceBet({ betType: { Dozen: v }, amount: chipBetAmount, numbers: nums, displayText: label })}
                  isMobile={false}
                  heightClass="h-12"
                />
              );
            })}
          </div>

          {/* Outside bets - Even money */}
          <div className="grid grid-cols-6 gap-2 mb-3 w-full">
            {[
              { label: '1-18', nums: Array.from({length: 18}, (_, i) => i + 1), bt: { Low: null } as BetType, bg: 'bg-zinc-800' },
              { label: 'EVEN', nums: Array.from({length: 36}, (_, i) => i + 1).filter(n => n % 2 === 0), bt: { Even: null } as BetType, bg: 'bg-zinc-800' },
              { label: 'RED', nums: [...RED_NUMBERS], bt: { Red: null } as BetType, bg: 'bg-red-700' },
              { label: 'BLACK', nums: Array.from({length: 36}, (_, i) => i + 1).filter(n => !RED_NUMBERS.has(n)), bt: { Black: null } as BetType, bg: 'bg-zinc-900' },
              { label: 'ODD', nums: Array.from({length: 36}, (_, i) => i + 1).filter(n => n % 2 === 1), bt: { Odd: null } as BetType, bg: 'bg-zinc-800' },
              { label: '19-36', nums: Array.from({length: 18}, (_, i) => i + 19), bt: { High: null } as BetType, bg: 'bg-zinc-800' },
            ].map(({ label, nums, bt, bg }) => {
              const amount = bets.find(b => [...b.numbers].sort().join(',') === [...nums].sort().join(','))?.amount || 0;
              const isWinner = showResults && winningNumber !== null && nums.includes(winningNumber);
              return (
                <OutsideBetCell
                  key={label}
                  label={label}
                  bgColor={bg}
                  amount={amount}
                  isWinner={isWinner}
                  disabled={isSpinning || chipBetAmount === 0}
                  onClick={() => handlePlaceBet({ betType: bt, amount: chipBetAmount, numbers: nums, displayText: label })}
                  isMobile={false}
                  heightClass="h-12"
                />
              );
            })}
          </div>

          {/* Spin + Clear buttons */}
          <div className="flex gap-3 w-full max-w-md">
            {bets.length > 0 && (
              <button
                onClick={handleClearBets}
                disabled={isSpinning}
                className="px-6 py-3.5 rounded-xl font-bold transition-all disabled:opacity-40 border border-zinc-600/50 hover:border-zinc-500"
                style={{
                  background: 'linear-gradient(to bottom, #3f3f46 0%, #27272a 50%, #18181b 100%)',
                  color: '#a1a1aa'
                }}
              >
                CLEAR
              </button>
            )}
            <motion.button
              onClick={handleSpin}
              disabled={isSpinning || !isAuthenticated || bets.length === 0 || exceedsHouseLimit}
              className={`flex-1 py-3.5 rounded-xl font-black text-xl tracking-wide disabled:opacity-40 disabled:shadow-none transition-all ${
                isSpinning ? 'animate-pulse' : ''
              }`}
              style={isSpinning ? {
                background: 'linear-gradient(to bottom, #eab308 0%, #ca8a04 50%, #a16207 100%)',
                boxShadow: '0 4px 20px rgba(234, 179, 8, 0.4)',
                border: '1px solid rgba(250, 204, 21, 0.3)'
              } : {
                background: 'linear-gradient(to bottom, #22c55e 0%, #16a34a 50%, #15803d 100%)',
                boxShadow: '0 4px 20px rgba(22, 163, 74, 0.5)',
                border: '1px solid rgba(74, 222, 128, 0.3)'
              }}
              whileHover={(isSpinning || !isAuthenticated || bets.length === 0 || exceedsHouseLimit) ? {} : { scale: 1.02 }}
              whileTap={(isSpinning || !isAuthenticated || bets.length === 0 || exceedsHouseLimit) ? {} : { scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            >
              {getButtonText()}
            </motion.button>
          </div>
        </motion.div>

        {/* Betting Rail */}
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
            multiplier={35}
            canisterId={ROULETTE_BACKEND_CANISTER_ID}
            isBalanceLoading={gameBalanceContext.isLoading}
            isBalanceInitialized={gameBalanceContext.isInitialized}
          />
        </div>
      </div>
    </GameLayout>
  );
}
