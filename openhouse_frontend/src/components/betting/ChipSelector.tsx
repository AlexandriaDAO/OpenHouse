import { CHIP_DENOMINATIONS, ChipDenomination } from '../game-specific/dice/chipConfig';

interface ChipSelectorProps {
  onAddChip: (chip: ChipDenomination) => void;
  canAddChip: (value: number) => boolean;
  disabled: boolean;
  size?: 'xs' | 'mobile' | 'sm' | 'md';
  variant?: 'full' | 'compact';  // 'compact' = 3 chips for mobile (red, green, blue)
}

export function ChipSelector({
  onAddChip,
  canAddChip,
  disabled,
  size = 'md',
  variant = 'full',
}: ChipSelectorProps) {
  // Filter chips based on variant - compact shows only $0.10, $1, $5 for mobile
  const chips = variant === 'compact'
    ? CHIP_DENOMINATIONS.filter(c => ['red', 'green', 'blue'].includes(c.color))
    : CHIP_DENOMINATIONS;

  // Explicit sizes for distinct layouts
  const sizeClasses = {
    xs: { img: 'w-7 h-7', gap: 'gap-0.5' },           // 28px
    mobile: { img: 'w-[30px] h-[30px]', gap: 'gap-1' }, // 30px (~7% bigger than xs)
    sm: { img: 'w-9 h-9', gap: 'gap-1' },             // 36px
    md: { img: 'w-12 h-12', gap: 'gap-2' },           // 48px
  };
  const { img: imgClass, gap: gapClass } = sizeClasses[size];

  return (
    <div className={`flex items-center ${gapClass}`}>
      {chips.map(chip => (
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