import { useEffect } from 'react';

/**
 * When the tab becomes visible again, call onVisible.
 * Use this to clear stuck loading state after the user returns from an inactive tab.
 */
export function useVisibilityReset(onVisible: () => void): void {
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        onVisible();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [onVisible]);
}
