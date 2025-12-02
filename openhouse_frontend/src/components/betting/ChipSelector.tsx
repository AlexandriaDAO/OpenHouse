import { CHIP_DENOMINATIONS, ChipDenomination } from '../game-specific/dice/chipConfig';

interface ChipSelectorProps {
  onAddChip: (chip: ChipDenomination) => void;
  canAddChip: (value: number) => boolean;
  disabled: boolean;
  size?: 'xs' | 'sm' | 'md';
}

export function ChipSelector({
  onAddChip,
  canAddChip,
  disabled,
  size = 'md',
}: ChipSelectorProps) {
  // Explicit sizes for distinct layouts
  const sizeClasses = {
    xs: { img: 'w-7 h-7', gap: 'gap-0.5' },
    sm: { img: 'w-9 h-9', gap: 'gap-1' },
    md: { img: 'w-12 h-12', gap: 'gap-2' },
  };
  const { img: imgClass, gap: gapClass } = sizeClasses[size];

  return (
    <div className={`flex items-center ${gapClass}`}>
      {CHIP_DENOMINATIONS.map(chip => (
        <button
          key={chip.color}
          onClick={() => onAddChip(chip)}
          disabled={disabled || !canAddChip(chip.value)}
          className="chip-button transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105"
          title={`Add $${chip.value.toFixed(2)}`}
        >
          <img
            src={chip.topImg}
            alt={chip.label}
            className={`${imgClass} object-contain drop-shadow-md`}
          />
        </button>
      ))}
    </div>
  );
}