'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  CalendarRange,
  CheckCircle2,
  Clock3,
  Search,
  Stethoscope,
  Loader2,
  CalendarClock,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import DoctorSlotsManageDialog from '@/components/doctors/doctor-slots-manage-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { NOTIFICATION_EVENT } from '@/components/dashboard/appointment-notification-bell';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getDoctorPath } from '@/lib/routes';

type AppointmentStatus = 'Scheduled' | 'Confirmed' | 'Completed' | 'Cancelled' | 'Admitted';
type PaymentStatus = 'Pending' | 'Paid';
type PaymentMethod = 'Cash' | 'Card' | 'UPI' | 'Insurance';

type DoctorAppointment = {
  _id: string;
  patientName: string;
  doctorName: string;
  department: string;
  appointmentDate: string;
  appointmentTime: string;
  status: AppointmentStatus;
  isAdmitted?: boolean;
  consultationFee: number;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  createdAt: string;
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

const statusFilters: Array<{ label: string; value: 'all' | AppointmentStatus }> = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'Scheduled' },
  { label: 'Approved', value: 'Confirmed' },
  { label: 'Completed', value: 'Completed' },
  { label: 'Disapproved', value: 'Cancelled' },
];

const actionMap: Array<{ label: string; value: AppointmentStatus; tone: string }> = [
  { label: 'Approve', value: 'Confirmed', tone: 'bg-emerald-600 hover:bg-emerald-700' },
  { label: 'Disapprove', value: 'Cancelled', tone: 'bg-red-600 hover:bg-red-700' },
  { label: 'Pending', value: 'Scheduled', tone: 'bg-amber-500 hover:bg-amber-600' },
  { label: 'Complete', value: 'Completed', tone: 'bg-slate-900 hover:bg-slate-800' },
];

const getErrorMessage = (error: unknown, fallback: string) => {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    return (error as { response?: { data?: { message?: string } } }).response?.data?.message || fallback;
  }
  return fallback;
};

const buildPatientCode = (value: string) => {
  const clean = String(value || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return `MW-${(clean.slice(-6) || '000000').padStart(6, '0')}`;
};

function StatusBadge({ status }: { status: AppointmentStatus }) {
  const styles: Record<AppointmentStatus, string> = {
    Scheduled: 'bg-amber-50 text-amber-700',
    Confirmed: 'bg-emerald-50 text-emerald-700',
    Completed: 'bg-slate-100 text-slate-700',
    Cancelled: 'bg-red-50 text-red-600',
    Admitted: 'bg-teal-50 text-teal-700',
  };

  const labels: Record<AppointmentStatus, string> = {
    Scheduled: 'Pending',
    Confirmed: 'Approved',
    Completed: 'Completed',
    Cancelled: 'Disapproved',
    Admitted: 'Admitted',
  };

  return (
    <Badge variant="secondary" className={`rounded-full px-2.5 py-1 text-xs font-semibold ${styles[status]}`}>
      {labels[status]}
    </Badge>
  );
}

export default function DoctorAppointmentsPage() {
  const [appointments, setAppointments] = useState<DoctorAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | AppointmentStatus>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [isSlotOpen, setIsSlotOpen] = useState(false);

  const loadAppointments = useCallback(async (nextSearch = search, nextStatus = statusFilter) => {
    try {
      setLoading(true);
      const response = await api.get('/doctor/appointments', {
        params: {
          ...(nextSearch.trim() ? { search: nextSearch.trim() } : {}),
          ...(nextStatus !== 'all' ? { status: nextStatus } : {}),
        },
      });
      setAppointments(response.data?.data || []);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to load appointments'));
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadAppointments(search, statusFilter);
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [loadAppointments, search, statusFilter]);

  useEffect(() => {
    const handleAppointmentNotification = () => {
      void loadAppointments(search, statusFilter);
    };

    window.addEventListener(NOTIFICATION_EVENT, handleAppointmentNotification);
    return () => window.removeEventListener(NOTIFICATION_EVENT, handleAppointmentNotification);
  }, [loadAppointments, search, statusFilter]);

  const todaySchedule = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return appointments.filter((appointment) => {
      const date = new Date(appointment.appointmentDate);
      return date >= today && date < tomorrow;
    });
  }, [appointments]);

  const scheduleStats = useMemo(() => {
    const approved = appointments.filter((appointment) => appointment.status === 'Confirmed').length;
    const pending = appointments.filter((appointment) => appointment.status === 'Scheduled').length;
    const completed = appointments.filter((appointment) => appointment.status === 'Completed').length;

    return { approved, pending, completed };
  }, [appointments]);

  const updateStatus = async (id: string, status: AppointmentStatus) => {
    try {
      setUpdatingId(id);
      await api.patch(`/doctor/appointments/${id}/status`, { status });
      toast.success('Appointment status updated');
      await loadAppointments();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to update appointment status'));
    } finally {
      setUpdatingId(null);
    }
  };



  return (
    <div className="mx-auto max-w-[1180px] space-y-4">
      <nav className="flex items-center gap-1.5 text-xs text-slate-500">
        <Link href="/" className="transition-colors hover:text-slate-900">
          Home
        </Link>
        <span>/</span>
        <span className="font-medium text-slate-900">Appointment</span>
      </nav>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Appointment</h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Doctor workflow for schedule review and appointment list actions.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button className="h-10 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold shadow-sm" onClick={() => setIsSlotOpen(true)}>
            <CalendarClock size={16} className="mr-2" />
            Slots & Leave Settings
          </Button>
          <Link href={getDoctorPath('/my-patients')}>
            <Button className="h-10 rounded-xl bg-primary px-4 text-white hover:bg-primary/90">
              <Stethoscope size={16} className="mr-2" />
              Open patient flow
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <Card className="rounded-3xl border border-slate-200 py-0 shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
          <CardHeader className="px-5 pt-5">
            <CardTitle className="text-lg font-semibold text-slate-950">Schedule</CardTitle>
            <CardDescription>Today’s doctor schedule and queue summary</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 px-5 pb-5 pt-0">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-2 text-slate-900">
                  <CalendarRange size={16} className="text-primary" />
                  <span className="text-sm font-semibold">Today</span>
                </div>
                <p className="mt-3 text-3xl font-semibold text-slate-950">{todaySchedule.length}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-2 text-slate-900">
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  <span className="text-sm font-semibold">Approved</span>
                </div>
                <p className="mt-3 text-3xl font-semibold text-slate-950">{scheduleStats.approved}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-2 text-slate-900">
                  <Clock3 size={16} className="text-amber-600" />
                  <span className="text-sm font-semibold">Pending</span>
                </div>
                <p className="mt-3 text-3xl font-semibold text-slate-950">{scheduleStats.pending}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-950">Today’s schedule</h3>
                <Badge variant="secondary" className="rounded-full bg-slate-100 text-slate-700">
                  Completed: {scheduleStats.completed}
                </Badge>
              </div>
              <div className="space-y-3">
                {todaySchedule.length === 0 ? (
                  <p className="text-sm text-slate-500">No appointments scheduled for today.</p>
                ) : (
                  todaySchedule.slice(0, 5).map((appointment) => (
                    <div key={appointment._id} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-0.5 min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-950 truncate">{appointment.patientName}</p>
                          {appointment.patientRecordId?._id && (
                            <p className="text-[10px] font-mono text-slate-400">ID: {buildPatientCode(appointment.patientUserId || appointment.patientRecordId._id)}</p>
                          )}
                          {appointment.patientEmail && (
                            <p className="text-xs text-slate-500 truncate">{appointment.patientEmail}</p>
                          )}
                          <p className="text-xs text-slate-500 font-medium">{appointment.department}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-slate-950">{appointment.appointmentTime}</p>
                          <div className="mt-2">
                            <StatusBadge status={appointment.status} />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border border-slate-200 py-0 shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
          <CardHeader className="px-5 pt-5">
            <CardTitle className="text-lg font-semibold text-slate-950">Appointment list</CardTitle>
            <CardDescription>Approve, disapprove, keep pending, or complete appointments</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 px-5 pb-5 pt-0">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative w-full max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search patient, department, or time"
                  className="h-10 rounded-xl border-gray-200 bg-gray-50 pl-9"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {statusFilters.map((filter) => (
                  <Button
                    key={filter.value}
                    type="button"
                    variant={statusFilter === filter.value ? 'default' : 'outline'}
                    className={`rounded-full ${statusFilter === filter.value ? 'bg-primary text-white hover:bg-primary/90' : 'border-slate-200'}`}
                    onClick={() => setStatusFilter(filter.value)}
                  >
                    {filter.label}
                  </Button>
                ))}
              </div>
            </div>

            <Table>
              <TableHeader className="bg-slate-50/70">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Patient</TableHead>
                  <TableHead className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Schedule</TableHead>
                  <TableHead className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Status</TableHead>
                  <TableHead className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Payment</TableHead>
                  <TableHead className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-500">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500">
                      Loading appointments...
                    </TableCell>
                  </TableRow>
                ) : appointments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500">
                      No appointments found.
                    </TableCell>
                  </TableRow>
                ) : (
                  appointments.map((appointment) => (
                    <TableRow key={appointment._id}>
                      <TableCell className="px-4 py-3">
                        <div className="space-y-1">
                          <div className="text-sm font-semibold text-slate-950">{appointment.patientName}</div>
                          {appointment.patientRecordId?._id && (
                            <div className="text-[10px] font-mono text-slate-400">
                              ID: {buildPatientCode(appointment.patientUserId || appointment.patientRecordId._id)}
                            </div>
                          )}
                          <div className="text-xs font-medium text-slate-600">{appointment.department}</div>
                          {(appointment.patientPhone || appointment.patientEmail) && (
                            <div className="text-xs text-slate-500">
                              {appointment.patientPhone && <span>{appointment.patientPhone}</span>}
                              {appointment.patientPhone && appointment.patientEmail && <span className="mx-1.5 text-slate-300">•</span>}
                              {appointment.patientEmail && <span className="break-all">{appointment.patientEmail}</span>}
                            </div>
                          )}
                          {appointment.patientRecordId && (appointment.patientRecordId.age || appointment.patientRecordId.gender || appointment.patientRecordId.bloodGroup) && (
                            <div className="text-xs text-slate-400">
                              {[
                                appointment.patientRecordId.age ? `${appointment.patientRecordId.age} yrs` : null,
                                appointment.patientRecordId.gender,
                                appointment.patientRecordId.bloodGroup ? `Blood: ${appointment.patientRecordId.bloodGroup}` : null,
                              ].filter(Boolean).join(' • ')}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-xs text-slate-500">
                        {new Date(appointment.appointmentDate).toLocaleDateString()} at {appointment.appointmentTime}
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <StatusBadge status={appointment.status} />
                      </TableCell>
                      <TableCell className="px-4 py-3 text-xs text-slate-500">
                        {appointment.paymentStatus} / Rs. {appointment.consultationFee}
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <div className="flex flex-wrap justify-end gap-2 items-center">
                          {actionMap.map((action) => (
                            <Button
                              key={action.value}
                              type="button"
                              className={`h-8 rounded-lg px-3 text-xs text-white ${action.tone}`}
                              disabled={updatingId === appointment._id}
                              onClick={() => void updateStatus(appointment._id, action.value)}
                            >
                              {action.label}
                            </Button>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
      <DoctorSlotsManageDialog
        isOpen={isSlotOpen}
        onClose={() => setIsSlotOpen(false)}
        doctorId=""
        doctorName="My Profile"
        isDoctor={true}
      />
    </div>
  );
}
