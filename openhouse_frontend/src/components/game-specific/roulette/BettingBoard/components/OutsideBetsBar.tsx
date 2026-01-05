import React, { useRef, useCallback } from 'react';
import { BetType } from '@/declarations/roulette_backend/roulette_backend.did';
import { ChipOnBoard } from './ChipOnBoard';

const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

interface OutsideBet {
  label: string;
  betType: BetType;
  numbers: number[];
  className?: string;
}

interface OutsideBetsBarProps {
  getBetAmount: (numbers: number[]) => number;
  hasWinningBet: (numbers: number[]) => boolean;
  getPayout: (numbers: number[], betType: BetType) => number;
  onPlaceBet: (numbers: number[], betType: BetType, displayText: string) => void;
  onRemoveBet: (numbers: number[], betType: BetType, displayText: string) => void;
  disabled?: boolean;
}

const DOZENS: OutsideBet[] = [
  { label: '1st 12', betType: { Dozen: 1 }, numbers: Array.from({ length: 12 }, (_, i) => i + 1) },
  { label: '2nd 12', betType: { Dozen: 2 }, numbers: Array.from({ length: 12 }, (_, i) => i + 13) },
  { label: '3rd 12', betType: { Dozen: 3 }, numbers: Array.from({ length: 12 }, (_, i) => i + 25) },
];

const EVEN_MONEY: OutsideBet[] = [
  { label: '1-18', betType: { Low: null }, numbers: Array.from({ length: 18 }, (_, i) => i + 1), className: 'bg-gray-800' },
  { label: 'EVEN', betType: { Even: null }, numbers: Array.from({ length: 36 }, (_, i) => i + 1).filter(n => n % 2 === 0), className: 'bg-gray-800' },
  { label: 'RED', betType: { Red: null }, numbers: RED_NUMBERS, className: 'bg-red-700' },
  { label: 'BLACK', betType: { Black: null }, numbers: Array.from({ length: 36 }, (_, i) => i + 1).filter(n => !RED_NUMBERS.includes(n)), className: 'bg-black' },
  { label: 'ODD', betType: { Odd: null }, numbers: Array.from({ length: 36 }, (_, i) => i + 1).filter(n => n % 2 === 1), className: 'bg-gray-800' },
  { label: '19-36', betType: { High: null }, numbers: Array.from({ length: 18 }, (_, i) => i + 19), className: 'bg-gray-800' },
];

interface OutsideBetButtonProps {
  bet: OutsideBet;
  amount: number;
  isWinner: boolean;
  payout: number;
  onTap: () => void;
  onLongPress: () => void;
  disabled?: boolean;
  className?: string;
}

const OutsideBetButton: React.FC<OutsideBetButtonProps> = ({
  bet,
  amount,
  isWinner,
  payout,
  onTap,
  onLongPress,
  disabled = false,
  className = '',
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
        h-10 min-h-[40px]
        flex items-center justify-center
        text-white text-xs font-bold
        rounded
        border border-gray-700
        transition-all active:scale-95
        touch-manipulation
        ${bet.className || 'bg-gray-800'}
        ${className}
        ${isWinner ? 'ring-2 ring-green-400 animate-pulse' : ''}
        ${disabled ? 'opacity-50' : 'hover:brightness-110'}
      `}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
      onClick={handleClick}
      onContextMenu={handleClick}
      disabled={disabled}
    >
      {bet.label}
      {amount > 0 && (
        <ChipOnBoard
          amount={amount}
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

/**
 * Sticky bar with outside bets (Dozens + Even Money)
 * Always visible above the betting rail
 */
export const OutsideBetsBar: React.FC<OutsideBetsBarProps> = ({
  getBetAmount,
  hasWinningBet,
  getPayout,
  onPlaceBet,
  onRemoveBet,
  disabled = false,
}) => {
  return (
    <div className="bg-zinc-900/95 backdrop-blur border-t border-zinc-700 px-2 py-2">
      {/* Row 1: Dozens */}
      <div className="flex gap-1 mb-1">
        {DOZENS.map((bet) => (
          <OutsideBetButton
            key={bet.label}
            bet={bet}
            amount={getBetAmount(bet.numbers)}
            isWinner={hasWinningBet(bet.numbers)}
            payout={getPayout(bet.numbers, bet.betType)}
            onTap={() => onPlaceBet(bet.numbers, bet.betType, bet.label)}
            onLongPress={() => onRemoveBet(bet.numbers, bet.betType, bet.label)}
            disabled={disabled}
            className="flex-1"
          />
        ))}
      </div>

      {/* Row 2: Even money bets - 2x3 grid */}
      <div className="grid grid-cols-6 gap-1">
        {EVEN_MONEY.map((bet) => (
          <OutsideBetButton
            key={bet.label}
            bet={bet}
            amount={getBetAmount(bet.numbers)}
            isWinner={hasWinningBet(bet.numbers)}
            payout={getPayout(bet.numbers, bet.betType)}
            onTap={() => onPlaceBet(bet.numbers, bet.betType, bet.label)}
            onLongPress={() => onRemoveBet(bet.numbers, bet.betType, bet.label)}
            disabled={disabled}
          />
        ))}
      </div>
    </div>
  );
};
