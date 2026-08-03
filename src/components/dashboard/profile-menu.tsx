'use client';

import { LogOut } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import api from '@/lib/api';
import { clearAdminSessionCookie } from '@/lib/admin-session-cookie';
import { clearSuperAdminCache } from '@/lib/super-admin-cache';
import { clearHospitalAdminCache } from '@/lib/hospital-admin-cache';
import {
  ADMIN_LOGIN_PATH,
  DOCTOR_LOGIN_PATH,
  HOSPITAL_ADMIN_LOGIN_PATH,
  RECEPTIONIST_LOGIN_PATH,
} from '@/lib/routes';
import { clearReceptionistSessionCookie } from '@/lib/admin-session-cookie';

type ProfileMenuRole = 'super-admin' | 'hospital-admin' | 'receptionist' | 'doctor';

type ProfileMenuProps = {
  userName: string;
  secondaryText: string;
  initials: string;
  role: ProfileMenuRole;
  compact?: boolean;
};

const clearDoctorCache = () => {
  if (typeof window === 'undefined') return;
  Object.keys(window.localStorage)
    .filter((key) => key.startsWith('doctor_cache:'))
    .forEach((key) => window.localStorage.removeItem(key));
};

export function ProfileMenu({
  userName,
  secondaryText,
  initials,
  role,
  compact = false,
}: ProfileMenuProps) {
  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Best effort logout; local cleanup still happens below.
    }

    clearAdminSessionCookie();

    if (typeof window !== 'undefined') {
      if (role === 'super-admin') {
        clearSuperAdminCache();
      } else if (role === 'hospital-admin') {
        clearHospitalAdminCache();
      } else if (role === 'receptionist') {
        clearHospitalAdminCache();
        clearReceptionistSessionCookie();
      } else {
        clearDoctorCache();
      }

      sessionStorage.clear();

      const loginPath =
        role === 'super-admin'
          ? ADMIN_LOGIN_PATH
          : role === 'hospital-admin'
            ? HOSPITAL_ADMIN_LOGIN_PATH
            : role === 'receptionist'
              ? RECEPTIONIST_LOGIN_PATH
              : DOCTOR_LOGIN_PATH;

      window.location.href = loginPath;
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={`h-auto rounded-lg px-2 py-1.5 hover:bg-gray-50 ${compact ? 'gap-2' : 'gap-2.5'}`}
        >
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary text-xs font-semibold text-white">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="text-left">
            <p className={compact ? 'text-[13px] font-semibold leading-tight text-foreground' : 'text-sm font-semibold leading-tight text-foreground'}>
              {userName}
            </p>
            <p className="text-[11px] leading-tight text-muted-foreground">{secondaryText}</p>
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <div className="flex flex-col">
              <span className="font-medium text-foreground">{userName}</span>
              <span className="text-xs text-muted-foreground">{secondaryText}</span>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={handleLogout}>
          <LogOut size={16} />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
