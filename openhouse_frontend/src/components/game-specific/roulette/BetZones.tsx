import { TABLE_LAYOUT } from './constants';

interface BetZonesProps {
  onBetClick: (zoneId: string) => void;
  hoveredZone: string | null;
  onHover: (zoneId: string | null) => void;
  winningZones: string[];
}

export function BetZones({ onBetClick, hoveredZone, onHover, winningZones }: BetZonesProps) {
  const { GRID, ZERO } = TABLE_LAYOUT;
  
  const getZoneClass = (zoneId: string, isOverlay = false) => {
    let classes = "cursor-pointer transition-colors ";
    if (hoveredZone === zoneId) classes += "fill-white/30 ";
    else classes += isOverlay ? "fill-transparent " : "fill-transparent ";
    
    if (winningZones.includes(zoneId)) classes += "fill-dfinity-turquoise/30 animate-pulse ";
    return classes;
  };

  return (
    <g className="bet-zones">
       {/* Zero */}
       <rect
         x={ZERO.X} y={ZERO.Y} width={ZERO.WIDTH} height={ZERO.HEIGHT}
         className={getZoneClass('straight-0')}
         onClick={() => onBetClick('straight-0')}
         onMouseEnter={() => onHover('straight-0')}
         onMouseLeave={() => onHover(null)}
       />
       
       {/* Straights (Numbers) */}
       {Array.from({ length: 36 }, (_, i) => {
         const num = i + 1;
         const col = Math.floor((num - 1) / 3);
         const row = 2 - ((num - 1) % 3);
         const x = GRID.X + col * GRID.CELL_WIDTH;
         const y = GRID.Y + row * GRID.CELL_HEIGHT;
         
         return (
           <rect
             key={`straight-${num}`}
             x={x} y={y} width={GRID.CELL_WIDTH} height={GRID.CELL_HEIGHT}
             className={getZoneClass(`straight-${num}`)}
             onClick={() => onBetClick(`straight-${num}`)}
             onMouseEnter={() => onHover(`straight-${num}`)}
             onMouseLeave={() => onHover(null)}
           />
         );
       })}
       
       {/* Outside Bets */}
       {['column-3', 'column-2', 'column-1'].map((zoneId, i) => {
          const x = GRID.X + 12 * GRID.CELL_WIDTH;
          const y = GRID.Y + i * GRID.CELL_HEIGHT;
          return <rect key={zoneId} x={x} y={y} width={GRID.CELL_WIDTH} height={GRID.CELL_HEIGHT} className={getZoneClass(zoneId)} onClick={() => onBetClick(zoneId)} onMouseEnter={() => onHover(zoneId)} onMouseLeave={() => onHover(null)} />;
       })}
       
       {['dozen-1', 'dozen-2', 'dozen-3'].map((zoneId, i) => {
         const x = GRID.X + i * (4 * GRID.CELL_WIDTH);
         const y = GRID.Y + 3 * GRID.CELL_HEIGHT;
         return <rect key={zoneId} x={x} y={y} width={4 * GRID.CELL_WIDTH} height={GRID.CELL_HEIGHT} className={getZoneClass(zoneId)} onClick={() => onBetClick(zoneId)} onMouseEnter={() => onHover(zoneId)} onMouseLeave={() => onHover(null)} />;
       })}
       
       {[
         { zone: 'low', x: 0 }, { zone: 'even', x: 2 }, { zone: 'red', x: 4 },
         { zone: 'black', x: 6 }, { zone: 'odd', x: 8 }, { zone: 'high', x: 10 }
       ].map((item) => {
         const x = GRID.X + item.x * GRID.CELL_WIDTH;
         const y = GRID.Y + 4 * GRID.CELL_HEIGHT;
         return <rect key={item.zone} x={x} y={y} width={2 * GRID.CELL_WIDTH} height={GRID.CELL_HEIGHT} className={getZoneClass(item.zone)} onClick={() => onBetClick(item.zone)} onMouseEnter={() => onHover(item.zone)} onMouseLeave={() => onHover(null)} />;
       })}

       {/* Splits (Horizontal) - Between columns */}
       {/* 11 gaps between 12 columns. 3 rows. */}
       {Array.from({ length: 11 }, (_, c) => {
         return Array.from({ length: 3 }, (_, r) => {
           // Numbers involved:
           // Col c, row r (e.g. 1) and Col c+1, row r (e.g. 4)
           // Num1 formula: col*3 + (3-row) -> c*3 + (3-r)
           // Num2: (c+1)*3 + (3-r)
           const num1 = c * 3 + (3 - r);
           const num2 = (c + 1) * 3 + (3 - r);
           const zoneId = `split-${num1}-${num2}`;
           
           const x = GRID.X + (c + 1) * GRID.CELL_WIDTH - 5; // Centered on line
           const y = GRID.Y + r * GRID.CELL_HEIGHT + 5;
           
           return (
             <rect
               key={zoneId}
               x={x} y={y} width={10} height={GRID.CELL_HEIGHT - 10}
               className={getZoneClass(zoneId, true)}
               onClick={(e) => { e.stopPropagation(); onBetClick(zoneId); }}
               onMouseEnter={() => onHover(zoneId)}
               onMouseLeave={() => onHover(null)}
             />
           );
         });
       })}
       
       {/* Splits (Vertical) - Between rows */}
       {/* 12 cols, 2 gaps between 3 rows */}
       {Array.from({ length: 12 }, (_, c) => {
         return Array.from({ length: 2 }, (_, r) => {
           // Row r and r+1.
           // Num1: c*3 + (3-r)
           // Num2: c*3 + (3-(r+1))
           const num1 = c * 3 + (3 - r); // Higher number (physically higher in table logic but lower row index?)
           // Wait, row 0 is top (3,6,9). row 1 is middle (2,5,8).
           // Gap between row 0 and 1 is split between 3 and 2.
           const topNum = c * 3 + (3 - r);
           const botNum = c * 3 + (3 - (r + 1));
           // Split usually noted as min-max
           const zoneId = `split-${botNum}-${topNum}`;
           
           const x = GRID.X + c * GRID.CELL_WIDTH + 5;
           const y = GRID.Y + (r + 1) * GRID.CELL_HEIGHT - 5;
           
           return (
             <rect
               key={zoneId}
               x={x} y={y} width={GRID.CELL_WIDTH - 10} height={10}
               className={getZoneClass(zoneId, true)}
               onClick={(e) => { e.stopPropagation(); onBetClick(zoneId); }}
               onMouseEnter={() => onHover(zoneId)}
               onMouseLeave={() => onHover(null)}
             />
           );
         });
       })}

       {/* Corners (Quad) */}
       {/* Intersection of col c/c+1 and row r/r+1 */}
       {Array.from({ length: 11 }, (_, c) => {
         return Array.from({ length: 2 }, (_, r) => {
           // Corner of (c,r), (c+1,r), (c,r+1), (c+1,r+1)
           // Numbers:
           // TL: c*3 + (3-r)  (e.g. 3)
           // TR: (c+1)*3 + (3-r) (e.g. 6)
           // BL: c*3 + (3-(r+1)) (e.g. 2)
           // BR: (c+1)*3 + (3-(r+1)) (e.g. 5)
           // Usually corner ID is the top-left number (min or max? types.rs says 'Corner(u8)').
           // Actually types.rs says "Square of 4 (top-left number)". Top-left in physical board?
           // If board is horizontal:
           // 3 6
           // 2 5
           // 1 4
           // Intersection of 1,2,4,5. Top left is 2? Or 1?
           // Usually it's the smallest number. Let's use the smallest number for ID.
           const numBL = c * 3 + (3 - (r + 1)); // e.g. 2 (if c=0, r=0, this is 2? No. r=0 is top row.)
           // Row 0 is top. r=0. Gap between row 0 and 1.
           // c=0. Row 0 is 3. Row 1 is 2.
           // c=1. Row 0 is 6. Row 1 is 5.
           // Corner: 2,3,5,6. Smallest is 2.
           // Wait, backend says "Corner(u8)".
           // Let's use the smallest number for the ID `corner-${min}`.
           const n1 = c * 3 + (3 - r);
           const n2 = (c + 1) * 3 + (3 - r);
           const n3 = c * 3 + (3 - (r + 1));
           const n4 = (c + 1) * 3 + (3 - (r + 1));
           const min = Math.min(n1, n2, n3, n4);
           
           const zoneId = `corner-${min}`;
           
           const x = GRID.X + (c + 1) * GRID.CELL_WIDTH - 6;
           const y = GRID.Y + (r + 1) * GRID.CELL_HEIGHT - 6;
           
           return (
             <rect
               key={zoneId}
               x={x} y={y} width={12} height={12}
               className={getZoneClass(zoneId, true) + " rounded-full"}
               onClick={(e) => { e.stopPropagation(); onBetClick(zoneId); }}
               onMouseEnter={() => onHover(zoneId)}
               onMouseLeave={() => onHover(null)}
             />
           );
         });
       })}
    </g>
  );
}
