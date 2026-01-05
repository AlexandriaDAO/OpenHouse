import { useCallback } from 'react';

/**
 * Hook for haptic feedback on mobile devices
 * Provides tactile feedback for user interactions
 */
export function useHaptics() {
  const vibrate = useCallback((pattern: number | number[]) => {
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch {
        // Silently fail if vibration not supported
      }
    }
  }, []);

  return {
    /** Light tap - chip placed */
    light: () => vibrate(10),
    /** Medium tap - chip removed */
    medium: () => vibrate(30),
    /** Heavy - win celebration */
    heavy: () => vibrate([50, 30, 50]),
    /** Error feedback */
    error: () => vibrate([100, 50, 100]),
    /** Custom pattern */
    custom: vibrate,
  };
}
