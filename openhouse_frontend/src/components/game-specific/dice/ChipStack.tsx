import React from 'react';
import { decomposeIntoChips, ChipDenomination } from '../../betting/chipConfig';

interface ChipStackProps {
  amount: number;
  maxChipsShown?: number; // Max chips per pile
  onClick?: () => void;
  showValue?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const ChipStack: React.FC<ChipStackProps> = ({
  amount,
  maxChipsShown = 20,
  onClick,
  showValue = true,
  size = 'md',
  className = '',
}) => {
  const chipCounts = decomposeIntoChips(amount);

  // Size configurations - Tweaked for tighter stacking
  const sizeConfig = {
    sm: { width: 36, height: 18, offset: -3 },
    md: { width: 56, height: 28, offset: -5 },
    lg: { width: 72, height: 36, offset: -7 },
    xl: { width: 96, height: 48, offset: -9 }, // New extra large size
  };
  const { width, height, offset } = sizeConfig[size];

  if (amount <= 0) {
    return (
      <div
        className={`flex flex-col items-center justify-center ${className}`}
        onClick={onClick}
        style={{ cursor: onClick ? 'pointer' : 'default', minHeight: height }}
      >
        {/* Empty state handled by parent usually, or minimal placeholder */}
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col items-center ${className}`}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      {/* Piles Container - Reduced gap for tight "touching" look */}
      <div className="flex flex-row items-end justify-center -space-x-2">
        {chipCounts.map(({ chip, count }) => {
          const visibleCount = Math.min(count, maxChipsShown);
          const hasMore = count > maxChipsShown;
          
          const chipsInPile = Array(visibleCount).fill(chip);

          // Calculate exact height needed
          const stackHeight = (visibleCount - 1) * Math.abs(offset) + height;

          return (
            <div
              key={chip.color}
              className="relative transition-transform hover:-translate-y-1"
              style={{
                width: width,
                height: stackHeight,
                zIndex: 10, // Ensure base z-index
              }}
            >
              {chipsInPile.map((_, index) => (
                <img
                  key={index}
                  src={chip.sideImg}
                  alt={`${chip.color} chip`}
                  className="absolute left-1/2 transform -translate-x-1/2 drop-shadow-md"
                  style={{
                    width: '100%', // Fit container
                    height: 'auto',
                    bottom: index * Math.abs(offset),
                    zIndex: index,
                  }}
                />
              ))}

              {/* "More" indicator */}
              {hasMore && (
                <div
                  className="absolute -top-3 -right-1 bg-dfinity-turquoise text-black text-[9px] font-bold rounded-full w-5 h-5 flex items-center justify-center z-50 shadow-sm border border-white/20"
                  style={{ bottom: stackHeight - 10 }}
                >
                  +
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Value display */}
      {showValue && (
        <div className="mt-1 text-xs font-mono font-bold text-gray-300">
          {amount.toFixed(2)} USDT
        </div>
      )}
    </div>
  );
};
