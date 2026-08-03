'use client';

import api from '@/lib/api';

export const HOSPITAL_ADMIN_CACHE_EVENT = 'medkwik:hospital-admin-cache-updated';
const CACHE_PREFIX = 'hospital_admin_cache:';

export type HospitalAdminCacheKey =
  | 'dashboard'
  | 'dashboardOverview'
  | 'patients'
  | 'doctors'
  | 'departments'
  | 'staff'
  | 'appointments';

type CacheEntry<T> = {
  updatedAt: string;
  data: T;
};

type CacheRefreshMap = {
  dashboard: unknown;
  dashboardOverview: unknown;
  patients: unknown[];
  doctors: unknown[];
  departments: unknown[];
  staff: unknown[];
  appointments: unknown[];
};

const CACHE_KEYS: HospitalAdminCacheKey[] = [
  'dashboard',
  'dashboardOverview',
  'patients',
  'doctors',
  'departments',
  'staff',
  'appointments',
];

const isBrowser = () => typeof window !== 'undefined';
const getStorageKey = (key: HospitalAdminCacheKey) => `${CACHE_PREFIX}${key}`;

const emitCacheEvent = (key?: HospitalAdminCacheKey) => {
  if (!isBrowser()) return;

  window.dispatchEvent(
    new CustomEvent(HOSPITAL_ADMIN_CACHE_EVENT, {
      detail: { key: key ?? null, updatedAt: new Date().toISOString() },
    })
  );
};

const readEntry = <T>(key: HospitalAdminCacheKey): CacheEntry<T> | null => {
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

export const getHospitalAdminCacheData = <T>(key: HospitalAdminCacheKey): T | null => {
  return readEntry<T>(key)?.data ?? null;
};

export const getHospitalAdminCacheUpdatedAt = (key: HospitalAdminCacheKey): string | null => {
  return readEntry(key)?.updatedAt ?? null;
};

export const getLatestHospitalAdminCacheUpdate = (): string | null => {
  if (!isBrowser()) return null;

  return CACHE_KEYS.reduce<string | null>((latest, key) => {
    const updatedAt = getHospitalAdminCacheUpdatedAt(key);
    if (!updatedAt) return latest;
    if (!latest) return updatedAt;
    return new Date(updatedAt).getTime() > new Date(latest).getTime() ? updatedAt : latest;
  }, null);
};

export const setHospitalAdminCacheData = <T>(key: HospitalAdminCacheKey, data: T) => {
  if (!isBrowser()) return;

  const entry: CacheEntry<T> = {
    updatedAt: new Date().toISOString(),
    data,
  };

  window.localStorage.setItem(getStorageKey(key), JSON.stringify(entry));
  emitCacheEvent(key);
};

export const clearHospitalAdminCache = () => {
  if (!isBrowser()) return;

  CACHE_KEYS.forEach((key) => window.localStorage.removeItem(getStorageKey(key)));
  emitCacheEvent();
};

const refreshers: {
  [K in HospitalAdminCacheKey]: () => Promise<CacheRefreshMap[K]>;
} = {
  dashboard: async () => {
    const response = await api.get('/hospital-admin/dashboard');
    return response.data?.data ?? {};
  },
  dashboardOverview: async () => {
    const response = await api.get('/hospital-admin/dashboard');
    return response.data?.data ?? {};
  },
  patients: async () => {
    const response = await api.get('/hospital-admin/patients');
    return response.data?.data ?? [];
  },
  doctors: async () => {
    const response = await api.get('/hospital-admin/doctors');
    return response.data?.data ?? [];
  },
  departments: async () => {
    const response = await api.get('/hospital-admin/departments');
    return response.data?.data ?? [];
  },
  staff: async () => {
    const response = await api.get('/hospital-admin/staff');
    return response.data?.data ?? [];
  },
  appointments: async () => {
    const response = await api.get('/hospital-admin/appointments');
    return response.data?.data ?? [];
  },
};

export const refreshHospitalAdminCache = async (keys: HospitalAdminCacheKey[] = CACHE_KEYS) => {
  const uniqueKeys = Array.from(new Set(keys));

  await Promise.all(
    uniqueKeys.map(async (key) => {
      try {
        const data = await refreshers[key]();
        setHospitalAdminCacheData(key, data);
      } catch (err: any) {
        // If the user's role is not authorized for this specific cache resource, skip it.
        if (err?.response?.status === 403) {
          console.warn(`Skipping cache refresh for key '${key}' due to permission limits.`);
          return;
        }
        throw err;
      }
    })
  );

  return uniqueKeys;
};
