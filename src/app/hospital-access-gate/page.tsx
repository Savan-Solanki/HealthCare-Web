import { Suspense } from 'react';
import { AdminLoginScreen } from '@/components/auth/admin-login-screen';

export default function HospitalAdminLoginPage() {
  return (
    <Suspense fallback={null}>
      <AdminLoginScreen mode="hospital-admin" />
    </Suspense>
  );
}
