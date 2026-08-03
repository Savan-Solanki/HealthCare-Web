import { Suspense } from 'react';
import { AdminLoginScreen } from '@/components/auth/admin-login-screen';

export default function DoctorLoginPage() {
  return (
    <Suspense fallback={null}>
      <AdminLoginScreen mode="doctor" />
    </Suspense>
  );
}
