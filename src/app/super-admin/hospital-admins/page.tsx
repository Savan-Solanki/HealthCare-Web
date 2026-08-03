'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Plus,
  Search,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pencil,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import { toast } from 'sonner';
import {
  SUPER_ADMIN_CACHE_EVENT,
  getSuperAdminCacheData,
  setSuperAdminCacheData,
} from '@/lib/super-admin-cache';
import { getSuperAdminPath } from '@/lib/routes';

type AdminStatus = 'Assigned' | 'Not Assigned';

interface HospitalAdminRow {
  id: string;
  hospitalCode: string;
  hospitalName: string;
  city: string;
  adminName: string;
  adminEmail: string;
  adminId?: string;
  status: AdminStatus;
}

type HospitalCacheItem = {
  id?: string;
  _id?: string;
  hospitalCode?: string;
  name: string;
  city?: string;
  adminId?: { _id?: string; name?: string; email?: string } | null;
};

const mapHospitalsToRows = (hospitals: HospitalCacheItem[]) =>
  hospitals.map((hospital) => {
    const admin = hospital.adminId;
    return {
      id: hospital.id || hospital._id || '',
      hospitalCode: hospital.hospitalCode || (hospital.id || hospital._id || '').slice(0, 8),
      hospitalName: hospital.name,
      city: hospital.city || '-',
      adminName: admin?.name || 'No admin assigned',
      adminEmail: admin?.email || '-',
      adminId: admin?._id,
      status: admin ? 'Assigned' : 'Not Assigned',
    } satisfies HospitalAdminRow;
  });

const getErrorMessage = (error: unknown, fallback: string) => {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error
  ) {
    return (error as { response?: { data?: { message?: string } } }).response?.data?.message || fallback;
  }

  return fallback;
};

export default function HospitalAdminsPage() {
  const initialCachedHospitals = getSuperAdminCacheData<HospitalCacheItem[]>('hospitals');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<HospitalAdminRow[]>(() => mapHospitalsToRows(initialCachedHospitals || []));
  const [loading, setLoading] = useState(() => !initialCachedHospitals);
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'Assigned' | 'Not Assigned'>('all');
  const [cityFilter, setCityFilter] = useState<string>('all');

  const cities = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((row) => {
      if (row.city && row.city !== '-') {
        set.add(row.city);
      }
    });
    return Array.from(set).sort();
  }, [rows]);

  const resetFilters = () => {
    setStatusFilter('all');
    setCityFilter('all');
    setSearch('');
  };

  const fetchHospitals = useCallback(async () => {
    try {
      const hasCache = !!getSuperAdminCacheData<HospitalCacheItem[]>('hospitals');
      if (!hasCache) {
        setLoading(true);
      }
      const response = await api.get('/hospitals');
      const raw = response.data.data?.hospitals || response.data.data || response.data;
      const hospitals = Array.isArray(raw) ? raw : [];
      setSuperAdminCacheData('hospitals', hospitals);
      setRows(mapHospitalsToRows(hospitals));
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Failed to fetch hospitals'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchHospitals();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fetchHospitals]);

  useEffect(() => {
    const handleCacheUpdate = () => {
      const cachedHospitals = getSuperAdminCacheData<HospitalCacheItem[]>('hospitals');
      if (!cachedHospitals) return;

      setRows(mapHospitalsToRows(cachedHospitals));
      setLoading(false);
    };

    window.addEventListener(SUPER_ADMIN_CACHE_EVENT, handleCacheUpdate);
    return () => window.removeEventListener(SUPER_ADMIN_CACHE_EVENT, handleCacheUpdate);
  }, []);

  const filtered = rows.filter(
    (row) => {
      const matchesSearch =
        row.hospitalName.toLowerCase().includes(search.toLowerCase()) ||
        row.hospitalCode.toLowerCase().includes(search.toLowerCase()) ||
        row.city.toLowerCase().includes(search.toLowerCase()) ||
        row.adminName.toLowerCase().includes(search.toLowerCase()) ||
        row.adminEmail.toLowerCase().includes(search.toLowerCase());

      const matchesStatus = statusFilter === 'all' || row.status === statusFilter;
      const matchesCity = cityFilter === 'all' || row.city === cityFilter;

      return matchesSearch && matchesStatus && matchesCity;
    }
  );

  return (
    <div className="space-y-6">
      <nav className="flex text-xs text-muted-foreground gap-1 items-center">
        <Link href="/" className="hover:text-foreground">Home</Link>
        <span>/</span>
        <Link href={getSuperAdminPath()} className="hover:text-foreground">Super Admin</Link>
        <span>/</span>
        <span className="text-foreground font-medium">Admins</span>
      </nav>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Hospital admins</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Super admin creates hospital admin accounts, assigns them to hospitals, and shares login credentials.
          </p>
        </div>
        <Link href={`${getSuperAdminPath('/system-users')}?openAdd=1&role=Hospital%20Admin`}>
          <Button className="gap-2 h-10 px-4 bg-primary hover:bg-primary/90 text-white font-medium">
            <Plus size={16} />
            <span>Add admin</span>
          </Button>
        </Link>
      </div>

      <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="p-5 flex items-center justify-between border-b border-border">
          <div className="relative w-72">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              size={16}
            />
            <Input
              placeholder="Search hospitals or admins..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-10 bg-gray-50/50 border-gray-200 focus-visible:ring-primary/20"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className={cn(
                'gap-2 h-10 px-4 border-gray-200',
                showFilters && 'bg-primary/5 text-primary border-primary/20 hover:bg-primary/10'
              )}
              onClick={() => setShowFilters((prev) => !prev)}
            >
              <SlidersHorizontal size={16} />
              <span className="text-sm font-medium">{showFilters ? 'Hide Filters' : 'Filter'}</span>
            </Button>
            {(statusFilter !== 'all' || cityFilter !== 'all' || search) && (
              <Button
                variant="ghost"
                className="h-10 px-3 text-muted-foreground text-sm font-medium hover:text-foreground"
                onClick={resetFilters}
              >
                Reset
              </Button>
            )}
          </div>
        </div>

        {showFilters && (
          <div className="p-5 border-b border-border bg-gray-50/30 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</Label>
              <Select
                value={statusFilter}
                onValueChange={(val) => setStatusFilter(val as any)}
              >
                <SelectTrigger className="h-10 bg-white border-gray-200">
                  <SelectValue placeholder="All status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All status</SelectItem>
                  <SelectItem value="Assigned">Assigned</SelectItem>
                  <SelectItem value="Not Assigned">Not Assigned</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">City</Label>
              <Select
                value={cityFilter}
                onValueChange={(val) => setCityFilter(val || 'all')}
              >
                <SelectTrigger className="h-10 bg-white border-gray-200">
                  <SelectValue placeholder="All cities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All cities</SelectItem>
                  {cities.map((city) => (
                    <SelectItem key={city} value={city}>
                      {city}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-gray-50/50">
              <TableRow className="hover:bg-transparent border-b border-border">
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground py-4">Hospital ID</TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground py-4">Hospital</TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground py-4">City</TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground py-4">Admin Name</TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground py-4">Email</TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground py-4">Status</TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground py-4 text-right pr-6">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <Loader2 className="w-8 h-8 animate-spin mb-2" />
                      <span>Loading hospitals...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-sm text-muted-foreground">
                    No hospitals found.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((row) => (
                  <TableRow key={row.id} className="border-b border-border last:border-0 hover:bg-gray-50/30 transition-colors">
                    <TableCell className="text-sm text-muted-foreground py-4">{row.hospitalCode}</TableCell>
                    <TableCell className="py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-foreground">{row.hospitalName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-primary font-medium py-4">{row.city}</TableCell>
                    <TableCell className="text-sm font-medium text-foreground py-4">{row.adminName}</TableCell>
                    <TableCell className="text-sm text-muted-foreground py-4">{row.adminEmail}</TableCell>
                    <TableCell className="py-4">
                      <Badge
                        variant="secondary"
                        className={cn(
                          'px-2.5 py-0.5 rounded-full text-[11px] font-medium border-0 gap-1.5 inline-flex items-center',
                          row.status === 'Assigned'
                            ? 'bg-green-50 text-green-700'
                            : 'bg-amber-50 text-amber-700'
                        )}
                      >
                        <span className={cn(
                          'w-1.5 h-1.5 rounded-full',
                          row.status === 'Assigned' ? 'bg-green-500' : 'bg-amber-500'
                        )} />
                        {row.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-4 pr-6 text-right">
                      {row.adminId ? (
                        <Link href={`${getSuperAdminPath('/system-users')}?editUserId=${row.adminId}`}>
                          <Button variant="outline" className="gap-2 h-9 border-gray-200">
                            <Pencil size={14} />
                            Update Admin
                          </Button>
                        </Link>
                      ) : (
                        <Link href={`${getSuperAdminPath('/system-users')}?openAdd=1&role=Hospital%20Admin&hospitalId=${row.id}`}>
                          <Button className="gap-2 h-9 bg-primary hover:bg-primary/90 text-white">
                            <Plus size={14} />
                            Add Admin
                          </Button>
                        </Link>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="mx-5 mb-5 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          Hospital admins do not create personal accounts themselves. Create the account here and send the credentials from super admin.
        </div>

        <div className="p-4 border-t border-border flex items-center justify-between bg-gray-50/30">
          <p className="text-xs text-muted-foreground font-medium">
            Showing <span className="text-foreground">{filtered.length}</span> of <span className="text-foreground">{rows.length}</span>
          </p>
          <div className="flex items-center gap-4">
            <div className="flex items-center border border-border rounded-lg overflow-hidden bg-white shadow-sm">
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none border-r border-border hover:bg-gray-50" disabled>
                <ChevronLeft size={14} />
              </Button>
              <div className="px-3 py-1 text-xs font-medium border-r border-border bg-gray-50/50">
                Page <span className="text-foreground">1</span> / 1
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none hover:bg-gray-50" disabled>
                <ChevronRight size={14} />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
