import React from 'react';

export type DiceDirection = 'Over' | 'Under';

interface DiceControlsProps {
  targetNumber: number;
  onTargetChange: (value: number) => void;
  direction: DiceDirection;
  onDirectionChange: (direction: DiceDirection) => void;
  disabled?: boolean;
}

export const DiceControls: React.FC<DiceControlsProps> = ({
  targetNumber,
  onTargetChange,
  direction,
  onDirectionChange,
  disabled = false,
}) => {
  return (
    <div className="mb-3">
      {/* Compact Row: Target + Direction */}
      <div className="flex items-center gap-2 mb-2">
        <label className="text-xs text-pure-white/60 font-mono whitespace-nowrap">
          Target: {targetNumber}
        </label>
        <input
          type="range"
          min="1"
          max="99"
          value={targetNumber}
          onChange={(e) => onTargetChange(parseInt(e.target.value))}
          className="flex-1 slider-turquoise"
          disabled={disabled}
        />
      </div>

      {/* Compact Direction Buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => onDirectionChange('Over')}
          disabled={disabled}
          className={`flex-1 py-2 text-sm font-mono font-bold rounded transition ${
            direction === 'Over'
              ? 'bg-dfinity-turquoise text-pure-black'
              : 'bg-dfinity-turquoise/20 text-dfinity-turquoise hover:bg-dfinity-turquoise/40'
          }`}
        >
          Over {targetNumber}
        </button>
        <button
          onClick={() => onDirectionChange('Under')}
          disabled={disabled}
          className={`flex-1 py-2 text-sm font-mono font-bold rounded transition ${
            direction === 'Under'
              ? 'bg-dfinity-turquoise text-pure-black'
              : 'bg-dfinity-turquoise/20 text-dfinity-turquoise hover:bg-dfinity-turquoise/40'
          }`}
        >
          Under {targetNumber}
        </button>
      </div>
    </div>
  );
};