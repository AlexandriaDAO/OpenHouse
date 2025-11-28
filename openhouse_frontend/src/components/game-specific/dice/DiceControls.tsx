import React from 'react';

export type DiceDirection = 'Over' | 'Under';

interface DiceControlsProps {
  targetNumber: number;
  onTargetChange: (value: number) => void;
  direction: DiceDirection;
  onDirectionChange: (direction: DiceDirection) => void;
  disabled?: boolean;
}

// Target number presets (direct values 1-100)
const TARGET_PRESETS = [10, 25, 50, 75, 90];

export const DiceControls: React.FC<DiceControlsProps> = ({
  targetNumber,
  onTargetChange,
  direction,
  onDirectionChange,
  disabled = false,
}) => {
  return (
    <div className="space-y-4">
      {/* Direction toggle - big and clear */}
      <div className="flex gap-2">
        <button
          onClick={() => onDirectionChange('Over')}
          disabled={disabled}
          className={`flex-1 py-3 text-sm font-bold rounded-lg transition ${
            direction === 'Over'
              ? 'bg-green-500 text-black shadow-lg shadow-green-500/30'
              : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50 hover:text-white'
          }`}
        >
          OVER
        </button>
        <button
          onClick={() => onDirectionChange('Under')}
          disabled={disabled}
          className={`flex-1 py-3 text-sm font-bold rounded-lg transition ${
            direction === 'Under'
              ? 'bg-blue-500 text-black shadow-lg shadow-blue-500/30'
              : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50 hover:text-white'
          }`}
        >
          UNDER
        </button>
      </div>

      {/* Target Slider - Granular Control */}
      <div className="bg-gray-800/30 p-3 rounded-lg border border-gray-700/30">
        <div className="flex justify-between mb-2 text-xs text-gray-400 font-mono uppercase">
          <span>Target Number</span>
          <span className="text-white font-bold">{targetNumber}</span>
        </div>
        <input
          type="range"
          min="2"
          max="98"
          value={targetNumber}
          onChange={(e) => onTargetChange(parseInt(e.target.value))}
          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-dfinity-turquoise"
          disabled={disabled}
        />
        <div className="flex justify-between mt-1 text-[10px] text-gray-600 font-mono">
          <span>0</span>
          <span>100</span>
        </div>
      </div>

      {/* Quick presets by Target Number */}
      <div className="flex gap-1.5">
        {TARGET_PRESETS.map((val) => {
          const isActive = targetNumber === val;
          return (
            <button
              key={val}
              onClick={() => onTargetChange(val)}
              disabled={disabled}
              className={`flex-1 py-2 text-xs font-bold rounded transition ${
                isActive
                  ? 'bg-dfinity-turquoise text-black'
                  : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50 hover:text-white'
              }`}
            >
              {val}
            </button>
          );
        })}
      </div>

      {/* Context help text */}
      <div className="text-center text-xs text-gray-500 mt-1">
        {direction === 'Over' 
          ? `Win if roll is greater than ${targetNumber}` 
          : `Win if roll is less than ${targetNumber}`
        }
      </div>
    </div>
  );
};