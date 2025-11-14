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
      <div className="card max-w-2xl mx-auto p-3">
        <p className="text-center text-gray-400 text-sm">Please log in to manage funds</p>
      </div>
    );
  }

  return (
    <div className="card max-w-2xl mx-auto p-4">
      {/* Compact Balance Display */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-purple-900/10 p-2 rounded border border-purple-500/20">
          <p className="text-xs text-gray-400">Wallet</p>
          <p className="text-sm font-bold text-purple-400">{formatBalance(walletBalance)}</p>
        </div>
        <div className="bg-green-900/10 p-2 rounded border border-green-500/20">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400">Dice</p>
            <ConnectionStatusMini game="dice" />
          </div>
          <p className="text-sm font-bold text-green-400">{formatBalance(gameBalance)}</p>
        </div>
        <div className="bg-yellow-900/10 p-2 rounded border border-yellow-500/20">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400">House</p>
            <ConnectionStatusMini game="dice" />
          </div>
          <p className="text-sm font-bold text-yellow-400">{formatBalance(houseBalance)}</p>
        </div>
      </div>

      {/* Compact Deposit/Withdraw Combined */}
      <div className="flex gap-2 items-end">
        {/* Deposit */}
        <div className="flex-1">
          <input
            type="number"
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
            className="w-full bg-gray-800/50 border border-gray-700/50 rounded px-2 py-1 text-sm"
            placeholder="Deposit"
            min="0.1"
            step="0.01"
            disabled={isDepositing}
          />
        </div>
        <button
          onClick={handleDeposit}
          disabled={isDepositing}
          className="px-3 py-1 bg-purple-600/80 hover:bg-purple-600 rounded text-xs font-bold disabled:opacity-50 transition"
          title="Deposit ICP to Dice Game"
        >
          {isDepositing ? '↓...' : '↓ Deposit'}
        </button>

        {/* Withdraw */}
        <div className="flex-1">
          <input
            type="number"
            value={withdrawAmount}
            onChange={(e) => setWithdrawAmount(e.target.value)}
            className="w-full bg-gray-800/50 border border-gray-700/50 rounded px-2 py-1 text-sm"
            placeholder="Withdraw"
            min="0.1"
            step="0.01"
            disabled={isWithdrawing}
          />
        </div>
        <button
          onClick={handleWithdraw}
          disabled={isWithdrawing}
          className="px-3 py-1 bg-green-600/80 hover:bg-green-600 rounded text-xs font-bold disabled:opacity-50 transition"
          title="Withdraw ICP from Dice Game"
        >
          {isWithdrawing ? '↑...' : '↑ Withdraw'}
        </button>
      </div>

      {/* Compact Messages */}
      {error && (
        <div className="bg-red-900/10 border border-red-500/50 text-red-400 px-2 py-1 rounded mt-2 text-xs">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-900/10 border border-green-500/50 text-green-400 px-2 py-1 rounded mt-2 text-xs">
          {success}
        </div>
      )}
    </div>
  );
};
