import { TABLE_LAYOUT, getNumberColor } from './constants';

export function TableGrid() {
  const { GRID, ZERO } = TABLE_LAYOUT;
  
  return (
    <g className="table-grid">
       {/* Zero */}
       <rect
         x={ZERO.X} y={ZERO.Y}
         width={ZERO.WIDTH} height={ZERO.HEIGHT}
         className="fill-dfinity-green/20 stroke-white/20"
       />
       <text
         x={ZERO.X + ZERO.WIDTH/2} y={ZERO.Y + ZERO.HEIGHT/2}
         textAnchor="middle" dominantBaseline="middle"
         className="fill-white font-mono font-bold"
       >0</text>
       
       {/* Numbers */}
       {Array.from({ length: 36 }, (_, i) => {
         const num = i + 1;
         const col = Math.floor((num - 1) / 3);
         const row = 2 - ((num - 1) % 3);
         const x = GRID.X + col * GRID.CELL_WIDTH;
         const y = GRID.Y + row * GRID.CELL_HEIGHT;
         
         return (
           <g key={num}>
             <rect
               x={x} y={y}
               width={GRID.CELL_WIDTH} height={GRID.CELL_HEIGHT}
               fill={getNumberColor(num)}
               className="stroke-white/20"
             />
             <text
               x={x + GRID.CELL_WIDTH/2} y={y + GRID.CELL_HEIGHT/2}
               textAnchor="middle" dominantBaseline="middle"
               className="fill-white font-mono font-bold"
             >{num}</text>
           </g>
         );
       })}
       
       {/* Columns (2 to 1) */}
       {['2 to 1', '2 to 1', '2 to 1'].map((label, i) => {
         // Top to bottom: Row 0, 1, 2. But i=0 is top, which corresponds to Col 3 (3,6,9...)
         // Wait, Col 3 is top row (row 0). Col 1 is bottom row (row 2).
         // The labels usually align with the row.
         const x = GRID.X + 12 * GRID.CELL_WIDTH;
         const y = GRID.Y + i * GRID.CELL_HEIGHT;
         return (
            <g key={`col-${i}`}>
              <rect x={x} y={y} width={GRID.CELL_WIDTH} height={GRID.CELL_HEIGHT} className="fill-transparent stroke-white/20" />
              <text x={x + GRID.CELL_WIDTH/2} y={y + GRID.CELL_HEIGHT/2} className="fill-white text-[10px]" textAnchor="middle" dominantBaseline="middle">{label}</text>
            </g>
         );
       })}
       
       {/* Dozens */}
       {['1st 12', '2nd 12', '3rd 12'].map((label, i) => {
         const x = GRID.X + i * (4 * GRID.CELL_WIDTH);
         const y = GRID.Y + 3 * GRID.CELL_HEIGHT;
         return (
            <g key={`doz-${i}`}>
              <rect x={x} y={y} width={4 * GRID.CELL_WIDTH} height={GRID.CELL_HEIGHT} className="fill-transparent stroke-white/20" />
              <text x={x + (2 * GRID.CELL_WIDTH)} y={y + GRID.CELL_HEIGHT/2} className="fill-white font-bold" textAnchor="middle" dominantBaseline="middle">{label}</text>
            </g>
         );
       })}
       
       {/* Simple Bets */}
       {[
         { label: '1-18', x: 0 }, { label: 'EVEN', x: 2 }, { label: 'RED', x: 4, fill: '#ED0047' },
         { label: 'BLACK', x: 6, fill: '#000000' }, { label: 'ODD', x: 8 }, { label: '19-36', x: 10 }
       ].map((item, i) => {
         const x = GRID.X + item.x * GRID.CELL_WIDTH;
         const y = GRID.Y + 4 * GRID.CELL_HEIGHT;
         return (
            <g key={`simple-${i}`}>
              <rect x={x} y={y} width={2 * GRID.CELL_WIDTH} height={GRID.CELL_HEIGHT} fill={item.fill || 'transparent'} className="stroke-white/20" />
              <text x={x + GRID.CELL_WIDTH} y={y + GRID.CELL_HEIGHT/2} className="fill-white font-bold" textAnchor="middle" dominantBaseline="middle">{item.label}</text>
            </g>
         );
       })}
    </g>
  );
}
