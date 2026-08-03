'use client';

import api from '@/lib/api';

export const SUPER_ADMIN_CACHE_EVENT = 'medkwik:super-admin-cache-updated';
const CACHE_PREFIX = 'super_admin_cache:';

export type SuperAdminCacheKey =
  | 'hospitals'
  | 'users'
  | 'systemStatus'
  | 'systemLogs'
  | 'report:users'
  | 'report:hospitals'
  | 'report:activity'
  | 'dashboardOverview';

type CacheEntry<T> = {
  updatedAt: string;
  data: T;
};

type CacheRefreshMap = {
  hospitals: unknown[];
  users: unknown[];
  systemStatus: unknown;
  systemLogs: unknown[];
  'report:users': unknown;
  'report:hospitals': unknown;
  'report:activity': unknown;
  dashboardOverview: unknown;
};

const CACHE_KEYS: SuperAdminCacheKey[] = [
  'hospitals',
  'users',
  'systemStatus',
  'systemLogs',
  'report:users',
  'report:hospitals',
  'report:activity',
  'dashboardOverview',
];

const isBrowser = () => typeof window !== 'undefined';

const getStorageKey = (key: SuperAdminCacheKey) => `${CACHE_PREFIX}${key}`;

const emitCacheEvent = (key?: SuperAdminCacheKey) => {
  if (!isBrowser()) return;

  window.dispatchEvent(
    new CustomEvent(SUPER_ADMIN_CACHE_EVENT, {
      detail: { key: key ?? null, updatedAt: new Date().toISOString() },
    })
  );
};

const normalizeHospitals = (response: { data: unknown }) => {
  const payload = (response as { data?: { data?: { hospitals?: unknown[] } | unknown[] } }).data;
  const raw = payload?.data;

  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object' && 'hospitals' in raw && Array.isArray(raw.hospitals)) {
    return raw.hospitals;
  }

  return [];
};

const normalizeUsers = (response: { data: unknown }) => {
  const payload = (response as { data?: { data?: { users?: unknown[] } | unknown[] } }).data;
  const raw = payload?.data;

  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object' && 'users' in raw && Array.isArray(raw.users)) {
    return raw.users;
  }

  return [];
};

const readEntry = <T>(key: SuperAdminCacheKey): CacheEntry<T> | null => {
  if (!isBrowser()) return null;

  const raw = window.localStorage.getItem(getStorageKey(key));
  if (!raw) return null;

  try {
    return JSON.parse(raw) as CacheEntry<T>;
  } catch {
    window.localStorage.removeItem(getStorageKey(key));
    return null;
  }
};

export const getSuperAdminCacheData = <T>(key: SuperAdminCacheKey): T | null => {
  return readEntry<T>(key)?.data ?? null;
};

export const getSuperAdminCacheUpdatedAt = (key: SuperAdminCacheKey): string | null => {
  return readEntry(key)?.updatedAt ?? null;
};

export const getLatestSuperAdminCacheUpdate = (): string | null => {
  if (!isBrowser()) return null;

  return CACHE_KEYS.reduce<string | null>((latest, key) => {
    const updatedAt = getSuperAdminCacheUpdatedAt(key);
    if (!updatedAt) return latest;
    if (!latest) return updatedAt;
    return new Date(updatedAt).getTime() > new Date(latest).getTime() ? updatedAt : latest;
  }, null);
};

export const setSuperAdminCacheData = <T>(key: SuperAdminCacheKey, data: T) => {
  if (!isBrowser()) return;

  const entry: CacheEntry<T> = {
    updatedAt: new Date().toISOString(),
    data,
  };

  window.localStorage.setItem(getStorageKey(key), JSON.stringify(entry));
  emitCacheEvent(key);
};

export const clearSuperAdminCache = () => {
  if (!isBrowser()) return;

  CACHE_KEYS.forEach((key) => window.localStorage.removeItem(getStorageKey(key)));
  emitCacheEvent();
};

const refreshers: {
  [K in SuperAdminCacheKey]: () => Promise<CacheRefreshMap[K]>;
} = {
  hospitals: async () => {
    const response = await api.get('/hospitals', {
      params: { limit: 100, sortBy: 'createdAt', sortOrder: 'desc' },
    });
    return normalizeHospitals(response);
  },
  users: async () => {
    const response = await api.get('/users');
    return normalizeUsers(response);
  },
  systemStatus: async () => {
    const response = await api.get('/system/status');
    return (response as { data?: { data?: unknown } }).data?.data ?? null;
  },
  systemLogs: async () => {
    const response = await api.get('/system/logs', {
      params: { page: 1, limit: 20 },
    });
    // Endpoint returns { success, total, page, data: [...] }
    const payload = (response as { data?: { data?: unknown[] } }).data;
    return Array.isArray(payload?.data) ? payload.data : [];
  },
  'report:users': async () => {
    const response = await api.get('/reports?type=users');
    return response.data;
  },
  'report:hospitals': async () => {
    const response = await api.get('/reports?type=hospitals');
    return response.data;
  },
  'report:activity': async () => {
    const response = await api.get('/reports?type=activity');
    return response.data;
  },
  dashboardOverview: async () => {
    const response = await api.get('/reports/overview');
    return (response as { data?: { data?: unknown } }).data?.data ?? response.data;
  },
};

export const refreshSuperAdminCache = async (keys: SuperAdminCacheKey[] = CACHE_KEYS) => {
  const uniqueKeys = Array.from(new Set(keys));

  const results = await Promise.allSettled(
    uniqueKeys.map(async (key) => {
      const data = await refreshers[key]();
      setSuperAdminCacheData(key, data);
      return key;
    })
  );

  const succeeded = results
    .filter((r): r is PromiseFulfilledResult<SuperAdminCacheKey> => r.status === 'fulfilled')
    .map((r) => r.value);

  const failed = results
    .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
    .map((_, i) => uniqueKeys[i]);

  return { succeeded, failed };
};
