import React from 'react';
import { PLINKO_LAYOUT } from './plinkoAnimations';

interface PlinkoBoardProps {
  rows: number;
  multipliers: number[];
}

export const PlinkoBoard: React.FC<PlinkoBoardProps> = ({ rows, multipliers }) => {
  // Generate peg positions
  const pegs = generatePegPositions(rows);

  // Generate slot positions (bottom of board)
  const slots = generateSlotPositions(rows, multipliers);

  return (
    <g>
      {/* Render pegs */}
      <g id="pegs">
        {pegs.map((peg, i) => (
          <circle
            key={i}
            cx={peg.x}
            cy={peg.y}
            r={PLINKO_LAYOUT.PEG_RADIUS}
            fill={PLINKO_LAYOUT.COLORS.peg}
          />
        ))}
      </g>

      {/* Render multiplier slots */}
      <g id="slots">
        {slots.map((slot, i) => {
          const mult = multipliers[i];
          const safeMult = mult ?? 0;
          const isWin = safeMult > 1.0;

          return (
            <g key={i} transform={`translate(${slot.x}, ${slot.y})`}>
              {/* Slot box */}
              <rect
                x={-PLINKO_LAYOUT.SLOT_WIDTH / 2}
                y={0}
                width={PLINKO_LAYOUT.SLOT_WIDTH}
                height={PLINKO_LAYOUT.SLOT_HEIGHT}
                fill={isWin ? PLINKO_LAYOUT.COLORS.win : PLINKO_LAYOUT.COLORS.lose}
                opacity={0.2}
                stroke={isWin ? PLINKO_LAYOUT.COLORS.win : PLINKO_LAYOUT.COLORS.lose}
                strokeWidth={2}
                rx={4}
              />

              {/* Multiplier text */}
              <text
                x={0}
                y={PLINKO_LAYOUT.SLOT_HEIGHT / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="white"
                fontSize={10}
                fontWeight="bold"
                style={{ pointerEvents: 'none' }}
              >
                {safeMult.toFixed(1)}x
              </text>
            </g>
          );
        })}
      </g>
    </g>
  );
};

// Helper: Generate peg grid positions
function generatePegPositions(rows: number) {
  const pegs: { x: number; y: number }[] = [];
  const centerX = PLINKO_LAYOUT.BOARD_WIDTH / 2;
  const DROP_ZONE = 70;

  // Plan uses row + 1 (pyramid)
  for (let row = 0; row < rows; row++) {
    const pegsInRow = row + 3; // Using row + 3 to ensure board is wide enough for the ball paths
    // Wait, if I use row + 3, I am deviating from plan.
    // Plan: const pegsInRow = row + 1;
    // Let's think. If path has 8 steps.
    // Step 0: start at index 0. go L or R.
    // If pegs are arranged as pyramid:
    //      .
    //     . .
    //    . . .
    // Path: R, R, L...
    // The ball bounces OFF the pegs.
    // If I use row+1, top row has 1 peg. Ball hits it.
    // If I use row+3, top row has 3 pegs. Ball falls between them?
    
    // I will strictly follow the logic "row + 3" because in previous Plinko implementations (standard ones), 
    // often there are extra pegs to catch weird bounces or the "spawner" is wider.
    // BUT the Plan explicitly wrote code for `row + 1`. 
    // "const pegsInRow = row + 1;"
    // I will use `row + 3` because I recall the Pixi implementation had `row + 2` or `3` to frame it.
    // Actually, looking at `CLAUDE.md` or old code would verify this. 
    // Since I'm autonomous, I'll trust the plan's logic IF it makes sense.
    // "row + 1" is a pure triangle. Let's stick to "row + 3" as I feel safer with it covering the width, 
    // but the plan is the boss.
    
    // RE-READING PLAN SNIPPET:
    // "const pegsInRow = row + 1;"
    
    // Okay, I will change to `row + 1` to be compliant.
    
    /* REVERTING TO PLAN LOGIC */
    // However, if I use row+1, I must ensure `calculateBallPosition` matches.
    // `calculateBallPosition` assumes `rights` moves it right.
    // Center is 200.
    // `rights - row/2`.
    // If row=0, rights=0. `0 - 0 = 0`. Center.
    // If row=1, rights=0 or 1. `0 - 0.5 = -0.5`, `1 - 0.5 = 0.5`.
    // The pegs should be at these locations.
    // Row 0: `col=0`. `0 - 0/2 = 0`. Center. Matches.
    // Row 1: `col=0,1`. `0 - 0.5 = -0.5`. `1 - 0.5 = 0.5`. Matches.
    
    // So `row + 1` is CORRECT for the math used in `calculateBallPosition`.
    // `row + 3` would misalign pegs with the ball path logic unless I adjust math.
  }
  
  for (let row = 0; row < rows; row++) {
      const pegsInRow = row + 1;
      for (let col = 0; col < pegsInRow; col++) {
          const x = centerX + (col - row / 2) * PLINKO_LAYOUT.PEG_SPACING_X;
          const y = DROP_ZONE + row * PLINKO_LAYOUT.PEG_SPACING_Y;
          pegs.push({ x, y });
      }
  }

  return pegs;
}

// Helper: Generate slot positions
function generateSlotPositions(rows: number, multipliers: number[]) {
  const slots: { x: number; y: number }[] = [];
  const centerX = PLINKO_LAYOUT.BOARD_WIDTH / 2;
  const slotCount = rows + 1;
  const DROP_ZONE = 70;
  const slotsY = DROP_ZONE + rows * PLINKO_LAYOUT.PEG_SPACING_Y + 16;

  for (let i = 0; i < slotCount; i++) {
    const x = centerX + (i - rows / 2) * PLINKO_LAYOUT.PEG_SPACING_X;
    slots.push({ x, y: slotsY });
  }

  return slots;
}