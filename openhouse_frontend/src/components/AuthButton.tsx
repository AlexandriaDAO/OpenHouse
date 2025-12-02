import React, { useState } from 'react';
import { useAuth } from '../providers/AuthProvider';
import { AuthMethodSelector } from './AuthMethodSelector';
import { type IdentityProviderConfig } from '../lib/ic-use-identity/config/identityProviders';

export const AuthButton: React.FC = () => {
  const { isAuthenticated, principal, login, logout, isInitializing } = useAuth();
  const [copied, setCopied] = useState(false);
  const [showProviderSelector, setShowProviderSelector] = useState(false);

  const handleCopyPrincipal = async () => {
    if (!principal) return;

    try {
      await navigator.clipboard.writeText(principal);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy principal:', error);
    }
  };

  const handleLoginClick = () => {
    // Always show provider selector to let user choose
    setShowProviderSelector(true);
  };

  const handleProviderSelect = (provider: IdentityProviderConfig) => {
    setShowProviderSelector(false);
    login(undefined, provider);
  };

  if (isInitializing) {
    return (
      <div className="flex items-center gap-2">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
        <span className="text-sm">Initializing...</span>
      </div>
    );
  }

  if (isAuthenticated && principal) {
    // Truncate principal to first 3 and last 3 characters
    const truncatedPrincipal = `${principal.substring(0, 3)}...${principal.substring(principal.length - 3)}`;

    return (
      <div className="flex items-center gap-2">
        {/* Principal Display - compact */}
        <button
          onClick={handleCopyPrincipal}
          className="flex items-center gap-1.5 bg-casino-secondary/50 px-2 py-1.5 rounded hover:bg-casino-secondary/70 transition-colors"
          title={copied ? 'Copied!' : 'Copy principal'}
        >
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <span className="font-mono text-xs text-gray-300">{truncatedPrincipal}</span>
          {copied && (
            <svg className="w-3 h-3 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>

        {/* Logout Icon Button */}
        <button
          onClick={logout}
          className="p-1.5 hover:bg-casino-secondary/30 rounded transition-colors"
          title="Logout"
        >
          <svg className="w-5 h-5 text-gray-400 hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={handleLoginClick}
        className="p-2 hover:bg-gray-800 rounded transition-colors auth-btn-pulse"
        title="Login to Play"
      >
        <svg className="w-6 h-6 text-gray-400 hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
        </svg>
      </button>

      {showProviderSelector && (
        <AuthMethodSelector
          onSelect={handleProviderSelect}
          onCancel={() => setShowProviderSelector(false)}
        />
      )}
    </>
  );
};
