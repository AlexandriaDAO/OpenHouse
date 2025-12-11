import { motion, AnimatePresence } from 'framer-motion';
import { useEffect } from 'react';
import { formatUSDT } from '../../../types/balance';
import type { SpinResult } from '../../declarations/roulette_backend/roulette_backend.did';
import { getNumberColor } from './constants';

interface RouletteResultPopupProps {
  show: boolean;
  spinResult: SpinResult | null;
  onHide: () => void;
}

export function RouletteResultPopup({ show, spinResult, onHide }: RouletteResultPopupProps) {
  useEffect(() => {
    if (show) {
      const timer = setTimeout(onHide, 3000);
      return () => clearTimeout(timer);
    }
  }, [show, onHide]);

  if (!spinResult) return null;

  const isWin = spinResult.net_result > 0n;

  // Handle color enum which might be object or string depending on codegen
  const colorStr = typeof spinResult.color === 'string' 
    ? spinResult.color 
    : Object.keys(spinResult.color)[0];

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          className="fixed inset-0 flex items-center justify-center pointer-events-none z-50"
        >
          <div className={`
            bg-black/90 backdrop-blur-xl
            border-2 ${isWin ? 'border-dfinity-green' : 'border-dfinity-red'}
            rounded-2xl px-12 py-8
            shadow-2xl flex flex-col items-center gap-4
            min-w-[300px]
          `}>
            {/* Winning number */}
            <div className="flex flex-col items-center">
              <div 
                className="text-7xl font-bold font-mono drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]" 
                style={{ color: getNumberColor(spinResult.winning_number) }}
              >
                {spinResult.winning_number}
              </div>
              <div className="text-xl text-gray-400 mt-2 font-mono uppercase tracking-widest">
                {colorStr}
              </div>
            </div>

            <div className="w-full h-px bg-white/10" />

            {/* Net result */}
            <div className="text-center">
              <div className={`text-4xl font-bold font-mono ${isWin ? 'text-dfinity-green drop-shadow-[0_0_10px_rgba(0,225,155,0.5)]' : 'text-dfinity-red'}`}>
                {isWin ? '+' : ''}{formatUSDT(spinResult.net_result)}
              </div>
              <div className="text-sm text-gray-500 mt-2 font-mono">
                PAYOUT: {formatUSDT(spinResult.total_payout)}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
