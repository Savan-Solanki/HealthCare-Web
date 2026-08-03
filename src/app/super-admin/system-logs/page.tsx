'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, RefreshCw, Search, ChevronLeft, ChevronRight } from 'lucide-react';

import api from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  SUPER_ADMIN_CACHE_EVENT,
  getSuperAdminCacheData,
  refreshSuperAdminCache,
  setSuperAdminCacheData,
} from '@/lib/super-admin-cache';

type SystemStatus = {
  database: {
    status: string;
    name: string;
  };
  memory: {
    usedPercent: number;
    totalMB: number;
  };
  cpu: {
    cores: number;
    loadAvg1m: string | number;
  };
  server: {
    uptime: string;
    uptimeSeconds?: number;
    pid: number;
  };
};

type SystemLog = {
  level: string;
  message: string;
  source: string;
  createdAt: string;
};

const Skeleton = ({ className }: { className?: string }) => (
  <div className={cn('animate-pulse rounded-xl bg-gray-100', className)} />
);

const getLevelBadgeClass = (level: string) => {
  switch (level.toLowerCase()) {
    case 'error':
      return 'bg-red-100 text-red-700';
    case 'warning':
      return 'bg-yellow-100 text-yellow-700';
    case 'info':
      return 'bg-blue-100 text-blue-700';
    default:
      return 'bg-green-100 text-green-700';
  }
};

const parseUptimeStringToSeconds = (value: string) => {
  const parts = value.split(':').map((part) => Number(part));
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) {
    return 0;
  }

  const [hours, minutes, seconds] = parts;
  return hours * 3600 + minutes * 60 + seconds;
};

const formatUptime = (totalSeconds: number) => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
};

function LiveUptime({ initialSeconds }: { initialSeconds: number }) {
  const [seconds, setSeconds] = useState(initialSeconds);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setSeconds((current) => current + 1);
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  return <>{formatUptime(seconds)}</>;
}

export default function SystemLogsPage() {
  const initialCachedStatus = getSuperAdminCacheData<SystemStatus>('systemStatus');
  const initialCachedLogs = getSuperAdminCacheData<SystemLog[]>('systemLogs');
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(() => initialCachedStatus);
  const [logs, setLogs] = useState<SystemLog[]>(() => initialCachedLogs || []);
  const [loading, setLoading] = useState(() => !(initialCachedStatus && initialCachedLogs));
  const [logsLoading, setLogsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [logsError, setLogsError] = useState<string | null>(null);

  // Filter & Pagination States
  const [levelFilter, setLevelFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchSystemStatus = useCallback(async () => {
    try {
      setStatusError(null);
      const response = await api.get<{ data: SystemStatus }>('/system/status');
      setSystemStatus(response.data.data);
      setSuperAdminCacheData('systemStatus', response.data.data);
    } catch (error: unknown) {
      const message =
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        typeof (error as { response?: { data?: { message?: unknown } } }).response?.data?.message === 'string'
          ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
          : 'Unable to load system status right now.';

      setSystemStatus(null);
      setStatusError(message ?? 'Unable to load system status right now.');
    }
  }, []);

  const fetchLogs = useCallback(async (activePage: number, level: string, source: string) => {
    setLogsLoading(true);
    try {
      setLogsError(null);
      const params: Record<string, string | number> = { page: activePage, limit: 20 };
      if (level !== 'all') params.level = level;
      if (source !== 'all') params.source = source;

      const response = await api.get<{ data: SystemLog[]; pages?: number }>('/system/logs', {
        params,
      });
      setLogs(response.data.data || []);
      setTotalPages(response.data.pages ?? 1);
      if (activePage === 1 && level === 'all' && source === 'all') {
        setSuperAdminCacheData('systemLogs', response.data.data || []);
      }
    } catch (error: unknown) {
      const message =
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        typeof (error as { response?: { data?: { message?: unknown } } }).response?.data?.message === 'string'
          ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
          : 'Unable to load system logs right now.';

      setLogs([]);
      setLogsError(message ?? 'Unable to load system logs right now.');
    } finally {
      setLogsLoading(false);
    }
  }, []);


  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void (async () => {
        const cachedStatus = getSuperAdminCacheData<SystemStatus>('systemStatus');
        const cachedLogs = getSuperAdminCacheData<SystemLog[]>('systemLogs');
        const hasCache = !!cachedStatus && !!cachedLogs;
        if (!hasCache) {
          setLoading(true);
        }
        try {
          await Promise.all([fetchSystemStatus(), fetchLogs(1, 'all', 'all')]);
        } catch (error) {
          console.error('Failed to initialize system logs page:', error);
        } finally {
          setLoading(false);
        }
      })();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fetchLogs, fetchSystemStatus]);

  useEffect(() => {
    if (loading) return;
    void fetchLogs(currentPage, levelFilter, sourceFilter);
  }, [currentPage, levelFilter, sourceFilter, fetchLogs, loading]);

  useEffect(() => {
    const handleCacheUpdate = () => {
      const cachedStatus = getSuperAdminCacheData<SystemStatus>('systemStatus');
      const cachedLogs = getSuperAdminCacheData<SystemLog[]>('systemLogs');

      if (cachedStatus) setSystemStatus(cachedStatus);
      if (cachedLogs && levelFilter === 'all' && sourceFilter === 'all' && currentPage === 1) {
        setLogs(cachedLogs);
      }
      if (cachedStatus || cachedLogs) setLoading(false);
    };

    window.addEventListener(SUPER_ADMIN_CACHE_EVENT, handleCacheUpdate);
    return () => window.removeEventListener(SUPER_ADMIN_CACHE_EVENT, handleCacheUpdate);
  }, [levelFilter, sourceFilter, currentPage]);

  const triggerAction = async (action: string) => {
    setActionLoading(action);
    try {
      const response = await api.post<{ message: string }>('/system/action', { action });
      window.alert(response.data.message);
      await Promise.all([fetchSystemStatus(), fetchLogs(currentPage, levelFilter, sourceFilter)]);
    } catch (error: unknown) {
      const message =
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        typeof (error as { response?: { data?: { message?: unknown } } }).response?.data?.message === 'string'
          ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
          : 'Action failed';

      window.alert(message ?? 'Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  // Dynamically extract unique sources from fetched logs
  const dynamicSources = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((log) => {
      if (log.source) set.add(log.source);
    });
    return Array.from(set).sort();
  }, [logs]);

  // Local message search filter
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (!searchQuery) return true;
      return log.message.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [logs, searchQuery]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-[200px]" />
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {systemStatus && (
        <Card className="border-border shadow-sm">
          <CardHeader className="border-b border-border bg-gray-50/30 p-6">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>System Health</CardTitle>
                <CardDescription className="mt-1">Real-time system performance metrics</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => void fetchSystemStatus()} className="gap-2">
                <RefreshCw size={16} />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-muted-foreground">Database</label>
                <div className="flex items-center gap-2">
                  {systemStatus.database.status === 'connected' ? (
                    <CheckCircle2 className="text-green-600" size={20} />
                  ) : (
                    <AlertCircle className="text-red-600" size={20} />
                  )}
                  <span className="text-sm font-medium capitalize">{systemStatus.database.status}</span>
                </div>
                <p className="text-xs text-muted-foreground">{systemStatus.database.name}</p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-muted-foreground">Memory</label>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold">{systemStatus.memory.usedPercent}%</span>
                  <span className="text-xs text-muted-foreground">of {systemStatus.memory.totalMB}MB</span>
                </div>
                <div className="h-2 w-full rounded-full bg-gray-200">
                  <div
                    className={cn(
                      'h-2 rounded-full',
                      systemStatus.memory.usedPercent > 80 ? 'bg-red-500' : 'bg-green-500'
                    )}
                    style={{ width: `${systemStatus.memory.usedPercent}%` }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-muted-foreground">CPU</label>
                <p className="text-2xl font-bold">{systemStatus.cpu.cores}</p>
                <p className="text-xs text-muted-foreground">Load: {systemStatus.cpu.loadAvg1m}</p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-muted-foreground">Uptime</label>
                <p className="text-2xl font-bold">
                  <LiveUptime
                    key={`${systemStatus.server.pid}-${systemStatus.server.uptimeSeconds ?? systemStatus.server.uptime}`}
                    initialSeconds={
                      systemStatus.server.uptimeSeconds ??
                      parseUptimeStringToSeconds(systemStatus.server.uptime)
                    }
                  />
                </p>
                <p className="text-xs text-muted-foreground">Process ID: {systemStatus.server.pid}</p>
              </div>
            </div>

            <div className="mt-6 border-t border-border pt-6">
              <p className="mb-4 text-xs font-bold uppercase text-muted-foreground">System Actions</p>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={actionLoading !== null}
                  onClick={() => void triggerAction('backup')}
                  className="text-xs"
                >
                  {actionLoading === 'backup' ? <Loader2 className="mr-2 animate-spin" size={14} /> : null}
                  Backup
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={actionLoading !== null}
                  onClick={() => void triggerAction('security_update')}
                  className="text-xs"
                >
                  {actionLoading === 'security_update' ? (
                    <Loader2 className="mr-2 animate-spin" size={14} />
                  ) : null}
                  Security Update
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={actionLoading !== null}
                  onClick={() => void triggerAction('restart_services')}
                  className="text-xs"
                >
                  {actionLoading === 'restart_services' ? (
                    <Loader2 className="mr-2 animate-spin" size={14} />
                  ) : null}
                  Restart
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={actionLoading !== null}
                  onClick={() => void triggerAction('clear_cache')}
                  className="text-xs"
                >
                  {actionLoading === 'clear_cache' ? <Loader2 className="mr-2 animate-spin" size={14} /> : null}
                  Clear Cache
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {statusError && (
        <Card className="border-red-200 bg-red-50/50 shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertCircle className="text-red-600" size={18} />
            <p className="text-sm text-red-700">{statusError}</p>
          </CardContent>
        </Card>
      )}

      <Card className="border-border shadow-sm">
        <CardHeader className="border-b border-border bg-gray-50/30 p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between font-sans">
            <div>
              <CardTitle>System Logs</CardTitle>
              <CardDescription className="mt-1">Recent system events and activities</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void fetchLogs(currentPage, levelFilter, sourceFilter)}
              disabled={logsLoading}
              className="gap-2"
            >
              <RefreshCw size={16} className={logsLoading ? 'animate-spin' : ''} />
              Refresh
            </Button>
          </div>

          {/* ---- Filter bar ---- */}
          <div className="mt-4 flex flex-wrap items-center gap-3 font-sans">
            {/* Search input */}
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none size-4" />
              <Input
                placeholder="Search log messages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-sm border-gray-200"
              />
            </div>

            {/* Level filter */}
            <Select value={levelFilter} onValueChange={(v) => { setLevelFilter(v || 'all'); setCurrentPage(1); }}>
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue placeholder="Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>

            {/* Source filter */}
            <Select value={sourceFilter} onValueChange={(v) => { setSourceFilter(v || 'all'); setCurrentPage(1); }}>
              <SelectTrigger className="w-[160px] h-9">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                {dynamicSources.map((src) => (
                  <SelectItem key={src} value={src}>
                    {src}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {(levelFilter !== 'all' || sourceFilter !== 'all' || searchQuery) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setLevelFilter('all');
                  setSourceFilter('all');
                  setSearchQuery('');
                  setCurrentPage(1);
                }}
                className="h-9 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                Reset
              </Button>
            )}
          </div>
        </CardHeader>
        {logsError && (
          <div className="border-b border-red-100 bg-red-50/50 px-6 py-3 text-sm text-red-700">
            {logsError}
          </div>
        )}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-gray-50/50">
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-6 py-4 text-[11px] font-bold uppercase text-muted-foreground">Level</TableHead>
                <TableHead className="px-6 py-4 text-[11px] font-bold uppercase text-muted-foreground">Message</TableHead>
                <TableHead className="px-6 py-4 text-[11px] font-bold uppercase text-muted-foreground">Source</TableHead>
                <TableHead className="px-6 py-4 text-[11px] font-bold uppercase text-muted-foreground">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logsLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-12 text-center">
                    <Loader2 className="mx-auto animate-spin" size={24} />
                  </TableCell>
                </TableRow>
              ) : filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-12 text-center text-muted-foreground">
                    No logs available
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map((log, index) => (
                  <TableRow
                    key={`${log.source}-${log.createdAt}-${index}`}
                    className="border-b border-gray-50 transition-colors last:border-0 hover:bg-gray-50/30"
                  >
                    <TableCell className="px-6 py-4">
                      <Badge className={cn('text-[10px] font-bold', getLevelBadgeClass(log.level))}>
                        {log.level.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate px-6 py-4 text-sm text-gray-700">
                      {log.message}
                    </TableCell>
                    <TableCell className="px-6 py-4 text-sm capitalize text-gray-600">{log.source}</TableCell>
                    <TableCell className="px-6 py-4 text-sm text-gray-600">
                      {new Date(log.createdAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* ---- Pagination ---- */}
        {!logsLoading && logs.length > 0 && (
          <div className="flex items-center justify-between border-t border-border px-6 py-4 bg-gray-50/10">
            <p className="text-sm text-muted-foreground font-medium">
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
