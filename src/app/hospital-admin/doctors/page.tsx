'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Pencil, Plus, Search, Stethoscope, Trash2, CalendarClock } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import DoctorSlotsManageDialog from '@/components/doctors/doctor-slots-manage-dialog';
import {
  HOSPITAL_ADMIN_CACHE_EVENT,
  getHospitalAdminCacheData,
  refreshHospitalAdminCache,
  setHospitalAdminCacheData,
} from '@/lib/hospital-admin-cache';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConfirmDeleteDialog, useConfirmDelete } from '@/components/ui/confirm-delete-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getHospitalAdminPath } from '@/lib/routes';

type DoctorGender = 'Male' | 'Female';
type DoctorProfileFields = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  availableTime: string;
  consultationFee: string;
  specialization: string;
  experience: string;
  gender: DoctorGender | '';
  qualification: string;
  department: string;
};
type CreateDoctorForm = DoctorProfileFields & { password: string };
type EditDoctorForm = DoctorProfileFields & { _id: string; password: string };
type DoctorRecord = DoctorProfileFields & { _id: string };

const emptyDoctorForm: CreateDoctorForm = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  phone: '',
  availableTime: '',
  consultationFee: '',
  specialization: '',
  experience: '',
  gender: '',
  qualification: '',
  department: '',
};

const getErrorMessage = (error: unknown, fallback: string) =>
  typeof error === 'object' && error !== null && 'response' in error
    ? (error as { response?: { data?: { message?: string } } }).response?.data?.message || fallback
    : fallback;

function GenderBadge({ gender }: { gender: DoctorGender }) {
  return <Badge variant="secondary" className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-primary hover:bg-blue-50">{gender}</Badge>;
}

export default function HospitalAdminDoctorsPage() {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedSlotDoctor, setSelectedSlotDoctor] = useState<DoctorRecord | null>(null);
  const [isSlotOpen, setIsSlotOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [specializationFilter, setSpecializationFilter] = useState('all');
  const [genderFilter, setGenderFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [doctors, setDoctors] = useState<DoctorRecord[]>([]);
  const [doctorForm, setDoctorForm] = useState<CreateDoctorForm>(emptyDoctorForm);
  const [editingDoctor, setEditingDoctor] = useState<EditDoctorForm | null>(null);
  // Doctor quota from hospital settings
  const [maxDoctors, setMaxDoctors] = useState<number | null>(null);
  const [doctorLimit, setDoctorLimit] = useState<number>(3);

  // Fetch hospital profile to get maxDoctors quota
  useEffect(() => {
    api.get('/hospital-admin/dashboard')
      .then((res) => {
        const hospital = res.data?.data?.hospital;
        setMaxDoctors(hospital?.maxDoctors ?? null);
        const limit = hospital?.maxDoctors !== null && hospital?.maxDoctors !== undefined
          ? hospital.maxDoctors
          : (hospital?.doctors && hospital.doctors > 0 ? hospital.doctors : 3);
        setDoctorLimit(limit);
      })
      .catch(() => { /* non-fatal */ });
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  const syncDoctors = async (query?: string) => {
    try {
      const hasCache = !query && !!getHospitalAdminCacheData<DoctorRecord[]>('doctors');
      if (!hasCache) {
        setLoading(true);
      }
      const response = await api.get('/hospital-admin/doctors', { params: query ? { search: query } : undefined });
      const nextDoctors = response.data?.data || [];
      setDoctors(nextDoctors);

      if (!query) {
        setHospitalAdminCacheData('doctors', nextDoctors);
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to load doctors'));
    } finally {
      setLoading(false);
    }
  };

  const loadDoctors = async () => {
    await syncDoctors(debouncedSearch.trim());
  };

  useEffect(() => {
    const handleCacheUpdate = () => {
      if (debouncedSearch.trim()) return;
      const nextDoctors = getHospitalAdminCacheData<DoctorRecord[]>('doctors');
      if (nextDoctors) {
        setDoctors(nextDoctors);
        setLoading(false);
      }
    };

    window.addEventListener(HOSPITAL_ADMIN_CACHE_EVENT, handleCacheUpdate);
    return () => window.removeEventListener(HOSPITAL_ADMIN_CACHE_EVENT, handleCacheUpdate);
  }, [debouncedSearch]);

  useEffect(() => {
    const nextDoctors = getHospitalAdminCacheData<DoctorRecord[]>('doctors');
    if (nextDoctors) {
      setDoctors(nextDoctors);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDoctors();
  }, [debouncedSearch]);

  const departmentsList = Array.from(new Set(doctors.map((d) => d.department).filter(Boolean)));
  const specializationsList = Array.from(new Set(doctors.map((d) => d.specialization).filter(Boolean)));

  const filteredDoctors = doctors.filter((doc) => {
    if (departmentFilter !== 'all' && doc.department !== departmentFilter) return false;
    if (specializationFilter !== 'all' && doc.specialization !== specializationFilter) return false;
    if (genderFilter !== 'all' && doc.gender !== genderFilter) return false;
    return true;
  });

  const handleCreateDoctor = async () => {
    if (!doctorForm.firstName || !doctorForm.lastName || !doctorForm.gender || !doctorForm.email || !doctorForm.password) {
      toast.error('First name, last name, gender, email, and password are required.');
      return;
    }
    try {
      await api.post('/hospital-admin/doctors', {
        ...doctorForm,
        consultationFee: doctorForm.consultationFee ? Number(doctorForm.consultationFee) : undefined,
      });
      toast.success('Doctor created successfully');
      setDoctorForm(emptyDoctorForm);
      setIsAddOpen(false);
      await refreshHospitalAdminCache(['doctors', 'dashboard']);
      if (search.trim()) {
        await loadDoctors();
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to create doctor'));
    }
  };

  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const { dialogProps: deleteDialogProps, openConfirm: openDeleteConfirm } = useConfirmDelete(async () => {
    if (!deleteTargetId) return;
    try {
      await api.delete(`/hospital-admin/doctors/${deleteTargetId}`);
      toast.success('Doctor deleted successfully');
      setDoctors(prev => prev.filter(d => d._id !== deleteTargetId));
      await refreshHospitalAdminCache(['doctors', 'dashboardOverview']);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to delete doctor'));
    } finally {
      setDeleteTargetId(null);
    }
  });

  const handleDeleteDoctor = (id: string) => {
    setDeleteTargetId(id);
    openDeleteConfirm({ title: 'Delete Doctor', description: 'Are you sure you want to delete this doctor? All their associated data will be removed. This action cannot be undone.' });
  };

  const openEditDoctor = (doctor: DoctorRecord) => {
    setEditingDoctor({
      _id: doctor._id,
      firstName: doctor.firstName,
      lastName: doctor.lastName,
      email: doctor.email,
      phone: doctor.phone,
      availableTime: doctor.availableTime,
      consultationFee: doctor.consultationFee,
      specialization: doctor.specialization,
      experience: doctor.experience,
      gender: doctor.gender,
      qualification: doctor.qualification,
      department: doctor.department,
      password: '',
    });
    setIsEditOpen(true);
  };

  const handleUpdateDoctor = async () => {
    if (!editingDoctor || !editingDoctor.firstName || !editingDoctor.lastName || !editingDoctor.gender) {
      toast.error('First name, last name, and gender are required.');
      return;
    }
    try {
      await api.put(`/hospital-admin/doctors/${editingDoctor._id}`, {
        ...editingDoctor,
        consultationFee: editingDoctor.consultationFee ? Number(editingDoctor.consultationFee) : undefined,
      });
      toast.success('Doctor updated successfully');
      setEditingDoctor(null);
      setIsEditOpen(false);
      await refreshHospitalAdminCache(['doctors', 'dashboard']);
      if (search.trim()) {
        await loadDoctors();
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to update doctor'));
    }
  };

  return (
    <div className="mx-auto max-w-[1180px] space-y-6">
      <nav className="flex items-center gap-1.5 text-xs text-slate-500">
        <Link href="/" className="transition-colors hover:text-slate-900">Home</Link><span>/</span>
        <Link href={getHospitalAdminPath()} className="transition-colors hover:text-slate-900">Hospital Admin</Link><span>/</span>
        <span className="font-medium text-slate-900">Doctors</span>
      </nav>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold leading-none tracking-tight text-slate-950">Doctors</h1>
          <p className="mt-2 text-sm text-slate-500">Manage doctor records, specializations, and consultation availability.</p>
        </div>
        <div className="flex items-center gap-3">
          {maxDoctors !== null && (
            <span className={`text-sm font-medium px-3 py-1.5 rounded-full border ${
              doctors.length >= maxDoctors
                ? 'bg-red-50 border-red-200 text-red-700'
                : 'bg-blue-50 border-blue-200 text-blue-700'
            }`}>
              {doctors.length} / {maxDoctors} Doctors
            </span>
          )}
          <Button
            className="h-9 rounded-xl bg-primary px-4 text-sm text-white shadow-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => setIsAddOpen(true)}
            disabled={doctors.length >= doctorLimit}
            title={doctors.length >= doctorLimit ? `Doctor limit reached (${doctors.length}/${doctorLimit}). Contact super admin to increase.` : undefined}
          >
            <Plus size={16} className="mr-2" />Add Doctor
          </Button>
        </div>
      </div>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-[760px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Add Doctor</DialogTitle>
            <DialogDescription>Create a doctor profile with professional, contact, and department details.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 sm:grid-cols-2">
            <div className="space-y-2"><Label>First Name</Label><Input value={doctorForm.firstName} onChange={(e) => setDoctorForm({ ...doctorForm, firstName: e.target.value })} /></div>
            <div className="space-y-2"><Label>Last Name</Label><Input value={doctorForm.lastName} onChange={(e) => setDoctorForm({ ...doctorForm, lastName: e.target.value })} /></div>
            <div className="space-y-2"><Label>Email</Label><Input type="email" value={doctorForm.email} onChange={(e) => setDoctorForm({ ...doctorForm, email: e.target.value })} /></div>
            <div className="space-y-2"><Label>Password</Label><Input type="password" value={doctorForm.password} onChange={(e) => setDoctorForm({ ...doctorForm, password: e.target.value })} placeholder="Minimum 8 characters with 1 number" /></div>
            <div className="space-y-2"><Label>Phone</Label><Input value={doctorForm.phone} onChange={(e) => setDoctorForm({ ...doctorForm, phone: e.target.value })} /></div>
            <div className="space-y-2"><Label>Available Time</Label><Input value={doctorForm.availableTime} onChange={(e) => setDoctorForm({ ...doctorForm, availableTime: e.target.value })} /></div>
            <div className="space-y-2"><Label>Consultation Fee (Rs.)</Label><Input type="number" value={doctorForm.consultationFee} onChange={(e) => setDoctorForm({ ...doctorForm, consultationFee: e.target.value })} /></div>
            <div className="space-y-2"><Label>Specialization</Label><Input value={doctorForm.specialization} onChange={(e) => setDoctorForm({ ...doctorForm, specialization: e.target.value })} /></div>
            <div className="space-y-2"><Label>Experience</Label><Input value={doctorForm.experience} onChange={(e) => setDoctorForm({ ...doctorForm, experience: e.target.value })} /></div>
            <div className="space-y-2"><Label>Gender</Label><Select value={doctorForm.gender} onValueChange={(value) => setDoctorForm({ ...doctorForm, gender: value as DoctorGender })}><SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger><SelectContent><SelectItem value="Male">Male</SelectItem><SelectItem value="Female">Female</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>Qualification</Label><Input value={doctorForm.qualification} onChange={(e) => setDoctorForm({ ...doctorForm, qualification: e.target.value })} /></div>
            <div className="space-y-2 sm:col-span-2"><Label>Department</Label><Input value={doctorForm.department} onChange={(e) => setDoctorForm({ ...doctorForm, department: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateDoctor} className="bg-primary text-white hover:bg-primary/90">Save Doctor</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-[760px]">
          <DialogHeader><DialogTitle className="text-xl font-semibold">Edit Doctor</DialogTitle><DialogDescription>Update doctor profile details.</DialogDescription></DialogHeader>
          {editingDoctor ? <div className="grid gap-4 py-4 sm:grid-cols-2">
            <div className="space-y-2"><Label>First Name</Label><Input value={editingDoctor.firstName} onChange={(e) => setEditingDoctor({ ...editingDoctor, firstName: e.target.value })} /></div>
            <div className="space-y-2"><Label>Last Name</Label><Input value={editingDoctor.lastName} onChange={(e) => setEditingDoctor({ ...editingDoctor, lastName: e.target.value })} /></div>
            <div className="space-y-2"><Label>Email</Label><Input type="email" value={editingDoctor.email} onChange={(e) => setEditingDoctor({ ...editingDoctor, email: e.target.value })} /></div>
            <div className="space-y-2"><Label>Reset Password</Label><Input type="password" value={editingDoctor.password} onChange={(e) => setEditingDoctor({ ...editingDoctor, password: e.target.value })} placeholder="Leave blank to keep current password" /></div>
            <div className="space-y-2"><Label>Phone</Label><Input value={editingDoctor.phone} onChange={(e) => setEditingDoctor({ ...editingDoctor, phone: e.target.value })} /></div>
            <div className="space-y-2"><Label>Available Time</Label><Input value={editingDoctor.availableTime} onChange={(e) => setEditingDoctor({ ...editingDoctor, availableTime: e.target.value })} /></div>
            <div className="space-y-2"><Label>Consultation Fee (Rs.)</Label><Input type="number" value={editingDoctor.consultationFee} onChange={(e) => setEditingDoctor({ ...editingDoctor, consultationFee: e.target.value })} /></div>
            <div className="space-y-2"><Label>Specialization</Label><Input value={editingDoctor.specialization} onChange={(e) => setEditingDoctor({ ...editingDoctor, specialization: e.target.value })} /></div>
            <div className="space-y-2"><Label>Experience</Label><Input value={editingDoctor.experience} onChange={(e) => setEditingDoctor({ ...editingDoctor, experience: e.target.value })} /></div>
            <div className="space-y-2"><Label>Gender</Label><Select value={editingDoctor.gender} onValueChange={(value) => setEditingDoctor({ ...editingDoctor, gender: value as DoctorGender })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Male">Male</SelectItem><SelectItem value="Female">Female</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>Qualification</Label><Input value={editingDoctor.qualification} onChange={(e) => setEditingDoctor({ ...editingDoctor, qualification: e.target.value })} /></div>
            <div className="space-y-2 sm:col-span-2"><Label>Department</Label><Input value={editingDoctor.department} onChange={(e) => setEditingDoctor({ ...editingDoctor, department: e.target.value })} /></div>
          </div> : null}
          <DialogFooter><Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button><Button onClick={handleUpdateDoctor} className="bg-primary text-white hover:bg-primary/90">Save Changes</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="rounded-2xl border border-slate-200 py-0 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
        <CardHeader className="px-4 pt-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div><CardTitle className="text-lg font-semibold text-slate-950">Doctor Directory</CardTitle><CardDescription>Search and review hospital doctors</CardDescription></div>
            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
              <div className="relative flex-1 min-w-[200px] lg:max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search doctor..."
                  className="pl-9 text-xs h-9"
                />
              </div>
              <Select value={departmentFilter} onValueChange={(val) => setDepartmentFilter(val || 'all')}>
                <SelectTrigger className="w-[140px] text-xs h-9">
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departmentsList.map((dept) => (
                    <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={specializationFilter} onValueChange={(val) => setSpecializationFilter(val || 'all')}>
                <SelectTrigger className="w-[140px] text-xs h-9">
                  <SelectValue placeholder="Specialty" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Specialties</SelectItem>
                  {specializationsList.map((spec) => (
                    <SelectItem key={spec} value={spec}>{spec}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={genderFilter} onValueChange={(val) => setGenderFilter(val || 'all')}>
                <SelectTrigger className="w-[110px] text-xs h-9">
                  <SelectValue placeholder="Gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Genders</SelectItem>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <Table>
            <TableHeader className="bg-slate-50/70"><TableRow className="hover:bg-transparent"><TableHead className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Doctor</TableHead><TableHead className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Email</TableHead><TableHead className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Phone</TableHead><TableHead className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Specialization</TableHead><TableHead className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Experience</TableHead><TableHead className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Fee</TableHead><TableHead className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Gender</TableHead><TableHead className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500 text-right">Action</TableHead></TableRow></TableHeader>
            <TableBody>
              {loading ? <TableRow><TableCell colSpan={8} className="px-4 py-10 text-center text-sm text-slate-500">Loading doctors...</TableCell></TableRow> : filteredDoctors.length === 0 ? <TableRow><TableCell colSpan={8} className="px-4 py-10 text-center text-sm text-slate-500">No doctors found.</TableCell></TableRow> : filteredDoctors.map((doctor) => (
                <TableRow key={doctor._id}>
                  <TableCell className="px-4 py-3"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-50 text-green-600"><Stethoscope size={16} /></div><div><div className="text-xs font-semibold text-slate-950">Dr. {doctor.firstName} {doctor.lastName}</div><div className="text-[11px] text-slate-500">{doctor.department || '-'}</div></div></div></TableCell>
                  <TableCell className="px-4 py-3 text-xs text-slate-500">{doctor.email || '-'}</TableCell>
                  <TableCell className="px-4 py-3 text-xs text-slate-500">{doctor.phone || '-'}</TableCell>
                  <TableCell className="px-4 py-3 text-xs text-slate-500">{doctor.specialization || '-'}</TableCell>
                  <TableCell className="px-4 py-3 text-xs text-slate-500">{doctor.experience || '-'}</TableCell>
                  <TableCell className="px-4 py-3 text-xs text-slate-500">{doctor.consultationFee ? `Rs. ${doctor.consultationFee}` : '-'}</TableCell>
                  <TableCell className="px-4 py-3">{doctor.gender ? <GenderBadge gender={doctor.gender} /> : '-'}</TableCell>
                  <TableCell className="px-4 py-3 text-right"><div className="flex items-center justify-end gap-2"><Button variant="outline" size="sm" className="h-8 rounded-lg px-3 text-xs border-teal-200 bg-teal-50 text-teal-600 hover:bg-teal-100 hover:text-teal-700" onClick={() => { setSelectedSlotDoctor(doctor); setIsSlotOpen(true); }}><CalendarClock size={13} className="mr-1.5" />Slots</Button><Button variant="outline" size="sm" className="h-8 rounded-lg px-3 text-xs" onClick={() => openEditDoctor(doctor)}><Pencil size={13} className="mr-1.5" />Edit</Button><Button variant="outline" size="sm" className="h-8 rounded-lg px-3 text-xs text-red-500 hover:text-red-500" onClick={() => handleDeleteDoctor(doctor._id)}><Trash2 size={13} className="mr-1.5" />Delete</Button></div></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {selectedSlotDoctor && (
        <DoctorSlotsManageDialog
          isOpen={isSlotOpen}
          onClose={() => setIsSlotOpen(false)}
          doctorId={selectedSlotDoctor._id}
          doctorName={`${selectedSlotDoctor.firstName} ${selectedSlotDoctor.lastName}`}
        />
      )}
      <ConfirmDeleteDialog {...deleteDialogProps} />
    </div>
  );
}
