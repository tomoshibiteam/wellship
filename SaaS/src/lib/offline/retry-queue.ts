type RetryQueueItem = {
  id: string;
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: string;
  bodyType: 'json';
  createdAt: string;
  attempts: number;
  lastError?: string | null;
  status?: 'pending' | 'error';
  feature?: string;
};

const QUEUE_KEY = 'wellship_retry_queue_v1';
const EVENT_NAME = 'wellship-retry-queue-updated';
let isProcessing = false;

const isBrowser = () => typeof window !== 'undefined';

const notify = () => {
  if (!isBrowser()) return;
  window.dispatchEvent(new Event(EVENT_NAME));
};

const loadQueue = (): RetryQueueItem[] => {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as RetryQueueItem[];
  } catch {
    return [];
  }
};

const saveQueue = (queue: RetryQueueItem[]) => {
  if (!isBrowser()) return;
  window.localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  notify();
};

export const getQueueSnapshot = () => loadQueue();

export const clearQueue = () => {
  saveQueue([]);
};

export const getQueueStatus = () => {
  const queue = loadQueue();
  const pending = queue.filter((item) => item.status !== 'error').length;
  const error = queue.filter((item) => item.status === 'error').length;
  return { total: queue.length, pending, error };
};

export const enqueueJsonRequest = (params: {
  url: string;
  method: string;
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
  feature?: string;
  error?: string;
}) => {
  const queue = loadQueue();
  queue.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    url: params.url,
    method: params.method,
    headers: params.headers ?? { 'Content-Type': 'application/json' },
    body: params.body ? JSON.stringify(params.body) : undefined,
    bodyType: 'json',
    createdAt: new Date().toISOString(),
    attempts: 0,
    lastError: params.error ?? null,
    status: 'pending',
    feature: params.feature,
  });
  saveQueue(queue);
};

const shouldQueue = (response?: Response) => {
  if (!isBrowser() || !navigator.onLine) return true;
  if (!response) return true;
  return response.status >= 500 || response.status === 408 || response.status === 429;
};

export const safeJsonRequest = async (params: {
  url: string;
  method: string;
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
  feature?: string;
}) => {
  try {
    const res = await fetch(params.url, {
      method: params.method,
      headers: params.headers ?? { 'Content-Type': 'application/json' },
      body: params.body ? JSON.stringify(params.body) : undefined,
    });
    if (!res.ok && shouldQueue(res)) {
      enqueueJsonRequest({
        url: params.url,
        method: params.method,
        body: params.body,
        headers: params.headers,
        feature: params.feature,
        error: `status:${res.status}`,
      });
      return { ok: false, queued: true, response: res };
    }
    return { ok: res.ok, queued: false, response: res };
  } catch (error) {
    enqueueJsonRequest({
      url: params.url,
      method: params.method,
      body: params.body,
      headers: params.headers,
      feature: params.feature,
      error: error instanceof Error ? error.message : 'network error',
    });
    return { ok: false, queued: true };
  }
};

export const processQueue = async () => {
  if (!isBrowser() || isProcessing) return { processed: 0, remaining: 0, error: 0 };
  if (!navigator.onLine) return { processed: 0, remaining: getQueueSnapshot().length, error: 0 };
  isProcessing = true;
  const queue = loadQueue();
  let processed = 0;
  let errorCount = 0;
  const nextQueue: RetryQueueItem[] = [];

  for (const item of queue) {
    try {
      const res = await fetch(item.url, {
        method: item.method,
        headers: item.headers,
        body: item.body ?? undefined,
      });
      if (res.ok) {
        processed += 1;
        continue;
      }
      const isClientError = res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429;
      if (isClientError) {
        errorCount += 1;
        nextQueue.push({ ...item, status: 'error', lastError: `status:${res.status}` });
        continue;
      }
      nextQueue.push({
        ...item,
        attempts: item.attempts + 1,
        lastError: `status:${res.status}`,
        status: 'pending',
      });
      errorCount += 1;
      break;
    } catch (err) {
      nextQueue.push({
        ...item,
        attempts: item.attempts + 1,
        lastError: err instanceof Error ? err.message : 'network error',
        status: 'pending',
      });
      errorCount += 1;
      break;
    }
  }

  saveQueue(nextQueue);
  isProcessing = false;
  return { processed, remaining: nextQueue.length, error: errorCount };
};

export const retryFailed = async () => {
  const queue = loadQueue().map((item) => ({ ...item, status: 'pending' }));
  saveQueue(queue);
  return processQueue();
};

export const subscribeQueue = (handler: () => void) => {
  if (!isBrowser()) return () => undefined;
  window.addEventListener(EVENT_NAME, handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener(EVENT_NAME, handler);
    window.removeEventListener('storage', handler);
  };
};
