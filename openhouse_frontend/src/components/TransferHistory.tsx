import React from 'react';
import { useAppSelector } from '../store/hooks';
import { formatUSDT } from '../types/balance';

export const TransferHistory: React.FC = () => {
  const { recentTransfers } = useAppSelector(state => state.transfer);

  if (recentTransfers.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        No recent transfers
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-lg font-semibold mb-3">Recent Transfers</h3>
      {recentTransfers.map((transfer) => (
        <div
          key={transfer.id}
          className={`p-3 rounded border ${
            transfer.status === 'success'
              ? 'border-green-200 bg-green-50'
              : transfer.status === 'failed'
              ? 'border-red-200 bg-red-50'
              : 'border-yellow-200 bg-yellow-50'
          }`}
        >
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <div className="font-medium">
                {formatUSDT(transfer.amount)} USDT
              </div>
              <div className="text-sm text-gray-600 truncate">
                To: {transfer.recipient.slice(0, 8)}...{transfer.recipient.slice(-5)}
              </div>
              <div className="text-xs text-gray-500">
                {transfer.timestamp.toLocaleString()}
              </div>
            </div>
            <div className="text-sm">
              {transfer.status === 'success' && (
                <span className="text-green-600">✓</span>
              )}
              {transfer.status === 'failed' && (
                <span className="text-red-600">✗</span>
              )}
              {transfer.status === 'pending' && (
                <span className="text-yellow-600">⏳</span>
              )}
            </div>
          </div>
          {transfer.blockIndex > 0 && (
            <div className="text-xs text-gray-500 mt-1">
              Block: {transfer.blockIndex.toString()}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
