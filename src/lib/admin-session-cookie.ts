// ─── Cookie names ─────────────────────────────────────────────────────────────
// Super Admin portal uses:  medkwik_sa_role  +  medkwik_sa_auth
// Hospital Admin portal uses: medkwik_ha_role + medkwik_ha_auth
// Doctor portal uses:         medkwik_dr_role + medkwik_dr_auth
// These are separate so logging into one portal never overwrites the other.

const SA_ROLE_COOKIE  = 'medkwik_sa_role';
const SA_AUTH_COOKIE  = 'medkwik_sa_auth';
const HA_ROLE_COOKIE  = 'medkwik_ha_role';
const HA_AUTH_COOKIE  = 'medkwik_ha_auth';
const DR_ROLE_COOKIE  = 'medkwik_dr_role';
const DR_AUTH_COOKIE  = 'medkwik_dr_auth';
const RE_ROLE_COOKIE  = 'medkwik_re_role';
const RE_AUTH_COOKIE  = 'medkwik_re_auth';
const ONE_WEEK_SECONDS = 7 * 24 * 60 * 60;

const setCookie = (name: string, value: string) => {
  document.cookie = `${name}=${value}; Path=/; Max-Age=${ONE_WEEK_SECONDS}; SameSite=Lax`;
};

const clearCookie = (name: string) => {
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
};

/** Called after Super Admin OTP is verified successfully. */
export const setSuperAdminSessionCookie = () => {
  if (typeof document === 'undefined') return;
  setCookie(SA_AUTH_COOKIE, '1');
  setCookie(SA_ROLE_COOKIE, encodeURIComponent('Super Admin'));
};

/** Called after Hospital Admin OTP is verified successfully. */
export const setHospitalAdminSessionCookie = () => {
  if (typeof document === 'undefined') return;
  setCookie(HA_AUTH_COOKIE, '1');
  setCookie(HA_ROLE_COOKIE, encodeURIComponent('Hospital Admin'));
};

/** Called after Receptionist OTP is verified successfully. */
export const setReceptionistSessionCookie = () => {
  if (typeof document === 'undefined') return;
  setCookie(RE_AUTH_COOKIE, '1');
  setCookie(RE_ROLE_COOKIE, encodeURIComponent('Receptionist'));
};

/** Called after Doctor OTP is verified successfully. */
export const setDoctorSessionCookie = () => {
  if (typeof document === 'undefined') return;
  setCookie(DR_AUTH_COOKIE, '1');
  setCookie(DR_ROLE_COOKIE, encodeURIComponent('Doctor'));
};

/** Legacy shim — kept for backward compatibility during the login flow.
 *  Internally routes to the role-specific setter. */
export const setAdminSessionCookie = (role: string) => {
  if (typeof document === 'undefined') return;
  if (role === 'Super Admin') {
    setSuperAdminSessionCookie();
  } else if (role === 'Doctor') {
    setDoctorSessionCookie();
  } else if (role === 'Receptionist') {
    setReceptionistSessionCookie();
  } else {
    setHospitalAdminSessionCookie();
  }
};

/** Clears only the Super Admin session cookies. */
export const clearSuperAdminSessionCookie = () => {
  if (typeof document === 'undefined') return;
  clearCookie(SA_AUTH_COOKIE);
  clearCookie(SA_ROLE_COOKIE);
};

/** Clears only the Hospital Admin session cookies. */
export const clearHospitalAdminSessionCookie = () => {
  if (typeof document === 'undefined') return;
  clearCookie(HA_AUTH_COOKIE);
  clearCookie(HA_ROLE_COOKIE);
};

/** Clears only the Receptionist session cookies. */
export const clearReceptionistSessionCookie = () => {
  if (typeof document === 'undefined') return;
  clearCookie(RE_AUTH_COOKIE);
  clearCookie(RE_ROLE_COOKIE);
};

/** Clears only the Doctor session cookies. */
export const clearDoctorSessionCookie = () => {
  if (typeof document === 'undefined') return;
  clearCookie(DR_AUTH_COOKIE);
  clearCookie(DR_ROLE_COOKIE);
};

/** Clears ALL session cookies (both portals). */
export const clearAdminSessionCookie = () => {
  clearSuperAdminSessionCookie();
  clearHospitalAdminSessionCookie();
  clearReceptionistSessionCookie();
  clearDoctorSessionCookie();
};

// Cookie name exports for use in proxy.ts
export const ADMIN_ROLE_COOKIE_NAME = SA_ROLE_COOKIE;
export const ADMIN_AUTH_COOKIE_NAME = SA_AUTH_COOKIE;
export const HA_ROLE_COOKIE_NAME    = HA_ROLE_COOKIE;
export const HA_AUTH_COOKIE_NAME    = HA_AUTH_COOKIE;
export const DR_ROLE_COOKIE_NAME    = DR_ROLE_COOKIE;
export const DR_AUTH_COOKIE_NAME    = DR_AUTH_COOKIE;
export const RE_ROLE_COOKIE_NAME    = RE_ROLE_COOKIE;
export const RE_AUTH_COOKIE_NAME    = RE_AUTH_COOKIE;
