import { useEffect, useRef } from 'react';

/**
 * When the tab becomes visible again, call onVisible.
 * Uses a ref so the listener is registered only once regardless of callback identity.
 */
export function useVisibilityReset(onVisible: () => void): void {
  const callbackRef = useRef(onVisible);
  callbackRef.current = onVisible;

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        callbackRef.current();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);
}
