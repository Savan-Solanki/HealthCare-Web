const PRODUCTION_API_ORIGIN = "http://13.201.29.22:5001";
const API_VERSION_PATH = "/api/v1";

const normalizeApiOrigin = (value?: string) => {
  const configured = value?.trim();

  if (!configured || configured.startsWith("/")) {
    return PRODUCTION_API_ORIGIN;
  }

  return configured.replace(/\/api\/v1\/?$/, "").replace(/\/$/, "");
};

export const API_ORIGIN = normalizeApiOrigin(process.env.NEXT_PUBLIC_API_URL);
export const API_BASE_URL = `${API_ORIGIN}${API_VERSION_PATH}`;
