import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GameInfo } from '../config/gameRegistry';

interface GameCardProps {
  game?: GameInfo;
  loading?: boolean;
}

// Loading skeleton component
const GameCardSkeleton: React.FC = () => (
  <div className="game-card relative">
    {/* Icon and title skeleton */}
    <div className="flex items-center gap-3 mb-2">
      <motion.div
        className="w-12 h-12 bg-gray-800 rounded-lg flex-shrink-0"
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      />
      <motion.div
        className="h-8 w-32 bg-gray-800 rounded"
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1.5, repeat: Infinity, delay: 0.1 }}
      />
    </div>
    {/* Description skeleton */}
    <motion.div
      className="h-4 w-full bg-gray-800 rounded mb-2"
      animate={{ opacity: [0.5, 1, 0.5] }}
      transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}
    />
    <motion.div
      className="h-4 w-3/4 bg-gray-800 rounded mb-4"
      animate={{ opacity: [0.5, 1, 0.5] }}
      transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
    />
    {/* Stats skeleton */}
    <div className="space-y-2 text-sm">
      {[0.4, 0.5, 0.6].map((delay, i) => (
        <div key={i} className="flex justify-between">
          <motion.div
            className="h-4 w-16 bg-gray-800 rounded"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity, delay }}
          />
          <motion.div
            className="h-4 w-12 bg-gray-800 rounded"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: delay + 0.1 }}
          />
        </div>
      ))}
    </div>
  </div>
);

export const GameCard: React.FC<GameCardProps> = ({ game, loading = false }) => {
  const navigate = useNavigate();

  // Show skeleton if loading or no game data
  if (loading || !game) {
    return <GameCardSkeleton />;
  }

  const handleClick = () => {
    if (!game.comingSoon) {
      navigate(game.path);
    }
  };

  return (
    <motion.div
      className={`game-card relative ${game.comingSoon ? 'opacity-60 cursor-not-allowed' : ''}`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyPress={(e) => {
        if (e.key === 'Enter' && !game.comingSoon) navigate(game.path);
      }}
      whileHover={game.comingSoon ? undefined : { y: -4, boxShadow: "0 10px 40px rgba(57, 255, 20, 0.15)" }}
      whileTap={game.comingSoon ? undefined : { scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
    >
      {game.comingSoon && (
        <div className="absolute top-4 right-4 bg-yellow-500 text-black px-3 py-1 rounded-full text-xs font-bold">
          COMING SOON
        </div>
      )}
      <div className="flex items-center gap-3 mb-2">
        {game.icon.startsWith('/') ? (
          <img src={game.icon} alt={game.name} className="w-12 h-12 flex-shrink-0" />
        ) : (
          <span className="text-5xl flex-shrink-0">{game.icon}</span>
        )}
        <h2 className="text-2xl font-bold whitespace-nowrap">{game.name}</h2>
        {game.badge && !game.comingSoon && (
          <span className="bg-purple-600 text-white px-2 py-1 rounded text-xs font-semibold whitespace-nowrap">
            {game.badge}
          </span>
        )}
      </div>
      <p className="text-gray-400 mb-4">{game.description}</p>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-400">Min Bet:</span>
          <span className="font-semibold">${game.minBet}</span>
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
    </motion.div>
  );
};
