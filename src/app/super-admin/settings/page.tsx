'use client';

import { useEffect, useState } from 'react';
import {
  Lock,
  ShieldCheck,
  TimerReset,
  Waypoints,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  SUPER_ADMIN_CACHE_EVENT,
  getSuperAdminCacheData,
  refreshSuperAdminCache,
} from '@/lib/super-admin-cache';

type SystemStatus = {
  status?: string;
  security?: {
    jwtEnabled?: boolean;
    corsEnabled?: boolean;
    rateLimitEnabled?: boolean;
    helmetEnabled?: boolean;
  };
  server?: {
    nodeVersion?: string;
    platform?: string;
    arch?: string;
  };
};

const publicSiteName =
  process.env.NEXT_PUBLIC_SITE_NAME || 'MedKwik HealthBuddy Admin Dashboard';

const publicSiteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'Not configured';

const isTurnstileEnabled = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

const statusBadgeClassName: Record<string, string> = {
  healthy: 'bg-emerald-50 text-emerald-700',
  degraded: 'bg-amber-50 text-amber-700',
  critical: 'bg-red-50 text-red-700',
};

export default function SettingsPage() {
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);

  useEffect(() => {
    const hydrate = () => {
      setSystemStatus(getSuperAdminCacheData<SystemStatus>('systemStatus'));
    };

    const timeoutId = window.setTimeout(() => {
      hydrate();
      void refreshSuperAdminCache(['systemStatus']);
    }, 0);

    window.addEventListener(SUPER_ADMIN_CACHE_EVENT, hydrate);
    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener(SUPER_ADMIN_CACHE_EVENT, hydrate);
    };
  }, []);

  const securityItems = [
    { label: 'JWT access control', enabled: Boolean(systemStatus?.security?.jwtEnabled), icon: ShieldCheck },
    { label: 'CORS protection', enabled: Boolean(systemStatus?.security?.corsEnabled), icon: Waypoints },
    { label: 'Rate limiting', enabled: Boolean(systemStatus?.security?.rateLimitEnabled), icon: TimerReset },
    { label: 'Helmet headers', enabled: Boolean(systemStatus?.security?.helmetEnabled), icon: Lock },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Runtime and security configuration for the current deployed admin environment.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="shadow-sm lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Platform profile</CardTitle>
            <CardDescription>Public-facing application details for this admin deployment</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-border px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Application name</p>
              <p className="mt-2 text-sm font-medium text-foreground">{publicSiteName}</p>
            </div>
            <div className="rounded-lg border border-border px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Application URL</p>
              <p className="mt-2 text-sm font-medium text-foreground break-all">{publicSiteUrl}</p>
            </div>
            <div className="rounded-lg border border-border px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Runtime</p>
              <p className="mt-2 text-sm font-medium text-foreground">
                {systemStatus?.server?.nodeVersion || 'Unavailable'}
              </p>
            </div>
            <div className="rounded-lg border border-border px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Host platform</p>
              <p className="mt-2 text-sm font-medium text-foreground">
                {[systemStatus?.server?.platform, systemStatus?.server?.arch].filter(Boolean).join(' / ') || 'Unavailable'}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Environment health</CardTitle>
            <CardDescription>Live configuration health snapshot</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-border px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</p>
              <Badge
                variant="secondary"
                className={`mt-2 rounded-full px-2.5 py-1 ${statusBadgeClassName[systemStatus?.status || 'healthy'] || statusBadgeClassName.healthy}`}
              >
                {(systemStatus?.status || 'healthy').toUpperCase()}
              </Badge>
            </div>
            <div className="rounded-lg border border-border px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Captcha</p>
              <p className="mt-2 text-sm font-medium text-foreground">
                {isTurnstileEnabled ? 'Cloudflare Turnstile enabled' : 'Turnstile key missing'}
              </p>
            </div>
            <div className="rounded-lg border border-border px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Session policy</p>
              <p className="mt-2 text-sm font-medium text-foreground">
                OTP login, refresh rotation, and idle session protection enabled
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Security controls</CardTitle>
          <CardDescription>
            These controls are enforced by the backend or shared platform middleware in the current release.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {securityItems.map(({ label, enabled, icon: Icon }) => (
            <div key={label} className="rounded-lg border border-border px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <Icon size={18} className={enabled ? 'text-emerald-600' : 'text-amber-600'} />
                <Badge
                  variant="secondary"
                  className={enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}
                >
                  {enabled ? 'Enabled' : 'Check config'}
                </Badge>
              </div>
              <p className="mt-3 text-sm font-medium text-foreground">{label}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
