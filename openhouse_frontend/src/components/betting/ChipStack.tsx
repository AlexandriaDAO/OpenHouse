import { useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { decomposeIntoChips, ChipDenomination } from './chipConfig';
import { ChipStackProps } from './types';

// Base chip stack dimensions (desktop)
const BASE_CHIP_WIDTH = 80;
const BASE_CHIP_HEIGHT = 40;
const BASE_STACK_OFFSET = 6; // Vertical spacing between chips in a pile
const BASE_PILE_OVERLAP = -12; // Horizontal overlap between piles

interface ExtendedChipStackProps extends ChipStackProps {
  scale?: number;
  layout?: 'horizontal' | 'circular'; // horizontal = desktop, circular = mobile pile
  circleSize?: number; // Size of the circular container
  // Mobile bet controls (only for circular layout)
  showBetControls?: boolean;
  onClear?: () => void;
  onMax?: () => void;
  canClear?: boolean;
  canMax?: boolean;
}

export function ChipStack({
  amount,
  onRemoveChip,
  disabled = false,
  maxChipsPerPile = 12,
  scale = 1,
  layout = 'horizontal',
  circleSize = 70,
  showBetControls = false,
  onClear,
  onMax,
  canClear = true,
  canMax = true,
}: ExtendedChipStackProps) {
  // Decompose amount into chip counts
  const chipData = useMemo(() => decomposeIntoChips(amount), [amount]);

  // Handle clicking a chip to remove it
  const handleChipClick = useCallback((chip: ChipDenomination) => {
    if (disabled || !onRemoveChip) return;
    onRemoveChip(chip.value);
  }, [disabled, onRemoveChip]);

  // Empty state
  if (amount <= 0 || chipData.length === 0) {
    if (showBetControls && layout === 'circular') {
      // Compact empty state with controls around it
      return (
        <div className="chip-pile-with-controls" style={{ width: circleSize, height: circleSize }}>
          <button
            onClick={onClear}
            disabled={disabled || !canClear}
            className="chip-control chip-control--clr"
          >
            CLR
          </button>
          <div className="bet-placeholder-mini">
            <span>BET</span>
          </div>
          <button
            onClick={onMax}
            disabled={disabled || !canMax}
            className="chip-control chip-control--max"
          >
            MAX
          </button>
          <span className="chip-control chip-control--amount">$0.00</span>
        </div>
      );
    }
    return (
      <div className="bet-placeholder" style={layout === 'circular' ? { width: circleSize * 0.6, height: circleSize * 0.6 } : undefined}>
        <span>BET</span>
      </div>
    );
  }

  // CIRCULAR LAYOUT - stacked piles arranged in a full circle, no overlap
  if (layout === 'circular') {
    const totalPiles = chipData.length;

    // Chip sizing for mobile - larger chips
    const chipWidth = circleSize * 0.42;
    const stackOffset = circleSize * 0.035;
    const maxChips = 5; // Max chips per pile in this layout

    // Tighter circle arrangement
    const radius = circleSize * 0.26;

    return (
      <div
        className="chip-pile-with-controls"
        style={{
          width: circleSize,
          height: circleSize,
        }}
      >
        {/* CLR on left */}
        {showBetControls && (
          <button
            onClick={onClear}
            disabled={disabled || !canClear}
            className="chip-control chip-control--clr"
          >
            CLR
          </button>
        )}

        {/* Chip pile in center */}
        <div
          className="chip-pile-circular"
          style={{
            width: circleSize * 0.7,
            height: circleSize * 0.7,
            position: 'relative',
            overflow: 'visible',
          }}
        >
          <AnimatePresence mode="popLayout">
            {chipData.map(({ chip, count }, pileIndex) => {
              const visibleCount = Math.min(count, maxChips);
              const hasOverflow = count > maxChips;

              const angle = (pileIndex / totalPiles) * Math.PI * 2 + Math.PI / 2;
              const x = Math.cos(angle) * radius;
              const y = Math.sin(angle) * radius * 0.45;

              return (
                <motion.div
                  key={chip.color}
                  className="chip-pile"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0, y: -20 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: '65%',
                    width: chipWidth,
                    transform: `translate(-50%, -50%) translate(${x}px, ${y}px)`,
                    zIndex: Math.round(10 + y),
                  }}
                >
                  <AnimatePresence mode="popLayout">
                    {Array(visibleCount).fill(null).map((_, chipIndex) => (
                      <motion.img
                        key={`${chip.color}-${chipIndex}`}
                        src={chip.sideImg}
                        alt={`${chip.label} chip`}
                        className={`chip-in-pile ${disabled ? '' : 'cursor-pointer'}`}
                        onClick={() => handleChipClick(chip)}
                        initial={{ scale: 0, y: -20 }}
                        animate={{ scale: 1, y: 0 }}
                        exit={{ scale: 0, y: -15, opacity: 0 }}
                        whileHover={!disabled ? { scale: 1.05 } : undefined}
                        whileTap={!disabled ? { scale: 0.95 } : undefined}
                        transition={{
                          type: "spring",
                          stiffness: 500,
                          damping: 30,
                          delay: chipIndex * 0.02,
                        }}
                        style={{
                          position: 'absolute',
                          width: chipWidth,
                          height: 'auto',
                          bottom: chipIndex * stackOffset,
                          left: 0,
                          zIndex: chipIndex,
                        }}
                        title={disabled ? '' : `Click to remove $${chip.value.toFixed(2)}`}
                      />
                    ))}
                  </AnimatePresence>

                  {hasOverflow && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-1 -right-1 bg-white text-gray-900 text-[7px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center shadow-md border border-gray-300"
                      style={{ zIndex: 100 }}
                    >
                      +{count - maxChips}
                    </motion.div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* MAX on right */}
        {showBetControls && (
          <button
            onClick={onMax}
            disabled={disabled || !canMax}
            className="chip-control chip-control--max"
          >
            MAX
          </button>
        )}

        {/* Amount at bottom */}
        {showBetControls && (
          <span className="chip-control chip-control--amount">${amount.toFixed(2)}</span>
        )}
      </div>
    );
  }

  // HORIZONTAL LAYOUT (default - desktop)
  const CHIP_WIDTH = BASE_CHIP_WIDTH * scale;
  const CHIP_HEIGHT = BASE_CHIP_HEIGHT * scale;
  const STACK_OFFSET = BASE_STACK_OFFSET * scale;
  const PILE_OVERLAP = BASE_PILE_OVERLAP * scale;

  const totalPiles = chipData.length;
  const totalWidth = totalPiles * CHIP_WIDTH + (totalPiles - 1) * PILE_OVERLAP;

  const maxStackHeight = Math.max(
    ...chipData.map(({ count }) => {
      const visibleCount = Math.min(count, maxChipsPerPile);
      return CHIP_HEIGHT + (visibleCount - 1) * STACK_OFFSET;
    })
  );

  const containerWidth = totalWidth + 20;
  const centerOffset = (containerWidth - totalWidth) / 2;

  return (
    <motion.div
      className="chip-stack-container"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{
        width: containerWidth,
        height: maxStackHeight,
        position: 'relative',
        marginBottom: -8,
      }}
    >
      <AnimatePresence mode="popLayout">
        {chipData.map(({ chip, count }, pileIndex) => {
          const visibleCount = Math.min(count, maxChipsPerPile);
          const hasOverflow = count > maxChipsPerPile;
          const stackHeight = CHIP_HEIGHT + (visibleCount - 1) * STACK_OFFSET;
          const pileLeft = centerOffset + pileIndex * (CHIP_WIDTH + PILE_OVERLAP);

          return (
            <motion.div
              key={chip.color}
              className="chip-pile"
              initial={{ scale: 0, opacity: 0, x: -20 }}
              animate={{ scale: 1, opacity: 1, x: 0 }}
              exit={{ scale: 0, opacity: 0, y: -30 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              style={{
                position: 'absolute',
                left: pileLeft,
                bottom: 0,
                width: CHIP_WIDTH,
                height: stackHeight,
                zIndex: pileIndex + 1,
              }}
            >
              <AnimatePresence mode="popLayout">
                {Array(visibleCount).fill(null).map((_, chipIndex) => (
                  <motion.img
                    key={`${chip.color}-${chipIndex}`}
                    src={chip.sideImg}
                    alt={`${chip.label} chip`}
                    className={`chip-in-pile ${disabled ? '' : 'cursor-pointer'}`}
                    onClick={() => handleChipClick(chip)}
                    initial={{ scale: 0, y: -30 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0, y: -20, opacity: 0 }}
                    whileHover={!disabled ? { scale: 1.05, y: -2 } : undefined}
                    whileTap={!disabled ? { scale: 0.92 } : undefined}
                    transition={{
                      type: "spring",
                      stiffness: 500,
                      damping: 30,
                      delay: chipIndex * 0.015,
                    }}
                    style={{
                      width: CHIP_WIDTH,
                      height: 'auto',
                      bottom: chipIndex * STACK_OFFSET,
                      zIndex: chipIndex,
                    }}
                    title={disabled ? '' : `Click to remove $${chip.value.toFixed(2)}`}
                  />
                ))}
              </AnimatePresence>

              {hasOverflow && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 500, damping: 25 }}
                  className="absolute -top-2 -right-1 bg-white text-gray-900 text-[9px] font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-md border border-gray-300"
                  style={{ zIndex: 100 }}
                >
                  +{count - maxChipsPerPile}
                </motion.div>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </motion.div>
  );
}
