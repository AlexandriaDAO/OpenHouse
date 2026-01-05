import React, { useRef, useCallback } from 'react';
import { ChipOnBoard } from './ChipOnBoard';

interface ColumnButtonProps {
  column: 1 | 2 | 3;
  betAmount: number;
  isWinner: boolean;
  payout?: number;
  onTap: () => void;
  onLongPress: () => void;
  disabled?: boolean;
}

/**
 * 2:1 Column bet button at the end of each row
 */
export const ColumnButton: React.FC<ColumnButtonProps> = ({
  column,
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
        w-10 h-11
        min-w-[40px] min-h-[44px]
        bg-gray-800
        border border-gray-700
        flex items-center justify-center
        text-white font-bold text-xs
        rounded-r-sm
        transition-transform active:scale-95
        touch-manipulation
        ${isWinner ? 'ring-2 ring-green-400 animate-pulse' : ''}
        ${disabled ? 'opacity-50' : 'hover:bg-gray-700'}
      `}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
      onClick={handleClick}
      onContextMenu={handleClick}
      disabled={disabled}
    >
      2:1
      {betAmount > 0 && (
        <ChipOnBoard
          amount={betAmount}
          size="xs"
          isWinner={isWinner}
          payout={payout}
        />
      )}
      {isWinner && (
        <div className="absolute inset-0 bg-green-400/20 animate-pulse rounded pointer-events-none" />
      )}
    </button>
  );
};
