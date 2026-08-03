
'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarClock, CreditCard, Pencil, Plus, Search, Trash2, Bed, Loader2 } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { NOTIFICATION_EVENT } from '@/components/dashboard/appointment-notification-bell';
import { useHospitalWorkspace } from '@/contexts/hospital-workspace-context';

type AppointmentStatus = 'Scheduled' | 'Confirmed' | 'Completed' | 'Cancelled' | 'Admitted';
type PaymentStatus = 'Pending' | 'Paid';
type PaymentMethod = 'Cash' | 'Card' | 'UPI' | 'Insurance';
type AppointmentForm = { patientName: string; doctorName: string; department: string; appointmentDate: string; appointmentTime: string; status: AppointmentStatus; consultationFee: string };
type PaymentForm = { amount: string; method: PaymentMethod; paymentStatus: PaymentStatus };
type AppointmentRecord = {
  _id: string;
  patientName: string;
  doctorName: string;
  department?: string;
  appointmentDate: string;
  appointmentTime?: string;
  status: AppointmentStatus;
  isAdmitted?: boolean;
  consultationFee?: number;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  patientEmail?: string;
  patientPhone?: string;
  patientRecordId?: {
    _id: string;
    age?: number | null;
    gender?: string | null;
    bloodGroup?: string | null;
  } | null;
  patientUserId?: string | null;
};

const emptyAppointmentForm: AppointmentForm = { patientName: '', doctorName: '', department: '', appointmentDate: '', appointmentTime: '', status: 'Scheduled', consultationFee: '' };
const getErrorMessage = (error: unknown, fallback: string) => typeof error === 'object' && error !== null && 'response' in error ? ((error as { response?: { data?: { message?: string } } }).response?.data?.message || fallback) : fallback;

function StatusBadge({ status }: { status: AppointmentStatus }) {
  const styles: Record<AppointmentStatus, string> = {
    Scheduled: 'bg-blue-50 text-primary hover:bg-blue-50',
    Confirmed: 'bg-emerald-50 text-emerald-600 hover:bg-emerald-50',
    Completed: 'bg-slate-100 text-slate-700 hover:bg-slate-100',
    Cancelled: 'bg-red-50 text-red-500 hover:bg-red-50',
    Admitted: 'bg-teal-50 text-teal-600 hover:bg-teal-50',
  };
  return <Badge variant="secondary" className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${styles[status]}`}>{status}</Badge>;
}

function PaymentBadge({ status }: { status: PaymentStatus }) {
  return <Badge variant="secondary" className={status === 'Paid' ? 'rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-600 hover:bg-emerald-50' : 'rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-600 hover:bg-amber-50'}>{status}</Badge>;
}

const buildPatientCode = (value: string) => {
  const clean = String(value || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return `MW-${(clean.slice(-6) || '000000').padStart(6, '0')}`;
};

export default function HospitalAdminAppointmentsPage() {
  const workspace = useHospitalWorkspace();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isAdmitOpen, setIsAdmitOpen] = useState(false);
  const [appointmentForm, setAppointmentForm] = useState<AppointmentForm>(emptyAppointmentForm);
  const [editingAppointment, setEditingAppointment] = useState<AppointmentRecord | null>(null);
  const [paymentTarget, setPaymentTarget] = useState<AppointmentRecord | null>(null);
  const [paymentForm, setPaymentForm] = useState<PaymentForm>({ amount: '', method: 'Cash', paymentStatus: 'Paid' });
  const [admitTarget, setAdmitTarget] = useState<AppointmentRecord | null>(null);
  const [admitForm, setAdmitForm] = useState({
    admissionReason: '',
    roomNumber: '',
    bedNumber: '',
    notes: '',
  });
  const [admitting, setAdmitting] = useState(false);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  const syncAppointments = useCallback(async (query?: string) => {
    try {
      const hasCache = !query && !!getHospitalAdminCacheData<AppointmentRecord[]>('appointments');
      if (!hasCache) {
        setLoading(true);
      }
      const response = await api.get('/hospital-admin/appointments', { params: query ? { search: query } : undefined });
      const nextAppointments = response.data?.data || [];
      setAppointments(nextAppointments);

      if (!query) {
        setHospitalAdminCacheData('appointments', nextAppointments);
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to load appointments'));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAppointments = useCallback(async () => {
    await syncAppointments(debouncedSearch.trim());
  }, [debouncedSearch, syncAppointments]);

  useEffect(() => {
    const handleCacheUpdate = () => {
      if (debouncedSearch.trim()) return;
      const nextAppointments = getHospitalAdminCacheData<AppointmentRecord[]>('appointments');
      if (nextAppointments) {
        setAppointments(nextAppointments);
        setLoading(false);
      }
    };

    window.addEventListener(HOSPITAL_ADMIN_CACHE_EVENT, handleCacheUpdate);
    return () => window.removeEventListener(HOSPITAL_ADMIN_CACHE_EVENT, handleCacheUpdate);
  }, [debouncedSearch]);

  useEffect(() => {
    const nextAppointments = getHospitalAdminCacheData<AppointmentRecord[]>('appointments');
    if (nextAppointments) {
      setAppointments(nextAppointments);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAppointments();
  }, [loadAppointments]);

  const refreshAppointmentsAndDashboard = useCallback(async () => {
    const cacheKeys = workspace.canViewDashboard
      ? (['appointments', 'dashboard'] as const)
      : (['appointments'] as const);
    await refreshHospitalAdminCache([...cacheKeys]);
    if (debouncedSearch.trim()) {
      await loadAppointments();
    }
  }, [loadAppointments, debouncedSearch, workspace.canViewDashboard]);

  const filteredAppointments = appointments.filter((app) => {
    if (statusFilter !== 'all' && app.status !== statusFilter) return false;
    if (paymentFilter !== 'all' && app.paymentStatus !== paymentFilter) return false;
    return true;
  });

  useEffect(() => {
    const handleAppointmentNotification = () => {
      void refreshAppointmentsAndDashboard();
    };

    window.addEventListener(NOTIFICATION_EVENT, handleAppointmentNotification);
    return () => window.removeEventListener(NOTIFICATION_EVENT, handleAppointmentNotification);
  }, [refreshAppointmentsAndDashboard]);

  const handleCreateAppointment = async () => {
    if (!appointmentForm.patientName || !appointmentForm.doctorName || !appointmentForm.appointmentDate) {
      toast.error('Patient name, doctor name, and appointment date are required.');
      return;
    }
    try {
      await api.post('/hospital-admin/appointments', { ...appointmentForm, consultationFee: appointmentForm.consultationFee ? Number(appointmentForm.consultationFee) : undefined });
      toast.success('Appointment created successfully');
      setAppointmentForm(emptyAppointmentForm);
      setIsAddOpen(false);
      await refreshAppointmentsAndDashboard();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to create appointment'));
    }
  };

  const handleUpdateAppointment = async () => {
    if (!editingAppointment) return;
    try {
      await api.put(`/hospital-admin/appointments/${editingAppointment._id}`, {
        ...editingAppointment,
        consultationFee: editingAppointment.consultationFee ? Number(editingAppointment.consultationFee) : 0,
      });
      toast.success('Appointment updated successfully');
      setEditingAppointment(null);
      setIsEditOpen(false);
      await refreshAppointmentsAndDashboard();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to update appointment'));
    }
  };

  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const { dialogProps: deleteDialogProps, openConfirm: openDeleteConfirm } = useConfirmDelete(async () => {
    if (!deleteTargetId) return;
    try {
      await api.delete(`/hospital-admin/appointments/${deleteTargetId}`);
      toast.success('Appointment deleted successfully');
      await refreshAppointmentsAndDashboard();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to delete appointment'));
    } finally {
      setDeleteTargetId(null);
    }
  });

  const handleDeleteAppointment = (id: string) => {
    setDeleteTargetId(id);
    openDeleteConfirm({ title: 'Delete Appointment', description: 'Are you sure you want to delete this appointment? This action cannot be undone.' });
  };

  const openPaymentDialog = (appointment: AppointmentRecord) => {
    setPaymentTarget(appointment);
    setPaymentForm({
      amount: String(appointment.consultationFee || 0),
      method: appointment.paymentMethod,
      paymentStatus: appointment.paymentStatus,
    });
    setIsPaymentOpen(true);
  };

  const handleSavePayment = async () => {
    if (!paymentTarget) return;
    try {
      await api.patch(`/hospital-admin/appointments/${paymentTarget._id}/payment`, {
        amount: Number(paymentForm.amount),
        method: paymentForm.method,
        paymentStatus: paymentForm.paymentStatus,
      });
      toast.success('Appointment payment updated successfully');
      setPaymentTarget(null);
      setIsPaymentOpen(false);
      await refreshAppointmentsAndDashboard();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to update payment'));
    }
  };

  const handleAdmitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!admitTarget) return;

    if (!admitForm.admissionReason.trim()) {
      toast.error('Admission reason is required.');
      return;
    }

    try {
      setAdmitting(true);
      await api.post('/hospital-admin/admissions', {
        appointmentId: admitTarget._id,
        admissionReason: admitForm.admissionReason.trim(),
        roomNumber: admitForm.roomNumber.trim() || undefined,
        bedNumber: admitForm.bedNumber.trim() || undefined,
        notes: admitForm.notes.trim() || undefined,
      });

      toast.success('Patient admitted successfully.');
      setIsAdmitOpen(false);
      setAdmitTarget(null);
      setAdmitForm({ admissionReason: '', roomNumber: '', bedNumber: '', notes: '' });
      await refreshAppointmentsAndDashboard();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to admit patient.'));
    } finally {
      setAdmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1180px] space-y-6">
      <nav className="flex items-center gap-1.5 text-xs text-slate-500"><Link href="/" className="transition-colors hover:text-slate-900">Home</Link><span>/</span><Link href={workspace.homePath} className="transition-colors hover:text-slate-900">{workspace.portalLabel}</Link><span>/</span><span className="font-medium text-slate-900">Appointments</span></nav>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div><h1 className="text-3xl font-semibold leading-none tracking-tight text-slate-950">Appointments</h1><p className="mt-2 text-sm text-slate-500">Create, edit, delete, and manage appointment payments in one place.</p></div>
        <Button className="h-9 rounded-xl bg-primary px-4 text-sm text-white shadow-sm hover:bg-primary/90" onClick={() => setIsAddOpen(true)}><Plus size={16} className="mr-2" />Add Appointment</Button>
      </div>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="rounded-2xl sm:max-w-[680px]">
          <DialogHeader><DialogTitle className="text-xl font-semibold">Add Appointment</DialogTitle><DialogDescription>Create a new appointment and capture consultation fee details.</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-4 sm:grid-cols-2">
            <div className="space-y-2"><Label>Patient Name</Label><Input value={appointmentForm.patientName} onChange={(e) => setAppointmentForm({ ...appointmentForm, patientName: e.target.value })} /></div>
            <div className="space-y-2"><Label>Doctor Name</Label><Input value={appointmentForm.doctorName} onChange={(e) => setAppointmentForm({ ...appointmentForm, doctorName: e.target.value })} /></div>
            <div className="space-y-2"><Label>Department</Label><Input value={appointmentForm.department} onChange={(e) => setAppointmentForm({ ...appointmentForm, department: e.target.value })} /></div>
            <div className="space-y-2"><Label>Status</Label><Select value={appointmentForm.status} onValueChange={(value) => setAppointmentForm({ ...appointmentForm, status: value as AppointmentStatus })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Scheduled">Scheduled</SelectItem><SelectItem value="Confirmed">Confirmed</SelectItem><SelectItem value="Completed">Completed</SelectItem><SelectItem value="Cancelled">Cancelled</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>Appointment Date</Label><Input type="date" value={appointmentForm.appointmentDate} onChange={(e) => setAppointmentForm({ ...appointmentForm, appointmentDate: e.target.value })} /></div>
            <div className="space-y-2"><Label>Appointment Time</Label><Input type="time" value={appointmentForm.appointmentTime} onChange={(e) => setAppointmentForm({ ...appointmentForm, appointmentTime: e.target.value })} /></div>
            <div className="space-y-2 sm:col-span-2"><Label>Consultation Fee</Label><Input type="number" value={appointmentForm.consultationFee} onChange={(e) => setAppointmentForm({ ...appointmentForm, consultationFee: e.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button><Button onClick={handleCreateAppointment} className="bg-primary text-white hover:bg-primary/90">Save Appointment</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="rounded-2xl border border-slate-200 py-0 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
        <CardHeader className="px-4 pt-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="text-lg font-semibold text-slate-950">Appointment Directory</CardTitle>
              <CardDescription>Search appointments and manage status, edits, and payments</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
              <div className="relative flex-1 min-w-[200px] lg:max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search appointment..."
                  className="pl-9 text-xs h-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val || 'all')}>
                <SelectTrigger className="w-[140px] text-xs h-9">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="Scheduled">Scheduled</SelectItem>
                  <SelectItem value="Confirmed">Confirmed</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                  <SelectItem value="Cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <Select value={paymentFilter} onValueChange={(val) => setPaymentFilter(val || 'all')}>
                <SelectTrigger className="w-[140px] text-xs h-9">
                  <SelectValue placeholder="Payment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Payments</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <Table>
            <TableHeader className="bg-slate-50/70">
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Appointment</TableHead>
                <TableHead className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Doctor</TableHead>
                <TableHead className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Schedule</TableHead>
                <TableHead className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Status</TableHead>
                <TableHead className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Payment</TableHead>
                <TableHead className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">Loading appointments...</TableCell>
                </TableRow>
              ) : filteredAppointments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">No appointments found.</TableCell>
                </TableRow>
              ) : (
                filteredAppointments.map((appointment) => (
                  <TableRow key={appointment._id}>
                    <TableCell className="px-4 py-3">
                      <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-primary mt-0.5 shrink-0">
                          <CalendarClock size={16} />
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs font-semibold text-slate-950">{appointment.patientName}</div>
                          {appointment.patientRecordId?._id && (
                            <div className="text-[10px] font-mono text-slate-400">
                              ID: {buildPatientCode(appointment.patientUserId || appointment.patientRecordId._id)}
                            </div>
                          )}
                          <div className="text-[11px] font-medium text-slate-600">{appointment.department || '-'}</div>
                          {(appointment.patientPhone || appointment.patientEmail) && (
                            <div className="text-[11px] text-slate-500">
                              {appointment.patientPhone && <span>{appointment.patientPhone}</span>}
                              {appointment.patientPhone && appointment.patientEmail && <span className="mx-1 text-slate-300">•</span>}
                              {appointment.patientEmail && <span className="break-all">{appointment.patientEmail}</span>}
                            </div>
                          )}
                          {appointment.patientRecordId && (appointment.patientRecordId.age || appointment.patientRecordId.gender || appointment.patientRecordId.bloodGroup) && (
                            <div className="text-[11px] text-slate-400">
                              {[
                                appointment.patientRecordId.age ? `${appointment.patientRecordId.age} yrs` : null,
                                appointment.patientRecordId.gender,
                                appointment.patientRecordId.bloodGroup ? `Blood: ${appointment.patientRecordId.bloodGroup}` : null,
                              ].filter(Boolean).join(' • ')}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-xs text-slate-500">{appointment.doctorName}</TableCell>
                    <TableCell className="px-4 py-3 text-xs text-slate-500">{new Date(appointment.appointmentDate).toISOString().split('T')[0]} at {appointment.appointmentTime || '--:--'}</TableCell>
                    <TableCell className="px-4 py-3"><StatusBadge status={appointment.status} /></TableCell>
                    <TableCell className="px-4 py-3"><div className="flex flex-col gap-1"><PaymentBadge status={appointment.paymentStatus} /><span className="text-[11px] text-slate-500">Rs. {appointment.consultationFee || 0} via {appointment.paymentMethod}</span></div></TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {(appointment.status === 'Scheduled' || appointment.status === 'Confirmed') && !appointment.isAdmitted && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-lg px-3 text-xs border-teal-200 bg-teal-50 text-teal-600 hover:bg-teal-100 hover:text-teal-700"
                            onClick={() => {
                              setAdmitTarget(appointment);
                              setAdmitForm({ admissionReason: '', roomNumber: '', bedNumber: '', notes: '' });
                              setIsAdmitOpen(true);
                            }}
                          >
                            <Bed size={13} className="mr-1.5" />
                            Admit
                          </Button>
                        )}
                        <Button variant="outline" size="sm" className="h-8 rounded-lg px-3 text-xs" onClick={() => { setEditingAppointment(appointment); setIsEditOpen(true); }}><Pencil size={13} className="mr-1.5" />Edit</Button>
                        <Button variant="outline" size="sm" className="h-8 rounded-lg px-3 text-xs" onClick={() => openPaymentDialog(appointment)}><CreditCard size={13} className="mr-1.5" />Payment</Button>
                        <Button variant="outline" size="sm" className="h-8 rounded-lg px-3 text-xs text-red-500 hover:text-red-500" onClick={() => handleDeleteAppointment(appointment._id)}><Trash2 size={13} className="mr-1.5" />Delete</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="rounded-2xl sm:max-w-[680px]">
          <DialogHeader><DialogTitle className="text-xl font-semibold">Edit Appointment</DialogTitle><DialogDescription>Update appointment details and current status.</DialogDescription></DialogHeader>
          {editingAppointment ? <div className="grid gap-4 py-4 sm:grid-cols-2">
            <div className="space-y-2"><Label>Patient Name</Label><Input value={editingAppointment.patientName} onChange={(e) => setEditingAppointment({ ...editingAppointment, patientName: e.target.value })} /></div>
            <div className="space-y-2"><Label>Doctor Name</Label><Input value={editingAppointment.doctorName} onChange={(e) => setEditingAppointment({ ...editingAppointment, doctorName: e.target.value })} /></div>
            <div className="space-y-2"><Label>Department</Label><Input value={editingAppointment.department || ''} onChange={(e) => setEditingAppointment({ ...editingAppointment, department: e.target.value })} /></div>
            <div className="space-y-2"><Label>Status</Label><Select value={editingAppointment.status} onValueChange={(value) => setEditingAppointment({ ...editingAppointment, status: value as AppointmentStatus })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Scheduled">Scheduled</SelectItem><SelectItem value="Confirmed">Confirmed</SelectItem><SelectItem value="Completed">Completed</SelectItem><SelectItem value="Cancelled">Cancelled</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>Appointment Date</Label><Input type="date" value={new Date(editingAppointment.appointmentDate).toISOString().split('T')[0]} onChange={(e) => setEditingAppointment({ ...editingAppointment, appointmentDate: e.target.value })} /></div>
            <div className="space-y-2"><Label>Appointment Time</Label><Input type="time" value={editingAppointment.appointmentTime || ''} onChange={(e) => setEditingAppointment({ ...editingAppointment, appointmentTime: e.target.value })} /></div>
            <div className="space-y-2 sm:col-span-2"><Label>Consultation Fee</Label><Input type="number" value={editingAppointment.consultationFee || 0} onChange={(e) => setEditingAppointment({ ...editingAppointment, consultationFee: Number(e.target.value) })} /></div>
          </div> : null}
          <DialogFooter><Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button><Button onClick={handleUpdateAppointment} className="bg-primary text-white hover:bg-primary/90">Save Changes</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
        <DialogContent className="rounded-2xl sm:max-w-[520px]">
          <DialogHeader><DialogTitle className="text-xl font-semibold">Appointment Payment</DialogTitle><DialogDescription>Add or update payment details for this appointment.</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2"><Label>Amount</Label><Input type="number" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} /></div>
            <div className="space-y-2"><Label>Payment Method</Label><Select value={paymentForm.method} onValueChange={(value) => setPaymentForm({ ...paymentForm, method: value as PaymentMethod })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Cash">Cash</SelectItem><SelectItem value="Card">Card</SelectItem><SelectItem value="UPI">UPI</SelectItem><SelectItem value="Insurance">Insurance</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>Payment Status</Label><Select value={paymentForm.paymentStatus} onValueChange={(value) => setPaymentForm({ ...paymentForm, paymentStatus: value as PaymentStatus })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Pending">Pending</SelectItem><SelectItem value="Paid">Paid</SelectItem></SelectContent></Select></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setIsPaymentOpen(false)}>Cancel</Button><Button onClick={handleSavePayment} className="bg-primary text-white hover:bg-primary/90">Save Payment</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAdmitOpen} onOpenChange={setIsAdmitOpen}>
        <DialogContent className="rounded-2xl sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Admit Patient</DialogTitle>
            <DialogDescription>
              Admit {admitTarget?.patientName} to the hospital. A new admission record will be created.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void handleAdmitSubmit(e)} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="admit-reason">Reason for Admission *</Label>
              <Input
                id="admit-reason"
                value={admitForm.admissionReason}
                onChange={(e) => setAdmitForm({ ...admitForm, admissionReason: e.target.value })}
                placeholder="e.g. Scheduled surgery, high fever, observation"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="admit-room">Ward / Room Number</Label>
                <Input
                  id="admit-room"
                  value={admitForm.roomNumber}
                  onChange={(e) => setAdmitForm({ ...admitForm, roomNumber: e.target.value })}
                  placeholder="e.g. Ward 3B, Room 304"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="admit-bed">Bed Number</Label>
                <Input
                  id="admit-bed"
                  value={admitForm.bedNumber}
                  onChange={(e) => setAdmitForm({ ...admitForm, bedNumber: e.target.value })}
                  placeholder="e.g. Bed-1, Bed-A"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="admit-notes">Admission Notes</Label>
              <Textarea
                id="admit-notes"
                value={admitForm.notes}
                onChange={(e) => setAdmitForm({ ...admitForm, notes: e.target.value })}
                placeholder="Additional instructions or notes..."
                rows={3}
              />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsAdmitOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={admitting} className="bg-primary text-white hover:bg-primary/90">
                {admitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm Admission
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDeleteDialog {...deleteDialogProps} />
    </div>
  );
}
