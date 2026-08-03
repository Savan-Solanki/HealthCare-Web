import {
  ADMIN_LOGIN_PATH,
  DOCTOR_BASE_PATH,
  DOCTOR_LOGIN_PATH,
  HOSPITAL_ADMIN_BASE_PATH,
  HOSPITAL_ADMIN_LOGIN_PATH,
  RECEPTIONIST_BASE_PATH,
  RECEPTIONIST_LOGIN_PATH,
  SUPER_ADMIN_BASE_PATH,
  type AuthPortal,
} from '@/lib/routes';

export function getAuthPortalFromPath(pathname: string): AuthPortal | undefined {
  if (pathname.startsWith(RECEPTIONIST_BASE_PATH) || pathname === RECEPTIONIST_LOGIN_PATH) {
    return 'receptionist';
  }
  if (pathname.startsWith(HOSPITAL_ADMIN_BASE_PATH) || pathname === HOSPITAL_ADMIN_LOGIN_PATH) {
    return 'hospital-admin';
  }
  if (pathname.startsWith(DOCTOR_BASE_PATH) || pathname === DOCTOR_LOGIN_PATH) {
    return 'doctor';
  }
  if (
    pathname.startsWith(SUPER_ADMIN_BASE_PATH) ||
    pathname.startsWith('/super-admin') ||
    pathname === ADMIN_LOGIN_PATH
  ) {
    return 'super-admin';
  }
  return undefined;
}

export function getAuthPortalFromWindow(): AuthPortal | undefined {
  if (typeof window === 'undefined') return undefined;
  return getAuthPortalFromPath(window.location.pathname);
}
