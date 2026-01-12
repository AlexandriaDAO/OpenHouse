import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouletteAnimation } from './useRouletteAnimation';
import {
  WHEEL_NUMBERS,
  SEGMENTS,
  SEGMENT_ANGLE,
  DIMENSIONS as D,
  COLORS,
  isRed,
} from './rouletteConstants';

// Get gradient ID for pocket based on number
const getPocketGradient = (num: number): string => {
  if (num === 0) return 'url(#pocketGreenGradient)';
  return isRed(num) ? 'url(#pocketRedGradient)' : 'url(#pocketBlackGradient)';
};

interface RouletteWheelProps {
  winningNumber: number | null;
  isWaitingForResult: boolean;
  isLanding: boolean;
  onAnimationComplete?: () => void;
}

// Convert polar to cartesian coordinates
const polarToCartesian = (angle: number, radius: number): [number, number] => {
  const rad = (angle - 90) * (Math.PI / 180); // Start from top
  return [
    D.CENTER + radius * Math.cos(rad),
    D.CENTER + radius * Math.sin(rad),
  ];
};

// Create SVG path for a pie segment
const createSegmentPath = (index: number, innerR: number, outerR: number): string => {
  const startAngle = index * SEGMENT_ANGLE;
  const endAngle = startAngle + SEGMENT_ANGLE;

  const [x1, y1] = polarToCartesian(startAngle, outerR);
  const [x2, y2] = polarToCartesian(endAngle, outerR);
  const [x3, y3] = polarToCartesian(endAngle, innerR);
  const [x4, y4] = polarToCartesian(startAngle, innerR);

  return `M ${x1} ${y1} A ${outerR} ${outerR} 0 0 1 ${x2} ${y2} L ${x3} ${y3} A ${innerR} ${innerR} 0 0 0 ${x4} ${y4} Z`;
};

export const RouletteWheel: React.FC<RouletteWheelProps> = ({
  winningNumber,
  isWaitingForResult,
  isLanding,
  onAnimationComplete,
}) => {
  const { ballAngle, wheelAngle, ballRadius, showResult, ballSpeed, wobbleOffset, bouncePhase } = useRouletteAnimation({
    winningNumber,
    isSpinning: isWaitingForResult,
    isLanding,
    onComplete: onAnimationComplete,
  });

  // Pre-compute segment paths (static, won't change)
  const segments = useMemo(() =>
    WHEEL_NUMBERS.map((num, i) => ({
      num,
      path: createSegmentPath(i, D.POCKET_INNER, D.POCKET_OUTER),
      gradient: getPocketGradient(num),
      textAngle: i * SEGMENT_ANGLE + SEGMENT_ANGLE / 2,
      textRadius: (D.POCKET_INNER + D.POCKET_OUTER) / 2,
    })),
  []);

  // Pre-compute decorative spokes
  const spokes = useMemo(() =>
    Array.from({ length: 8 }, (_, i) => {
      const angle = i * 45;
      const [x1, y1] = polarToCartesian(angle, D.CENTER_HUB + 5);
      const [x2, y2] = polarToCartesian(angle, D.INNER_CONE - 5);
      return { x1, y1, x2, y2 };
    }),
  []);

  // Pre-compute fret lines
  const frets = useMemo(() =>
    Array.from({ length: SEGMENTS }, (_, i) => {
      const angle = i * SEGMENT_ANGLE;
      const [x1, y1] = polarToCartesian(angle, D.POCKET_INNER);
      const [x2, y2] = polarToCartesian(angle, D.POCKET_OUTER);
      return { x1, y1, x2, y2 };
    }),
  []);

  // Ball position with wobble and bounce effects
  const baseY = D.CENTER - D.BALL_TRACK + ((100 - ballRadius) * 0.2);
  // Apply wobble offset during spin (affects vertical position slightly)
  const wobbleY = wobbleOffset * 0.5;
  // Apply micro-bounce during settle (ball jumps up slightly)
  const bounceY = bouncePhase * 4;
  const ballY = baseY + wobbleY - bounceY;

  // Shadow elongation based on speed (stretched when moving fast)
  const shadowStretchX = 1 + ballSpeed * 2.5; // Up to 3.5x wider at full speed
  const shadowStretchY = 1 - ballSpeed * 0.3; // Slightly flatter
  const shadowOffsetX = 3 + ballSpeed * 8; // More offset when fast

  const winnerIsRed = winningNumber !== null && isRed(winningNumber);
  const winnerIsGreen = winningNumber === 0;

  // Get color scheme for result overlay based on winning number
  const getResultColors = () => {
    if (winnerIsGreen) return {
      border: 'border-green-400',
      shadow: 'shadow-green-400/60',
      glow: 'rgba(74, 222, 128, 0.7)',
      particle: '#4ade80'
    };
    if (winnerIsRed) return {
      border: 'border-red-400',
      shadow: 'shadow-red-400/60',
      glow: 'rgba(248, 113, 113, 0.7)',
      particle: '#f87171'
    };
    return {
      border: 'border-zinc-300',
      shadow: 'shadow-zinc-300/60',
      glow: 'rgba(212, 212, 216, 0.7)',
      particle: '#d4d4d8'
    };
  };

  const resultColors = getResultColors();

  return (
    <div className="relative flex items-center justify-center">
      <svg
        viewBox={`0 0 ${D.VIEW_SIZE} ${D.VIEW_SIZE}`}
        className="aspect-square h-[35vh] md:h-[32vh] w-auto"
      >
        <defs>
          {/* Enhanced metallic gold rim gradient */}
          <linearGradient id="rimGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFF8DC" />
            <stop offset="15%" stopColor="#F4D03F" />
            <stop offset="30%" stopColor={COLORS.GOLD} />
            <stop offset="50%" stopColor="#8B7355" />
            <stop offset="70%" stopColor={COLORS.GOLD} />
            <stop offset="85%" stopColor="#F4D03F" />
            <stop offset="100%" stopColor="#6B5B3D" />
          </linearGradient>

          {/* Rim inner edge highlight */}
          <radialGradient id="rimHighlight" cx="30%" cy="30%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.4)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>

          {/* Enhanced pocket gradients with 3D depth */}
          <radialGradient id="pocketRedGradient" cx="50%" cy="30%">
            <stop offset="0%" stopColor="#E84057" />
            <stop offset="50%" stopColor={COLORS.RED} />
            <stop offset="85%" stopColor="#8C1228" />
            <stop offset="100%" stopColor="#5C0A1A" />
          </radialGradient>

          <radialGradient id="pocketBlackGradient" cx="50%" cy="30%">
            <stop offset="0%" stopColor="#3D3D3D" />
            <stop offset="50%" stopColor={COLORS.BLACK} />
            <stop offset="85%" stopColor="#0D0D0D" />
            <stop offset="100%" stopColor="#000000" />
          </radialGradient>

          <radialGradient id="pocketGreenGradient" cx="50%" cy="30%">
            <stop offset="0%" stopColor="#12A85A" />
            <stop offset="50%" stopColor={COLORS.GREEN} />
            <stop offset="85%" stopColor="#065D30" />
            <stop offset="100%" stopColor="#03391D" />
          </radialGradient>

          {/* Inner cone with wooden texture feel */}
          <radialGradient id="coneGradient" cx="35%" cy="35%">
            <stop offset="0%" stopColor="#7D6B4F" />
            <stop offset="40%" stopColor="#5D4E37" />
            <stop offset="80%" stopColor="#3A3020" />
            <stop offset="100%" stopColor="#2A1F14" />
          </radialGradient>

          {/* Cone inner highlight ring */}
          <radialGradient id="coneHighlight" cx="30%" cy="30%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.15)" />
            <stop offset="60%" stopColor="rgba(255,255,255,0.05)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>

          {/* Center hub - polished brass effect */}
          <radialGradient id="hubGradient" cx="30%" cy="30%">
            <stop offset="0%" stopColor="#FFF8DC" />
            <stop offset="25%" stopColor="#F4D03F" />
            <stop offset="50%" stopColor={COLORS.GOLD} />
            <stop offset="75%" stopColor="#8B7355" />
            <stop offset="100%" stopColor="#6B5B3D" />
          </radialGradient>

          {/* Ball - polished chrome effect */}
          <radialGradient id="ballGradient" cx="30%" cy="25%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="40%" stopColor="#F0F0F0" />
            <stop offset="70%" stopColor="#D0D0D0" />
            <stop offset="90%" stopColor="#A0A0A0" />
            <stop offset="100%" stopColor="#808080" />
          </radialGradient>

          {/* Ball shadow for depth */}
          <radialGradient id="ballShadow" cx="50%" cy="50%">
            <stop offset="0%" stopColor="rgba(0,0,0,0.5)" />
            <stop offset="70%" stopColor="rgba(0,0,0,0.2)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>

          {/* Ball glow filter */}
          <filter id="ballGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Winner highlight glow - pulsing animation */}
          <filter id="winnerGlow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="4" result="blur">
              <animate
                attributeName="stdDeviation"
                values="4;8;4"
                dur="1s"
                repeatCount="indefinite"
              />
            </feGaussianBlur>
            <feFlood floodColor={COLORS.WINNER_HIGHLIGHT} result="floodColor">
              <animate
                attributeName="flood-opacity"
                values="0.9;1;0.9"
                dur="1s"
                repeatCount="indefinite"
              />
            </feFlood>
            <feComposite in="floodColor" in2="blur" operator="in" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Winner outer ring glow */}
          <filter id="winnerOuterGlow" x="-150%" y="-150%" width="400%" height="400%">
            <feGaussianBlur stdDeviation="6" result="blur">
              <animate
                attributeName="stdDeviation"
                values="6;12;6"
                dur="1.2s"
                repeatCount="indefinite"
              />
            </feGaussianBlur>
            <feFlood floodColor={COLORS.WINNER_HIGHLIGHT}>
              <animate
                attributeName="flood-opacity"
                values="0.5;0.8;0.5"
                dur="1.2s"
                repeatCount="indefinite"
              />
            </feFlood>
            <feComposite in2="blur" operator="in" />
          </filter>

          {/* Text shadow for legibility */}
          <filter id="textShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="1" floodColor="#000000" floodOpacity="0.8" />
          </filter>

          {/* Wheel surface shine overlay */}
          <linearGradient id="wheelShine" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.1)" />
            <stop offset="45%" stopColor="rgba(255,255,255,0)" />
            <stop offset="55%" stopColor="rgba(255,255,255,0)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.1)" />
          </linearGradient>

          {/* Spoke gradient */}
          <linearGradient id="spokeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#8B7355" />
            <stop offset="50%" stopColor={COLORS.GOLD} />
            <stop offset="100%" stopColor="#8B7355" />
          </linearGradient>

          {/* Motion blur filter for ball trail */}
          <filter id="ballMotionBlur" x="-100%" y="-50%" width="300%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation={`${ballSpeed * 4} 0`} />
          </filter>

          {/* Trail gradient - fades from ball color to transparent */}
          <linearGradient id="trailGradient" x1="100%" y1="50%" x2="0%" y2="50%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.6)" />
            <stop offset="30%" stopColor="rgba(255,255,255,0.3)" />
            <stop offset="70%" stopColor="rgba(255,255,255,0.1)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
        </defs>

        {/* Wheel group - rotates */}
        <g transform={`rotate(${wheelAngle} ${D.CENTER} ${D.CENTER})`}>
          {/* Outer rim base */}
          <circle
            cx={D.CENTER}
            cy={D.CENTER}
            r={D.OUTER_RADIUS}
            fill="url(#rimGradient)"
            stroke="#5D4E37"
            strokeWidth="3"
          />

          {/* Rim highlight overlay for shine */}
          <circle
            cx={D.CENTER}
            cy={D.CENTER}
            r={D.OUTER_RADIUS - 1}
            fill="url(#rimHighlight)"
            stroke="none"
          />

          {/* Inner rim edge */}
          <circle
            cx={D.CENTER}
            cy={D.CENTER}
            r={D.POCKET_OUTER + 2}
            fill="none"
            stroke="#6B5B3D"
            strokeWidth="2"
          />

          {/* Ball track groove - deeper shadow */}
          <circle
            cx={D.CENTER}
            cy={D.CENTER}
            r={D.BALL_TRACK}
            fill="none"
            stroke="#2A2A2A"
            strokeWidth="14"
            opacity="0.6"
          />
          {/* Ball track highlight */}
          <circle
            cx={D.CENTER}
            cy={D.CENTER}
            r={D.BALL_TRACK + 5}
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="1"
          />

          {/* Pocket segments with gradient fills */}
          {segments.map(({ num, path, gradient }) => {
            const isWinner = showResult && num === winningNumber;
            return (
              <g key={`pocket-group-${num}`}>
                {/* Outer glow layer for winner */}
                {isWinner && (
                  <path
                    d={path}
                    fill={COLORS.WINNER_HIGHLIGHT}
                    filter="url(#winnerOuterGlow)"
                    opacity="0.6"
                  />
                )}
                <path
                  key={`pocket-${num}`}
                  d={path}
                  fill={isWinner ? COLORS.WINNER_HIGHLIGHT : gradient}
                  stroke="#1A1A1A"
                  strokeWidth="0.8"
                  filter={isWinner ? 'url(#winnerGlow)' : undefined}
                />
              </g>
            );
          })}

          {/* Frets (pocket dividers) */}
          {frets.map((f, i) => (
            <line
              key={`fret-${i}`}
              x1={f.x1}
              y1={f.y1}
              x2={f.x2}
              y2={f.y2}
              stroke={COLORS.FRET}
              strokeWidth="2"
            />
          ))}

          {/* Numbers with shadow for legibility */}
          {segments.map(({ num, textAngle, textRadius }) => {
            const [tx, ty] = polarToCartesian(textAngle, textRadius);
            const isWinner = showResult && num === winningNumber;
            return (
              <text
                key={`num-${num}`}
                x={tx}
                y={ty}
                fill={isWinner ? '#000' : '#FFF'}
                fontSize="11"
                fontWeight="bold"
                fontFamily="Arial, sans-serif"
                textAnchor="middle"
                dominantBaseline="central"
                transform={`rotate(${textAngle + 90} ${tx} ${ty})`}
                filter={isWinner ? undefined : 'url(#textShadow)'}
                style={{ letterSpacing: '0.5px' }}
              >
                {num}
              </text>
            );
          })}

          {/* Inner cone */}
          <circle
            cx={D.CENTER}
            cy={D.CENTER}
            r={D.INNER_CONE}
            fill="url(#coneGradient)"
            stroke="#5D4E37"
            strokeWidth="3"
          />

          {/* Cone highlight overlay */}
          <circle
            cx={D.CENTER}
            cy={D.CENTER}
            r={D.INNER_CONE - 1}
            fill="url(#coneHighlight)"
            stroke="none"
          />

          {/* Decorative spokes */}
          {spokes.map((s, i) => (
            <line
              key={`spoke-${i}`}
              x1={s.x1}
              y1={s.y1}
              x2={s.x2}
              y2={s.y2}
              stroke="url(#spokeGradient)"
              strokeWidth="4"
              strokeLinecap="round"
            />
          ))}

          {/* Spoke shadows for depth */}
          {spokes.map((s, i) => (
            <line
              key={`spoke-shadow-${i}`}
              x1={s.x1 + 1}
              y1={s.y1 + 1}
              x2={s.x2 + 1}
              y2={s.y2 + 1}
              stroke="rgba(0,0,0,0.3)"
              strokeWidth="4"
              strokeLinecap="round"
            />
          ))}

          {/* Center hub base */}
          <circle
            cx={D.CENTER}
            cy={D.CENTER}
            r={D.CENTER_HUB}
            fill="url(#hubGradient)"
            stroke="#5D4E37"
            strokeWidth="3"
          />

          {/* Hub inner ring decoration */}
          <circle
            cx={D.CENTER}
            cy={D.CENTER}
            r={D.CENTER_HUB - 10}
            fill="none"
            stroke="rgba(255,255,255,0.15)"
            strokeWidth="1"
          />

          {/* Hub decoration - ornate cross */}
          <line
            x1={D.CENTER - 30}
            y1={D.CENTER}
            x2={D.CENTER + 30}
            y2={D.CENTER}
            stroke="#5D4E37"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <line
            x1={D.CENTER}
            y1={D.CENTER - 30}
            x2={D.CENTER}
            y2={D.CENTER + 30}
            stroke="#5D4E37"
            strokeWidth="4"
            strokeLinecap="round"
          />
          {/* Cross highlight */}
          <line
            x1={D.CENTER - 28}
            y1={D.CENTER - 1}
            x2={D.CENTER + 28}
            y2={D.CENTER - 1}
            stroke="rgba(255,255,255,0.2)"
            strokeWidth="1"
            strokeLinecap="round"
          />
          <line
            x1={D.CENTER - 1}
            y1={D.CENTER - 28}
            x2={D.CENTER - 1}
            y2={D.CENTER + 28}
            stroke="rgba(255,255,255,0.2)"
            strokeWidth="1"
            strokeLinecap="round"
          />

          {/* Center jewel */}
          <circle
            cx={D.CENTER}
            cy={D.CENTER}
            r={8}
            fill="url(#hubGradient)"
            stroke="#4A3D28"
            strokeWidth="2"
          />

          {/* Wheel surface shine overlay */}
          <circle
            cx={D.CENTER}
            cy={D.CENTER}
            r={D.POCKET_OUTER}
            fill="url(#wheelShine)"
            stroke="none"
            pointerEvents="none"
          />
        </g>

        {/* Ball - rotates independently around the wheel */}
        <g transform={`rotate(${-ballAngle} ${D.CENTER} ${D.CENTER})`}>
          {/* Motion trail - visible during fast spin */}
          {ballSpeed > 0.1 && (
            <>
              {/* Trail arc rendered as multiple fading ghost balls */}
              {[...Array(5)].map((_, i) => {
                const trailOffset = (i + 1) * 4 * ballSpeed; // Spaced based on speed
                const trailOpacity = (1 - (i / 5)) * ballSpeed * 0.4;
                return (
                  <circle
                    key={`trail-${i}`}
                    cx={D.CENTER - trailOffset}
                    cy={ballY}
                    r={D.BALL_RADIUS + 1 - i * 0.3}
                    fill={`rgba(255,255,255,${trailOpacity})`}
                  />
                );
              })}
            </>
          )}

          {/* Dynamic ball shadow - elongates with speed */}
          <ellipse
            cx={D.CENTER + shadowOffsetX}
            cy={ballY + 4}
            rx={(D.BALL_RADIUS + 3) * shadowStretchX}
            ry={(D.BALL_RADIUS + 1) * shadowStretchY}
            fill="url(#ballShadow)"
          />

          {/* Main ball with chrome gradient */}
          <circle
            cx={D.CENTER + wobbleOffset * 0.3}
            cy={ballY}
            r={D.BALL_RADIUS + 2}
            fill="url(#ballGradient)"
            stroke="#666666"
            strokeWidth="0.5"
            filter="url(#ballGlow)"
          />

          {/* Ball highlight spot - shifts with wobble */}
          <circle
            cx={D.CENTER - 2 + wobbleOffset * 0.2}
            cy={ballY - 2}
            r={3}
            fill="rgba(255,255,255,0.7)"
          />

          {/* Bounce glow - subtle flash when ball bounces */}
          {bouncePhase > 0.3 && (
            <circle
              cx={D.CENTER}
              cy={ballY}
              r={D.BALL_RADIUS + 4}
              fill="none"
              stroke={`rgba(255,255,255,${bouncePhase * 0.5})`}
              strokeWidth="2"
            />
          )}
        </g>
      </svg>

      {/* Result overlay */}
      <AnimatePresence>
        {showResult && winningNumber !== null && (
          <motion.div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Particle burst effect */}
            {[...Array(12)].map((_, i) => {
              const angle = (i / 12) * 360;
              const delay = i * 0.02;
              return (
                <motion.div
                  key={`particle-${i}`}
                  className="absolute w-2 h-2 rounded-full"
                  style={{ backgroundColor: resultColors.particle }}
                  initial={{
                    x: 0,
                    y: 0,
                    scale: 0,
                    opacity: 1
                  }}
                  animate={{
                    x: Math.cos(angle * Math.PI / 180) * 80,
                    y: Math.sin(angle * Math.PI / 180) * 80,
                    scale: [0, 1.5, 0],
                    opacity: [1, 0.8, 0]
                  }}
                  transition={{
                    duration: 0.8,
                    delay: delay,
                    ease: 'easeOut'
                  }}
                />
              );
            })}

            {/* Secondary sparkle ring */}
            {[...Array(8)].map((_, i) => {
              const angle = (i / 8) * 360 + 22.5;
              return (
                <motion.div
                  key={`sparkle-${i}`}
                  className="absolute w-1.5 h-1.5 rounded-full bg-yellow-300"
                  initial={{
                    x: 0,
                    y: 0,
                    scale: 0,
                    opacity: 1
                  }}
                  animate={{
                    x: Math.cos(angle * Math.PI / 180) * 60,
                    y: Math.sin(angle * Math.PI / 180) * 60,
                    scale: [0, 1, 0],
                    opacity: [1, 0.6, 0]
                  }}
                  transition={{
                    duration: 0.6,
                    delay: 0.1 + i * 0.015,
                    ease: 'easeOut'
                  }}
                />
              );
            })}

            {/* Outer glow ring */}
            <motion.div
              className="absolute w-24 h-24 rounded-full"
              style={{
                boxShadow: `0 0 30px 10px ${resultColors.glow}`,
              }}
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{
                scale: [0.3, 1.1, 1],
                opacity: [0, 0.8, 0.5]
              }}
              exit={{ scale: 1.5, opacity: 0 }}
              transition={{
                duration: 0.4,
                ease: 'easeOut'
              }}
            />

            {/* Main result circle */}
            <motion.div
              className={`bg-black/95 rounded-full w-20 h-20 flex flex-col items-center justify-center border-3 ${resultColors.border} shadow-lg ${resultColors.shadow}`}
              style={{ borderWidth: '3px' }}
              initial={{ scale: 0, rotate: -180 }}
              animate={{
                scale: 1,
                rotate: 0,
                boxShadow: [
                  `0 0 15px 3px ${resultColors.glow}`,
                  `0 0 25px 8px ${resultColors.glow}`,
                  `0 0 15px 3px ${resultColors.glow}`
                ]
              }}
              exit={{ scale: 0, rotate: 180, opacity: 0 }}
              transition={{
                type: 'spring',
                stiffness: 400,
                damping: 15,
                boxShadow: {
                  duration: 1,
                  repeat: Infinity,
                  ease: 'easeInOut'
                }
              }}
            >
              <motion.span
                className={`text-3xl font-black ${
                  winnerIsRed ? 'text-red-400' : winnerIsGreen ? 'text-green-400' : 'text-white'
                }`}
                initial={{ scale: 0, y: 10 }}
                animate={{ scale: [0, 1.3, 1], y: 0 }}
                transition={{
                  type: 'spring',
                  stiffness: 500,
                  damping: 12,
                  delay: 0.15
                }}
              >
                {winningNumber}
              </motion.span>
              <motion.span
                className={`text-xs font-bold tracking-wider ${
                  winnerIsRed ? 'text-red-300' : winnerIsGreen ? 'text-green-300' : 'text-zinc-300'
                }`}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25, duration: 0.2 }}
              >
                {winnerIsRed ? 'RED' : winnerIsGreen ? 'GREEN' : 'BLACK'}
              </motion.span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};
