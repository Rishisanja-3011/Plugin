import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

export default function useAutoRefresh(callback, { enabled = true, intervalMs = 10000 } = {}) {
  const callbackRef = useRef(callback);
  const busyRef = useRef(false);
  const activeRef = useRef(AppState.currentState === 'active');

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      activeRef.current = nextState === 'active';
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    let mounted = true;

    let timer;
    let consecutiveFailures = 0;

    const schedule = (delayMs) => {
      if (mounted) timer = setTimeout(tick, delayMs);
    };

    const tick = async () => {
      if (!mounted) return;
      if (!activeRef.current || busyRef.current) {
        schedule(intervalMs);
        return;
      }
      busyRef.current = true;
      try {
        await callbackRef.current?.();
        consecutiveFailures = 0;
      } catch {
        // Silent refresh should never interrupt the visible screen.
        consecutiveFailures += 1;
      } finally {
        busyRef.current = false;
        const nextDelay = Math.min(intervalMs * (2 ** consecutiveFailures), 60000);
        schedule(nextDelay);
      }
    };

    schedule(intervalMs);
    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [enabled, intervalMs]);
}
