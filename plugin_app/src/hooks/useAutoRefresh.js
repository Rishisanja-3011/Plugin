import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

export default function useAutoRefresh(callback, { enabled = true, intervalMs = 4000 } = {}) {
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

    const tick = async () => {
      if (!mounted || !activeRef.current || busyRef.current) return;
      busyRef.current = true;
      try {
        await callbackRef.current?.();
      } catch {
        // Silent refresh should never interrupt the visible screen.
      } finally {
        busyRef.current = false;
      }
    };

    const timer = setInterval(tick, intervalMs);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [enabled, intervalMs]);
}
