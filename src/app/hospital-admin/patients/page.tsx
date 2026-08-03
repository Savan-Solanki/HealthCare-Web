'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Pencil, Search, Trash2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import {
  HOSPITAL_ADMIN_CACHE_EVENT,
  getHospitalAdminCacheData,
  refreshHospitalAdminCache,
  setHospitalAdminCacheData,
} from '@/lib/hospital-admin-cache';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ConfirmDeleteDialog, useConfirmDelete } from '@/components/ui/confirm-delete-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useHospitalWorkspace } from '@/contexts/hospital-workspace-context';

type PatientStatus = 'Active' | 'Inactive';
type PatientGender = 'Male' | 'Female' | 'Other';

type PatientForm = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  emergencyContact: string;
  age: string;
  bloodGroup: string;
  gender: PatientGender | '';
  status: PatientStatus;
  address: string;
};

type PatientRecord = {
  _id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  emergencyContact?: string;
  age?: number;
  bloodGroup?: string;
  gender?: PatientGender;
  status: PatientStatus;
  address?: string;
};

const emptyPatientForm: PatientForm = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  emergencyContact: '',
  age: '',
  bloodGroup: '',
  gender: '',
  status: 'Active',
  address: '',
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    return (error as { response?: { data?: { message?: string } } }).response?.data?.message || fallback;
  }
  return fallback;
};

function StatusBadge({ status }: { status: PatientStatus }) {
  return (
    <Badge
      variant="secondary"
      className={
        status === 'Active'
          ? 'rounded-full bg-green-50 px-2.5 py-0.5 text-[11px] font-semibold text-green-600 hover:bg-green-50'
          : 'rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-100'
      }
    >
      {status}
    </Badge>
  );
}

export default function HospitalAdminPatientsPage() {
  const workspace = useHospitalWorkspace();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const [patientForm, setPatientForm] = useState<PatientForm>(emptyPatientForm);
  const [editingPatient, setEditingPatient] = useState<(PatientForm & { _id: string }) | null>(null);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  const syncPatients = async (query?: string) => {
    try {
      const hasCache = !query && !!getHospitalAdminCacheData<PatientRecord[]>('patients');
      if (!hasCache) {
        setLoading(true);
      }
      const response = await api.get('/hospital-admin/patients', {
        params: query ? { search: query } : undefined,
      });
      const nextPatients = response.data?.data || [];
      setPatients(nextPatients);

      if (!query) {
        setHospitalAdminCacheData('patients', nextPatients);
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to load patients'));
    } finally {
      setLoading(false);
    }
  };

  const loadPatients = async () => {
    await syncPatients(debouncedSearch.trim());
  };

  useEffect(() => {
    const handleCacheUpdate = () => {
      if (debouncedSearch.trim()) return;
      const nextPatients = getHospitalAdminCacheData<PatientRecord[]>('patients');
      if (nextPatients) {
        setPatients(nextPatients);
        setLoading(false);
      }
    };

    window.addEventListener(HOSPITAL_ADMIN_CACHE_EVENT, handleCacheUpdate);
    return () => window.removeEventListener(HOSPITAL_ADMIN_CACHE_EVENT, handleCacheUpdate);
  }, [debouncedSearch]);

  useEffect(() => {
    const nextPatients = getHospitalAdminCacheData<PatientRecord[]>('patients');
    if (nextPatients) {
      setPatients(nextPatients);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPatients();
  }, [debouncedSearch]);

  const filteredPatients = patients.filter((patient) => {
    if (statusFilter !== 'all' && patient.status !== statusFilter) {
      return false;
    }
    return true;
  });

  const handleCreatePatient = async () => {
    if (!patientForm.firstName || !patientForm.lastName || !patientForm.gender) {
      toast.error('First name, last name, and gender are required.');
      return;
    }

    try {
      await api.post('/hospital-admin/patients', {
        ...patientForm,
        age: patientForm.age ? Number(patientForm.age) : undefined,
      });
      toast.success('Patient created successfully');
      setPatientForm(emptyPatientForm);
      setIsAddOpen(false);
      await refreshHospitalAdminCache(['patients', 'dashboard']);
      if (search.trim()) {
        await loadPatients();
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to create patient'));
    }
  };

  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const { dialogProps: deleteDialogProps, openConfirm: openDeleteConfirm } = useConfirmDelete(async () => {
    if (!deleteTargetId) return;
    try {
      await api.delete(`/hospital-admin/patients/${deleteTargetId}`);
      toast.success('Patient deleted successfully');
      setPatients(prev => prev.filter(p => p._id !== deleteTargetId));
      await refreshHospitalAdminCache(['patients', 'dashboardOverview']);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to delete patient'));
    } finally {
      setDeleteTargetId(null);
    }
  });

  const handleDeletePatient = (id: string) => {
    setDeleteTargetId(id);
    openDeleteConfirm({ title: 'Delete Patient', description: 'Are you sure you want to delete this patient record? This action cannot be undone.' });
  };

  const openEditPatient = (patient: PatientRecord) => {
    setEditingPatient({
      _id: patient._id,
      firstName: patient.firstName,
      lastName: patient.lastName,
      email: patient.email || '',
      phone: patient.phone || '',
      emergencyContact: patient.emergencyContact || '',
      age: patient.age ? String(patient.age) : '',
      bloodGroup: patient.bloodGroup || '',
      gender: patient.gender || '',
      status: patient.status,
      address: patient.address || '',
    });
    setIsEditOpen(true);
  };

  const handleUpdatePatient = async () => {
    if (!editingPatient || !editingPatient.firstName || !editingPatient.lastName || !editingPatient.gender) {
      toast.error('First name, last name, and gender are required.');
      return;
    }

    try {
      await api.put(`/hospital-admin/patients/${editingPatient._id}`, {
        ...editingPatient,
        age: editingPatient.age ? Number(editingPatient.age) : undefined,
      });
      toast.success('Patient updated successfully');
      setEditingPatient(null);
      setIsEditOpen(false);
      await refreshHospitalAdminCache(['patients', 'dashboard']);
      if (search.trim()) {
        await loadPatients();
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to update patient'));
    }
  };

  return (
    <div className="mx-auto max-w-[1180px] space-y-6">
      <nav className="flex items-center gap-1.5 text-xs text-slate-500">
        <Link href="/" className="transition-colors hover:text-slate-900">
          Home
        </Link>
        <span>/</span>
        <Link href={workspace.homePath} className="transition-colors hover:text-slate-900">
          {workspace.portalLabel}
        </Link>
        <span>/</span>
        <span className="font-medium text-slate-900">Patients</span>
      </nav>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold leading-none tracking-tight text-slate-950">Patients</h1>
          <p className="mt-2 text-sm text-slate-500">
            Manage patient records and register new patients for your hospital.
          </p>
        </div>
        <Button className="h-9 rounded-xl bg-primary px-4 text-sm text-white shadow-sm hover:bg-primary/90" onClick={() => setIsAddOpen(true)}>
          <UserPlus size={16} className="mr-2" />
          Add Patient
        </Button>
      </div>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-[760px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Add Patient</DialogTitle>
            <DialogDescription>
              Create a new patient profile with contact, status, and medical basics.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="patient-first-name">First Name</Label>
              <Input id="patient-first-name" value={patientForm.firstName} onChange={(e) => setPatientForm({ ...patientForm, firstName: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="patient-last-name">Last Name</Label>
              <Input id="patient-last-name" value={patientForm.lastName} onChange={(e) => setPatientForm({ ...patientForm, lastName: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="patient-email">Email</Label>
              <Input id="patient-email" type="email" value={patientForm.email} onChange={(e) => setPatientForm({ ...patientForm, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="patient-phone">Phone</Label>
              <Input id="patient-phone" value={patientForm.phone} onChange={(e) => setPatientForm({ ...patientForm, phone: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="patient-emergency-contact">Emergency Contact</Label>
              <Input id="patient-emergency-contact" value={patientForm.emergencyContact} onChange={(e) => setPatientForm({ ...patientForm, emergencyContact: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="patient-age">Age</Label>
              <Input id="patient-age" type="number" value={patientForm.age} onChange={(e) => setPatientForm({ ...patientForm, age: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="patient-blood-group">Blood Group</Label>
              <Input id="patient-blood-group" value={patientForm.bloodGroup} onChange={(e) => setPatientForm({ ...patientForm, bloodGroup: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Gender</Label>
              <Select value={patientForm.gender} onValueChange={(value) => setPatientForm({ ...patientForm, gender: value as PatientGender })}>
                <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={patientForm.status} onValueChange={(value) => setPatientForm({ ...patientForm, status: value as PatientStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="patient-address">Address</Label>
              <Textarea id="patient-address" value={patientForm.address} onChange={(e) => setPatientForm({ ...patientForm, address: e.target.value })} className="min-h-24 resize-none" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
            <Button onClick={handleCreatePatient} className="bg-primary text-white hover:bg-primary/90">Save Patient</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-[760px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Edit Patient</DialogTitle>
            <DialogDescription>Update patient profile details.</DialogDescription>
          </DialogHeader>
          {editingPatient ? (
            <div className="grid gap-4 py-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>First Name</Label><Input value={editingPatient.firstName} onChange={(e) => setEditingPatient({ ...editingPatient, firstName: e.target.value })} /></div>
              <div className="space-y-2"><Label>Last Name</Label><Input value={editingPatient.lastName} onChange={(e) => setEditingPatient({ ...editingPatient, lastName: e.target.value })} /></div>
              <div className="space-y-2"><Label>Email</Label><Input type="email" value={editingPatient.email} onChange={(e) => setEditingPatient({ ...editingPatient, email: e.target.value })} /></div>
              <div className="space-y-2"><Label>Phone</Label><Input value={editingPatient.phone} onChange={(e) => setEditingPatient({ ...editingPatient, phone: e.target.value })} /></div>
              <div className="space-y-2"><Label>Emergency Contact</Label><Input value={editingPatient.emergencyContact} onChange={(e) => setEditingPatient({ ...editingPatient, emergencyContact: e.target.value })} /></div>
              <div className="space-y-2"><Label>Age</Label><Input type="number" value={editingPatient.age} onChange={(e) => setEditingPatient({ ...editingPatient, age: e.target.value })} /></div>
              <div className="space-y-2"><Label>Blood Group</Label><Input value={editingPatient.bloodGroup} onChange={(e) => setEditingPatient({ ...editingPatient, bloodGroup: e.target.value })} /></div>
              <div className="space-y-2"><Label>Gender</Label><Select value={editingPatient.gender} onValueChange={(value) => setEditingPatient({ ...editingPatient, gender: value as PatientGender })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Male">Male</SelectItem><SelectItem value="Female">Female</SelectItem><SelectItem value="Other">Other</SelectItem></SelectContent></Select></div>
              <div className="space-y-2"><Label>Status</Label><Select value={editingPatient.status} onValueChange={(value) => setEditingPatient({ ...editingPatient, status: value as PatientStatus })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Active">Active</SelectItem><SelectItem value="Inactive">Inactive</SelectItem></SelectContent></Select></div>
              <div className="space-y-2 sm:col-span-2"><Label>Address</Label><Textarea value={editingPatient.address} onChange={(e) => setEditingPatient({ ...editingPatient, address: e.target.value })} className="min-h-24 resize-none" /></div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdatePatient} className="bg-primary text-white hover:bg-primary/90">Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="rounded-2xl border border-slate-200 py-0 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
        <CardHeader className="px-4 pt-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="text-lg font-semibold text-slate-950">Patient Directory</CardTitle>
              <CardDescription>Search and review hospital patient records</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
              <div className="relative flex-1 min-w-[200px] lg:max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search patient..."
                  className="pl-9 text-xs h-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val || 'all')}>
                <SelectTrigger className="w-[140px] text-xs h-9">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <Table>
            <TableHeader className="bg-slate-50/70">
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Patient</TableHead>
                <TableHead className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Email</TableHead>
                <TableHead className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Phone</TableHead>
                <TableHead className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Age</TableHead>
                <TableHead className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Gender</TableHead>
                <TableHead className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Blood Group</TableHead>
                <TableHead className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Status</TableHead>
                <TableHead className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500 text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="px-4 py-10 text-center text-sm text-slate-500">Loading patients...</TableCell>
                </TableRow>
              ) : filteredPatients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="px-4 py-10 text-center text-sm text-slate-500">No patients found.</TableCell>
                </TableRow>
              ) : (
                filteredPatients.map((patient) => (
                  <TableRow key={patient._id}>
                    <TableCell className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-primary">
                          <UserPlus size={16} />
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-slate-950">{patient.firstName} {patient.lastName}</div>
                          <div className="text-[11px] text-slate-500">{patient.address || '-'}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-xs text-slate-500">{patient.email || '-'}</TableCell>
                    <TableCell className="px-4 py-3 text-xs text-slate-500">{patient.phone || '-'}</TableCell>
                    <TableCell className="px-4 py-3 text-xs text-slate-500">{patient.age ?? '-'}</TableCell>
                    <TableCell className="px-4 py-3 text-xs text-slate-500">{patient.gender || '-'}</TableCell>
                    <TableCell className="px-4 py-3 text-xs text-slate-500">{patient.bloodGroup || '-'}</TableCell>
                    <TableCell className="px-4 py-3"><StatusBadge status={patient.status} /></TableCell>
                    <TableCell className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="outline" size="sm" className="h-8 rounded-lg px-3 text-xs" onClick={() => openEditPatient(patient)}>
                          <Pencil size={13} className="mr-1.5" />
                          Edit
                        </Button>
                        <Button variant="outline" size="sm" className="h-8 rounded-lg px-3 text-xs text-red-500 hover:text-red-500" onClick={() => handleDeletePatient(patient._id)}>
                          <Trash2 size={13} className="mr-1.5" />
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <ConfirmDeleteDialog {...deleteDialogProps} />
    </div>
  );
}
