import axios from "axios";
import {
  clearSuperAdminSessionCookie,
  clearHospitalAdminSessionCookie,
  clearReceptionistSessionCookie,
  clearDoctorSessionCookie,
} from "@/lib/admin-session-cookie";
import { getAuthPortalFromWindow } from "@/lib/auth-portal";
import {
  ADMIN_LOGIN_PATH,
  DOCTOR_BASE_PATH,
  DOCTOR_LOGIN_PATH,
  HOSPITAL_ADMIN_LOGIN_PATH,
  HOSPITAL_ADMIN_BASE_PATH,
  RECEPTIONIST_LOGIN_PATH,
  RECEPTIONIST_BASE_PATH,
} from "@/lib/routes";
import { API_BASE_URL, getApiBaseUrl } from "@/lib/api-url";

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

const clearSuperAdminLocalCache = () => {
  if (typeof window === "undefined") return;
  Object.keys(window.localStorage)
    .filter((key) => key.startsWith("super_admin_cache:"))
    .forEach((key) => window.localStorage.removeItem(key));
};

const clearHospitalAdminLocalCache = () => {
  if (typeof window === "undefined") return;
  Object.keys(window.localStorage)
    .filter((key) => key.startsWith("hospital_admin_cache:"))
    .forEach((key) => window.localStorage.removeItem(key));
};

const clearDoctorLocalCache = () => {
  if (typeof window === "undefined") return;
  Object.keys(window.localStorage)
    .filter((key) => key.startsWith("doctor_cache:"))
    .forEach((key) => window.localStorage.removeItem(key));
};

/** Force logout and redirect to the correct login page with an error message. */
const forceLogout = (message: string) => {
  if (typeof window === "undefined") return;

  const isReceptionistPortal = window.location.pathname.startsWith(RECEPTIONIST_BASE_PATH);
  const isHospitalPortal = window.location.pathname.startsWith(HOSPITAL_ADMIN_BASE_PATH);
  const isDoctorPortal = window.location.pathname.startsWith(DOCTOR_BASE_PATH);

  if (isDoctorPortal) {
    clearDoctorLocalCache();
    clearDoctorSessionCookie();
  } else if (isReceptionistPortal) {
    clearHospitalAdminLocalCache();
    clearReceptionistSessionCookie();
  } else if (isHospitalPortal) {
    clearHospitalAdminLocalCache();
    clearHospitalAdminSessionCookie();
  } else {
    clearSuperAdminLocalCache();
    clearSuperAdminSessionCookie();
  }

  sessionStorage.clear();

  const loginPath = isDoctorPortal
    ? DOCTOR_LOGIN_PATH
    : isReceptionistPortal
      ? RECEPTIONIST_LOGIN_PATH
      : isHospitalPortal
        ? HOSPITAL_ADMIN_LOGIN_PATH
        : ADMIN_LOGIN_PATH;
  window.location.href = `${loginPath}?error=${encodeURIComponent(message)}`;
};

api.interceptors.request.use(
  (config) => {
    if (typeof window !== "undefined") {
      config.baseURL = getApiBaseUrl();
      const token = sessionStorage.getItem("access_token");
      if (token) {
        config.headers["Authorization"] = `Bearer ${token}`;
      }
      config.headers["Cache-Control"] = "no-cache, no-store, must-revalidate";
      config.headers["Pragma"] = "no-cache";
      config.headers["Expires"] = "0";
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const requestUrl = originalRequest?.url || "";
    const isAuthRequest =
      requestUrl.includes("/auth/login") ||
      requestUrl.includes("/auth/verify-otp") ||
      requestUrl.includes("/auth/refresh");

    const status = error.response?.status;


    // 401 = token expired — try a silent refresh once
    if (status === 401 && !originalRequest?._retry && !isAuthRequest) {
      originalRequest._retry = true;

      try {
        const portal = getAuthPortalFromWindow();
        const baseUrl = getApiBaseUrl();
        const { data } = await axios.post(
          `${baseUrl}/auth/refresh`,
          portal ? { portal } : {},
          {
            withCredentials: true,
            headers: portal ? { "X-Auth-Portal": portal } : undefined,
          }
        );

        if (typeof window !== "undefined") {
          sessionStorage.setItem("access_token", data.accessToken);
          if (data.user) {
            sessionStorage.setItem("auth_user", JSON.stringify(data.user));
          }
        }

        originalRequest.headers["Authorization"] = `Bearer ${data.accessToken}`;
        return api(originalRequest);
      } catch {
        // Refresh failed (token mismatch, user deleted, etc.) — force logout
        const message =
          error.response?.data?.message ||
          "Your session has expired. Please log in again.";
        forceLogout(message);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
