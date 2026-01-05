import { useCallback, useRef } from 'react';

interface GestureHandlers {
  onTap: () => void;
  onLongPress: () => void;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}

interface TouchStart {
  x: number;
  y: number;
  time: number;
}

const LONG_PRESS_DURATION = 500; // ms
const SWIPE_THRESHOLD = 50; // px
const SWIPE_VERTICAL_LIMIT = 30; // px
const SWIPE_TIME_LIMIT = 300; // ms
const TAP_MOVEMENT_LIMIT = 10; // px

/**
 * Hook for handling mobile touch gestures
 * Supports tap, long-press, and swipe gestures
 */
export function useGestures(handlers: GestureHandlers) {
  const touchStart = useRef<TouchStart | null>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const longPressTriggered = useRef(false);

  const clearLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStart.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    };
    longPressTriggered.current = false;

    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      handlers.onLongPress();
    }, LONG_PRESS_DURATION);
  }, [handlers]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStart.current) return;

    const touch = e.touches[0];
    const deltaX = Math.abs(touch.clientX - touchStart.current.x);
    const deltaY = Math.abs(touch.clientY - touchStart.current.y);

    // Cancel long press if finger moved too much
    if (deltaX > TAP_MOVEMENT_LIMIT || deltaY > TAP_MOVEMENT_LIMIT) {
      clearLongPress();
    }
  }, [clearLongPress]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    clearLongPress();

    if (!touchStart.current || longPressTriggered.current) {
      touchStart.current = null;
      return;
    }

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStart.current.x;
    const deltaY = touch.clientY - touchStart.current.y;
    const deltaTime = Date.now() - touchStart.current.time;

    // Detect swipe (horizontal movement > threshold, vertical < limit, time < limit)
    if (
      Math.abs(deltaX) > SWIPE_THRESHOLD &&
      Math.abs(deltaY) < SWIPE_VERTICAL_LIMIT &&
      deltaTime < SWIPE_TIME_LIMIT
    ) {
      if (deltaX > 0) {
        handlers.onSwipeRight?.();
      } else {
        handlers.onSwipeLeft?.();
      }
    }
    // Detect tap (minimal movement, quick touch, not a long press)
    else if (
      Math.abs(deltaX) < TAP_MOVEMENT_LIMIT &&
      Math.abs(deltaY) < TAP_MOVEMENT_LIMIT &&
      deltaTime < LONG_PRESS_DURATION
    ) {
      handlers.onTap();
    }

    touchStart.current = null;
  }, [handlers, clearLongPress]);

  const handleTouchCancel = useCallback(() => {
    clearLongPress();
    touchStart.current = null;
  }, [clearLongPress]);

  return {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
    onTouchCancel: handleTouchCancel,
  };
}
