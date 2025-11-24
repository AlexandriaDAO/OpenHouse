import React, { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { useGameBalance } from '../providers/GameBalanceProvider';
import { transferFromGame, fetchGameTransferHistory } from '../store/thunks/transferThunks';
import { resetTransferState } from '../store/slices/transferSlice';
import useDiceActor from '../hooks/actors/useDiceActor';
import { DECIMALS_PER_CKUSDT, formatUSDT } from '../types/balance';
import { TransferHistory } from '../components/TransferHistory';
import { Principal } from '@dfinity/principal';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WalletModal: React.FC<WalletModalProps> = ({ isOpen, onClose }) => {
  const dispatch = useAppDispatch();
  const { actor: diceActor } = useDiceActor();
  const { balance: diceBalance, refresh: refreshDice } = useGameBalance('dice');
  const { isTransferring, transferSuccess, transferError, lastTransferId } = useAppSelector(state => state.transfer);

  const [activeTab, setActiveTab] = useState<'balances' | 'transfer'>('balances');
  const [selectedGame, setSelectedGame] = useState<'dice'>('dice'); // Only dice supported for now
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');

  // Fetch history on mount
  useEffect(() => {
    if (isOpen && diceActor) {
      dispatch(fetchGameTransferHistory({ actor: diceActor }));
    }
  }, [isOpen, diceActor, dispatch]);

  // Handle Transfer
  const handleTransfer = async () => {
    if (!diceActor) {
      setError('Wallet not connected');
      return;
    }

    if (!recipient || !amount) {
      setError('Please fill in all fields');
      return;
    }

    try {
      Principal.fromText(recipient);
    } catch {
      setError('Invalid recipient principal');
      return;
    }

    const amountBigInt = BigInt(Math.floor(parseFloat(amount) * DECIMALS_PER_CKUSDT));
    if (amountBigInt < BigInt(1_000_000)) {
      setError('Minimum transfer is 1 USDT');
      return;
    }

    if (amountBigInt > diceBalance.game) {
      setError('Insufficient balance');
      return;
    }

    dispatch(transferFromGame({
      actor: diceActor,
      gameType: 'dice',
      amount: amountBigInt,
      recipient
    }));
  };

  // Success handling
  useEffect(() => {
    if (transferSuccess) {
      refreshDice();
      setTimeout(() => {
        dispatch(resetTransferState());
        onClose();
      }, 2000);
    }
  }, [transferSuccess, refreshDice, dispatch, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-lg w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-700 bg-gray-800">
          <h2 className="text-xl font-bold text-white">Wallet Manager</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700">
          <button
            onClick={() => setActiveTab('balances')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'balances' ? 'text-dfinity-turquoise border-b-2 border-dfinity-turquoise bg-gray-800' : 'text-gray-400 hover:text-white'
            }`}
          >
            Balances
          </button>
          <button
            onClick={() => setActiveTab('transfer')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'transfer' ? 'text-dfinity-turquoise border-b-2 border-dfinity-turquoise bg-gray-800' : 'text-gray-400 hover:text-white'
            }`}
          >
            Transfer / Withdraw
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {activeTab === 'balances' && (
            <div className="space-y-4">
              <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-bold text-white">Dice Game Balance</h3>
                  <button
                    onClick={() => setActiveTab('transfer')}
                    className="text-xs bg-dfinity-turquoise text-black px-2 py-1 rounded hover:bg-opacity-90"
                  >
                    Withdraw
                  </button>
                </div>
                <p className="text-2xl font-mono text-dfinity-turquoise">{formatUSDT(diceBalance.game)}</p>
              </div>
              
              {/* Placeholder for other games */}
              <div className="text-center text-gray-500 text-sm py-4">
                More game wallets coming soon...
              </div>

              <div className="border-t border-gray-700 pt-4">
                 <h3 className="text-sm font-bold text-gray-400 mb-2">Recent Transfers</h3>
                 <TransferHistory />
              </div>
            </div>
          )}

          {activeTab === 'transfer' && (
            <div className="space-y-4">
              {transferSuccess ? (
                <div className="bg-green-900/20 border border-green-500 text-green-400 p-4 rounded text-center">
                  <p className="font-bold text-lg">Transfer Successful! ✅</p>
                  <p className="text-sm mt-1">Block: {lastTransferId?.toString()}</p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">From</label>
                    <select 
                      value={selectedGame}
                      className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white"
                      disabled
                    >
                      <option value="dice">Dice Game Wallet ({formatUSDT(diceBalance.game)})</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-1">To (Principal ID)</label>
                    <input
                      type="text"
                      value={recipient}
                      onChange={e => setRecipient(e.target.value)}
                      className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white font-mono text-sm"
                      placeholder="aaaaa-aa..."
                      disabled={isTransferring}
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Amount (USDT)</label>
                    <input
                      type="number"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white"
                      placeholder="0.00"
                      min="1"
                      step="0.1"
                      disabled={isTransferring}
                    />
                  </div>

                  {(error || transferError) && (
                    <div className="text-red-400 text-sm bg-red-900/20 p-2 rounded border border-red-900/50">
                      {error || transferError}
                    </div>
                  )}

                  <button
                    onClick={handleTransfer}
                    disabled={isTransferring}
                    className="w-full bg-dfinity-turquoise text-black font-bold py-3 rounded hover:bg-opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    {isTransferring ? 'Transferring...' : 'Send Funds'}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
