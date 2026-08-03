'use client';

import { useEffect, useMemo, useState, type ComponentType } from 'react';
import Link from 'next/link';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  BedDouble,
  Building2,
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  CalendarPlus2,
  CheckCircle2,
  Clock3,
  DollarSign,
  FolderPlus,
  HeartPulse,
  PlusSquare,
  Stethoscope,
  UserPlus,
  Users,
  WalletCards,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import {
  HOSPITAL_ADMIN_CACHE_EVENT,
  getHospitalAdminCacheData,
  setHospitalAdminCacheData,
} from '@/lib/hospital-admin-cache';
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
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getHospitalAdminPath } from '@/lib/routes';

type AppointmentStatus = 'Scheduled' | 'Confirmed' | 'Completed' | 'Cancelled';

type DashboardStats = {
  totalPatients: number;
  totalDoctors: number;
  totalStaff: number;
  departmentCount: number;
  totalAppointments: number;
  appointmentsToday: number;
  upcomingAppointments: number;
  pendingAppointments: number;
  confirmedAppointments: number;
  completedAppointments: number;
  cancelledAppointments: number;
  paidAppointments: number;
  pendingPayments: number;
  monthlyRevenue: number;
  totalRevenue: number;
  averageConsultationFee: number;
  bedCapacity: number;
  bedOccupancy: number;
};

type TrendPoint = {
  month: string;
  appointments: number;
  admissions: number;
  revenue: number;
};

type OccupancyPoint = {
  day: string;
  appointments: number;
  occupancy: number;
};

type StatusBreakdownPoint = {
  status: string;
  count: number;
};

type PaymentBreakdownPoint = {
  status: string;
  count: number;
  amount: number;
};

type DepartmentLoadPoint = {
  department: string;
  appointments: number;
  revenue: number;
};

type DoctorLoadPoint = {
  doctorName: string;
  appointments: number;
  revenue: number;
};

type StaffMixPoint = {
  department: string;
  count: number;
};

type AppointmentItem = {
  _id: string;
  patientName: string;
  doctorName: string;
  department?: string | null;
  status: AppointmentStatus;
  appointmentDate?: string;
  appointmentTime?: string | null;
  consultationFee?: number;
  paymentStatus?: 'Pending' | 'Paid';
};

type DashboardResponse = {
  hospitalName: string;
  hospital?: {
    id?: string;
    name?: string;
    city?: string;
    status?: string;
    type?: string;
    beds?: number;
    maxDoctors?: number | null;
    maxReceptionists?: number | null;
    maxNurses?: number | null;
    maxStaff?: number | null;
    subscriptionType?: string;
    subscriptionStatus?: string;
    daysRemaining?: number | null;
    doctorCount?: number;
    receptionistCount?: number;
    nurseCount?: number;
    staffCount?: number;
  };
  stats: DashboardStats;
  admissionTrend: TrendPoint[];
  appointmentTrend: TrendPoint[];
  occupancyTrend: OccupancyPoint[];
  appointmentStatusBreakdown: StatusBreakdownPoint[];
  paymentStatusBreakdown: PaymentBreakdownPoint[];
  departmentLoad: DepartmentLoadPoint[];
  doctorLoad: DoctorLoadPoint[];
  staffMix: StaffMixPoint[];
  appointmentsToday: AppointmentItem[];
  upcomingVisits: AppointmentItem[];
};

const emptyStats: DashboardStats = {
  totalPatients: 0,
  totalDoctors: 0,
  totalStaff: 0,
  departmentCount: 0,
  totalAppointments: 0,
  appointmentsToday: 0,
  upcomingAppointments: 0,
  pendingAppointments: 0,
  confirmedAppointments: 0,
  completedAppointments: 0,
  cancelledAppointments: 0,
  paidAppointments: 0,
  pendingPayments: 0,
  monthlyRevenue: 0,
  totalRevenue: 0,
  averageConsultationFee: 0,
  bedCapacity: 0,
  bedOccupancy: 0,
};

const defaultDashboard: DashboardResponse = {
  hospitalName: 'Assigned Hospital',
  stats: emptyStats,
  admissionTrend: [],
  appointmentTrend: [],
  occupancyTrend: [],
  appointmentStatusBreakdown: [],
  paymentStatusBreakdown: [],
  departmentLoad: [],
  doctorLoad: [],
  staffMix: [],
  appointmentsToday: [],
  upcomingVisits: [],
};

const quickActions = [
  {
    label: 'Add Patient',
    description: 'Register patient profile',
    href: getHospitalAdminPath('/patients'),
    icon: UserPlus,
    tone: 'bg-sky-50 text-sky-700',
  },
  {
    label: 'Add Doctor',
    description: 'Create doctor record',
    href: getHospitalAdminPath('/doctors'),
    icon: Stethoscope,
    tone: 'bg-emerald-50 text-emerald-700',
  },
  {
    label: 'Add Staff',
    description: 'Add staff member',
    href: getHospitalAdminPath('/staff'),
    icon: PlusSquare,
    tone: 'bg-amber-50 text-amber-700',
  },
  {
    label: 'Add Department',
    description: 'Set department',
    href: getHospitalAdminPath('/departments'),
    icon: FolderPlus,
    tone: 'bg-indigo-50 text-indigo-700',
  },
];

const appointmentTrendConfig = {
  appointments: {
    label: 'Appointments',
    color: '#0284c7',
  },
} satisfies ChartConfig;

const occupancyConfig = {
  occupancy: {
    label: 'Utilization',
    color: '#0f766e',
  },
} satisfies ChartConfig;

const statusConfig = {
  count: {
    label: 'Appointments',
    color: '#4f46e5',
  },
} satisfies ChartConfig;

const departmentConfig = {
  appointments: {
    label: 'Appointments',
    color: '#c2410c',
  },
} satisfies ChartConfig;

const getErrorMessage = (error: unknown, fallback: string) => {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    return (error as { response?: { data?: { message?: string } } }).response?.data?.message || fallback;
  }
  return fallback;
};

const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatNumber = (value: unknown) => new Intl.NumberFormat('en-IN').format(toNumber(value));
const formatCurrency = (value: unknown) => `Rs. ${formatNumber(value)}`;

const formatDate = (value?: string) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
  }).format(date);
};

const normalizeTrend = (items: unknown): TrendPoint[] => {
  if (!Array.isArray(items)) return [];

  return items.map((item) => {
    const entry = item as Partial<TrendPoint>;
    const appointments = toNumber(entry.appointments ?? entry.admissions);
    return {
      month: entry.month || '',
      appointments,
      admissions: appointments,
      revenue: toNumber(entry.revenue),
    };
  });
};

const normalizeOccupancy = (items: unknown): OccupancyPoint[] => {
  if (!Array.isArray(items)) return [];

  return items.map((item) => {
    const entry = item as Partial<OccupancyPoint>;
    return {
      day: entry.day || '',
      appointments: toNumber(entry.appointments),
      occupancy: toNumber(entry.occupancy),
    };
  });
};

const normalizeStatusBreakdown = (items: unknown): StatusBreakdownPoint[] => {
  if (!Array.isArray(items)) return [];

  return items.map((item) => {
    const entry = item as Partial<StatusBreakdownPoint>;
    return {
      status: entry.status || 'Unknown',
      count: toNumber(entry.count),
    };
  });
};

const normalizePaymentBreakdown = (items: unknown): PaymentBreakdownPoint[] => {
  if (!Array.isArray(items)) return [];

  return items.map((item) => {
    const entry = item as Partial<PaymentBreakdownPoint>;
    return {
      status: entry.status || 'Unknown',
      count: toNumber(entry.count),
      amount: toNumber(entry.amount),
    };
  });
};

const normalizeDepartmentLoad = (items: unknown): DepartmentLoadPoint[] => {
  if (!Array.isArray(items)) return [];

  return items.map((item) => {
    const entry = item as Partial<DepartmentLoadPoint>;
    return {
      department: entry.department || 'Unassigned',
      appointments: toNumber(entry.appointments),
      revenue: toNumber(entry.revenue),
    };
  });
};

const normalizeDoctorLoad = (items: unknown): DoctorLoadPoint[] => {
  if (!Array.isArray(items)) return [];

  return items.map((item) => {
    const entry = item as Partial<DoctorLoadPoint>;
    return {
      doctorName: entry.doctorName || 'Unassigned',
      appointments: toNumber(entry.appointments),
      revenue: toNumber(entry.revenue),
    };
  });
};

const normalizeStaffMix = (items: unknown): StaffMixPoint[] => {
  if (!Array.isArray(items)) return [];

  return items.map((item) => {
    const entry = item as Partial<StaffMixPoint>;
    return {
      department: entry.department || 'Unassigned',
      count: toNumber(entry.count),
    };
  });
};

const normalizeAppointments = (items: unknown): AppointmentItem[] => {
  if (!Array.isArray(items)) return [];

  return items.map((item, index) => {
    const entry = item as Partial<AppointmentItem>;
    return {
      _id: entry._id || `appointment-${index}`,
      patientName: entry.patientName || 'Patient',
      doctorName: entry.doctorName || 'Doctor',
      department: entry.department || null,
      status: entry.status || 'Scheduled',
      appointmentDate: entry.appointmentDate,
      appointmentTime: entry.appointmentTime || null,
      consultationFee: toNumber(entry.consultationFee),
      paymentStatus: entry.paymentStatus || 'Pending',
    };
  });
};

const normalizeDashboard = (dashboard: unknown): DashboardResponse => {
  const nextDashboard = (dashboard ?? {}) as Partial<DashboardResponse> & {
    stats?: Partial<DashboardStats>;
  };
  const trend = normalizeTrend(nextDashboard.appointmentTrend || nextDashboard.admissionTrend);

  return {
    hospitalName: nextDashboard.hospitalName || defaultDashboard.hospitalName,
    hospital: nextDashboard.hospital ? {
      id: nextDashboard.hospital.id,
      name: nextDashboard.hospital.name,
      city: nextDashboard.hospital.city,
      status: nextDashboard.hospital.status,
      type: nextDashboard.hospital.type,
      beds: toNumber(nextDashboard.hospital.beds),
      maxDoctors: nextDashboard.hospital.maxDoctors !== undefined && nextDashboard.hospital.maxDoctors !== null ? toNumber(nextDashboard.hospital.maxDoctors) : null,
      maxReceptionists: nextDashboard.hospital.maxReceptionists !== undefined && nextDashboard.hospital.maxReceptionists !== null ? toNumber(nextDashboard.hospital.maxReceptionists) : null,
      maxNurses: nextDashboard.hospital.maxNurses !== undefined && nextDashboard.hospital.maxNurses !== null ? toNumber(nextDashboard.hospital.maxNurses) : null,
      maxStaff: nextDashboard.hospital.maxStaff !== undefined && nextDashboard.hospital.maxStaff !== null ? toNumber(nextDashboard.hospital.maxStaff) : null,
      subscriptionType: nextDashboard.hospital.subscriptionType,
      subscriptionStatus: nextDashboard.hospital.subscriptionStatus,
      daysRemaining: nextDashboard.hospital.daysRemaining !== undefined && nextDashboard.hospital.daysRemaining !== null ? toNumber(nextDashboard.hospital.daysRemaining) : null,
      doctorCount: toNumber(nextDashboard.hospital.doctorCount),
      receptionistCount: toNumber(nextDashboard.hospital.receptionistCount),
      nurseCount: toNumber(nextDashboard.hospital.nurseCount),
      staffCount: toNumber(nextDashboard.hospital.staffCount),
    } : undefined,
    stats: {
      totalPatients: toNumber(nextDashboard.stats?.totalPatients),
      totalDoctors: toNumber(nextDashboard.stats?.totalDoctors),
      totalStaff: toNumber(nextDashboard.stats?.totalStaff),
      departmentCount: toNumber(nextDashboard.stats?.departmentCount),
      totalAppointments: toNumber(nextDashboard.stats?.totalAppointments),
      appointmentsToday: toNumber(nextDashboard.stats?.appointmentsToday),
      upcomingAppointments: toNumber(nextDashboard.stats?.upcomingAppointments),
      pendingAppointments: toNumber(nextDashboard.stats?.pendingAppointments),
      confirmedAppointments: toNumber(nextDashboard.stats?.confirmedAppointments),
      completedAppointments: toNumber(nextDashboard.stats?.completedAppointments),
      cancelledAppointments: toNumber(nextDashboard.stats?.cancelledAppointments),
      paidAppointments: toNumber(nextDashboard.stats?.paidAppointments),
      pendingPayments: toNumber(nextDashboard.stats?.pendingPayments),
      monthlyRevenue: toNumber(nextDashboard.stats?.monthlyRevenue),
      totalRevenue: toNumber(nextDashboard.stats?.totalRevenue),
      averageConsultationFee: toNumber(nextDashboard.stats?.averageConsultationFee),
      bedCapacity: toNumber(nextDashboard.stats?.bedCapacity),
      bedOccupancy: toNumber(nextDashboard.stats?.bedOccupancy),
    },
    admissionTrend: trend,
    appointmentTrend: trend,
    occupancyTrend: normalizeOccupancy(nextDashboard.occupancyTrend),
    appointmentStatusBreakdown: normalizeStatusBreakdown(nextDashboard.appointmentStatusBreakdown),
    paymentStatusBreakdown: normalizePaymentBreakdown(nextDashboard.paymentStatusBreakdown),
    departmentLoad: normalizeDepartmentLoad(nextDashboard.departmentLoad),
    doctorLoad: normalizeDoctorLoad(nextDashboard.doctorLoad),
    staffMix: normalizeStaffMix(nextDashboard.staffMix),
    appointmentsToday: normalizeAppointments(nextDashboard.appointmentsToday),
    upcomingVisits: normalizeAppointments(nextDashboard.upcomingVisits),
  };
};

function StatCard({
  detail,
  icon: Icon,
  tone,
  value,
  label,
}: {
  detail?: string;
  icon: ComponentType<{ className?: string; size?: number }>;
  tone: string;
  value: string;
  label: string;
}) {
  return (
    <Card className="rounded-lg border border-slate-200 py-0 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
      <CardContent className="flex min-h-[112px] flex-col justify-between p-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tone}`}>
            <Icon size={18} />
          </div>
          {detail ? <span className="text-right text-[11px] font-medium text-slate-500">{detail}</span> : null}
        </div>
        <div>
          <div className="text-[1.35rem] font-semibold tracking-tight text-slate-950">{value}</div>
          <div className="mt-0.5 text-xs text-slate-500">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Scheduled: 'bg-sky-50 text-sky-700 hover:bg-sky-50',
    Confirmed: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-50',
    Completed: 'bg-slate-100 text-slate-700 hover:bg-slate-100',
    Cancelled: 'bg-rose-50 text-rose-600 hover:bg-rose-50',
  };

  return (
    <Badge
      variant="secondary"
      className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${styles[status] || 'bg-slate-100 text-slate-700'}`}
    >
      {status}
    </Badge>
  );
}

function EmptyChartState() {
  return (
    <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-200 text-sm text-slate-400">
      No data yet
    </div>
  );
}

export default function HospitalAdminDashboardPage() {
  const [userData, setUserData] = useState({
    userName: 'Hospital Admin',
    hospitalName: 'Assigned Hospital',
    role: 'Hospital Admin',
  });
  const [dashboard, setDashboard] = useState<DashboardResponse>(defaultDashboard);
  const [showCharts, setShowCharts] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const storedUser = sessionStorage.getItem('auth_user');
      if (!storedUser) return;

      try {
        const user = JSON.parse(storedUser);
        setUserData({
          userName: user?.name || 'Hospital Admin',
          role: user?.role || 'Hospital Admin',
          hospitalName:
            user?.hospitalId?.name ||
            user?.hospital?.name ||
            user?.hospitalName ||
            'Assigned Hospital',
        });
      } catch {
        // Ignore malformed session data.
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setShowCharts(true);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    const handleCacheUpdate = () => {
      const nextDashboard = getHospitalAdminCacheData<DashboardResponse>('dashboard');
      if (nextDashboard) {
        setDashboard(normalizeDashboard(nextDashboard));
      }
    };

    window.addEventListener(HOSPITAL_ADMIN_CACHE_EVENT, handleCacheUpdate);
    return () => window.removeEventListener(HOSPITAL_ADMIN_CACHE_EVENT, handleCacheUpdate);
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const cachedDashboard = getHospitalAdminCacheData<DashboardResponse>('dashboard');
      if (cachedDashboard) {
        setDashboard(normalizeDashboard(cachedDashboard));
      }

      void (async () => {
        try {
          const response = await api.get('/hospital-admin/dashboard');
          const normalizedDashboard = normalizeDashboard(response.data?.data);
          setDashboard(normalizedDashboard);
          setHospitalAdminCacheData('dashboard', normalizedDashboard);
        } catch (error) {
          toast.error(getErrorMessage(error, 'Failed to load dashboard data'));
          if (!cachedDashboard) {
            setDashboard(defaultDashboard);
          }
        }
      })();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  const stats = dashboard.stats;
  const firstName = userData.userName.split(' ')[0] || 'Hospital';
  const displayHospitalName = dashboard.hospitalName || userData.hospitalName;
  const canManageHospital = userData.role === 'Hospital Admin';

  const metricCards = useMemo(
    () => [
      {
        label: 'Today appointments',
        value: formatNumber(stats.appointmentsToday),
        detail: `${formatNumber(stats.upcomingAppointments)} upcoming`,
        icon: CalendarCheck2,
        tone: 'bg-sky-50 text-sky-700',
      },
      {
        label: 'Scheduled review',
        value: formatNumber(stats.pendingAppointments),
        detail: `${formatNumber(stats.confirmedAppointments)} confirmed`,
        icon: Clock3,
        tone: 'bg-amber-50 text-amber-700',
      },
      {
        label: 'Completed visits',
        value: formatNumber(stats.completedAppointments),
        detail: `${formatNumber(stats.cancelledAppointments)} cancelled`,
        icon: CheckCircle2,
        tone: 'bg-emerald-50 text-emerald-700',
      },
      {
        label: 'Monthly revenue',
        value: formatCurrency(stats.monthlyRevenue),
        detail: `${formatCurrency(stats.totalRevenue)} total`,
        icon: DollarSign,
        tone: 'bg-violet-50 text-violet-700',
      },
      {
        label: 'Pending payments',
        value: formatNumber(stats.pendingPayments),
        detail: `${formatNumber(stats.paidAppointments)} paid`,
        icon: WalletCards,
        tone: 'bg-rose-50 text-rose-700',
      },
      {
        label: 'Capacity utilization',
        value: `${formatNumber(stats.bedOccupancy)}%`,
        detail: `${formatNumber(stats.bedCapacity)} beds`,
        icon: BedDouble,
        tone: 'bg-teal-50 text-teal-700',
      },
      {
        label: 'Patients',
        value: formatNumber(stats.totalPatients),
        detail: `${formatNumber(stats.totalAppointments)} visits`,
        icon: HeartPulse,
        tone: 'bg-cyan-50 text-cyan-700',
      },
      {
        label: 'Doctors',
        value: formatNumber(stats.totalDoctors),
        detail: `${formatCurrency(stats.averageConsultationFee)} avg fee`,
        icon: Stethoscope,
        tone: 'bg-indigo-50 text-indigo-700',
      },
      {
        label: 'Staff',
        value: formatNumber(stats.totalStaff),
        detail: 'active records',
        icon: Users,
        tone: 'bg-lime-50 text-lime-700',
      },
      {
        label: 'Departments',
        value: formatNumber(stats.departmentCount),
        detail: dashboard.hospital?.type || 'hospital',
        icon: Building2,
        tone: 'bg-orange-50 text-orange-700',
      },
    ],
    [dashboard.hospital?.type, stats]
  );

  return (
    <div className="mx-auto max-w-[1280px] space-y-4">
      <nav className="flex items-center gap-1.5 text-xs text-slate-500">
        <Link href="/" className="transition-colors hover:text-slate-900">
          Home
        </Link>
        <span>/</span>
        <span className="font-medium text-slate-900">Hospital Admin</span>
      </nav>

      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold leading-none tracking-tight text-slate-950">
            Welcome back, {firstName}
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">
            {displayHospitalName} dashboard is synced with live hospital records.
          </p>
          {dashboard.hospital && (
            <div className="mt-3 flex flex-wrap gap-2 items-center">
              {(() => {
                const subType = dashboard.hospital.subscriptionType;
                const subStatus = dashboard.hospital.subscriptionStatus;
                const hStatus = dashboard.hospital.status;

                if (hStatus === 'Inactive' || subStatus === 'expired') {
                  return (
                    <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-700 font-semibold px-3 py-1 flex items-center gap-1.5 rounded-full shadow-sm">
                      <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                      🔴 Expired
                    </Badge>
                  );
                } else if (subType === 'demo') {
                  return (
                    <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 font-semibold px-3 py-1 flex items-center gap-1.5 rounded-full shadow-sm">
                      <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                      🟡 Demo
                    </Badge>
                  );
                } else {
                  return (
                    <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 font-semibold px-3 py-1 flex items-center gap-1.5 rounded-full shadow-sm">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      🟢 Active
                    </Badge>
                  );
                }
              })()}

              {dashboard.hospital.subscriptionType === 'demo' && dashboard.hospital.daysRemaining !== null && (
                <Badge variant="secondary" className="bg-slate-100 hover:bg-slate-100 text-slate-700 font-medium px-3 py-1 rounded-full border border-slate-200">
                  Days Remaining: <span className="font-bold ml-1">{dashboard.hospital.daysRemaining}</span>
                </Badge>
              )}

              {dashboard.hospital.maxDoctors !== null && dashboard.hospital.maxDoctors !== undefined && (
                <Badge variant="secondary" className="bg-slate-100 hover:bg-slate-100 text-slate-700 font-medium px-3 py-1 rounded-full border border-slate-200">
                  Doctors: <span className="font-bold ml-1">{dashboard.hospital.doctorCount || 0}/{dashboard.hospital.maxDoctors}</span>
                </Badge>
              )}

              {dashboard.hospital.maxReceptionists !== null && dashboard.hospital.maxReceptionists !== undefined && (
                <Badge variant="secondary" className="bg-slate-100 hover:bg-slate-100 text-slate-700 font-medium px-3 py-1 rounded-full border border-slate-200">
                  Receptionists: <span className="font-bold ml-1">{dashboard.hospital.receptionistCount || 0}/{dashboard.hospital.maxReceptionists}</span>
                </Badge>
              )}

              {dashboard.hospital.maxStaff !== null && dashboard.hospital.maxStaff !== undefined && (
                <Badge variant="secondary" className="bg-slate-100 hover:bg-slate-100 text-slate-700 font-medium px-3 py-1 rounded-full border border-slate-200">
                  Staff: <span className="font-bold ml-1">{dashboard.hospital.staffCount || 0}/{dashboard.hospital.maxStaff}</span>
                </Badge>
              )}

              {dashboard.hospital.beds !== null && dashboard.hospital.beds !== undefined && dashboard.hospital.beds > 0 && (
                <Badge variant="secondary" className="bg-slate-100 hover:bg-slate-100 text-slate-700 font-medium px-3 py-1 rounded-full border border-slate-200">
                  Beds: <span className="font-bold ml-1">{dashboard.hospital.beds}</span>
                </Badge>
              )}
            </div>
          )}
        </div>
        {canManageHospital ? (
          <Link href={getHospitalAdminPath('/appointments')}>
            <Button className="h-9 rounded-lg bg-primary px-3.5 text-sm text-white shadow-sm hover:bg-primary/90">
              <CalendarPlus2 size={16} className="mr-2" />
              New appointment
            </Button>
          </Link>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {metricCards.map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </div>

      <div className="grid gap-3 xl:grid-cols-[1.45fr_1fr]">
        <Card className="rounded-lg border border-slate-200 py-0 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
          <CardHeader className="px-4 pt-4">
            <CardTitle className="text-base font-semibold text-slate-950">Appointments trend</CardTitle>
            <CardDescription>Last 6 months</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <div className="h-[240px]">
              {showCharts && dashboard.appointmentTrend.length ? (
                <ChartContainer className="h-full" config={appointmentTrendConfig}>
                  <AreaChart data={dashboard.appointmentTrend} margin={{ top: 12, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="appointmentTrendFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-appointments)" stopOpacity={0.24} />
                        <stop offset="100%" stopColor="var(--color-appointments)" stopOpacity={0.03} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#dbe4f0" />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                    <ChartTooltip content={<ChartTooltipContent valueFormatter={(value) => formatNumber(value)} />} />
                    <Area
                      type="monotone"
                      dataKey="appointments"
                      stroke="var(--color-appointments)"
                      strokeWidth={2.5}
                      fill="url(#appointmentTrendFill)"
                    />
                  </AreaChart>
                </ChartContainer>
              ) : (
                <EmptyChartState />
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-lg border border-slate-200 py-0 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
          <CardHeader className="px-4 pt-4">
            <CardTitle className="text-base font-semibold text-slate-950">Weekly capacity</CardTitle>
            <CardDescription>Appointments against bed capacity</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <div className="h-[240px]">
              {showCharts && dashboard.occupancyTrend.length ? (
                <ChartContainer className="h-full" config={occupancyConfig}>
                  <BarChart data={dashboard.occupancyTrend} margin={{ top: 12, right: 8, left: -10, bottom: 0 }} barCategoryGap={12}>
                    <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#dbe4f0" />
                    <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                    <YAxis tickLine={false} axisLine={false} domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={{ fill: '#64748b', fontSize: 12 }} />
                    <ChartTooltip content={<ChartTooltipContent valueFormatter={(value) => `${formatNumber(value)}%`} />} />
                    <Bar dataKey="occupancy" fill="var(--color-occupancy)" radius={[7, 7, 0, 0]} maxBarSize={34} />
                  </BarChart>
                </ChartContainer>
              ) : (
                <EmptyChartState />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        <Card className="rounded-lg border border-slate-200 py-0 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
          <CardHeader className="px-4 pt-4">
            <CardTitle className="text-base font-semibold text-slate-950">Appointment status</CardTitle>
            <CardDescription>All recorded visits</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <div className="h-[220px]">
              {showCharts && dashboard.appointmentStatusBreakdown.length ? (
                <ChartContainer className="h-full" config={statusConfig}>
                  <BarChart data={dashboard.appointmentStatusBreakdown} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#dbe4f0" />
                    <XAxis dataKey="status" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                    <YAxis tickLine={false} axisLine={false} allowDecimals={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                    <ChartTooltip content={<ChartTooltipContent valueFormatter={(value) => formatNumber(value)} />} />
                    <Bar dataKey="count" fill="var(--color-count)" radius={[7, 7, 0, 0]} maxBarSize={42} />
                  </BarChart>
                </ChartContainer>
              ) : (
                <EmptyChartState />
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-lg border border-slate-200 py-0 shadow-[0_8px_24px_rgba(15,23,42,0.04)] xl:col-span-2">
          <CardHeader className="px-4 pt-4">
            <CardTitle className="text-base font-semibold text-slate-950">Department load</CardTitle>
            <CardDescription>Current month appointment volume</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <div className="h-[220px]">
              {showCharts && dashboard.departmentLoad.length ? (
                <ChartContainer className="h-full" config={departmentConfig}>
                  <BarChart data={dashboard.departmentLoad} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#dbe4f0" />
                    <XAxis dataKey="department" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                    <YAxis tickLine={false} axisLine={false} allowDecimals={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                    <ChartTooltip content={<ChartTooltipContent valueFormatter={(value) => formatNumber(value)} />} />
                    <Bar dataKey="appointments" fill="var(--color-appointments)" radius={[7, 7, 0, 0]} maxBarSize={46} />
                  </BarChart>
                </ChartContainer>
              ) : (
                <EmptyChartState />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.25fr_0.9fr_0.9fr]">
        <Card className="overflow-hidden rounded-lg border border-slate-200 py-0 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
          <CardHeader className="border-b border-slate-200 px-4 py-4">
            <CardTitle className="text-base font-semibold text-slate-950">Today&apos;s appointments</CardTitle>
            <CardAction>
              {canManageHospital ? (
                <Link href={getHospitalAdminPath('/appointments')} className="text-xs font-semibold text-slate-950 transition-colors hover:text-primary">
                  View all
                </Link>
              ) : null}
            </CardAction>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <Table>
              <TableHeader className="bg-slate-50/70">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Time</TableHead>
                  <TableHead className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Patient</TableHead>
                  <TableHead className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Doctor</TableHead>
                  <TableHead className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dashboard.appointmentsToday.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="px-4 py-8 text-center text-sm text-slate-500">
                      No appointments today.
                    </TableCell>
                  </TableRow>
                ) : (
                  dashboard.appointmentsToday.map((appointment) => (
                    <TableRow key={appointment._id}>
                      <TableCell className="px-4 py-3 text-xs text-slate-900">{appointment.appointmentTime || '--:--'}</TableCell>
                      <TableCell className="px-4 py-3">
                        <p className="text-xs font-medium text-slate-950">{appointment.patientName}</p>
                        <p className="text-[11px] text-slate-500">{appointment.department || '-'}</p>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-xs text-slate-500">{appointment.doctorName}</TableCell>
                      <TableCell className="px-4 py-3">
                        <StatusBadge status={appointment.status} />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="rounded-lg border border-slate-200 py-0 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
          <CardHeader className="px-4 pt-4">
            <CardTitle className="text-base font-semibold text-slate-950">Upcoming visits</CardTitle>
            <CardDescription>Next scheduled queue</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5 px-4 pb-4">
            {dashboard.upcomingVisits.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 px-3 py-8 text-center text-sm text-slate-500">
                No upcoming visits.
              </div>
            ) : (
              dashboard.upcomingVisits.map((visit) => (
                <div key={visit._id} className="rounded-lg border border-slate-200 px-3 py-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">{visit.patientName}</p>
                      <p className="text-xs text-slate-500">{visit.doctorName}</p>
                    </div>
                    <StatusBadge status={visit.status} />
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays size={13} />
                      {formatDate(visit.appointmentDate)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <CalendarClock size={13} />
                      {visit.appointmentTime || '--:--'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="rounded-lg border border-slate-200 py-0 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
          <CardHeader className="px-4 pt-4">
            <CardTitle className="text-base font-semibold text-slate-950">Payments and staffing</CardTitle>
            <CardDescription>Current database totals</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 px-4 pb-4">
            <div className="space-y-2">
              {dashboard.paymentStatusBreakdown.map((item) => (
                <div key={item.status} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                  <div className="flex items-center gap-2">
                    {item.status === 'Paid' ? (
                      <CheckCircle2 size={15} className="text-emerald-600" />
                    ) : (
                      <XCircle size={15} className="text-rose-600" />
                    )}
                    <span className="text-sm font-medium text-slate-700">{item.status}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-950">{formatNumber(item.count)}</p>
                    <p className="text-[11px] text-slate-500">{formatCurrency(item.amount)}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              {dashboard.staffMix.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-500">
                  No staff records.
                </div>
              ) : (
                dashboard.staffMix.map((item) => (
                  <div key={item.department} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                    <span className="text-sm font-medium text-slate-700">{item.department}</span>
                    <span className="text-sm font-semibold text-slate-950">{formatNumber(item.count)}</span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_1.2fr]">
        <Card className="rounded-lg border border-slate-200 py-0 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
          <CardHeader className="px-4 pt-4">
            <CardTitle className="text-base font-semibold text-slate-950">Doctor load</CardTitle>
            <CardDescription>Current month</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5 px-4 pb-4">
            {dashboard.doctorLoad.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 px-3 py-8 text-center text-sm text-slate-500">
                No doctor appointment load yet.
              </div>
            ) : (
              dashboard.doctorLoad.map((doctor) => (
                <div key={doctor.doctorName} className="rounded-lg border border-slate-200 px-3 py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-950">{doctor.doctorName}</p>
                    <span className="text-xs font-semibold text-slate-500">{formatCurrency(doctor.revenue)}</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{
                        width: `${Math.min(100, Math.max(8, doctor.appointments * 12))}%`,
                      }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{formatNumber(doctor.appointments)} appointments</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {canManageHospital ? (
          <Card className="rounded-lg border border-slate-200 py-0 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
            <CardHeader className="px-4 pt-4">
              <CardTitle className="text-base font-semibold text-slate-950">Quick actions</CardTitle>
              <CardDescription>Daily hospital admin work</CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
                {quickActions.map(({ label, description, href, icon: Icon, tone }) => (
                  <Link key={label} href={href} className="block">
                    <div className="rounded-lg border border-slate-200 bg-white p-3 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${tone}`}>
                        <Icon size={16} />
                      </div>
                      <h3 className="mt-2.5 text-sm font-semibold text-slate-950">{label}</h3>
                      <p className="mt-1 text-[11px] text-slate-500">{description}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="rounded-lg border border-slate-200 py-0 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
            <CardHeader className="px-4 pt-4">
              <CardTitle className="text-base font-semibold text-slate-950">Access scope</CardTitle>
              <CardDescription>Receptionist dashboard</CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
                <Activity size={16} className="mt-0.5 shrink-0" />
                <span>Dashboard access is active for this hospital account.</span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
