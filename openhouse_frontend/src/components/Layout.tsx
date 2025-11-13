import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AuthButton } from './AuthButton';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const isHome = location.pathname === '/';

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-casino-secondary border-b border-casino-accent">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <span className="text-3xl">🎰</span>
              <div>
                <h1 className="text-2xl font-bold">OpenHouse Casino</h1>
                <p className="text-xs text-gray-400">Transparent Odds • Provably Fair</p>
              </div>
            </Link>
            <AuthButton />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-8">
        {!isHome && (
          <div className="mb-6">
            <Link to="/" className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
              <span>←</span>
              <span>Back to Games</span>
            </Link>
          </div>
        )}
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-casino-secondary border-t border-casino-accent py-6">
        <div className="container mx-auto px-4 text-center text-gray-400 text-sm">
          <p>
            OpenHouse Casino - Open Source • Transparent Odds • Built on the{' '}
            <a
              href="https://internetcomputer.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-casino-highlight hover:underline"
            >
              Internet Computer
            </a>
          </p>
          <p className="mt-2">All games use verifiable randomness (VRF) for provably fair results.</p>
        </div>
      </footer>
    </div>
  );
};
