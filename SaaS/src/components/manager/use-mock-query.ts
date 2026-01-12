'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { formatApiError } from '@/components/ui/error';

export type MockQueryState<T> = {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  retry: () => void;
};

export function useMockQuery<T>(fetcher: () => T, deps: unknown[] = []): MockQueryState<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetcherRef = useRef(fetcher);

  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  const run = useCallback(() => {
    setIsLoading(true);
    setError(null);
    const timer = setTimeout(() => {
      try {
        const result = fetcherRef.current();
        setData(result);
      } catch (err) {
        setError(formatApiError(err));
      } finally {
        setIsLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, deps);

  useEffect(() => {
    const cleanup = run();
    return () => cleanup?.();
  }, [run]);

  return { data, isLoading, error, retry: run };
}
