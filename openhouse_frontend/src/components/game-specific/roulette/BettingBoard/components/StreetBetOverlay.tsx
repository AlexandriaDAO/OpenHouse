import React, { useCallback, useRef } from 'react';
import { ChipOnBoard } from './ChipOnBoard';

interface StreetPosition {
  startNumber: number;
  numbers: [number, number, number];
  col: number; // Column index (0-11)
}

// Generate all 12 street positions (rows of 3)
const generateStreets = (): StreetPosition[] => {
  const streets: StreetPosition[] = [];

  for (let col = 0; col < 12; col++) {
    const start = 1 + col * 3;
    streets.push({
      startNumber: start,
      numbers: [start, start + 1, start + 2],
      col,
    });
  }

  return streets;
};

const STREETS = generateStreets();

interface StreetBetOverlayProps {
  getBetAmount: (numbers: number[]) => number;
  isWinner: (numbers: number[]) => boolean;
  getPayout: (numbers: number[]) => number;
  onPlaceStreet: (numbers: [number, number, number]) => void;
  onRemoveStreet: (numbers: [number, number, number]) => void;
  disabled?: boolean;
  cellSize?: number;
  gap?: number;
  zeroWidth?: number; // Width of zero cell
}

/**
 * Overlay for placing street bets on a row of 3 numbers
 * Tap zone is on the left edge of each column (between zero/first column and numbers)
 */
export const StreetBetOverlay: React.FC<StreetBetOverlayProps> = ({
  getBetAmount,
  isWinner,
  getPayout,
  onPlaceStreet,
  onRemoveStreet,
  disabled = false,
  cellSize = 44,
  gap = 2,
  zeroWidth = 44,
}) => {
  const getPosition = useCallback((street: StreetPosition) => {
    const totalCellSize = cellSize + gap;

    // Position at the left edge of the column (where street starts)
    // For col 0, this is right after the zero cell
    const leftOffset = zeroWidth + gap + street.col * totalCellSize;

    return {
      left: `${leftOffset - 6}px`, // Slightly overlap into the gap
      top: '0px',
      width: '12px',
      height: `${cellSize * 3 + gap * 2}px`, // Full height of 3 rows
    };
  }, [cellSize, gap, zeroWidth]);

  return (
    <div className="absolute inset-0 pointer-events-none">
      {STREETS.map((street) => {
        const amount = getBetAmount(street.numbers);
        const winner = isWinner(street.numbers);
        const payout = getPayout(street.numbers);

        return (
          <StreetBetButton
            key={street.startNumber}
            numbers={street.numbers}
            position={getPosition(street)}
            amount={amount}
            isWinner={winner}
            payout={payout}
            onTap={() => onPlaceStreet(street.numbers)}
            onLongPress={() => onRemoveStreet(street.numbers)}
            disabled={disabled}
          />
        );
      })}
    </div>
  );
};

interface StreetBetButtonProps {
  numbers: [number, number, number];
  position: { left: string; top: string; width: string; height: string };
  amount: number;
  isWinner: boolean;
  payout: number;
  onTap: () => void;
  onLongPress: () => void;
  disabled?: boolean;
}

const StreetBetButton: React.FC<StreetBetButtonProps> = ({
  position,
  amount,
  isWinner,
  payout,
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

  return (
    <button
      className={`
        absolute pointer-events-auto
        hover:bg-yellow-400/30 active:bg-yellow-400/50
        z-20
        touch-manipulation
        ${amount > 0 ? 'bg-yellow-400/20' : 'bg-transparent'}
      `}
      style={position}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
      onClick={(e) => {
        e.preventDefault();
        if (!disabled) onTap();
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        if (!disabled) onLongPress();
      }}
      disabled={disabled}
    >
      {amount > 0 && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <ChipOnBoard
            amount={amount}
            size="xs"
            isWinner={isWinner}
            payout={payout}
          />
        </div>
      )}
    </button>
  );
};
