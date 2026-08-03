'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, FilePlus2, Mail, Phone, ShieldPlus, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getDoctorPath } from '@/lib/routes';

type PatientDetailsResponse = {
  patient: {
    _id: string;
    patientName: string;
    email?: string | null;
    phone?: string | null;
    emergencyContact?: string | null;
    age?: number | null;
    bloodGroup?: string | null;
    gender?: string | null;
    status: string;
    address?: string | null;
  };
  careSummary: {
    doctorName?: string | null;
    specialization: string;
    department: string;
    totalVisits: number;
    completedVisits: number;
    upcomingAppointment?: {
      appointmentDate: string;
      appointmentTime: string;
      status: string;
    } | null;
  };
  recentAppointments: Array<{
    _id: string;
    appointmentDate: string;
    appointmentTime: string;
    department: string;
    status: string;
    paymentStatus: string;
    consultationFee: number;
  }>;
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    return (error as { response?: { data?: { message?: string } } }).response?.data?.message || fallback;
  }
  return fallback;
};

export default function DoctorPatientDetailsPage() {
  const params = useParams<{ id: string }>();
  const patientId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const [data, setData] = useState<PatientDetailsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!patientId) return;

    const timeoutId = window.setTimeout(() => {
      void (async () => {
        try {
          setLoading(true);
          const response = await api.get(`/doctor/patients/${patientId}`);
          setData(response.data?.data || null);
        } catch (error) {
          toast.error(getErrorMessage(error, 'Failed to load patient details'));
          setData(null);
        } finally {
          setLoading(false);
        }
      })();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [patientId]);

  if (loading) {
    return <div className="mx-auto max-w-[1180px] text-sm text-slate-500">Loading patient details...</div>;
  }

  if (!data) {
    return <div className="mx-auto max-w-[1180px] text-sm text-slate-500">Patient details not available.</div>;
  }

  return (
    <div className="mx-auto max-w-[1180px] space-y-4">
      <div className="flex items-center justify-between">
        <Link href={getDoctorPath('/my-patients')}>
          <Button variant="outline" className="rounded-xl border-slate-200">
            <ArrowLeft size={16} className="mr-2" />
            Back to patient list
          </Button>
        </Link>
        <Link href={getDoctorPath(`/prescription?patientId=${data.patient?._id || ''}`)}>
          <Button className="rounded-xl bg-primary text-white hover:bg-primary/90">
            <FilePlus2 size={16} className="mr-2" />
            Prescribe
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
        <Card className="rounded-3xl border border-slate-200 py-0 shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
          <CardHeader className="px-5 pt-5">
            <CardTitle className="text-2xl font-semibold text-slate-950">{data.patient?.patientName || 'Patient Details'}</CardTitle>
            <CardDescription>
              Patient profile and treatment relationship overview
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 px-5 pb-5 pt-0 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2 text-slate-900">
                <UserRound size={16} className="text-primary" />
                <span className="text-sm font-semibold">Patient profile</span>
              </div>
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                <p>Age: {data.patient?.age || '-'}</p>
                <p>Gender: {data.patient?.gender || '-'}</p>
                <p>Blood group: {data.patient?.bloodGroup || '-'}</p>
                <p>Status: {data.patient?.status || '-'}</p>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2 text-slate-900">
                <ShieldPlus size={16} className="text-emerald-600" />
                <span className="text-sm font-semibold">Care summary</span>
              </div>
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                <p>Department: {data.careSummary?.department || '-'}</p>
                <p>Specialization: {data.careSummary?.specialization || '-'}</p>
                <p>Total visits: {data.careSummary?.totalVisits || 0}</p>
                <p>Completed visits: {data.careSummary?.completedVisits || 0}</p>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2 text-slate-900">
                <Mail size={16} className="text-amber-600" />
                <span className="text-sm font-semibold">Contact</span>
              </div>
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                <p>Email: {data.patient?.email || 'Not available'}</p>
                <p>Phone: {data.patient?.phone || 'Not available'}</p>
                <p>Emergency: {data.patient?.emergencyContact || 'Not available'}</p>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2 text-slate-900">
                <Phone size={16} className="text-rose-600" />
                <span className="text-sm font-semibold">Next visit</span>
              </div>
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                {data.careSummary?.upcomingAppointment ? (
                  <>
                    <p>{new Date(data.careSummary.upcomingAppointment.appointmentDate).toLocaleDateString()}</p>
                    <p>Time: {data.careSummary.upcomingAppointment.appointmentTime}</p>
                    <Badge variant="secondary" className="rounded-full bg-blue-50 text-primary">
                      {data.careSummary.upcomingAppointment.status}
                    </Badge>
                  </>
                ) : (
                  <p>No upcoming appointment scheduled.</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border border-slate-200 py-0 shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
          <CardHeader className="px-5 pt-5">
            <CardTitle className="text-lg font-semibold text-slate-950">Address</CardTitle>
            <CardDescription>Patient location reference</CardDescription>
          </CardHeader>
          <CardContent className="px-5 pb-5 pt-0 text-sm text-slate-600">
            {data.patient?.address || 'Address not provided'}
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden rounded-2xl border border-slate-200 py-0 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
        <CardHeader className="border-b border-slate-200 px-4 py-4">
          <CardTitle className="text-base font-semibold text-slate-950">Recent appointments</CardTitle>
          <CardDescription>Doctor-side appointment history for this patient</CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <Table>
            <TableHeader className="bg-slate-50/70">
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Date</TableHead>
                <TableHead className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Time</TableHead>
                <TableHead className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Department</TableHead>
                <TableHead className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Status</TableHead>
                <TableHead className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Payment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!data.recentAppointments || data.recentAppointments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                    No appointment history found.
                  </TableCell>
                </TableRow>
              ) : (
                data.recentAppointments.map((appointment) => (
                  <TableRow key={appointment._id}>
                    <TableCell className="px-4 py-3 text-xs text-slate-900">
                      {new Date(appointment.appointmentDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-xs text-slate-500">{appointment.appointmentTime}</TableCell>
                    <TableCell className="px-4 py-3 text-xs text-slate-500">{appointment.department}</TableCell>
                    <TableCell className="px-4 py-3">
                      <Badge variant="secondary" className="rounded-full bg-slate-100 text-slate-700">
                        {appointment.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-xs text-slate-500">
                      {appointment.paymentStatus} / Rs. {appointment.consultationFee}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
