import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';

export function DiceLayout() {
  const location = useLocation();
  const isLiquidityRoute = location.pathname.includes('/liquidity');

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Tab Navigation */}
      <div className="flex gap-4 mb-6 border-b border-gray-700">
        <Link
          to="/dice"
          className={`px-4 py-2 -mb-px transition-colors ${
            !isLiquidityRoute
              ? 'border-b-2 border-dfinity-turquoise text-white'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          🎲 Play Game
        </Link>
        <Link
          to="/dice/liquidity"
          className={`px-4 py-2 -mb-px transition-colors ${
            isLiquidityRoute
              ? 'border-b-2 border-dfinity-turquoise text-white'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          💰 Become an Owner
        </Link>
      </div>

      {/* Render child route (DiceGame or DiceLiquidity) */}
      <Outlet />
    </div>
  );
}
