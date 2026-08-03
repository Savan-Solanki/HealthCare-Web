import { HospitalWorkspaceProvider } from '@/contexts/hospital-workspace-context';
import { DoctorHeader } from '@/components/dashboard/doctor-header';
import { DoctorRoleGuard } from '@/components/dashboard/doctor-role-guard';
import { DoctorSidebar } from '@/components/dashboard/doctor-sidebar';
import PlatformAdBanner from '@/components/dashboard/platform-ad-banner';

export default function DoctorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DoctorRoleGuard>
      <HospitalWorkspaceProvider portal="doctor">
        <div className="flex h-screen overflow-hidden bg-gray-50">
          <DoctorSidebar />
          <div className="flex flex-1 flex-col overflow-hidden">
            <DoctorHeader />
            <main className="flex-1 overflow-y-auto p-6">
              {children}
            </main>
          </div>
          <PlatformAdBanner />
        </div>
      </HospitalWorkspaceProvider>
    </DoctorRoleGuard>
  );
}
