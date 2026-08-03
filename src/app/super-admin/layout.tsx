import { Sidebar } from '@/components/dashboard/sidebar';
import { Header } from '@/components/dashboard/header';
import { AdminIdleGuard } from '@/components/dashboard/admin-idle-guard';
import { SuperAdminRoleGuard } from '@/components/dashboard/super-admin-role-guard';

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SuperAdminRoleGuard>
      <div className="flex h-screen bg-gray-50 overflow-hidden">
        <AdminIdleGuard />
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto p-6">
            {children}
          </main>
        </div>
      </div>
    </SuperAdminRoleGuard>
  );
}
