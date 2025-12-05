import { useState, useEffect, useCallback, useMemo } from 'react';
import useDiceActor from '../../../../hooks/actors/useDiceActor';
import type { DailySnapshot, ApyInfo } from '../../../../declarations/dice_backend/dice_backend.did';

export type Period = 7 | 30 | 90;

export interface ChartDataPoint {
  date: Date;
  dateLabel: string;
  poolReserve: number;
  volume: number;
  netFlow: number; // Renamed from profit
  houseProfit: number;
  houseProfitPercent: number;
  sharePrice: number;
  sharePriceChange: number;
  sharePriceChangePercent: number;
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
    return snapshots.map((s, index) => {
      // Safe BigInt to Number conversion
      const dateMs = Number(s.day_timestamp / 1_000_000n);

      // Currency values (pool_reserve, volume, profit) use 6 decimals
      const currencyDecimals = 1_000_000;

      // Share price uses 8 decimals (per backend comment: "divide by 100_000_000 for USDT per share")
      const sharePriceDecimals = 100_000_000;

      // BUGFIX: Old snapshots from before 2025-11-29 were calculated with wrong formula (missing *100)
      // Detect and fix: if share_price is suspiciously low (< 50), apply 100x correction
      let sharePriceRaw = Number(s.share_price);
      if (sharePriceRaw > 0 && sharePriceRaw < 50) {
        // This is old buggy data - apply correction factor
        sharePriceRaw = sharePriceRaw * 100;
      }
      const currentSharePrice = sharePriceRaw / sharePriceDecimals;
      const poolReserve = Number(s.pool_reserve_end) / currencyDecimals;

      // Get previous day's share price (or current if first day)
      let prevSharePriceRaw = 0;
      if (index > 0) {
        const prevS = snapshots[index - 1];
        prevSharePriceRaw = Number(prevS.share_price);
        if (prevSharePriceRaw > 0 && prevSharePriceRaw < 50) {
          prevSharePriceRaw = prevSharePriceRaw * 100;
        }
      } else {
        prevSharePriceRaw = sharePriceRaw;
      }
      const prevSharePrice = prevSharePriceRaw / sharePriceDecimals;

      // Calculate share price change
      const sharePriceChange = currentSharePrice - prevSharePrice;
      const sharePriceChangePercent = prevSharePrice > 0
        ? (sharePriceChange / prevSharePrice) * 100
        : 0;

      // Calculate true house profit
      const estimatedShares = currentSharePrice > 0
        ? poolReserve / currentSharePrice
        : 0;
      const houseProfit = sharePriceChange * estimatedShares;

      return {
        date: new Date(dateMs),
        dateLabel: new Date(dateMs).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        poolReserve: poolReserve,
        volume: Number(s.daily_volume) / currencyDecimals,
        netFlow: Number(s.daily_pool_profit) / currencyDecimals,
        houseProfit,
        houseProfitPercent: sharePriceChangePercent,
        sharePrice: currentSharePrice,
        sharePriceChange,
        sharePriceChangePercent,
      };
    });
  }, [snapshots]);

  // NEW: Calculate accurate APY from share price returns
  const accurateApy = useMemo(() => {
    if (chartData.length < 2) return { apy7: 0, apy30: 0 };

    // Helper to calculate APY for N days
    const calculateApy = (days: number) => {
      const activeData = chartData.slice(-days);
      if (activeData.length < 2) return 0;
      
      const startPrice = activeData[0].sharePrice;
      const endPrice = activeData[activeData.length - 1].sharePrice;
      
      if (startPrice <= 0) return 0;
      
      const returnRate = (endPrice - startPrice) / startPrice;
      return returnRate * (365 / activeData.length) * 100;
    };

    return { 
      apy7: calculateApy(7), 
      apy30: calculateApy(30) 
    };
  }, [chartData]);

  return {
    period,
    setPeriod,
    isLoading,
    error,
    chartData,
    apy7,
    apy30,
    accurateApy,
    hasData: chartData.length >= 1,
    refetch: fetchData
  };
};
