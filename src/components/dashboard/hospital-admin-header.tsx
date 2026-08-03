'use client';

import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ProfileMenu } from '@/components/dashboard/profile-menu';
import { AppointmentNotificationBell } from '@/components/dashboard/appointment-notification-bell';

const defaultHospitalAdmin = {
  userName: 'Hospital Admin',
  hospitalName: 'Assigned Hospital',
  role: 'Hospital Admin',
};

const getStoredHospitalAdmin = () => {
  const storedUser = sessionStorage.getItem('auth_user');
  if (!storedUser) {
    return defaultHospitalAdmin;
  }

  try {
    const user = JSON.parse(storedUser);
      return {
        userName: user?.name || defaultHospitalAdmin.userName,
        role: user?.role || defaultHospitalAdmin.role,
        hospitalName:
          user?.hospitalId?.name ||
        user?.hospital?.name ||
        user?.hospitalName ||
        defaultHospitalAdmin.hospitalName,
    };
  } catch {
    return defaultHospitalAdmin;
  }
};

export function HospitalAdminHeader() {
  const [{ userName, hospitalName }, setHospitalAdmin] = useState(defaultHospitalAdmin);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setHospitalAdmin(getStoredHospitalAdmin());
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  const initials = userName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'HA';

  return (
    <header className="h-14 border-b border-border bg-white px-4 flex items-center justify-between sticky top-0 z-10 shrink-0">
      <div className="relative w-72">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          size={15}
        />
        <Input
          placeholder="Search patients, doctors, appointments..."
          className="pl-9 h-8 text-sm bg-gray-50 border-gray-200 focus-visible:ring-1 focus-visible:ring-primary/30 placeholder:text-muted-foreground/70"
        />
      </div>

      <div className="flex items-center gap-2.5">
        <AppointmentNotificationBell />

        <div className="w-px h-6 bg-border" />

        <ProfileMenu
          userName={userName}
          secondaryText={hospitalName}
          initials={initials}
          role="hospital-admin"
          compact
        />
      </div>
    </header>
  );
}
