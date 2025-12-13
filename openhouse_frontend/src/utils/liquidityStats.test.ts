import { processChartData, calculateAccurateApy } from './liquidityStats';
import { DailySnapshot } from '../types/liquidity';

// Mock data helper
const createSnapshot = (
  day: number, 
  sharePrice: number, 
  poolReserve: number
): DailySnapshot => ({
  day_timestamp: BigInt(day * 24 * 60 * 60 * 1_000_000 * 1000), // ms to ns
  share_price: BigInt(sharePrice * 100_000_000),
  pool_reserve_end: BigInt(poolReserve * 1_000_000),
  daily_volume: BigInt(1000 * 1_000_000),
  daily_pool_profit: BigInt(0)
});

describe('Liquidity Stats Utils', () => {
  describe('calculateAccurateApy', () => {
    it('should calculate conservative APY for short timeframes', () => {
      const snapshots = [
        createSnapshot(0, 1.0, 1000),
        createSnapshot(2, 1.02, 1020) // 2% gain in 2 days
      ];
      
      const chartData = processChartData(snapshots);
      
      // 2% in 2 days.
      // If we naively extrapolated: 2% * (365/2) = 365% APY.
      // With conservative 30-day target: 2% * (365/30) = ~24.3% APY.
      const apy30 = calculateAccurateApy(chartData, 30);
      
      expect(apy30).toBeCloseTo(24.33, 1);
    });

    it('should calculate standard APY for long timeframes', () => {
      const snapshots = [
        createSnapshot(0, 1.0, 1000),
        createSnapshot(30, 1.02, 1020) // 2% gain in 30 days
      ];
      
      const chartData = processChartData(snapshots);
      
      // 2% in 30 days.
      // 2% * (365/30) = ~24.3% APY.
      const apy30 = calculateAccurateApy(chartData, 30);
      
      expect(apy30).toBeCloseTo(24.33, 1);
    });
    
    it('should return 0 for insufficient data', () => {
      const snapshots = [createSnapshot(0, 1.0, 1000)];
      const chartData = processChartData(snapshots);
      const apy = calculateAccurateApy(chartData, 30);
      expect(apy).toBe(0);
    });
  });

  describe('processChartData', () => {
    it('should correctly calculate house profit using previous shares', () => {
      // Day 0: Reserve 1000, Price 1.0 -> Shares 1000
      // Day 1: Reserve 1100, Price 1.1 -> Price +10%. House Profit should be based on 1000 shares.
      // Profit = 0.1 * 1000 = 100.
      // (Note: Reserve increased by 100. If it was all profit, it matches).
      
      const snapshots = [
        createSnapshot(0, 1.0, 1000),
        createSnapshot(1, 1.1, 1100)
      ];
      
      const chartData = processChartData(snapshots);
      
      expect(chartData[1].houseProfit).toBeCloseTo(100);
    });

    it('should not count deposits as house profit', () => {
      // Day 0: Reserve 1000, Price 1.0 -> Shares 1000
      // Day 1: Reserve 2000, Price 1.0 -> Price +0%. (Huge deposit).
      // Profit should be 0.
      
      const snapshots = [
        createSnapshot(0, 1.0, 1000),
        createSnapshot(1, 1.0, 2000)
      ];
      
      const chartData = processChartData(snapshots);
      
      expect(chartData[1].houseProfit).toBe(0);
      expect(chartData[1].sharePriceChange).toBe(0);
    });

    it('should handle mixed profit and deposits', () => {
      // Day 0: Reserve 1000, Price 1.0 -> Shares 1000
      // Day 1: Price 1.1 (+10%). House Profit = 100.
      // Reserve is now 2000. (Profit 100 + Deposit 900?).

      const snapshots = [
        createSnapshot(0, 1.0, 1000),
        createSnapshot(1, 1.1, 2000)
      ];

      const chartData = processChartData(snapshots);

      expect(chartData[1].houseProfit).toBeCloseTo(100);
      expect(chartData[1].poolReserve).toBe(2000);
    });

    it('should filter out pre-initialization days with zero share price', () => {
      // Day 0: share_price = 0 (pre-initialization, should be filtered)
      // Day 1: share_price = 1.0 (first valid day, should be baseline with 0% change)
      // Day 2: share_price = 1.1 (normal day with 10% gain)

      const snapshots = [
        createSnapshot(0, 0, 0),      // Pre-init: should be filtered out
        createSnapshot(1, 1.0, 1000), // First valid day
        createSnapshot(2, 1.1, 1100)  // Normal gain
      ];

      const chartData = processChartData(snapshots);

      // Should only have 2 data points (filtered out day 0)
      expect(chartData.length).toBe(2);

      // First valid day should be baseline (0% change)
      expect(chartData[0].sharePrice).toBeCloseTo(1.0);
      expect(chartData[0].sharePriceChangePercent).toBe(0);
      expect(chartData[0].houseProfit).toBe(0);

      // Second day should show normal 10% gain
      expect(chartData[1].sharePrice).toBeCloseTo(1.1);
      expect(chartData[1].sharePriceChangePercent).toBeCloseTo(10);
      expect(chartData[1].houseProfit).toBeCloseTo(100);
    });

    it('should return empty array if all days have zero share price', () => {
      const snapshots = [
        createSnapshot(0, 0, 0),
        createSnapshot(1, 0, 0)
      ];

      const chartData = processChartData(snapshots);

      expect(chartData.length).toBe(0);
    });
  });
});
