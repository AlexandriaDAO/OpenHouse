import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Layout } from '../../components/Layout';
import { 
  RouletteWheel, 
  RouletteBettingTable, 
  RouletteResultPopup, 
  mapUIBetToBackend, 
  getWinningZones 
} from '../../components/game-specific/roulette';
import { BettingRail } from '../../components/betting/BettingRail';
import useRouletteActor from '../../hooks/actors/useRouletteActor';
import useLedgerActor from '../../hooks/actors/useLedgerActor';
import { useAuth } from '../../providers/AuthProvider';
import { useBalance } from '../../providers/BalanceProvider';
import { useGameBalance } from '../../providers/GameBalanceProvider';
import { formatUSDT } from '../../types/balance';
import type { Bet, SpinResult } from '../../declarations/roulette_backend/roulette_backend.did';

export default function RouletteGame() {
  // Actors
  const { actor } = useRouletteActor();
  const { actor: ledgerActor } = useLedgerActor();
  const { principal } = useAuth();

  // Balance
  const { walletBalance } = useBalance();
  const gameBalanceContext = useGameBalance('roulette');
  const balance = gameBalanceContext.balances || { game: 0n, house: 0n }; // Fallback

  // Betting state
  const [betAmount, setBetAmount] = useState(0.01);
  const [placedBets, setPlacedBets] = useState<Array<{ zoneId: string, amount: bigint }>>([]);
  const [totalBetAmount, setTotalBetAmount] = useState(0n);

  // Game state
  const [isSpinning, setIsSpinning] = useState(false);
  const [spinResult, setSpinResult] = useState<SpinResult | null>(null);
  const [showResultPopup, setShowResultPopup] = useState(false);
  const [gameError, setGameError] = useState('');

  // Wheel animation
  const [targetNumber, setTargetNumber] = useState<number | null>(null);

  // Visual feedback
  const [hoveredZone, setHoveredZone] = useState<string | null>(null);
  const [winningZones, setWinningZones] = useState<string[]>([]);

  // Refs
  const maxBet = useRef(1000n); // TODO: Calculate from house balance

  // Update total bet amount when bets change
  useEffect(() => {
    const total = placedBets.reduce((sum, bet) => sum + bet.amount, 0n);
    setTotalBetAmount(total);
  }, [placedBets]);

  // Handle bet placement
  const handleBetClick = (zoneId: string) => {
    if (isSpinning) return;

    // Check max 20 bets
    if (placedBets.length >= 20) {
      setGameError('Maximum 20 bets per spin');
      return;
    }

    // Add bet
    const betAmountBigInt = BigInt(Math.floor(betAmount * 1e8));
    if (betAmountBigInt === 0n) {
        setGameError('Bet amount too small');
        return;
    }
    
    // Check balance for this specific addition? 
    // Usually checked at spin, but good UX to check now.
    // We check against Game Balance.
    if (totalBetAmount + betAmountBigInt > balance.game) {
        setGameError('Insufficient game balance');
        return;
    }

    setPlacedBets([...placedBets, { zoneId, amount: betAmountBigInt }]);
    setGameError('');
  };

  // Handle chip removal
  const handleChipClick = (zoneId: string) => {
    if (isSpinning) return;
    // Remove last bet with this zoneId
    const index = placedBets.findLastIndex(bet => bet.zoneId === zoneId);
    if (index !== -1) {
      const newBets = [...placedBets];
      newBets.splice(index, 1);
      setPlacedBets(newBets);
    }
  };

  // Handle spin
  const handleSpin = async () => {
    if (!actor || placedBets.length === 0) return;

    try {
      setIsSpinning(true);
      setGameError('');
      setWinningZones([]);
      setShowResultPopup(false);

      // Validate balance
      if (totalBetAmount > balance.game) {
        throw new Error('Insufficient balance');
      }

      // Convert UI bets to backend format
      const backendBets: Bet[] = placedBets.map(bet =>
        mapUIBetToBackend(bet.zoneId, bet.amount)
      );

      // Call backend
      const result = await actor.spin(backendBets);

      if ('Err' in result) {
        throw new Error(result.Err);
      }

      const spinResult = result.Ok;
      setSpinResult(spinResult);
      setTargetNumber(spinResult.winning_number);

      // Wheel animation will complete, then onSpinComplete fires

    } catch (error: any) {
      setGameError(error.message || 'Spin failed');
      setIsSpinning(false);
    }
  };

  // Handle spin animation complete
  const handleSpinComplete = () => {
    if (!spinResult) return;

    // Calculate winning zones
    const zones = getWinningZones(spinResult);
    setWinningZones(zones);

    // Show result popup
    setShowResultPopup(true);

    // Refresh balance
    gameBalanceContext.fetchBalances();

    // Auto-clear bets after 3 seconds
    setTimeout(() => {
      setPlacedBets([]);
      setIsSpinning(false);
      setWinningZones([]);
      setTargetNumber(null);
    }, 4000);
  };

  return (
    <Layout>
      <div className="flex flex-col min-h-screen bg-gradient-to-b from-[#050505] to-[#0a0a14]">
        {/* Wheel section */}
        <div className="flex-shrink-0 py-4">
          <RouletteWheel
            targetNumber={targetNumber}
            isSpinning={isSpinning}
            onSpinComplete={handleSpinComplete}
          />
        </div>

        {/* Spin button */}
        <div className="flex justify-center py-2 relative z-20">
          <button
            onClick={handleSpin}
            disabled={isSpinning || placedBets.length === 0}
            className={`
                px-16 py-4 rounded-full font-bold text-xl tracking-wider
                transition-all duration-300 transform hover:scale-105
                ${isSpinning || placedBets.length === 0 
                    ? 'bg-gray-800 text-gray-500 cursor-not-allowed' 
                    : 'bg-dfinity-turquoise text-black shadow-[0_0_20px_rgba(57,255,20,0.5)] hover:shadow-[0_0_30px_rgba(57,255,20,0.8)]'}
            `}
          >
            {isSpinning ? 'SPINNING...' : `SPIN (${formatUSDT(totalBetAmount)})`}
          </button>
        </div>

        {/* Betting table */}
        <div className="flex-1 px-4 flex items-center justify-center pb-32">
          <RouletteBettingTable
            placedBets={placedBets}
            onBetClick={handleBetClick}
            onChipClick={handleChipClick}
            hoveredZone={hoveredZone}
            onHover={setHoveredZone}
            winningZones={winningZones}
          />
        </div>

        {/* Error display */}
        <AnimatePresence>
            {gameError && (
              <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="fixed top-24 left-1/2 transform -translate-x-1/2 bg-red-500/90 text-white px-6 py-3 rounded-lg border border-red-400 shadow-lg z-50"
              >
                {gameError}
              </motion.div>
            )}
        </AnimatePresence>

        {/* Result popup */}
        <RouletteResultPopup
          show={showResultPopup}
          spinResult={spinResult}
          onHide={() => setShowResultPopup(false)}
        />
      </div>

      {/* Betting rail (bottom fixed) */}
      <BettingRail
        betAmount={betAmount}
        onBetChange={setBetAmount}
        maxBet={Number(maxBet.current) / 1e8}
        gameBalance={balance.game}
        walletBalance={walletBalance}
        houseBalance={balance.house}
        ledgerActor={ledgerActor}
        gameActor={actor}
        onBalanceRefresh={() => gameBalanceContext.fetchBalances()}
        disabled={isSpinning}
        multiplier={35} // Max payout (straight bet)
        canisterId={'wvrcw-3aaaa-aaaah-arm4a-cai'}
        isBalanceLoading={gameBalanceContext.isLoading}
        isBalanceInitialized={gameBalanceContext.isInitialized}
      />
    </Layout>
  );
}