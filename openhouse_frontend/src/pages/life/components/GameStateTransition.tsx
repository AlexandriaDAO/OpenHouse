/**
 * Game State Transition Components
 *
 * Provides smooth animated transitions between game phases:
 * - Login → Region Selection → Slot Selection → Game View
 *
 * Uses Framer Motion AnimatePresence for exit animations
 * and coordinated enter/exit transitions.
 */

import React from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';

// Animation variants for different transition types
export const fadeSlideVariants: Variants = {
  initial: {
    opacity: 0,
    y: 20,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.46, 0.45, 0.94], // easeOutQuad
    },
  },
  exit: {
    opacity: 0,
    y: -20,
    transition: {
      duration: 0.3,
      ease: [0.55, 0.06, 0.68, 0.19], // easeInQuad
    },
  },
};

export const scaleVariants: Variants = {
  initial: {
    opacity: 0,
    scale: 0.95,
  },
  animate: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.3,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: {
      duration: 0.25,
      ease: [0.55, 0.06, 0.68, 0.19],
    },
  },
};

export const modalVariants: Variants = {
  initial: {
    opacity: 0,
    scale: 0.9,
    y: 20,
  },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 25,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.9,
    y: 20,
    transition: {
      duration: 0.2,
    },
  },
};

export const backdropVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
};

// Stagger children animations
export const staggerContainerVariants: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
  exit: {
    transition: {
      staggerChildren: 0.03,
      staggerDirection: -1,
    },
  },
};

export const staggerItemVariants: Variants = {
  initial: { opacity: 0, y: 15 },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 25,
    },
  },
  exit: {
    opacity: 0,
    y: -10,
    transition: { duration: 0.15 },
  },
};

interface GameStateWrapperProps {
  children: React.ReactNode;
  stateKey: string;
  className?: string;
  variants?: Variants;
}

/**
 * Wrapper component for animating game state transitions.
 * Wrap each game phase (login, region selection, etc.) with this component.
 */
export const GameStateWrapper: React.FC<GameStateWrapperProps> = ({
  children,
  stateKey,
  className = '',
  variants = fadeSlideVariants,
}) => {
  return (
    <motion.div
      key={stateKey}
      className={className}
      variants={variants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      {children}
    </motion.div>
  );
};

interface AnimatedModalProps {
  isOpen: boolean;
  onClose?: () => void;
  children: React.ReactNode;
  className?: string;
  backdropClassName?: string;
  closeOnBackdrop?: boolean;
}

/**
 * Animated modal wrapper with backdrop fade and content scale animation.
 */
export const AnimatedModal: React.FC<AnimatedModalProps> = ({
  isOpen,
  onClose,
  children,
  className = '',
  backdropClassName = '',
  closeOnBackdrop = true,
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className={`fixed inset-0 z-[100] flex items-center justify-center ${backdropClassName}`}
          variants={backdropVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          onClick={closeOnBackdrop ? onClose : undefined}
        >
          <motion.div
            className={className}
            variants={modalVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

interface GamePhaseContainerProps {
  children: React.ReactNode;
  currentPhase: 'login' | 'region' | 'slot' | 'game' | 'spectator';
}

/**
 * Container that manages AnimatePresence for game phase transitions.
 * Pass different children based on current phase.
 */
export const GamePhaseContainer: React.FC<GamePhaseContainerProps> = ({
  children,
  currentPhase,
}) => {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={currentPhase}
        className="w-full h-full"
        variants={fadeSlideVariants}
        initial="initial"
        animate="animate"
        exit="exit"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
};

/**
 * Animated button with hover and tap effects.
 */
interface AnimatedButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
}

export const AnimatedButton: React.FC<AnimatedButtonProps> = ({
  children,
  variant = 'primary',
  className = '',
  ...props
}) => {
  return (
    <motion.button
      className={className}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      {...props}
    >
      {children}
    </motion.button>
  );
};

/**
 * Animated grid item for region/quadrant selection.
 */
interface AnimatedGridItemProps {
  children: React.ReactNode;
  index: number;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  style?: React.CSSProperties;
}

export const AnimatedGridItem: React.FC<AnimatedGridItemProps> = ({
  children,
  index,
  className = '',
  onClick,
  disabled,
  style,
}) => {
  return (
    <motion.button
      className={className}
      style={style}
      onClick={onClick}
      disabled={disabled}
      variants={staggerItemVariants}
      whileHover={disabled ? {} : { scale: 1.05, y: -4 }}
      whileTap={disabled ? {} : { scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    >
      {children}
    </motion.button>
  );
};

export default {
  GameStateWrapper,
  AnimatedModal,
  GamePhaseContainer,
  AnimatedButton,
  AnimatedGridItem,
  fadeSlideVariants,
  scaleVariants,
  modalVariants,
  backdropVariants,
  staggerContainerVariants,
  staggerItemVariants,
};
