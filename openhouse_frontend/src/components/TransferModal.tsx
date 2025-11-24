import React, { useState, useEffect } from 'react';
import { Principal } from '@dfinity/principal';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { transferCkUSDT } from '../store/thunks/transferThunks';
import { resetTransferState } from '../store/slices/transferSlice';
import useLedgerActor from '../hooks/actors/useLedgerActor';
import { DECIMALS_PER_CKUSDT, formatUSDT } from '../types/balance';

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameBalance: bigint;
  onTransferComplete: () => void;
}

export const TransferModal: React.FC<TransferModalProps> = ({
  isOpen,
  onClose,
  gameBalance,
  onTransferComplete,
}) => {
  const dispatch = useAppDispatch();
  const { actor: ledgerActor } = useLedgerActor();
  const { isTransferring, transferSuccess, transferError, lastTransferId } =
    useAppSelector(state => state.transfer);

  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [principalError, setPrincipalError] = useState('');

  // Validate principal
  const validatePrincipal = (value: string): boolean => {
    try {
      if (!value) {
        setPrincipalError('Recipient principal is required');
        return false;
      }
      Principal.fromText(value);
      setPrincipalError('');
      return true;
    } catch {
      setPrincipalError('Invalid Principal ID format');
      return false;
    }
  };

  // Handle transfer
  const handleTransfer = async () => {
    if (!validatePrincipal(recipient)) return;
    if (!ledgerActor) {
      setPrincipalError('Wallet not connected');
      return;
    }

    const amountBigInt = BigInt(Math.floor(parseFloat(amount) * DECIMALS_PER_CKUSDT));

    // Validate amount
    if (amountBigInt < BigInt(1_000_000)) {
      setPrincipalError('Minimum transfer is 1 USDT');
      return;
    }

    if (amountBigInt > gameBalance) {
      setPrincipalError('Insufficient game balance');
      return;
    }

    // Execute transfer via Redux thunk
    dispatch(transferCkUSDT({
      actor: ledgerActor,
      amount: amountBigInt,
      recipient: recipient,
    }));
  };

  // Handle success
  useEffect(() => {
    if (transferSuccess) {
      setTimeout(() => {
        onTransferComplete();
        onClose();
        dispatch(resetTransferState());
      }, 2000);
    }
  }, [transferSuccess]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
        <h2 className="text-2xl font-bold mb-4">Transfer ckUSDT</h2>

        {/* Success State */}
        {transferSuccess && (
          <div className="bg-green-100 text-green-800 p-4 rounded mb-4">
            ✅ Transfer successful!
            <div className="text-sm mt-2">
              Block: {lastTransferId?.toString()}
            </div>
          </div>
        )}

        {/* Error State */}
        {(transferError || principalError) && (
          <div className="bg-red-100 text-red-800 p-4 rounded mb-4">
            ❌ {transferError || principalError}
          </div>
        )}

        {/* Form */}
        {!transferSuccess && (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Recipient Principal ID
              </label>
              <input
                type="text"
                value={recipient}
                onChange={(e) => {
                  setRecipient(e.target.value);
                  validatePrincipal(e.target.value);
                }}
                className="w-full p-2 border rounded"
                placeholder="xxxxx-xxxxx-xxxxx..."
                disabled={isTransferring}
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Amount (USDT)
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full p-2 border rounded"
                placeholder="0.00"
                min="1"
                step="0.01"
                disabled={isTransferring}
              />
              <div className="text-sm text-gray-500 mt-1">
                Available: {formatUSDT(gameBalance)} USDT
              </div>
            </div>

            <div className="text-sm text-gray-500 mb-4">
              Transfer fee: 0.000002 USDT
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleTransfer}
                disabled={isTransferring || !recipient || !amount}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {isTransferring ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Transferring...
                  </span>
                ) : (
                  'Transfer'
                )}
              </button>

              <button
                onClick={() => {
                  onClose();
                  dispatch(resetTransferState());
                }}
                disabled={isTransferring}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-100"
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
