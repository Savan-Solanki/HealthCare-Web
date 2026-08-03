'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, ShieldCheck, Users, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  SUPER_ADMIN_CACHE_EVENT,
  getSuperAdminCacheData,
  refreshSuperAdminCache,
} from '@/lib/super-admin-cache';
import { cn } from '@/lib/utils';
import { getSuperAdminPath } from '@/lib/routes';

type DashboardOverview = {
  usersByRole?: Array<{ _id: string; count: number }>;
};

const roles = [
  'Super Admin',
  'Hospital Admin',
  'Doctor',
  'Nurse',
  'Receptionist',
  'Staff',
] as const;

const permissionMatrix = [
  { permission: 'View system dashboard', values: [true, true, false, false, false, false] },
  { permission: 'Manage hospitals', values: [true, false, false, false, false, false] },
  { permission: 'Create hospital admin accounts', values: [true, false, false, false, false, false] },
  { permission: 'Manage hospital records', values: [true, true, false, false, false, false] },
  { permission: 'Manage clinical users', values: [true, true, false, false, false, false] },
  { permission: 'View reports and audit activity', values: [true, false, false, false, false, false] },
];

export default function AccessPermissionsPage() {
  const [overview, setOverview] = useState<DashboardOverview | null>(null);

  useEffect(() => {
    const hydrate = () => {
      setOverview(getSuperAdminCacheData<DashboardOverview>('dashboardOverview'));
    };

    const timeoutId = window.setTimeout(() => {
      hydrate();
      void refreshSuperAdminCache(['dashboardOverview']);
    }, 0);

    window.addEventListener(SUPER_ADMIN_CACHE_EVENT, hydrate);
    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener(SUPER_ADMIN_CACHE_EVENT, hydrate);
    };
  }, []);

  const countsByRole = useMemo(() => {
    const entries = overview?.usersByRole || [];
    return roles.map((role) => ({
      role,
      count: entries.find((entry) => entry._id === role)?.count || 0,
    }));
  }, [overview]);

  return (
    <div className="space-y-6">
      <nav className="flex text-xs text-muted-foreground gap-1 items-center">
        <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
        <span>/</span>
        <Link href={getSuperAdminPath()} className="hover:text-foreground transition-colors">Super Admin</Link>
        <span>/</span>
        <span className="text-foreground font-medium">Access & Permissions</span>
      </nav>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Access & Permissions</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Current release permissions are role-based and enforced by the backend. User assignment is managed from System Users.
          </p>
        </div>
        <Link href={getSuperAdminPath('/system-users')}>
          <Button className="gap-2 bg-primary hover:bg-primary/90 text-white">
            Manage users
            <ArrowRight size={16} />
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Role assignments</CardTitle>
            <CardDescription>Live account counts by role</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {countsByRole.map(({ role, count }) => (
              <div key={role} className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <Users className="text-primary" size={16} />
                  <span className="text-sm font-medium text-foreground">{role}</span>
                </div>
                <Badge variant="secondary" className="rounded-full px-2.5 py-1">
                  {count}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="shadow-sm md:col-span-1 xl:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Policy status</CardTitle>
            <CardDescription>What this release enforces today</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} className="text-emerald-600" />
                <p className="text-sm font-semibold text-emerald-800">Backend-enforced roles</p>
              </div>
              <p className="mt-1 text-sm text-emerald-700">
                Route access and API permissions are checked on the server for Super Admin and Hospital Admin areas.
              </p>
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-blue-600" />
                <p className="text-sm font-semibold text-blue-800">Account lifecycle</p>
              </div>
              <p className="mt-1 text-sm text-blue-700">
                Super Admin creates admin accounts. Hospital Admin accounts do not self-register in this release.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Role capability matrix</CardTitle>
          <CardDescription>
            This is the current operational policy for supported roles in production.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <Table>
            <TableHeader className="bg-gray-50/50">
              <TableRow>
                <TableHead className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Permission
                </TableHead>
                {roles.map((role) => (
                  <TableHead
                    key={role}
                    className="px-4 py-4 text-center text-[11px] font-bold uppercase tracking-wider text-muted-foreground"
                  >
                    {role}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {permissionMatrix.map((row) => (
                <TableRow key={row.permission} className="border-b border-border last:border-0">
                  <TableCell className="px-6 py-4 text-sm font-medium text-foreground">
                    {row.permission}
                  </TableCell>
                  {row.values.map((allowed, index) => (
                    <TableCell key={`${row.permission}-${roles[index]}`} className="px-4 py-4 text-center">
                      <span
                        className={cn(
                          'inline-flex items-center justify-center rounded-full p-1.5',
                          allowed ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'
                        )}
                      >
                        {allowed ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                      </span>
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
