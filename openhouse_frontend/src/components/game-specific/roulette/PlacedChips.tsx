import { getChipPosition } from './utils';
import { formatUSDT } from '../../../types/balance';

interface PlacedChipsProps {
  bets: Array<{ zoneId: string, amount: bigint }>;
  onChipClick: (zoneId: string) => void;
}

export function PlacedChips({ bets, onChipClick }: PlacedChipsProps) {
  // Group bets by zoneId
  const betsByZone = bets.reduce((acc, bet) => {
    acc[bet.zoneId] = (acc[bet.zoneId] || 0n) + bet.amount;
    return acc;
  }, {} as Record<string, bigint>);

  // Helper: Get chip color based on amount
  const getChipColor = (amount: bigint): string => {
    // 1e8 = 1 USDT
    if (amount < 100000000n) return '#FFF'; // < 1
    if (amount < 1000000000n) return '#ED0047'; // 1-10
    if (amount < 10000000000n) return '#00E19B'; // 10-100
    if (amount < 100000000000n) return '#00BFFF'; // 100-1000
    return '#000'; // > 1000
  };

  return (
    <g className="placed-chips">
      {Object.entries(betsByZone).map(([zoneId, totalAmount]) => {
        const { x, y } = getChipPosition(zoneId);

        return (
          <g key={zoneId} transform={`translate(${x}, ${y})`} className="cursor-pointer" onClick={(e) => { e.stopPropagation(); onChipClick(zoneId); }}>
            {/* Shadow */}
            <circle r={14} fill="rgba(0,0,0,0.5)" cx={2} cy={2} />
            
            {/* Chip */}
            <circle
              r={14}
              fill={getChipColor(totalAmount)}
              stroke="#FFF"
              strokeWidth={2}
              className="hover:opacity-80 transition-opacity"
            />
            
            {/* Dashed border for style */}
            <circle r={11} fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth={1} strokeDasharray="2 2" />

            {/* Amount text */}
            <text
              textAnchor="middle"
              y={4}
              fontSize={9}
              fontWeight="bold"
              fill={getChipColor(totalAmount) === '#FFF' ? 'black' : 'white'}
              className="font-mono select-none"
            >
              {/* Simple format: 1, 0.5, 10 */}
              {formatUSDT(totalAmount).replace('USDT', '').replace('$', '').trim()}
            </text>
          </g>
        );
      })}
    </g>
  );
}
