import React from 'react';

interface ChipSelectorProps {
  selectedValue: number;
  onSelect: (value: number) => void;
  disabled?: boolean;
}

const CHIP_VALUES = [0.1, 1, 5, 10];

const getChipColor = (value: number): string => {
  if (value >= 10) return 'bg-yellow-500 border-yellow-600 hover:bg-yellow-400';
  if (value >= 5) return 'bg-orange-500 border-orange-600 hover:bg-orange-400';
  if (value >= 1) return 'bg-blue-500 border-blue-600 hover:bg-blue-400';
  return 'bg-red-500 border-red-600 hover:bg-red-400';
};

export const ChipSelector: React.FC<ChipSelectorProps> = ({
  selectedValue,
  onSelect,
  disabled = false
}) => {
  return (
    <div className="flex gap-2 justify-center items-center py-2">
      <span className="text-xs text-gray-400 mr-2">CHIP VALUE:</span>
      {CHIP_VALUES.map((value) => {
        const isSelected = selectedValue === value;
        return (
          <button
            key={value}
            onClick={() => onSelect(value)}
            disabled={disabled}
            className={`relative w-12 h-12 rounded-full border-4 flex items-center justify-center text-white font-bold text-sm transition transform ${
              getChipColor(value)
            } ${
              isSelected ? 'ring-4 ring-white scale-110' : 'hover:scale-105'
            } ${
              disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
            }`}
          >
            ${value}
          </button>
        );
      })}
    </div>
  );
};
