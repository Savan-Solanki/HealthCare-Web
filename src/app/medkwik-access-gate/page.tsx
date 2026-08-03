import { Suspense } from 'react';
import { AdminLoginScreen } from '@/components/auth/admin-login-screen';

export default function HiddenAdminLoginPage() {
  return (
    <Suspense fallback={null}>
      <AdminLoginScreen />
    </Suspense>
  );
}
