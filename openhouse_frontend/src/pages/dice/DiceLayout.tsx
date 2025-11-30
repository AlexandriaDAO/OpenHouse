import { Outlet, useLocation } from 'react-router-dom';

export function DiceLayout() {
  const location = useLocation();
  const isPlayRoute = !location.pathname.includes('/liquidity');

  return (
    <div className={`h-full flex flex-col ${isPlayRoute ? 'overflow-hidden' : 'overflow-y-auto'}`}>
      {/* Render child route (DiceGame or DiceLiquidity) */}
      <div className={`flex-1 ${isPlayRoute ? 'overflow-hidden min-h-0' : 'overflow-y-auto'}`}>
        <Outlet />
      </div>
    </div>
  );
}