import React from 'react';

// Chip configuration matching the betting rail
const CHIP_CONFIG = [
  { value: 0.01, img: '/chips/optimized/white_top.png' },
  { value: 0.10, img: '/chips/optimized/red_top.png' },
  { value: 1.00, img: '/chips/optimized/green_top.png' },
  { value: 5.00, img: '/chips/optimized/blue_top.png' },
  { value: 10.00, img: '/chips/optimized/black_top.png' },
];

interface ChipOnBoardProps {
  amount: number;
  size?: 'xs' | 'sm' | 'md';
  isWinner?: boolean;
  payout?: number;
}

/**
 * Visual chip representation placed on the betting board
 * Shows stacked chips with amount label
 */
export const ChipOnBoard: React.FC<ChipOnBoardProps> = ({
  amount,
  size = 'md',
  isWinner = false,
  payout = 0,
}) => {
  // Get best chip representation for an amount
  const getChipsForAmount = (amt: number): { img: string; count: number }[] => {
    const chips: { img: string; count: number }[] = [];
    let remaining = Math.round(amt * 100) / 100;

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

  const chipStack = getChipsForAmount(amount);

  const sizeClasses = {
    xs: 'w-4 h-4',
    sm: 'w-5 h-5',
    md: 'w-6 h-6',
  };

  const textSizes = {
    xs: 'text-[7px]',
    sm: 'text-[8px]',
    md: 'text-[9px]',
  };

  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none">
      <div className="relative">
        {chipStack.flatMap(({ img, count }, stackIdx) =>
          Array.from({ length: count }).map((_, i) => (
            <img
              key={`${stackIdx}-${i}`}
              src={img}
              alt="chip"
              className={`${sizeClasses[size]} absolute drop-shadow-md ${isWinner ? 'animate-bounce' : ''}`}
              style={{
                top: `-${(stackIdx * count + i) * 2}px`,
                left: '50%',
                transform: 'translateX(-50%)',
              }}
            />
          ))
        )}
        {/* Amount label */}
        <div
          className={`absolute -bottom-4 left-1/2 -translate-x-1/2 px-1 rounded ${textSizes[size]} font-bold whitespace-nowrap ${
            isWinner ? 'bg-green-500 text-white' : 'bg-black/80 text-white'
          }`}
        >
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
