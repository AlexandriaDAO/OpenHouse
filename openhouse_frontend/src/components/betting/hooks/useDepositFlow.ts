import { useState, useCallback } from 'react';
import { Principal } from '@dfinity/principal';
import { DECIMALS_PER_CKUSDT, TRANSFER_FEE } from '../../../types/balance';
import { ApproveArgs } from '../../../types/ledger';
import { DepositFlowState, DepositStep, BettingRailProps } from '../types';

export function useDepositFlow(props: BettingRailProps): DepositFlowState {
  const {
    gameActor,
    ledgerActor,
    canisterId,
    walletBalance,
    gameBalance,
    onBalanceRefresh,
  } = props;

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [depositAmount, setDepositAmount] = useState('1');

  // Transaction state
  const [depositStep, setDepositStep] = useState<DepositStep>('idle');
  const [isDepositing, setIsDepositing] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  // Feedback
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const clearMessages = useCallback(() => {
    setError(null);
    setSuccess(null);
  }, []);

  const openModal = useCallback(() => {
    clearMessages();
    setShowModal(true);
  }, [clearMessages]);

  const closeModal = useCallback(() => {
    if (!isDepositing) {
      setShowModal(false);
      clearMessages();
    }
  }, [isDepositing, clearMessages]);

  // Deposit: Approve → Transfer
  const handleDeposit = useCallback(async () => {
    if (!gameActor || !ledgerActor) return;

    setIsDepositing(true);
    clearMessages();

    try {
      const amount = BigInt(Math.floor(parseFloat(depositAmount) * DECIMALS_PER_CKUSDT));

      // Validate minimum
      if (amount < BigInt(1_000_000)) {
        setError('Minimum deposit is 1 USDT');
        setIsDepositing(false);
        return;
      }

      // Validate balance
      if (walletBalance && amount > walletBalance) {
        setError('Insufficient wallet balance');
        setIsDepositing(false);
        return;
      }

      // Step 1: Approve
      setDepositStep('approving');
      const approveArgs: ApproveArgs = {
        spender: {
          owner: Principal.fromText(canisterId),
          subaccount: [],
        },
        amount: amount + BigInt(TRANSFER_FEE),
        fee: [],
        memo: [],
        from_subaccount: [],
        created_at_time: [],
        expected_allowance: [],
        expires_at: [],
      };

      const approveResult = await ledgerActor.icrc2_approve(approveArgs);

      if ('Err' in approveResult) {
        setError(`Approval failed: ${JSON.stringify(approveResult.Err)}`);
        setIsDepositing(false);
        setDepositStep('idle');
        return;
      }

      // Step 2: Deposit
      setDepositStep('depositing');
      const result = await gameActor.deposit(amount);

      if ('Ok' in result) {
        setSuccess(`Bought ${depositAmount} USDT in chips!`);
        setDepositAmount('1');
        setShowModal(false);
        onBalanceRefresh();
      } else {
        setError(result.Err);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Deposit failed');
    } finally {
      setIsDepositing(false);
      setDepositStep('idle');
    }
  }, [gameActor, ledgerActor, canisterId, depositAmount, walletBalance, onBalanceRefresh, clearMessages]);

  // Withdraw all chips
  const handleWithdrawAll = useCallback(async () => {
    if (!gameActor) return;

    setIsWithdrawing(true);
    clearMessages();

    try {
      const result = await gameActor.withdraw_all();

      if ('Ok' in result) {
        const newBalance = result.Ok;
        const withdrawnAmount = (Number(gameBalance) - Number(newBalance)) / DECIMALS_PER_CKUSDT;
        setSuccess(`Cashed out ${withdrawnAmount.toFixed(2)} USDT!`);
        onBalanceRefresh();
      } else {
        setError(result.Err);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Withdrawal failed');
    } finally {
      setIsWithdrawing(false);
    }
  }, [gameActor, gameBalance, onBalanceRefresh, clearMessages]);

  return {
    // Modal
    showModal,
    openModal,
    closeModal,

    // Deposit
    depositAmount,
    setDepositAmount,
    handleDeposit,
    depositStep,
    isDepositing,

    // Withdraw
    handleWithdrawAll,
    isWithdrawing,

    // Feedback
    error,
    success,
    clearMessages,

    // Context
    walletBalance,
    gameBalance,
  };
}
