'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Database,
  Building2,
  Files,
  HardDrive,
  TrendingUp,
  Clock,
  CalendarDays,
  BarChart3,
  PieChart,
  Download,
  RefreshCw,
  ArrowRight,
  FileText,
} from 'lucide-react';

import api from '@/lib/api';
import { getSuperAdminPath } from '@/lib/routes';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { StorageStatCard } from '@/components/storage/storage-stat-card';
import { MonthlyTrendChart, TopHospitalsChart, ModulePieChart } from '@/components/storage/storage-charts';
import { StorageModuleTable } from '@/components/storage/storage-module-table';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────
interface DashboardSummary {
  totalHospitals: number;
  trackedHospitals: number;
  totalFiles: number;
  totalBytes: number;
  totalBytesFormatted: string;
  avgBytesPerHospital: number;
  avgBytesPerHospitalFormatted: string;
  todayUploads: number;
  monthlyUploads: number;
  largestHospital: { hospitalName: string; totalBytes: number; totalBytesFormatted?: string } | null;
  smallestHospital: { hospitalName: string; totalBytes: number } | null;
}

interface TrendPoint {
  label: string;
  count: number;
  bytes: number;
  bytesFormatted: string;
}

interface ModuleSlice {
  module: string;
  totalFiles: number;
  totalBytes: number;
  totalBytesFormatted: string;
}

interface HospitalBar {
  hospitalName: string;
  totalBytes: number;
  totalFiles: number;
}

interface DashboardData {
  summary: DashboardSummary;
  topHospitals: HospitalBar[];
  moduleDistribution: ModuleSlice[];
  monthlyTrend: TrendPoint[];
}

const Skeleton = ({ className }: { className?: string }) => (
  <div className={cn('animate-pulse rounded-lg bg-gray-200', className)} />
);

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function StorageDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const res = await api.get('/admin/storage/dashboard');
      setData(res.data.data);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        || 'Failed to load storage data.';
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const handleExport = async (format: 'csv' | 'json') => {
    try {
      const res = await api.get(`/admin/storage/export?format=${format}`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `storage-export.${format}`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      alert('Export failed. Please try again.');
    }
  };

  const s = data?.summary;

  return (
    <div className="space-y-6">
      {/* ─── Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
              <Database size={16} className="text-white" />
            </div>
            <h1 className="text-xl font-bold text-foreground">Manage Storage</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Real-time AWS S3 storage analytics across all hospitals
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => void handleExport('csv')}
          >
            <Download size={13} />
            Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => void handleExport('json')}
          >
            <Download size={13} />
            Export JSON
          </Button>
          <Button
            size="sm"
            className="h-8 gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-700"
            onClick={() => void fetchData(true)}
            disabled={refreshing}
          >
            <RefreshCw size={13} className={cn(refreshing && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      {/* ─── Error ──────────────────────────────────────────────────── */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ─── Stat Cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StorageStatCard
          title="Total Hospitals"
          value={loading ? '—' : (s?.totalHospitals ?? 0).toLocaleString()}
          subtitle={loading ? '' : `${s?.trackedHospitals ?? 0} with tracked files`}
          icon={Building2}
          iconColor="text-blue-600"
          iconBg="bg-blue-50"
          loading={loading}
        />
        <StorageStatCard
          title="Total Files"
          value={loading ? '—' : (s?.totalFiles ?? 0).toLocaleString()}
          icon={Files}
          iconColor="text-violet-600"
          iconBg="bg-violet-50"
          loading={loading}
        />
        <StorageStatCard
          title="Total Storage Used"
          value={loading ? '—' : (s?.totalBytesFormatted ?? '0 B')}
          icon={HardDrive}
          iconColor="text-indigo-600"
          iconBg="bg-indigo-50"
          loading={loading}
        />
        <StorageStatCard
          title="Avg per Hospital"
          value={loading ? '—' : (s?.avgBytesPerHospitalFormatted ?? '0 B')}
          icon={TrendingUp}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50"
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StorageStatCard
          title="Largest Hospital"
          value={loading ? '—' : (s?.largestHospital?.hospitalName ?? '—')}
          subtitle={s?.largestHospital ? `${s.largestHospital.totalBytesFormatted ?? ''}` : undefined}
          icon={Database}
          iconColor="text-rose-600"
          iconBg="bg-rose-50"
          loading={loading}
        />
        <StorageStatCard
          title="Smallest Hospital"
          value={loading ? '—' : (s?.smallestHospital?.hospitalName ?? '—')}
          icon={Building2}
          iconColor="text-amber-600"
          iconBg="bg-amber-50"
          loading={loading}
        />
        <StorageStatCard
          title="Today's Uploads"
          value={loading ? '—' : (s?.todayUploads ?? 0).toLocaleString()}
          icon={Clock}
          iconColor="text-cyan-600"
          iconBg="bg-cyan-50"
          loading={loading}
        />
        <StorageStatCard
          title="Monthly Uploads"
          value={loading ? '—' : (s?.monthlyUploads ?? 0).toLocaleString()}
          icon={CalendarDays}
          iconColor="text-teal-600"
          iconBg="bg-teal-50"
          loading={loading}
        />
      </div>

      {/* ─── Charts Row ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Monthly Trend */}
        <Card className="xl:col-span-2 shadow-sm border-border">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp size={15} className="text-indigo-500" />
                Monthly Upload Trend
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">Storage growth over last 12 months</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[220px] w-full" />
            ) : (
              <MonthlyTrendChart data={data?.monthlyTrend ?? []} />
            )}
          </CardContent>
        </Card>

        {/* Module Distribution */}
        <Card className="shadow-sm border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <PieChart size={15} className="text-violet-500" />
              File Type Distribution
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">Storage by module</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[220px] w-full" />
            ) : (
              <ModulePieChart data={data?.moduleDistribution ?? []} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* ─── Top Hospitals + Module Breakdown ───────────────────────── */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* Top Hospitals Bar Chart */}
        <Card className="shadow-sm border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 size={15} className="text-blue-500" />
              Top 10 Largest Hospitals
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">By storage consumed</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[220px] w-full" />
            ) : (
              <TopHospitalsChart data={data?.topHospitals ?? []} />
            )}
          </CardContent>
        </Card>

        {/* Module Breakdown Table */}
        <Card className="shadow-sm border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Files size={15} className="text-emerald-500" />
              Storage by Module
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">Breakdown by file type</CardDescription>
          </CardHeader>
          <CardContent>
            <StorageModuleTable
              data={data?.moduleDistribution?.map((m) => ({
                ...m,
                avgFileSize: 0,
                avgFileSizeFormatted: '—',
              })) ?? []}
              loading={loading}
              totalBytes={s?.totalBytes ?? 0}
            />
          </CardContent>
        </Card>
      </div>

      {/* ─── View All Hospitals CTA ──────────────────────────────────── */}
      <Card className="border-indigo-100 bg-gradient-to-r from-indigo-50 to-violet-50 shadow-sm">
        <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-5 pb-5">
          <div>
            <p className="font-semibold text-foreground">Hospital Storage Details</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              View individual storage breakdown, largest files, and upload history per hospital.
            </p>
          </div>
          <Link href={getSuperAdminPath('/storage/hospitals')}>
            <Button className="shrink-0 bg-indigo-600 hover:bg-indigo-700 gap-2">
              View All Hospitals
              <ArrowRight size={15} />
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* ─── Prescription Count CTA ──────────────────────────────────── */}
      <Card className="border-violet-100 bg-gradient-to-r from-violet-50 to-purple-50 shadow-sm">
        <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-5 pb-5">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-600 shrink-0">
              <FileText size={16} className="text-white" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Prescription Count by Hospital</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                View total prescriptions issued per hospital — doctor-generated and patient-uploaded.
              </p>
            </div>
          </div>
          <Link href={getSuperAdminPath('/storage/prescriptions')}>
            <Button className="shrink-0 bg-violet-600 hover:bg-violet-700 gap-2">
              View Prescriptions
              <ArrowRight size={15} />
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
