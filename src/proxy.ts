import { jwtVerify } from 'jose';
import { NextRequest, NextResponse } from 'next/server';
import {
  ADMIN_AUTH_COOKIE_NAME,
  ADMIN_ROLE_COOKIE_NAME,
  DR_AUTH_COOKIE_NAME,
  DR_ROLE_COOKIE_NAME,
  HA_AUTH_COOKIE_NAME,
  HA_ROLE_COOKIE_NAME,
  RE_AUTH_COOKIE_NAME,
  RE_ROLE_COOKIE_NAME,
} from './lib/admin-session-cookie';
import {
  ADMIN_LOGIN_PATH,
  DOCTOR_BASE_PATH,
  DOCTOR_LOGIN_PATH,
  HOSPITAL_ADMIN_BASE_PATH,
  HOSPITAL_ADMIN_LOGIN_PATH,
  RECEPTIONIST_BASE_PATH,
  RECEPTIONIST_LOGIN_PATH,
  SUPER_ADMIN_BASE_PATH,
} from './lib/routes';

type AuthRole =
  | 'Super Admin'
  | 'Hospital Admin'
  | 'Doctor'
  | 'Nurse'
  | 'Receptionist'
  | 'Staff';

// Role-specific refresh token cookie names (must match backend authController.js)
const SA_REFRESH_COOKIE = 'sa_refreshToken';
const HA_REFRESH_COOKIE = 'ha_refreshToken';
const RE_REFRESH_COOKIE = 're_refreshToken';
const DR_REFRESH_COOKIE = 'dr_refreshToken';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const PRODUCTION_API_ORIGIN = 'https://api.medikwikhealthbuddy.in';

const normalizeApiOrigin = (value?: string) => {
  const configured = value?.trim();

  if (!configured || configured.startsWith('/')) {
    return PRODUCTION_API_ORIGIN;
  }

  return configured.replace(/\/api\/v1\/?$/, '').replace(/\/$/, '');
};

const API_ORIGIN = normalizeApiOrigin(process.env.NEXT_PUBLIC_API_URL);

let wsOrigin = '';
try {
  const host = new URL(API_ORIGIN).host;
  wsOrigin = `ws://${host} wss://${host}`;
} catch {
  wsOrigin = API_ORIGIN.replace(/^http/, 'ws');
}

const S3_UPLOAD_CONNECT_ORIGINS = [
  'https://medkwik-healthbuddy-storage.s3.eu-north-1.amazonaws.com',
  'https://*.amazonaws.com',
].join(' ');

// ── Helpers ──────────────────────────────────────────────────────────────────

const isStaticAsset = (pathname: string) =>
  pathname.startsWith('/_next') ||
  pathname.startsWith('/favicon') ||
  /\.(svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?|map|txt)$/.test(pathname);

const addSecurityHeaders = (res: NextResponse) => {
  const scriptSrc = [
    "'self'",
    "'unsafe-inline'",
    'https://challenges.cloudflare.com',
  ];
  if (process.env.NODE_ENV !== 'production') scriptSrc.push("'unsafe-eval'");

  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-XSS-Protection', '1; mode=block');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
  res.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      `script-src ${scriptSrc.join(' ')}`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https:",
      `connect-src 'self' ${API_ORIGIN} ${wsOrigin} ${S3_UPLOAD_CONNECT_ORIGINS} https://challenges.cloudflare.com`,
      "frame-src 'self' https://challenges.cloudflare.com",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ')
  );
  if (process.env.NODE_ENV === 'production') {
    res.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }
  return res;
};

const goto = (req: NextRequest, path: string) =>
  NextResponse.redirect(new URL(path, req.url));

const protectedArea = (pathname: string) => {
  if (
    pathname === SUPER_ADMIN_BASE_PATH ||
    pathname.startsWith(`${SUPER_ADMIN_BASE_PATH}/`) ||
    pathname === '/super-admin' ||
    pathname.startsWith('/super-admin/')
  )
    return 'super-admin';

  if (
    pathname === HOSPITAL_ADMIN_BASE_PATH ||
    pathname.startsWith(`${HOSPITAL_ADMIN_BASE_PATH}/`)
  )
    return 'hospital-admin';

  if (
    pathname === RECEPTIONIST_BASE_PATH ||
    pathname.startsWith(`${RECEPTIONIST_BASE_PATH}/`)
  )
    return 'receptionist';

  if (pathname === DOCTOR_BASE_PATH || pathname.startsWith(`${DOCTOR_BASE_PATH}/`))
    return 'doctor';

  return null;
};

/** Verify a single JWT cookie and return the role, or null if invalid. */
const verifyJwt = async (token: string): Promise<AuthRole | null> => {
  if (!REFRESH_SECRET) return null;
  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(REFRESH_SECRET)
    );
    if (typeof payload.role === 'string') return payload.role as AuthRole;
  } catch {
    // expired / tampered
  }
  return null;
};

/**
 * Resolve whether the request comes from a Super Admin or Hospital Admin session.
 * Each portal uses its own isolated cookies so sessions never interfere.
 */
const resolveRoleForArea = async (
  req: NextRequest,
  area: 'super-admin' | 'hospital-admin' | 'receptionist' | 'doctor' | null
): Promise<AuthRole | null> => {
  if (area === 'super-admin' || area === null) {
    // ── Super Admin: check sa_refreshToken, then SA session bridge cookies ──
    const saToken = req.cookies.get(SA_REFRESH_COOKIE)?.value;
    if (saToken) {
      const role = await verifyJwt(saToken);
      if (role === 'Super Admin') return role;
    }
    const saAuth = req.cookies.get(ADMIN_AUTH_COOKIE_NAME)?.value;
    const saRole = req.cookies.get(ADMIN_ROLE_COOKIE_NAME)?.value;
    if (saAuth === '1' && saRole) {
      const decoded = decodeURIComponent(saRole) as AuthRole;
      if (decoded === 'Super Admin') return decoded;
    }
  }

  if (area === 'hospital-admin' || area === null) {
    const haToken = req.cookies.get(HA_REFRESH_COOKIE)?.value;
    if (haToken) {
      const role = await verifyJwt(haToken);
      if (role === 'Hospital Admin') return role;
    }
    const haAuth = req.cookies.get(HA_AUTH_COOKIE_NAME)?.value;
    const haRole = req.cookies.get(HA_ROLE_COOKIE_NAME)?.value;
    if (haAuth === '1' && haRole) {
      const decoded = decodeURIComponent(haRole) as AuthRole;
      if (decoded === 'Hospital Admin') return decoded;
    }
  }

  if (area === 'receptionist' || area === null) {
    const reToken = req.cookies.get(RE_REFRESH_COOKIE)?.value;
    if (reToken) {
      const role = await verifyJwt(reToken);
      if (role === 'Receptionist') return role;
    }
    const reAuth = req.cookies.get(RE_AUTH_COOKIE_NAME)?.value;
    const reRole = req.cookies.get(RE_ROLE_COOKIE_NAME)?.value;
    if (reAuth === '1' && reRole) {
      const decoded = decodeURIComponent(reRole) as AuthRole;
      if (decoded === 'Receptionist') return decoded;
    }
  }

  if (area === 'doctor' || area === null) {
    const drToken = req.cookies.get(DR_REFRESH_COOKIE)?.value;
    if (drToken) {
      const role = await verifyJwt(drToken);
      if (role === 'Doctor') return role;
    }
    const drAuth = req.cookies.get(DR_AUTH_COOKIE_NAME)?.value;
    const drRole = req.cookies.get(DR_ROLE_COOKIE_NAME)?.value;
    if (drAuth === '1' && drRole) {
      const decoded = decodeURIComponent(drRole) as AuthRole;
      if (decoded === 'Doctor') return decoded;
    }
  }

  return null;
};

// ── Proxy function (Next.js 16 convention) ────────────────────────────────────

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isDev = process.env.NODE_ENV !== 'production';

  // Skip static assets
  if (isStaticAsset(pathname)) return NextResponse.next();

  // Redirect legacy login paths
  if (pathname === '/login' || pathname.startsWith('/login/'))
    return goto(req, ADMIN_LOGIN_PATH);
  if (pathname === '/admin/login' || pathname.startsWith('/admin/login/'))
    return goto(req, ADMIN_LOGIN_PATH);
  if (pathname === '/doctor/login' || pathname.startsWith('/doctor/login/'))
    return goto(req, DOCTOR_LOGIN_PATH);

  const res = addSecurityHeaders(NextResponse.next());
  const area = protectedArea(pathname);

  // ── Super Admin login page ──────────────────────────────────────────────────
  if (pathname === ADMIN_LOGIN_PATH) {
    return res;
  }

  // ── Hospital Admin login page ───────────────────────────────────────────────
  if (pathname === HOSPITAL_ADMIN_LOGIN_PATH) {
    return res;
  }

  if (pathname === RECEPTIONIST_LOGIN_PATH) {
    return res;
  }

  if (pathname === DOCTOR_LOGIN_PATH) {
    return res;
  }

  // ── Super Admin protected area ──────────────────────────────────────────────
  // Only checks SA cookies — HA session is invisible here
  if (area === 'super-admin') {
    const saRole = await resolveRoleForArea(req, 'super-admin');
    if (saRole !== 'Super Admin') return goto(req, ADMIN_LOGIN_PATH);
  }

  // ── Hospital Admin protected area ───────────────────────────────────────────
  // Only checks HA cookies — SA session is invisible here
  if (area === 'hospital-admin') {
    const haRole = await resolveRoleForArea(req, 'hospital-admin');
    if (haRole !== 'Hospital Admin') {
      if (!isDev) return goto(req, HOSPITAL_ADMIN_LOGIN_PATH);
    }
  }

  if (area === 'receptionist') {
    if (pathname === RECEPTIONIST_BASE_PATH) {
      return goto(req, `${RECEPTIONIST_BASE_PATH}/patients`);
    }
    const reRole = await resolveRoleForArea(req, 'receptionist');
    if (reRole !== 'Receptionist' && !isDev) {
      return goto(req, RECEPTIONIST_LOGIN_PATH);
    }
  }

  if (area === 'doctor') {
    const drRole = await resolveRoleForArea(req, 'doctor');
    if (drRole !== 'Doctor' && !isDev) {
      return goto(req, DOCTOR_LOGIN_PATH);
    }
  }

  return res;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};

