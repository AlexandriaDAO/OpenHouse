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

const TIMING = {
  MIN_SPIN_DURATION: 2000,
  LANDING_DURATION: 4000,
  RESULT_DISPLAY: 6000,
};

type AnimationState = 'idle' | 'waiting' | 'landing' | 'showing_result' | 'resetting';

const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

export function RouletteGame() {
  const { actor } = useRouletteActor();
  const { actor: ledgerActor } = useLedgerActor();
  const { isAuthenticated } = useAuth();

  const { balance: walletBalance, refreshBalance: refreshWalletBalance } = useBalance();
  const gameBalanceContext = useGameBalance('roulette');
  const balance = gameBalanceContext.balance;

  const handleBalanceRefresh = useCallback(() => {
    refreshWalletBalance();
    gameBalanceContext.refresh();
  }, [refreshWalletBalance, gameBalanceContext]);

  const [bets, setBets] = useState<PlacedBet[]>([]);
  const [chipBetAmount, setChipBetAmount] = useState(0.01);
  const [winningNumber, setWinningNumber] = useState<number | null>(null);
  const [lastResult, setLastResult] = useState<SpinResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [maxBet] = useState(100);
  const [animationState, setAnimationState] = useState<AnimationState>('idle');
  const [recentResults, setRecentResults] = useState<number[]>([]);
  const [boardTab, setBoardTab] = useState<'low' | 'high'>('low');

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

  const handlePlaceBet = useCallback((newBet: PlacedBet) => {
    if (animationState !== 'idle') return;
    setBets(prevBets => {
      const existingIndex = prevBets.findIndex(b =>
        [...b.numbers].sort().join(',') === [...newBet.numbers].sort().join(',')
      );
      if (existingIndex >= 0) {
        const updated = [...prevBets];
        updated[existingIndex] = { ...updated[existingIndex], amount: updated[existingIndex].amount + newBet.amount };
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
          updated[existingIndex] = { ...updated[existingIndex], amount: currentAmount - removeAmount };
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
    // Add to recent results
    if (winningNumber !== null) {
      setRecentResults(prev => [winningNumber, ...prev].slice(0, 15));
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
      default: return bets.length > 0 ? `SPIN $${totalBetAmount.toFixed(2)}` : 'PLACE BETS';
    }
  };

  // Get winning number display color
  const getNumberColor = (num: number | null) => {
    if (num === null) return 'bg-zinc-700';
    if (num === 0) return 'bg-green-600';
    return RED_NUMBERS.has(num) ? 'bg-red-600' : 'bg-zinc-900';
  };

  return (
    <GameLayout hideFooter noScroll>
      {/* ===== MOBILE LAYOUT ===== */}
      <div className="md:hidden flex flex-col h-full">
        {/* Wheel section */}
        <div className="flex-shrink-0 flex flex-col items-center py-2">
          <div className="transform scale-[0.6] origin-center -my-10">
            <RouletteWheel
              winningNumber={winningNumber}
              isWaitingForResult={isWaitingForResult}
              isLanding={isLanding}
              onAnimationComplete={handleAnimationComplete}
            />
          </div>

          {/* Result or stats */}
          <div className="text-center mt-1">
            {lastResult && showResults ? (
              <div className="text-lg font-bold">
                {Number(lastResult.net_result) > 0 ? (
                  <span className="text-green-400">+${formatUSDT(lastResult.total_payout)}</span>
                ) : (
                  <span className="text-red-400">-${formatUSDT(lastResult.total_bet)}</span>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center gap-4 text-sm">
                <span><span className="text-yellow-400 font-bold">{bets.length}</span> bets</span>
                <span className="text-white font-bold">${totalBetAmount.toFixed(2)}</span>
              </div>
            )}
          </div>
          {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
        </div>

        {/* Betting table */}
        <div className="flex-1 flex flex-col px-2">
          {/* Tab buttons */}
          <div className="flex gap-1 mb-1">
            <button
              onClick={() => setBoardTab('low')}
              className={`flex-1 py-2 text-sm font-bold rounded ${
                boardTab === 'low' ? 'bg-green-700 text-white' : 'bg-zinc-800 text-zinc-400'
              }`}
            >
              0-18
            </button>
            <button
              onClick={() => setBoardTab('high')}
              className={`flex-1 py-2 text-sm font-bold rounded ${
                boardTab === 'high' ? 'bg-green-700 text-white' : 'bg-zinc-800 text-zinc-400'
              }`}
            >
              19-36
            </button>
          </div>

          {/* Number grid */}
          <div className="flex gap-1 mb-1">
            {/* Zero - only on low tab */}
            {boardTab === 'low' && (
              <button
                className={`w-12 bg-green-600 rounded text-white font-bold text-lg flex items-center justify-center relative ${showResults && winningNumber === 0 ? 'ring-2 ring-yellow-400' : ''} ${isSpinning || chipBetAmount === 0 ? 'opacity-50' : 'active:brightness-125'}`}
                style={{ height: '132px' }}
                onClick={() => handlePlaceBet({ betType: { Straight: 0 }, amount: chipBetAmount, numbers: [0], displayText: '0' })}
                disabled={isSpinning || chipBetAmount === 0}
              >
                0
                {(bets.find(b => b.numbers.length === 1 && b.numbers[0] === 0)?.amount || 0) > 0 && (
                  <span className="absolute top-1 right-1 bg-yellow-500 text-black text-[8px] px-1 rounded-full">
                    ${bets.find(b => b.numbers.length === 1 && b.numbers[0] === 0)?.amount}
                  </span>
                )}
              </button>
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
                      <button
                        key={num}
                        className={`flex-1 h-11 ${isRed ? 'bg-red-700' : 'bg-zinc-900'} rounded text-white font-bold flex items-center justify-center relative ${isWinner ? 'ring-2 ring-yellow-400' : ''} ${isSpinning || chipBetAmount === 0 ? 'opacity-50' : 'active:brightness-125'}`}
                        onClick={() => handlePlaceBet({ betType: { Straight: num }, amount: chipBetAmount, numbers: [num], displayText: `${num}` })}
                        disabled={isSpinning || chipBetAmount === 0}
                      >
                        {num}
                        {amount > 0 && <span className="absolute -top-1 -right-1 bg-yellow-500 text-black text-[8px] px-1 rounded-full">${amount}</span>}
                      </button>
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
                    <button
                      key={col}
                      className={`w-10 h-11 bg-zinc-800 rounded text-white font-bold text-xs relative ${isWinner ? 'ring-2 ring-green-400' : ''} ${isSpinning || chipBetAmount === 0 ? 'opacity-50' : 'active:brightness-125'}`}
                      onClick={() => handlePlaceBet({ betType: { Column: col }, amount: chipBetAmount, numbers: nums, displayText: `Col ${col}` })}
                      disabled={isSpinning || chipBetAmount === 0}
                    >
                      2:1
                      {amount > 0 && <span className="absolute -top-1 -right-1 bg-yellow-500 text-black text-[8px] px-0.5 rounded-full">${amount}</span>}
                    </button>
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
                <button
                  key={label}
                  className={`flex-1 h-10 bg-zinc-800 rounded text-white font-bold text-xs relative ${isWinner ? 'ring-2 ring-green-400' : ''} ${isSpinning || chipBetAmount === 0 ? 'opacity-50' : 'active:brightness-125'}`}
                  onClick={() => handlePlaceBet({ betType: { Dozen: v }, amount: chipBetAmount, numbers: nums, displayText: label })}
                  disabled={isSpinning || chipBetAmount === 0}
                >
                  {label}
                  {amount > 0 && <span className="absolute -top-1 -right-1 bg-yellow-500 text-black text-[8px] px-1 rounded-full">${amount}</span>}
                </button>
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
                <button
                  key={label}
                  className={`h-10 ${bg} rounded text-white font-bold text-[10px] relative ${isWinner ? 'ring-2 ring-green-400' : ''} ${isSpinning || chipBetAmount === 0 ? 'opacity-50' : 'active:brightness-125'}`}
                  onClick={() => handlePlaceBet({ betType: bt, amount: chipBetAmount, numbers: nums, displayText: label })}
                  disabled={isSpinning || chipBetAmount === 0}
                >
                  {label}
                  {amount > 0 && <span className="absolute -top-1 -right-1 bg-yellow-500 text-black text-[8px] px-1 rounded-full">${amount}</span>}
                </button>
              );
            })}
          </div>

          {/* Spin + Clear buttons */}
          <div className="flex gap-2 mb-2">
            {bets.length > 0 && (
              <button
                onClick={handleClearBets}
                disabled={isSpinning}
                className="px-4 py-3 bg-zinc-800 text-zinc-400 rounded-lg font-bold text-sm disabled:opacity-50"
              >
                CLEAR
              </button>
            )}
            <button
              onClick={handleSpin}
              disabled={isSpinning || !isAuthenticated || bets.length === 0}
              className={`flex-1 py-3 rounded-lg font-bold text-lg ${
                isSpinning ? 'bg-yellow-600 animate-pulse' : 'bg-green-600 active:bg-green-500'
              } disabled:opacity-50`}
            >
              {getButtonText()}
            </button>
          </div>
        </div>

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
      <div className="hidden md:flex flex-col h-full">
        {/* Wheel section */}
        <div className="flex-shrink-0 flex flex-col items-center py-4">
          <div className="transform scale-[0.75] origin-center -my-8">
            <RouletteWheel
              winningNumber={winningNumber}
              isWaitingForResult={isWaitingForResult}
              isLanding={isLanding}
              onAnimationComplete={handleAnimationComplete}
            />
          </div>

          {/* Result or stats */}
          <div className="text-center mt-2">
            {lastResult && showResults ? (
              <div className="text-2xl font-bold">
                {Number(lastResult.net_result) > 0 ? (
                  <span className="text-green-400">+${formatUSDT(lastResult.total_payout)}</span>
                ) : (
                  <span className="text-red-400">-${formatUSDT(lastResult.total_bet)}</span>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center gap-6 text-base">
                <span><span className="text-yellow-400 font-bold">{bets.length}</span> bets</span>
                <span className="text-white font-bold">${totalBetAmount.toFixed(2)}</span>
                <span className="text-zinc-500">Max win: <span className="text-cyan-400">${maxPayout.toFixed(2)}</span></span>
              </div>
            )}
          </div>
          {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
        </div>

        {/* Betting table */}
        <div className="flex-1 flex flex-col items-center px-4 max-w-2xl mx-auto w-full">
          {/* Tab buttons */}
          <div className="flex gap-2 mb-2 w-full">
            <button
              onClick={() => setBoardTab('low')}
              className={`flex-1 py-2.5 text-base font-bold rounded-lg transition ${
                boardTab === 'low' ? 'bg-green-700 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              0-18
            </button>
            <button
              onClick={() => setBoardTab('high')}
              className={`flex-1 py-2.5 text-base font-bold rounded-lg transition ${
                boardTab === 'high' ? 'bg-green-700 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              19-36
            </button>
          </div>

          {/* Number grid */}
          <div className="flex gap-2 mb-2 w-full">
            {/* Zero - only on low tab */}
            {boardTab === 'low' && (
              <button
                className={`w-16 bg-green-600 rounded-lg text-white font-bold text-xl flex items-center justify-center relative transition hover:brightness-110 ${showResults && winningNumber === 0 ? 'ring-2 ring-yellow-400' : ''} ${isSpinning || chipBetAmount === 0 ? 'opacity-50' : ''}`}
                style={{ height: '156px' }}
                onClick={() => handlePlaceBet({ betType: { Straight: 0 }, amount: chipBetAmount, numbers: [0], displayText: '0' })}
                disabled={isSpinning || chipBetAmount === 0}
              >
                0
                {(bets.find(b => b.numbers.length === 1 && b.numbers[0] === 0)?.amount || 0) > 0 && (
                  <span className="absolute top-2 right-2 bg-yellow-500 text-black text-xs px-1.5 rounded-full">
                    ${bets.find(b => b.numbers.length === 1 && b.numbers[0] === 0)?.amount}
                  </span>
                )}
              </button>
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
                      <button
                        key={num}
                        className={`flex-1 h-12 ${isRed ? 'bg-red-700 hover:bg-red-600' : 'bg-zinc-900 hover:bg-zinc-800'} rounded-lg text-white font-bold text-lg flex items-center justify-center relative transition ${isWinner ? 'ring-2 ring-yellow-400' : ''} ${isSpinning || chipBetAmount === 0 ? 'opacity-50' : ''}`}
                        onClick={() => handlePlaceBet({ betType: { Straight: num }, amount: chipBetAmount, numbers: [num], displayText: `${num}` })}
                        disabled={isSpinning || chipBetAmount === 0}
                      >
                        {num}
                        {amount > 0 && <span className="absolute -top-1 -right-1 bg-yellow-500 text-black text-xs px-1.5 rounded-full">${amount}</span>}
                      </button>
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
                    <button
                      key={col}
                      className={`w-14 h-12 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-white font-bold text-sm relative transition ${isWinner ? 'ring-2 ring-green-400' : ''} ${isSpinning || chipBetAmount === 0 ? 'opacity-50' : ''}`}
                      onClick={() => handlePlaceBet({ betType: { Column: col }, amount: chipBetAmount, numbers: nums, displayText: `Col ${col}` })}
                      disabled={isSpinning || chipBetAmount === 0}
                    >
                      2:1
                      {amount > 0 && <span className="absolute -top-1 -right-1 bg-yellow-500 text-black text-xs px-1 rounded-full">${amount}</span>}
                    </button>
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
                <button
                  key={label}
                  className={`flex-1 h-12 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-white font-bold text-sm relative transition ${isWinner ? 'ring-2 ring-green-400' : ''} ${isSpinning || chipBetAmount === 0 ? 'opacity-50' : ''}`}
                  onClick={() => handlePlaceBet({ betType: { Dozen: v }, amount: chipBetAmount, numbers: nums, displayText: label })}
                  disabled={isSpinning || chipBetAmount === 0}
                >
                  {label}
                  {amount > 0 && <span className="absolute -top-1 -right-1 bg-yellow-500 text-black text-xs px-1.5 rounded-full">${amount}</span>}
                </button>
              );
            })}
          </div>

          {/* Outside bets - Even money */}
          <div className="grid grid-cols-6 gap-2 mb-3 w-full">
            {[
              { label: '1-18', nums: Array.from({length: 18}, (_, i) => i + 1), bt: { Low: null } as BetType, bg: 'bg-zinc-800 hover:bg-zinc-700' },
              { label: 'EVEN', nums: Array.from({length: 36}, (_, i) => i + 1).filter(n => n % 2 === 0), bt: { Even: null } as BetType, bg: 'bg-zinc-800 hover:bg-zinc-700' },
              { label: 'RED', nums: [...RED_NUMBERS], bt: { Red: null } as BetType, bg: 'bg-red-700 hover:bg-red-600' },
              { label: 'BLACK', nums: Array.from({length: 36}, (_, i) => i + 1).filter(n => !RED_NUMBERS.has(n)), bt: { Black: null } as BetType, bg: 'bg-zinc-900 hover:bg-zinc-800' },
              { label: 'ODD', nums: Array.from({length: 36}, (_, i) => i + 1).filter(n => n % 2 === 1), bt: { Odd: null } as BetType, bg: 'bg-zinc-800 hover:bg-zinc-700' },
              { label: '19-36', nums: Array.from({length: 18}, (_, i) => i + 19), bt: { High: null } as BetType, bg: 'bg-zinc-800 hover:bg-zinc-700' },
            ].map(({ label, nums, bt, bg }) => {
              const amount = bets.find(b => [...b.numbers].sort().join(',') === [...nums].sort().join(','))?.amount || 0;
              const isWinner = showResults && winningNumber !== null && nums.includes(winningNumber);
              return (
                <button
                  key={label}
                  className={`h-12 ${bg} rounded-lg text-white font-bold text-sm relative transition ${isWinner ? 'ring-2 ring-green-400' : ''} ${isSpinning || chipBetAmount === 0 ? 'opacity-50' : ''}`}
                  onClick={() => handlePlaceBet({ betType: bt, amount: chipBetAmount, numbers: nums, displayText: label })}
                  disabled={isSpinning || chipBetAmount === 0}
                >
                  {label}
                  {amount > 0 && <span className="absolute -top-1 -right-1 bg-yellow-500 text-black text-xs px-1.5 rounded-full">${amount}</span>}
                </button>
              );
            })}
          </div>

          {/* Spin + Clear buttons */}
          <div className="flex gap-3 w-full max-w-md">
            {bets.length > 0 && (
              <button
                onClick={handleClearBets}
                disabled={isSpinning}
                className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-lg font-bold transition disabled:opacity-50"
              >
                CLEAR
              </button>
            )}
            <button
              onClick={handleSpin}
              disabled={isSpinning || !isAuthenticated || bets.length === 0}
              className={`flex-1 py-3 rounded-lg font-bold text-xl transition ${
                isSpinning ? 'bg-yellow-600 animate-pulse' : 'bg-green-600 hover:bg-green-500'
              } disabled:opacity-50`}
            >
              {getButtonText()}
            </button>
          </div>
        </div>

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
