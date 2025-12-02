import React from 'react';

interface LoadingModalProps {
  isOpen: boolean;
  title?: string;
  message?: string;
}

export const LoadingModal: React.FC<LoadingModalProps> = ({
  isOpen,
  title = "Processing...",
  message = "Please wait while we process your transaction."
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="bg-gray-900 border border-pure-white/20 rounded-lg p-8 max-w-md w-full mx-4">
        {/* Animated spinner */}
        <div className="flex justify-center mb-4">
          <div className="animate-spin h-12 w-12 border-4 border-dfinity-turquoise border-t-transparent rounded-full" />
        </div>

        <h3 className="text-xl font-bold text-pure-white text-center mb-2">{title}</h3>
        <p className="text-gray-400 text-center">{message}</p>
      </div>
    </div>
  );
};
