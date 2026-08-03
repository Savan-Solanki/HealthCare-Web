'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  ArrowRight,
  Building2,
  Download,
  FileBarChart2,
  Loader2,
  Plus,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/dashboard/stat-card';
import { DepartmentLoadChart } from '@/components/dashboard/charts/department-load-chart';
import { MonthlyVisitsChart } from '@/components/dashboard/charts/monthly-visits-chart';
import {
  SUPER_ADMIN_CACHE_EVENT,
  getSuperAdminCacheData,
  refreshSuperAdminCache,
} from '@/lib/super-admin-cache';
import { getSuperAdminPath } from '@/lib/routes';

type DashboardOverview = {
  totalUsers: number;
  activeUsers: number;
  totalPatients?: number;
  totalStaffUsers?: number;
  activeStaffUsers?: number;
  totalHospitals: number;
  activeHospitals: number;
  recentActivity: Array<{
    _id?: string;
    action: string;
    description: string;
    createdAt: string;
    userId?: { name?: string | null; role?: string | null } | null;
  }>;
  userGrowth: Array<{ _id: string; count: number }>;
  usersByRole: Array<{ _id: string; count: number }>;
};

type SystemStatus = {
  server?: {
    uptime?: string;
  };
};

const chartPalette = ['#2563eb', '#16a34a', '#f97316', '#8b5cf6', '#ef4444', '#6b7280'];

const emptyOverview: DashboardOverview = {
  totalUsers: 0,
  activeUsers: 0,
  totalHospitals: 0,
  activeHospitals: 0,
  recentActivity: [],
  userGrowth: [],
  usersByRole: [],
};

const formatGrowthMonth = (value: string) => {
  const [year, month] = value.split('-');
  const parsedDate = new Date(Number(year), Number(month) - 1, 1);
  return parsedDate.toLocaleString('en-US', { month: 'short' });
};

export function SuperAdminDashboard() {
  const [overview, setOverview] = useState<DashboardOverview>(emptyOverview);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const hydrateFromCache = () => {
      const cachedOverview = getSuperAdminCacheData<DashboardOverview>('dashboardOverview');
      const cachedStatus = getSuperAdminCacheData<SystemStatus>('systemStatus');

      if (cachedOverview) {
        setOverview(cachedOverview);
        setLoading(false);
      }

      if (cachedStatus) {
        setSystemStatus(cachedStatus);
      }
    };

    const timeoutId = window.setTimeout(() => {
      hydrateFromCache();

      void refreshSuperAdminCache(['dashboardOverview', 'systemStatus']).finally(() => {
        setLoading(false);
      });
    }, 0);

    window.addEventListener(SUPER_ADMIN_CACHE_EVENT, hydrateFromCache);

    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener(SUPER_ADMIN_CACHE_EVENT, hydrateFromCache);
    };
  }, []);

  const activeUsersTrend = useMemo(() => {
    if (!overview.totalUsers) return '0%';
    return `${Math.round((overview.activeUsers / overview.totalUsers) * 100)}%`;
  }, [overview.activeUsers, overview.totalUsers]);

  const activeHospitalsTrend = useMemo(() => {
    if (!overview.totalHospitals) return '0%';
    return `${Math.round((overview.activeHospitals / overview.totalHospitals) * 100)}%`;
  }, [overview.activeHospitals, overview.totalHospitals]);

  const userGrowthData = useMemo(
    () =>
      overview.userGrowth.map((entry) => ({
        month: formatGrowthMonth(entry._id),
        visits: entry.count,
      })),
    [overview.userGrowth]
  );

  const usersByRoleData = useMemo(
    () =>
      overview.usersByRole.map((entry, index) => ({
        name: entry._id,
        value: entry.count,
        color: chartPalette[index % chartPalette.length],
      })),
    [overview.usersByRole]
  );

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
        <span>/</span>
        <span className="text-foreground font-medium">Super Admin</span>
      </nav>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">System overview</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Live operational summary across connected hospitals and admin accounts.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={getSuperAdminPath('/reports')}>
            <Button variant="outline" size="sm" className="gap-1.5 h-9">
              <Download size={14} />
              Reports
            </Button>
          </Link>
          <Link href={getSuperAdminPath('/manage-hospitals')}>
            <Button size="sm" className="gap-1.5 h-9 bg-primary hover:bg-primary/90">
              <Plus size={14} />
              Add hospital
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard
          icon={Building2}
          iconBg="bg-blue-50"
          iconColor="text-blue-500"
          value={loading ? '...' : overview.totalHospitals.toLocaleString()}
          label="Connected hospitals"
          trend={{ value: activeHospitalsTrend, direction: 'up', label: 'active' }}
        />
        <StatCard
          icon={Users}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-500"
          value={loading ? '...' : overview.activeUsers.toLocaleString()}
          label="Active users (staff + patients)"
          trend={{ value: activeUsersTrend, direction: 'up', label: 'active' }}
        />
        <StatCard
          icon={Users}
          iconBg="bg-cyan-50"
          iconColor="text-cyan-600"
          value={loading ? '...' : (overview.totalPatients ?? 0).toLocaleString()}
          label="Registered patients"
        />
        <StatCard
          icon={Activity}
          iconBg="bg-violet-50"
          iconColor="text-violet-500"
          value={systemStatus?.server?.uptime || (loading ? '...' : 'Unavailable')}
          label="System uptime"
        />
        <StatCard
          icon={FileBarChart2}
          iconBg="bg-orange-50"
          iconColor="text-orange-500"
          value={loading ? '...' : overview.recentActivity.length.toString()}
          label="Recent events"
        />
      </div>

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          <div className="flex h-[300px] items-center justify-center rounded-xl border border-border bg-gray-50">
            <Loader2 className="animate-spin text-muted-foreground" size={24} />
          </div>
          <div className="flex h-[300px] items-center justify-center rounded-xl border border-border bg-gray-50">
            <Loader2 className="animate-spin text-muted-foreground" size={24} />
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4 xl:flex-row">
          <MonthlyVisitsChart
            title="User Growth"
            subtitle="New staff and patient accounts over the last 6 months"
            data={userGrowthData.length > 0 ? userGrowthData : undefined}
            valueLabel="Users"
          />
          <DepartmentLoadChart
            title="Role Distribution"
            subtitle="Current active account mix"
            data={usersByRoleData.length > 0 ? usersByRoleData : undefined}
            tooltipLabel="Users"
            tooltipSuffix=""
          />
        </div>
      )}

      <Card className="border-border shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Recent activity</CardTitle>
          <Link href={getSuperAdminPath('/system-logs')}>
            <Button variant="ghost" size="sm" className="gap-1 text-primary">
              View logs
              <ArrowRight size={14} />
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="space-y-3">
          {overview.recentActivity.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
              No recent activity has been recorded yet.
            </div>
          ) : (
            overview.recentActivity.map((item, index) => (
              <div
                key={item._id || `${item.action}-${index}`}
                className="rounded-lg border border-border bg-gray-50/40 px-4 py-3"
              >
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm font-semibold text-foreground">{item.action}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(item.createdAt).toLocaleString()}
                  </p>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  By {item.userId?.name || 'System'} {item.userId?.role ? `· ${item.userId.role}` : ''}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
