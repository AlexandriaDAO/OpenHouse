import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AuthButton } from './AuthButton';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const isHome = location.pathname === '/';
  // Dice routes need full-screen layout without footer or back button
  const isDiceRoute = location.pathname.startsWith('/dice');

  return (
    <div className={`${isDiceRoute ? 'h-screen' : 'min-h-screen'} flex flex-col bg-pure-black overflow-hidden`}>
      {/* Header - minimal and clean */}
      <header className="bg-pure-black border-b border-pure-white/10 flex-shrink-0">
        <div className="container mx-auto px-4 py-3">
          <div className="flex justify-between items-center">
            <Link to="/" className="hover:opacity-80 transition-opacity">
              <img
                src="/logos/logo_icon.png"
                alt="OpenHouse"
                className="w-24 h-24 pixelated"
                style={{ imageRendering: 'pixelated' }}
              />
            </Link>
            <AuthButton />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className={`flex-1 ${isDiceRoute ? 'overflow-hidden' : ''} container mx-auto px-4 ${isDiceRoute ? 'py-2' : 'py-8'}`}>
        {!isHome && !isDiceRoute && (
          <div className="mb-6">
            <Link to="/" className="inline-flex items-center gap-2 text-pure-white/60 hover:text-dfinity-turquoise transition-colors font-mono">
              <span>←</span>
              <span>Back to Games</span>
            </Link>
          </div>
        )}
        {children}
      </main>

      {/* Footer - hidden on dice routes */}
      {!isDiceRoute && (
        <footer className="bg-pure-black border-t border-pure-white/20 py-6 flex-shrink-0">
          <div className="container mx-auto px-4 text-center text-pure-white/60 text-sm font-mono">
            <p>
              OpenHouse Games -{' '}
              <a
                href="https://github.com/AlexandriaDAO/OpenHouse"
                target="_blank"
                rel="noopener noreferrer"
                className="text-dfinity-turquoise hover:underline"
              >
                Open Source
              </a>
              {' • '}
              An{' '}
              <a
                href="https://lbry.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-dfinity-turquoise hover:underline"
              >
                Alexandria
              </a>
              {' '}Project
            </p>
            <p className="mt-2">Powered by Internet Computer Random Beacon</p>
          </div>
        </footer>
      )}
    </div>
  );
};
