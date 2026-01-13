import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import type { RocketState } from '../../../pages/Crash';
import './CrashRocket.css';

// Total number of unique rocket designs available (1-10)
const TOTAL_ROCKET_DESIGNS = 10;

// Get image paths for rockets and explosions
// Format: 1a.png (flying), 1b.png (crashed) through 10a.png, 10b.png
const getRocketImage = (variant: number) => `/rockets/${variant}a.png`;
const getCrashedImage = (variant: number) => `/rockets/${variant}b.png`;

// Preload all rocket images to prevent placeholder text showing
const preloadedImages: Map<string, HTMLImageElement> = new Map();
let imagesPreloaded = false;

const preloadAllRocketImages = (): Promise<void> => {
  if (imagesPreloaded) return Promise.resolve();

  const imagePromises: Promise<void>[] = [];

  for (let i = 1; i <= TOTAL_ROCKET_DESIGNS; i++) {
    // Preload flying rocket
    const flyingPath = getRocketImage(i);
    if (!preloadedImages.has(flyingPath)) {
      const flyingImg = new Image();
      imagePromises.push(new Promise((resolve) => {
        flyingImg.onload = () => resolve();
        flyingImg.onerror = () => resolve(); // Don't fail on error
        flyingImg.src = flyingPath;
      }));
      preloadedImages.set(flyingPath, flyingImg);
    }

    // Preload crashed rocket
    const crashedPath = getCrashedImage(i);
    if (!preloadedImages.has(crashedPath)) {
      const crashedImg = new Image();
      imagePromises.push(new Promise((resolve) => {
        crashedImg.onload = () => resolve();
        crashedImg.onerror = () => resolve();
        crashedImg.src = crashedPath;
      }));
      preloadedImages.set(crashedPath, crashedImg);
    }
  }

  return Promise.all(imagePromises).then(() => {
    imagesPreloaded = true;
  });
};

// 10 distinct colors for trajectory lines
export const ROCKET_COLORS = [
  '#39FF14', // Lime green
  '#FF6B6B', // Coral red
  '#4ECDC4', // Teal
  '#FFE66D', // Yellow
  '#FF8C00', // Orange
  '#E040FB', // Purple
  '#00BCD4', // Cyan
  '#FF4081', // Pink
  '#7C4DFF', // Indigo
  '#64FFDA', // Aqua
];

// ============================================
// Cosmic Encounters System - space objects that appear during flight
// ============================================

// Z-index hierarchy for proper layering
const Z_INDEX = {
  STARS: 5,
  NEBULA: 8,
  CANVAS: 10,
  ENCOUNTERS: 15,      // Behind rockets
  ROCKETS_FLYING: 20,
  ROCKETS_CRASHED: 22,
  UI: 30,
} as const;

// Encounter spawn configuration
const ENCOUNTER_CONFIG = {
  MAX_ON_SCREEN: 6,           // Prevent visual clutter
  CHECK_INTERVAL_MS: 1500,    // How often to roll for new encounter
  BASE_CHANCE: 0.10,          // 10% base probability
  CHANCE_PER_MULT: 0.02,      // +2% per multiplier
  MAX_CHANCE: 0.50,           // Cap at 50% to prevent spam
  X_SPAWN_MIN: 20,            // Avoid left edge (rocket start area)
  X_SPAWN_RANGE: 60,          // Spawn in center 60% of screen
  Y_SPAWN_MIN: 5,             // Start near top for downward drift
  Y_SPAWN_RANGE: 50,          // Upper half of screen
  DURATION_MIN_MS: 5000,      // Minimum visibility time
  DURATION_VARIANCE_MS: 3000, // Random additional duration
} as const;

// Animation class mappings (static, defined once)
const SPIN_ENCOUNTER_TYPES = new Set(['wormhole', 'galaxy', 'blackHole', 'dysonSphere']);
const WOBBLE_ENCOUNTER_TYPES = new Set(['alienShip', 'alienProbe', 'cosmicEntity', 'astronaut']);
const RARE_ENCOUNTER_TYPES = new Set(['cosmicEntity', 'blackHole', 'wormhole']);

type EncounterType =
  | 'satellite' | 'astronaut' | 'spaceStation'  // Low orbit (5x-20x)
  | 'asteroid' | 'comet' | 'moon'               // Deep space (20x-60x)
  | 'planet_ringed' | 'planet_gas' | 'alienProbe' // Outer system (60x-120x)
  | 'alienShip' | 'wormhole' | 'dysonSphere'    // Interstellar (120x-250x)
  | 'galaxy' | 'blackHole' | 'cosmicEntity';    // Cosmic (250x+)

interface CosmicEncounter {
  id: string;
  type: EncounterType;
  x: number; // starting percentage 0-100
  y: number; // starting percentage 0-100
  startTime: number;
  duration: number; // ms, typically 3000-6000
  scale: number; // size multiplier
  velocityX: number; // drift speed in % per second (negative = left)
  velocityY: number; // drift speed in % per second (positive = down)
}

interface CrashCanvasProps {
  rocketStates: RocketState[];
  targetMultiplier?: number;
  rocketsSucceeded?: number;
  width?: number;
  height?: number;
  isWaitingForBackend?: boolean;
  rocketCount?: number;
}

// Get encounter type based on current altitude (multiplier)
const getEncounterTypeForAltitude = (multiplier: number): EncounterType => {
  if (multiplier < 20) {
    // Low orbit zone
    const options: EncounterType[] = ['satellite', 'satellite', 'astronaut', 'spaceStation'];
    return options[Math.floor(Math.random() * options.length)];
  } else if (multiplier < 60) {
    // Deep space zone
    const options: EncounterType[] = ['asteroid', 'asteroid', 'comet', 'moon', 'satellite'];
    return options[Math.floor(Math.random() * options.length)];
  } else if (multiplier < 120) {
    // Outer system zone
    const options: EncounterType[] = ['planet_ringed', 'planet_gas', 'alienProbe', 'asteroid', 'comet'];
    return options[Math.floor(Math.random() * options.length)];
  } else if (multiplier < 250) {
    // Interstellar zone
    const options: EncounterType[] = ['alienShip', 'wormhole', 'dysonSphere', 'planet_gas', 'alienProbe'];
    return options[Math.floor(Math.random() * options.length)];
  } else {
    // Cosmic zone (250x+)
    const options: EncounterType[] = ['galaxy', 'blackHole', 'cosmicEntity', 'wormhole', 'alienShip'];
    return options[Math.floor(Math.random() * options.length)];
  }
};

// Get visual properties (emoji placeholder) for each encounter type
const getEncounterVisual = (type: EncounterType): { emoji: string; color: string; size: number } => {
  switch (type) {
    // Low orbit
    case 'satellite':
      return { emoji: '🛰️', color: '#88aacc', size: 32 };
    case 'astronaut':
      return { emoji: '👨‍🚀', color: '#ffffff', size: 36 };
    case 'spaceStation':
      return { emoji: '🏗️', color: '#cccccc', size: 40 };
    // Deep space
    case 'asteroid':
      return { emoji: '🪨', color: '#8b7355', size: 28 };
    case 'comet':
      return { emoji: '☄️', color: '#66ccff', size: 38 };
    case 'moon':
      return { emoji: '🌙', color: '#d4d4aa', size: 44 };
    // Outer system
    case 'planet_ringed':
      return { emoji: '🪐', color: '#e8c88a', size: 56 };
    case 'planet_gas':
      return { emoji: '🟠', color: '#e87040', size: 52 };
    case 'alienProbe':
      return { emoji: '🔷', color: '#44ffaa', size: 30 };
    // Interstellar
    case 'alienShip':
      return { emoji: '🛸', color: '#88ff88', size: 48 };
    case 'wormhole':
      return { emoji: '🌀', color: '#aa66ff', size: 60 };
    case 'dysonSphere':
      return { emoji: '⭕', color: '#ffcc00', size: 50 };
    // Cosmic
    case 'galaxy':
      return { emoji: '🌌', color: '#6644aa', size: 70 };
    case 'blackHole':
      return { emoji: '⚫', color: '#220033', size: 55 };
    case 'cosmicEntity':
      return { emoji: '👁️', color: '#ff44ff', size: 64 };
    default:
      return { emoji: '✨', color: '#ffffff', size: 24 };
  }
};

// Fisher-Yates shuffle algorithm
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Rocket size as percentage of canvas height (scales with screen size)
// ~85px on a 400px tall canvas, scales proportionally
const ROCKET_SIZE_PERCENT = 0.21; // 21% of canvas height

// Y axis margins - add bottom padding so rockets don't start cut off
const Y_TOP_MARGIN = 0.05;
const Y_BOTTOM_MARGIN = 0.12;
const Y_RANGE = 1 - Y_TOP_MARGIN - Y_BOTTOM_MARGIN;

export const CrashCanvas: React.FC<CrashCanvasProps> = ({
  rocketStates,
  targetMultiplier,
  rocketsSucceeded = 0,
  width: initialWidth = 800,
  height: initialHeight = 400,
  isWaitingForBackend = false,
  rocketCount = 10,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Use state for dynamic sizing, initialized with props
  const [size, setSize] = useState({ width: initialWidth, height: initialHeight });

  // Track device orientation for mobile layout optimization
  const [isLandscape, setIsLandscape] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth > window.innerHeight : true
  );
  // Track if orientation is transitioning for smooth animation
  const [isOrientationTransitioning, setIsOrientationTransitioning] = useState(false);

  // Track when images are preloaded
  const [imagesReady, setImagesReady] = useState(imagesPreloaded);

  // Cosmic Encounters state - space objects that appear during flight
  const [encounters, setEncounters] = useState<CosmicEncounter[]>([]);
  const lastEncounterCheckRef = useRef<number>(0);

  // Preload images on mount
  useEffect(() => {
    if (!imagesReady) {
      preloadAllRocketImages().then(() => setImagesReady(true));
    }
  }, []);

  // Orientation change handler for smooth mobile transitions
  useEffect(() => {
    const handleOrientationChange = () => {
      // Trigger transition state for smooth visual update
      setIsOrientationTransitioning(true);

      // Small delay to let the browser settle after orientation change
      const orientationTimeout = setTimeout(() => {
        const newIsLandscape = window.innerWidth > window.innerHeight;
        setIsLandscape(newIsLandscape);

        // Clear transition state after animation completes
        setTimeout(() => {
          setIsOrientationTransitioning(false);
        }, 300); // Match CSS transition duration
      }, 100);

      return () => clearTimeout(orientationTimeout);
    };

    // Listen for both orientationchange (mobile) and resize (desktop/PWA)
    window.addEventListener('orientationchange', handleOrientationChange);
    // Also check on resize for devices that don't fire orientationchange
    const handleResize = () => {
      const newIsLandscape = window.innerWidth > window.innerHeight;
      if (newIsLandscape !== isLandscape) {
        handleOrientationChange();
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('orientationchange', handleOrientationChange);
      window.removeEventListener('resize', handleResize);
    };
  }, [isLandscape]);

  // Resize Observer to handle fluid layout
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;

        setSize(prevSize => {
          if (Math.abs(width - prevSize.width) > 1 || Math.abs(height - prevSize.height) > 1) {
            return { width, height };
          }
          return prevSize;
        });
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Store positions as percentages (0-100) and angle in degrees
  const [rocketPositions, setRocketPositions] = useState<Map<number, { xPercent: number; yPercent: number; angle: number }>>(new Map());

  // Store smoothed angles per rocket for exponential moving average (persists between frames)
  const smoothedAnglesRef = useRef<Map<number, number>>(new Map());

  // Assign each rocket a unique design (no duplicates)
  // Shuffle all available designs and assign them to rockets by index
  const rocketDesigns = useMemo(() => {
    // Create array of all design numbers [1, 2, 3, ..., 10]
    const allDesigns = Array.from({ length: TOTAL_ROCKET_DESIGNS }, (_, i) => i + 1);
    // Shuffle to randomize assignment
    const shuffled = shuffleArray(allDesigns);

    // Map rocket index to design number
    const designs = new Map<number, number>();
    rocketStates.forEach((rocket, i) => {
      if (!designs.has(rocket.index)) {
        // Use modulo in case we ever have more rockets than designs
        designs.set(rocket.index, shuffled[i % shuffled.length]);
      }
    });
    return designs;
  }, [rocketStates.map(r => r.index).join(',')]);

  // Pre-launch rocket designs (stable during waiting period)
  const preLaunchDesigns = useMemo(() => {
    const allDesigns = Array.from({ length: TOTAL_ROCKET_DESIGNS }, (_, i) => i + 1);
    const shuffled = shuffleArray(allDesigns);
    return shuffled.slice(0, rocketCount);
  }, [rocketCount]);

  // Generate stars once with three depth layers for parallax effect
  const stars = useMemo(() => generateStarLayers(), []);

  // Check for cosmic encounter based on current multiplier
  const checkForEncounter = useCallback((multiplier: number, now: number, currentCount: number) => {
    // Throttle checks to prevent spam
    if (now - lastEncounterCheckRef.current < ENCOUNTER_CONFIG.CHECK_INTERVAL_MS) return;
    lastEncounterCheckRef.current = now;

    // Don't spawn if already at max capacity
    if (currentCount >= ENCOUNTER_CONFIG.MAX_ON_SCREEN) return;

    // Calculate spawn probability based on altitude
    const chance = Math.min(
      ENCOUNTER_CONFIG.BASE_CHANCE + ENCOUNTER_CONFIG.CHANCE_PER_MULT * multiplier,
      ENCOUNTER_CONFIG.MAX_CHANCE
    );

    if (Math.random() < chance) {
      const type = getEncounterTypeForAltitude(multiplier);

      // Drift speed scales with altitude (faster rocket = faster parallax)
      // Range: 3-11 %/sec based on multiplier
      const baseDriftSpeed = 3 + Math.min(multiplier / 10, 8);

      // Consistent down-left drift with slight variance for natural feel
      // Angle range: -0.6 to -0.2 radians (mostly down-left)
      const driftAngle = -0.6 + Math.random() * 0.4;

      const encounter: CosmicEncounter = {
        id: `enc-${Date.now()}-${Math.random()}`,
        type,
        x: ENCOUNTER_CONFIG.X_SPAWN_MIN + Math.random() * ENCOUNTER_CONFIG.X_SPAWN_RANGE,
        y: ENCOUNTER_CONFIG.Y_SPAWN_MIN + Math.random() * ENCOUNTER_CONFIG.Y_SPAWN_RANGE,
        startTime: now,
        duration: ENCOUNTER_CONFIG.DURATION_MIN_MS + Math.random() * ENCOUNTER_CONFIG.DURATION_VARIANCE_MS,
        scale: 0.8 + Math.random() * 0.4,
        velocityX: baseDriftSpeed * Math.cos(driftAngle) * -1,
        velocityY: baseDriftSpeed * Math.abs(Math.sin(driftAngle)),
      };
      setEncounters(prev => [...prev, encounter]);
    }
  }, []);

  // Clear smoothed angles when game resets (no rockets = new game starting)
  useEffect(() => {
    if (rocketStates.length === 0) {
      smoothedAnglesRef.current.clear();
    }
  }, [rocketStates.length]);

  // Cleanup expired cosmic encounters periodically
  useEffect(() => {
    const cleanup = setInterval(() => {
      const now = Date.now();
      setEncounters(prev => prev.filter(e => now - e.startTime < e.duration));
    }, 1000);
    return () => clearInterval(cleanup);
  }, []);

  // Clear all encounters when game resets (no rockets = new game)
  useEffect(() => {
    if (rocketStates.length === 0) {
      setEncounters([]);
      lastEncounterCheckRef.current = 0;
    }
  }, [rocketStates.length]);

  // Use a ref to track rocket states for the interval (avoids re-creating interval every frame)
  // Refs to avoid recreating intervals on every state change
  const rocketStatesRef = useRef(rocketStates);
  rocketStatesRef.current = rocketStates;

  const encountersRef = useRef(encounters);
  encountersRef.current = encounters;

  // Trigger encounter checks during active flight
  // Uses an interval that reads from ref to avoid constant recreation
  useEffect(() => {
    // Check for encounters every 500ms
    const encounterInterval = setInterval(() => {
      const rockets = rocketStatesRef.current;
      if (rockets.length === 0) return;

      const currentMax = Math.max(...rockets.map(r => r.currentMultiplier), 1.0);
      const allRocketsCrashed = rockets.every(r => r.isCrashed);
      const currentEncounterCount = encountersRef.current.length;

      // Only check for encounters during active flight (not after all crashed)
      if (!allRocketsCrashed) {
        checkForEncounter(currentMax, Date.now(), currentEncounterCount);
      }
    }, 500);

    return () => clearInterval(encounterInterval);
  }, [checkForEncounter]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = size;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw grid
    drawGrid(ctx, width, height);

    // Draw target line if set
    if (targetMultiplier && targetMultiplier > 1) {
      drawTargetLine(ctx, targetMultiplier, width, height);
    }

    // Keep everything in view - scale X to fit all history
    // Use a minimum "window" size so rockets don't instantly reach the edge
    const maxHistoryLength = Math.max(
      ...rocketStates.map(r => r.history.length),
      100
    );

    // Define the visible X range for rockets (as percentage of canvas width)
    // Rockets start at 10% and can go up to 85% (leaving room for rocket sprite)
    const X_START_PERCENT = 0.10;
    const X_END_PERCENT = 0.85;
    const X_RANGE = X_END_PERCENT - X_START_PERCENT;

    // Draw each rocket's trajectory
    const newPositions = new Map<number, { xPercent: number; yPercent: number; angle: number }>();

    rocketStates.forEach((rocket) => {
      if (rocket.history.length === 0) return;

      const color = ROCKET_COLORS[rocket.index % ROCKET_COLORS.length];

      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      let lastX = 0;
      let lastY = height;

      // Store recent points for smooth angle calculation
      // Using a longer lookback prevents jitter when dy becomes small at high multipliers
      const recentPoints: { x: number; y: number }[] = [];
      const ANGLE_LOOKBACK = 50;

      rocket.history.forEach((point, i) => {
        // Base X position from time progression
        const timeProgress = i / maxHistoryLength;
        // Map time progress to our visible range (float coords for smooth lines)
        const x = (X_START_PERCENT + timeProgress * X_RANGE) * width;

        const logMult = Math.log10(point.multiplier);
        const logMax = Math.log10(100);
        // Y position with margins: starts at (1 - Y_BOTTOM_MARGIN) and goes up to Y_TOP_MARGIN
        const yProgress = Math.min(logMult / logMax, 1);
        const y = height * (1 - Y_BOTTOM_MARGIN - yProgress * Y_RANGE);

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        lastX = x;
        lastY = y;

        // Track recent points for angle smoothing
        recentPoints.push({ x, y });
        if (recentPoints.length > ANGLE_LOOKBACK) {
          recentPoints.shift();
        }
      });

      ctx.stroke();

      // Calculate angle from a longer segment of the trajectory
      // This smooths out jitter caused by tiny dy values at high multipliers
      // Initialize to 90 degrees (horizontal right) to match pre-launch orientation
      let targetAngle = 90;
      if (recentPoints.length >= 2) {
        const startPoint = recentPoints[0];
        const endPoint = recentPoints[recentPoints.length - 1];
        const dx = endPoint.x - startPoint.x;
        const dy = endPoint.y - startPoint.y;
        // Canvas Y is inverted (increases downward), so negate dy for proper angle
        const angleRad = Math.atan2(-dy, dx);
        const trajectoryAngle = (angleRad * 180) / Math.PI;
        // Rocket PNG points straight UP (nose at 12 o'clock position)
        targetAngle = 90 - trajectoryAngle;
      }

      // Apply exponential moving average for ultra-smooth angle transitions
      // Lower ANGLE_SMOOTHING = smoother but slower response
      const ANGLE_SMOOTHING = 0.15;
      const prevSmoothedAngle = smoothedAnglesRef.current.get(rocket.index);
      let rocketAngle: number;
      if (prevSmoothedAngle !== undefined) {
        // Lerp from previous smoothed angle toward target angle
        rocketAngle = prevSmoothedAngle + (targetAngle - prevSmoothedAngle) * ANGLE_SMOOTHING;
      } else {
        // First frame: initialize with target angle
        rocketAngle = targetAngle;
      }
      // Store the smoothed angle for next frame
      smoothedAnglesRef.current.set(rocket.index, rocketAngle);

      // Use the exact line endpoint coordinates for the rocket position
      // This ensures the rocket is always precisely at the end of its trajectory line
      newPositions.set(rocket.index, {
        xPercent: (lastX / width) * 100,
        yPercent: (lastY / height) * 100,
        angle: rocketAngle
      });
    });

    setRocketPositions(newPositions);

  }, [rocketStates, targetMultiplier, size]);

  // Find the highest current multiplier for live display
  const maxCurrentMultiplier = Math.max(
    ...rocketStates.map(r => r.currentMultiplier),
    1.0
  );
  const allCrashed = rocketStates.length > 0 && rocketStates.every(r => r.isCrashed);

  // Calculate atmosphere progression (0 = ground level, 1 = deep space)
  // Using logarithmic scale: 1x=0%, 10x=50%, 100x=100%
  // This spreads the atmosphere transition across a much wider multiplier range
  const atmosphereProgress = Math.min(Math.log10(maxCurrentMultiplier) / Math.log10(100), 1);

  // Dynamic background colors based on altitude
  // Cypherpunk aesthetic: dark ionosphere dusk -> void of space -> cosmic depths
  // More granular progression with 8 distinct layers for ultra-smooth transitions
  const getAtmosphereGradient = () => {
    if (atmosphereProgress < 0.08) {
      // Ground level / troposphere: warmest tones, rust/amber horizon glow
      const t = atmosphereProgress / 0.08;
      return {
        top: `rgb(${Math.round(10 + t * 4)}, ${Math.round(6 + t * 3)}, ${Math.round(25 + t * 8)})`,
        mid: `rgb(${Math.round(30 + t * 10)}, ${Math.round(15 + t * 5)}, ${Math.round(35 + t * 5)})`,
        bottom: `rgb(${Math.round(55 - t * 5)}, ${Math.round(22 + t * 3)}, ${Math.round(38 + t * 2)})`,
      };
    } else if (atmosphereProgress < 0.18) {
      // Lower stratosphere: purple starting to dominate, rust fading
      const t = (atmosphereProgress - 0.08) / 0.10;
      return {
        top: `rgb(${Math.round(14 + t * 2)}, ${Math.round(9 + t * 3)}, ${Math.round(33 + t * 7)})`,
        mid: `rgb(${Math.round(40 - t * 5)}, ${Math.round(20 + t * 3)}, ${Math.round(40 + t * 3)})`,
        bottom: `rgb(${Math.round(50 - t * 8)}, ${Math.round(25 - t * 2)}, ${Math.round(40 + t * 2)})`,
      };
    } else if (atmosphereProgress < 0.30) {
      // Upper stratosphere: cooler purples, hints of teal entering
      const t = (atmosphereProgress - 0.18) / 0.12;
      return {
        top: `rgb(${Math.round(16 - t * 4)}, ${Math.round(12 - t * 2)}, ${Math.round(40 - t * 5)})`,
        mid: `rgb(${Math.round(35 - t * 10)}, ${Math.round(23 - t * 5)}, ${Math.round(43 - t * 5)})`,
        bottom: `rgb(${Math.round(42 - t * 12)}, ${Math.round(23 - t * 6)}, ${Math.round(42 - t * 8)})`,
      };
    } else if (atmosphereProgress < 0.45) {
      // Mesosphere: deep blue-purple, warmth nearly gone
      const t = (atmosphereProgress - 0.30) / 0.15;
      return {
        top: `rgb(${Math.round(12 - t * 5)}, ${Math.round(10 - t * 4)}, ${Math.round(35 - t * 10)})`,
        mid: `rgb(${Math.round(25 - t * 10)}, ${Math.round(18 - t * 8)}, ${Math.round(38 - t * 13)})`,
        bottom: `rgb(${Math.round(30 - t * 14)}, ${Math.round(17 - t * 8)}, ${Math.round(34 - t * 12)})`,
      };
    } else if (atmosphereProgress < 0.60) {
      // Lower thermosphere: last atmospheric glow
      const t = (atmosphereProgress - 0.45) / 0.15;
      return {
        top: `rgb(${Math.round(7 - t * 3)}, ${Math.round(6 - t * 3)}, ${Math.round(25 - t * 12)})`,
        mid: `rgb(${Math.round(15 - t * 7)}, ${Math.round(10 - t * 5)}, ${Math.round(25 - t * 12)})`,
        bottom: `rgb(${Math.round(16 - t * 8)}, ${Math.round(9 - t * 4)}, ${Math.round(22 - t * 10)})`,
      };
    } else if (atmosphereProgress < 0.75) {
      // Upper thermosphere: transition to void
      const t = (atmosphereProgress - 0.60) / 0.15;
      return {
        top: `rgb(${Math.round(4 - t * 2)}, ${Math.round(3 - t * 1)}, ${Math.round(13 - t * 8)})`,
        mid: `rgb(${Math.round(8 - t * 4)}, ${Math.round(5 - t * 2)}, ${Math.round(13 - t * 7)})`,
        bottom: `rgb(${Math.round(8 - t * 4)}, ${Math.round(5 - t * 2)}, ${Math.round(12 - t * 6)})`,
      };
    } else if (atmosphereProgress < 0.90) {
      // Exosphere: near-void, only faintest traces of color
      const t = (atmosphereProgress - 0.75) / 0.15;
      return {
        top: `rgb(${Math.round(2 - t * 1)}, ${Math.round(2 - t * 1)}, ${Math.round(5 - t * 3)})`,
        mid: `rgb(${Math.round(4 - t * 2)}, ${Math.round(3 - t * 1)}, ${Math.round(6 - t * 3)})`,
        bottom: `rgb(${Math.round(4 - t * 2)}, ${Math.round(3 - t * 1)}, ${Math.round(6 - t * 3)})`,
      };
    } else {
      // Deep space: the void - essentially black
      return {
        top: '#010102',
        mid: '#020203',
        bottom: '#030204',
      };
    }
  };

  const atmosphereColors = getAtmosphereGradient();

  // Heat shimmer intensity - only visible at low altitudes (ground level to lower stratosphere)
  // Peaks at ground level and fades completely by 0.25 atmosphere progress
  const heatShimmerIntensity = atmosphereProgress < 0.25
    ? Math.max(0, 1 - atmosphereProgress / 0.25) * 0.5
    : 0;

  // Star visibility increases with altitude
  const starOpacity = 0.2 + atmosphereProgress * 0.6;

  // Horizon glow fades as we leave atmosphere - darker ember glow
  const horizonGlowOpacity = Math.max(0, 0.35 - atmosphereProgress * 0.45);

  // Deep space effects kick in at high multipliers (20x+)
  // Using a separate scale: 20x=0%, 50x=40%, 100x=55%, 500x=85%, 2000x=100%
  const deepSpaceProgress = maxCurrentMultiplier > 20
    ? Math.min(Math.log10(maxCurrentMultiplier / 20) / Math.log10(100), 1)
    : 0;

  // Nebula glow intensity - cosmic clouds appearing in deep space
  const nebulaOpacity = deepSpaceProgress * 0.35;

  // Extra bright stars at extreme distances - starts appearing early
  const cosmicStarIntensity = deepSpaceProgress;

  // Calculate actual net return: (winners * target) / total rockets
  const netReturn = rocketStates.length > 0 && targetMultiplier
    ? (rocketsSucceeded * targetMultiplier) / rocketStates.length
    : 0;
  const isProfit = netReturn >= 1.0;

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full rounded-lg border border-pure-white/20 shadow-2xl overflow-hidden crash-canvas-container ${
        isOrientationTransitioning ? 'orientation-transitioning' : ''
      }`}
      style={{
        // Three-color gradient for smoother atmosphere transitions
        background: `linear-gradient(to bottom, ${atmosphereColors.top} 0%, ${atmosphereColors.mid} 50%, ${atmosphereColors.bottom} 100%)`,
        // Smooth transitions for background and orientation changes
        transition: isOrientationTransitioning
          ? 'background 0.3s ease-out, opacity 0.3s ease-out, transform 0.3s ease-out'
          : 'background 0.5s ease-out',
        // Subtle fade during orientation transition to mask layout shifts
        opacity: isOrientationTransitioning ? 0.85 : 1,
      }}
    >
      {/* Heat shimmer effect - subtle atmospheric distortion at low altitudes */}
      {heatShimmerIntensity > 0 && (
        <div
          className="absolute bottom-0 left-0 right-0 h-1/5 pointer-events-none"
          style={{
            background: `linear-gradient(to top, rgba(255, 180, 120, ${heatShimmerIntensity * 0.15}), transparent)`,
            animation: 'heatShimmer 3s ease-in-out infinite',
            mixBlendMode: 'overlay',
          }}
        />
      )}

      {/* Horizon glow effect - layered for smoother transition */}
      {/* Layer 1: Inner warm glow (closest to horizon) */}
      <div
        className="absolute bottom-0 left-0 right-0 h-1/6 pointer-events-none"
        style={{
          background: `linear-gradient(to top, rgba(90, 40, 50, ${horizonGlowOpacity * 1.2}), rgba(70, 30, 55, ${horizonGlowOpacity * 0.6}), transparent)`,
          transition: 'opacity 0.5s ease-out',
        }}
      />
      {/* Layer 2: Outer atmospheric glow (extends further up) */}
      <div
        className="absolute bottom-0 left-0 right-0 h-1/4 pointer-events-none"
        style={{
          background: `linear-gradient(to top, rgba(60, 25, 55, ${horizonGlowOpacity * 0.7}), rgba(40, 15, 45, ${horizonGlowOpacity * 0.3}), transparent)`,
          transition: 'opacity 0.5s ease-out',
        }}
      />
      {/* Layer 3: Subtle ambient glow (highest layer, very faint) */}
      <div
        className="absolute bottom-0 left-0 right-0 h-1/3 pointer-events-none"
        style={{
          background: `linear-gradient(to top, rgba(35, 15, 50, ${horizonGlowOpacity * 0.35}), transparent 70%)`,
          transition: 'opacity 0.5s ease-out',
        }}
      />

      {/* Stars Background - visibility increases with altitude, parallax drift at high multipliers */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ opacity: starOpacity, transition: 'opacity 0.3s ease-out' }}
      >
        {stars.map(star => {
          // Calculate parallax drift offset based on multiplier progress
          // Drift only kicks in at high multipliers (100x+) for subtle effect
          const driftProgress = maxCurrentMultiplier > 100
            ? Math.min(Math.log10(maxCurrentMultiplier / 100) / Math.log10(20), 1)
            : 0;
          // Max drift of 15px for near stars, scaled by layer's driftSpeed
          const driftOffset = driftProgress * star.driftSpeed * 15;

          return (
            <div
              key={star.id}
              className="absolute rounded-full bg-white"
              style={{
                left: star.style.left,
                top: star.style.top,
                width: star.style.width,
                height: star.style.height,
                opacity: star.style.opacity,
                // Layer-specific twinkle duration and parallax transform
                animation: `twinkle-${star.layer} ${star.twinkleDuration}s ease-in-out infinite`,
                animationDelay: star.style.animationDelay,
                // Apply horizontal drift for parallax effect (stars appear to pass by)
                transform: driftOffset > 0 ? `translateX(-${driftOffset}px)` : undefined,
                transition: 'transform 0.5s ease-out',
              }}
            />
          );
        })}
      </div>

      {/* Deep space nebula effect - appears at high multipliers with drift animation */}
      {deepSpaceProgress > 0 && (
        <>
          {/* Purple/blue nebula cloud - top left - drifts slowly */}
          <div
            className="absolute pointer-events-none"
            style={{
              top: '10%',
              left: '5%',
              width: '40%',
              height: '35%',
              background: `radial-gradient(ellipse at center, rgba(60, 20, 80, ${nebulaOpacity}) 0%, rgba(30, 15, 60, ${nebulaOpacity * 0.5}) 40%, transparent 70%)`,
              filter: 'blur(30px)',
              animation: 'nebulaDrift1 18s ease-in-out infinite',
            }}
          />
          {/* Cyan/teal nebula wisp - right side - counter-drifts */}
          <div
            className="absolute pointer-events-none"
            style={{
              top: '30%',
              right: '10%',
              width: '30%',
              height: '40%',
              background: `radial-gradient(ellipse at center, rgba(20, 50, 70, ${nebulaOpacity * 0.8}) 0%, rgba(15, 35, 55, ${nebulaOpacity * 0.4}) 50%, transparent 75%)`,
              filter: 'blur(25px)',
              animation: 'nebulaDrift2 22s ease-in-out infinite',
            }}
          />
          {/* Distant galaxy cluster glow - bottom - has translateX(-50%) in animation */}
          <div
            className="absolute pointer-events-none"
            style={{
              bottom: '15%',
              left: '50%',
              width: '25%',
              height: '20%',
              background: `radial-gradient(ellipse at center, rgba(80, 40, 100, ${nebulaOpacity * 0.6}) 0%, transparent 60%)`,
              filter: 'blur(20px)',
              animation: 'nebulaDrift3 25s ease-in-out infinite',
            }}
          />
          {/* Deep cosmic veil - appears at extreme multipliers (500x+) with color variation */}
          {maxCurrentMultiplier > 500 && (
            <>
              {/* Intense magenta/violet cosmic veil - upper right */}
              <div
                className="absolute pointer-events-none"
                style={{
                  top: '5%',
                  right: '15%',
                  width: '35%',
                  height: '30%',
                  background: `radial-gradient(ellipse at center, rgba(100, 30, 120, ${Math.min((maxCurrentMultiplier - 500) / 1500, 1) * 0.4}) 0%, rgba(60, 20, 90, ${Math.min((maxCurrentMultiplier - 500) / 1500, 1) * 0.2}) 50%, transparent 75%)`,
                  filter: 'blur(35px)',
                  animation: 'nebulaDrift4 15s ease-in-out infinite',
                }}
              />
              {/* Deep blue cosmic dust - lower left */}
              <div
                className="absolute pointer-events-none"
                style={{
                  bottom: '25%',
                  left: '10%',
                  width: '30%',
                  height: '25%',
                  background: `radial-gradient(ellipse at center, rgba(30, 40, 90, ${Math.min((maxCurrentMultiplier - 500) / 1500, 1) * 0.35}) 0%, transparent 65%)`,
                  filter: 'blur(28px)',
                  animation: 'nebulaDrift2 20s ease-in-out infinite reverse',
                }}
              />
            </>
          )}
          {/* Bright cosmic stars - appear in deep space (starts ~30x) */}
          {cosmicStarIntensity > 0.1 && (
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              {/* A few bright distant stars */}
              <div
                className="absolute rounded-full"
                style={{
                  top: '15%',
                  left: '70%',
                  width: '4px',
                  height: '4px',
                  backgroundColor: `rgba(200, 220, 255, ${cosmicStarIntensity * 0.9})`,
                  boxShadow: `0 0 ${8 * cosmicStarIntensity}px rgba(200, 220, 255, ${cosmicStarIntensity * 0.6})`,
                }}
              />
              <div
                className="absolute rounded-full"
                style={{
                  top: '45%',
                  left: '20%',
                  width: '3px',
                  height: '3px',
                  backgroundColor: `rgba(255, 230, 200, ${cosmicStarIntensity * 0.8})`,
                  boxShadow: `0 0 ${6 * cosmicStarIntensity}px rgba(255, 230, 200, ${cosmicStarIntensity * 0.5})`,
                }}
              />
              <div
                className="absolute rounded-full"
                style={{
                  top: '70%',
                  left: '80%',
                  width: '3px',
                  height: '3px',
                  backgroundColor: `rgba(180, 200, 255, ${cosmicStarIntensity * 0.85})`,
                  boxShadow: `0 0 ${7 * cosmicStarIntensity}px rgba(180, 200, 255, ${cosmicStarIntensity * 0.5})`,
                }}
              />
              <div
                className="absolute rounded-full"
                style={{
                  top: '25%',
                  left: '35%',
                  width: '2px',
                  height: '2px',
                  backgroundColor: `rgba(255, 200, 180, ${cosmicStarIntensity * 0.7})`,
                  boxShadow: `0 0 ${5 * cosmicStarIntensity}px rgba(255, 200, 180, ${cosmicStarIntensity * 0.4})`,
                }}
              />
            </div>
          )}
        </>
      )}

      <canvas
        ref={canvasRef}
        width={size.width}
        height={size.height}
        className="relative z-10 w-full h-full"
      />

      {/* Rocket Elements - only render when images are preloaded to prevent placeholder text */}
      {imagesReady && rocketStates.map((rocket) => {
        const pos = rocketPositions.get(rocket.index);
        if (!pos) return null;

        // Get the unique design number for this rocket (1-10)
        const designNum = rocketDesigns.get(rocket.index) || 1;

        // Calculate rocket size based on canvas height (responsive)
        const rocketSize = Math.round(size.height * ROCKET_SIZE_PERCENT);

        // Show crash label for high-flyers (10x+)
        const showCrashLabel = rocket.isCrashed && rocket.crashPoint >= 10;

        return (
          <div
            key={rocket.index}
            className="absolute pointer-events-none"
            style={{
              left: `${pos.xPercent}%`,
              top: `${pos.yPercent}%`,
              transform: `translate(-50%, -50%) rotate(${pos.angle}deg)`,
              zIndex: rocket.isCrashed ? Z_INDEX.ROCKETS_CRASHED : Z_INDEX.ROCKETS_FLYING,
            }}
          >
            <img
              src={rocket.isCrashed ? getCrashedImage(designNum) : getRocketImage(designNum)}
              alt=""
              style={{
                height: `${rocketSize}px`,
                width: 'auto', // Preserve aspect ratio
                filter: rocket.isCrashed
                  ? 'drop-shadow(0 0 6px rgba(255, 100, 0, 0.4))'
                  : 'drop-shadow(0 0 5px rgba(255, 200, 100, 0.35))'
              }}
            />
            {/* Crash point label for high-flyers (10x+) */}
            {showCrashLabel && (
              <div
                className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap animate-in fade-in zoom-in duration-300"
                style={{
                  bottom: `${rocketSize + 8}px`,
                  transform: `translateX(-50%) rotate(${-pos.angle}deg)`, // Counter-rotate to keep text upright
                }}
              >
                <div
                  className="px-2 py-1 rounded text-xs font-bold font-mono"
                  style={{
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    color: rocket.crashPoint >= 50 ? '#FFD700' : '#FF6B6B',
                    border: `1px solid ${rocket.crashPoint >= 50 ? '#FFD700' : '#FF6B6B'}`,
                    boxShadow: `0 0 8px ${rocket.crashPoint >= 50 ? 'rgba(255, 215, 0, 0.5)' : 'rgba(255, 107, 107, 0.5)'}`,
                  }}
                >
                  {rocket.crashPoint.toFixed(2)}x
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Pre-launch rockets - slide onto starting line while waiting for backend */}
      {imagesReady && isWaitingForBackend && rocketStates.length === 0 && preLaunchDesigns.map((designNum, i) => {
        // Calculate rocket size based on canvas height (responsive)
        const rocketSize = Math.round(size.height * ROCKET_SIZE_PERCENT);

        // All rockets start at the same point: X=10%, Y=88% (multiplier 1.0)
        // This matches exactly where flight rockets begin
        const xPercent = 10; // X_START_PERCENT * 100
        const yPercent = (1 - Y_BOTTOM_MARGIN) * 100; // 88%

        // Stagger hover animation timing per rocket for organic feel
        const slideInDuration = 300;
        const slideInDelay = i * 150;
        const hoverDelay = slideInDelay + slideInDuration; // Start hover after slide-in completes
        const hoverDuration = 1.5 + (i % 3) * 0.3; // Vary duration: 1.5s, 1.8s, 2.1s
        const warmupDuration = 0.8 + (i % 4) * 0.15; // Vary warmup: 0.8s, 0.95s, 1.1s, 1.25s

        return (
          <div
            key={`prelaunch-${i}`}
            className="absolute pointer-events-none"
            style={{
              left: `${xPercent}%`,
              top: `${yPercent}%`,
              // Rocket PNGs point UP, rotate 90deg to point RIGHT (horizontal)
              transform: 'translate(-50%, -50%) rotate(90deg)',
              zIndex: Z_INDEX.ROCKETS_FLYING + i,
              // Chain animations: slide in first, then subtle hover bob
              animation: `slideInFromLeft ${slideInDuration}ms ease-out ${slideInDelay}ms both, rocketHover ${hoverDuration}s ease-in-out ${hoverDelay}ms infinite`,
            }}
          >
            <img
              src={getRocketImage(designNum)}
              alt=""
              style={{
                height: `${rocketSize}px`,
                width: 'auto',
                // Engine warmup glow animation with staggered timing
                animation: `engineWarmup ${warmupDuration}s ease-in-out ${slideInDelay}ms infinite`,
              }}
            />
          </div>
        );
      })}

      {/* Current Multiplier Display */}
      <div className="absolute top-8 left-1/2 -translate-x-1/2 text-center z-30">
        {allCrashed ? (
          <>
            {/* Show net return when game ends */}
            <div className={`text-5xl font-bold font-mono ${isProfit ? 'text-green-400' : 'text-red-500'} drop-shadow-lg`}>
              {netReturn.toFixed(2)}x
            </div>
            <div className={`font-bold text-lg mt-1 ${isProfit ? 'text-green-300' : 'text-red-300'}`}>
              NET RETURN
            </div>
            <div className={`font-bold text-xl mt-2 ${rocketsSucceeded > 0 ? 'text-green-400' : 'text-red-400'}`}>
              {rocketsSucceeded}/{rocketStates.length} reached {targetMultiplier?.toFixed(2)}x
            </div>
          </>
        ) : (
          <>
            {/* Show live max multiplier during flight */}
            <div className="text-5xl font-bold font-mono text-white drop-shadow-lg">
              {maxCurrentMultiplier.toFixed(2)}x
            </div>
          </>
        )}
      </div>

      {/* Rocket count indicator */}
      {rocketStates.length > 0 && (
        <div className="absolute top-2 right-2 flex gap-1 z-30">
          {rocketStates.map((rocket) => (
            <div
              key={rocket.index}
              className={`w-3 h-3 rounded-full ${rocket.isCrashed ? 'opacity-30' : ''}`}
              style={{ backgroundColor: ROCKET_COLORS[rocket.index % ROCKET_COLORS.length] }}
            />
          ))}
        </div>
      )}

      {/* Axes labels */}
      <div className="absolute bottom-2 right-2 text-xs text-pure-white/40 font-mono">
        Time
      </div>
      <div className="absolute top-2 left-2 text-xs text-pure-white/40 font-mono">
        Multiplier
      </div>

      {/* Cosmic Encounters Layer - behind rockets, in front of canvas */}
      <div
        className="absolute inset-0 pointer-events-none overflow-hidden"
        style={{ zIndex: Z_INDEX.ENCOUNTERS }}
      >
        {encounters.map(encounter => {
          const now = Date.now();
          const elapsed = now - encounter.startTime;
          const elapsedSeconds = elapsed / 1000;
          const progress = elapsed / encounter.duration;

          if (progress >= 1) return null;

          // Calculate drifted position
          const currentX = encounter.x + encounter.velocityX * elapsedSeconds;
          const currentY = encounter.y + encounter.velocityY * elapsedSeconds;

          // Skip if drifted off screen
          if (currentX < -10 || currentX > 110 || currentY < -10 || currentY > 110) return null;

          // Fade in for first 15%, full opacity middle, fade out last 20%
          let opacity = 1;
          if (progress < 0.15) {
            opacity = progress / 0.15;
          } else if (progress > 0.8) {
            opacity = (1 - progress) / 0.2;
          }

          const visual = getEncounterVisual(encounter.type);

          // Determine animation class using pre-defined Sets
          let animClass = 'cosmic-encounter';
          if (SPIN_ENCOUNTER_TYPES.has(encounter.type)) {
            animClass = 'cosmic-encounter-spin';
          } else if (WOBBLE_ENCOUNTER_TYPES.has(encounter.type)) {
            animClass = 'cosmic-encounter-wobble';
          }
          if (RARE_ENCOUNTER_TYPES.has(encounter.type)) {
            animClass += ' cosmic-encounter-rare';
          }

          return (
            // Outer wrapper handles position, inner span handles animation
            // aria-hidden since encounters are decorative
            <div
              key={encounter.id}
              className="absolute"
              aria-hidden="true"
              style={{
                left: `${currentX}%`,
                top: `${currentY}%`,
                transform: `translate(-50%, -50%)`,
              }}
            >
              <span
                className={animClass}
                style={{
                  display: 'inline-block',
                  transform: `scale(${encounter.scale})`,
                  opacity: opacity,
                  fontSize: `${visual.size}px`,
                  filter: `drop-shadow(0 0 ${visual.size / 3}px ${visual.color})`,
                  textShadow: `0 0 10px ${visual.color}, 0 0 20px ${visual.color}`,
                }}
              >
                {visual.emoji}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

function drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 1;

  for (let i = 0; i <= 4; i++) {
    const y = height - (i * height / 4);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}

function drawTargetLine(
  ctx: CanvasRenderingContext2D,
  targetMultiplier: number,
  width: number,
  height: number
) {
  const logMult = Math.log10(targetMultiplier);
  const logMax = Math.log10(100);
  // Use same Y margins as rockets for consistent positioning
  const yProgress = Math.min(logMult / logMax, 1);
  const y = height * (1 - Y_BOTTOM_MARGIN - yProgress * Y_RANGE);

  // Green dashed line at target
  ctx.strokeStyle = '#22C55E';
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 5]);
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(width, y);
  ctx.stroke();
  ctx.setLineDash([]);

  // Label
  ctx.fillStyle = '#22C55E';
  ctx.font = 'bold 12px monospace';
  ctx.fillText(`TARGET ${targetMultiplier.toFixed(2)}x`, width - 120, y - 5);
}

// Star layer configuration for parallax depth effect
interface StarLayerConfig {
  count: number;
  sizeRange: [number, number]; // [min, max] in px
  opacityRange: [number, number]; // [min, max] opacity
  twinkleDuration: number; // seconds
  driftSpeed: number; // 0 = no drift, higher = faster parallax drift at high multipliers
}

interface Star {
  id: string;
  layer: 'distant' | 'mid' | 'near';
  style: {
    left: string;
    top: string;
    width: string;
    height: string;
    opacity: number;
    animationDelay: string;
  };
  driftSpeed: number;
  twinkleDuration: number;
}

// Generate stars with three depth layers for parallax effect
function generateStarLayers(): Star[] {
  const layers: Record<'distant' | 'mid' | 'near', StarLayerConfig> = {
    distant: {
      count: 60,
      sizeRange: [0.5, 1],
      opacityRange: [0.2, 0.4],
      twinkleDuration: 4, // Slower twinkle for distant stars
      driftSpeed: 0, // No drift - these are infinitely far
    },
    mid: {
      count: 30,
      sizeRange: [1, 2],
      opacityRange: [0.4, 0.7],
      twinkleDuration: 2.5, // Medium twinkle
      driftSpeed: 0.3, // Subtle drift
    },
    near: {
      count: 15,
      sizeRange: [2, 3],
      opacityRange: [0.7, 1],
      twinkleDuration: 1.5, // Faster twinkle for near stars
      driftSpeed: 0.8, // More noticeable parallax
    },
  };

  const allStars: Star[] = [];

  (Object.keys(layers) as Array<'distant' | 'mid' | 'near'>).forEach((layerName) => {
    const config = layers[layerName];
    for (let i = 0; i < config.count; i++) {
      const size = config.sizeRange[0] + Math.random() * (config.sizeRange[1] - config.sizeRange[0]);
      const opacity = config.opacityRange[0] + Math.random() * (config.opacityRange[1] - config.opacityRange[0]);

      allStars.push({
        id: `${layerName}-${i}`,
        layer: layerName,
        style: {
          left: `${Math.random() * 100}%`,
          top: `${Math.random() * 100}%`,
          width: `${size}px`,
          height: `${size}px`,
          opacity,
          animationDelay: `${Math.random() * config.twinkleDuration}s`,
        },
        driftSpeed: config.driftSpeed,
        twinkleDuration: config.twinkleDuration,
      });
    }
  });

  return allStars;
}
