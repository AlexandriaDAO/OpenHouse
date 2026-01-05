import React, { useCallback, useRef } from 'react';
import { ChipOnBoard } from './ChipOnBoard';

interface SplitZone {
  numbers: [number, number];
  // Position relative to cell grid - 'h' for horizontal (between rows), 'v' for vertical (between columns)
  type: 'h' | 'v';
  row: number; // Grid row (0-2)
  col: number; // Grid column (0-11)
}

// Generate all valid split positions
const generateSplits = (): SplitZone[] => {
  const splits: SplitZone[] = [];

  // Vertical splits (between horizontally adjacent numbers in same row)
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 11; col++) {
      const baseNum = row === 0 ? 3 : row === 1 ? 2 : 1;
      const num1 = baseNum + col * 3;
      const num2 = baseNum + (col + 1) * 3;
      splits.push({ numbers: [num1, num2], type: 'v', row, col });
    }
  }

  // Horizontal splits (between vertically adjacent numbers)
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 12; col++) {
      const topNum = row === 0 ? 3 + col * 3 : 2 + col * 3;
      const bottomNum = row === 0 ? 2 + col * 3 : 1 + col * 3;
      splits.push({ numbers: [topNum, bottomNum], type: 'h', row, col });
    }
  }

  // Zero splits (0-1, 0-2, 0-3)
  // These need special handling since zero spans all 3 rows

  return splits;
};

const SPLITS = generateSplits();

interface SplitBetOverlayProps {
  getBetAmount: (numbers: number[]) => number;
  isWinner: (numbers: number[]) => boolean;
  getPayout: (numbers: number[]) => number;
  onPlaceSplit: (numbers: [number, number]) => void;
  onRemoveSplit: (numbers: [number, number]) => void;
  disabled?: boolean;
  cellSize?: number; // in pixels, default 44
  gap?: number; // gap between cells, default 2
}

/**
 * Overlay for placing split bets between two adjacent numbers
 * Renders invisible tap zones on the edges between cells
 */
export const SplitBetOverlay: React.FC<SplitBetOverlayProps> = ({
  getBetAmount,
  isWinner,
  getPayout,
  onPlaceSplit,
  onRemoveSplit,
  disabled = false,
  cellSize = 44,
  gap = 2,
}) => {
  const getPosition = useCallback((split: SplitZone) => {
    const totalCellSize = cellSize + gap;

    if (split.type === 'v') {
      // Vertical line between columns - position at right edge of cell
      return {
        left: `${(split.col + 1) * totalCellSize - gap / 2}px`,
        top: `${split.row * totalCellSize}px`,
        width: `${gap + 8}px`, // 8px touch zone
        height: `${cellSize}px`,
      };
    } else {
      // Horizontal line between rows - position at bottom edge of cell
      return {
        left: `${split.col * totalCellSize}px`,
        top: `${(split.row + 1) * totalCellSize - gap / 2}px`,
        width: `${cellSize}px`,
        height: `${gap + 8}px`,
      };
    }
  }, [cellSize, gap]);

  return (
    <div className="absolute inset-0 pointer-events-none">
      {SPLITS.map((split) => {
        const amount = getBetAmount(split.numbers);
        const winner = isWinner(split.numbers);
        const payout = getPayout(split.numbers);

        return (
          <SplitBetButton
            key={`${split.numbers[0]}-${split.numbers[1]}`}
            numbers={split.numbers}
            position={getPosition(split)}
            amount={amount}
            isWinner={winner}
            payout={payout}
            onTap={() => onPlaceSplit(split.numbers)}
            onLongPress={() => onRemoveSplit(split.numbers)}
            disabled={disabled}
          />
        );
      })}
    </div>
  );
};

interface SplitBetButtonProps {
  numbers: [number, number];
  position: { left: string; top: string; width: string; height: string };
  amount: number;
  isWinner: boolean;
  payout: number;
  onTap: () => void;
  onLongPress: () => void;
  disabled?: boolean;
}

const SplitBetButton: React.FC<SplitBetButtonProps> = ({
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
        bg-transparent
        hover:bg-yellow-400/30 active:bg-yellow-400/50
        z-20
        touch-manipulation
        ${amount > 0 ? 'bg-yellow-400/20' : ''}
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
