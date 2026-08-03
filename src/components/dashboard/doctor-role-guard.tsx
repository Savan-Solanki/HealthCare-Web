'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { refreshAuthSession } from '@/lib/auth-session';
import { DOCTOR_LOGIN_PATH } from '@/lib/routes';

export function DoctorRoleGuard({
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

      if (!storedUser || !accessToken) {
        try {
          const data = await refreshAuthSession('doctor');
          storedUser = JSON.stringify(data.user);
          accessToken = data.accessToken;
        } catch {
          router.replace(DOCTOR_LOGIN_PATH);
          return;
        }
      }

      try {
        const user = JSON.parse(storedUser);
        if (user?.role === 'Doctor') {
          setIsAuthorized(true);
        } else {
          router.replace(DOCTOR_LOGIN_PATH);
        }
      } catch {
        router.replace(DOCTOR_LOGIN_PATH);
      }
    };

    void restore();
  }, [router]);

  if (!isAuthorized) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <>{children}</>;
}
