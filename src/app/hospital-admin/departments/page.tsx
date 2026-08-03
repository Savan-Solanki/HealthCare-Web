'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Building2, Pencil, Plus, Search, Trash2 } from 'lucide-react';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getHospitalAdminPath } from '@/lib/routes';

type DepartmentForm = { departmentName: string; departmentHead: string; totalStaff: string };
type DepartmentRecord = { _id: string; departmentName: string; departmentHead: string; totalStaff: number };

const emptyDepartmentForm: DepartmentForm = { departmentName: '', departmentHead: '', totalStaff: '' };
const getErrorMessage = (error: unknown, fallback: string) => typeof error === 'object' && error !== null && 'response' in error ? ((error as { response?: { data?: { message?: string } } }).response?.data?.message || fallback) : fallback;

export default function HospitalAdminDepartmentsPage() {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [departmentForm, setDepartmentForm] = useState<DepartmentForm>(emptyDepartmentForm);
  const [editingDepartment, setEditingDepartment] = useState<(DepartmentForm & { _id: string }) | null>(null);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  const syncDepartments = async (query?: string) => {
    try {
      const hasCache = !query && !!getHospitalAdminCacheData<DepartmentRecord[]>('departments');
      if (!hasCache) {
        setLoading(true);
      }
      const response = await api.get('/hospital-admin/departments', { params: query ? { search: query } : undefined });
      const nextDepartments = response.data?.data || [];
      setDepartments(nextDepartments);

      if (!query) {
        setHospitalAdminCacheData('departments', nextDepartments);
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to load departments'));
    } finally {
      setLoading(false);
    }
  };

  const loadDepartments = async () => {
    await syncDepartments(debouncedSearch.trim());
  };

  useEffect(() => {
    const handleCacheUpdate = () => {
      if (debouncedSearch.trim()) return;
      const nextDepartments = getHospitalAdminCacheData<DepartmentRecord[]>('departments');
      if (nextDepartments) {
        setDepartments(nextDepartments);
        setLoading(false);
      }
    };

    window.addEventListener(HOSPITAL_ADMIN_CACHE_EVENT, handleCacheUpdate);
    return () => window.removeEventListener(HOSPITAL_ADMIN_CACHE_EVENT, handleCacheUpdate);
  }, [debouncedSearch]);

  useEffect(() => {
    const nextDepartments = getHospitalAdminCacheData<DepartmentRecord[]>('departments');
    if (nextDepartments) {
      setDepartments(nextDepartments);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDepartments();
  }, [debouncedSearch]);

  const handleCreateDepartment = async () => {
    if (!departmentForm.departmentName || !departmentForm.departmentHead || !departmentForm.totalStaff) {
      toast.error('All department fields are required.');
      return;
    }
    try {
      await api.post('/hospital-admin/departments', { ...departmentForm, totalStaff: Number(departmentForm.totalStaff) });
      toast.success('Department created successfully');
      setDepartmentForm(emptyDepartmentForm);
      setIsAddOpen(false);
      await refreshHospitalAdminCache(['departments']);
      if (search.trim()) {
        await loadDepartments();
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to create department'));
    }
  };

  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const { dialogProps: deleteDialogProps, openConfirm: openDeleteConfirm } = useConfirmDelete(async () => {
    if (!deleteTargetId) return;
    try {
      await api.delete(`/hospital-admin/departments/${deleteTargetId}`);
      toast.success('Department deleted successfully');
      await refreshHospitalAdminCache(['departments']);
      if (search.trim()) {
        await loadDepartments();
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to delete department'));
    } finally {
      setDeleteTargetId(null);
    }
  });

  const handleDeleteDepartment = (id: string) => {
    setDeleteTargetId(id);
    openDeleteConfirm({ title: 'Delete Department', description: 'Are you sure you want to delete this department? This action cannot be undone.' });
  };

  const openEditDepartment = (department: DepartmentRecord) => {
    setEditingDepartment({
      _id: department._id,
      departmentName: department.departmentName,
      departmentHead: department.departmentHead,
      totalStaff: String(department.totalStaff),
    });
    setIsEditOpen(true);
  };

  const handleUpdateDepartment = async () => {
    if (!editingDepartment || !editingDepartment.departmentName || !editingDepartment.departmentHead || !editingDepartment.totalStaff) {
      toast.error('All department fields are required.');
      return;
    }
    try {
      await api.put(`/hospital-admin/departments/${editingDepartment._id}`, { ...editingDepartment, totalStaff: Number(editingDepartment.totalStaff) });
      toast.success('Department updated successfully');
      setEditingDepartment(null);
      setIsEditOpen(false);
      await refreshHospitalAdminCache(['departments']);
      if (search.trim()) {
        await loadDepartments();
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to update department'));
    }
  };

  return (
    <div className="mx-auto max-w-[1180px] space-y-6">
      <nav className="flex items-center gap-1.5 text-xs text-slate-500"><Link href="/" className="transition-colors hover:text-slate-900">Home</Link><span>/</span><Link href={getHospitalAdminPath()} className="transition-colors hover:text-slate-900">Hospital Admin</Link><span>/</span><span className="font-medium text-slate-900">Departments</span></nav>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div><h1 className="text-3xl font-semibold leading-none tracking-tight text-slate-950">Departments</h1><p className="mt-2 text-sm text-slate-500">Manage hospital departments, heads, and staffing overview.</p></div>
        <Button className="h-9 rounded-xl bg-primary px-4 text-sm text-white shadow-sm hover:bg-primary/90" onClick={() => setIsAddOpen(true)}><Plus size={16} className="mr-2" />Add Department</Button>
      </div>
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="rounded-2xl sm:max-w-[620px]">
          <DialogHeader><DialogTitle className="text-xl font-semibold">Add Department</DialogTitle><DialogDescription>Create a department with head and staff count details.</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2"><Label>Department Name</Label><Input value={departmentForm.departmentName} onChange={(e) => setDepartmentForm({ ...departmentForm, departmentName: e.target.value })} /></div>
            <div className="space-y-2"><Label>Department Head</Label><Input value={departmentForm.departmentHead} onChange={(e) => setDepartmentForm({ ...departmentForm, departmentHead: e.target.value })} /></div>
            <div className="space-y-2"><Label>Total Staff</Label><Input type="number" value={departmentForm.totalStaff} onChange={(e) => setDepartmentForm({ ...departmentForm, totalStaff: e.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button><Button onClick={handleCreateDepartment} className="bg-primary text-white hover:bg-primary/90">Save Department</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="rounded-2xl sm:max-w-[620px]">
          <DialogHeader><DialogTitle className="text-xl font-semibold">Edit Department</DialogTitle><DialogDescription>Update department details.</DialogDescription></DialogHeader>
          {editingDepartment ? <div className="grid gap-4 py-4">
            <div className="space-y-2"><Label>Department Name</Label><Input value={editingDepartment.departmentName} onChange={(e) => setEditingDepartment({ ...editingDepartment, departmentName: e.target.value })} /></div>
            <div className="space-y-2"><Label>Department Head</Label><Input value={editingDepartment.departmentHead} onChange={(e) => setEditingDepartment({ ...editingDepartment, departmentHead: e.target.value })} /></div>
            <div className="space-y-2"><Label>Total Staff</Label><Input type="number" value={editingDepartment.totalStaff} onChange={(e) => setEditingDepartment({ ...editingDepartment, totalStaff: e.target.value })} /></div>
          </div> : null}
          <DialogFooter><Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button><Button onClick={handleUpdateDepartment} className="bg-primary text-white hover:bg-primary/90">Save Changes</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="rounded-2xl border border-slate-200 py-0 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
        <CardHeader className="px-4 pt-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><CardTitle className="text-lg font-semibold text-slate-950">Department Directory</CardTitle><CardDescription>Search and review hospital departments</CardDescription></div><div className="relative w-full max-w-sm"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search department..." className="pl-9" /></div></div></CardHeader>
        <CardContent className="px-0 pb-0">
          <Table>
            <TableHeader className="bg-slate-50/70"><TableRow className="hover:bg-transparent"><TableHead className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Department</TableHead><TableHead className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Department Head</TableHead><TableHead className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Total Staff</TableHead><TableHead className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500 text-right">Action</TableHead></TableRow></TableHeader>
            <TableBody>
              {loading ? <TableRow><TableCell colSpan={4} className="px-4 py-10 text-center text-sm text-slate-500">Loading departments...</TableCell></TableRow> : departments.length === 0 ? <TableRow><TableCell colSpan={4} className="px-4 py-10 text-center text-sm text-slate-500">No departments found.</TableCell></TableRow> : departments.map((department) => (
                <TableRow key={department._id}>
                  <TableCell className="px-4 py-3"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-50 text-violet-600"><Building2 size={16} /></div><div><div className="text-xs font-semibold text-slate-950">{department.departmentName}</div></div></div></TableCell>
                  <TableCell className="px-4 py-3 text-xs text-slate-500">{department.departmentHead}</TableCell>
                  <TableCell className="px-4 py-3 text-xs text-slate-500">{department.totalStaff}</TableCell>
                  <TableCell className="px-4 py-3 text-right"><div className="flex items-center justify-end gap-2"><Button variant="outline" size="sm" className="h-8 rounded-lg px-3 text-xs" onClick={() => openEditDepartment(department)}><Pencil size={13} className="mr-1.5" />Edit</Button><Button variant="outline" size="sm" className="h-8 rounded-lg px-3 text-xs text-red-500 hover:text-red-500" onClick={() => handleDeleteDepartment(department._id)}><Trash2 size={13} className="mr-1.5" />Delete</Button></div></TableCell>
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
