import React from 'react';
import { useNavigate } from 'react-router-dom';
import { GameCard } from '../components/GameCard';
import { OnboardingBanner } from '../components/OnboardingBanner';
import { PortfolioCard } from '../components/PortfolioCard';
import { LifeGameCard } from '../components/LifeGameCard';
import { getHomeGamesInfo, getLiquidityGames } from '../config/gameRegistry';

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const games = getHomeGamesInfo();
  const liquidityPoolCount = getLiquidityGames().length;

  return (
    <div>
      <OnboardingBanner context="home" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <PortfolioCard />
        {games.map((game) => (
          <GameCard key={game.id} game={game} />
        ))}
        <LifeGameCard />
      </div>

      {/* Be The House CTA */}
      <div className="mt-8">
        <button
          onClick={() => navigate('/liquidity')}
          className="w-full game-card bg-gradient-to-r from-dfinity-turquoise/10 via-purple-500/10 to-orange-500/10 border-dfinity-turquoise/30 hover:border-dfinity-turquoise/50 transition-all"
        >
          <div className="flex items-center justify-center gap-3 mb-2">
            <span className="text-3xl">🏦</span>
            <h2 className="text-2xl font-bold text-white">Be The House</h2>
          </div>
          <p className="text-gray-400 mb-4">
            Provide liquidity to game pools and earn the 1% house edge
          </p>
          <div className="flex justify-center gap-6 text-sm">
            <div className="text-center">
              <div className="text-dfinity-turquoise font-bold">{liquidityPoolCount} Pools</div>
              <div className="text-gray-500 text-xs">Available</div>
            </div>
            <div className="text-center">
              <div className="text-green-400 font-bold">1% Edge</div>
              <div className="text-gray-500 text-xs">House Advantage</div>
            </div>
            <div className="text-center">
              <div className="text-purple-400 font-bold">Real-time</div>
              <div className="text-gray-500 text-xs">APY Tracking</div>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
};
