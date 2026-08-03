import { Suspense } from 'react';
import { AdminLoginScreen } from '@/components/auth/admin-login-screen';

export default function ReceptionistLoginPage() {
  return (
    <Suspense fallback={null}>
      <AdminLoginScreen mode="receptionist" />
    </Suspense>
  );
}
