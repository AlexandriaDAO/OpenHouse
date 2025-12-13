import { useState, useEffect, useMemo } from 'react';
import { GameType } from '../../types/balance';
import { ApyInfo, DailySnapshot } from '../../types/liquidity';
import { useGameActor } from '../actors/useGameActor';
import { processChartData, calculateAccurateApy } from '../../utils/liquidityStats';

export function useApyData(gameId: GameType) {
  const [apy7Backend, setApy7Backend] = useState<ApyInfo | null>(null);
  const [snapshots, setSnapshots] = useState<DailySnapshot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { actor, isReady } = useGameActor(gameId);

  useEffect(() => {
    const fetchApy = async () => {
      if (!actor || !isReady) return;

      setIsLoading(true);
      setError(null);
      try {
        // Fetch both backend APY (for expected) and snapshots (for accurate APY)
        const [apyResult, snapshotsResult] = await Promise.all([
          actor.get_pool_apy([7]),
          actor.get_daily_stats(7),
        ]);
        setApy7Backend(apyResult);
        setSnapshots(snapshotsResult);
      } catch (err) {
        console.error(`APY fetch error for ${gameId}:`, err);
        setError(err instanceof Error ? err.message : 'Failed to load APY');
      } finally {
        setIsLoading(false);
      }
    };

    fetchApy();
  }, [actor, isReady, gameId]);

  // Calculate accurate APY from share price (filters zero share price days)
  const accurateApy7 = useMemo(() => {
    const chartData = processChartData(snapshots);
    return calculateAccurateApy(chartData, 7);
  }, [snapshots]);

  // Return both: accurateApy7 for display, apy7Backend for expected APY info
  return {
    apy7: accurateApy7,           // The correct APY to display
    apy7Backend,                   // Backend data (for expected APY, volume info)
    isLoading,
    error
  };
}
