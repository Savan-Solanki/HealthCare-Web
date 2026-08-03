'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Bell,
  Calendar,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pill,
  RefreshCw,
  Send,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type ReminderStats = {
  activeReminders: number;
  sentToday: number;
  failedToday: number;
  missedReminders: number;
};

type NotificationLog = {
  id: string;
  patientName: string;
  medicineName: string;
  category: 'medicine_reminder' | 'prescription' | 'appointment' | string;
  status: 'sent' | 'failed' | 'skipped';
  sentAt: string;
};

type LogsResponse = {
  data: NotificationLog[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

type Filters = {
  status: string;
  category: string;
  dateRange: string;
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const Skeleton = ({ className }: { className?: string }) => (
  <div className={cn('animate-pulse rounded-xl bg-gray-100', className)} />
);

/** Map notification status to badge styling. */
const getStatusBadgeClass = (status: string) => {
  switch (status) {
    case 'sent':
      return 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-50';
    case 'failed':
      return 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-50';
    case 'skipped':
      return 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-50';
    default:
      return 'bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-50';
  }
};

/** Map notification status to an icon. */
const StatusIcon = ({ status }: { status: string }) => {
  switch (status) {
    case 'sent':
      return <CheckCircle className="mr-1 h-3 w-3" />;
    case 'failed':
      return <XCircle className="mr-1 h-3 w-3" />;
    case 'skipped':
      return <AlertTriangle className="mr-1 h-3 w-3" />;
    default:
      return null;
  }
};

/** Human-readable category label. */
const formatCategory = (category: string) => {
  switch (category) {
    case 'medicine_reminder':
      return 'Medicine Reminder';
    case 'prescription':
      return 'Prescription';
    case 'appointment':
      return 'Appointment';
    default:
      return category;
  }
};

/** Icon for each category. */
const CategoryIcon = ({ category }: { category: string }) => {
  switch (category) {
    case 'medicine_reminder':
      return <Pill className="mr-1 h-3 w-3" />;
    case 'prescription':
      return <Activity className="mr-1 h-3 w-3" />;
    case 'appointment':
      return <Calendar className="mr-1 h-3 w-3" />;
    default:
      return <Bell className="mr-1 h-3 w-3" />;
  }
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function SuperAdminRemindersPage() {
  const [stats, setStats] = useState<ReminderStats | null>(null);
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [filters, setFilters] = useState<Filters>({
    status: 'all',
    category: 'all',
    dateRange: 'today',
  });

  /* ---- Data fetching ---- */

  const fetchStats = useCallback(async () => {
    try {
      const response = await api.get<{ data: ReminderStats }>('/admin/reminders/stats');
      setStats(response.data?.data ?? null);
    } catch {
      toast.error('Failed to load reminder statistics.');
    }
  }, []);

  const fetchLogs = useCallback(
    async (page: number, activeFilters: Filters) => {
      setLogsLoading(true);
      try {
        const params: Record<string, string | number> = { page, limit: 20 };

        if (activeFilters.status !== 'all') params.status = activeFilters.status;
        if (activeFilters.category !== 'all') params.category = activeFilters.category;
        if (activeFilters.dateRange !== 'all') params.dateRange = activeFilters.dateRange;

        const response = await api.get<LogsResponse>('/admin/reminders/logs', { params });

        setLogs(response.data?.data ?? []);
        setTotalPages(response.data?.pagination?.totalPages ?? 1);
      } catch {
        toast.error('Failed to load notification logs.');
        setLogs([]);
      } finally {
        setLogsLoading(false);
      }
    },
    [],
  );

  /* ---- Initial load ---- */

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        await Promise.all([fetchStats(), fetchLogs(1, filters)]);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---- Re-fetch logs when page or filters change (skip initial) ---- */

  useEffect(() => {
    if (loading) return;
    void fetchLogs(currentPage, filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, filters]);

  /* ---- Resend a failed notification ---- */

  const handleResend = async (logId: string) => {
    setResendingId(logId);
    try {
      await api.post(`/admin/reminders/resend/${logId}`);
      toast.success('Notification resent successfully.');
      await fetchLogs(currentPage, filters);
    } catch {
      toast.error('Failed to resend notification.');
    } finally {
      setResendingId(null);
    }
  };

  /* ---- Filter helpers ---- */

  const updateFilter = (key: keyof Filters, value: string | null) => {
    if (value == null) return;
    setCurrentPage(1);
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  /* ---- Full-page skeleton ---- */

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[110px]" />
          ))}
        </div>
        <Skeleton className="h-[500px]" />
      </div>
    );
  }

  /* ---- Render ---- */

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Reminder monitoring</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Track notification delivery, view logs, and resend failed reminders across the platform.
        </p>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/*  Stats cards                                                      */}
      {/* ---------------------------------------------------------------- */}
      {stats && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Active Reminders */}
          <Card className="border-green-200 shadow-sm">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-50">
                <Bell className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.activeReminders}</p>
                <p className="text-xs text-muted-foreground">Active Reminders</p>
              </div>
            </CardContent>
          </Card>

          {/* Sent Today */}
          <Card className="border-blue-200 shadow-sm">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50">
                <Send className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.sentToday}</p>
                <p className="text-xs text-muted-foreground">Sent Today</p>
              </div>
            </CardContent>
          </Card>

          {/* Failed Today */}
          <Card className="border-red-200 shadow-sm">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.failedToday}</p>
                <p className="text-xs text-muted-foreground">Failed Today</p>
              </div>
            </CardContent>
          </Card>

          {/* Missed Reminders */}
          <Card className="border-amber-200 shadow-sm">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.missedReminders}</p>
                <p className="text-xs text-muted-foreground">Missed Reminders</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/*  Notification logs card                                           */}
      {/* ---------------------------------------------------------------- */}
      <Card className="border-border shadow-sm">
        <CardHeader className="border-b border-border bg-gray-50/30 p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Notification logs</CardTitle>
              <CardDescription className="mt-1">
                Recent notification delivery records with status and actions
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={logsLoading}
              onClick={() => {
                void fetchStats();
                void fetchLogs(currentPage, filters);
              }}
            >
              <RefreshCw size={16} className={logsLoading ? 'animate-spin' : ''} />
              Refresh
            </Button>
          </div>

          {/* ---- Filter bar ---- */}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {/* Status filter */}
            <Select value={filters.status} onValueChange={(v) => updateFilter('status', v)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="skipped">Skipped</SelectItem>
              </SelectContent>
            </Select>

            {/* Category filter */}
            <Select value={filters.category} onValueChange={(v) => updateFilter('category', v)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="medicine_reminder">Medicine Reminder</SelectItem>
                <SelectItem value="prescription">Prescription</SelectItem>
                <SelectItem value="appointment">Appointment</SelectItem>
              </SelectContent>
            </Select>

            {/* Date range quick filter */}
            <Select value={filters.dateRange} onValueChange={(v) => updateFilter('dateRange', v)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Date range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="7days">Last 7 days</SelectItem>
                <SelectItem value="30days">Last 30 days</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        {/* ---- Logs table ---- */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-gray-50/50">
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-6 py-4 text-[11px] font-bold uppercase text-muted-foreground">
                  Patient Name
                </TableHead>
                <TableHead className="px-6 py-4 text-[11px] font-bold uppercase text-muted-foreground">
                  Medicine
                </TableHead>
                <TableHead className="px-6 py-4 text-[11px] font-bold uppercase text-muted-foreground">
                  Category
                </TableHead>
                <TableHead className="px-6 py-4 text-[11px] font-bold uppercase text-muted-foreground">
                  Status
                </TableHead>
                <TableHead className="px-6 py-4 text-[11px] font-bold uppercase text-muted-foreground">
                  Sent At
                </TableHead>
                <TableHead className="px-6 py-4 text-[11px] font-bold uppercase text-muted-foreground">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logsLoading ? (
                /* Loading skeleton rows */
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={`skeleton-${i}`}>
                    <TableCell className="px-6 py-4"><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell className="px-6 py-4"><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell className="px-6 py-4"><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell className="px-6 py-4"><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell className="px-6 py-4"><Skeleton className="h-4 w-36" /></TableCell>
                    <TableCell className="px-6 py-4"><Skeleton className="h-8 w-20" /></TableCell>
                  </TableRow>
                ))
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                    <Bell className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
                    No notification logs found for the current filters.
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow
                    key={log.id}
                    className="border-b border-gray-50 transition-colors last:border-0 hover:bg-gray-50/30"
                  >
                    <TableCell className="px-6 py-4 text-sm font-medium text-foreground">
                      {log.patientName}
                    </TableCell>
                    <TableCell className="px-6 py-4 text-sm text-gray-700">
                      {log.medicineName}
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <Badge variant="secondary" className="text-[10px] font-semibold">
                        <CategoryIcon category={log.category} />
                        {formatCategory(log.category)}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      <Badge className={cn('text-[10px] font-bold', getStatusBadgeClass(log.status))}>
                        <StatusIcon status={log.status} />
                        {log.status.charAt(0).toUpperCase() + log.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-6 py-4 text-sm text-gray-600">
                      {new Date(log.sentAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      {log.status === 'failed' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 text-xs"
                          disabled={resendingId === log.id}
                          onClick={() => void handleResend(log.id)}
                        >
                          {resendingId === log.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="h-3.5 w-3.5" />
                          )}
                          Resend
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* ---- Pagination ---- */}
        {!logsLoading && logs.length > 0 && (
          <div className="flex items-center justify-between border-t border-border px-6 py-4">
            <p className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
              >
                Next
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
