import { useRef, useEffect } from 'react';
import { EUROPEAN_LAYOUT, SPIN_DURATION, TOTAL_ROTATIONS, getNumberColor, getAngleForNumber } from './constants';

interface WheelCanvasProps {
  targetNumber: number | null;
  isSpinning: boolean;
  onSpinComplete: () => void;
}

export function WheelCanvas({ targetNumber, isSpinning, onSpinComplete }: WheelCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const wheelRotationRef = useRef<number>(0);
  const ballRotationRef = useRef<number>(0);

  // Animation loop
  useEffect(() => {
    if (!isSpinning || targetNumber === null) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Target calculation
    // We want the target number to end up at the top (usually -90 deg or 270 deg).
    // The wheel rotates. The ball rotates counter.
    // To simplify: Ball rotates relative to wheel.
    // Let's just rotate the wheel and keep ball fixed or simple.
    // Plan says: Wheel rotates clockwise. Ball rotates counter-clockwise.
    // If target is 0. 0 is at angle X on wheel.
    // We want angle X to be at top when stopped.
    // Wheel angle W. Number angle A relative to wheel 0.
    // Final position of number: W + A. We want W + A = -PI/2 (top).
    // So target W = -PI/2 - A.
    
    // getAngleForNumber returns angle in degrees where number is on the wheel (0..360).
    const targetPocketAngle = getAngleForNumber(targetNumber); // degrees
    const targetPocketRad = targetPocketAngle * (Math.PI / 180);
    
    // We want this pocket to be at -PI/2.
    // Final Wheel Rotation = -PI/2 - targetPocketRad.
    // Add extra rotations.
    const finalRotation = -(Math.PI / 2) - targetPocketRad + (TOTAL_ROTATIONS * 2 * Math.PI);
    
    // Actually, let's just rotate wheel.
    // Start from current rotation?
    // Reset for simplicity.
    
    startTimeRef.current = Date.now();
    const startRotation = wheelRotationRef.current % (2 * Math.PI);

    const animate = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const progress = Math.min(elapsed / SPIN_DURATION, 1);

      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);

      // Wheel rotation
      // Interpolate from startRotation to finalRotation
      const currentRot = startRotation + (finalRotation - startRotation) * eased;
      wheelRotationRef.current = currentRot;

      // Ball rotation (visual effect only)
      // Ball spins fast then slows/stops.
      // Or just keep ball fixed at top and wheel spins underneath?
      // Real roulette: ball spins opposite.
      // Let's do: ball spins opposite and lands in slot.
      // This is complex to sync.
      // SIMPLIFICATION: Ball fixed at top (12 o'clock), Wheel spins.
      // When wheel stops, the target number is at top.
      // This matches the math above: W + A = -PI/2.
      // Wait, if ball is at top (-PI/2). Number needs to be at top.
      // Yes.
      
      // Render
      drawWheel(ctx, canvas.width, canvas.height, wheelRotationRef.current);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        onSpinComplete();
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isSpinning, targetNumber, onSpinComplete]);

  // Render static wheel when not spinning
  useEffect(() => {
    if (isSpinning) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    drawWheel(ctx, canvas.width, canvas.height, wheelRotationRef.current);
  }, [isSpinning]);

  return (
    <canvas
      ref={canvasRef}
      width={400}
      height={400}
      className="w-full max-w-md mx-auto"
    />
  );
}

function drawWheel(ctx: CanvasRenderingContext2D, width: number, height: number, wheelRotation: number) {
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(centerX, centerY) * 0.9;

  // Clear canvas
  ctx.clearRect(0, 0, width, height);

  // Draw outer rim
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(wheelRotation);
  
  // Outer rim
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fillStyle = '#2d2d2d'; // Dark rim
  ctx.fill();
  ctx.strokeStyle = '#C0C0C0';
  ctx.lineWidth = 10;
  ctx.stroke();

  // Pockets
  const pocketAngle = (Math.PI * 2) / 37;

  for (let i = 0; i < 37; i++) {
    const number = EUROPEAN_LAYOUT[i];
    // Start angle for this pocket
    const angle = i * pocketAngle;
    const color = getNumberColor(number);

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, radius - 10, angle, angle + pocketAngle);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.stroke();

    // Text
    ctx.save();
    ctx.rotate(angle + pocketAngle / 2);
    ctx.translate(radius - 30, 0);
    ctx.rotate(Math.PI / 2); // Text facing center
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(number.toString(), 0, 0);
    ctx.restore();
  }
  
  // Center cap
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.1, 0, Math.PI * 2);
  ctx.fillStyle = '#C0C0C0';
  ctx.fill();
  
  ctx.restore(); // Undo wheel rotation

  // Draw Ball (Fixed at top for now, simplified animation)
  // Ball at -PI/2 (top)
  const ballRadius = 8;
  const ballDist = radius - 20;
  
  ctx.beginPath();
  ctx.arc(centerX, centerY - ballDist, ballRadius, 0, Math.PI * 2);
  ctx.fillStyle = 'white';
  ctx.shadowColor = 'white';
  ctx.shadowBlur = 10;
  ctx.fill();
  ctx.shadowBlur = 0;
}
