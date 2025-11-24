import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { transferCkUSDT } from '../thunks/transferThunks';

export interface TransferState {
  isTransferring: boolean;
  transferSuccess: boolean;
  transferError: string | null;
  lastTransferId: bigint | null;
  recentTransfers: TransferRecord[];
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
      .addCase(transferCkUSDT.pending, (state) => {
        state.isTransferring = true;
        state.transferError = null;
        state.transferSuccess = false;
      })
      .addCase(transferCkUSDT.fulfilled, (state, action) => {
        state.isTransferring = false;
        state.transferSuccess = true;
        state.lastTransferId = action.payload.blockIndex;
        // Add to recent transfers
        state.recentTransfers.unshift({
          id: action.payload.blockIndex.toString(),
          recipient: action.meta.arg.recipient,
          amount: action.meta.arg.amount,
          fee: BigInt(2), // ckUSDT fee
          blockIndex: action.payload.blockIndex,
          timestamp: new Date(),
          status: 'success',
        });
      })
      .addCase(transferCkUSDT.rejected, (state, action) => {
        state.isTransferring = false;
        state.transferError = action.payload || 'Transfer failed';
        // Add failed transfer to history
        state.recentTransfers.unshift({
          id: `failed-${Date.now()}`,
          recipient: action.meta.arg.recipient,
          amount: action.meta.arg.amount,
          fee: BigInt(2),
          blockIndex: BigInt(0),
          timestamp: new Date(),
          status: 'failed',
        });
      });
  },
});

export const { resetTransferState, addTransferRecord } = transferSlice.actions;
export default transferSlice.reducer;
