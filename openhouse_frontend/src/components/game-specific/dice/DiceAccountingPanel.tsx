import React, { useState } from 'react';
import { useAuth } from '../../../providers/AuthProvider';
import { useBalance } from '../../../providers/BalanceProvider';
import { useGameBalance } from '../../../providers/GameBalanceProvider';
import { ConnectionStatusMini } from '../../ui/ConnectionStatus';
import useDiceActor from '../../../hooks/actors/useDiceActor';

interface DiceAccountingPanelProps {
  gameBalance: bigint;  // Now required, not nullable
  onBalanceChange: () => void;
}

export const DiceAccountingPanel: React.FC<DiceAccountingPanelProps> = ({
  gameBalance,
  onBalanceChange,
}) => {
  const { isAuthenticated } = useAuth();
  const { balance: walletBalance, refreshBalance } = useBalance();
  const { actor } = useDiceActor();

  // Get house balance from global state
  const gameBalanceContext = useGameBalance('dice');
  const houseBalance = gameBalanceContext.balance.house;

  const [depositAmount, setDepositAmount] = useState('0.1');
  const [withdrawAmount, setWithdrawAmount] = useState('0.1');
  const [isDepositing, setIsDepositing] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Handle deposit
  const handleDeposit = async () => {
    if (!actor || !isAuthenticated) return;

    setIsDepositing(true);
    setError(null);
    setSuccess(null);

    try {
      const amountE8s = BigInt(Math.floor(parseFloat(depositAmount) * 100_000_000));

      // Validate amount
      if (amountE8s < BigInt(10_000_000)) {
        setError('Minimum deposit is 0.1 ICP');
        setIsDepositing(false);
        return;
      }

      if (walletBalance && amountE8s > walletBalance) {
        setError('Insufficient wallet balance');
        setIsDepositing(false);
        return;
      }

      // Call deposit
      const result = await actor.deposit(amountE8s);

      if ('Ok' in result) {
        const newBalance = result.Ok;
        setSuccess(`Deposited ${depositAmount} ICP! New balance: ${Number(newBalance) / 100_000_000} ICP`);
        setDepositAmount('0.1');

        // Refresh all balances
        await refreshBalance(); // Wallet balance
        onBalanceChange(); // Game balance (triggers global refresh)
      } else {
        setError(result.Err);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Deposit failed');
    } finally {
      setIsDepositing(false);
    }
  };

  // Handle withdraw
  const handleWithdraw = async () => {
    if (!actor || !isAuthenticated) return;

    setIsWithdrawing(true);
    setError(null);
    setSuccess(null);

    try {
      const amountE8s = BigInt(Math.floor(parseFloat(withdrawAmount) * 100_000_000));

      // Validate amount
      if (amountE8s < BigInt(10_000_000)) {
        setError('Minimum withdrawal is 0.1 ICP');
        setIsWithdrawing(false);
        return;
      }

      if (gameBalance && amountE8s > gameBalance) {
        setError('Insufficient game balance');
        setIsWithdrawing(false);
        return;
      }

      // Call withdraw
      const result = await actor.withdraw(amountE8s);

      if ('Ok' in result) {
        const newBalance = result.Ok;
        setSuccess(`Withdrew ${withdrawAmount} ICP! New balance: ${Number(newBalance) / 100_000_000} ICP`);
        setWithdrawAmount('0.1');

        // Refresh all balances
        await refreshBalance(); // Wallet balance
        onBalanceChange(); // Game balance (triggers global refresh)
      } else {
        setError(result.Err);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Withdrawal failed');
    } finally {
      setIsWithdrawing(false);
    }
  };

  // Format balances
  const formatBalance = (e8s: bigint | null): string => {
    if (e8s === null) return '0.00000000';
    return (Number(e8s) / 100_000_000).toFixed(8);
  };

  if (!isAuthenticated) {
    return (
      <div className="card max-w-2xl mx-auto">
        <p className="text-center text-gray-400">Please log in to manage funds</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900/50 border-b border-gray-700 px-4 py-2">
      {/* SINGLE ROW WITH ALL BALANCES + QUICK ACTIONS */}
      <div className="flex items-center justify-between max-w-6xl mx-auto">

        {/* LEFT: Compact Balance Display */}
        <div className="flex gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-gray-400">Wallet:</span>
            <span className="font-mono text-purple-400">{formatBalance(walletBalance)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-400">Game:</span>
            <span className="font-mono text-green-400">{formatBalance(gameBalance)}</span>
            <ConnectionStatusMini game="dice" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-400">House:</span>
            <span className="font-mono text-yellow-400">{formatBalance(houseBalance)}</span>
          </div>
        </div>

        {/* RIGHT: Quick Deposit/Withdraw Buttons with Inline Inputs */}
        <div className="flex gap-2">
          {/* Compact Deposit */}
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              className="w-20 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm"
              placeholder="0.1"
              min="0.1"
              step="0.01"
              disabled={isDepositing}
            />
            <button
              onClick={handleDeposit}
              disabled={isDepositing}
              className="px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded text-sm disabled:opacity-50"
            >
              {isDepositing ? '...' : 'Deposit'}
            </button>
          </div>

          {/* Compact Withdraw */}
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              className="w-20 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm"
              placeholder="0.1"
              min="0.1"
              step="0.01"
              disabled={isWithdrawing}
            />
            <button
              onClick={handleWithdraw}
              disabled={isWithdrawing}
              className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm disabled:opacity-50"
            >
              {isWithdrawing ? '...' : 'Withdraw'}
            </button>
          </div>
        </div>
      </div>

      {/* Inline error/success messages */}
      {(error || success) && (
        <div className="max-w-6xl mx-auto mt-1">
          {error && <span className="text-red-400 text-xs">{error}</span>}
          {success && <span className="text-green-400 text-xs">{success}</span>}
        </div>
      )}
    </div>
  );
};
