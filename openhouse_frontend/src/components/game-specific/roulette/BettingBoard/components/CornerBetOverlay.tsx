import React, { useCallback, useRef } from 'react';
import { ChipOnBoard } from './ChipOnBoard';

interface CornerPosition {
  topLeft: number; // The top-left number of the 4-corner
  numbers: [number, number, number, number];
  row: number; // Which row intersection (0 or 1)
  col: number; // Which column intersection (0-10)
}

// Generate all valid corner positions
// Corners are at intersections of 4 numbers
const generateCorners = (): CornerPosition[] => {
  const corners: CornerPosition[] = [];

  // There are 2 row intersections and 11 column intersections
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 11; col++) {
      // Get the 4 numbers at this corner
      // Top row of pair is at row, bottom is at row+1
      // Left col is at col, right is at col+1
      const topRow = row === 0 ? 3 : 2; // Row 0: 3,6,9... Row 1: 2,5,8...
      const bottomRow = row === 0 ? 2 : 1;

      const topLeft = topRow + col * 3;
      const topRight = topRow + (col + 1) * 3;
      const bottomLeft = bottomRow + col * 3;
      const bottomRight = bottomRow + (col + 1) * 3;

      corners.push({
        topLeft,
        numbers: [topLeft, topRight, bottomLeft, bottomRight],
        row,
        col,
      });
    }
  }

  return corners;
};

const CORNERS = generateCorners();

interface CornerBetOverlayProps {
  getBetAmount: (numbers: number[]) => number;
  isWinner: (numbers: number[]) => boolean;
  getPayout: (numbers: number[]) => number;
  onPlaceCorner: (numbers: [number, number, number, number]) => void;
  onRemoveCorner: (numbers: [number, number, number, number]) => void;
  disabled?: boolean;
  cellSize?: number;
  gap?: number;
}

/**
 * Overlay for placing corner bets at the intersection of 4 numbers
 * Renders circular tap zones at cell corners
 */
export const CornerBetOverlay: React.FC<CornerBetOverlayProps> = ({
  getBetAmount,
  isWinner,
  getPayout,
  onPlaceCorner,
  onRemoveCorner,
  disabled = false,
  cellSize = 44,
  gap = 2,
}) => {
  const getPosition = useCallback((corner: CornerPosition) => {
    const totalCellSize = cellSize + gap;

    // Position at the corner intersection
    return {
      left: `${(corner.col + 1) * totalCellSize - gap / 2}px`,
      top: `${(corner.row + 1) * totalCellSize - gap / 2}px`,
    };
  }, [cellSize, gap]);

  return (
    <div className="absolute inset-0 pointer-events-none">
      {CORNERS.map((corner) => {
        const amount = getBetAmount(corner.numbers);
        const winner = isWinner(corner.numbers);
        const payout = getPayout(corner.numbers);

        return (
          <CornerBetButton
            key={corner.topLeft}
            numbers={corner.numbers}
            position={getPosition(corner)}
            amount={amount}
            isWinner={winner}
            payout={payout}
            onTap={() => onPlaceCorner(corner.numbers)}
            onLongPress={() => onRemoveCorner(corner.numbers)}
            disabled={disabled}
          />
        );
      })}
    </div>
  );
};

interface CornerBetButtonProps {
  numbers: [number, number, number, number];
  position: { left: string; top: string };
  amount: number;
  isWinner: boolean;
  payout: number;
  onTap: () => void;
  onLongPress: () => void;
  disabled?: boolean;
}

const CornerBetButton: React.FC<CornerBetButtonProps> = ({
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
        absolute w-6 h-6
        -translate-x-1/2 -translate-y-1/2
        rounded-full
        pointer-events-auto
        hover:bg-yellow-400/40 active:bg-yellow-400/60
        z-30
        touch-manipulation
        ${amount > 0 ? 'bg-yellow-400/30' : 'bg-transparent'}
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
        <ChipOnBoard
          amount={amount}
          size="xs"
          isWinner={isWinner}
          payout={payout}
        />
      )}
    </button>
  );
};
