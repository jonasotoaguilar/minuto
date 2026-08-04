import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseAttendanceFocusRefreshOptions {
  /** Loads the bounded attendance state; owned by the screen. */
  refresh: () => Promise<void> | void;
}

export interface AttendanceFocusRefresh {
  isRefreshing: boolean;
  refresh: () => Promise<void>;
}

/**
 * Focus-aware refresh contract for attendance screens.
 *
 * The focus effect is the SINGLE load trigger: it runs on the initial focus
 * (mount) and on every re-focus. Do not combine it with a mount-only load
 * effect, or the initial state is fetched twice.
 *
 * The returned `refresh` is the explicit invalidation path: after
 * clock-in/clock-out mutations, `await refresh()` so state converges.
 *
 * Overlapping refreshes are allowed; `isRefreshing` tracks the latest run
 * only, so a stale completion can never clear a newer run's flag. Unmounted
 * components ignore both focus and imperative refreshes.
 */
export function useAttendanceFocusRefresh(
  options: UseAttendanceFocusRefreshOptions,
): AttendanceFocusRefresh {
  const refreshRef = useRef(options.refresh);
  const mountedRef = useRef(true);
  const generationRef = useRef(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    refreshRef.current = options.refresh;
  }, [options.refresh]);

  const refresh = useCallback(async () => {
    if (!mountedRef.current) {
      return;
    }

    const generation = ++generationRef.current;
    setIsRefreshing(true);

    try {
      await refreshRef.current();
    } finally {
      if (mountedRef.current && generation === generationRef.current) {
        setIsRefreshing(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      generationRef.current += 1;
    };
  }, []);

  return { isRefreshing, refresh };
}
