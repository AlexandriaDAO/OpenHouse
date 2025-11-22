import React, { useState } from 'react';

interface InfoTooltipProps {
  content: string;
}

export function InfoTooltip({ content }: InfoTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="relative inline-block">
      <button
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onClick={() => setIsVisible(!isVisible)}
        className="text-gray-400 hover:text-gray-300 cursor-help"
        type="button"
      >
        ⓘ
      </button>

      {isVisible && (
        <div className="absolute z-50 left-0 top-6 w-64 p-3 bg-gray-900 border border-gray-700 rounded shadow-lg text-xs text-gray-300 whitespace-pre-line">
          {content}
          <div className="absolute -top-1 left-2 w-2 h-2 bg-gray-900 border-l border-t border-gray-700 transform rotate-45" />
        </div>
      )}
    </div>
  );
}
