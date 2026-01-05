import React, { useCallback, useMemo } from 'react';
import { BetType } from '@/declarations/roulette_backend/roulette_backend.did';

export interface PlacedBet {
  betType: BetType;
  amount: number;
  numbers: number[];
  displayText: string;
}

interface MobileBettingBoardProps {
  bets: PlacedBet[];
  chipValue: number;
  onPlaceBet: (bet: PlacedBet) => void;
  onRemoveBet: (bet: PlacedBet) => void;
  disabled?: boolean;
  winningNumber?: number | null;
  showResults?: boolean;
}

const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

/**
 * Mobile-optimized betting board
 */
export const MobileBettingBoard: React.FC<MobileBettingBoardProps> = ({
  bets,
  chipValue,
  onPlaceBet,
  onRemoveBet,
  disabled = false,
  winningNumber = null,
  showResults = false,
}) => {
  const betLookup = useMemo(() => {
    const lookup = new Map<string, PlacedBet>();
    bets.forEach(bet => {
      const key = [...bet.numbers].sort().join(',');
      lookup.set(key, bet);
    });
    return lookup;
  }, [bets]);

  const getBetAmount = useCallback((numbers: number[]): number => {
    const key = [...numbers].sort().join(',');
    return betLookup.get(key)?.amount || 0;
  }, [betLookup]);

  const handleBetClick = useCallback((
    numbers: number[],
    betType: BetType,
    displayText: string,
    isRemove: boolean = false
  ) => {
    if (disabled) return;
    if (isRemove) {
      const existing = betLookup.get([...numbers].sort().join(','));
      if (existing) {
        onRemoveBet({ betType, amount: chipValue || existing.amount, numbers, displayText });
      }
    } else {
      if (chipValue === 0) return;
      onPlaceBet({ betType, amount: chipValue, numbers, displayText });
    }
  }, [disabled, chipValue, betLookup, onPlaceBet, onRemoveBet]);

  const isWinner = useCallback((numbers: number[]): boolean => {
    return showResults && winningNumber !== null && numbers.includes(winningNumber);
  }, [showResults, winningNumber]);

  // Standard roulette layout
  const numberGrid = useMemo(() => {
    const grid: number[][] = [[], [], []];
    for (let col = 0; col < 12; col++) {
      grid[0].push(3 + col * 3); // Top: 3,6,9...36
      grid[1].push(2 + col * 3); // Mid: 2,5,8...35
      grid[2].push(1 + col * 3); // Bot: 1,4,7...34
    }
    return grid;
  }, []);

  const getColumnNumbers = (col: number) => Array.from({ length: 12 }, (_, i) => col + i * 3);

  // Cell styles
  const cellBase = "w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center text-white font-bold border border-zinc-700 relative";
  const activeStyle = disabled ? "opacity-50" : "active:brightness-125";

  return (
    <div className="bg-gradient-to-b from-green-900 to-green-950 rounded-lg border-2 border-yellow-700">
      {/* NUMBER GRID - Horizontal Scroll, snap to start */}
      <div
        className="overflow-x-auto p-2 snap-x snap-mandatory"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div className="inline-flex gap-1">
          {/* ZERO */}
          <button
            className={`w-12 min-w-[48px] bg-green-600 text-xl rounded-l snap-start ${cellBase} ${activeStyle} ${isWinner([0]) ? 'ring-2 ring-yellow-400 animate-pulse' : ''}`}
            style={{ height: '140px' }}
            onClick={() => handleBetClick([0], { Straight: 0 }, '0')}
            onContextMenu={(e) => { e.preventDefault(); handleBetClick([0], { Straight: 0 }, '0', true); }}
          >
            0
            {getBetAmount([0]) > 0 && <span className="absolute top-1 right-1 bg-yellow-500 text-black text-[9px] px-1 rounded-full">${getBetAmount([0])}</span>}
          </button>

          {/* NUMBERS 1-36 */}
          <div className="flex flex-col gap-1">
            {numberGrid.map((row, rowIdx) => (
              <div key={rowIdx} className="flex gap-1">
                {row.map(num => {
                  const isRed = RED_NUMBERS.has(num);
                  const won = isWinner([num]);
                  const amt = getBetAmount([num]);
                  return (
                    <button
                      key={num}
                      className={`${cellBase} ${isRed ? 'bg-red-700' : 'bg-zinc-900'} ${activeStyle} ${won ? 'ring-2 ring-yellow-400 animate-pulse' : ''}`}
                      onClick={() => handleBetClick([num], { Straight: num }, `${num}`)}
                      onContextMenu={(e) => { e.preventDefault(); handleBetClick([num], { Straight: num }, `${num}`, true); }}
                    >
                      {num}
                      {amt > 0 && <span className="absolute -top-1 -right-1 bg-yellow-500 text-black text-[9px] px-1 rounded-full">${amt}</span>}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {/* COLUMN BETS 2:1 */}
          <div className="flex flex-col gap-1">
            {[3, 2, 1].map(col => {
              const nums = getColumnNumbers(col);
              const won = isWinner(nums);
              const amt = getBetAmount(nums);
              return (
                <button
                  key={col}
                  className={`w-10 h-11 min-h-[44px] bg-zinc-800 border border-zinc-700 text-white font-bold text-xs relative ${activeStyle} ${won ? 'ring-2 ring-green-400' : ''}`}
                  onClick={() => handleBetClick(nums, { Column: col }, `Col ${col}`)}
                  onContextMenu={(e) => { e.preventDefault(); handleBetClick(nums, { Column: col }, `Col ${col}`, true); }}
                >
                  2:1
                  {amt > 0 && <span className="absolute -top-1 -right-1 bg-yellow-500 text-black text-[8px] px-0.5 rounded-full">${amt}</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Scroll hint */}
      <p className="text-center text-xs text-zinc-400 py-1">Swipe to see 0 and all numbers</p>

      {/* OUTSIDE BETS - Below scroll */}
      <div className="border-t-4 border-yellow-500 p-2 bg-zinc-800">
        <p className="text-yellow-400 text-center font-bold mb-2">OUTSIDE BETS</p>
        {/* Dozens */}
        <div className="flex gap-1 mb-1">
          {[
            { label: '1st 12', nums: Array.from({length: 12}, (_, i) => i + 1), v: 1 },
            { label: '2nd 12', nums: Array.from({length: 12}, (_, i) => i + 13), v: 2 },
            { label: '3rd 12', nums: Array.from({length: 12}, (_, i) => i + 25), v: 3 },
          ].map(({ label, nums, v }) => (
            <button
              key={label}
              className={`flex-1 h-10 bg-zinc-800 border border-zinc-700 text-white font-bold text-xs relative ${activeStyle} ${isWinner(nums) ? 'ring-2 ring-green-400' : ''}`}
              onClick={() => handleBetClick(nums, { Dozen: v }, label)}
              onContextMenu={(e) => { e.preventDefault(); handleBetClick(nums, { Dozen: v }, label, true); }}
            >
              {label}
              {getBetAmount(nums) > 0 && <span className="absolute -top-1 -right-1 bg-yellow-500 text-black text-[8px] px-0.5 rounded-full">${getBetAmount(nums)}</span>}
            </button>
          ))}
        </div>

        {/* Even Money */}
        <div className="grid grid-cols-6 gap-1">
          {[
            { label: '1-18', nums: Array.from({length: 18}, (_, i) => i + 1), bt: { Low: null } as BetType, bg: 'bg-zinc-800' },
            { label: 'EVEN', nums: Array.from({length: 36}, (_, i) => i + 1).filter(n => n % 2 === 0), bt: { Even: null } as BetType, bg: 'bg-zinc-800' },
            { label: 'RED', nums: [...RED_NUMBERS], bt: { Red: null } as BetType, bg: 'bg-red-700' },
            { label: 'BLK', nums: Array.from({length: 36}, (_, i) => i + 1).filter(n => !RED_NUMBERS.has(n)), bt: { Black: null } as BetType, bg: 'bg-zinc-900' },
            { label: 'ODD', nums: Array.from({length: 36}, (_, i) => i + 1).filter(n => n % 2 === 1), bt: { Odd: null } as BetType, bg: 'bg-zinc-800' },
            { label: '19-36', nums: Array.from({length: 18}, (_, i) => i + 19), bt: { High: null } as BetType, bg: 'bg-zinc-800' },
          ].map(({ label, nums, bt, bg }) => (
            <button
              key={label}
              className={`h-10 ${bg} border border-zinc-700 text-white font-bold text-[10px] relative ${activeStyle} ${isWinner(nums) ? 'ring-2 ring-green-400' : ''}`}
              onClick={() => handleBetClick(nums, bt, label)}
              onContextMenu={(e) => { e.preventDefault(); handleBetClick(nums, bt, label, true); }}
            >
              {label}
              {getBetAmount(nums) > 0 && <span className="absolute -top-1 -right-1 bg-yellow-500 text-black text-[8px] px-0.5 rounded-full">${getBetAmount(nums)}</span>}
            </button>
          ))}
        </div>
      </div>

      <p className="text-center text-[10px] text-zinc-500 pb-2">Tap to bet | Long-press to remove</p>
    </div>
  );
};
