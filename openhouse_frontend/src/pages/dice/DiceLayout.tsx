import { Outlet, Link, useLocation } from 'react-router-dom';

export function DiceLayout() {
  const location = useLocation();
  const isLiquidityRoute = location.pathname.includes('/liquidity');
  const isPlayRoute = !isLiquidityRoute;

  return (
    <div className={`h-full flex flex-col ${isPlayRoute ? 'overflow-hidden' : ''}`}>
      {/* Tab Navigation */}
      <div className="flex gap-3 mb-2 border-b border-gray-700 flex-shrink-0">
        <Link
          to="/dice"
          className={`px-3 py-1.5 text-sm -mb-px transition-colors ${
            !isLiquidityRoute
              ? 'border-b-2 border-dfinity-turquoise text-white'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          🎲 Play Game
        </Link>
        <Link
          to="/dice/liquidity"
          className={`px-3 py-1.5 text-sm -mb-px transition-colors ${
            isLiquidityRoute
              ? 'border-b-2 border-dfinity-turquoise text-white'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          💰 Be The House
        </Link>
      </div>

      {/* Render child route (DiceGame or DiceLiquidity) */}
      <div className={`flex-1 ${isPlayRoute ? 'overflow-hidden min-h-0' : ''}`}>
        <Outlet />
      </div>
    </div>
  );
}