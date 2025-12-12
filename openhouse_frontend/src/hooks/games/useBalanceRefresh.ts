import { useEffect } from 'react';

interface UseBalanceRefreshOptions {
  actor: unknown;
  refresh: () => Promise<void>;
  intervalMs?: number;
}

/**
 * Shared hook for balance refresh with interval and window focus handling.
 * Used by all game pages for consistent balance polling behavior.
 */
export function useBalanceRefresh({
  actor,
  refresh,
  intervalMs = 30000,
}: UseBalanceRefreshOptions) {
  useEffect(() => {
    if (!actor) return;

    // Set up periodic refresh
    const intervalId = setInterval(() => {
      refresh().catch(console.error);
    }, intervalMs);

    // Set up focus handler for immediate refresh on window focus
    const handleFocus = () => {
      refresh().catch(console.error);
    };
    window.addEventListener('focus', handleFocus);

    // Cleanup
    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
    };
  }, [actor, refresh, intervalMs]);
}
