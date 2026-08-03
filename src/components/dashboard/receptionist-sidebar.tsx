'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { CalendarDays, CircleDollarSign, RefreshCw, UserRound, Bed } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getReceptionistPath } from '@/lib/routes';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  HOSPITAL_ADMIN_CACHE_EVENT,
  getLatestHospitalAdminCacheUpdate,
  refreshHospitalAdminCache,
} from '@/lib/hospital-admin-cache';

const navItems = [
  { href: getReceptionistPath('/patients'), label: 'Patients', icon: UserRound },
  { href: getReceptionistPath('/appointments'), label: 'Appointments', icon: CalendarDays },
  { href: getReceptionistPath('/admissions'), label: 'Admissions', icon: Bed },
  { href: getReceptionistPath('/receipts'), label: 'Receipts', icon: CircleDollarSign },
];

export function ReceptionistSidebar() {
  const pathname = usePathname();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setLastUpdated(getLatestHospitalAdminCacheUpdate());
    }, 0);

    const handleCacheUpdate = () => {
      setLastUpdated(getLatestHospitalAdminCacheUpdate());
    };

    window.addEventListener(HOSPITAL_ADMIN_CACHE_EVENT, handleCacheUpdate);
    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener(HOSPITAL_ADMIN_CACHE_EVENT, handleCacheUpdate);
    };
  }, []);

  const handleRefreshData = async () => {
    try {
      setIsRefreshing(true);
      await refreshHospitalAdminCache(['patients', 'appointments', 'doctors']);
      toast.success('Workspace data updated.');
      setLastUpdated(getLatestHospitalAdminCacheUpdate());
    } catch {
      toast.error('Failed to refresh workspace data.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const lastSyncLabel = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'Not synced yet';

  return (
    <aside className="w-52 shrink-0 border-r border-border bg-white h-screen sticky top-0 z-20 flex flex-col">
      <div className="px-4 py-3.5 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0 overflow-hidden">
            <Image
              src="/logo.jpg"
              alt="healthcare Logo"
              width={32}
              height={32}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm text-foreground leading-tight truncate">healthcare</p>
            <p className="text-xs text-primary font-medium">Receptionist</p>
          </div>
        </div>
      </div>

      <div className="px-3 py-3 flex-1 overflow-y-auto">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2 px-2">
          Front desk
        </p>
        <nav className="space-y-0.5">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href;

            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] font-medium transition-all duration-150',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-gray-50 hover:text-foreground'
                )}
              >
                <Icon
                  size={16}
                  className={cn(isActive ? 'text-primary' : 'text-muted-foreground')}
                />
                <span className="truncate">{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-border px-3 py-3">
        <Button
          onClick={() => void handleRefreshData()}
          disabled={isRefreshing}
          className="h-9 w-full justify-start gap-2.5 bg-primary text-white hover:bg-primary/90"
        >
          <RefreshCw size={16} className={cn(isRefreshing && 'animate-spin')} />
          <span>{isRefreshing ? 'Updating Data...' : 'Update Data Now'}</span>
        </Button>
        <p className="mt-2 px-1 text-[11px] text-muted-foreground">Last sync: {lastSyncLabel}</p>
      </div>
    </aside>
  );
}
