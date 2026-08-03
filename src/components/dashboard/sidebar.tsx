'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Building2,
  UserCog,
  Users,
  ShieldCheck,
  FileBarChart2,
  ScrollText,
  Settings,
  RefreshCw,
  Megaphone,
  Coins,
  Database,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  SUPER_ADMIN_CACHE_EVENT,
  getLatestSuperAdminCacheUpdate,
  refreshSuperAdminCache,
} from '@/lib/super-admin-cache';
import { getSuperAdminPath } from '@/lib/routes';

const navItems = [
  { href: getSuperAdminPath(), label: 'Dashboard', icon: LayoutDashboard },
  { href: getSuperAdminPath('/manage-hospitals'), label: 'Manage Hospitals', icon: Building2 },
  { href: getSuperAdminPath('/hospital-admins'), label: 'Hospital Admins', icon: UserCog },
  { href: getSuperAdminPath('/system-users'), label: 'System Users', icon: Users },
  { href: getSuperAdminPath('/credits'), label: 'User Credits', icon: Coins },
  { href: getSuperAdminPath('/ads'), label: 'Advertisements', icon: Megaphone },
  { href: getSuperAdminPath('/storage'), label: 'Manage Storage', icon: Database },
  { href: getSuperAdminPath('/access-permissions'), label: 'Access Permissions', icon: ShieldCheck },
  { href: getSuperAdminPath('/reports'), label: 'Reports', icon: FileBarChart2 },
  { href: getSuperAdminPath('/system-logs'), label: 'System Logs', icon: ScrollText },
  { href: getSuperAdminPath('/settings'), label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setLastUpdated(getLatestSuperAdminCacheUpdate());
    }, 0);

    const handleCacheUpdate = () => {
      setLastUpdated(getLatestSuperAdminCacheUpdate());
    };

    window.addEventListener(SUPER_ADMIN_CACHE_EVENT, handleCacheUpdate);
    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener(SUPER_ADMIN_CACHE_EVENT, handleCacheUpdate);
    };
  }, []);

  const handleRefreshData = async () => {
    try {
      setIsRefreshing(true);
      const { succeeded, failed } = await refreshSuperAdminCache();
      setLastUpdated(getLatestSuperAdminCacheUpdate());

      if (failed.length === 0) {
        toast.success('Admin data updated successfully.');
      } else if (succeeded.length > 0) {
        // Partial success — some endpoints are unavailable but core data refreshed fine
        toast.success(`Data updated. (${failed.length} non-critical item(s) unavailable)`);
      } else {
        toast.error('Could not refresh data. Please check your connection.');
      }
    } catch {
      toast.error('Failed to update admin data.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const lastSyncLabel = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'Not synced yet';

  return (
    <aside className="w-56 shrink-0 flex flex-col border-r border-border bg-white h-screen sticky top-0 z-20">
      {/* Logo */}
      <div className="px-4 py-[18px] border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center shrink-0 overflow-hidden">
            <Image
              src="/logo.jpg"
              alt="healthcare Logo"
              width={36}
              height={36}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm text-foreground leading-tight truncate">healthcare</p>
            <p className="text-xs text-primary font-medium">Super Admin</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 px-3 py-4 overflow-y-auto">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2 px-2">
          Workspace
        </p>
        <nav className="space-y-0.5">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isRoot = href === getSuperAdminPath();
            const isActive = isRoot ? pathname === href : pathname === href || pathname.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-all duration-150',
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

      <div className="border-t border-border px-3 py-4">
        <Button
          onClick={() => void handleRefreshData()}
          disabled={isRefreshing}
          className="h-10 w-full justify-start gap-2.5 bg-primary text-white hover:bg-primary/90"
        >
          <RefreshCw size={16} className={cn(isRefreshing && 'animate-spin')} />
          <span>{isRefreshing ? 'Updating Data...' : 'Update Data Now'}</span>
        </Button>
        <p className="mt-2 px-1 text-[11px] text-muted-foreground">
          Last sync: {lastSyncLabel}
        </p>
      </div>
    </aside>
  );
}
