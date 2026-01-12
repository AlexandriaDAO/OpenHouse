import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

export const LifeGameCard: React.FC = () => {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate('/life');
  };

  return (
    <motion.div
      className="game-card relative overflow-hidden group"
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyPress={(e) => {
        if (e.key === 'Enter') navigate('/life');
      }}
      whileHover={{ y: -4, boxShadow: "0 10px 40px rgba(147, 51, 234, 0.2)" }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
    >
      {/* Subtle gradient background */}
      <div
        className="absolute inset-0 opacity-10 group-hover:opacity-20 transition-opacity"
        style={{
          background: 'linear-gradient(135deg, #FF4500 0%, #9932CC 50%, #00BFFF 100%)',
        }}
      />

      {/* Badges */}
      <div className="absolute top-4 right-4 flex flex-col gap-1 items-end">
        <div className="bg-purple-500 text-white px-3 py-1 rounded-full text-xs font-bold">
          EARLY ACCESS
        </div>
        <div className="bg-cyan-700/80 text-cyan-200 px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1">
          <span>Mobile Ready</span>
        </div>
      </div>

      {/* Content matching GameCard structure */}
      <div className="relative z-10">
        {/* Title with SVG icon */}
        <div className="flex items-center gap-3 mb-2">
          <img src="/icons/life.svg" alt="Conway's Life" className="w-12 h-12 flex-shrink-0" />
          <h2 className="text-2xl font-bold whitespace-nowrap">Conway's Life</h2>
        </div>

        {/* Description */}
        <p className="text-gray-400 mb-4">Cellular automata with elemental warfare</p>

        {/* Stats - same structure as GameCard */}
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Players:</span>
            <span className="font-semibold">Up to 8</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Grid:</span>
            <span className="font-semibold text-purple-400">512 x 512</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Stakes:</span>
            <span className="font-semibold text-green-400">Free to play</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
