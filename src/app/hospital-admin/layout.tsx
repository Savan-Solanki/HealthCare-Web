import { HospitalWorkspaceProvider } from '@/contexts/hospital-workspace-context';
import { HospitalAdminHeader } from '@/components/dashboard/hospital-admin-header';
import { HospitalAdminRoleGuard } from '@/components/dashboard/hospital-admin-role-guard';
import { HospitalAdminSidebar } from '@/components/dashboard/hospital-admin-sidebar';
import PlatformAdBanner from '@/components/dashboard/platform-ad-banner';

export default function HospitalAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <HospitalAdminRoleGuard>
      <HospitalWorkspaceProvider portal="hospital-admin">
        <div className="flex h-screen bg-gray-50 overflow-hidden">
          <HospitalAdminSidebar />
          <div className="flex-1 flex flex-col overflow-hidden">
            <HospitalAdminHeader />
            <main className="flex-1 overflow-y-auto p-4">{children}</main>
          </div>
          <PlatformAdBanner />
        </div>
      </HospitalWorkspaceProvider>
    </HospitalAdminRoleGuard>
  );
}
