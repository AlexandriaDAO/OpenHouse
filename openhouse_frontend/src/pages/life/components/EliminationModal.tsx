/**
 * Elimination Modal Component
 *
 * Displayed when a player's base is destroyed.
 * Provides options to spectate or rejoin the game.
 *
 * CRITICAL FIX: This component receives handlers as props,
 * preventing the stale closure issues that caused
 * unresponsive buttons in the original implementation.
 *
 * Uses Framer Motion for dramatic entrance/exit animations.
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { EliminationStats } from '../state/types';

interface EliminationModalProps {
  isOpen: boolean;
  stats: EliminationStats | null;
  currentBalance: number;
  onSpectate: () => void;
  onRejoin: () => void;
}

export const EliminationModal: React.FC<EliminationModalProps> = ({
  isOpen,
  stats,
  currentBalance,
  onSpectate,
  onRejoin,
}) => {
  // Get elimination reason message
  const getReasonMessage = () => {
    if (!stats) return 'Your base was destroyed!';

    switch (stats.eliminationReason) {
      case 'inactivity':
        return 'You were eliminated due to inactivity.';
      case 'defeated':
        return 'Your base was destroyed!';
      default:
        return 'You have been eliminated.';
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="elimination-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="bg-gray-900 border border-red-500/50 rounded-lg p-6 max-w-sm mx-4 text-center"
            initial={{ scale: 0.8, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: -20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          >
            {/* Skull emoji with shake animation */}
            <motion.div
              className="text-4xl mb-2"
              aria-hidden="true"
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{
                type: 'spring',
                stiffness: 200,
                damping: 15,
                delay: 0.1,
              }}
            >
              💀
            </motion.div>

            {/* Title with dramatic entrance */}
            <motion.h2
              id="elimination-title"
              className="text-2xl font-bold text-red-400 mb-2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              ELIMINATED
            </motion.h2>

            <motion.p
              className="text-gray-400 mb-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              {getReasonMessage()}
            </motion.p>

            {stats && (
              <motion.div
                className="bg-black/50 rounded p-3 mb-4 text-sm text-left"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
              >
                <motion.div
                  className="flex justify-between text-gray-500"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <span>Survived:</span>
                  <span className="text-white">
                    {stats.generationsSurvived.toLocaleString()} gen
                  </span>
                </motion.div>
                <motion.div
                  className="flex justify-between text-gray-500"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.35 }}
                >
                  <span>Peak territory:</span>
                  <span className="text-white">
                    {stats.peakTerritory.toLocaleString()} cells
                  </span>
                </motion.div>
                <motion.div
                  className="flex justify-between text-gray-500"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  <span>Coins earned:</span>
                  <span className={stats.coinsEarned >= 0 ? 'text-green-400' : 'text-red-400'}>
                    {stats.coinsEarned >= 0 ? '+' : ''}{stats.coinsEarned}
                  </span>
                </motion.div>
              </motion.div>
            )}

            <motion.div
              className="text-gray-500 text-sm mb-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.45 }}
            >
              Wallet: <span className="text-green-400">🪙 {currentBalance}</span>
            </motion.div>

            <motion.div
              className="flex gap-3 justify-center"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <motion.button
                type="button"
                onClick={onSpectate}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Spectate
              </motion.button>
              <motion.button
                type="button"
                onClick={onRejoin}
                className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded transition-colors focus:outline-none focus:ring-2 focus:ring-green-500"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Rejoin
              </motion.button>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default EliminationModal;
