import { useState, useRef, useEffect } from 'react';
import { CHIP_DENOMINATIONS, ChipDenomination } from './chipConfig';

interface ChipSpeedDialProps {
  onAddChip: (chip: ChipDenomination) => void;
  canAddChip: (value: number) => boolean;
  disabled?: boolean;
  /** Direction chips expand when opened. 'up' for mobile, 'left' for desktop */
  expandDirection?: 'up' | 'left';
  /** Size variant */
  size?: 'sm' | 'md';
}

/**
 * Compact chip selector using Speed Dial pattern.
 * - Shows selected chip denomination when collapsed
 * - Expands to reveal all chips on tap (up for mobile, left for desktop)
 * - Selecting a chip adds it to bet AND sets it as the active chip
 * - Quick tap on collapsed chip adds another of that denomination
 */
export function ChipSpeedDial({
  onAddChip,
  canAddChip,
  disabled = false,
  expandDirection = 'up',
  size = 'md',
}: ChipSpeedDialProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedChip, setSelectedChip] = useState<ChipDenomination>(CHIP_DENOMINATIONS[0]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    if (!isExpanded) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsExpanded(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isExpanded]);

  const handleChipSelect = (chip: ChipDenomination) => {
    setSelectedChip(chip);
    if (canAddChip(chip.value)) {
      onAddChip(chip);
    }
    setIsExpanded(false);
  };

  const handleMainChipTap = () => {
    if (disabled) return;
    if (canAddChip(selectedChip.value)) {
      onAddChip(selectedChip);
    }
  };

  const handleExpandTap = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!disabled) {
      setIsExpanded(!isExpanded);
    }
  };

  const chipsReversed = [...CHIP_DENOMINATIONS].reverse();
  const isHorizontal = expandDirection === 'left';

  const formatValue = (value: number) =>
    value < 1 ? value.toFixed(2) : String(value);

  const canAddSelected = canAddChip(selectedChip.value);

  // Size classes
  const sizes = {
    sm: { chip: 'w-7 h-7', pill: 'h-9 w-[90px]', mainChip: 'w-8 h-8', mainPill: 'h-10' },
    md: { chip: 'w-7 h-7', pill: 'h-9 w-[100px]', mainChip: 'w-9 h-9', mainPill: 'h-12' },
  };
  const s = sizes[size];

  return (
    <div ref={containerRef} className="relative">
      {/* Expanded chips - fan out based on direction */}
      <div
        className={`absolute transition-all duration-200 ${
          isExpanded ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        } ${
          isHorizontal
            ? 'right-full top-1/2 -translate-y-1/2 mr-2 flex flex-row-reverse items-center'
            : 'bottom-full left-0 right-0 mb-2 flex flex-col items-center'
        }`}
      >
        <div className={`flex ${isHorizontal ? 'flex-row gap-1.5' : 'flex-col gap-1'}`}>
          {chipsReversed.map((chip, index) => {
            const isSelected = chip.color === selectedChip.color;
            const canAdd = canAddChip(chip.value);

            return (
              <button
                key={chip.color}
                onClick={() => handleChipSelect(chip)}
                disabled={disabled || !canAdd}
                className={`
                  flex items-center gap-2 ${s.pill} px-2 rounded-full
                  shadow-lg transition-all duration-150
                  ${isSelected
                    ? 'bg-yellow-500 text-black shadow-yellow-500/30'
                    : 'bg-zinc-800 text-white hover:bg-zinc-700 hover:shadow-xl'
                  }
                  ${!canAdd ? 'opacity-40' : 'active:scale-95 active:shadow-md'}
                  ${isExpanded
                    ? 'scale-100'
                    : isHorizontal ? 'translate-x-4 scale-90' : 'translate-y-4 scale-90'
                  }
                `}
                style={{ transitionDelay: isExpanded ? `${index * 30}ms` : '0ms' }}
              >
                <img
                  src={chip.topImg}
                  alt={chip.label}
                  className={`${s.chip} flex-shrink-0 object-contain`}
                />
                <span className={`text-sm font-bold ${isSelected ? 'text-black' : 'text-white'}`}>
                  ${formatValue(chip.value)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main unified button */}
      <div
        className={`
          flex items-stretch ${s.mainPill} rounded-full overflow-hidden
          transition-all duration-150
          ${isExpanded
            ? 'ring-2 ring-yellow-400 ring-offset-1 ring-offset-black'
            : ''
          }
        `}
      >
        {/* Chip + Value section */}
        <button
          onClick={handleMainChipTap}
          disabled={disabled || !canAddSelected}
          className={`
            flex items-center gap-2 pl-1 pr-3 bg-zinc-800
            ${disabled || !canAddSelected ? 'opacity-50' : 'active:bg-zinc-700'}
          `}
        >
          <img
            src={selectedChip.topImg}
            alt={selectedChip.label}
            className={`${s.mainChip} flex-shrink-0 object-contain`}
          />
          <div className="flex flex-col items-start leading-none">
            <span className="text-white text-sm font-bold">
              ${formatValue(selectedChip.value)}
            </span>
            <span className="text-zinc-500 text-[10px]">
              tap +
            </span>
          </div>
        </button>

        {/* Divider */}
        <div className="w-px bg-zinc-700" />

        {/* Expand button */}
        <button
          onClick={handleExpandTap}
          disabled={disabled}
          className={`
            flex items-center justify-center w-10
            transition-colors
            ${isExpanded ? 'bg-yellow-500' : 'bg-zinc-700'}
            ${disabled ? 'opacity-50' : 'active:brightness-110'}
          `}
        >
          <svg
            className={`w-5 h-5 transition-transform duration-200 ${
              isHorizontal
                ? (isExpanded ? 'rotate-0 text-black' : 'rotate-180 text-white')
                : (isExpanded ? 'rotate-180 text-black' : 'text-white')
            }`}
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d={isHorizontal ? "M15 19l-7-7 7-7" : "M5 15l7-7 7 7"} />
          </svg>
        </button>
      </div>
    </div>
  );
}
