import { createAsyncThunk } from '@reduxjs/toolkit';
import { Principal } from '@dfinity/principal';
import { TransferRecord } from '../slices/transferSlice';
import { _SERVICE as DiceActor } from '../../types/dice-backend';

// We need a generic way to pass the game actor
// For now, we only support Dice, so we type it as DiceActor
// In future, we can use a union type or interface that all game backends implement
type GameActor = DiceActor;

interface TransferFromGameArgs {
  actor: GameActor;
  gameType: 'dice'; // Add other games later
  amount: bigint;
  recipient: string;
}

interface TransferResult {
  blockIndex: bigint;
  timestamp: bigint;
}

export const transferFromGame = createAsyncThunk<
  TransferResult,
  TransferFromGameArgs,
  { rejectValue: string }
>(
  'transfer/executeFromGame',
  async ({ actor, amount, recipient }, { rejectWithValue }) => {
    try {
      // Validate recipient principal
      let recipientPrincipal: Principal;
      try {
        recipientPrincipal = Principal.fromText(recipient);
      } catch {
        return rejectWithValue('Invalid recipient principal ID');
      }

      // Execute transfer on backend
      // The backend handles amount validation and balance checks
      const result = await actor.transfer_to_wallet(amount, recipientPrincipal);

      if ('Ok' in result) {
        return {
          blockIndex: result.Ok,
          timestamp: BigInt(Date.now()), // Backend doesn't return timestamp in result, but it logs it
        };
      } else {
        return rejectWithValue(result.Err);
      }
    } catch (error) {
      console.error('Game transfer error:', error);
      if (error instanceof Error) {
        return rejectWithValue(error.message);
      }
      return rejectWithValue('An unexpected error occurred during transfer');
    }
  }
);

export const fetchGameTransferHistory = createAsyncThunk<
  TransferRecord[],
  { actor: GameActor },
  { rejectValue: string }
>(
  'transfer/fetchGameHistory',
  async ({ actor }, { rejectWithValue }) => {
    try {
      const history = await actor.get_transfer_history(20);
      return history.map((record) => ({
        id: record.block_index.toString(), // Use block index as ID
        recipient: record.recipient.toString(),
        amount: record.amount,
        fee: BigInt(0), // Fee is internal/deducted
        blockIndex: record.block_index,
        timestamp: new Date(Number(record.timestamp) / 1_000_000), // Convert nanoseconds to Date
        status: 'success' as const,
      }));
    } catch (error) {
      console.error('Failed to fetch transfer history:', error);
      return rejectWithValue('Failed to load transfer history');
    }
  }
);