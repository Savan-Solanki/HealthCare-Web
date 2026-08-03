'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Eye, FilePlus2, Search, UsersRound } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getDoctorPath } from '@/lib/routes';

type DoctorPatient = {
  _id: string;
  patientName: string;
  email?: string | null;
  phone?: string | null;
  age?: number | null;
  gender?: string | null;
  bloodGroup?: string | null;
  status: 'Active' | 'Inactive';
  totalVisits: number;
  lastVisit?: string | null;
  nextVisit?: string | null;
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    return (error as { response?: { data?: { message?: string } } }).response?.data?.message || fallback;
  }
  return fallback;
};

export default function DoctorMyPatientsPage() {
  const [patients, setPatients] = useState<DoctorPatient[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void (async () => {
        try {
          setLoading(true);
          const response = await api.get('/doctor/patients', {
            params: search.trim() ? { search: search.trim() } : undefined,
          });
          setPatients(response.data?.data || []);
        } catch (error) {
          toast.error(getErrorMessage(error, 'Failed to load patient list'));
          setPatients([]);
        } finally {
          setLoading(false);
        }
      })();
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [search]);

  const activePatients = patients.filter((patient) => patient.status === 'Active').length;

  return (
    <div className="mx-auto max-w-[1180px] space-y-4">
      <nav className="flex items-center gap-1.5 text-xs text-slate-500">
        <Link href="/" className="transition-colors hover:text-slate-900">
          Home
        </Link>
        <span>/</span>
        <span className="font-medium text-slate-900">My Patient</span>
      </nav>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">My Patient</h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Patient list for this doctor with direct actions to view details or prescribe.
          </p>
        </div>
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search patient by name, email, or phone"
            className="h-10 rounded-xl border-gray-200 bg-gray-50 pl-9"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-2xl border border-slate-200 py-0 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
          <CardHeader className="px-4 pt-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-primary">
              <UsersRound size={18} />
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-1">
            <div className="text-[1.7rem] font-semibold text-slate-950">{patients.length}</div>
            <div className="text-xs text-slate-500">Total patients under care</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border border-slate-200 py-0 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
          <CardHeader className="px-4 pt-4">
            <CardTitle className="text-sm font-semibold text-slate-950">Active patients</CardTitle>
            <CardDescription>Current active treatment relationships</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <div className="text-[1.7rem] font-semibold text-slate-950">{activePatients}</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border border-slate-200 py-0 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
          <CardHeader className="px-4 pt-4">
            <CardTitle className="text-sm font-semibold text-slate-950">Flow</CardTitle>
            <CardDescription>My Patient to Patient list to action workflow</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <div className="text-sm text-slate-600">Patient list</div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <Badge variant="secondary" className="rounded-full bg-blue-50 text-primary">View Details</Badge>
              <Badge variant="secondary" className="rounded-full bg-emerald-50 text-emerald-600">Prescribe</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden rounded-2xl border border-slate-200 py-0 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
        <CardHeader className="border-b border-slate-200 px-4 py-4">
          <CardTitle className="text-base font-semibold text-slate-950">Patient list</CardTitle>
          <CardDescription>Choose a patient and continue with details or prescription</CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <Table>
            <TableHeader className="bg-slate-50/70">
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Patient</TableHead>
                <TableHead className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Contact</TableHead>
                <TableHead className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Profile</TableHead>
                <TableHead className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Visits</TableHead>
                <TableHead className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Status</TableHead>
                <TableHead className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-500">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                    Loading patient list...
                  </TableCell>
                </TableRow>
              ) : patients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                    No patients found for this doctor yet.
                  </TableCell>
                </TableRow>
              ) : (
                patients.map((patient) => (
                  <TableRow key={patient._id}>
                    <TableCell className="px-4 py-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-950">{patient.patientName}</div>
                        <div className="text-xs text-slate-500">
                          Last visit: {patient.lastVisit ? new Date(patient.lastVisit).toLocaleDateString() : 'N/A'}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-xs text-slate-500">
                      <div>{patient.email || 'No email'}</div>
                      <div>{patient.phone || 'No phone'}</div>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-xs text-slate-500">
                      {patient.age || '-'} yrs, {patient.gender || '-'}, {patient.bloodGroup || '-'}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-xs text-slate-900">{patient.totalVisits}</TableCell>
                    <TableCell className="px-4 py-3">
                      <Badge
                        variant="secondary"
                        className={patient.status === 'Active' ? 'rounded-full bg-emerald-50 text-emerald-600' : 'rounded-full bg-slate-100 text-slate-600'}
                      >
                        {patient.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Link href={getDoctorPath(`/my-patients/${patient._id}`)}>
                          <Button variant="outline" className="h-8 rounded-lg border-slate-200 text-xs">
                            <Eye size={14} className="mr-1.5" />
                            View Details
                          </Button>
                        </Link>
                        <Link href={getDoctorPath(`/prescription?patientId=${patient._id}`)}>
                          <Button className="h-8 rounded-lg bg-primary text-xs text-white hover:bg-primary/90">
                            <FilePlus2 size={14} className="mr-1.5" />
                            Prescribe
                          </Button>
                        </Link>
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
  );
}
