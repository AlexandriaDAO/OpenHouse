import React, { useEffect, useState, useCallback, useRef } from 'react';
import usePlinkoActor from '../hooks/actors/usePlinkoActor';
import { GameLayout } from '../components/game-ui';
import { PlinkoBoard } from '../components/game-specific/plinko';

// Game Constants
const ROWS = 8;
const ANIMATION_SAFETY_TIMEOUT_MS = 15000;

type GamePhase = 'idle' | 'filling' | 'releasing' | 'animating' | 'complete';

interface PlinkoGameResult {
  path: boolean[];
  final_position: number;
  multiplier: number;
  win: boolean;
  timestamp: number;
}

interface MultiBallBackendResult {
  results: {
    path: boolean[];
    final_position: number;
    multiplier: number;
    win: boolean;
  }[];
  total_balls: number;
  total_wins: number;
  average_multiplier: number;
}

// Helper to delay execution
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const Plinko: React.FC = () => {
  const { actor } = usePlinkoActor();

  // Game phase state machine
  const [gamePhase, setGamePhase] = useState<GamePhase>('idle');
  const [fillProgress, setFillProgress] = useState(0);
  const [doorOpen, setDoorOpen] = useState(false);
  const [isWaitingForBackend, setIsWaitingForBackend] = useState(false);
  const [pendingPaths, setPendingPaths] = useState<boolean[][] | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [gameError, setGameError] = useState('');
  const [ballCount, setBallCount] = useState<number>(1);
  const [multipliers, setMultipliers] = useState<number[]>([]);
  const [formula, setFormula] = useState<string>('');
  const [expectedValue, setExpectedValue] = useState<number>(0);
  const [currentResult, setCurrentResult] = useState<PlinkoGameResult | null>(null);
  const [multiBallResult, setMultiBallResult] = useState<MultiBallBackendResult | null>(null);
  const [showInfoModal, setShowInfoModal] = useState(false);

  // Ref to track if fill animation is complete
  const fillCompleteRef = useRef(false);

  // Load game data on mount
  useEffect(() => {
    const loadGameData = async () => {
      if (!actor) return;

      try {
        const [multsBp, formulaText, ev] = await Promise.all([
          // @ts-ignore
          actor.get_multipliers_bp ? actor.get_multipliers_bp() : actor.get_multipliers(),
          actor.get_formula(),
          actor.get_expected_value()
        ]);

        let finalMults: number[];
        if (multsBp && multsBp.length > 0 && typeof multsBp[0] === 'bigint') {
          finalMults = multsBp.map((bp: bigint) => Number(bp) / 10000);
        } else {
          finalMults = multsBp as number[];
        }

        setMultipliers(finalMults);
        setFormula(formulaText);
        setExpectedValue(ev);
      } catch (err) {
        console.error('Failed to load game data:', err);
      }
    };

    loadGameData();
  }, [actor]);

  // Safety timeout
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    if (isPlaying) {
      timeoutId = setTimeout(() => {
        console.warn('Game animation timed out - forcing reset');
        setIsPlaying(false);
        setGameError('Game response timed out. Please refresh if stuck.');
      }, ANIMATION_SAFETY_TIMEOUT_MS);
    }
    return () => clearTimeout(timeoutId);
  }, [isPlaying]);

  // Run fill animation - fills bucket during backend delay
  const runFillAnimation = async (targetCount: number): Promise<void> => {
    return new Promise(resolve => {
      let filled = 0;
      const intervalTime = Math.max(40, 1200 / targetCount); // 1.2 seconds total, min 40ms between balls

      const interval = setInterval(() => {
        filled++;
        setFillProgress(filled);
        if (filled >= targetCount) {
          clearInterval(interval);
          fillCompleteRef.current = true;
          resolve();
        }
      }, intervalTime);
    });
  };

  const dropBalls = async () => {
    if (!actor) return;

    // Reset state
    setGamePhase('filling');
    setFillProgress(0);
    setDoorOpen(false);
    setIsWaitingForBackend(false);
    setPendingPaths(null);
    fillCompleteRef.current = false;
    setIsPlaying(true);
    setGameError('');
    setMultiBallResult(null);
    setCurrentResult(null);

    try {
      // Start backend request
      const backendPromise = ballCount === 1
        ? actor.drop_ball()
        : actor.drop_multiple_balls(ballCount);

      // Run fill animation in parallel
      const fillPromise = runFillAnimation(ballCount);

      // Wait for fill to complete
      await fillPromise;

      // If backend not ready yet, show waiting state
      setIsWaitingForBackend(true);

      // Wait for backend
      const result = await backendPromise;

      setIsWaitingForBackend(false);

      // Handle result
      let extractedPaths: boolean[][] = [];

      if (ballCount === 1) {
        if ('Ok' in result) {
          const gameResult: PlinkoGameResult = {
            ...result.Ok,
            timestamp: Date.now(),
          };
          setCurrentResult(gameResult);
          extractedPaths = [gameResult.path];
        } else {
          setGameError(result.Err);
          setGamePhase('idle');
          setIsPlaying(false);
          setFillProgress(0);
          return;
        }
      } else {
        if ('Ok' in result) {
          setMultiBallResult(result.Ok);
          extractedPaths = result.Ok.results.map(r => r.path);
        } else {
          setGameError(result.Err);
          setGamePhase('idle');
          setIsPlaying(false);
          setFillProgress(0);
          return;
        }
      }

      // Store paths for physics
      setPendingPaths(extractedPaths);

      // Open door and start release animation
      setGamePhase('releasing');
      setDoorOpen(true);

      // Wait for door to open and balls to fall through
      await delay(400);

      // Clear balls from bucket (they've animated out)
      setFillProgress(0);

      // Start physics animation
      setGamePhase('animating');

    } catch (err) {
      console.error('Failed to drop balls:', err);
      setGameError(err instanceof Error ? err.message : 'Failed to drop balls');
      setGamePhase('idle');
      setIsPlaying(false);
      setFillProgress(0);
    }
  };

  const handleAnimationComplete = useCallback(() => {
    setIsPlaying(false);
    setGamePhase('complete');
    setDoorOpen(false);
    // Reset to idle after a brief moment
    setTimeout(() => setGamePhase('idle'), 500);
  }, []);

  const houseEdge = ((1 - expectedValue) * 100).toFixed(2);

  return (
    <GameLayout hideFooter noScroll>
      <div className="flex-1 flex flex-col max-w-3xl mx-auto px-4 overflow-hidden min-h-0 w-full">

        {/* Ball count slider - compact */}
        <div className="flex-shrink-0 py-3">
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 uppercase tracking-wide">Balls</span>
            <input
              type="range"
              min="1"
              max="30"
              value={ballCount}
              onChange={(e) => setBallCount(Number(e.target.value))}
              disabled={isPlaying}
              className="flex-1 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer
                       disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <span className="text-sm text-white font-mono w-6 text-right">{ballCount}</span>
          </div>
        </div>

        {/* Game Board with integrated bucket */}
        <div className="flex-1 flex justify-center items-start py-2 min-h-0">
          <PlinkoBoard
            rows={ROWS}
            paths={pendingPaths}
            isDropping={gamePhase === 'animating'}
            onAnimationComplete={handleAnimationComplete}
            finalPositions={
              ballCount === 1
                ? (currentResult ? [currentResult.final_position] : [])
                : (multiBallResult?.results.map(r => r.final_position) || [])
            }
            multipliers={multipliers}
            ballCount={ballCount}
            onDrop={dropBalls}
            disabled={!actor || gamePhase !== 'idle'}
            gamePhase={gamePhase}
            fillProgress={fillProgress}
            doorOpen={doorOpen}
            isWaitingForBackend={isWaitingForBackend}
          />
        </div>

        {/* Result display - compact */}
        <div className="h-8 flex items-center justify-center flex-shrink-0">
          {!isPlaying && currentResult && (
            <span className={`text-sm font-bold ${currentResult.win ? 'text-green-400' : 'text-red-400'}`}>
              {currentResult.win ? 'WIN' : 'LOST'} {currentResult.multiplier.toFixed(2)}x
            </span>
          )}
          {!isPlaying && multiBallResult && (
            <span className="text-xs text-gray-300">
              AVG {multiBallResult.average_multiplier.toFixed(2)}x
              ({multiBallResult.total_wins}/{multiBallResult.total_balls} wins)
            </span>
          )}
        </div>

        {/* Error display */}
        {gameError && (
          <div className="text-red-400 text-xs text-center py-1 flex-shrink-0">
            {gameError}
          </div>
        )}

        {/* Info button */}
        <div className="flex justify-end py-2 flex-shrink-0">
          <button
            onClick={() => setShowInfoModal(true)}
            className="w-7 h-7 rounded-full bg-gray-800 hover:bg-gray-700
                     text-gray-500 hover:text-white transition-colors text-xs"
          >
            ?
          </button>
        </div>
      </div>

      {/* Info Modal */}
      {showInfoModal && (
        <InfoModal
          onClose={() => setShowInfoModal(false)}
          formula={formula}
          houseEdge={houseEdge}
          expectedValue={expectedValue}
          multipliers={multipliers}
        />
      )}
    </GameLayout>
  );
};

interface InfoModalProps {
  onClose: () => void;
  formula: string;
  houseEdge: string;
  expectedValue: number;
  multipliers: number[];
}

const InfoModal: React.FC<InfoModalProps> = (props) => {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
         onClick={props.onClose}>
      <div className="bg-gray-900 rounded-xl p-6 max-w-lg w-full border border-gray-700"
           onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white">How Plinko Works</h3>
          <button onClick={props.onClose} className="text-gray-400 hover:text-white text-2xl">&times;</button>
        </div>

        <div className="text-sm text-gray-300 space-y-4">
          <div>
            <p className="font-semibold text-white mb-1">The Formula</p>
            <code className="text-sm font-mono text-dfinity-turquoise bg-black/50 px-3 py-1 rounded block">
              {props.formula || 'M(k) = 0.2 + 6.32 × ((k-4)/4)²'}
            </code>
          </div>

          <div>
            <p className="font-semibold text-white mb-1">House Edge</p>
            <p>{props.houseEdge}% (Expected Value: {props.expectedValue.toFixed(4)})</p>
          </div>

          <div>
            <p className="font-semibold text-white mb-1">Probability Distribution</p>
            <p className="font-mono text-xs text-gray-400">
              0.4% | 3.1% | 10.9% | 21.9% | 27.3% | 21.9% | 10.9% | 3.1% | 0.4%
            </p>
          </div>

          <div>
            <p className="font-semibold text-white mb-1">Win Zones</p>
            <p>
              <span className="text-green-400">Edges (29%)</span> = Win (1x+) |
              <span className="text-red-400 ml-1">Center (71%)</span> = Loss (&lt;1x)
            </p>
          </div>

          <div>
            <p className="font-semibold text-white mb-1">Multipliers</p>
            <div className="flex flex-wrap gap-1">
              {props.multipliers.map((m, i) => (
                <span key={i} className={`text-xs px-2 py-1 rounded ${m >= 1 ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
                  {m.toFixed(2)}x
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
