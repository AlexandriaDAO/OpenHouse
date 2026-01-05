import React, { useRef, useCallback } from 'react';
import { ChipOnBoard } from './ChipOnBoard';

const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

interface NumberCellProps {
  number: number;
  betAmount: number;
  isWinner: boolean;
  payout?: number;
  onTap: () => void;
  onLongPress: () => void;
  disabled?: boolean;
}

/**
 * Individual number cell on the roulette betting board
 * Minimum 44px tap target for mobile accessibility
 */
export const NumberCell: React.FC<NumberCellProps> = ({
  number,
  betAmount,
  isWinner,
  payout = 0,
  onTap,
  onLongPress,
  disabled = false,
}) => {
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const longPressTriggered = useRef(false);

  const isRed = RED_NUMBERS.has(number);

  const handleTouchStart = useCallback(() => {
    longPressTriggered.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      onLongPress();
      // Haptic feedback
      if (navigator.vibrate) navigator.vibrate(50);
    }, 500);
  }, [onLongPress]);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (!longPressTriggered.current && !disabled) {
      onTap();
      // Light haptic for tap
      if (navigator.vibrate) navigator.vibrate(10);
    }
  }, [onTap, disabled]);

  const handleTouchCancel = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  // Desktop click handler
  const handleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (!disabled) {
      if (e.type === 'contextmenu') {
        onLongPress();
      } else {
        onTap();
      }
    }
  }, [onTap, onLongPress, disabled]);

  return (
    <button
      className={`
        relative
        w-11 h-11
        min-w-[44px] min-h-[44px]
        flex items-center justify-center
        text-white font-bold text-base
        rounded-sm
        border border-gray-700
        transition-transform active:scale-95
        touch-manipulation
        ${isRed ? 'bg-red-700' : 'bg-zinc-900'}
        ${isWinner ? 'ring-2 ring-yellow-400 animate-pulse z-20 brightness-125' : ''}
        ${disabled ? 'opacity-50' : 'active:brightness-125'}
      `}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
      onClick={handleClick}
      onContextMenu={handleClick}
      disabled={disabled}
    >
      {number}
      {betAmount > 0 && (
        <ChipOnBoard
          amount={betAmount}
          size="sm"
          isWinner={isWinner}
          payout={payout}
        />
      )}
      {/* Winner glow */}
      {isWinner && (
        <div className="absolute inset-0 bg-yellow-400/20 animate-pulse rounded pointer-events-none" />
      )}
    </button>
  );
};
