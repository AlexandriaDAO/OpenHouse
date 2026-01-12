import React from 'react';
import { motion } from 'framer-motion';

interface GameButtonProps {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  label: string;
  loadingLabel?: string;
  variant?: 'primary' | 'secondary' | 'danger';
  fullWidth?: boolean;
  icon?: string;
}

export const GameButton: React.FC<GameButtonProps> = ({
  onClick,
  disabled = false,
  loading = false,
  label,
  loadingLabel,
  variant = 'primary',
  fullWidth = true,
  icon,
}) => {
  const getButtonStyles = () => {
    const base = `font-mono font-bold py-4 text-xl transition border-2 ${fullWidth ? 'w-full' : ''}`;

    switch (variant) {
      case 'primary':
        // DFINITY turquoise terminal button
        return `${base} bg-transparent border-dfinity-turquoise text-dfinity-turquoise
                hover:bg-dfinity-turquoise hover:text-pure-black
                disabled:border-pure-white/20 disabled:text-pure-white/20`;
      case 'secondary':
        // Purple variant
        return `${base} bg-transparent border-dfinity-purple text-dfinity-purple
                hover:bg-dfinity-purple hover:text-pure-white
                disabled:border-pure-white/20 disabled:text-pure-white/20`;
      case 'danger':
        // Red variant
        return `${base} bg-transparent border-dfinity-red text-dfinity-red
                hover:bg-dfinity-red hover:text-pure-white
                disabled:border-pure-white/20 disabled:text-pure-white/20`;
      default:
        return base;
    }
  };

  const isDisabled = disabled || loading;

  return (
    <motion.button
      onClick={onClick}
      disabled={isDisabled}
      className={getButtonStyles()}
      whileHover={isDisabled ? undefined : { scale: 1.02 }}
      whileTap={isDisabled ? undefined : { scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    >
      {loading ? (
        <>
          {icon && <span className="mr-2">{icon}</span>}
          {loadingLabel || `${label}...`}
        </>
      ) : (
        <>
          {icon && <span className="mr-2">{icon}</span>}
          {label}
        </>
      )}
    </motion.button>
  );
};