'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Pencil, Plus, Search, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import {
  HOSPITAL_ADMIN_CACHE_EVENT,
  getHospitalAdminCacheData,
  refreshHospitalAdminCache,
  setHospitalAdminCacheData,
} from '@/lib/hospital-admin-cache';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConfirmDeleteDialog, useConfirmDelete } from '@/components/ui/confirm-delete-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { getHospitalAdminPath } from '@/lib/routes';

type StaffShift = 'Day' | 'Night' | 'Rotating';
type StaffDepartment = 'Administration' | 'Nursing' | 'Support';
type StaffForm = { firstName: string; lastName: string; department: StaffDepartment | ''; role: string; shift: StaffShift | ''; joiningDate: string; salary: string; email: string; phoneNumber: string };
type StaffRecord = { _id: string } & Omit<StaffForm, 'department' | 'shift'> & { department: StaffDepartment; shift: StaffShift; salary?: number };

const emptyStaffForm: StaffForm = { firstName: '', lastName: '', department: '', role: '', shift: '', joiningDate: '', salary: '', email: '', phoneNumber: '' };
const getErrorMessage = (error: unknown, fallback: string) => typeof error === 'object' && error !== null && 'response' in error ? ((error as { response?: { data?: { message?: string } } }).response?.data?.message || fallback) : fallback;

function InfoBadge({ value }: { value: string }) {
  return <Badge variant="secondary" className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-primary hover:bg-blue-50">{value}</Badge>;
}

export default function HospitalAdminStaffPage() {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [shiftFilter, setShiftFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [staffMembers, setStaffMembers] = useState<StaffRecord[]>([]);
  const [staffForm, setStaffForm] = useState<StaffForm>(emptyStaffForm);
  const [editingStaff, setEditingStaff] = useState<(StaffForm & { _id: string }) | null>(null);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  const syncStaff = async (query?: string) => {
    try {
      const hasCache = !query && !!getHospitalAdminCacheData<StaffRecord[]>('staff');
      if (!hasCache) {
        setLoading(true);
      }
      const response = await api.get('/hospital-admin/staff', { params: query ? { search: query } : undefined });
      const nextStaff = response.data?.data || [];
      setStaffMembers(nextStaff);

      if (!query) {
        setHospitalAdminCacheData('staff', nextStaff);
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to load staff'));
    } finally {
      setLoading(false);
    }
  };

  const loadStaff = async () => {
    await syncStaff(debouncedSearch.trim());
  };

  useEffect(() => {
    const handleCacheUpdate = () => {
      if (debouncedSearch.trim()) return;
      const nextStaff = getHospitalAdminCacheData<StaffRecord[]>('staff');
      if (nextStaff) {
        setStaffMembers(nextStaff);
        setLoading(false);
      }
    };

    window.addEventListener(HOSPITAL_ADMIN_CACHE_EVENT, handleCacheUpdate);
    return () => window.removeEventListener(HOSPITAL_ADMIN_CACHE_EVENT, handleCacheUpdate);
  }, [debouncedSearch]);

  useEffect(() => {
    const nextStaff = getHospitalAdminCacheData<StaffRecord[]>('staff');
    if (nextStaff) {
      setStaffMembers(nextStaff);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStaff();
  }, [debouncedSearch]);

  const filteredStaff = staffMembers.filter((member) => {
    if (departmentFilter !== 'all' && member.department !== departmentFilter) {
      return false;
    }
    if (shiftFilter !== 'all' && member.shift !== shiftFilter) {
      return false;
    }
    return true;
  });

  const handleCreateStaff = async () => {
    if (!staffForm.firstName || !staffForm.lastName || !staffForm.department || !staffForm.shift) {
      toast.error('First name, last name, department, and shift are required.');
      return;
    }
    try {
      await api.post('/hospital-admin/staff', { ...staffForm, salary: staffForm.salary ? Number(staffForm.salary) : undefined });
      toast.success('Staff created successfully');
      setStaffForm(emptyStaffForm);
      setIsAddOpen(false);
      await refreshHospitalAdminCache(['staff', 'dashboard']);
      if (search.trim()) {
        await loadStaff();
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to create staff'));
    }
  };

  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const { dialogProps: deleteDialogProps, openConfirm: openDeleteConfirm } = useConfirmDelete(async () => {
    if (!deleteTargetId) return;
    try {
      await api.delete(`/hospital-admin/staff/${deleteTargetId}`);
      toast.success('Staff deleted successfully');
      setStaffMembers(prev => prev.filter(s => s._id !== deleteTargetId));
      await refreshHospitalAdminCache(['staff', 'dashboardOverview']);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to delete staff member'));
    } finally {
      setDeleteTargetId(null);
    }
  });

  const handleDeleteStaff = (id: string) => {
    setDeleteTargetId(id);
    openDeleteConfirm({ title: 'Delete Staff Member', description: 'Are you sure you want to delete this staff member? This action cannot be undone.' });
  };

  const openEditStaff = (staff: StaffRecord) => {
    setEditingStaff({
      _id: staff._id,
      firstName: staff.firstName,
      lastName: staff.lastName,
      department: staff.department,
      role: staff.role,
      shift: staff.shift,
      joiningDate: staff.joiningDate ? new Date(staff.joiningDate).toISOString().split('T')[0] : '',
      salary: staff.salary ? String(staff.salary) : '',
      email: staff.email,
      phoneNumber: staff.phoneNumber,
    });
    setIsEditOpen(true);
  };

  const handleUpdateStaff = async () => {
    if (!editingStaff || !editingStaff.firstName || !editingStaff.lastName || !editingStaff.department || !editingStaff.shift) {
      toast.error('First name, last name, department, and shift are required.');
      return;
    }
    try {
      await api.put(`/hospital-admin/staff/${editingStaff._id}`, {
        ...editingStaff,
        salary: editingStaff.salary ? Number(editingStaff.salary) : undefined,
      });
      toast.success('Staff updated successfully');
      setEditingStaff(null);
      setIsEditOpen(false);
      await refreshHospitalAdminCache(['staff', 'dashboard']);
      if (search.trim()) {
        await loadStaff();
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to update staff'));
    }
  };

  return (
    <div className="mx-auto max-w-[1180px] space-y-6">
      <nav className="flex items-center gap-1.5 text-xs text-slate-500"><Link href="/" className="transition-colors hover:text-slate-900">Home</Link><span>/</span><Link href={getHospitalAdminPath()} className="transition-colors hover:text-slate-900">Hospital Admin</Link><span>/</span><span className="font-medium text-slate-900">Staff</span></nav>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div><h1 className="text-3xl font-semibold leading-none tracking-tight text-slate-950">Staff</h1><p className="mt-2 text-sm text-slate-500">Manage internal team members, shifts, departments, and roles.</p></div>
        <Button className="h-9 rounded-xl bg-primary px-4 text-sm text-white shadow-sm hover:bg-primary/90" onClick={() => setIsAddOpen(true)}><Plus size={16} className="mr-2" />Add Staff</Button>
      </div>
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-[760px]">
          <DialogHeader><DialogTitle className="text-xl font-semibold">Add Staff</DialogTitle><DialogDescription>Create a staff record with shift, role, department, and contact details.</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-4 sm:grid-cols-2">
            <div className="space-y-2"><Label>First Name</Label><Input value={staffForm.firstName} onChange={(e) => setStaffForm({ ...staffForm, firstName: e.target.value })} /></div>
            <div className="space-y-2"><Label>Last Name</Label><Input value={staffForm.lastName} onChange={(e) => setStaffForm({ ...staffForm, lastName: e.target.value })} /></div>
            <div className="space-y-2"><Label>Department</Label><Select value={staffForm.department} onValueChange={(value) => setStaffForm({ ...staffForm, department: value as StaffDepartment })}><SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger><SelectContent><SelectItem value="Administration">Administration</SelectItem><SelectItem value="Nursing">Nursing</SelectItem><SelectItem value="Support">Support</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>Role</Label><Input value={staffForm.role} onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value })} /></div>
            <div className="space-y-2"><Label>Shift</Label><Select value={staffForm.shift} onValueChange={(value) => setStaffForm({ ...staffForm, shift: value as StaffShift })}><SelectTrigger><SelectValue placeholder="Select shift" /></SelectTrigger><SelectContent><SelectItem value="Day">Day</SelectItem><SelectItem value="Night">Night</SelectItem><SelectItem value="Rotating">Rotating</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>Joining Date</Label><Input type="date" value={staffForm.joiningDate} onChange={(e) => setStaffForm({ ...staffForm, joiningDate: e.target.value })} /></div>
            <div className="space-y-2"><Label>Salary</Label><Input type="number" value={staffForm.salary} onChange={(e) => setStaffForm({ ...staffForm, salary: e.target.value })} /></div>
            <div className="space-y-2"><Label>Email</Label><Input type="email" value={staffForm.email} onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })} /></div>
            <div className="space-y-2 sm:col-span-2"><Label>Phone Number</Label><Input value={staffForm.phoneNumber} onChange={(e) => setStaffForm({ ...staffForm, phoneNumber: e.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button><Button onClick={handleCreateStaff} className="bg-primary text-white hover:bg-primary/90">Save Staff</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-[760px]">
          <DialogHeader><DialogTitle className="text-xl font-semibold">Edit Staff</DialogTitle><DialogDescription>Update staff record details.</DialogDescription></DialogHeader>
          {editingStaff ? <div className="grid gap-4 py-4 sm:grid-cols-2">
            <div className="space-y-2"><Label>First Name</Label><Input value={editingStaff.firstName} onChange={(e) => setEditingStaff({ ...editingStaff, firstName: e.target.value })} /></div>
            <div className="space-y-2"><Label>Last Name</Label><Input value={editingStaff.lastName} onChange={(e) => setEditingStaff({ ...editingStaff, lastName: e.target.value })} /></div>
            <div className="space-y-2"><Label>Department</Label><Select value={editingStaff.department} onValueChange={(value) => setEditingStaff({ ...editingStaff, department: value as StaffDepartment })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Administration">Administration</SelectItem><SelectItem value="Nursing">Nursing</SelectItem><SelectItem value="Support">Support</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>Role</Label><Input value={editingStaff.role} onChange={(e) => setEditingStaff({ ...editingStaff, role: e.target.value })} /></div>
            <div className="space-y-2"><Label>Shift</Label><Select value={editingStaff.shift} onValueChange={(value) => setEditingStaff({ ...editingStaff, shift: value as StaffShift })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Day">Day</SelectItem><SelectItem value="Night">Night</SelectItem><SelectItem value="Rotating">Rotating</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>Joining Date</Label><Input type="date" value={editingStaff.joiningDate} onChange={(e) => setEditingStaff({ ...editingStaff, joiningDate: e.target.value })} /></div>
            <div className="space-y-2"><Label>Salary</Label><Input type="number" value={editingStaff.salary} onChange={(e) => setEditingStaff({ ...editingStaff, salary: e.target.value })} /></div>
            <div className="space-y-2"><Label>Email</Label><Input type="email" value={editingStaff.email} onChange={(e) => setEditingStaff({ ...editingStaff, email: e.target.value })} /></div>
            <div className="space-y-2 sm:col-span-2"><Label>Phone Number</Label><Input value={editingStaff.phoneNumber} onChange={(e) => setEditingStaff({ ...editingStaff, phoneNumber: e.target.value })} /></div>
          </div> : null}
          <DialogFooter><Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button><Button onClick={handleUpdateStaff} className="bg-primary text-white hover:bg-primary/90">Save Changes</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="rounded-2xl border border-slate-200 py-0 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
        <CardHeader className="px-4 pt-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="text-lg font-semibold text-slate-950">Staff Directory</CardTitle>
              <CardDescription>Search and review staff members</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
              <div className="relative flex-1 min-w-[200px] lg:max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search staff..."
                  className="pl-9 text-xs h-9"
                />
              </div>
              <Select value={departmentFilter} onValueChange={(val) => setDepartmentFilter(val || 'all')}>
                <SelectTrigger className="w-[140px] text-xs h-9">
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  <SelectItem value="Administration">Administration</SelectItem>
                  <SelectItem value="Nursing">Nursing</SelectItem>
                  <SelectItem value="Support">Support</SelectItem>
                </SelectContent>
              </Select>
              <Select value={shiftFilter} onValueChange={(val) => setShiftFilter(val || 'all')}>
                <SelectTrigger className="w-[120px] text-xs h-9">
                  <SelectValue placeholder="Shift" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Shifts</SelectItem>
                  <SelectItem value="Day">Day</SelectItem>
                  <SelectItem value="Night">Night</SelectItem>
                  <SelectItem value="Rotating">Rotating</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <Table>
            <TableHeader className="bg-slate-50/70"><TableRow className="hover:bg-transparent"><TableHead className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Staff</TableHead><TableHead className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Department</TableHead><TableHead className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Role</TableHead><TableHead className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Shift</TableHead><TableHead className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Joining Date</TableHead><TableHead className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Salary</TableHead><TableHead className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Contact</TableHead><TableHead className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500 text-right">Action</TableHead></TableRow></TableHeader>
            <TableBody>
              {loading ? <TableRow><TableCell colSpan={8} className="px-4 py-10 text-center text-sm text-slate-500">Loading staff...</TableCell></TableRow> : filteredStaff.length === 0 ? <TableRow><TableCell colSpan={8} className="px-4 py-10 text-center text-sm text-slate-500">No staff found.</TableCell></TableRow> : filteredStaff.map((staff) => (
                <TableRow key={staff._id}>
                  <TableCell className="px-4 py-3"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-50 text-amber-500"><Users size={16} /></div><div><div className="text-xs font-semibold text-slate-950">{staff.firstName} {staff.lastName}</div><div className="text-[11px] text-slate-500">{staff.email || '-'}</div></div></div></TableCell>
                  <TableCell className="px-4 py-3 text-xs text-slate-500">{staff.department}</TableCell>
                  <TableCell className="px-4 py-3 text-xs text-slate-500">{staff.role}</TableCell>
                  <TableCell className="px-4 py-3">{staff.shift ? <InfoBadge value={staff.shift} /> : '-'}</TableCell>
                  <TableCell className="px-4 py-3 text-xs text-slate-500">{staff.joiningDate ? new Date(staff.joiningDate).toISOString().split('T')[0] : '-'}</TableCell>
                  <TableCell className="px-4 py-3 text-xs text-slate-500">{staff.salary ? `Rs. ${staff.salary}` : '-'}</TableCell>
                  <TableCell className="px-4 py-3 text-xs text-slate-500">{staff.phoneNumber || '-'}</TableCell>
                  <TableCell className="px-4 py-3 text-right"><div className="flex items-center justify-end gap-2"><Button variant="outline" size="sm" className="h-8 rounded-lg px-3 text-xs" onClick={() => openEditStaff(staff)}><Pencil size={13} className="mr-1.5" />Edit</Button><Button variant="outline" size="sm" className="h-8 rounded-lg px-3 text-xs text-red-500 hover:text-red-500" onClick={() => handleDeleteStaff(staff._id)}><Trash2 size={13} className="mr-1.5" />Delete</Button></div></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <ConfirmDeleteDialog {...deleteDialogProps} />
    </div>
  );
}
