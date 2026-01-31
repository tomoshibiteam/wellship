import { useCallback, useEffect, useState } from 'react';
import {
  getQueueStatus,
  processQueue,
  retryFailed,
  subscribeQueue,
  clearQueue,
} from './retry-queue';

export function useRetryQueueStatus() {
  const [status, setStatus] = useState(() => {
    const snapshot = getQueueStatus();
    return { ...snapshot, online: typeof navigator !== 'undefined' ? navigator.onLine : true };
  });

  const update = useCallback(() => {
    const snapshot = getQueueStatus();
    setStatus({ ...snapshot, online: typeof navigator !== 'undefined' ? navigator.onLine : true });
  }, []);

  useEffect(() => {
    update();
    const unsubscribe = subscribeQueue(update);
    const handleOnline = () => {
      update();
      processQueue();
    };
    const handleOffline = () => update();
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    const interval = window.setInterval(() => {
      if (navigator.onLine) {
        processQueue();
      }
    }, 20000);
    return () => {
      unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.clearInterval(interval);
    };
  }, [update]);

  return {
    ...status,
    retryAll: () => processQueue(),
    retryFailed: () => retryFailed(),
    clearQueue: () => clearQueue(),
  };
}
