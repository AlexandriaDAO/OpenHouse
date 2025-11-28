import React from 'react';
import { decomposeIntoChips, ChipDenomination } from './chipConfig';

interface ChipStackProps {
  amount: number;
  maxChipsShown?: number; // Max chips per pile
  onClick?: () => void;
  showValue?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const ChipStack: React.FC<ChipStackProps> = ({
  amount,
  maxChipsShown = 10,
  onClick,
  showValue = true,
  size = 'md',
  className = '',
}) => {
  const chipCounts = decomposeIntoChips(amount);
  // decomposeIntoChips returns High -> Low (Black -> White)
  // We'll display them in that order (Left -> Right: Black ... White) or reverse?
  // Usually larger values are more significant, so Left is good.

  // Size configurations
  const sizeConfig = {
    sm: { width: 40, height: 20, offset: -4 },
    md: { width: 60, height: 30, offset: -6 },
    lg: { width: 80, height: 40, offset: -8 },
  };
  const { width, height, offset } = sizeConfig[size];

  if (amount <= 0) {
    return (
      <div
        className={`flex flex-col items-center justify-center ${className}`}
        onClick={onClick}
        style={{ cursor: onClick ? 'pointer' : 'default', minHeight: height + 20 }}
      >
        <div className="text-gray-500 text-xs italic">No chips</div>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col items-center ${className}`}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      {/* Piles Container */}
      <div className="flex flex-row items-end justify-center gap-1">
        {chipCounts.map(({ chip, count }) => {
          const visibleCount = Math.min(count, maxChipsShown);
          const hasMore = count > maxChipsShown;
          
          // Create array for mapping
          const chipsInPile = Array(visibleCount).fill(chip);

          return (
            <div
              key={chip.color}
              className="relative"
              style={{
                width: width,
                height: height + (visibleCount - 1) * Math.abs(offset) + 10,
                // Ensure enough height for the stack
              }}
            >
              {chipsInPile.map((_, index) => (
                <img
                  key={index}
                  src={chip.sideImg}
                  alt={`${chip.color} chip`}
                  className="absolute left-1/2 transform -translate-x-1/2 drop-shadow-md transition-transform hover:scale-105"
                  style={{
                    width,
                    height: 'auto',
                    bottom: index * Math.abs(offset),
                    zIndex: index,
                  }}
                />
              ))}

              {/* "More" indicator if truncated */}
              {hasMore && (
                <div
                  className="absolute -top-2 -right-2 bg-dfinity-turquoise text-black text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center z-50 shadow-sm border border-white/20"
                  style={{ bottom: (visibleCount - 1) * Math.abs(offset) + height - 10 }} // Position near top of stack
                >
                  +{count - maxChipsShown}
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
