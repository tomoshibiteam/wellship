const isBrowser = () => typeof window !== 'undefined';

export const loadDraft = <T>(key: string, fallback: T): T => {
  if (!isBrowser()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

export const saveDraft = (key: string, value: unknown) => {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota errors
  }
};

export const clearDraft = (key: string) => {
  if (!isBrowser()) return;
  window.localStorage.removeItem(key);
};
