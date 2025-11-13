import React, { useEffect } from 'react';
import { useAuth } from './AuthProvider';
import { ensureAllInitialized, authenticateAll } from 'ic-use-actor';
import useCrashActor from '../hooks/actors/useCrashActor';
import usePlinkoActor from '../hooks/actors/usePlinkoActor';
import useMinesActor from '../hooks/actors/useMinesActor';
import useDiceActor from '../hooks/actors/useDiceActor';
import useLedgerActor from '../hooks/actors/useLedgerActor';

export const ActorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { identity, isInitializing } = useAuth();

  // Initialize all actor hooks (even if not used yet)
  useCrashActor();
  usePlinkoActor();
  useMinesActor();
  useDiceActor();
  useLedgerActor();

  // Update all actors when identity changes
  useEffect(() => {
    if (isInitializing || !identity) return;

    const initActors = async () => {
      try {
        // Ensure all actors are initialized
        await ensureAllInitialized();

        // Authenticate all actors with current identity
        await authenticateAll(identity);

        console.log('All actors initialized with identity:', identity.getPrincipal().toString());
      } catch (error) {
        console.error('Failed to initialize actors:', error);
      }
    };

    initActors();
  }, [identity, isInitializing]);

  return <>{children}</>;
};
