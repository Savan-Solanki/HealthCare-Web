'use client';

import { useEffect, useState } from 'react';
import { Bell, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ProfileMenu } from '@/components/dashboard/profile-menu';

const defaultAdminUser = {
  userName: 'Admin User',
  userRole: 'System Administrator',
};

const getStoredAdminUser = () => {
  const storedUser = sessionStorage.getItem('auth_user');
  if (!storedUser) {
    return defaultAdminUser;
  }

  try {
    const user = JSON.parse(storedUser);
    return {
      userName: user?.name || defaultAdminUser.userName,
      userRole: user?.role || defaultAdminUser.userRole,
    };
  } catch {
    return defaultAdminUser;
  }
};

export function Header() {
  const [{ userName, userRole }, setAdminUser] = useState(defaultAdminUser);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setAdminUser(getStoredAdminUser());
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  const initials = userName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part: string) => part[0]?.toUpperCase())
    .join('') || 'AU';

  return (
    <header className="h-16 border-b border-border bg-white px-6 flex items-center justify-between sticky top-0 z-10 shrink-0">
      {/* Search */}
      <div className="relative w-80">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          size={15}
        />
        <Input
          placeholder="Search patients, doctors, appointments..."
          className="pl-9 h-9 text-sm bg-gray-50 border-gray-200 focus-visible:ring-1 focus-visible:ring-primary/30 placeholder:text-muted-foreground/70"
        />
      </div>

      {/* Right Side */}
      <div className="flex items-center gap-3">
        {/* Notification Bell */}
        <Button variant="ghost" size="icon" className="relative w-9 h-9 rounded-full hover:bg-gray-100">
          <Bell size={18} className="text-gray-500" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white" />
        </Button>

        {/* Divider */}
        <div className="w-px h-7 bg-border" />

        {/* User Info */}
        <ProfileMenu
          userName={userName}
          secondaryText={userRole}
          initials={initials}
          role="super-admin"
        />
      </div>
    </header>
  );
}
