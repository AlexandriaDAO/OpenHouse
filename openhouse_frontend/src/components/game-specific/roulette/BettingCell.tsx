import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

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

// Chip drop animation component
interface ChipDropProps {
  isNew: boolean;
  amount: number;
  isMobile: boolean;
}

const ChipDrop: React.FC<ChipDropProps> = ({ isNew, amount, isMobile }) => {
  if (amount <= 0) return null;

  return (
    <AnimatePresence mode="popLayout">
      <motion.span
        key={`chip-${amount}`}
        className={`absolute ${isMobile ? '-top-1 -right-1' : '-top-1 -right-1'} bg-yellow-500 text-black font-bold rounded-full shadow-lg z-20`}
        style={{
          fontSize: isMobile ? '8px' : '12px',
          padding: isMobile ? '0 4px' : '2px 6px',
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
      className={`${widthClass} ${heightClass} ${bgColor} rounded text-white font-bold flex items-center justify-center relative overflow-hidden ${
        disabled ? 'opacity-50 cursor-not-allowed' : ''
      } ${isWinner ? `ring-2 ${winnerRingColor} shadow-lg` : ''}`}
      onClick={handleClick}
      disabled={disabled}
      whileHover={disabled ? {} : {
        scale: 1.02,
        boxShadow: '0 0 12px rgba(255, 255, 255, 0.2)',
      }}
      whileTap={disabled ? {} : { scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      style={isMobile ? { fontSize: '14px' } : { fontSize: '18px' }}
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
      <ChipDrop isNew={isChipNew} amount={amount} isMobile={isMobile} />
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
      className={`bg-green-600 rounded text-white font-bold flex items-center justify-center relative overflow-hidden ${
        disabled ? 'opacity-50 cursor-not-allowed' : ''
      } ${isWinner ? 'ring-2 ring-yellow-400 shadow-lg shadow-yellow-500/50' : ''}`}
      style={{
        width: isMobile ? '48px' : '64px',
        height: isMobile ? '132px' : '156px',
        fontSize: isMobile ? '18px' : '22px',
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
      {amount > 0 && (
        <motion.span
          className={`absolute bg-yellow-500 text-black font-bold rounded-full shadow-lg z-20`}
          style={{
            top: isMobile ? '4px' : '8px',
            right: isMobile ? '4px' : '8px',
            fontSize: isMobile ? '8px' : '12px',
            padding: isMobile ? '0 4px' : '2px 6px',
          }}
          initial={isChipNew ? { scale: 0.3, opacity: 0, y: -15 } : false}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{
            type: 'spring',
            stiffness: 500,
            damping: 20,
          }}
        >
          ${amount.toFixed(2)}
        </motion.span>
      )}
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

  return (
    <motion.button
      ref={buttonRef}
      className={`${widthClass} ${heightClass} ${bgColor} rounded text-white font-bold flex items-center justify-center relative overflow-hidden ${
        disabled ? 'opacity-50 cursor-not-allowed' : ''
      } ${isWinner ? 'ring-2 ring-green-400 shadow-lg shadow-green-500/50' : ''}`}
      onClick={handleClick}
      disabled={disabled}
      whileHover={disabled ? {} : {
        scale: 1.02,
        boxShadow: '0 0 10px rgba(255, 255, 255, 0.15)',
      }}
      whileTap={disabled ? {} : { scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      style={{ fontSize: isMobile ? '10px' : '14px' }}
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

      {/* Label */}
      <motion.span
        className="relative z-10"
        animate={isWinner ? { scale: [1, 1.05, 1] } : {}}
        transition={{ duration: 0.6, repeat: isWinner ? Infinity : 0 }}
      >
        {label}
      </motion.span>

      {/* Chip amount badge */}
      {amount > 0 && (
        <motion.span
          className="absolute -top-1 -right-1 bg-yellow-500 text-black font-bold rounded-full shadow-lg z-20"
          style={{
            fontSize: isMobile ? '8px' : '12px',
            padding: isMobile ? '0 4px' : '2px 6px',
          }}
          initial={isChipNew ? { scale: 0.3, opacity: 0, y: -15 } : false}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{
            type: 'spring',
            stiffness: 500,
            damping: 20,
          }}
        >
          ${amount.toFixed(2)}
        </motion.span>
      )}
    </motion.button>
  );
};

export default BettingCell;
