import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { transferFromGame, fetchGameTransferHistory } from '../thunks/transferThunks';

export interface TransferState {
  isTransferring: boolean;
  transferSuccess: boolean;
  transferError: string | null;
  lastTransferId: bigint | null;
  recentTransfers: TransferRecord[];
  isLoadingHistory: boolean;
}

export interface TransferRecord {
  id: string;
  recipient: string;
  amount: bigint;
  fee: bigint;
  blockIndex: bigint;
  timestamp: Date;
  status: 'pending' | 'success' | 'failed';
}

const initialState: TransferState = {
  isTransferring: false,
  transferSuccess: false,
  transferError: null,
  lastTransferId: null,
  recentTransfers: [],
  isLoadingHistory: false,
};

const transferSlice = createSlice({
  name: 'transfer',
  initialState,
  reducers: {
    resetTransferState: (state) => {
      state.transferSuccess = false;
      state.transferError = null;
      state.isTransferring = false;
    },
    addTransferRecord: (state, action: PayloadAction<TransferRecord>) => {
      state.recentTransfers.unshift(action.payload);
      // Keep only last 20 transfers
      if (state.recentTransfers.length > 20) {
        state.recentTransfers.pop();
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Execute Transfer
      .addCase(transferFromGame.pending, (state) => {
        state.isTransferring = true;
        state.transferError = null;
        state.transferSuccess = false;
      })
      .addCase(transferFromGame.fulfilled, (state, action) => {
        state.isTransferring = false;
        state.transferSuccess = true;
        state.lastTransferId = action.payload.blockIndex;
        // Add to recent transfers
        state.recentTransfers.unshift({
          id: action.payload.blockIndex.toString(),
          recipient: action.meta.arg.recipient,
          amount: action.meta.arg.amount,
          fee: BigInt(2), // ckUSDT fee (approx)
          blockIndex: action.payload.blockIndex,
          timestamp: new Date(),
          status: 'success',
        });
      })
      .addCase(transferFromGame.rejected, (state, action) => {
        state.isTransferring = false;
        state.transferError = action.payload || 'Transfer failed';
      })
      // Fetch History
      .addCase(fetchGameTransferHistory.pending, (state) => {
        state.isLoadingHistory = true;
      })
      .addCase(fetchGameTransferHistory.fulfilled, (state, action) => {
        state.isLoadingHistory = false;
        state.recentTransfers = action.payload;
      })
      .addCase(fetchGameTransferHistory.rejected, (state) => {
        state.isLoadingHistory = false;
      });
  },
});

export const { resetTransferState, addTransferRecord } = transferSlice.actions;
export default transferSlice.reducer;
