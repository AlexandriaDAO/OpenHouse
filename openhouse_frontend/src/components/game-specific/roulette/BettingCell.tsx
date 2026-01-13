import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Helper function to get gradient background style based on color
const getBackgroundStyle = (bgColor: string, isWinner: boolean): React.CSSProperties => {
  if (isWinner) {
    return { background: 'linear-gradient(180deg, #fbbf24 0%, #f59e0b 50%, #d97706 100%)' };
  }
  if (bgColor.includes('red')) {
    return { background: 'linear-gradient(180deg, #dc2626 0%, #b91c1c 50%, #991b1b 100%)' };
  }
  if (bgColor.includes('green')) {
    return { background: 'linear-gradient(180deg, #16a34a 0%, #15803d 50%, #166534 100%)' };
  }
  // Black/zinc
  return { background: 'linear-gradient(180deg, #3f3f46 0%, #27272a 50%, #18181b 100%)' };
};

// Enhanced chip badge component with casino chip styling
interface ChipBadgeProps {
  amount: number;
  isNew: boolean;
  isMobile: boolean;
  style?: React.CSSProperties;
}

const ChipBadge: React.FC<ChipBadgeProps> = ({ amount, isNew, isMobile, style }) => {
  if (amount <= 0) return null;

  return (
    <AnimatePresence mode="popLayout">
      <motion.span
        key={`chip-${amount}`}
        className="absolute rounded-full shadow-lg z-20"
        style={{
          top: style?.top ?? (isMobile ? '-4px' : '-6px'),
          right: style?.right ?? (isMobile ? '-4px' : '-6px'),
          background: 'linear-gradient(135deg, #fde047 0%, #eab308 50%, #ca8a04 100%)',
          fontSize: isMobile ? '9px' : '11px',
          padding: isMobile ? '1px 5px' : '2px 7px',
          fontWeight: 800,
          color: '#1a1a1a',
          border: '2px solid #ca8a04',
          boxShadow: '0 2px 6px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.3)',
          ...style,
        }}
        initial={isNew ? { scale: 0.3, opacity: 0, y: -20 } : false}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{
          type: 'spring',
          stiffness: 500,
          damping: 20,
          mass: 0.8,
        }}
      >
        ${amount.toFixed(2)}
      </motion.span>
    </AnimatePresence>
  );
};

interface BettingCellProps {
  /** Display text for the cell (number or label) */
  label: string;
  /** Background color class */
  bgColor: string;
  /** Current bet amount on this cell */
  amount: number;
  /** Previous bet amount (for tracking new chips) */
  prevAmount?: number;
  /** Whether this cell is a winner */
  isWinner: boolean;
  /** Whether betting is disabled */
  disabled: boolean;
  /** Click handler */
  onClick: () => void;
  /** Optional height class (default h-11/h-12) */
  heightClass?: string;
  /** Optional width class */
  widthClass?: string;
  /** Is mobile layout */
  isMobile?: boolean;
}

// Ripple effect component
interface RippleProps {
  x: number;
  y: number;
  color: string;
  onComplete: () => void;
}

const Ripple: React.FC<RippleProps> = ({ x, y, color, onComplete }) => (
  <motion.span
    className="absolute rounded-full pointer-events-none"
    style={{
      left: x,
      top: y,
      backgroundColor: color,
      transform: 'translate(-50%, -50%)',
    }}
    initial={{ width: 0, height: 0, opacity: 0.6 }}
    animate={{ width: 100, height: 100, opacity: 0 }}
    transition={{ duration: 0.4, ease: 'easeOut' }}
    onAnimationComplete={onComplete}
  />
);


export const BettingCell: React.FC<BettingCellProps> = ({
  label,
  bgColor,
  amount,
  prevAmount = 0,
  isWinner,
  disabled,
  onClick,
  heightClass = 'h-11 md:h-12',
  widthClass = 'flex-1',
  isMobile = true,
}) => {
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number; color: string }[]>([]);
  const rippleIdRef = useRef(0);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [isChipNew, setIsChipNew] = useState(false);
  const prevAmountRef = useRef(amount);

  // Detect new chip placement
  useEffect(() => {
    if (amount > prevAmountRef.current) {
      setIsChipNew(true);
      const timer = setTimeout(() => setIsChipNew(false), 400);
      return () => clearTimeout(timer);
    }
    prevAmountRef.current = amount;
  }, [amount]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;

    // Create ripple at click position
    const button = buttonRef.current;
    if (button) {
      const rect = button.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Determine ripple color based on button background
      let rippleColor = 'rgba(255, 255, 255, 0.4)';
      if (bgColor.includes('red')) {
        rippleColor = 'rgba(255, 200, 200, 0.5)';
      } else if (bgColor.includes('green')) {
        rippleColor = 'rgba(200, 255, 200, 0.5)';
      }

      const rippleId = rippleIdRef.current++;
      setRipples(prev => [...prev, { id: rippleId, x, y, color: rippleColor }]);
    }

    onClick();
  }, [disabled, onClick, bgColor]);

  const removeRipple = useCallback((id: number) => {
    setRipples(prev => prev.filter(r => r.id !== id));
  }, []);

  // Winner highlight ring color
  const winnerRingColor = bgColor.includes('green-600')
    ? 'ring-green-400 shadow-green-500/50'
    : bgColor.includes('red')
    ? 'ring-yellow-400 shadow-yellow-500/50'
    : 'ring-yellow-400 shadow-yellow-500/50';

  return (
    <motion.button
      ref={buttonRef}
      className={`${widthClass} ${heightClass} rounded text-white font-bold flex items-center justify-center relative overflow-hidden border border-zinc-600/50 shadow-inner ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-yellow-500/50'
      } ${isWinner ? `ring-2 ${winnerRingColor} shadow-lg` : ''}`}
      onClick={handleClick}
      disabled={disabled}
      whileHover={disabled ? {} : {
        scale: 1.02,
        boxShadow: '0 0 12px rgba(255, 255, 255, 0.2)',
      }}
      whileTap={disabled ? {} : { scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      style={{
        fontSize: isMobile ? '14px' : '18px',
        ...getBackgroundStyle(bgColor, isWinner),
      }}
    >
      {/* Winner pulse overlay */}
      <AnimatePresence>
        {isWinner && (
          <motion.div
            className={`absolute inset-0 ${bgColor.includes('green-600') ? 'bg-green-400' : bgColor.includes('red') ? 'bg-yellow-400' : 'bg-yellow-400'}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.3, 0] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
      </AnimatePresence>

      {/* Ripple effects */}
      {ripples.map(ripple => (
        <Ripple
          key={ripple.id}
          x={ripple.x}
          y={ripple.y}
          color={ripple.color}
          onComplete={() => removeRipple(ripple.id)}
        />
      ))}

      {/* Label */}
      <motion.span
        className="relative z-10"
        animate={isWinner ? { scale: [1, 1.1, 1] } : {}}
        transition={{ duration: 0.5, repeat: isWinner ? Infinity : 0 }}
      >
        {label}
      </motion.span>

      {/* Chip amount badge */}
      <ChipBadge isNew={isChipNew} amount={amount} isMobile={isMobile} />
    </motion.button>
  );
};

// Zero cell - tall variant
interface ZeroCellProps {
  amount: number;
  isWinner: boolean;
  disabled: boolean;
  onClick: () => void;
  isMobile?: boolean;
}

export const ZeroCell: React.FC<ZeroCellProps> = ({
  amount,
  isWinner,
  disabled,
  onClick,
  isMobile = true,
}) => {
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number; color: string }[]>([]);
  const rippleIdRef = useRef(0);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [isChipNew, setIsChipNew] = useState(false);
  const prevAmountRef = useRef(amount);

  // Detect new chip placement
  useEffect(() => {
    if (amount > prevAmountRef.current) {
      setIsChipNew(true);
      const timer = setTimeout(() => setIsChipNew(false), 400);
      return () => clearTimeout(timer);
    }
    prevAmountRef.current = amount;
  }, [amount]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;

    const button = buttonRef.current;
    if (button) {
      const rect = button.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const rippleId = rippleIdRef.current++;
      setRipples(prev => [...prev, { id: rippleId, x, y, color: 'rgba(200, 255, 200, 0.5)' }]);
    }

    onClick();
  }, [disabled, onClick]);

  const removeRipple = useCallback((id: number) => {
    setRipples(prev => prev.filter(r => r.id !== id));
  }, []);

  return (
    <motion.button
      ref={buttonRef}
      className={`rounded text-white font-bold flex items-center justify-center relative overflow-hidden border border-green-700/50 shadow-inner ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-yellow-500/50'
      } ${isWinner ? 'ring-2 ring-yellow-400 shadow-lg shadow-yellow-500/50' : ''}`}
      style={{
        width: isMobile ? '48px' : '64px',
        height: isMobile ? '132px' : '156px',
        fontSize: isMobile ? '18px' : '22px',
        ...getBackgroundStyle('green', isWinner),
      }}
      onClick={handleClick}
      disabled={disabled}
      whileHover={disabled ? {} : {
        scale: 1.02,
        boxShadow: '0 0 15px rgba(34, 197, 94, 0.4)',
      }}
      whileTap={disabled ? {} : { scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    >
      {/* Winner pulse overlay */}
      <AnimatePresence>
        {isWinner && (
          <motion.div
            className="absolute inset-0 bg-green-400"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.4, 0] }}
            transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
      </AnimatePresence>

      {/* Ripple effects */}
      {ripples.map(ripple => (
        <Ripple
          key={ripple.id}
          x={ripple.x}
          y={ripple.y}
          color={ripple.color}
          onComplete={() => removeRipple(ripple.id)}
        />
      ))}

      {/* Label */}
      <motion.span
        className="relative z-10"
        animate={isWinner ? { scale: [1, 1.15, 1] } : {}}
        transition={{ duration: 0.5, repeat: isWinner ? Infinity : 0 }}
      >
        0
      </motion.span>

      {/* Chip amount badge */}
      <ChipBadge
        isNew={isChipNew}
        amount={amount}
        isMobile={isMobile}
        style={{ top: isMobile ? '4px' : '8px', right: isMobile ? '4px' : '8px' }}
      />
    </motion.button>
  );
};

// Outside bet cell - for dozen/column/even money bets
interface OutsideBetCellProps {
  label: string;
  bgColor: string;
  amount: number;
  isWinner: boolean;
  disabled: boolean;
  onClick: () => void;
  isMobile?: boolean;
  heightClass?: string;
  widthClass?: string;
}

export const OutsideBetCell: React.FC<OutsideBetCellProps> = ({
  label,
  bgColor,
  amount,
  isWinner,
  disabled,
  onClick,
  isMobile = true,
  heightClass = 'h-10 md:h-12',
  widthClass = 'flex-1',
}) => {
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number; color: string }[]>([]);
  const rippleIdRef = useRef(0);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [isChipNew, setIsChipNew] = useState(false);
  const prevAmountRef = useRef(amount);

  // Detect new chip placement
  useEffect(() => {
    if (amount > prevAmountRef.current) {
      setIsChipNew(true);
      const timer = setTimeout(() => setIsChipNew(false), 400);
      return () => clearTimeout(timer);
    }
    prevAmountRef.current = amount;
  }, [amount]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;

    const button = buttonRef.current;
    if (button) {
      const rect = button.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      let rippleColor = 'rgba(255, 255, 255, 0.4)';
      if (bgColor.includes('red')) {
        rippleColor = 'rgba(255, 200, 200, 0.5)';
      }

      const rippleId = rippleIdRef.current++;
      setRipples(prev => [...prev, { id: rippleId, x, y, color: rippleColor }]);
    }

    onClick();
  }, [disabled, onClick, bgColor]);

  const removeRipple = useCallback((id: number) => {
    setRipples(prev => prev.filter(r => r.id !== id));
  }, []);

  // Outside bet cells get a subtle diagonal stripe texture for distinct styling
  const getOutsideBetStyle = (): React.CSSProperties => {
    if (isWinner) {
      return {
        background: 'linear-gradient(180deg, #fbbf24 0%, #f59e0b 50%, #d97706 100%)'
      };
    }
    if (bgColor.includes('red')) {
      return {
        background: `
          linear-gradient(180deg, rgba(220,38,38,0.95) 0%, rgba(185,28,28,0.95) 50%, rgba(153,27,27,0.95) 100%),
          repeating-linear-gradient(
            45deg,
            transparent,
            transparent 4px,
            rgba(255,255,255,0.03) 4px,
            rgba(255,255,255,0.03) 8px
          )
        `.replace(/\s+/g, ' '),
        backgroundBlendMode: 'normal, overlay',
      };
    }
    // Default zinc/dark with diagonal stripe texture
    return {
      background: `
        linear-gradient(180deg, rgba(63,63,70,0.95) 0%, rgba(39,39,42,0.95) 50%, rgba(24,24,27,0.95) 100%),
        repeating-linear-gradient(
          45deg,
          transparent,
          transparent 4px,
          rgba(255,255,255,0.03) 4px,
          rgba(255,255,255,0.03) 8px
        )
      `.replace(/\s+/g, ' '),
      backgroundBlendMode: 'normal, overlay',
    };
  };

  const outsideBetStyle = getOutsideBetStyle();

  // Determine border color based on bet type
  const borderClass = bgColor.includes('red')
    ? 'border-red-800/60'
    : 'border-zinc-500/50';

  return (
    <motion.button
      ref={buttonRef}
      className={`${widthClass} ${heightClass} rounded-md text-white font-bold flex items-center justify-center relative overflow-hidden border-2 ${borderClass} shadow-inner ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-yellow-500/60 hover:shadow-md'
      } ${isWinner ? 'ring-2 ring-green-400 shadow-lg shadow-green-500/50' : ''}`}
      onClick={handleClick}
      disabled={disabled}
      whileHover={disabled ? {} : {
        scale: 1.02,
        boxShadow: '0 0 12px rgba(255, 255, 255, 0.18)',
      }}
      whileTap={disabled ? {} : { scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      style={{
        fontSize: isMobile ? '11px' : '14px',
        letterSpacing: '0.5px',
        textTransform: 'uppercase',
        ...outsideBetStyle,
      }}
    >
      {/* Winner pulse overlay */}
      <AnimatePresence>
        {isWinner && (
          <motion.div
            className="absolute inset-0 bg-green-400"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.25, 0] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
      </AnimatePresence>

      {/* Ripple effects */}
      {ripples.map(ripple => (
        <Ripple
          key={ripple.id}
          x={ripple.x}
          y={ripple.y}
          color={ripple.color}
          onComplete={() => removeRipple(ripple.id)}
        />
      ))}

      {/* Label with enhanced text styling */}
      <motion.span
        className="relative z-10"
        style={{
          textShadow: '0 1px 2px rgba(0,0,0,0.5)',
          fontWeight: 700,
        }}
        animate={isWinner ? { scale: [1, 1.05, 1] } : {}}
        transition={{ duration: 0.6, repeat: isWinner ? Infinity : 0 }}
      >
        {label}
      </motion.span>

      {/* Chip amount badge */}
      <ChipBadge isNew={isChipNew} amount={amount} isMobile={isMobile} />
    </motion.button>
  );
};

export default BettingCell;
