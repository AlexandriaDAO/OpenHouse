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
}

const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

export const BettingBoard: React.FC<BettingBoardProps> = ({
  bets,
  chipValue,
  onPlaceBet,
  onRemoveBet,
  disabled = false
}) => {

  const getBetAmount = (numbers: number[], betType: BetType): number => {
    const existingBet = bets.find(b => {
      const bNumbers = b.numbers.sort().join(',');
      const compareNumbers = numbers.sort().join(',');
      return bNumbers === compareNumbers;
    });
    return existingBet?.amount || 0;
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

  const getChipColor = (amount: number): string => {
    if (amount >= 100) return 'bg-yellow-500 border-yellow-600';
    if (amount >= 10) return 'bg-orange-500 border-orange-600';
    if (amount >= 5) return 'bg-blue-500 border-blue-600';
    return 'bg-red-500 border-red-600';
  };

  const renderChip = (numbers: number[], betType: BetType) => {
    const amount = getBetAmount(numbers, betType);
    if (amount === 0) return null;

    return (
      <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full ${getChipColor(amount)} border-2 flex items-center justify-center text-white text-[10px] font-bold shadow-lg z-10 pointer-events-none`}>
        {amount}
      </div>
    );
  };

  // Generate number blocks (1-36)
  const renderNumberGrid = () => {
    const rows = [];
    for (let row = 0; row < 3; row++) {
      const cells = [];
      for (let col = 0; col < 12; col++) {
        const num = 3 - row + (col * 3);
        const isRed = RED_NUMBERS.includes(num);

        cells.push(
          <div
            key={`num-${num}`}
            className={`relative w-10 h-10 sm:w-12 sm:h-12 border border-gray-700 flex items-center justify-center cursor-pointer hover:bg-white/10 transition ${
              isRed ? 'bg-red-700' : 'bg-black'
            } text-white font-bold text-sm`}
            onClick={(e) => handleBetClick([num], { Straight: num }, `${num}`, e)}
            onContextMenu={(e) => handleBetClick([num], { Straight: num }, `${num}`, e)}
          >
            {num}
            {renderChip([num], { Straight: num })}
          </div>
        );
      }

      // Add 2:1 column bet at the end of each row
      const columnNums = Array.from({ length: 12 }, (_, i) => 3 - row + (i * 3));
      rows.push(
        <div key={`row-${row}`} className="flex">
          {cells}
          <div
            className="relative w-16 h-10 sm:h-12 bg-gray-800 border border-gray-700 flex items-center justify-center cursor-pointer hover:bg-gray-700 transition text-white font-bold text-xs"
            onClick={(e) => handleBetClick(columnNums, { Column: (3 - row) }, `Column ${3 - row}`, e)}
            onContextMenu={(e) => handleBetClick(columnNums, { Column: (3 - row) }, `Column ${3 - row}`, e)}
          >
            2:1
            {renderChip(columnNums, { Column: (3 - row) })}
          </div>
        </div>
      );
    }
    return rows;
  };

  return (
    <div className="bg-gradient-to-b from-green-900 to-green-950 p-3 sm:p-4 rounded-lg border-4 border-yellow-700 shadow-2xl select-none">
      {/* Main betting area */}
      <div className="flex gap-2">
        {/* Zero */}
        <div
          className="relative w-10 sm:w-12 bg-green-600 border border-gray-700 flex items-center justify-center cursor-pointer hover:bg-green-500 transition text-white font-bold text-sm rounded"
          onClick={(e) => handleBetClick([0], { Straight: 0 }, '0', e)}
          onContextMenu={(e) => handleBetClick([0], { Straight: 0 }, '0', e)}
          style={{ writingMode: 'vertical-rl', height: '100%' }}
        >
          <span className="py-4">0</span>
          {renderChip([0], { Straight: 0 })}
        </div>

        {/* Numbers grid + columns */}
        <div className="flex flex-col gap-0">
          {renderNumberGrid()}

          {/* Dozen bets */}
          <div className="flex mt-1">
            {[
              { label: '1st 12', nums: Array.from({ length: 12 }, (_, i) => i + 1), variant: 1 },
              { label: '2nd 12', nums: Array.from({ length: 12 }, (_, i) => i + 13), variant: 2 },
              { label: '3rd 12', nums: Array.from({ length: 12 }, (_, i) => i + 25), variant: 3 },
            ].map(({ label, nums, variant }) => (
              <div
                key={label}
                className="relative flex-1 h-8 bg-gray-800 border border-gray-700 flex items-center justify-center cursor-pointer hover:bg-gray-700 transition text-white font-bold text-xs"
                onClick={(e) => handleBetClick(nums, { Dozen: variant }, label, e)}
                onContextMenu={(e) => handleBetClick(nums, { Dozen: variant }, label, e)}
              >
                {label}
                {renderChip(nums, { Dozen: variant })}
              </div>
            ))}
            <div className="w-16" /> {/* Spacer for column alignment */}
          </div>

          {/* Even money bets */}
          <div className="grid grid-cols-3 gap-1 mt-1">
            {[
              { label: '1-18', nums: Array.from({ length: 18 }, (_, i) => i + 1), betType: { Low: null } },
              { label: 'EVEN', nums: Array.from({ length: 36 }, (_, i) => i + 1).filter(n => n % 2 === 0), betType: { Even: null } },
              { label: 'RED', nums: RED_NUMBERS, betType: { Red: null }, className: 'bg-red-700' },
              { label: 'BLACK', nums: Array.from({ length: 36 }, (_, i) => i + 1).filter(n => !RED_NUMBERS.includes(n)), betType: { Black: null }, className: 'bg-black' },
              { label: 'ODD', nums: Array.from({ length: 36 }, (_, i) => i + 1).filter(n => n % 2 === 1), betType: { Odd: null } },
              { label: '19-36', nums: Array.from({ length: 18 }, (_, i) => i + 19), betType: { High: null } },
            ].map(({ label, nums, betType, className = 'bg-gray-800' }) => (
              <div
                key={label}
                className={`relative h-10 ${className} border border-gray-700 flex items-center justify-center cursor-pointer hover:brightness-110 transition text-white font-bold text-xs`}
                onClick={(e) => handleBetClick(nums, betType, label, e)}
                onContextMenu={(e) => handleBetClick(nums, betType, label, e)}
              >
                {label}
                {renderChip(nums, betType)}
              </div>
            ))}
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
