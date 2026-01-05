import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../providers/AuthProvider';
import { useGameBalance } from '../providers/GameBalanceProvider';
import { GAME_REGISTRY, GameConfig } from '../config/gameRegistry';
import { LPPosition } from '../types/liquidity';
import { decimalsToUSDT } from '../types/ledger';
import useDiceActor from '../hooks/actors/useDiceActor';
import usePlinkoActor from '../hooks/actors/usePlinkoActor';
import useCrashActor from '../hooks/actors/useCrashActor';
import useRouletteActor from '../hooks/actors/useRouletteActor';

interface GameBalanceData {
  config: GameConfig;
  chips: bigint;
  lpValue: bigint;
}

export const PortfolioCard: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const gameBalance = useGameBalance();
  const { actor: diceActor } = useDiceActor();
  const { actor: plinkoActor } = usePlinkoActor();
  const { actor: crashActor } = useCrashActor();
  const { actor: rouletteActor } = useRouletteActor();

  const [gameData, setGameData] = useState<GameBalanceData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    const fetchBalances = async () => {
      const liveGames = Object.values(GAME_REGISTRY).filter(
        (g) => g.status === 'live' || g.status === 'admin_only'
      );

      const dataPromises = liveGames.map(async (config): Promise<GameBalanceData> => {
        try {
          let actor: any;
          switch (config.id) {
            case 'dice':
              actor = diceActor;
              break;
            case 'plinko':
              actor = plinkoActor;
              break;
            case 'crash':
              actor = crashActor;
              break;
            case 'roulette':
              actor = rouletteActor;
              break;
          }

          if (!actor) {
            return { config, chips: 0n, lpValue: 0n };
          }

          const balance = gameBalance.getBalance(config.id);

          let lpPosition: LPPosition = {
            shares: 0n,
            pool_ownership_percent: 0,
            redeemable_usdt: 0n,
          };

          try {
            lpPosition = await actor.get_my_lp_position();
          } catch {
            // LP position fetch failed, use defaults
          }

          return {
            config,
            chips: balance.game,
            lpValue: lpPosition.redeemable_usdt,
          };
        } catch {
          return { config, chips: 0n, lpValue: 0n };
        }
      });

      const data = await Promise.all(dataPromises);
      setGameData(data);
      setLoading(false);
    };

    fetchBalances();
  }, [isAuthenticated, diceActor, plinkoActor, crashActor, rouletteActor, gameBalance]);

  // Don't render if not authenticated
  if (!isAuthenticated) return null;

  const totalChips = gameData.reduce((sum, g) => sum + g.chips, 0n);
  const totalLP = gameData.reduce((sum, g) => sum + g.lpValue, 0n);
  const grandTotal = totalChips + totalLP;

  // Don't render if no balances
  if (!loading && grandTotal === 0n) return null;

  return (
    <button
      onClick={() => navigate('/wallet')}
      className="game-card bg-gradient-to-br from-green-500/10 via-emerald-500/5 to-transparent border-green-500/30 hover:border-green-500/50 transition-all text-left w-full"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
          <span className="text-2xl">💰</span>
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Your Portfolio</h2>
          <p className="text-xs text-gray-400">Chips & LP across games</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          <div className="h-4 bg-gray-700/50 rounded animate-pulse w-3/4"></div>
          <div className="h-4 bg-gray-700/50 rounded animate-pulse w-1/2"></div>
        </div>
      ) : (
        <>
          <div className="space-y-2 mb-4">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-gray-400">
                <span className="w-5 h-5 bg-blue-500/20 text-blue-400 rounded flex items-center justify-center text-xs">
                  🎲
                </span>
                Chips
              </span>
              <span className="font-mono text-white">
                {decimalsToUSDT(totalChips).toFixed(2)} USDT
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-gray-400">
                <span className="w-5 h-5 bg-green-500/20 text-green-400 rounded flex items-center justify-center text-xs">
                  💎
                </span>
                LP Value
              </span>
              <span className="font-mono text-white">
                {decimalsToUSDT(totalLP).toFixed(2)} USDT
              </span>
            </div>
          </div>

          <div className="border-t border-white/10 pt-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white">Total</span>
              <span className="font-mono font-bold text-green-400 text-lg">
                {decimalsToUSDT(grandTotal).toFixed(2)} USDT
              </span>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-400 group-hover:text-green-400 transition-colors">
            <span>View Details</span>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </>
      )}
    </button>
  );
};
