import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../providers/AuthProvider';
import { useBalance } from '../providers/BalanceProvider';
import { AuthMethodSelector } from './AuthMethodSelector';
import { type IdentityProviderConfig, getPreferredProvider } from '../lib/ic-use-identity/config/identityProviders';

interface OnboardingBannerProps {
  /** Where the banner is displayed - affects messaging */
  context?: 'home' | 'game';
}

const DISMISSED_KEY = 'openhouse_onboarding_dismissed';

export const OnboardingBanner: React.FC<OnboardingBannerProps> = ({
  context = 'home',
}) => {
  const navigate = useNavigate();
  const { isAuthenticated, login, isInitializing } = useAuth();
  const { balance, isLoading: balanceLoading } = useBalance();
  const [dismissed, setDismissed] = useState(false);
  const [visible, setVisible] = useState(true);
  const [showProviderSelector, setShowProviderSelector] = useState(false);

  // Check if user has dismissed the "get ckUSDT" banner before
  useEffect(() => {
    const wasDismissed = localStorage.getItem(DISMISSED_KEY);
    if (wasDismissed === 'true') {
      setDismissed(true);
    }
  }, []);

  // Animate out when conditions change
  useEffect(() => {
    if (isAuthenticated && balance && balance > 0n) {
      // User is ready to play - fade out
      const timer = setTimeout(() => setVisible(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, balance]);

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem(DISMISSED_KEY, 'true');
  };

  // Use the same login flow as AuthButton
  const handleLoginClick = () => {
    const preferredProvider = getPreferredProvider();
    if (preferredProvider) {
      login(undefined, preferredProvider);
    } else {
      setShowProviderSelector(true);
    }
  };

  const handleProviderSelect = (provider: IdentityProviderConfig) => {
    setShowProviderSelector(false);
    login(undefined, provider);
  };

  // Don't show during initialization
  if (isInitializing) {
    return null;
  }

  // State 1: Not authenticated - show login prompt
  if (!isAuthenticated) {
    return (
      <>
        <div className="onboarding-banner onboarding-banner--login">
          <div className="onboarding-content">
            <div className="onboarding-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                <polyline points="10 17 15 12 10 7" />
                <line x1="15" y1="12" x2="3" y2="12" />
              </svg>
            </div>
            <div className="onboarding-text">
              <h3 className="onboarding-title">Sign in to start playing</h3>
              <p className="onboarding-description">
                {context === 'home'
                  ? 'Connect with Internet Identity to place bets and win real ckUSDT'
                  : 'You need to sign in before you can place bets'}
              </p>
            </div>
            <button onClick={handleLoginClick} className="onboarding-cta onboarding-cta--pulse">
              <span>Login to Play</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        </div>

        {showProviderSelector && (
          <AuthMethodSelector
            onSelect={handleProviderSelect}
            onCancel={() => setShowProviderSelector(false)}
          />
        )}
      </>
    );
  }

  // State 2: Authenticated but zero balance - prompt to get ckUSDT
  if (!balanceLoading && (balance === null || balance === 0n) && !dismissed) {
    return (
      <div className={`onboarding-banner onboarding-banner--deposit ${visible ? '' : 'onboarding-banner--hidden'}`}>
        <button onClick={handleDismiss} className="onboarding-dismiss" title="Dismiss">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <div className="onboarding-content">
          <div className="onboarding-icon onboarding-icon--deposit">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v12" />
              <path d="M6 12h12" />
            </svg>
          </div>
          <div className="onboarding-text">
            <h3 className="onboarding-title">Get ckUSDT to Start Playing</h3>
            <p className="onboarding-description">
              ckUSDT is an anonymous, blockchain-native stablecoin - no KYC required.
            </p>
          </div>
          <button onClick={() => navigate('/wallet')} className="onboarding-cta">
            <span>View Wallet</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  // State 3: User has balance - show nothing
  return null;
};
