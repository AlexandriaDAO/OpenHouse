import React from 'react';
import { BetType } from '@/declarations/roulette_backend/roulette_backend.did';

export interface PlacedBet {
  betType: BetType;
  amount: number;
  numbers: number[];
  displayText: string;
}

interface BettingBoardProps {
  bets: PlacedBet[];
  chipValue: number;
  onPlaceBet: (bet: PlacedBet) => void;
  onRemoveBet: (bet: PlacedBet) => void;
  disabled?: boolean;
  winningNumber?: number | null;  // For highlighting winning number
  showResults?: boolean;          // When to show win highlights
}

const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

// Chip configuration matching the betting rail
const CHIP_CONFIG = [
  { value: 0.01, color: 'white', img: '/chips/optimized/white_top.png' },
  { value: 0.10, color: 'red', img: '/chips/optimized/red_top.png' },
  { value: 1.00, color: 'green', img: '/chips/optimized/green_top.png' },
  { value: 5.00, color: 'blue', img: '/chips/optimized/blue_top.png' },
  { value: 10.00, color: 'black', img: '/chips/optimized/black_top.png' },
];

// Get best chip representation for an amount
const getChipsForAmount = (amount: number): { img: string; count: number }[] => {
  const chips: { img: string; count: number }[] = [];
  let remaining = Math.round(amount * 100) / 100;

  // Go from highest to lowest
  for (let i = CHIP_CONFIG.length - 1; i >= 0 && remaining > 0; i--) {
    const chip = CHIP_CONFIG[i];
    const count = Math.floor(remaining / chip.value);
    if (count > 0) {
      chips.push({ img: chip.img, count: Math.min(count, 3) }); // Max 3 of each for visual
      remaining = Math.round((remaining - count * chip.value) * 100) / 100;
    }
  }

  return chips;
};

// Check if a bet covers the winning number
const isBetWinner = (bet: PlacedBet, winningNumber: number): boolean => {
  return bet.numbers.includes(winningNumber);
};

// Calculate payout multiplier for a bet type
const getPayoutMultiplier = (betType: BetType): number => {
  if ('Straight' in betType) return 35;
  if ('Split' in betType) return 17;
  if ('Street' in betType) return 11;
  if ('Corner' in betType) return 8;
  if ('SixLine' in betType) return 5;
  if ('Column' in betType) return 2;
  if ('Dozen' in betType) return 2;
  if ('Red' in betType || 'Black' in betType) return 1;
  if ('Odd' in betType || 'Even' in betType) return 1;
  if ('High' in betType || 'Low' in betType) return 1;
  return 1;
};

export const BettingBoard: React.FC<BettingBoardProps> = ({
  bets,
  chipValue,
  onPlaceBet,
  onRemoveBet,
  disabled = false,
  winningNumber = null,
  showResults = false
}) => {

  const getBetAmount = (numbers: number[], betType: BetType): number => {
    const existingBet = bets.find(b => {
      const bNumbers = [...b.numbers].sort().join(',');
      const compareNumbers = [...numbers].sort().join(',');
      return bNumbers === compareNumbers;
    });
    return existingBet?.amount || 0;
  };

  // Find the bet for a given set of numbers
  const getBetForNumbers = (numbers: number[]): PlacedBet | undefined => {
    return bets.find(b => {
      const bNumbers = [...b.numbers].sort().join(',');
      const compareNumbers = [...numbers].sort().join(',');
      return bNumbers === compareNumbers;
    });
  };

  const handleBetClick = (numbers: number[], betType: BetType, displayText: string, e: React.MouseEvent) => {
    e.preventDefault();
    if (disabled) return;

    const bet: PlacedBet = { betType, amount: chipValue, numbers, displayText };

    if (e.type === 'contextmenu') {
      onRemoveBet(bet);
    } else {
      onPlaceBet(bet);
    }
  };

  const renderChip = (numbers: number[], betType: BetType) => {
    const amount = getBetAmount(numbers, betType);
    if (amount === 0) return null;

    const chipStack = getChipsForAmount(amount);
    const bet = getBetForNumbers(numbers);
    const isWinner = showResults && winningNumber !== null && bet && isBetWinner(bet, winningNumber);
    const payout = isWinner ? amount * (getPayoutMultiplier(betType) + 1) : 0;

    return (
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none">
        {/* Chip stack */}
        <div className="relative">
          {chipStack.flatMap(({ img, count }, stackIdx) =>
            Array.from({ length: count }).map((_, i) => (
              <img
                key={`${stackIdx}-${i}`}
                src={img}
                alt="chip"
                className={`w-6 h-6 absolute drop-shadow-md ${isWinner ? 'animate-bounce' : ''}`}
                style={{
                  top: `-${(stackIdx * count + i) * 2}px`,
                  left: '50%',
                  transform: 'translateX(-50%)',
                }}
              />
            ))
          )}
          {/* Amount label */}
          <div className={`absolute -bottom-4 left-1/2 -translate-x-1/2 px-1 rounded text-[9px] font-bold whitespace-nowrap ${
            isWinner ? 'bg-green-500 text-white' : 'bg-black/80 text-white'
          }`}>
            ${amount.toFixed(amount < 1 ? 2 : 0)}
          </div>

          {/* Payout amount on winning bets */}
          {isWinner && payout > 0 && (
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-green-500 text-white text-[10px] px-1.5 py-0.5 rounded font-bold whitespace-nowrap animate-pulse shadow-lg shadow-green-500/50">
              +${payout.toFixed(2)}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Check if a number cell is the winning number
  const isWinningNumberCell = (num: number): boolean => {
    return showResults && winningNumber !== null && num === winningNumber;
  };

  // Check if a position has a winning bet
  const hasWinningBet = (numbers: number[]): boolean => {
    if (!showResults || winningNumber === null) return false;
    const bet = getBetForNumbers(numbers);
    return bet ? isBetWinner(bet, winningNumber) : false;
  };

  // Generate number blocks (1-36)
  const renderNumberGrid = () => {
    const rows = [];
    for (let row = 0; row < 3; row++) {
      const cells = [];
      for (let col = 0; col < 12; col++) {
        const num = 3 - row + (col * 3);
        const isRed = RED_NUMBERS.includes(num);
        const isWinner = isWinningNumberCell(num);

        cells.push(
          <div
            key={`num-${num}`}
            className={`relative w-10 h-10 sm:w-12 sm:h-12 border border-gray-700 flex items-center justify-center cursor-pointer hover:bg-white/10 transition ${
              isRed ? 'bg-red-700' : 'bg-black'
            } text-white font-bold text-sm ${
              isWinner ? 'ring-2 ring-yellow-400 ring-offset-1 ring-offset-transparent animate-pulse z-20 brightness-125' : ''
            }`}
            onClick={(e) => handleBetClick([num], { Straight: num }, `${num}`, e)}
            onContextMenu={(e) => handleBetClick([num], { Straight: num }, `${num}`, e)}
          >
            {num}
            {renderChip([num], { Straight: num })}

            {/* Winning number glow overlay */}
            {isWinner && (
              <div className="absolute inset-0 bg-yellow-400/20 animate-pulse rounded pointer-events-none" />
            )}
          </div>
        );
      }

      // Add 2:1 column bet at the end of each row
      const columnNums = Array.from({ length: 12 }, (_, i) => 3 - row + (i * 3));
      const columnWins = hasWinningBet(columnNums);

      rows.push(
        <div key={`row-${row}`} className="flex">
          {cells}
          <div
            className={`relative w-16 h-10 sm:h-12 bg-gray-800 border border-gray-700 flex items-center justify-center cursor-pointer hover:bg-gray-700 transition text-white font-bold text-xs ${
              columnWins ? 'ring-2 ring-green-400 animate-pulse' : ''
            }`}
            onClick={(e) => handleBetClick(columnNums, { Column: (3 - row) }, `Column ${3 - row}`, e)}
            onContextMenu={(e) => handleBetClick(columnNums, { Column: (3 - row) }, `Column ${3 - row}`, e)}
          >
            2:1
            {renderChip(columnNums, { Column: (3 - row) })}
            {columnWins && (
              <div className="absolute inset-0 bg-green-400/20 animate-pulse rounded pointer-events-none" />
            )}
          </div>
        </div>
      );
    }
    return rows;
  };

  return (
    <div className="bg-gradient-to-b from-green-900 to-green-950 p-3 sm:p-4 rounded-lg border-4 border-yellow-700 shadow-2xl select-none">
      {/* Main betting area */}
      <div className="flex">
        {/* Zero - spans only the number rows (3 rows × cell height) */}
        {(() => {
          const isZeroWinner = isWinningNumberCell(0);
          return (
            <div
              className={`relative w-10 sm:w-12 h-[calc(3*2.5rem)] sm:h-[calc(3*3rem)] bg-green-600 border border-gray-700 flex items-center justify-center cursor-pointer hover:bg-green-500 transition text-white font-bold text-sm rounded-l self-start ${
                isZeroWinner ? 'ring-2 ring-yellow-400 animate-pulse z-20 brightness-125' : ''
              }`}
              onClick={(e) => handleBetClick([0], { Straight: 0 }, '0', e)}
              onContextMenu={(e) => handleBetClick([0], { Straight: 0 }, '0', e)}
              style={{ writingMode: 'vertical-rl' }}
            >
              <span className="py-4">0</span>
              {renderChip([0], { Straight: 0 })}
              {isZeroWinner && (
                <div className="absolute inset-0 bg-yellow-400/20 animate-pulse rounded pointer-events-none" />
              )}
            </div>
          );
        })()}

        {/* Right side: numbers + outside bets */}
        <div className="flex flex-col">
          {/* Numbers grid + 2:1 columns */}
          {renderNumberGrid()}

          {/* Dozen bets - use same 12-column grid as numbers */}
          <div className="flex mt-1">
            {[
              { label: '1st 12', nums: Array.from({ length: 12 }, (_, i) => i + 1), variant: 1 },
              { label: '2nd 12', nums: Array.from({ length: 12 }, (_, i) => i + 13), variant: 2 },
              { label: '3rd 12', nums: Array.from({ length: 12 }, (_, i) => i + 25), variant: 3 },
            ].map(({ label, nums, variant }) => {
              const dozenWins = hasWinningBet(nums);
              return (
                <div
                  key={label}
                  className={`relative w-[calc(4*2.5rem)] sm:w-[calc(4*3rem)] h-8 bg-gray-800 border border-gray-700 flex items-center justify-center cursor-pointer hover:bg-gray-700 transition text-white font-bold text-xs ${
                    dozenWins ? 'ring-2 ring-green-400 animate-pulse' : ''
                  }`}
                  onClick={(e) => handleBetClick(nums, { Dozen: variant }, label, e)}
                  onContextMenu={(e) => handleBetClick(nums, { Dozen: variant }, label, e)}
                >
                  {label}
                  {renderChip(nums, { Dozen: variant })}
                  {dozenWins && (
                    <div className="absolute inset-0 bg-green-400/20 animate-pulse rounded pointer-events-none" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Even money bets - single row of 6, each spans 2 number columns */}
          <div className="flex mt-1">
            {[
              { label: '1-18', nums: Array.from({ length: 18 }, (_, i) => i + 1), betType: { Low: null } as BetType },
              { label: 'EVEN', nums: Array.from({ length: 36 }, (_, i) => i + 1).filter(n => n % 2 === 0), betType: { Even: null } as BetType },
              { label: 'RED', nums: RED_NUMBERS, betType: { Red: null } as BetType, className: 'bg-red-700' },
              { label: 'BLACK', nums: Array.from({ length: 36 }, (_, i) => i + 1).filter(n => !RED_NUMBERS.includes(n)), betType: { Black: null } as BetType, className: 'bg-black' },
              { label: 'ODD', nums: Array.from({ length: 36 }, (_, i) => i + 1).filter(n => n % 2 === 1), betType: { Odd: null } as BetType },
              { label: '19-36', nums: Array.from({ length: 18 }, (_, i) => i + 19), betType: { High: null } as BetType },
            ].map(({ label, nums, betType, className = 'bg-gray-800' }) => {
              const outsideWins = hasWinningBet(nums);
              return (
                <div
                  key={label}
                  className={`relative w-[calc(2*2.5rem)] sm:w-[calc(2*3rem)] h-8 ${className} border border-gray-700 flex items-center justify-center cursor-pointer hover:brightness-110 transition text-white font-bold text-[10px] ${
                    outsideWins ? 'ring-2 ring-green-400 animate-pulse' : ''
                  }`}
                  onClick={(e) => handleBetClick(nums, betType, label, e)}
                  onContextMenu={(e) => handleBetClick(nums, betType, label, e)}
                >
                  {label}
                  {renderChip(nums, betType)}
                  {outsideWins && (
                    <div className="absolute inset-0 bg-green-400/20 animate-pulse rounded pointer-events-none" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="mt-2 text-xs text-gray-400 text-center">
        Click to bet • Right-click to remove
      </div>
    </div>
  );
};
