import { DailySnapshot, ChartDataPoint } from '../types/liquidity';

// Constants
export const CURRENCY_DECIMALS = 1_000_000; // USDT has 6 decimals
export const SHARE_PRICE_DECIMALS = 100_000_000; // Share price has 8 decimals
export const DAYS_IN_YEAR = 365;
export const MIN_SHARE_PRICE_THRESHOLD = 50; // Threshold to detect old buggy share prices

/**
 * Safe division that handles division by zero
 */
export const safeDiv = (numerator: number, denominator: number): number => {
  if (denominator === 0) return 0;
  return numerator / denominator;
};

/**
 * Process raw daily snapshots into chart data points
 * Including bug fixes for old data and accurate house profit calculation
 */
export const processChartData = (snapshots: DailySnapshot[]): ChartDataPoint[] => {
  if (!snapshots || !Array.isArray(snapshots) || snapshots.length === 0) return [];

  return snapshots.map((s, index) => {
    try {
      // Defensive timestamp conversion
      const dateMs = Number(s.day_timestamp / 1_000_000n);
      
      // Share Price Logic (with bugfix for old data)
      let sharePriceRaw = Number(s.share_price);
      if (sharePriceRaw > 0 && sharePriceRaw < MIN_SHARE_PRICE_THRESHOLD) {
        sharePriceRaw = sharePriceRaw * 100;
      }
      const currentSharePrice = safeDiv(sharePriceRaw, SHARE_PRICE_DECIMALS);
      
      // Pool Reserve
      const poolReserve = safeDiv(Number(s.pool_reserve_end), CURRENCY_DECIMALS);
      
      // Determine Previous Share Price & Shares
      let prevSharePrice = currentSharePrice;
      let prevPoolReserve = poolReserve;
      
      if (index > 0) {
        const prevS = snapshots[index - 1];
        let prevSharePriceRaw = Number(prevS.share_price);
        if (prevSharePriceRaw > 0 && prevSharePriceRaw < MIN_SHARE_PRICE_THRESHOLD) {
          prevSharePriceRaw = prevSharePriceRaw * 100;
        }
        prevSharePrice = safeDiv(prevSharePriceRaw, SHARE_PRICE_DECIMALS);
        prevPoolReserve = safeDiv(Number(prevS.pool_reserve_end), CURRENCY_DECIMALS);
      }

      // Calculate Share Price Change
      const sharePriceChange = currentSharePrice - prevSharePrice;
      const sharePriceChangePercent = prevSharePrice > 0
        ? (sharePriceChange / prevSharePrice) * 100
        : 0;

      // Calculate House Profit
      // FIX: Use PREVIOUS day's shares to calculate profit.
      // The profit/loss from price change applies to the shares that existed *before* the change.
      // Deposits/Withdrawals during the day affect the *end* reserve, but shouldn't affect the *price* change profit calculation 
      // on the *new* capital until the next day.
      // Shares = Reserve / SharePrice
      const estimatedPrevShares = safeDiv(prevPoolReserve, prevSharePrice);
      
      // Note: For day 0, sharePriceChange is 0, so houseProfit is 0.
      const houseProfit = sharePriceChange * estimatedPrevShares;

      return {
        date: new Date(dateMs),
        dateLabel: new Date(dateMs).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        poolReserve: poolReserve,
        volume: safeDiv(Number(s.daily_volume), CURRENCY_DECIMALS),
        netFlow: safeDiv(Number(s.daily_pool_profit), CURRENCY_DECIMALS),
        houseProfit,
        houseProfitPercent: sharePriceChangePercent,
        sharePrice: currentSharePrice,
        sharePriceChange,
        sharePriceChangePercent,
      };
    } catch (err) {
      console.error("Error processing snapshot:", err, s);
      // Return a safe fallback or filter this out later if needed
      // For now, returning zeroed data to avoid crashing UI
      return {
        date: new Date(),
        dateLabel: 'Error',
        poolReserve: 0,
        volume: 0,
        netFlow: 0,
        houseProfit: 0,
        houseProfitPercent: 0,
        sharePrice: 0,
        sharePriceChange: 0,
        sharePriceChangePercent: 0,
      };
    }
  });
};

/**
 * Calculate APY based on share price returns over actual data period
 *
 * @param chartData - Array of chart data points with share prices
 * @param targetDays - How many days of data to use (7, 30, etc.)
 * @returns Annualized percentage yield based on share price change
 */
export const calculateAccurateApy = (
  chartData: ChartDataPoint[],
  targetDays: number
): number => {
  // Need at least 2 points to calculate a return
  if (!chartData || chartData.length < 2) return 0;

  // Get the relevant slice of data (last N days)
  const activeData = chartData.slice(-targetDays);

  if (activeData.length < 2) return 0;

  const startPrice = activeData[0].sharePrice;
  const endPrice = activeData[activeData.length - 1].sharePrice;

  // Can't calculate return if start price is zero or negative
  if (startPrice <= 0) return 0;

  const returnRate = (endPrice - startPrice) / startPrice;

  // Calculate actual time span in days based on timestamps
  const startTime = activeData[0].date.getTime();
  const endTime = activeData[activeData.length - 1].date.getTime();
  const actualDays = (endTime - startTime) / (1000 * 60 * 60 * 24);

  // Prevent division by zero or extremely small timeframes
  if (actualDays < 0.5) return 0;

  // Annualize based on ACTUAL days of data we have
  // If we have 7 days of data, both 7-day and 30-day APY will show the same
  // because that's the only data we have. This is accurate and honest.
  return returnRate * (DAYS_IN_YEAR / actualDays) * 100;
};
