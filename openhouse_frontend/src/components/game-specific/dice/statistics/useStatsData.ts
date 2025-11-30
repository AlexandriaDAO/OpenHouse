import { useState, useEffect, useCallback, useMemo } from 'react';
import useDiceActor from '../../../../hooks/actors/useDiceActor';
import type { DailySnapshot, ApyInfo } from '../../../../declarations/dice_backend/dice_backend.did';

export type Period = 7 | 30 | 90;

export interface ChartDataPoint {
  date: Date;
  dateLabel: string;
  poolReserve: number;
  volume: number;
  profit: number;
  sharePrice: number;
}

export const useStatsData = (isExpanded: boolean) => {
  const [period, setPeriod] = useState<Period>(30);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<DailySnapshot[]>([]);
  const [apy7, setApy7] = useState<ApyInfo | null>(null);
  const [apy30, setApy30] = useState<ApyInfo | null>(null);

  const { actor } = useDiceActor();

  const fetchData = useCallback(async () => {
    if (!actor) return;
    
    setIsLoading(true);
    setError(null);
    try {
      const [stats, apy7Result, apy30Result] = await Promise.all([
        actor.get_daily_stats(period),
        actor.get_pool_apy([7]),
        actor.get_pool_apy([30]),
      ]);
      setSnapshots(stats);
      setApy7(apy7Result);
      setApy30(apy30Result);
    } catch (err) {
      console.error("Error fetching stats:", err);
      setError(err instanceof Error ? err.message : 'Failed to load statistics');
    } finally {
      setIsLoading(false);
    }
  }, [actor, period]);

  useEffect(() => {
    if (isExpanded) {
      fetchData();
    }
  }, [isExpanded, fetchData]);

  const chartData = useMemo(() => {
    if (!snapshots) return [];
    return [...snapshots].reverse().map(s => {
      // Safe BigInt to Number conversion
      // Timestamp is nanoseconds. Convert to milliseconds first using BigInt division to avoid precision loss.
      const dateMs = Number(s.day_timestamp / 1_000_000n);

      // Currency values (pool_reserve, volume, profit) use 6 decimals
      const currencyDecimals = 1_000_000;

      // Share price uses 8 decimals (per backend comment: "divide by 100_000_000 for USDT per share")
      const sharePriceDecimals = 100_000_000;

      return {
        date: new Date(dateMs),
        dateLabel: new Date(dateMs).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        poolReserve: Number(s.pool_reserve_end) / currencyDecimals,
        volume: Number(s.daily_volume) / currencyDecimals,
        profit: Number(s.daily_pool_profit) / currencyDecimals,
        sharePrice: Number(s.share_price) / sharePriceDecimals,
      };
    });
  }, [snapshots]);

  return {
    period,
    setPeriod,
    isLoading,
    error,
    chartData,
    apy7,
    apy30,
    hasData: chartData.length >= 1,
    refetch: fetchData
  };
};
