'use client';

import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ProfileMenu } from '@/components/dashboard/profile-menu';
import { AppointmentNotificationBell } from '@/components/dashboard/appointment-notification-bell';

const defaultReceptionist = {
  userName: 'Receptionist',
  hospitalName: 'Assigned Hospital',
};

const getStoredReceptionist = () => {
  const storedUser = sessionStorage.getItem('auth_user');
  if (!storedUser) return defaultReceptionist;

  try {
    const user = JSON.parse(storedUser);
    return {
      userName: user?.name || defaultReceptionist.userName,
      hospitalName:
        user?.hospitalId?.name || user?.hospital?.name || user?.hospitalName || defaultReceptionist.hospitalName,
    };
  } catch {
    return defaultReceptionist;
  }
};

export function ReceptionistHeader() {
  const [{ userName, hospitalName }, setReceptionist] = useState(defaultReceptionist);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setReceptionist(getStoredReceptionist());
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  const initials =
    userName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'RE';

  return (
    <header className="h-14 border-b border-border bg-white px-4 flex items-center justify-between sticky top-0 z-10 shrink-0">
      <div className="relative w-72">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          size={15}
        />
        <Input
          placeholder="Search patients and appointments..."
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
          role="receptionist"
          compact
        />
      </div>
    </header>
  );
}
