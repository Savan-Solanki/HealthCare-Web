'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { refreshAuthSession } from '@/lib/auth-session';
import {
  HOSPITAL_ADMIN_LOGIN_PATH,
  RECEPTIONIST_BASE_PATH,
} from '@/lib/routes';

export function HospitalAdminRoleGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const restore = async () => {
      let storedUser = sessionStorage.getItem('auth_user');
      let accessToken = sessionStorage.getItem('access_token');

      // Session lost on refresh → try to restore via the httpOnly refreshToken cookie
      if (!storedUser || !accessToken) {
        try {
          const data = await refreshAuthSession('hospital-admin');
          storedUser = JSON.stringify(data.user);
          accessToken = data.accessToken;
        } catch {
          // Refresh token invalid/expired → send to login
          router.replace(HOSPITAL_ADMIN_LOGIN_PATH);
          return;
        }
      }

      try {
        const user = JSON.parse(storedUser!);
        if (user?.role === 'Hospital Admin') {
          setIsAuthorized(true);
          return;
        }
        if (user?.role === 'Receptionist') {
          router.replace(RECEPTIONIST_BASE_PATH);
          return;
        }
        router.replace(HOSPITAL_ADMIN_LOGIN_PATH);
      } catch {
        router.replace(HOSPITAL_ADMIN_LOGIN_PATH);
      }
    };

    restore();
  }, [router]);

  if (!isAuthorized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <>{children}</>;
}
