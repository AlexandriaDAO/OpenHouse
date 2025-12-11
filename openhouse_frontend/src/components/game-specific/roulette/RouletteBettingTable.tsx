import { TableGrid } from './TableGrid';
import { BetZones } from './BetZones';
import { PlacedChips } from './PlacedChips';

interface RouletteBettingTableProps {
  placedBets: Array<{ zoneId: string, amount: bigint }>;
  onBetClick: (zoneId: string) => void;
  onChipClick: (zoneId: string) => void;
  hoveredZone: string | null;
  onHover: (zoneId: string | null) => void;
  winningZones: string[];
}

export function RouletteBettingTable(props: RouletteBettingTableProps) {
  return (
    <div className="relative w-full max-w-5xl mx-auto overflow-hidden rounded-xl border border-white/10 bg-black/40 shadow-2xl">
      <svg viewBox="0 0 800 400" className="w-full h-auto select-none">
        {/* Static table layout */}
        <TableGrid />

        {/* Clickable bet zones */}
        <BetZones
          onBetClick={props.onBetClick}
          hoveredZone={props.hoveredZone}
          onHover={props.onHover}
          winningZones={props.winningZones}
        />

        {/* Visual chips on bets */}
        <PlacedChips
          bets={props.placedBets}
          onChipClick={props.onChipClick}
        />
      </svg>
    </div>
  );
}
