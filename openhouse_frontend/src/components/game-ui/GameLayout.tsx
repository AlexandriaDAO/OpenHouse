import React, { ReactNode } from 'react';

interface GameLayoutProps {
  title?: string;
  icon?: string;
  description?: string;
  children: ReactNode;
  minBet?: number;
  maxWin?: number;
  houseEdge?: number;
  hideFooter?: boolean;
  noScroll?: boolean;
}

export const GameLayout: React.FC<GameLayoutProps> = ({
  title,
  icon,
  description,
  children,
  minBet = 1,
  maxWin = 1000,
  houseEdge = 1,
  hideFooter = false,
  noScroll = false,
}) => {
  return (
    <div className={noScroll ? "h-full flex flex-col overflow-hidden" : "space-y-6"}>
      {/* Game Header */}
      {(title || icon || description) && (
        <div className="text-center flex-shrink-0">
          {icon && <div className="text-6xl mb-4">{icon}</div>}
          {title && <h1 className="text-4xl font-bold mb-2">{title}</h1>}
          {description && <p className="text-gray-400">{description}</p>}
        </div>
      )}

      {/* Game Content */}
      <div className={noScroll ? "flex-1 flex flex-col min-h-0" : ""}>
        {children}
      </div>

      {/* Game Info Footer */}
      {!hideFooter && (
        <div className="text-center text-xs text-gray-500 mt-6 flex-shrink-0">
          Min: {minBet} ICP • Max Win: {maxWin}{title === 'Dice' ? ' ICP' : 'x'} • House Edge: {houseEdge}%
        </div>
      )}
    </div>
  );
};