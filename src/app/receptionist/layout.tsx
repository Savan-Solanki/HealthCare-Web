import { HospitalWorkspaceProvider } from '@/contexts/hospital-workspace-context';
import { ReceptionistHeader } from '@/components/dashboard/receptionist-header';
import { ReceptionistRoleGuard } from '@/components/dashboard/receptionist-role-guard';
import { ReceptionistSidebar } from '@/components/dashboard/receptionist-sidebar';
import PlatformAdBanner from '@/components/dashboard/platform-ad-banner';

export default function ReceptionistLayout({ children }: { children: React.ReactNode }) {
  return (
    <ReceptionistRoleGuard>
      <HospitalWorkspaceProvider portal="receptionist">
        <div className="flex h-screen bg-gray-50 overflow-hidden">
          <ReceptionistSidebar />
          <div className="flex-1 flex flex-col overflow-hidden">
            <ReceptionistHeader />
            <main className="flex-1 overflow-y-auto p-4">{children}</main>
          </div>
          <PlatformAdBanner />
        </div>
      </HospitalWorkspaceProvider>
    </ReceptionistRoleGuard>
  );
}
