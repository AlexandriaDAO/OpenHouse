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
              ? 'bg-white text-black'
              : 'bg-transparent border border-gray-700 text-gray-500 hover:border-gray-500 hover:text-gray-300'
          }`}
        >
          OVER
        </button>
        <button
          onClick={() => onDirectionChange('Under')}
          disabled={disabled}
          className={`flex-1 py-3 text-sm font-bold rounded-lg transition ${
            direction === 'Under'
              ? 'border-2 border-white text-white'
              : 'bg-transparent border border-gray-700 text-gray-500 hover:border-gray-500 hover:text-gray-300'
          }`}
        >
          UNDER
        </button>
      </div>

      {/* Target Slider - Granular Control */}
      <div className="bg-black p-3 rounded-lg border border-gray-800">
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
          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-white"
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
                  ? 'bg-white text-black'
                  : 'bg-transparent border border-gray-700 text-gray-500 hover:border-gray-500 hover:text-gray-300'
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