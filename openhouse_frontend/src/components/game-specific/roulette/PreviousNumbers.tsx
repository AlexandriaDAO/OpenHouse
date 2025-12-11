import React, { useRef } from 'react';

interface PreviousNumbersProps {
  numbers: { number: number; color: 'Red' | 'Black' | 'Green' }[];
}

const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

export const PreviousNumbers: React.FC<PreviousNumbersProps> = ({ numbers }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [numbers]);

  return (
    <div className="w-full bg-black/30 rounded-lg p-2 border border-gray-800">
      <div className="text-xs text-gray-400 mb-1 px-1">PREVIOUS SPINS:</div>
      <div
        ref={scrollRef}
        className="flex gap-1 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent"
        style={{ scrollBehavior: 'smooth' }}
      >
        {numbers.length === 0 ? (
          <span className="text-gray-600 text-xs px-2">No spins yet</span>
        ) : (
          numbers.map((item, idx) => {
            const bgColor = item.number === 0
              ? 'bg-green-600'
              : RED_NUMBERS.includes(item.number)
              ? 'bg-red-600'
              : 'bg-black border border-white';

            return (
              <div
                key={`prev-${idx}`}
                className={`flex-shrink-0 w-8 h-8 ${bgColor} rounded text-white text-sm font-bold flex items-center justify-center`}
              >
                {item.number}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
