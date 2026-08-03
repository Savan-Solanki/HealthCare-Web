'use client';

import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ProfileMenu } from '@/components/dashboard/profile-menu';
import { AppointmentNotificationBell } from '@/components/dashboard/appointment-notification-bell';

const defaultDoctor = {
  userName: 'Doctor',
  userRole: 'Doctor',
};

const getStoredDoctor = () => {
  const storedUser = sessionStorage.getItem('auth_user');
  if (!storedUser) {
    return defaultDoctor;
  }

  try {
    const user = JSON.parse(storedUser);
    return {
      userName: user?.name || defaultDoctor.userName,
      userRole: user?.role || defaultDoctor.userRole,
    };
  } catch {
    return defaultDoctor;
  }
};

export function DoctorHeader() {
  const [{ userName, userRole }, setDoctor] = useState(defaultDoctor);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDoctor(getStoredDoctor());
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  const initials = userName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part: string) => part[0]?.toUpperCase())
    .join('') || 'DR';

  return (
    <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between border-b border-border bg-white px-6">
      <div className="relative w-80">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          size={15}
        />
        <Input
          placeholder="Search patients, appointments, prescriptions..."
          className="h-9 border-gray-200 bg-gray-50 pl-9 text-sm placeholder:text-muted-foreground/70 focus-visible:ring-1 focus-visible:ring-primary/30"
        />
      </div>

      <div className="flex items-center gap-3">
        <AppointmentNotificationBell />

        <div className="h-7 w-px bg-border" />

        <ProfileMenu
          userName={userName}
          secondaryText={userRole}
          initials={initials}
          role="doctor"
        />
      </div>
    </header>
  );
}
