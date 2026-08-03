'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Search,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Eye,
  Building2,
  RefreshCw,
  ArrowUpDown,
  FileText,
  Stethoscope,
  Upload,
} from 'lucide-react';

import api from '@/lib/api';
import { getSuperAdminPath } from '@/lib/routes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────
interface HospitalPrescriptionRow {
  hospitalId: string;
  hospitalName: string;
  hospitalCode: string;
  hospitalCity: string;
  hospitalStatus: string;
  totalPrescriptions: number;
  doctorGenerated: number;
  patientUploaded: number;
  lastPrescription: string | null;
  firstPrescription: string | null;
}

const Skeleton = ({ className }: { className?: string }) => (
  <div className={cn('animate-pulse rounded bg-gray-200', className)} />
);

const formatDate = (iso?: string | null) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const STATUS_BADGE: Record<string, string> = {
  Active: 'bg-emerald-100 text-emerald-700',
  Inactive: 'bg-gray-100 text-gray-600',
  'Under Maintenance': 'bg-amber-100 text-amber-700',
  Pending: 'bg-blue-100 text-blue-700',
};

// ─── Mini stat pill ───────────────────────────────────────────────────────────
const StatPill = ({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  color: string;
}) => (
  <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium', color)}>
    <Icon size={10} />
    {value.toLocaleString()} {label}
  </span>
);

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function HospitalPrescriptionsPage() {
  const [hospitals, setHospitals] = useState<HospitalPrescriptionRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [grandTotal, setGrandTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [sort, setSort] = useState('mostPrescriptions');
  const [page, setPage] = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (filter && filter !== 'all') params.set('filter', filter);
      if (sort) params.set('sort', sort);
      params.set('page', String(page));
      params.set('limit', '25');

      const res = await api.get(`/admin/storage/prescriptions?${params.toString()}`);
      const d = res.data.data;
      setHospitals(d.hospitals);
      setTotal(d.total);
      setTotalPages(d.totalPages);
      setGrandTotal(d.grandTotal ?? 0);
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Failed to load data.',
      );
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, filter, sort, page]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filter, sort]);

  return (
    <div className="space-y-5">
      {/* ─── Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href={getSuperAdminPath('/storage')}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              <ChevronLeft size={13} />
              Manage Storage
            </Link>
          </div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <FileText size={20} className="text-violet-600" />
            Prescriptions by Hospital
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {loading ? (
              'Loading prescription data…'
            ) : total > 0 ? (
              <>
                {total} hospital{total !== 1 ? 's' : ''} ·{' '}
                <span className="font-semibold text-foreground">
                  {grandTotal.toLocaleString()}
                </span>{' '}
                total prescriptions
              </>
            ) : (
              'Prescription count breakdown per hospital'
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            className="h-8 gap-1.5 text-xs bg-violet-600 hover:bg-violet-700"
            onClick={() => void fetchData()}
          >
            <RefreshCw size={13} />
            Refresh
          </Button>
        </div>
      </div>

      {/* ─── Filters ────────────────────────────────────────────────── */}
      <Card className="border-border shadow-sm">
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {/* Search */}
            <div className="relative flex-1 max-w-xs">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                placeholder="Search by name, code, email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
            </div>

            {/* Filter */}
            <div className="flex items-center gap-1.5">
              <SlidersHorizontal size={13} className="text-muted-foreground" />
              <Select
                value={filter || 'all'}
                onValueChange={(v: string | null) =>
                  setFilter(!v || v === 'all' ? '' : v)
                }
              >
                <SelectTrigger className="h-8 w-44 text-xs">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="doctor_generated">Doctor Generated</SelectItem>
                  <SelectItem value="patient_uploaded">Patient Uploaded</SelectItem>
                  <SelectItem value="today">Created Today</SelectItem>
                  <SelectItem value="this_month">This Month</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Sort */}
            <div className="flex items-center gap-1.5">
              <ArrowUpDown size={13} className="text-muted-foreground" />
              <Select
                value={sort}
                onValueChange={(v: string | null) => {
                  if (v) setSort(v);
                }}
              >
                <SelectTrigger className="h-8 w-48 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mostPrescriptions">Most Prescriptions</SelectItem>
                  <SelectItem value="leastPrescriptions">Least Prescriptions</SelectItem>
                  <SelectItem value="newest">Newest Prescription</SelectItem>
                  <SelectItem value="oldest">Oldest Prescription</SelectItem>
                  <SelectItem value="alphabetical">Alphabetical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── Error ──────────────────────────────────────────────────── */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ─── Table ──────────────────────────────────────────────────── */}
      <Card className="border-border shadow-sm overflow-hidden">
        <CardHeader className="pb-0 pt-4 px-5">
          <CardTitle className="text-sm font-semibold text-foreground">
            All Hospitals — Prescription Count
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-5 space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          ) : hospitals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <FileText size={36} className="text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No hospitals found</p>
              <p className="text-xs text-muted-foreground mt-1">
                {debouncedSearch
                  ? 'Try a different search term'
                  : 'No prescription data available yet'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-gray-50">
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Hospital
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Prescriptions
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell">
                      Breakdown
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell">
                      Last Prescription
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden lg:table-cell">
                      Status
                    </th>
                    <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {hospitals.map((h) => (
                    <tr
                      key={h.hospitalId}
                      className="hover:bg-gray-50 transition-colors group"
                    >
                      {/* Hospital */}
                      <td className="px-5 py-3.5">
                        <div>
                          <p className="font-semibold text-foreground text-sm leading-tight">
                            {h.hospitalName}
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {h.hospitalCode}
                            {h.hospitalCity ? ` · ${h.hospitalCity}` : ''}
                          </p>
                        </div>
                      </td>

                      {/* Total */}
                      <td className="px-4 py-3.5 text-right">
                        <span className="text-lg font-bold text-foreground tabular-nums">
                          {h.totalPrescriptions.toLocaleString()}
                        </span>
                      </td>

                      {/* Breakdown pills */}
                      <td className="px-4 py-3.5 hidden md:table-cell">
                        <div className="flex flex-col gap-1">
                          {h.doctorGenerated > 0 && (
                            <StatPill
                              icon={Stethoscope}
                              label="Doctor"
                              value={h.doctorGenerated}
                              color="bg-blue-50 text-blue-700"
                            />
                          )}
                          {h.patientUploaded > 0 && (
                            <StatPill
                              icon={Upload}
                              label="Patient"
                              value={h.patientUploaded}
                              color="bg-orange-50 text-orange-700"
                            />
                          )}
                        </div>
                      </td>

                      {/* Last prescription */}
                      <td className="px-4 py-3.5 text-right text-xs text-muted-foreground hidden md:table-cell">
                        {formatDate(h.lastPrescription)}
                      </td>

                      {/* Status badge */}
                      <td className="px-4 py-3.5 hidden lg:table-cell">
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                            STATUS_BADGE[h.hospitalStatus] || 'bg-gray-100 text-gray-600',
                          )}
                        >
                          {h.hospitalStatus}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="px-5 py-3.5 text-right">
                        <Link
                          href={getSuperAdminPath(`/manage-hospitals?highlight=${h.hospitalId}`)}
                        >
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 gap-1 text-xs"
                          >
                            <Eye size={12} />
                            View
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ─── Pagination ─────────────────────────────────────────── */}
          {!loading && totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border px-5 py-3">
              <p className="text-xs text-muted-foreground">
                Page {page} of {totalPages} · {total} hospitals
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft size={14} />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  <ChevronRight size={14} />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
