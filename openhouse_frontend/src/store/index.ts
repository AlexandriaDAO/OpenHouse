import { configureStore } from '@reduxjs/toolkit';
import transferReducer from './slices/transferSlice';

export const store = configureStore({
  reducer: {
    transfer: transferReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore BigInt serialization warnings
        ignoredActions: ['transfer/executeCkUSDTTransfer/fulfilled', 'transfer/fetchHistory/fulfilled'],
        ignoredPaths: ['transfer.amount', 'transfer.recentTransfers'],
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
