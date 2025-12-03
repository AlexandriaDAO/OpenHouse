import React from 'react';
import { useNavigate } from 'react-router-dom';
import { GameInfo } from '../types';

interface GameCardProps {
  game: GameInfo;
}

export const GameCard: React.FC<GameCardProps> = ({ game }) => {
  const navigate = useNavigate();

  const handleClick = () => {
    if (!game.comingSoon) {
      navigate(game.path);
    }
  };

  return (
    <div
      className={`game-card relative ${game.comingSoon ? 'opacity-60 cursor-not-allowed' : ''}`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyPress={(e) => {
        if (e.key === 'Enter' && !game.comingSoon) navigate(game.path);
      }}
    >
      {game.comingSoon && (
        <div className="absolute top-4 right-4 bg-yellow-500 text-black px-3 py-1 rounded-full text-xs font-bold">
          COMING SOON
        </div>
      )}
      <div className="text-4xl mb-4">{game.icon}</div>
      <div className="flex items-center justify-center gap-2 mb-2">
        <h2 className="text-2xl font-bold">{game.name}</h2>
        {game.badge && !game.comingSoon && (
          <span className="bg-purple-600 text-white px-2 py-1 rounded text-xs font-semibold">
            {game.badge}
          </span>
        )}
      </div>
      <p className="text-gray-400 mb-4">{game.description}</p>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-400">Min Bet:</span>
          <span className="font-semibold">{game.minBet} USDT</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Max Win:</span>
          <span className="font-semibold text-casino-highlight">{game.maxWin}x</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">House Edge:</span>
          <span className="font-semibold">{game.houseEdge}%</span>
        </div>
      </div>
    </div>
  );
};
