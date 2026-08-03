'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, Download, FileText, Loader2 } from 'lucide-react';

import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import {
  SUPER_ADMIN_CACHE_EVENT,
  getSuperAdminCacheData,
  setSuperAdminCacheData,
} from '@/lib/super-admin-cache';

type ReportType = 'users' | 'hospitals' | 'activity';

type SummaryValue = string | number;

type RecentUser = {
  name: string;
  email: string;
  role: string;
  status: string;
};

type RecentHospital = {
  name: string;
  city: string;
  beds: number;
  status: string;
};

type RecentEvent = {
  action: string;
  userName?: string | null;
  description: string;
  createdAt: string;
};

type ReportResponse = {
  summary?: Record<string, SummaryValue>;
  recentUsers?: RecentUser[];
  recentHospitals?: RecentHospital[];
  recentEvents?: RecentEvent[];
};

const Skeleton = ({ className }: { className?: string }) => (
  <div className={cn('animate-pulse rounded-lg bg-gray-200', className)} />
);

const statusBadgeClassName = (status: string) =>
  cn(
    'rounded-full px-2 py-1 text-xs font-medium',
    status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
  );

export default function ReportsPage() {
  const [reportType, setReportType] = useState<ReportType>('users');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ReportResponse | null>(() => getSuperAdminCacheData<ReportResponse>('report:users'));
  const [error, setError] = useState<string | null>(null);

  const getReportCacheKey = (type: ReportType) => `report:${type}` as const;

  useEffect(() => {
    const handleCacheUpdate = () => {
      const cachedReport = getSuperAdminCacheData<ReportResponse>(getReportCacheKey(reportType));
      if (!cachedReport) return;

      setData(cachedReport);
      setError(null);
    };

    window.addEventListener(SUPER_ADMIN_CACHE_EVENT, handleCacheUpdate);
    return () => window.removeEventListener(SUPER_ADMIN_CACHE_EVENT, handleCacheUpdate);
  }, [reportType]);

  const handleGenerate = async (type: ReportType = reportType) => {
    setLoading(true);
    setError(null);
    setData(null);

    try {
      const response = await api.get<ReportResponse>(`/reports?type=${type}`);
      setData(response.data);
      setSuperAdminCacheData(getReportCacheKey(type), response.data);
    } catch (error: unknown) {
      const message =
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        typeof (error as { response?: { data?: { message?: unknown } } }).response?.data?.message === 'string'
          ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
          : 'Failed to generate report';

      setError(message ?? 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      const response = await api.get(`/reports?type=${reportType}&format=csv`, {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${reportType}-report.csv`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error: unknown) {
      const message =
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        typeof (error as { response?: { data?: { message?: unknown } } }).response?.data?.message === 'string'
          ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
          : 'Export failed';

      window.alert(message ?? 'Export failed');
    }
  };

  return (
    <Card className="overflow-hidden rounded-xl border-border shadow-sm">
      <CardHeader className="border-b border-border bg-gray-50/30 p-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <CardTitle className="text-2xl font-bold">Reports</CardTitle>
            <CardDescription className="mt-1 text-sm font-medium text-muted-foreground">
              Analyze system performance and export reports
            </CardDescription>
          </div>
          {data && (
            <Button
              onClick={handleExportCSV}
              variant="outline"
              className="h-10 gap-2 rounded-lg border-gray-200 font-medium"
            >
              <Download size={16} />
              Export CSV
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-8 p-6">
        <div className="flex flex-col items-end gap-4 rounded-xl border border-border bg-gray-50/50 p-5 lg:flex-row">
          <div className="w-full space-y-2 lg:w-1/2">
            <Label className="text-xs font-bold uppercase text-muted-foreground">Report Type</Label>
            <Select
              value={reportType}
              onValueChange={(value) => {
                const nextType = value as ReportType;
                setReportType(nextType);
                setData(getSuperAdminCacheData<ReportResponse>(getReportCacheKey(nextType)));
                setError(null);
              }}
            >
              <SelectTrigger className="h-11 rounded-lg border-gray-200 bg-white">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="users">Users (staff + patients)</SelectItem>
                <SelectItem value="hospitals">Hospitals</SelectItem>
                <SelectItem value="activity">Activity</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={() => void handleGenerate()}
            disabled={loading}
            className="h-11 w-full rounded-lg bg-primary px-8 font-semibold text-white shadow-sm transition-all hover:bg-primary/90 lg:w-auto"
          >
            {loading ? <Loader2 className="mr-2 animate-spin" size={18} /> : null}
            Generate Report
          </Button>
        </div>

        {error && (
          <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
            <AlertCircle className="text-red-600" size={20} />
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {loading && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((item) => (
                <Skeleton key={item} className="h-24" />
              ))}
            </div>
            <Skeleton className="h-[300px]" />
          </div>
        )}

        {!data && !loading && !error && (
          <div className="flex h-[300px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-100 text-center">
            <div className="mb-4 rounded-full bg-gray-50 p-4">
              <FileText className="text-gray-300" size={48} />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">No report generated</h3>
            <p className="mt-1 max-w-xs text-gray-500">Select a report type to analyze system data.</p>
          </div>
        )}

        {data && !loading && (
          <div className="space-y-8 duration-500 animate-in fade-in">
            {data.summary && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                {Object.entries(data.summary).map(([key, value]) => (
                  <Card key={key} className="border-blue-100/50 bg-blue-50/30 shadow-none">
                    <CardContent className="p-5">
                      <p className="text-xs font-semibold uppercase text-blue-600/70">{key}</p>
                      <p className="mt-2 text-2xl font-bold text-blue-900">
                        {typeof value === 'number' ? value.toLocaleString() : value}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {data.recentUsers && (
              <Card className="overflow-hidden border-border shadow-sm">
                <CardHeader className="border-b border-border bg-gray-50/30 p-5">
                  <CardTitle className="text-sm font-bold uppercase text-muted-foreground">Recent Users</CardTitle>
                </CardHeader>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-gray-50/50">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="px-6 py-4 text-[11px] font-bold uppercase text-muted-foreground">Name</TableHead>
                        <TableHead className="px-6 py-4 text-[11px] font-bold uppercase text-muted-foreground">Email</TableHead>
                        <TableHead className="px-6 py-4 text-[11px] font-bold uppercase text-muted-foreground">Role</TableHead>
                        <TableHead className="px-6 py-4 text-[11px] font-bold uppercase text-muted-foreground">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.recentUsers.map((user, index) => (
                        <TableRow
                          key={`${user.email}-${index}`}
                          className="border-b border-gray-50 transition-colors last:border-0 hover:bg-gray-50/30"
                        >
                          <TableCell className="px-6 py-4 text-sm font-medium">{user.name}</TableCell>
                          <TableCell className="px-6 py-4 text-sm text-gray-600">{user.email}</TableCell>
                          <TableCell className="px-6 py-4 text-sm text-gray-600">{user.role}</TableCell>
                          <TableCell className="px-6 py-4 text-sm">
                            <span className={statusBadgeClassName(user.status)}>{user.status}</span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            )}

            {data.recentHospitals && (
              <Card className="overflow-hidden border-border shadow-sm">
                <CardHeader className="border-b border-border bg-gray-50/30 p-5">
                  <CardTitle className="text-sm font-bold uppercase text-muted-foreground">
                    Recent Hospitals
                  </CardTitle>
                </CardHeader>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-gray-50/50">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="px-6 py-4 text-[11px] font-bold uppercase text-muted-foreground">Name</TableHead>
                        <TableHead className="px-6 py-4 text-[11px] font-bold uppercase text-muted-foreground">City</TableHead>
                        <TableHead className="px-6 py-4 text-[11px] font-bold uppercase text-muted-foreground">Beds</TableHead>
                        <TableHead className="px-6 py-4 text-[11px] font-bold uppercase text-muted-foreground">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.recentHospitals.map((hospital, index) => (
                        <TableRow
                          key={`${hospital.name}-${index}`}
                          className="border-b border-gray-50 transition-colors last:border-0 hover:bg-gray-50/30"
                        >
                          <TableCell className="px-6 py-4 text-sm font-medium">{hospital.name}</TableCell>
                          <TableCell className="px-6 py-4 text-sm text-gray-600">{hospital.city}</TableCell>
                          <TableCell className="px-6 py-4 text-sm text-gray-600">{hospital.beds}</TableCell>
                          <TableCell className="px-6 py-4 text-sm">
                            <span className={statusBadgeClassName(hospital.status)}>{hospital.status}</span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            )}

            {data.recentEvents && (
              <Card className="overflow-hidden border-border shadow-sm">
                <CardHeader className="border-b border-border bg-gray-50/30 p-5">
                  <CardTitle className="text-sm font-bold uppercase text-muted-foreground">Recent Activity</CardTitle>
                </CardHeader>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-gray-50/50">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="px-6 py-4 text-[11px] font-bold uppercase text-muted-foreground">Action</TableHead>
                        <TableHead className="px-6 py-4 text-[11px] font-bold uppercase text-muted-foreground">User</TableHead>
                        <TableHead className="px-6 py-4 text-[11px] font-bold uppercase text-muted-foreground">Description</TableHead>
                        <TableHead className="px-6 py-4 text-[11px] font-bold uppercase text-muted-foreground">Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.recentEvents.map((event, index) => (
                        <TableRow
                          key={`${event.action}-${event.createdAt}-${index}`}
                          className="border-b border-gray-50 transition-colors last:border-0 hover:bg-gray-50/30"
                        >
                          <TableCell className="px-6 py-4 text-sm font-medium">{event.action}</TableCell>
                          <TableCell className="px-6 py-4 text-sm text-gray-600">{event.userName || 'System'}</TableCell>
                          <TableCell className="px-6 py-4 text-sm text-gray-600">{event.description}</TableCell>
                          <TableCell className="px-6 py-4 text-sm text-gray-600">
                            {new Date(event.createdAt).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
