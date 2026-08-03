export const ADMIN_LOGIN_PATH = '/medkwik-access-gate';
export const HOSPITAL_ADMIN_LOGIN_PATH = '/hospital-access-gate';
export const RECEPTIONIST_LOGIN_PATH = '/receptionist-access-gate';
export const DOCTOR_LOGIN_PATH = '/doctor-access-gate';
export const SUPER_ADMIN_BASE_PATH = '/medkwik-control-center';
export const HOSPITAL_ADMIN_BASE_PATH = '/hospital-admin';
export const RECEPTIONIST_BASE_PATH = '/receptionist';
export const DOCTOR_BASE_PATH = '/doctor';

export type AuthPortal = 'super-admin' | 'hospital-admin' | 'receptionist' | 'doctor';


export const getSuperAdminPath = (path = '') => {
  if (!path) return SUPER_ADMIN_BASE_PATH;
  return `${SUPER_ADMIN_BASE_PATH}${path.startsWith('/') ? path : `/${path}`}`;
};

export const getHospitalAdminPath = (path = '') => {
  if (!path) return HOSPITAL_ADMIN_BASE_PATH;
  return `${HOSPITAL_ADMIN_BASE_PATH}${path.startsWith('/') ? path : `/${path}`}`;
};

export const getReceptionistPath = (path = '') => {
  if (!path) return RECEPTIONIST_BASE_PATH;
  return `${RECEPTIONIST_BASE_PATH}${path.startsWith('/') ? path : `/${path}`}`;
};

export const getDoctorPath = (path = '') => {
  if (!path) return DOCTOR_BASE_PATH;
  return `${DOCTOR_BASE_PATH}${path.startsWith('/') ? path : `/${path}`}`;
};
