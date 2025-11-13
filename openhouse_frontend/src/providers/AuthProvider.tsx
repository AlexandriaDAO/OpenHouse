import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AuthClient } from '@dfinity/auth-client';
import { Identity, AnonymousIdentity } from '@dfinity/agent';
import { AuthState } from '../types';

interface AuthContextType extends AuthState {
  login: () => Promise<void>;
  logout: () => Promise<void>;
  authClient: AuthClient | null;
  isInitializing: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Internet Identity URL (V2)
const II_URL = 'https://identity.ic0.app';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authClient, setAuthClient] = useState<AuthClient | null>(null);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [principal, setPrincipal] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // Initialize AuthClient on mount
  useEffect(() => {
    const initAuth = async () => {
      try {
        const client = await AuthClient.create({
          idleOptions: {
            disableIdle: true, // Disable auto-logout for better UX
          },
        });

        setAuthClient(client);

        // Check if already authenticated
        const isAuth = await client.isAuthenticated();

        if (isAuth) {
          const id = client.getIdentity();
          setIdentity(id);
          setIsAuthenticated(true);
          setPrincipal(id.getPrincipal().toString());
        } else {
          // Use anonymous identity by default
          const anonIdentity = new AnonymousIdentity();
          setIdentity(anonIdentity);
          setIsAuthenticated(false);
          setPrincipal(anonIdentity.getPrincipal().toString());
        }
      } catch (error) {
        console.error('Failed to initialize AuthClient:', error);
        // Fallback to anonymous
        const anonIdentity = new AnonymousIdentity();
        setIdentity(anonIdentity);
        setIsAuthenticated(false);
        setPrincipal(anonIdentity.getPrincipal().toString());
      } finally {
        setIsInitializing(false);
      }
    };

    initAuth();
  }, []);

  const login = useCallback(async () => {
    if (!authClient) {
      console.error('AuthClient not initialized');
      return;
    }

    try {
      await authClient.login({
        identityProvider: II_URL,
        onSuccess: () => {
          const id = authClient.getIdentity();
          setIdentity(id);
          setIsAuthenticated(true);
          setPrincipal(id.getPrincipal().toString());
        },
        onError: (error) => {
          console.error('Login failed:', error);
        },
      });
    } catch (error) {
      console.error('Login error:', error);
    }
  }, [authClient]);

  const logout = useCallback(async () => {
    if (!authClient) return;

    try {
      await authClient.logout();

      // Reset to anonymous identity
      const anonIdentity = new AnonymousIdentity();
      setIdentity(anonIdentity);
      setIsAuthenticated(false);
      setPrincipal(anonIdentity.getPrincipal().toString());
    } catch (error) {
      console.error('Logout error:', error);
    }
  }, [authClient]);

  const value: AuthContextType = {
    identity,
    isAuthenticated,
    principal,
    login,
    logout,
    authClient,
    isInitializing,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
