'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts';
import {
  CalendarClock,
  CircleDollarSign,
  ClipboardList,
  FilePlus2,
  FlaskConical,
  HeartPulse,
  Stethoscope,
  UsersRound,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getDoctorPath } from '@/lib/routes';

type DoctorDashboardResponse = {
  doctorProfile: {
    name: string;
    email: string;
    hospitalName: string;
    specialization: string;
    department: string;
    qualification: string;
    availableTime: string;
    consultationFee: number;
  };
  stats: {
    totalPatients: number;
    appointmentsToday: number;
    completedAppointments: number;
    confirmedAppointments: number;
    pendingReviews: number;
    completionRate: number;
    paidRevenue: number;
  };
  monthlyVisits: { month: string; visits: number }[];
  weeklySchedule: { day: string; appointments: number }[];
  upcomingAppointments: {
    _id: string;
    patientName: string;
    department: string;
    appointmentDate: string;
    appointmentTime: string;
    status: 'Scheduled' | 'Confirmed' | 'Completed' | 'Cancelled';
    paymentStatus: 'Pending' | 'Paid';
  }[];
};

const defaultDashboard: DoctorDashboardResponse = {
  doctorProfile: {
    name: 'Doctor',
    email: 'doctor@medkwik.com',
    hospitalName: 'Assigned Hospital',
    specialization: 'General Practice',
    department: 'General Medicine',
    qualification: 'Medical Practitioner',
    availableTime: 'Schedule not updated',
    consultationFee: 0,
  },
  stats: {
    totalPatients: 0,
    appointmentsToday: 0,
    completedAppointments: 0,
    confirmedAppointments: 0,
    pendingReviews: 0,
    completionRate: 0,
    paidRevenue: 0,
  },
  monthlyVisits: [],
  weeklySchedule: [],
  upcomingAppointments: [],
};

const quickActions = [
  {
    label: 'Appointments',
    description: 'Review and prepare for scheduled consultations',
    href: getDoctorPath('/appointments'),
    icon: CalendarClock,
    tone: 'bg-blue-50 text-primary',
  },
  {
    label: 'Prescriptions',
    description: 'Issue and manage treatment instructions',
    href: getDoctorPath('/prescription'),
    icon: FilePlus2,
    tone: 'bg-emerald-50 text-emerald-600',
  },
  {
    label: 'Lab Results',
    description: 'Check pending reviews and follow-up actions',
    href: getDoctorPath('/lab-results'),
    icon: FlaskConical,
    tone: 'bg-amber-50 text-amber-600',
  },
];

const getErrorMessage = (error: unknown, fallback: string) => {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    return (error as { response?: { data?: { message?: string } } }).response?.data?.message || fallback;
  }
  return fallback;
};

function DoctorStatCard({
  icon: Icon,
  value,
  label,
  tone,
}: {
  icon: React.ComponentType<{ className?: string; size?: number }>;
  value: string;
  label: string;
  tone: string;
}) {
  return (
    <Card className="rounded-2xl border border-slate-200 py-0 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
      <CardHeader className="px-4 pt-4">
        <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${tone}`}>
          <Icon size={18} />
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-1">
        <div className="text-[1.7rem] font-semibold tracking-tight text-slate-950">{value}</div>
        <div className="mt-0.5 text-xs text-slate-500">{label}</div>
      </CardContent>
    </Card>
  );
}

function AppointmentStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Confirmed: 'bg-emerald-50 text-emerald-600 hover:bg-emerald-50',
    Scheduled: 'bg-blue-50 text-primary hover:bg-blue-50',
    Completed: 'bg-slate-100 text-slate-700 hover:bg-slate-100',
    Cancelled: 'bg-red-50 text-red-500 hover:bg-red-50',
  };

  return (
    <Badge
      variant="secondary"
      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${styles[status] || 'bg-slate-100 text-slate-700'}`}
    >
      {status}
    </Badge>
  );
}

export function DoctorDashboard() {
  const [dashboard, setDashboard] = useState<DoctorDashboardResponse>(defaultDashboard);
  const [loading, setLoading] = useState(true);
  const [showCharts, setShowCharts] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setShowCharts(true);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void (async () => {
        try {
          setLoading(true);
          const response = await api.get('/doctor/dashboard');
          setDashboard(response.data?.data || defaultDashboard);
        } catch (error) {
          toast.error(getErrorMessage(error, 'Failed to load doctor dashboard'));
          setDashboard(defaultDashboard);
        } finally {
          setLoading(false);
        }
      })();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  const firstName = dashboard.doctorProfile.name.split(' ')[0] || 'Doctor';

  return (
    <div className="mx-auto max-w-[1180px] space-y-4">
      <nav className="flex items-center gap-1.5 text-xs text-slate-500">
        <Link href="/" className="transition-colors hover:text-slate-900">
          Home
        </Link>
        <span>/</span>
        <span className="font-medium text-slate-900">Doctor</span>
      </nav>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
            Good day, Dr. {firstName}
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Track your consultations, patient flow, and next clinical actions from one place.
          </p>
        </div>
        <Link href={getDoctorPath('/prescription')}>
          <Button className="h-10 rounded-xl bg-primary px-4 text-white hover:bg-primary/90">
            <FilePlus2 size={16} className="mr-2" />
            New prescription
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_0.9fr]">
        <Card className="rounded-3xl border border-slate-200 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.12),transparent_42%),linear-gradient(135deg,#ffffff_0%,#f8fbff_100%)] py-0 shadow-[0_14px_36px_rgba(15,23,42,0.05)]">
          <CardContent className="grid gap-5 px-5 py-5 md:grid-cols-[1.2fr_0.8fr]">
            <div>
              <Badge variant="secondary" className="rounded-full bg-white/80 px-3 py-1 text-primary">
                {dashboard.doctorProfile.specialization}
              </Badge>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
                {dashboard.doctorProfile.name}
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                {dashboard.doctorProfile.department} at {dashboard.doctorProfile.hospitalName}
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/70 bg-white/80 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Qualification</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">{dashboard.doctorProfile.qualification}</p>
                </div>
                <div className="rounded-2xl border border-white/70 bg-white/80 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Available hours</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">{dashboard.doctorProfile.availableTime}</p>
                </div>
              </div>
            </div>
            <div className="grid gap-3">
              <div className="rounded-2xl border border-slate-200 bg-white/90 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Completion rate</p>
                <div className="mt-2 text-3xl font-semibold text-slate-950">
                  {dashboard.stats.completionRate}%
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Based on completed consultations in your current schedule data.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/90 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Consultation fee</p>
                <div className="mt-2 text-3xl font-semibold text-slate-950">
                  Rs. {dashboard.doctorProfile.consultationFee}
                </div>
                <p className="mt-1 text-xs text-slate-500">{dashboard.doctorProfile.email}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border border-slate-200 py-0 shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
          <CardHeader className="px-5 pt-5">
            <CardTitle className="text-lg font-semibold text-slate-950">Quick actions</CardTitle>
            <CardDescription>Common tasks for your clinical workflow</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 px-5 pb-5 pt-0">
            {quickActions.map(({ label, description, href, icon: Icon, tone }) => (
              <Link
                key={label}
                href={href}
                className="rounded-2xl border border-slate-200 bg-white p-4 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
              >
                <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${tone}`}>
                  <Icon size={18} />
                </div>
                <h3 className="mt-3 text-sm font-semibold text-slate-950">{label}</h3>
                <p className="mt-1 text-xs text-slate-500">{description}</p>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <DoctorStatCard icon={UsersRound} value={String(dashboard.stats.totalPatients)} label="Unique patients" tone="bg-blue-50 text-primary" />
        <DoctorStatCard icon={CalendarClock} value={String(dashboard.stats.appointmentsToday)} label="Appointments today" tone="bg-emerald-50 text-emerald-600" />
        <DoctorStatCard icon={ClipboardList} value={String(dashboard.stats.completedAppointments)} label="Completed visits" tone="bg-indigo-50 text-indigo-600" />
        <DoctorStatCard icon={FlaskConical} value={String(dashboard.stats.pendingReviews)} label="Pending reviews" tone="bg-amber-50 text-amber-600" />
        <DoctorStatCard icon={CircleDollarSign} value={`Rs. ${dashboard.stats.paidRevenue}`} label="Collected revenue" tone="bg-rose-50 text-rose-600" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.55fr_1fr]">
        <Card className="rounded-3xl border border-slate-200 py-0 shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
          <CardHeader className="px-5 pt-5">
            <CardTitle className="text-lg font-semibold text-slate-950">Patient visits</CardTitle>
            <CardDescription>Last 6 months</CardDescription>
          </CardHeader>
          <CardContent className="px-5 pb-5 pt-0">
            <div className="h-[280px] min-h-0 rounded-2xl bg-[linear-gradient(180deg,rgba(37,99,235,0.08)_0%,rgba(37,99,235,0.02)_100%)] p-3">
              {showCharts ? (
                <ResponsiveContainer width="100%" height={252}>
                  <AreaChart data={dashboard.monthlyVisits} margin={{ top: 12, right: 10, left: -16, bottom: 0 }}>
                    <defs>
                      <linearGradient id="doctorVisitFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2563eb" stopOpacity={0.22} />
                        <stop offset="100%" stopColor="#2563eb" stopOpacity={0.04} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#dbe4f0" />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                    <Area type="monotone" dataKey="visits" stroke="#2563eb" strokeWidth={2.5} fill="url(#doctorVisitFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-slate-400">Loading chart...</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border border-slate-200 py-0 shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
          <CardHeader className="px-5 pt-5">
            <CardTitle className="text-lg font-semibold text-slate-950">Weekly schedule load</CardTitle>
            <CardDescription>Appointments distributed across this week</CardDescription>
          </CardHeader>
          <CardContent className="px-5 pb-5 pt-0">
            <div className="h-[280px] min-h-0 rounded-2xl bg-white p-2">
              {showCharts ? (
                <ResponsiveContainer width="100%" height={264}>
                  <BarChart data={dashboard.weeklySchedule} margin={{ top: 12, right: 8, left: -10, bottom: 0 }} barCategoryGap={14}>
                    <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#dbe4f0" />
                    <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                    <Bar dataKey="appointments" fill="#0f766e" radius={[8, 8, 0, 0]} maxBarSize={34} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-slate-400">Loading chart...</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-3xl border border-slate-200 py-0 shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
        <CardHeader className="px-5 pt-5">
          <CardTitle className="text-lg font-semibold text-slate-950">Clinical snapshot</CardTitle>
          <CardDescription>Operational view of your active treatment workload</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 px-5 pb-5 pt-0 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 text-slate-900">
              <HeartPulse size={16} className="text-primary" />
              <span className="text-sm font-semibold">Confirmed consultations</span>
            </div>
            <p className="mt-3 text-3xl font-semibold text-slate-950">{dashboard.stats.confirmedAppointments}</p>
            <p className="mt-1 text-xs text-slate-500">Patients already confirmed for scheduled care.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 text-slate-900">
              <Stethoscope size={16} className="text-emerald-600" />
              <span className="text-sm font-semibold">Department</span>
            </div>
            <p className="mt-3 text-lg font-semibold text-slate-950">{dashboard.doctorProfile.department}</p>
            <p className="mt-1 text-xs text-slate-500">Primary care area currently linked to your account.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 text-slate-900">
              <FlaskConical size={16} className="text-amber-600" />
              <span className="text-sm font-semibold">Pending clinical follow-up</span>
            </div>
            <p className="mt-3 text-3xl font-semibold text-slate-950">{dashboard.stats.pendingReviews}</p>
            <p className="mt-1 text-xs text-slate-500">Scheduled consultations still awaiting action or review.</p>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border border-slate-200 py-0 shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
        <CardHeader className="flex flex-row items-start justify-between px-5 pt-5">
          <div>
            <CardTitle className="text-lg font-semibold text-slate-950">Upcoming appointments</CardTitle>
            <CardDescription>Your nearest patient interactions and visit queue</CardDescription>
          </div>
          <CardAction>
            <Link href={getDoctorPath('/appointments')} className="text-sm font-medium text-primary transition-colors hover:text-primary/80">
              View all
            </Link>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-3 px-5 pb-5 pt-0">
          {loading ? (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
              Loading appointments...
            </div>
          ) : dashboard.upcomingAppointments.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
              No upcoming appointments available for this doctor yet.
            </div>
          ) : (
            dashboard.upcomingAppointments.map((appointment) => (
              <div
                key={appointment._id}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-lg font-semibold text-slate-950">{appointment.patientName}</p>
                    <p className="mt-0.5 text-sm text-slate-500">{appointment.department}</p>
                    <p className="mt-2 text-xs text-slate-500">
                      {new Date(appointment.appointmentDate).toLocaleDateString()} at {appointment.appointmentTime}
                    </p>
                  </div>
                  <div className="flex flex-col items-start gap-2 md:items-end">
                    <AppointmentStatusBadge status={appointment.status} />
                    <Badge variant="secondary" className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
                      Payment: {appointment.paymentStatus}
                    </Badge>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
