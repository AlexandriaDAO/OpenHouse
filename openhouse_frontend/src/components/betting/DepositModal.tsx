import { createPortal } from 'react-dom';
import { formatUSDT } from '../../types/balance';
import type { DepositFlowState } from './types';

interface DepositModalProps {
  deposit: DepositFlowState;
}

export function DepositModal({ deposit }: DepositModalProps) {
  const {
    closeModal,
    depositAmount,
    setDepositAmount,
    handleDeposit,
    depositStep,
    isDepositing,
    error,
    success,
    walletBalance,
  } = deposit;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={closeModal}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-sm w-full shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold mb-4 text-white">Buy Chips</h3>

        <div className="mb-6">
          <label className="block text-sm text-gray-400 mb-2">Amount (USDT)</label>
          <div className="relative">
            <input
              type="number"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              className="w-full bg-black/50 border border-gray-600 rounded-lg px-4 py-3 text-white text-lg focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500/50 transition"
              placeholder="1.0"
              min="1"
              step="1"
              disabled={isDepositing}
              autoFocus
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-mono">USDT</span>
          </div>
          <div className="flex justify-between items-center mt-2 text-xs text-gray-500">
            <span>Wallet: {formatUSDT(walletBalance)}</span>
            <span>Min: 1 USDT</span>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-900/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 bg-green-900/20 border border-green-500/30 rounded-lg text-green-400 text-sm">
            {success}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={closeModal}
            disabled={isDepositing}
            className="flex-1 px-4 py-3 font-bold text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition"
          >
            Cancel
          </button>
          <button
            onClick={handleDeposit}
            disabled={isDepositing}
            className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {isDepositing ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                {depositStep === 'approving' ? 'Approving...' : 'Depositing...'}
              </span>
            ) : (
              'Confirm'
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
