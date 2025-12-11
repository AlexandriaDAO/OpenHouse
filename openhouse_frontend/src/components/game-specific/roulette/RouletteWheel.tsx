import { WheelCanvas } from './WheelCanvas';

interface RouletteWheelProps {
  targetNumber: number | null;
  isSpinning: boolean;
  onSpinComplete: () => void;
}

export function RouletteWheel({ targetNumber, isSpinning, onSpinComplete }: RouletteWheelProps) {
  return (
    <div className="relative flex justify-center items-center py-4">
      {/* Canvas wheel */}
      <WheelCanvas
        targetNumber={targetNumber}
        isSpinning={isSpinning}
        onSpinComplete={onSpinComplete}
      />

      {/* Winning number display (overlay) */}
      {targetNumber !== null && !isSpinning && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-black/80 px-6 py-3 rounded-lg border border-dfinity-turquoise z-10 pointer-events-none backdrop-blur-sm">
          <div className="text-4xl font-bold text-white font-mono shadow-[0_0_10px_rgba(57,255,20,0.5)]">
            {targetNumber}
          </div>
        </div>
      )}
      
      {/* Arrow/Marker at top */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 translate-y-2 z-20">
        <div className="w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-t-[20px] border-t-dfinity-turquoise filter drop-shadow-[0_0_8px_rgba(57,255,20,1)]"></div>
      </div>
    </div>
  );
}
