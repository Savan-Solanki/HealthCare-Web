import axios from 'axios';
import { getAuthPortalFromPath, getAuthPortalFromWindow } from '@/lib/auth-portal';
import { API_BASE_URL } from '@/lib/api-url';
import type { AuthPortal } from '@/lib/routes';

export async function refreshAuthSession(portal?: AuthPortal) {
  const resolvedPortal = portal ?? getAuthPortalFromWindow();
  const { data } = await axios.post(
    `${API_BASE_URL}/auth/refresh`,
    resolvedPortal ? { portal: resolvedPortal } : {},
    {
      withCredentials: true,
      headers: resolvedPortal ? { 'X-Auth-Portal': resolvedPortal } : undefined,
    }
  );

  if (typeof window !== 'undefined') {
    sessionStorage.setItem('access_token', data.accessToken);
    sessionStorage.setItem('auth_user', JSON.stringify(data.user));
  }

  return data;
}

export function getAuthPortalForLoginPath(pathname: string): AuthPortal | undefined {
  return getAuthPortalFromPath(pathname);
}
