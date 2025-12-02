import React from 'react';

interface ErrorModalProps {
  isOpen: boolean;
  title?: string;
  message: string;
  onClose: () => void;
}

export const ErrorModal: React.FC<ErrorModalProps> = ({
  isOpen,
  title = "Error",
  message,
  onClose
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="bg-gray-900 border border-red-500/30 rounded-lg p-8 max-w-md w-full mx-4">
        {/* Error icon */}
        <div className="flex justify-center mb-4">
          <div className="h-16 w-16 rounded-full bg-red-500/20 flex items-center justify-center">
            <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        </div>

        <h3 className="text-xl font-bold text-pure-white text-center mb-2">{title}</h3>
        <p className="text-gray-400 text-center mb-6">{message}</p>

        <button
          onClick={onClose}
          className="w-full py-3 bg-red-500/20 hover:bg-red-500/30 text-red-500 font-bold rounded transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
};
