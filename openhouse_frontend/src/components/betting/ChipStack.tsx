import { useMemo, useCallback } from 'react';
import { decomposeIntoChips, ChipDenomination } from '../game-specific/dice/chipConfig';
import { ChipStackProps } from './types';

// Base chip stack dimensions (desktop)
const BASE_CHIP_WIDTH = 80;
const BASE_CHIP_HEIGHT = 40;
const BASE_STACK_OFFSET = 6; // Vertical spacing between chips in a pile
const BASE_PILE_OVERLAP = -12; // Horizontal overlap between piles

export function ChipStack({
  amount,
  onRemoveChip,
  disabled = false,
  maxChipsPerPile = 12,
  scale = 1, // Scale factor for responsive sizing (0.5 = half size)
}: ChipStackProps & { scale?: number }) {
  // Apply scale to all dimensions
  const CHIP_WIDTH = BASE_CHIP_WIDTH * scale;
  const CHIP_HEIGHT = BASE_CHIP_HEIGHT * scale;
  const STACK_OFFSET = BASE_STACK_OFFSET * scale;
  const PILE_OVERLAP = BASE_PILE_OVERLAP * scale;
  // Decompose amount into chip counts
  const chipData = useMemo(() => decomposeIntoChips(amount), [amount]);

  // Handle clicking a chip to remove it
  const handleChipClick = useCallback((chip: ChipDenomination) => {
    if (disabled || !onRemoveChip) return;
    onRemoveChip(chip.value);
  }, [disabled, onRemoveChip]);

  // Empty state
  if (amount <= 0 || chipData.length === 0) {
    return (
      <div className="bet-placeholder">
        <span>BET</span>
      </div>
    );
  }

  // Calculate total width needed
  const totalPiles = chipData.length;
  const totalWidth = totalPiles * CHIP_WIDTH + (totalPiles - 1) * PILE_OVERLAP;

  // Find max stack height for container sizing
  const maxStackHeight = Math.max(
    ...chipData.map(({ count }) => {
      const visibleCount = Math.min(count, maxChipsPerPile);
      return CHIP_HEIGHT + (visibleCount - 1) * STACK_OFFSET;
    })
  );

  // Calculate the offset to center all piles
  const containerWidth = totalWidth + 20;
  const centerOffset = (containerWidth - totalWidth) / 2;

  return (
    <div
      className="chip-stack-container"
      style={{
        width: containerWidth,
        height: maxStackHeight,
        position: 'relative',
        marginBottom: -8,
      }}
    >
      {chipData.map(({ chip, count }, pileIndex) => {
        const visibleCount = Math.min(count, maxChipsPerPile);
        const hasOverflow = count > maxChipsPerPile;
        const stackHeight = CHIP_HEIGHT + (visibleCount - 1) * STACK_OFFSET;
        const pileLeft = centerOffset + pileIndex * (CHIP_WIDTH + PILE_OVERLAP);

        return (
          <div
            key={chip.color}
            className="chip-pile"
            style={{
              position: 'absolute',
              left: pileLeft,
              bottom: 0,
              width: CHIP_WIDTH,
              height: stackHeight,
              zIndex: pileIndex + 1,
            }}
          >
            {/* Render chips in the pile */}
            {Array(visibleCount).fill(null).map((_, chipIndex) => (
              <img
                key={chipIndex}
                src={chip.sideImg}
                alt={`${chip.label} chip`}
                className={`chip-in-pile ${disabled ? '' : 'cursor-pointer'}`}
                onClick={() => handleChipClick(chip)}
                style={{
                  width: CHIP_WIDTH,
                  height: 'auto',
                  bottom: chipIndex * STACK_OFFSET,
                  zIndex: chipIndex,
                }}
                title={disabled ? '' : `Click to remove $${chip.value.toFixed(2)}`}
              />
            ))}

            {/* Overflow indicator */}
            {hasOverflow && (
              <div
                className="absolute -top-2 -right-1 bg-white text-gray-900 text-[9px] font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-md border border-gray-300"
                style={{ zIndex: 100 }}
              >
                +{count - maxChipsPerPile}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
