import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import useDiceActor from '../../../hooks/actors/useDiceActor';
import type { DailySnapshot, ApyInfo } from '../../../declarations/dice_backend/dice_backend.did';

// DFINITY brand colors
const COLORS = {
  primary: '#29ABE2',    // Turquoise
  positive: '#00E19B',   // Green
  negative: '#ED0047',   // Red
  grid: 'rgba(255,255,255,0.1)',
  text: '#E6E6E6',
};

// Period options
type Period = 7 | 30 | 90;

// Transform bigint data for charts
const transformData = (snapshots: DailySnapshot[]) => {
  return [...snapshots].reverse().map(s => ({
    date: new Date(Number(s.day_timestamp) / 1_000_000),
    dateLabel: new Date(Number(s.day_timestamp) / 1_000_000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    poolReserve: Number(s.pool_reserve_end) / 1_000_000,
    volume: Number(s.daily_volume) / 1_000_000,
    profit: Number(s.daily_pool_profit) / 1_000_000,
    sharePrice: Number(s.share_price) / 1_000_000,
  }));
};

export const DiceStatisticsSection: React.FC = () => {
  // State
  const [isExpanded, setIsExpanded] = useState(false);
  const [period, setPeriod] = useState<Period>(30);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<DailySnapshot[]>([]);
  const [apy7, setApy7] = useState<ApyInfo | null>(null);
  const [apy30, setApy30] = useState<ApyInfo | null>(null);

  const { actor } = useDiceActor();

  // Fetch data when expanded or period changes
  useEffect(() => {
    if (!isExpanded || !actor) return;

    const fetchData = async () => {
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
        setError(err instanceof Error ? err.message : 'Failed to load statistics');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [isExpanded, period, actor]);

  const chartData = transformData(snapshots);
  const hasData = chartData.length >= 3;

  // Render component
  return (
    <div className="card p-4 mt-6 bg-gray-900/30 border border-gray-700">
      {/* Toggle Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-cyan-600/80 hover:bg-cyan-600 rounded text-white font-mono transition-colors"
      >
        <span>📈</span>
        <span>{isExpanded ? 'Hide' : 'Show'} Pool Statistics</span>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="mt-4 space-y-4">
          {/* Period Selector */}
          <div className="flex gap-2 justify-center">
            {([7, 30, 90] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1 rounded font-mono text-sm transition-colors ${
                  period === p
                    ? 'bg-cyan-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {p}d
              </button>
            ))}
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="text-center text-gray-400 py-8">Loading statistics...</div>
          )}

          {/* Error State */}
          {error && (
            <div className="text-center text-red-400 py-4">{error}</div>
          )}

          {/* Empty State */}
          {!isLoading && !error && !hasData && (
            <div className="text-center text-gray-400 py-8">
              Collecting data... Statistics will appear after a few days of pool activity.
            </div>
          )}

          {/* APY Display */}
          {!isLoading && !error && hasData && apy7 && apy30 && (
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-800/50 rounded p-3 text-center">
                <div className="text-xs text-gray-400 mb-1">7-Day APY</div>
                <div className={`text-xl font-mono ${apy7.actual_apy_percent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {apy7.actual_apy_percent >= 0 ? '+' : ''}{apy7.actual_apy_percent.toFixed(2)}%
                </div>
                <div className="text-xs text-gray-500">
                  Expected: {apy7.expected_apy_percent.toFixed(2)}%
                </div>
              </div>
              <div className="bg-gray-800/50 rounded p-3 text-center">
                <div className="text-xs text-gray-400 mb-1">30-Day APY</div>
                <div className={`text-xl font-mono ${apy30.actual_apy_percent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {apy30.actual_apy_percent >= 0 ? '+' : ''}{apy30.actual_apy_percent.toFixed(2)}%
                </div>
                <div className="text-xs text-gray-500">
                  Expected: {apy30.expected_apy_percent.toFixed(2)}%
                </div>
              </div>
            </div>
          )}

          {/* Charts Grid */}
          {!isLoading && !error && hasData && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Share Price Chart - Hero metric */}
              <div className="bg-gray-800/50 rounded p-3 md:col-span-2">
                <div className="text-xs text-gray-400 mb-2">Share Price (USDT)</div>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={chartData}>
                    <XAxis dataKey="dateLabel" tick={{ fill: COLORS.text, fontSize: 10 }} />
                    <YAxis tick={{ fill: COLORS.text, fontSize: 10 }} domain={['auto', 'auto']} />
                    <Tooltip
                      contentStyle={{ background: '#1f2937', border: 'none' }}
                      labelStyle={{ color: COLORS.text }}
                    />
                    <Line
                      type="monotone"
                      dataKey="sharePrice"
                      stroke={COLORS.primary}
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Pool Reserve Chart */}
              <div className="bg-gray-800/50 rounded p-3">
                <div className="text-xs text-gray-400 mb-2">Pool Reserve (USDT)</div>
                <ResponsiveContainer width="100%" height={150}>
                  <LineChart data={chartData}>
                    <XAxis dataKey="dateLabel" tick={{ fill: COLORS.text, fontSize: 10 }} />
                    <YAxis tick={{ fill: COLORS.text, fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: '#1f2937', border: 'none' }} />
                    <Line type="monotone" dataKey="poolReserve" stroke={COLORS.primary} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Daily Volume Chart */}
              <div className="bg-gray-800/50 rounded p-3">
                <div className="text-xs text-gray-400 mb-2">Daily Volume (USDT)</div>
                <ResponsiveContainer width="100%" height={150}>
                  <BarChart data={chartData}>
                    <XAxis dataKey="dateLabel" tick={{ fill: COLORS.text, fontSize: 10 }} />
                    <YAxis tick={{ fill: COLORS.text, fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: '#1f2937', border: 'none' }} />
                    <Bar dataKey="volume" fill={COLORS.primary} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Daily Profit/Loss Chart */}
              <div className="bg-gray-800/50 rounded p-3 md:col-span-2">
                <div className="text-xs text-gray-400 mb-2">Daily Profit/Loss (USDT)</div>
                <ResponsiveContainer width="100%" height={150}>
                  <BarChart data={chartData}>
                    <XAxis dataKey="dateLabel" tick={{ fill: COLORS.text, fontSize: 10 }} />
                    <YAxis tick={{ fill: COLORS.text, fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: '#1f2937', border: 'none' }} />
                    <Bar dataKey="profit">
                      {chartData.map((entry, index) => (
                        <Cell key={index} fill={entry.profit >= 0 ? COLORS.positive : COLORS.negative} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DiceStatisticsSection;
