import React, { useRef, useCallback } from 'react';
import { ChipOnBoard } from './ChipOnBoard';

interface ZeroCellProps {
  betAmount: number;
  isWinner: boolean;
  payout?: number;
  onTap: () => void;
  onLongPress: () => void;
  disabled?: boolean;
}

/**
 * Special zero cell - spans 3 rows with vertical text
 * 44px minimum width, height spans full grid
 */
export const ZeroCell: React.FC<ZeroCellProps> = ({
  betAmount,
  isWinner,
  payout = 0,
  onTap,
  onLongPress,
  disabled = false,
}) => {
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const longPressTriggered = useRef(false);

  const handleTouchStart = useCallback(() => {
    longPressTriggered.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      onLongPress();
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
        w-11 min-w-[44px]
        h-[136px]
        bg-green-600
        text-white font-bold text-lg
        rounded-l-lg
        border border-gray-700
        flex items-center justify-center
        transition-transform active:scale-95
        touch-manipulation
        ${isWinner ? 'ring-2 ring-yellow-400 animate-pulse z-20 brightness-125' : ''}
        ${disabled ? 'opacity-50' : 'active:brightness-125'}
      `}
      style={{ writingMode: 'vertical-rl' }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
      onClick={handleClick}
      onContextMenu={handleClick}
      disabled={disabled}
    >
      0
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
        <div className="absolute inset-0 bg-yellow-400/20 animate-pulse rounded-l pointer-events-none" />
      )}
    </button>
  );
};
