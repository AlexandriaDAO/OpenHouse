import { useEffect, useRef, useState, useCallback } from 'react';
import { ANIMATION, getNumberAngle } from './rouletteConstants';

export interface AnimationState {
  ballAngle: number;
  wheelAngle: number;
  ballRadius: number;  // 100 = outer track, lower = more inward
  showResult: boolean;
}

interface UseRouletteAnimationProps {
  winningNumber: number | null;
  isSpinning: boolean;
  isLanding: boolean;
  onComplete?: () => void;
}

export function useRouletteAnimation({
  winningNumber,
  isSpinning,
  isLanding,
  onComplete,
}: UseRouletteAnimationProps): AnimationState {
  // Refs for animation values (avoid stale closures)
  const ballAngleRef = useRef(0);
  const wheelAngleRef = useRef(0);
  const landingStartRef = useRef<number | null>(null);
  const startBallAngleRef = useRef(0);
  const targetBallAngleRef = useRef(0);
  const frozenWheelRef = useRef(0);
  const finalWheelRef = useRef(0);
  const ballEasingExponentRef = useRef(3);
  const completedRef = useRef(false);
  const frameRef = useRef<number | null>(null);

  // State for rendering
  const [state, setState] = useState<AnimationState>({
    ballAngle: 0,
    wheelAngle: 0,
    ballRadius: 100,
    showResult: false,
  });

  // Calculate target position for ball to land on winning number
  // Key insight: Ball uses rotate(-ballAngle), so it appears at (360 - ballAngle) on screen
  // Wheel uses rotate(wheelAngle), so slot at slotAngle appears at (slotAngle + wheelAngle)
  // For ball to visually land on slot: (360 - ballAngle) = (slotAngle + wheelAngle)
  // Therefore: ballAngle = 360 - (slotAngle + wheelAngle)
  const calculateTarget = useCallback((num: number, currentBall: number, finalWheel: number) => {
    const slotAngle = getNumberAngle(num);  // Center of the pocket
    const slotScreenPosition = (slotAngle + finalWheel) % 360;  // Where slot appears on screen

    // Account for ball's inverted rotation: ballAngle = 360 - screenPosition
    const ballTargetAngle = (360 - slotScreenPosition + 360) % 360;

    const currentNormalized = ((currentBall % 360) + 360) % 360;
    let diff = ballTargetAngle - currentNormalized;
    if (diff <= 0) diff += 360;  // Always continue spinning forward

    return currentBall + (ANIMATION.EXTRA_SPINS * 360) + diff;
  }, []);

  // Main animation loop
  useEffect(() => {
    let lastTime = performance.now();
    completedRef.current = false;

    const animate = (timestamp: number) => {
      const dt = (timestamp - lastTime) / 1000;
      lastTime = timestamp;

      if (isSpinning) {
        // Fast spin phase - continuous rotation at constant velocity
        ballAngleRef.current += ANIMATION.BALL_SPEED * dt;
        wheelAngleRef.current += ANIMATION.WHEEL_SPEED * dt;

        // Normalize angles for rendering to avoid browser issues with large values
        setState({
          ballAngle: ballAngleRef.current % 360,
          wheelAngle: wheelAngleRef.current % 360,
          ballRadius: 100,
          showResult: false,
        });

        frameRef.current = requestAnimationFrame(animate);

      } else if (isLanding && winningNumber !== null) {
        // Initialize landing phase - calculate velocities for smooth transition
        if (landingStartRef.current === null) {
          landingStartRef.current = timestamp;
          startBallAngleRef.current = ballAngleRef.current;
          frozenWheelRef.current = wheelAngleRef.current;

          const durationSec = ANIMATION.LANDING_DURATION / 1000;

          // Calculate wheel drift for uniform deceleration from current velocity to zero
          // With uniform deceleration: distance = v0 * t / 2
          // This ensures the wheel smoothly decelerates from WHEEL_SPEED to 0
          const wheelDrift = ANIMATION.WHEEL_SPEED * durationSec / 2;
          finalWheelRef.current = frozenWheelRef.current + wheelDrift;

          // Calculate ball target based on where wheel will end up
          targetBallAngleRef.current = calculateTarget(
            winningNumber,
            startBallAngleRef.current,
            finalWheelRef.current
          );

          // Calculate ball easing exponent for velocity continuity
          // For ease-out curve 1 - (1-t)^n, derivative at t=0 is n
          // So: n = (spinning_velocity * duration) / total_distance
          // This ensures the ball starts at BALL_SPEED and smoothly decelerates to 0
          const ballDistance = targetBallAngleRef.current - startBallAngleRef.current;
          ballEasingExponentRef.current = Math.max(
            1.5, // Minimum exponent for proper ease-out
            (ANIMATION.BALL_SPEED * durationSec) / ballDistance
          );
        }

        const elapsed = timestamp - landingStartRef.current;
        const progress = Math.min(elapsed / ANIMATION.LANDING_DURATION, 1);

        // Use dynamic easing exponents for perfectly smooth velocity transitions
        // Ball: starts at BALL_SPEED, smoothly decelerates to 0
        const ballEased = 1 - Math.pow(1 - progress, ballEasingExponentRef.current);
        // Wheel: uniform deceleration (exponent 2) from WHEEL_SPEED to 0
        const wheelEased = 1 - Math.pow(1 - progress, 2);

        // Interpolate positions
        const newBall = startBallAngleRef.current +
          (targetBallAngleRef.current - startBallAngleRef.current) * ballEased;
        ballAngleRef.current = newBall;

        const newWheel = frozenWheelRef.current +
          (finalWheelRef.current - frozenWheelRef.current) * wheelEased;
        wheelAngleRef.current = newWheel;

        // Ball moves inward as it settles (using quadratic ease for natural feel)
        const radiusEased = 1 - Math.pow(1 - progress, 2);
        const radius = 100 - radiusEased * 15;

        setState({
          ballAngle: newBall,
          wheelAngle: newWheel,
          ballRadius: radius,
          showResult: progress >= 1,
        });

        if (progress >= 1) {
          if (!completedRef.current) {
            completedRef.current = true;
            onComplete?.();
          }
          return;
        }

        frameRef.current = requestAnimationFrame(animate);
      }
    };

    if (isSpinning || isLanding) {
      frameRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [isSpinning, isLanding, winningNumber, calculateTarget, onComplete]);

  // Reset when going idle
  useEffect(() => {
    if (!isSpinning && !isLanding && winningNumber === null) {
      landingStartRef.current = null;
      completedRef.current = false;
      setState(prev => ({ ...prev, showResult: false, ballRadius: 100 }));
    }
  }, [isSpinning, isLanding, winningNumber]);

  return state;
}
