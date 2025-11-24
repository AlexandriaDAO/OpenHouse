import { createAsyncThunk } from '@reduxjs/toolkit';
import { ActorSubclass } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import { ICPLedgerService, TransferArg } from '../../types/ledger';
import { TransferRecord } from '../slices/transferSlice';

interface TransferCkUSDTArgs {
  actor: ActorSubclass<ICPLedgerService>;
  amount: bigint;
  recipient: string;
  memo?: Uint8Array;
}

interface TransferResult {
  blockIndex: bigint;
  fee: bigint;
  timestamp: bigint;
}

export const transferCkUSDT = createAsyncThunk<
  TransferResult,
  TransferCkUSDTArgs,
  { rejectValue: string }
>(
  'transfer/executeCkUSDTTransfer',
  async ({ actor, amount, recipient, memo }, { rejectWithValue }) => {
    try {
      // Validate recipient principal
      let recipientPrincipal: Principal;
      try {
        recipientPrincipal = Principal.fromText(recipient);
      } catch {
        return rejectWithValue('Invalid recipient principal ID');
      }

      // Validate amount (minimum 1 USDT)
      if (amount < BigInt(1_000_000)) {
        return rejectWithValue('Minimum transfer is 1 USDT');
      }

      // Build ICRC-1 transfer args
      const transferArgs: TransferArg = {
        to: {
          owner: recipientPrincipal,
          subaccount: [],
        },
        amount: amount,
        fee: [], // Uses default fee
        memo: memo ? [Array.from(memo)] : [],
        from_subaccount: [],
        created_at_time: [],
      };

      // Execute transfer
      const result = await actor.icrc1_transfer(transferArgs);

      if ('Ok' in result) {
        return {
          blockIndex: result.Ok,
          fee: BigInt(2), // ckUSDT fee
          timestamp: BigInt(Date.now() * 1_000_000), // Nanoseconds
        };
      } else {
        // Handle specific error types
        const error = result.Err;
        if ('InsufficientFunds' in error) {
          return rejectWithValue(`Insufficient funds. Balance: ${error.InsufficientFunds.balance}`);
        } else if ('BadFee' in error) {
          return rejectWithValue(`Invalid fee. Expected: ${error.BadFee.expected_fee}`);
        } else if ('TooOld' in error) {
          return rejectWithValue('Transaction too old');
        } else if ('Duplicate' in error) {
          return rejectWithValue(`Duplicate transaction: ${error.Duplicate.duplicate_of}`);
        } else {
          return rejectWithValue('Transfer failed: Unknown error');
        }
      }
    } catch (error) {
      console.error('Transfer error:', error);
      if (error instanceof Error) {
        return rejectWithValue(error.message);
      }
      return rejectWithValue('An unexpected error occurred during transfer');
    }
  }
);

// Get transfer history from backend
export const fetchTransferHistory = createAsyncThunk<
  TransferRecord[],
  { actor: ActorSubclass<any> },
  { rejectValue: string }
>(
  'transfer/fetchHistory',
  async ({ actor }, { rejectWithValue }) => {
    try {
      const history = await actor.get_transfer_history(20);
      return history.map((record: any) => ({
        id: record.block_index.toString(),
        recipient: record.to.toString(),
        amount: record.amount,
        fee: record.fee,
        blockIndex: record.block_index,
        timestamp: new Date(Number(record.timestamp) / 1_000_000),
        status: 'success' as const,
      }));
    } catch (error) {
      console.error('Failed to fetch transfer history:', error);
      return rejectWithValue('Failed to load transfer history');
    }
  }
);

