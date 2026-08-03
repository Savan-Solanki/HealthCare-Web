'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { AxiosError } from 'axios';
import {
  Plus,
  SlidersHorizontal,
  Search,
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Clock,
  Shield,
  AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ConfirmDeleteDialog, useConfirmDelete } from '@/components/ui/confirm-delete-dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import api from '@/lib/api';
import { toast } from 'sonner';
import {
  SUPER_ADMIN_CACHE_EVENT,
  getSuperAdminCacheData,
  refreshSuperAdminCache,
  setSuperAdminCacheData,
} from '@/lib/super-admin-cache';
import { getSuperAdminPath } from '@/lib/routes';

type Status = 'Active' | 'Pending' | 'Inactive' | 'Under Maintenance';
type HospitalType = 'Government' | 'Private' | 'Trust' | 'Clinic' | 'Multi-speciality';
type AccessType = 'permanent' | 'demo';
type SortOption = 'recently-added' | 'beds-high-to-low' | 'doctors-low-to-high' | 'last-updated';
type DateField = 'createdAt' | 'updatedAt';

interface Hospital {
  id: string;
  _id?: string;
  hospitalCode?: string;
  adminId?: { _id?: string; name?: string; email?: string } | string | null;
  name: string;
  address?: string;
  city: string;
  state?: string;
  phone?: string;
  email?: string;
  registrationNumber?: string;
  establishedYear?: number | null;
  specializations?: string[];
  beds: number;
  doctors: number;
  maxDoctors?: number | null;
  maxReceptionists?: number | null;
  maxNurses?: number | null;
  maxStaff?: number | null;
  status: Status;
  type?: HospitalType;
  accessType?: AccessType;
  demoDurationDays?: number | null;
  demoStartedAt?: string | null;
  demoExpiresAt?: string | null;
  demoStartDate?: string | null;
  demoExpiryDate?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

type HospitalFilters = {
  type: string;
  minBeds: string;
  maxBeds: string;
  minDoctors: string;
  maxDoctors: string;
  sort: SortOption;
  dateField: DateField;
  dateFrom: string;
  dateTo: string;
};

type ApiErrorResponse = {
  message?: string;
};

type HospitalFormState = {
  name: string;
  address: string;
  city: string;
  state: string;
  phone: string;
  email: string;
  registrationNumber: string;
  establishedYear: number | '';
  specializations: string;
  beds: number;
  doctors: number;
  maxDoctors: number | '';
  maxReceptionists: number | '';
  maxNurses: number | '';
  maxStaff: number | '';
  status: Status;
  type: HospitalType;
  accessType: AccessType;
  demoDays: number | '';
  demoStartDate: string;
  demoExpiryDate: string;
};

const emptyHospitalForm: HospitalFormState = {
  name: '',
  address: '',
  city: '',
  state: '',
  phone: '',
  email: '',
  registrationNumber: '',
  establishedYear: '',
  specializations: '',
  beds: 0,
  doctors: 0,
  maxDoctors: '',
  maxReceptionists: '',
  maxNurses: '',
  maxStaff: '',
  status: 'Active',
  type: 'Private',
  accessType: 'permanent',
  demoDays: '',
  demoStartDate: new Date().toISOString().split('T')[0],
  demoExpiryDate: '',
};

const defaultFilters: HospitalFilters = {
  type: 'all',
  minBeds: '',
  maxBeds: '',
  minDoctors: '',
  maxDoctors: '',
  sort: 'recently-added',
  dateField: 'createdAt',
  dateFrom: '',
  dateTo: '',
};

const sortConfig: Record<SortOption, { sortBy: string; sortOrder: 'asc' | 'desc' }> = {
  'recently-added': { sortBy: 'createdAt', sortOrder: 'desc' },
  'beds-high-to-low': { sortBy: 'beds', sortOrder: 'desc' },
  'doctors-low-to-high': { sortBy: 'doctors', sortOrder: 'asc' },
  'last-updated': { sortBy: 'updatedAt', sortOrder: 'desc' },
};

const getErrorMessage = (error: unknown, fallback: string) => {
  const axiosError = error as AxiosError<ApiErrorResponse>;
  return axiosError.response?.data?.message || fallback;
};

const calculateExpiryDate = (startDateStr: string, durationDays: number | string): string => {
  if (!startDateStr || !durationDays) return '';
  const start = new Date(startDateStr);
  if (isNaN(start.getTime())) return '';
  const expiry = new Date(start);
  expiry.setDate(expiry.getDate() + Number(durationDays));
  return expiry.toISOString().split('T')[0];
};

const formatDateString = (dateVal: any) => {
  if (!dateVal) return '';
  try {
    return new Date(dateVal).toISOString().split('T')[0];
  } catch {
    return '';
  }
};

const isUsingDefaultHospitalQuery = (search: string, filters: HospitalFilters) =>
  search.trim() === '' &&
  filters.type === defaultFilters.type &&
  filters.minBeds === defaultFilters.minBeds &&
  filters.maxBeds === defaultFilters.maxBeds &&
  filters.minDoctors === defaultFilters.minDoctors &&
  filters.maxDoctors === defaultFilters.maxDoctors &&
  filters.sort === defaultFilters.sort &&
  filters.dateField === defaultFilters.dateField &&
  filters.dateFrom === defaultFilters.dateFrom &&
  filters.dateTo === defaultFilters.dateTo;

function StatusBadge({ status }: { status: Status }) {
  const config: Record<Status, { bg: string; text: string; dot: string }> = {
    Active: { bg: 'bg-green-50  border border-green-200', text: 'text-green-700', dot: 'bg-green-500' },
    Pending: { bg: 'bg-amber-50  border border-amber-200', text: 'text-amber-700', dot: 'bg-amber-500' },
    Inactive: { bg: 'bg-gray-100  border border-gray-200', text: 'text-gray-500', dot: 'bg-gray-400' },
    'Under Maintenance': { bg: 'bg-blue-50 border border-blue-200', text: 'text-blue-700', dot: 'bg-blue-500'}
  };
  const { bg, text, dot } = config[status] || config['Inactive'];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-[3px] rounded-full text-xs font-medium ${bg} ${text}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
      {status}
    </span>
  );
}

export default function ManageHospitalsPage() {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filters, setFilters] = useState<HospitalFilters>(defaultFilters);
  const [showFilters, setShowFilters] = useState(false);
  
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [newHospital, setNewHospital] = useState<HospitalFormState>(emptyHospitalForm);
  const [editingHospital, setEditingHospital] = useState<Hospital | null>(null);
  const [viewingHospital, setViewingHospital] = useState<Hospital | null>(null);
  const usesDefaultQuery = isUsingDefaultHospitalQuery(debouncedSearch, filters);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  const fetchHospitals = useCallback(async () => {
    try {
      const hasCache = usesDefaultQuery && !!getSuperAdminCacheData<Hospital[]>('hospitals');
      if (!hasCache) {
        setLoading(true);
      }
      const { sortBy, sortOrder } = sortConfig[filters.sort];
      const params: Record<string, string | number> = {
        limit: 100,
        sortBy,
        sortOrder,
      };

      const trimmedSearch = debouncedSearch.trim();
      if (trimmedSearch) params.search = trimmedSearch;
      if (filters.type !== 'all') params.type = filters.type;
      if (filters.minBeds) params.minBeds = filters.minBeds;
      if (filters.maxBeds) params.maxBeds = filters.maxBeds;
      if (filters.minDoctors) params.minDoctors = filters.minDoctors;
      if (filters.maxDoctors) params.maxDoctors = filters.maxDoctors;
      if (filters.dateFrom) params.dateFrom = filters.dateFrom;
      if (filters.dateTo) params.dateTo = filters.dateTo;
      if (filters.dateFrom || filters.dateTo) params.dateField = filters.dateField;

      const res = await api.get('/hospitals', { params });
      const rawData = res.data.data?.hospitals || res.data.data || res.data;
      const data = Array.isArray(rawData) ? rawData : [];
      const formatted = data.map((h: Partial<Hospital> & { _id?: string; id?: string }) => ({
        ...h,
        id: h.id || h._id,
        specializations: Array.isArray(h.specializations) ? h.specializations : [],
      })) as Hospital[];
      if (usesDefaultQuery) {
        setSuperAdminCacheData('hospitals', data);
      }
      setHospitals(formatted);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Failed to fetch hospitals'));
    } finally {
      setLoading(false);
    }
  }, [filters, debouncedSearch, usesDefaultQuery]);

  useEffect(() => {
    if (usesDefaultQuery) {
      const cachedHospitals = getSuperAdminCacheData<Hospital[]>('hospitals');
      if (cachedHospitals) {
        setHospitals(
          cachedHospitals.map((h) => ({
            ...h,
            id: h.id || h._id || '',
            specializations: Array.isArray(h.specializations) ? h.specializations : [],
          }))
        );
        setLoading(false);
      }
    }

    const loadHospitals = async () => {
      await fetchHospitals();
    };

    const timeoutId = window.setTimeout(() => {
      void loadHospitals();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fetchHospitals, usesDefaultQuery]);

  useEffect(() => {
    const handleCacheUpdate = () => {
      if (!usesDefaultQuery) return;

      const cachedHospitals = getSuperAdminCacheData<Hospital[]>('hospitals');
      if (!cachedHospitals) return;

      setHospitals(
        cachedHospitals.map((h) => ({
          ...h,
          id: h.id || h._id || '',
          specializations: Array.isArray(h.specializations) ? h.specializations : [],
        }))
      );
      setLoading(false);
    };

    window.addEventListener(SUPER_ADMIN_CACHE_EVENT, handleCacheUpdate);
    return () => window.removeEventListener(SUPER_ADMIN_CACHE_EVENT, handleCacheUpdate);
  }, [usesDefaultQuery]);

  const handleCreateHospital = async () => {
    try {
      setIsSaving(true);
      await api.post('/hospitals', {
        ...newHospital,
        establishedYear: newHospital.establishedYear === '' ? undefined : newHospital.establishedYear,
        specializations: newHospital.specializations
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        accessType: newHospital.accessType,
        demoDays: newHospital.accessType === 'demo' && newHospital.demoDays ? Number(newHospital.demoDays) : undefined,
        demoStartDate: newHospital.accessType === 'demo' ? newHospital.demoStartDate : undefined,
        maxDoctors: newHospital.maxDoctors === '' ? null : Number(newHospital.maxDoctors),
        maxReceptionists: newHospital.maxReceptionists === '' ? null : Number(newHospital.maxReceptionists),
        maxNurses: newHospital.maxNurses === '' ? null : Number(newHospital.maxNurses),
        maxStaff: newHospital.maxStaff === '' ? null : Number(newHospital.maxStaff),
      });
      toast.success('Hospital created successfully');
      setIsAddOpen(false);
      setNewHospital(emptyHospitalForm);
      await refreshSuperAdminCache(['hospitals', 'report:hospitals', 'dashboardOverview']);
      await fetchHospitals();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Failed to create hospital'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateHospital = async () => {
    if (!editingHospital) return;
    try {
      setIsSaving(true);
      const {
        id,
        _id,
        name,
        address,
        city,
        state,
        phone,
        email,
        registrationNumber,
        establishedYear,
        specializations,
        beds,
        doctors,
        maxDoctors,
        maxReceptionists,
        maxNurses,
        maxStaff,
        status,
        type,
        accessType,
        demoDurationDays,
        demoStartDate,
      } = editingHospital;
      await api.put(`/hospitals/${id || _id}`, {
        name,
        address,
        city,
        state,
        phone,
        email,
        registrationNumber,
        establishedYear,
        specializations,
        beds,
        doctors,
        maxDoctors: maxDoctors ?? null,
        maxReceptionists: maxReceptionists ?? null,
        maxNurses: maxNurses ?? null,
        maxStaff: maxStaff ?? null,
        status,
        type,
        accessType: accessType || 'permanent',
        demoDays: accessType === 'demo' && demoDurationDays ? Number(demoDurationDays) : undefined,
        demoStartDate: accessType === 'demo' ? demoStartDate : undefined,
      });
      toast.success('Hospital updated successfully');
      setIsEditOpen(false);
      setEditingHospital(null);
      await refreshSuperAdminCache(['hospitals', 'report:hospitals', 'dashboardOverview']);
      await fetchHospitals();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Failed to update hospital'));
    } finally {
      setIsSaving(false);
    }
  };

  const [deleteHospitalId, setDeleteHospitalId] = useState<string | null>(null);

  const { dialogProps: deleteHospitalDialogProps, openConfirm: openDeleteHospitalConfirm } = useConfirmDelete(async () => {
    if (!deleteHospitalId) return;
    try {
      await api.delete(`/hospitals/${deleteHospitalId}`);
      toast.success('Hospital deleted successfully');
      setHospitals(prev => prev.filter(h => h.id !== deleteHospitalId));
      await refreshSuperAdminCache(['hospitals', 'report:hospitals', 'dashboardOverview']);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Failed to delete hospital'));
    } finally {
      setDeleteHospitalId(null);
    }
  });

  const handleDeleteHospital = (id: string) => {
    setDeleteHospitalId(id);
    openDeleteHospitalConfirm({ title: 'Delete Hospital', description: 'Are you sure you want to delete this hospital? All associated data will be permanently removed. This action cannot be undone.' });
  };

  const handleFilterChange = <K extends keyof HospitalFilters>(key: K, value: HospitalFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setSearch('');
    setFilters(defaultFilters);
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
        <span>/</span>
        <Link href={getSuperAdminPath()} className="hover:text-foreground transition-colors">Super Admin</Link>
        <span>/</span>
        <span className="text-foreground font-medium">Hospitals</span>
      </nav>

      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Manage hospitals</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Onboard new hospitals or update existing ones before assigning a hospital admin account.
          </p>
        </div>
        
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5 h-9 bg-primary hover:bg-primary/90 text-white">
              <Plus size={14} />
              New hospital
            </Button>
          </DialogTrigger>
          <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden rounded-2xl p-0 sm:max-w-[680px]">
            <DialogHeader className="shrink-0 px-6 pt-6">
              <DialogTitle className="text-xl font-bold">Add New Hospital</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Save / Register Hospital with contact and address details.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 overflow-y-auto px-6 py-5">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Hospital ID</Label>
                <Input
                  value="System creates a unique Hospital ID"
                  className="h-11 rounded-xl border-gray-200 bg-gray-100 text-muted-foreground"
                  disabled
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Hospital Admin</Label>
                  <Input
                    value="Assigned later by super admin"
                    className="h-11 rounded-xl border-gray-200 bg-gray-100 text-muted-foreground"
                    disabled
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="h-reg-no" className="text-sm font-medium">Registration Number</Label>
                  <Input
                    id="h-reg-no"
                    value={newHospital.registrationNumber}
                    onChange={(e) => setNewHospital({ ...newHospital, registrationNumber: e.target.value })}
                    className="h-11 rounded-xl border-gray-200 bg-gray-50/30"
                    placeholder="REG-2026-001"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="h-name" className="text-sm font-medium">Hospital Name</Label>
                <Input
                  id="h-name"
                  value={newHospital.name}
                  onChange={(e) => setNewHospital({ ...newHospital, name: e.target.value })}
                  className="h-11 rounded-xl border-gray-200 bg-gray-50/30"
                  placeholder="healthcare Central"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="h-address" className="text-sm font-medium">Address</Label>
                <Textarea
                  id="h-address"
                  value={newHospital.address}
                  onChange={(e) => setNewHospital({ ...newHospital, address: e.target.value })}
                  className="min-h-24 rounded-xl border-gray-200 bg-gray-50/30 resize-none"
                  placeholder="12 MG Road, Andheri East"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="h-city" className="text-sm font-medium">City / State</Label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    id="h-city"
                    value={newHospital.city}
                    onChange={(e) => setNewHospital({ ...newHospital, city: e.target.value })}
                    className="h-11 rounded-xl border-gray-200 bg-gray-50/30"
                    placeholder="Mumbai"
                  />
                  <Input
                    id="h-state"
                    value={newHospital.state}
                    onChange={(e) => setNewHospital({ ...newHospital, state: e.target.value })}
                    className="h-11 rounded-xl border-gray-200 bg-gray-50/30"
                    placeholder="Maharashtra"
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="h-phone" className="text-sm font-medium">Contact Number</Label>
                  <Input
                    id="h-phone"
                    value={newHospital.phone}
                    onChange={(e) => setNewHospital({ ...newHospital, phone: e.target.value })}
                    className="h-11 rounded-xl border-gray-200 bg-gray-50/30"
                    placeholder="+91 98765 43210"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="h-email" className="text-sm font-medium">Email Address</Label>
                  <Input
                    id="h-email"
                    type="email"
                    value={newHospital.email}
                    onChange={(e) => setNewHospital({ ...newHospital, email: e.target.value })}
                    className="h-11 rounded-xl border-gray-200 bg-gray-50/30"
                    placeholder="hospital@medkwik.com"
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="h-established-year" className="text-sm font-medium">Established Year</Label>
                  <Input
                    id="h-established-year"
                    type="number"
                    value={newHospital.establishedYear}
                    onChange={(e) => setNewHospital({
                      ...newHospital,
                      establishedYear: e.target.value ? parseInt(e.target.value, 10) : '',
                    })}
                    className="h-11 rounded-xl border-gray-200 bg-gray-50/30"
                    placeholder="2016"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="h-beds" className="text-sm font-medium">Beds Capacity</Label>
                  <Input
                    id="h-beds"
                    type="number"
                    value={newHospital.beds}
                    onChange={(e) => setNewHospital({ ...newHospital, beds: parseInt(e.target.value) || 0 })}
                    className="h-11 rounded-xl border-gray-200 bg-gray-50/30"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="h-doctors" className="text-sm font-medium">Doctors Count</Label>
                  <Input
                    id="h-doctors"
                    type="number"
                    value={newHospital.doctors}
                    onChange={(e) => setNewHospital({ ...newHospital, doctors: parseInt(e.target.value) || 0 })}
                    className="h-11 rounded-xl border-gray-200 bg-gray-50/30"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="h-max-doctors" className="text-sm font-medium">Max Doctors Allowed</Label>
                  <Input
                    id="h-max-doctors"
                    type="number"
                    min={1}
                    value={newHospital.maxDoctors}
                    onChange={(e) => setNewHospital({ ...newHospital, maxDoctors: e.target.value === '' ? '' : parseInt(e.target.value) || 1 })}
                    className="h-11 rounded-xl border-gray-200 bg-gray-50/30"
                    placeholder="Leave blank for unlimited"
                  />
                </div>
              </div>

              {/* Additional Staff Limits */}
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="h-max-receptionists" className="text-sm font-medium">Max Receptionists Allowed</Label>
                  <Input
                    id="h-max-receptionists"
                    type="number"
                    min={1}
                    value={newHospital.maxReceptionists}
                    onChange={(e) => setNewHospital({ ...newHospital, maxReceptionists: e.target.value === '' ? '' : parseInt(e.target.value) || 1 })}
                    className="h-11 rounded-xl border-gray-200 bg-gray-50/30"
                    placeholder="Unlimited"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="h-max-nurses" className="text-sm font-medium">Max Nurses Allowed</Label>
                  <Input
                    id="h-max-nurses"
                    type="number"
                    min={1}
                    value={newHospital.maxNurses}
                    onChange={(e) => setNewHospital({ ...newHospital, maxNurses: e.target.value === '' ? '' : parseInt(e.target.value) || 1 })}
                    className="h-11 rounded-xl border-gray-200 bg-gray-50/30"
                    placeholder="Unlimited"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="h-max-staff" className="text-sm font-medium">Max Staff Allowed</Label>
                  <Input
                    id="h-max-staff"
                    type="number"
                    min={1}
                    value={newHospital.maxStaff}
                    onChange={(e) => setNewHospital({ ...newHospital, maxStaff: e.target.value === '' ? '' : parseInt(e.target.value) || 1 })}
                    className="h-11 rounded-xl border-gray-200 bg-gray-50/30"
                    placeholder="Unlimited"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="h-specializations" className="text-sm font-medium">Specializations</Label>
                <Textarea
                  id="h-specializations"
                  value={newHospital.specializations}
                  onChange={(e) => setNewHospital({ ...newHospital, specializations: e.target.value })}
                  className="min-h-24 rounded-xl border-gray-200 bg-gray-50/30 resize-none"
                  placeholder="Cardiology, Neurology, Pediatrics"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Status</Label>
                  <Select
                    value={newHospital.status}
                    onValueChange={(val) => {
                      if (!val) return;
                      setNewHospital({ ...newHospital, status: val as Status });
                    }}
                  >
                    <SelectTrigger className="h-11 rounded-xl border-gray-200 bg-gray-50/30">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Inactive">Inactive</SelectItem>
                      <SelectItem value="Pending">Pending</SelectItem>
                      <SelectItem value="Under Maintenance">Under Maintenance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Type</Label>
                  <Select
                    value={newHospital.type}
                    onValueChange={(val) => {
                      if (!val) return;
                      setNewHospital({ ...newHospital, type: val as HospitalType });
                    }}
                  >
                    <SelectTrigger className="h-11 rounded-xl border-gray-200 bg-gray-50/30">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Government">Government</SelectItem>
                      <SelectItem value="Private">Private</SelectItem>
                      <SelectItem value="Trust">Trust</SelectItem>
                      <SelectItem value="Clinic">Clinic</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Access Type */}
              <div className="rounded-xl border border-blue-100 bg-blue-50/30 p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <Shield size={16} className="text-blue-600" />
                  <Label className="text-sm font-semibold text-blue-900">Access Type</Label>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Subscription</Label>
                    <Select
                      value={newHospital.accessType}
                      onValueChange={(val) => {
                        if (!val) return;
                        setNewHospital({
                          ...newHospital,
                          accessType: val as AccessType,
                          demoDays: val === 'permanent' ? '' : 7,
                          demoExpiryDate: val === 'permanent' ? '' : calculateExpiryDate(newHospital.demoStartDate, 7),
                        });
                      }}
                    >
                      <SelectTrigger className="h-11 rounded-xl border-gray-200 bg-white">
                        <SelectValue placeholder="Select access type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="permanent">🟢 Permanent</SelectItem>
                        <SelectItem value="demo">🟡 Demo (Trial)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {newHospital.accessType === 'demo' ? (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Demo Duration *</Label>
                      <Select
                        value={String(newHospital.demoDays)}
                        onValueChange={(val) => {
                          const days = parseInt(val || '0', 10);
                          const expiry = calculateExpiryDate(newHospital.demoStartDate, days);
                          setNewHospital({
                            ...newHospital,
                            demoDays: days,
                            demoExpiryDate: expiry,
                          });
                        }}
                      >
                        <SelectTrigger className="h-11 rounded-xl border-gray-200 bg-white">
                          <SelectValue placeholder="Select duration" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="7">7 Days</SelectItem>
                          <SelectItem value="15">15 Days</SelectItem>
                          <SelectItem value="30">30 Days</SelectItem>
                          <SelectItem value="60">60 Days</SelectItem>
                          <SelectItem value="90">90 Days</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="flex items-center text-sm text-green-700 mt-7">
                      <Shield size={14} className="mr-1.5" />
                      Full access with no expiry
                    </div>
                  )}
                </div>
                {newHospital.accessType === 'demo' && (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2 mt-2">
                      <div className="space-y-2">
                        <Label htmlFor="h-demo-start" className="text-sm font-medium">Demo Start Date *</Label>
                        <Input
                          id="h-demo-start"
                          type="date"
                          value={newHospital.demoStartDate}
                          onChange={(e) => {
                            const dateVal = e.target.value;
                            const expiry = calculateExpiryDate(dateVal, newHospital.demoDays);
                            setNewHospital({
                              ...newHospital,
                              demoStartDate: dateVal,
                              demoExpiryDate: expiry,
                            });
                          }}
                          className="h-11 rounded-xl border-gray-200 bg-white"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Demo Expiry Date</Label>
                        <Input
                          type="date"
                          value={newHospital.demoExpiryDate}
                          className="h-11 rounded-xl border-gray-200 bg-gray-100 text-muted-foreground"
                          disabled
                        />
                      </div>
                    </div>
                    <p className="text-xs text-amber-700 flex items-center gap-1.5 mt-2">
                      <AlertTriangle size={12} />
                      Hospital will be automatically deactivated after the demo period ends. Warning emails are sent 7, 3, and 1 days before expiry.
                    </p>
                  </>
                )}
              </div>
            </div>
            <DialogFooter className="mx-0 mb-0 mt-0 shrink-0 gap-3 rounded-none px-6 py-4">
              <Button variant="outline" className="rounded-xl px-6 h-11 border-gray-200" onClick={() => setIsAddOpen(false)} disabled={isSaving}>
                Cancel
              </Button>
              <Button className="bg-primary hover:bg-primary/90 text-white rounded-xl px-8 h-11 shadow-sm" onClick={handleCreateHospital} disabled={isSaving}>
                {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Save / Register Hospital
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Dialog (Hidden) */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden rounded-2xl p-0 sm:max-w-[680px]">
          <DialogHeader className="shrink-0 px-6 pt-6">
            <DialogTitle className="text-xl font-bold">Edit Hospital</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Update hospital details and status.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 overflow-y-auto px-6 py-5">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Hospital ID</Label>
              <Input
                value={editingHospital?.hospitalCode || 'System generated'}
                className="h-11 rounded-xl border-gray-200 bg-gray-100 text-muted-foreground"
                disabled
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Hospital Admin</Label>
                <Input
                  value={
                    typeof editingHospital?.adminId === 'object'
                      ? editingHospital?.adminId?.name || 'No admin assigned'
                      : 'No admin assigned'
                  }
                  className="h-11 rounded-xl border-gray-200 bg-gray-100 text-muted-foreground"
                  disabled
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="e-reg-no" className="text-sm font-medium">Registration Number</Label>
                <Input
                  id="e-reg-no"
                  value={editingHospital?.registrationNumber || ''}
                  onChange={(e) => setEditingHospital(prev => prev ? { ...prev, registrationNumber: e.target.value } : null)}
                  className="h-11 rounded-xl border-gray-200 bg-gray-50/30"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="e-name" className="text-sm font-medium">Hospital Name</Label>
              <Input
                id="e-name"
                value={editingHospital?.name || ''}
                onChange={(e) => setEditingHospital(prev => prev ? { ...prev, name: e.target.value } : null)}
                className="h-11 rounded-xl border-gray-200 bg-gray-50/30"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="e-address" className="text-sm font-medium">Address</Label>
              <Textarea
                id="e-address"
                value={editingHospital?.address || ''}
                onChange={(e) => setEditingHospital(prev => prev ? { ...prev, address: e.target.value } : null)}
                className="min-h-24 rounded-xl border-gray-200 bg-gray-50/30 resize-none"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="e-city" className="text-sm font-medium">City / State</Label>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  id="e-city"
                  value={editingHospital?.city || ''}
                  onChange={(e) => setEditingHospital(prev => prev ? { ...prev, city: e.target.value } : null)}
                  className="h-11 rounded-xl border-gray-200 bg-gray-50/30"
                />
                <Input
                  id="e-state"
                  value={editingHospital?.state || ''}
                  onChange={(e) => setEditingHospital(prev => prev ? { ...prev, state: e.target.value } : null)}
                  className="h-11 rounded-xl border-gray-200 bg-gray-50/30"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="e-phone" className="text-sm font-medium">Contact Number</Label>
                <Input
                  id="e-phone"
                  value={editingHospital?.phone || ''}
                  onChange={(e) => setEditingHospital(prev => prev ? { ...prev, phone: e.target.value } : null)}
                  className="h-11 rounded-xl border-gray-200 bg-gray-50/30"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="e-email" className="text-sm font-medium">Email Address</Label>
                <Input
                  id="e-email"
                  type="email"
                  value={editingHospital?.email || ''}
                  onChange={(e) => setEditingHospital(prev => prev ? { ...prev, email: e.target.value } : null)}
                  className="h-11 rounded-xl border-gray-200 bg-gray-50/30"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="e-established-year" className="text-sm font-medium">Established Year</Label>
                <Input
                  id="e-established-year"
                  type="number"
                  value={editingHospital?.establishedYear || ''}
                  onChange={(e) => setEditingHospital(prev => prev ? {
                    ...prev,
                    establishedYear: e.target.value ? parseInt(e.target.value, 10) : null,
                  } : null)}
                  className="h-11 rounded-xl border-gray-200 bg-gray-50/30"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="e-beds" className="text-sm font-medium">Beds Capacity</Label>
                <Input
                  id="e-beds"
                  type="number"
                  value={editingHospital?.beds || 0}
                  onChange={(e) => setEditingHospital(prev => prev ? { ...prev, beds: parseInt(e.target.value) || 0 } : null)}
                  className="h-11 rounded-xl border-gray-200 bg-gray-50/30"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="e-doctors" className="text-sm font-medium">Doctors Count</Label>
                <Input
                  id="e-doctors"
                  type="number"
                  value={editingHospital?.doctors || 0}
                  onChange={(e) => setEditingHospital(prev => prev ? { ...prev, doctors: parseInt(e.target.value) || 0 } : null)}
                  className="h-11 rounded-xl border-gray-200 bg-gray-50/30"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="e-max-doctors" className="text-sm font-medium">Max Doctors Allowed</Label>
                <Input
                  id="e-max-doctors"
                  type="number"
                  min={1}
                  value={editingHospital?.maxDoctors ?? ''}
                  onChange={(e) => setEditingHospital(prev => prev ? { ...prev, maxDoctors: e.target.value === '' ? null : parseInt(e.target.value) || 1 } : null)}
                  className="h-11 rounded-xl border-gray-200 bg-gray-50/30"
                  placeholder="Unlimited"
                />
              </div>
            </div>

            {/* Additional Staff Limits (Edit) */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="e-max-receptionists" className="text-sm font-medium">Max Receptionists Allowed</Label>
                <Input
                  id="e-max-receptionists"
                  type="number"
                  min={1}
                  value={editingHospital?.maxReceptionists ?? ''}
                  onChange={(e) => setEditingHospital(prev => prev ? { ...prev, maxReceptionists: e.target.value === '' ? null : parseInt(e.target.value) || 1 } : null)}
                  className="h-11 rounded-xl border-gray-200 bg-gray-50/30"
                  placeholder="Unlimited"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="e-max-nurses" className="text-sm font-medium">Max Nurses Allowed</Label>
                <Input
                  id="e-max-nurses"
                  type="number"
                  min={1}
                  value={editingHospital?.maxNurses ?? ''}
                  onChange={(e) => setEditingHospital(prev => prev ? { ...prev, maxNurses: e.target.value === '' ? null : parseInt(e.target.value) || 1 } : null)}
                  className="h-11 rounded-xl border-gray-200 bg-gray-50/30"
                  placeholder="Unlimited"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="e-max-staff" className="text-sm font-medium">Max Staff Allowed</Label>
                <Input
                  id="e-max-staff"
                  type="number"
                  min={1}
                  value={editingHospital?.maxStaff ?? ''}
                  onChange={(e) => setEditingHospital(prev => prev ? { ...prev, maxStaff: e.target.value === '' ? null : parseInt(e.target.value) || 1 } : null)}
                  className="h-11 rounded-xl border-gray-200 bg-gray-50/30"
                  placeholder="Unlimited"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="e-specializations" className="text-sm font-medium">Specializations</Label>
              <Textarea
                id="e-specializations"
                value={(editingHospital?.specializations || []).join(', ')}
                onChange={(e) => setEditingHospital(prev => prev ? {
                  ...prev,
                  specializations: e.target.value
                    .split(',')
                    .map((item) => item.trim())
                    .filter(Boolean),
                } : null)}
                className="min-h-24 rounded-xl border-gray-200 bg-gray-50/30 resize-none"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Status</Label>
                <Select
                  value={editingHospital?.status}
                  onValueChange={(val) => {
                    if (!val) return;
                    setEditingHospital((prev) => (prev ? { ...prev, status: val as Status } : null));
                  }}
                >
                  <SelectTrigger className="h-11 rounded-xl border-gray-200 bg-gray-50/30">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Under Maintenance">Under Maintenance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Type</Label>
                <Select
                  value={editingHospital?.type || 'Private'}
                  onValueChange={(val) => {
                    if (!val) return;
                    setEditingHospital((prev) => (prev ? { ...prev, type: val as HospitalType } : null));
                  }}
                >
                  <SelectTrigger className="h-11 rounded-xl border-gray-200 bg-gray-50/30">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Government">Government</SelectItem>
                    <SelectItem value="Private">Private</SelectItem>
                    <SelectItem value="Trust">Trust</SelectItem>
                    <SelectItem value="Clinic">Clinic</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Access Type (Edit) */}
            <div className="rounded-xl border border-blue-100 bg-blue-50/30 p-4 space-y-4">
              <div className="flex items-center gap-2">
                <Shield size={16} className="text-blue-600" />
                <Label className="text-sm font-semibold text-blue-900">Access Type</Label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Subscription</Label>
                  <Select
                    value={editingHospital?.accessType || 'permanent'}
                    onValueChange={(val) => {
                      if (!val) return;
                      const isDemo = val === 'demo';
                      const defaultStartDate = formatDateString(editingHospital?.demoStartDate || new Date());
                      const defaultDays = 7;
                      setEditingHospital((prev) => prev ? {
                        ...prev,
                        accessType: val as AccessType,
                        demoDurationDays: isDemo ? defaultDays : null,
                        demoStartDate: isDemo ? defaultStartDate : null,
                        demoExpiryDate: isDemo ? calculateExpiryDate(defaultStartDate, defaultDays) : null,
                      } : null);
                    }}
                  >
                    <SelectTrigger className="h-11 rounded-xl border-gray-200 bg-white">
                      <SelectValue placeholder="Select access type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="permanent">🟢 Permanent</SelectItem>
                      <SelectItem value="demo">🟡 Demo (Trial)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {editingHospital?.accessType === 'demo' ? (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Demo Duration *</Label>
                    <Select
                      value={String(editingHospital?.demoDurationDays || 7)}
                      onValueChange={(val) => {
                        const days = parseInt(val || '0', 10);
                        const start = formatDateString(editingHospital?.demoStartDate || new Date());
                        const expiry = calculateExpiryDate(start, days);
                        setEditingHospital((prev) => prev ? {
                          ...prev,
                          demoDurationDays: days,
                          demoExpiryDate: expiry,
                        } : null);
                      }}
                    >
                      <SelectTrigger className="h-11 rounded-xl border-gray-200 bg-white">
                        <SelectValue placeholder="Select duration" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="7">7 Days</SelectItem>
                        <SelectItem value="15">15 Days</SelectItem>
                        <SelectItem value="30">30 Days</SelectItem>
                        <SelectItem value="60">60 Days</SelectItem>
                        <SelectItem value="90">90 Days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="flex items-center text-sm text-green-700 mt-7">
                    <Shield size={14} className="mr-1.5" />
                    Full access with no expiry
                  </div>
                )}
              </div>
              {editingHospital?.accessType === 'demo' && (
                <>
                  <div className="grid gap-4 sm:grid-cols-2 mt-2">
                    <div className="space-y-2">
                      <Label htmlFor="e-demo-start" className="text-sm font-medium">Demo Start Date *</Label>
                      <Input
                        id="e-demo-start"
                        type="date"
                        value={formatDateString(editingHospital?.demoStartDate || new Date())}
                        onChange={(e) => {
                          const dateVal = e.target.value;
                          const expiry = calculateExpiryDate(dateVal, editingHospital?.demoDurationDays || 7);
                          setEditingHospital((prev) => prev ? {
                            ...prev,
                            demoStartDate: dateVal,
                            demoExpiryDate: expiry,
                          } : null);
                        }}
                        className="h-11 rounded-xl border-gray-200 bg-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Demo Expiry Date</Label>
                      <Input
                        type="date"
                        value={formatDateString(editingHospital?.demoExpiryDate || calculateExpiryDate(formatDateString(editingHospital?.demoStartDate || new Date()), editingHospital?.demoDurationDays || 7))}
                        className="h-11 rounded-xl border-gray-200 bg-gray-100 text-muted-foreground"
                        disabled
                      />
                    </div>
                  </div>
                  <p className="text-xs text-amber-700 flex items-center gap-1.5 mt-2">
                    <AlertTriangle size={12} />
                    Hospital will be automatically deactivated after the demo period ends. Warning emails are sent 7, 3, and 1 days before expiry.
                  </p>
                </>
              )}
            </div>
          </div>
          <DialogFooter className="mx-0 mb-0 mt-0 shrink-0 gap-3 rounded-none px-6 py-4">
            <Button variant="outline" className="rounded-xl px-6 h-11 border-gray-200" onClick={() => setIsEditOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button className="bg-primary hover:bg-primary/90 text-white rounded-xl px-8 h-11 shadow-sm" onClick={handleUpdateHospital} disabled={isSaving}>
              {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden rounded-2xl p-0 sm:max-w-[680px]">
          <DialogHeader className="shrink-0 px-6 pt-6">
            <DialogTitle className="text-xl font-bold">Hospital Details</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Review hospital information without editing.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 overflow-y-auto px-6 py-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Hospital ID</Label>
                <Input
                  value={viewingHospital?.hospitalCode || 'System generated'}
                  className="h-11 rounded-xl border-gray-200 bg-gray-100 text-muted-foreground"
                  disabled
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Hospital Admin</Label>
                <Input
                  value={
                    typeof viewingHospital?.adminId === 'object'
                      ? viewingHospital?.adminId?.name || 'No admin assigned'
                      : 'No admin assigned'
                  }
                  className="h-11 rounded-xl border-gray-200 bg-gray-100 text-muted-foreground"
                  disabled
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Hospital Name</Label>
              <Input
                value={viewingHospital?.name || ''}
                className="h-11 rounded-xl border-gray-200 bg-gray-100 text-muted-foreground"
                disabled
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Address</Label>
              <Textarea
                value={viewingHospital?.address || ''}
                className="min-h-24 rounded-xl border-gray-200 bg-gray-100 text-muted-foreground resize-none"
                disabled
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-sm font-medium">City</Label>
                <Input
                  value={viewingHospital?.city || ''}
                  className="h-11 rounded-xl border-gray-200 bg-gray-100 text-muted-foreground"
                  disabled
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">State</Label>
                <Input
                  value={viewingHospital?.state || ''}
                  className="h-11 rounded-xl border-gray-200 bg-gray-100 text-muted-foreground"
                  disabled
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Contact Number</Label>
                <Input
                  value={viewingHospital?.phone || ''}
                  className="h-11 rounded-xl border-gray-200 bg-gray-100 text-muted-foreground"
                  disabled
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Email Address</Label>
                <Input
                  value={viewingHospital?.email || ''}
                  className="h-11 rounded-xl border-gray-200 bg-gray-100 text-muted-foreground"
                  disabled
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Registration Number</Label>
                <Input
                  value={viewingHospital?.registrationNumber || ''}
                  className="h-11 rounded-xl border-gray-200 bg-gray-100 text-muted-foreground"
                  disabled
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Established Year</Label>
                <Input
                  value={viewingHospital?.establishedYear ?? ''}
                  className="h-11 rounded-xl border-gray-200 bg-gray-100 text-muted-foreground"
                  disabled
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Beds Capacity</Label>
                <Input
                  value={viewingHospital?.beds ?? ''}
                  className="h-11 rounded-xl border-gray-200 bg-gray-100 text-muted-foreground"
                  disabled
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Doctors Count</Label>
                <Input
                  value={viewingHospital?.doctors ?? ''}
                  className="h-11 rounded-xl border-gray-200 bg-gray-100 text-muted-foreground"
                  disabled
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Status</Label>
                <Input
                  value={viewingHospital?.status || ''}
                  className="h-11 rounded-xl border-gray-200 bg-gray-100 text-muted-foreground"
                  disabled
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Type</Label>
                <Input
                  value={viewingHospital?.type || ''}
                  className="h-11 rounded-xl border-gray-200 bg-gray-100 text-muted-foreground"
                  disabled
                />
              </div>
            </div>

            {/* Access Type (View) */}
            <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Shield size={16} className="text-blue-600" />
                <Label className="text-sm font-semibold">Access Type</Label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Subscription</Label>
                  <Input
                    value={viewingHospital?.accessType === 'demo' ? '🟡 Demo (Trial)' : '🟢 Permanent'}
                    className="h-11 rounded-xl border-gray-200 bg-gray-100 text-muted-foreground"
                    disabled
                  />
                </div>
                {viewingHospital?.accessType === 'demo' && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Demo Duration</Label>
                    <Input
                      value={viewingHospital?.demoDurationDays ? `${viewingHospital.demoDurationDays} days` : 'N/A'}
                      className="h-11 rounded-xl border-gray-200 bg-gray-100 text-muted-foreground"
                      disabled
                    />
                  </div>
                )}
              </div>
              {viewingHospital?.accessType === 'demo' && viewingHospital?.demoExpiresAt && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Demo Started</Label>
                    <Input
                      value={viewingHospital?.demoStartedAt ? new Date(viewingHospital.demoStartedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}
                      className="h-11 rounded-xl border-gray-200 bg-gray-100 text-muted-foreground"
                      disabled
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Demo Expires</Label>
                    <Input
                      value={new Date(viewingHospital.demoExpiresAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      className={`h-11 rounded-xl border-gray-200 bg-gray-100 ${
                        new Date(viewingHospital.demoExpiresAt).getTime() <= Date.now()
                          ? 'text-red-600 font-semibold'
                          : 'text-muted-foreground'
                      }`}
                      disabled
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Specializations</Label>
              <Textarea
                value={(viewingHospital?.specializations || []).join(', ')}
                className="min-h-24 rounded-xl border-gray-200 bg-gray-100 text-muted-foreground resize-none"
                disabled
              />
            </div>
          </div>
          <DialogFooter className="mx-0 mb-0 mt-0 shrink-0 gap-3 rounded-none px-6 py-4">
            <Button
              variant="outline"
              className="rounded-xl px-6 h-11 border-gray-200"
              onClick={() => {
                setIsViewOpen(false);
                setViewingHospital(null);
              }}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Table Card */}
      <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
        {/* Controls */}
        <div className="border-b border-border px-4 py-3">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative w-full lg:w-64">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                  size={14}
                />
                <Input
                  placeholder="Search hospitals..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-9 text-sm border-gray-200 focus-visible:ring-1 focus-visible:ring-primary/30"
                />
              </div>
              <div className="flex items-center gap-2 self-start lg:self-auto">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 h-9 text-xs text-muted-foreground"
                  onClick={() => setShowFilters((prev) => !prev)}
                >
                  <SlidersHorizontal size={13} />
                  {showFilters ? 'Hide Filters' : 'Filters'}
                </Button>
                <Button variant="outline" size="sm" className="h-9 text-xs" onClick={resetFilters}>
                  Reset
                </Button>
              </div>
            </div>

            {showFilters ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Hospital type</Label>
                  <Select
                    value={filters.type}
                    onValueChange={(value) => {
                      if (value === null) return;
                      handleFilterChange('type', value);
                    }}
                  >
                    <SelectTrigger className="h-9 rounded-lg border-gray-200 bg-white text-sm">
                      <SelectValue placeholder="All types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All types</SelectItem>
                      <SelectItem value="Government">Government</SelectItem>
                      <SelectItem value="Private">Private</SelectItem>
                      <SelectItem value="Clinic">Clinic</SelectItem>
                      <SelectItem value="Multi-speciality">Multi-speciality</SelectItem>
                      <SelectItem value="Trust">Trust</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Beds range</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="number"
                      min={0}
                      placeholder="Min"
                      value={filters.minBeds}
                      onChange={(e) => handleFilterChange('minBeds', e.target.value)}
                      className="h-9 rounded-lg border-gray-200 text-sm"
                    />
                    <Input
                      type="number"
                      min={0}
                      placeholder="Max"
                      value={filters.maxBeds}
                      onChange={(e) => handleFilterChange('maxBeds', e.target.value)}
                      className="h-9 rounded-lg border-gray-200 text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Doctors range</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="number"
                      min={0}
                      placeholder="Min"
                      value={filters.minDoctors}
                      onChange={(e) => handleFilterChange('minDoctors', e.target.value)}
                      className="h-9 rounded-lg border-gray-200 text-sm"
                    />
                    <Input
                      type="number"
                      min={0}
                      placeholder="Max"
                      value={filters.maxDoctors}
                      onChange={(e) => handleFilterChange('maxDoctors', e.target.value)}
                      className="h-9 rounded-lg border-gray-200 text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Sort by</Label>
                  <Select
                    value={filters.sort}
                    onValueChange={(value) => {
                      if (!value) return;
                      handleFilterChange('sort', value as SortOption);
                    }}
                  >
                    <SelectTrigger className="h-9 rounded-lg border-gray-200 bg-white text-sm">
                      <SelectValue placeholder="Sort hospitals" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="recently-added">Recently added</SelectItem>
                      <SelectItem value="beds-high-to-low">Beds high to low</SelectItem>
                      <SelectItem value="doctors-low-to-high">Doctors low to high</SelectItem>
                      <SelectItem value="last-updated">Last updated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Date filter</Label>
                  <div className="grid gap-2">
                    <Select
                      value={filters.dateField}
                      onValueChange={(value) => {
                        if (!value) return;
                        handleFilterChange('dateField', value as DateField);
                      }}
                    >
                      <SelectTrigger className="h-9 rounded-lg border-gray-200 bg-white text-sm">
                        <SelectValue placeholder="Date field" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="createdAt">Created date</SelectItem>
                        <SelectItem value="updatedAt">Last updated</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="date"
                        value={filters.dateFrom}
                        onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                        className="h-9 rounded-lg border-gray-200 text-sm"
                      />
                      <Input
                        type="date"
                        value={filters.dateTo}
                        onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                        className="h-9 rounded-lg border-gray-200 text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* Table */}
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50/60 hover:bg-gray-50/60 border-border">
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground w-[90px] py-3 pl-4">
                ID
              </TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground py-3">
                Hospital
              </TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground py-3">
                City
              </TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground py-3">
                Beds
              </TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground py-3">
                Doctors
              </TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground py-3">
                Status
              </TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground py-3">
                Access
              </TableHead>
              <TableHead className="w-12 py-3 pr-4" />
            </TableRow>
          </TableHeader>

          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="h-48 text-center">
                  <div className="flex flex-col items-center justify-center text-muted-foreground">
                    <Loader2 className="w-8 h-8 animate-spin mb-2" />
                    <span>Loading hospitals...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : hospitals.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-sm text-muted-foreground">
                  No hospitals found.
                </TableCell>
              </TableRow>
            ) : (
              hospitals.map((hospital) => (
                <TableRow
                  key={hospital.id}
                  className="hover:bg-gray-50/50 border-border transition-colors"
                >
                  <TableCell className="text-xs text-muted-foreground font-medium py-[14px] pl-4">
                    {hospital.hospitalCode || `${hospital.id.substring(0, 8)}...`}
                  </TableCell>
                  <TableCell className="font-semibold text-sm text-foreground py-[14px]">
                    {hospital.name}
                  </TableCell>
                  <TableCell className="text-sm text-primary py-[14px]">
                    {hospital.city}
                  </TableCell>
                  <TableCell className="text-sm text-foreground py-[14px]">
                    {hospital.beds}
                  </TableCell>
                  <TableCell className="text-sm text-foreground py-[14px]">
                    {hospital.doctors}
                  </TableCell>
                  <TableCell className="py-[14px]">
                    <StatusBadge status={hospital.status} />
                  </TableCell>
                  <TableCell className="py-[14px]">
                    {hospital.accessType === 'demo' ? (() => {
                      const isExpired = hospital.demoExpiresAt && new Date(hospital.demoExpiresAt).getTime() <= Date.now();
                      const daysLeft = hospital.demoExpiresAt
                        ? Math.max(0, Math.ceil((new Date(hospital.demoExpiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
                        : null;
                      return isExpired ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-[3px] rounded-full text-xs font-medium bg-red-50 border border-red-200 text-red-700">
                          <AlertTriangle size={10} />
                          Expired
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-[3px] rounded-full text-xs font-medium bg-amber-50 border border-amber-200 text-amber-700">
                          <Clock size={10} />
                          Demo{daysLeft !== null ? ` · ${daysLeft}d` : ''}
                        </span>
                      );
                    })() : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-[3px] rounded-full text-xs font-medium bg-emerald-50 border border-emerald-200 text-emerald-700">
                        <Shield size={10} />
                        Permanent
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="py-[14px] pr-4">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        >
                          <MoreHorizontal size={15} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-36">
                        <DropdownMenuItem
                          className="gap-2 text-xs cursor-pointer"
                          onClick={() => {
                            setViewingHospital(hospital);
                            setIsViewOpen(true);
                          }}
                        >
                          <Eye size={13} /> View
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="gap-2 text-xs cursor-pointer"
                          onClick={() => {
                            setEditingHospital(hospital);
                            setIsEditOpen(true);
                          }}
                        >
                          <Pencil size={13} /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="gap-2 text-xs text-destructive focus:text-destructive cursor-pointer"
                          onClick={() => handleDeleteHospital(hospital.id)}
                        >
                          <Trash2 size={13} /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Pagination Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border">
          <p className="text-xs text-muted-foreground">
            Showing{' '}
            <span className="font-semibold text-foreground">{hospitals.length}</span>
            {' '}hospital{hospitals.length === 1 ? '' : 's'}
          </p>
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="icon" className="h-7 w-7" disabled>
              <ChevronLeft size={13} />
            </Button>
            <span className="text-xs text-muted-foreground px-2">Page 1 / 1</span>
            <Button variant="outline" size="icon" className="h-7 w-7" disabled>
              <ChevronRight size={13} />
            </Button>
          </div>
        </div>
      </div>
      <ConfirmDeleteDialog {...deleteHospitalDialogProps} />
    </div>
  );
}
