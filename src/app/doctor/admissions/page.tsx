'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Bed,
  Search,
  FileText,
  RefreshCw,
  Activity,
  HeartPulse,
  Info,
  Loader2,
  Save,
  CheckCircle,
  Plus,
  Trash2,
  Calendar,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

type AdmissionStatus = 'Admitted' | 'Under Treatment' | 'Critical' | 'Stable' | 'Discharged';

type AdmissionRecord = {
  _id: string;
  admissionId: string;
  patientRecordId: string;
  patientName: string;
  patientEmail?: string;
  patientPhone?: string;
  appointmentId: string;
  doctorId: string;
  doctorName: string;
  department: string;
  admissionDate: string;
  admissionReason: string;
  roomNumber?: string;
  bedNumber?: string;
  notes?: string;
  status: AdmissionStatus;
  dischargeDate?: string;
};

type MedicationItem = {
  medicineName: string;
  dose: string;
  frequency: string;
  duration: string;
};

type DischargeSummaryForm = {
  diagnosis: string;
  historyAndClinicalSummary: string;
  treatmentGiven: string;
  investigations: string;
  surgeryProcedureName: string;
  surgeryDate: string;
  surgeonName: string;
  anesthesiologistName: string;
  surgicalNotes: string;
  conditionOnDischarge: string;
  hospitalCourseSummary: string;
  medications: MedicationItem[];
  followUpDate: string;
  followUpInstructions: string;
  dischargeType: string;
};

const initialDischargeForm: DischargeSummaryForm = {
  diagnosis: '',
  historyAndClinicalSummary: '',
  treatmentGiven: '',
  investigations: '',
  surgeryProcedureName: '',
  surgeryDate: '',
  surgeonName: '',
  anesthesiologistName: '',
  surgicalNotes: '',
  conditionOnDischarge: 'Stable',
  hospitalCourseSummary: '',
  medications: [],
  followUpDate: '',
  followUpInstructions: '',
  dischargeType: 'Regular',
};

function StatusBadge({ status }: { status: AdmissionStatus }) {
  const styles: Record<AdmissionStatus, string> = {
    Admitted: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-50',
    'Under Treatment': 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-50',
    Critical: 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-50 animate-pulse',
    Stable: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50',
    Discharged: 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-50',
  };
  return (
    <Badge variant="outline" className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${styles[status]}`}>
      {status}
    </Badge>
  );
}

export default function DoctorAdmissionsPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [tab, setTab] = useState<'my' | 'all'>('my');
  const [admissions, setAdmissions] = useState<AdmissionRecord[]>([]);

  // Update status state
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [statusTarget, setStatusTarget] = useState<AdmissionRecord | null>(null);
  const [statusValue, setStatusValue] = useState<AdmissionStatus>('Admitted');
  const [treatmentNote, setTreatmentNote] = useState('');
  const [statusSaving, setStatusSaving] = useState(false);

  // Discharge Summary Editor Dialog state
  const [isDischargeOpen, setIsDischargeOpen] = useState(false);
  const [dischargeTarget, setDischargeTarget] = useState<AdmissionRecord | null>(null);
  const [dischargeForm, setDischargeForm] = useState<DischargeSummaryForm>(initialDischargeForm);
  const [medName, setMedName] = useState('');
  const [medDose, setMedDose] = useState('');
  const [medFreq, setMedFreq] = useState('');
  const [medDur, setMedDur] = useState('');
  const [dischargeSaving, setDischargeSaving] = useState(false);

  // IPD treatments and billing states
  const [treatments, setTreatments] = useState<any[]>([]);
  const [loadingTreatments, setLoadingTreatments] = useState(false);
  const [billingSummary, setBillingSummary] = useState<any>(null);
  const [timelineCategoryFilter, setTimelineCategoryFilter] = useState('all');
  const [timelineDateFilter, setTimelineDateFilter] = useState('');
  const [timelineSearch, setTimelineSearch] = useState('');

  const fetchTreatments = async (admissionId: string) => {
    try {
      setLoadingTreatments(true);
      const res = await api.get(`/hospital-admin/admissions/${admissionId}/treatments`);
      if (res.data?.success) {
        setTreatments(res.data.data || []);
      }
    } catch {
      toast.error('Failed to load treatments.');
    } finally {
      setLoadingTreatments(false);
    }
  };

  const fetchBillingSummary = async (admissionId: string) => {
    try {
      const res = await api.get(`/hospital-admin/admissions/${admissionId}/billing-summary`);
      if (res.data?.success) {
        setBillingSummary(res.data.data || null);
      }
    } catch {
      // non-fatal
    }
  };


  const getErrorMessage = (error: unknown, fallback: string) => {
    if (typeof error === 'object' && error !== null && 'response' in error) {
      return (error as { response?: { data?: { message?: string } } }).response?.data?.message || fallback;
    }
    return fallback;
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  const loadProfile = async () => {
    try {
      const response = await api.get('/auth/me');
      if (response.data?.user) {
        setCurrentUser(response.data.user);
      }
    } catch (err) {
      console.error('Failed to load user profile:', err);
    }
  };

  const loadAdmissions = useCallback(async (query = debouncedSearch) => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (query.trim()) params.search = query.trim();

      // Fetch admissions
      const response = await api.get('/doctor/admissions', { params });
      if (response.data?.success) {
        setAdmissions(response.data.data || []);
      }
    } catch (error) {
      toast.error('Failed to load admitted patients list.');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch]);

  const initData = useCallback(async () => {
    await Promise.all([loadProfile(), loadAdmissions()]);
  }, [loadAdmissions]);

  useEffect(() => {
    void initData();
  }, [initData]);

  // Socket IO sync
  useEffect(() => {
    const socket = getSocket();
    if (socket) {
      const handleUpdate = () => {
        void loadAdmissions();
      };
      socket.on('admission_created', handleUpdate);
      socket.on('admission_updated', handleUpdate);
      socket.on('admission_status_changed', handleUpdate);
      socket.on('patient_discharged', handleUpdate);
      return () => {
        socket.off('admission_created', handleUpdate);
        socket.off('admission_updated', handleUpdate);
        socket.off('admission_status_changed', handleUpdate);
        socket.off('patient_discharged', handleUpdate);
      };
    }
  }, [loadAdmissions]);

  // Filtering admissions: "my" shows patients assigned to this doctor name
  const filteredAdmissions = admissions.filter((admission) => {
    if (tab === 'my' && currentUser) {
      const doctorNorm = String(admission.doctorName || '').toLowerCase().replace(/^dr\.?\s+/i, '');
      const userNorm = String(currentUser.name || '').toLowerCase().replace(/^dr\.?\s+/i, '');
      return doctorNorm.includes(userNorm) || userNorm.includes(doctorNorm);
    }
    return true;
  });

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusTarget) return;

    try {
      setStatusSaving(true);
      await api.patch(`/doctor/admissions/${statusTarget._id}/status`, {
        status: statusValue,
        treatmentNote: treatmentNote.trim() || undefined,
      });

      toast.success('Patient medical status updated.');
      setIsStatusOpen(false);
      setStatusTarget(null);
      setTreatmentNote('');
      void loadAdmissions();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to update status.'));
    } finally {
      setStatusSaving(false);
    }
  };

  const handleOpenDischarge = async (admission: AdmissionRecord) => {
    setDischargeTarget(admission);
    setDischargeForm(initialDischargeForm);
    setIsDischargeOpen(true);

    void fetchTreatments(admission._id);
    void fetchBillingSummary(admission._id);

    try {
      // Check if there is an existing draft
      const response = await api.get('/hospital-admin/discharges', {
        params: { isDraft: 'all', search: admission._id },
      });

      if (response.data?.success && response.data.data?.length > 0) {
        const draft = response.data.data[0];
        setDischargeForm({
          diagnosis: draft.diagnosis || '',
          historyAndClinicalSummary: draft.historyAndClinicalSummary || '',
          treatmentGiven: draft.treatmentGiven || '',
          investigations: draft.investigations || '',
          surgeryProcedureName: draft.surgeryProcedureName || '',
          surgeryDate: draft.surgeryDate ? new Date(draft.surgeryDate).toISOString().split('T')[0] : '',
          surgeonName: draft.surgeonName || '',
          anesthesiologistName: draft.anesthesiologistName || '',
          surgicalNotes: draft.surgicalNotes || '',
          conditionOnDischarge: draft.conditionOnDischarge || 'Stable',
          hospitalCourseSummary: draft.hospitalCourseSummary || '',
          medications: draft.medications || [],
          followUpDate: draft.followUpDate ? new Date(draft.followUpDate).toISOString().split('T')[0] : '',
          followUpInstructions: draft.followUpInstructions || '',
          dischargeType: draft.dischargeType || 'Regular',
        });
        toast.info('Existing draft discharge summary loaded.');
      }
    } catch (err) {
      console.error('Failed to load discharge summary details:', err);
    }
  };

  const handleAddMedication = () => {
    if (!medName.trim() || !medDose.trim()) {
      toast.error('Medicine name and dose are required.');
      return;
    }
    const item: MedicationItem = {
      medicineName: medName.trim(),
      dose: medDose.trim(),
      frequency: medFreq.trim() || 'Once Daily',
      duration: medDur.trim() || '5 Days',
    };
    setDischargeForm({
      ...dischargeForm,
      medications: [...dischargeForm.medications, item],
    });
    setMedName('');
    setMedDose('');
    setMedFreq('');
    setMedDur('');
  };

  const handleDeleteMedication = (index: number) => {
    setDischargeForm({
      ...dischargeForm,
      medications: dischargeForm.medications.filter((_, i) => i !== index),
    });
  };

  const submitDischarge = async (isDraft: boolean) => {
    if (!dischargeTarget) return;

    if (!dischargeForm.diagnosis.trim()) {
      toast.error('Diagnosis is required.');
      return;
    }

    try {
      setDischargeSaving(true);
      await api.post(`/doctor/admissions/${dischargeTarget._id}/discharge`, {
        ...dischargeForm,
        isDraft,
      });

      toast.success(isDraft ? 'Discharge summary draft saved.' : 'Patient discharged successfully.');
      setIsDischargeOpen(false);
      setDischargeTarget(null);
      void loadAdmissions();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to complete discharge operation.'));
    } finally {
      setDischargeSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1180px] space-y-6">
      <nav className="flex items-center gap-1.5 text-xs text-slate-500">
        <Link href="/" className="transition-colors hover:text-slate-900">
          Home
        </Link>
        <span>/</span>
        <span className="font-medium text-slate-900">Admitted Patients</span>
      </nav>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Hospital Admitted Patients</h1>
          <p className="mt-1 text-sm text-slate-500">
            View patient health status, record treatments, and write discharge summaries.
          </p>
        </div>
        <Button
          variant="outline"
          className="rounded-xl border-slate-200"
          onClick={() => void loadAdmissions()}
        >
          <RefreshCw size={15} className="mr-1.5" />
          Refresh
        </Button>
      </div>

      <div className="flex flex-col gap-4">
        {/* Tabs for My Patients vs All Patients */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <Tabs value={tab} onValueChange={(val) => setTab(val as any)} className="w-[300px]">
            <TabsList className="grid grid-cols-2 rounded-xl bg-slate-100 p-1">
              <TabsTrigger value="my" className="rounded-lg text-xs font-semibold">
                My Patients
              </TabsTrigger>
              <TabsTrigger value="all" className="rounded-lg text-xs font-semibold">
                All Admissions
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search patient name..."
              className="pl-9 h-10 rounded-xl"
            />
          </div>
        </div>

        {/* Patients Table */}
        <Card className="rounded-3xl border border-slate-200 py-0 shadow-[0_8px_24px_rgba(15,23,42,0.04)] bg-white">
          <CardContent className="px-0 pb-0 pt-0">
            <Table>
              <TableHeader className="bg-slate-50/70">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Patient Details</TableHead>
                  <TableHead className="px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Beds / Ward</TableHead>
                  <TableHead className="px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Admitting Doctor</TableHead>
                  <TableHead className="px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Admission Date</TableHead>
                  <TableHead className="px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Status</TableHead>
                  <TableHead className="px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="px-5 py-10 text-center text-sm text-slate-500">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" />
                      <span className="mt-2 block text-xs">Loading patient board...</span>
                    </TableCell>
                  </TableRow>
                ) : filteredAdmissions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="px-5 py-10 text-center text-sm text-slate-500">
                      No admitted patients found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAdmissions.map((admission) => (
                    <TableRow key={admission._id}>
                      <TableCell className="px-5 py-3">
                        <div className="space-y-1">
                          <div className="text-xs font-semibold text-slate-950">{admission.patientName}</div>
                          <div className="text-[10px] font-mono text-slate-400">ID: {admission.admissionId}</div>
                          {(admission.patientPhone || admission.patientEmail) && (
                            <div className="text-[10px] text-slate-500">
                              {admission.patientPhone && <span>{admission.patientPhone}</span>}
                              {admission.patientPhone && admission.patientEmail && <span className="mx-1 text-slate-300">•</span>}
                              {admission.patientEmail && <span className="break-all">{admission.patientEmail}</span>}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="px-5 py-3">
                        {admission.roomNumber ? (
                          <div className="text-xs font-semibold text-slate-900">
                            Room {admission.roomNumber}
                            {admission.bedNumber && <span className="text-[11px] font-normal text-slate-500 ml-1">(Bed {admission.bedNumber})</span>}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Unassigned</span>
                        )}
                      </TableCell>
                      <TableCell className="px-5 py-3 text-xs text-slate-500">
                        Dr. {admission.doctorName}
                      </TableCell>
                      <TableCell className="px-5 py-3 text-xs text-slate-500">
                        {new Date(admission.admissionDate).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="px-5 py-3">
                        <StatusBadge status={admission.status} />
                      </TableCell>
                      <TableCell className="px-5 py-3">
                        <div className="flex justify-end gap-1.5">
                          {admission.status !== 'Discharged' ? (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 rounded-lg px-2 text-xs"
                                onClick={() => {
                                  setStatusTarget(admission);
                                  setStatusValue(admission.status);
                                  setIsStatusOpen(true);
                                }}
                              >
                                Update Status
                              </Button>
                              <Button
                                size="sm"
                                className="h-8 rounded-lg px-2 text-xs bg-teal-600 hover:bg-teal-700 text-white"
                                onClick={() => void handleOpenDischarge(admission)}
                              >
                                Discharge Summary
                              </Button>
                            </>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              {(() => {
                                const diffTime = Math.abs(new Date().getTime() - new Date(admission.admissionDate).getTime());
                                const diffDays = diffTime / (1000 * 60 * 60 * 24);
                                if (diffDays <= 7) {
                                  return (
                                    <>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 rounded-lg px-2 text-xs"
                                        onClick={() => {
                                          setStatusTarget(admission);
                                          setStatusValue(admission.status);
                                          setIsStatusOpen(true);
                                        }}
                                      >
                                        Update Status
                                      </Button>
                                      <Button
                                        size="sm"
                                        className="h-8 rounded-lg px-2 text-xs bg-teal-600 hover:bg-teal-700 text-white"
                                        onClick={() => void handleOpenDischarge(admission)}
                                      >
                                        Edit Discharge
                                      </Button>
                                    </>
                                  );
                                }
                                return <span className="text-xs text-slate-400 font-medium px-2">Finalized</span>;
                              })()}
                            </div>
                          )}
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

      {/* Update Status Dialog */}
      <Dialog open={isStatusOpen} onOpenChange={setIsStatusOpen}>
        <DialogContent className="rounded-2xl sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Update Patient Status</DialogTitle>
            <DialogDescription>
              Record clinical progress and set status for {statusTarget?.patientName}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void handleUpdateStatus(e)} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Medical Status</Label>
              <Select value={statusValue} onValueChange={(val) => setStatusValue(val as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Admitted">Admitted</SelectItem>
                  <SelectItem value="Under Treatment">Under Treatment</SelectItem>
                  <SelectItem value="Stable">Stable</SelectItem>
                  <SelectItem value="Critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="status-note">Progress / Treatment Notes</Label>
              <Textarea
                id="status-note"
                value={treatmentNote}
                onChange={(e) => setTreatmentNote(e.target.value)}
                placeholder="Describe treatment administered, physical symptoms, progress details..."
                rows={4}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsStatusOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={statusSaving} className="bg-primary text-white hover:bg-primary/90">
                {statusSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Update Status
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Discharge Summary Form Dialog (IPD Manage Portal) */}
      <Dialog open={isDischargeOpen} onOpenChange={setIsDischargeOpen}>
        <DialogContent className="rounded-2xl sm:max-w-[850px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">IPD Portal - {dischargeTarget?.patientName}</DialogTitle>
            <DialogDescription>
              View treatment logs, running bill timeline, and manage clinical discharge records.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="treatments" className="w-full mt-4">
            <TabsList className="grid w-full grid-cols-4 rounded-xl bg-slate-100 p-1">
              <TabsTrigger value="treatments" className="rounded-lg text-xs font-semibold">Treatments Log</TabsTrigger>
              <TabsTrigger value="timeline" className="rounded-lg text-xs font-semibold">Timeline</TabsTrigger>
              <TabsTrigger value="billing" className="rounded-lg text-xs font-semibold">Billing Summary</TabsTrigger>
              <TabsTrigger value="discharge" className="rounded-lg text-xs font-semibold">Discharge &amp; Notes</TabsTrigger>
            </TabsList>

            {/* Tab 1: Admission Treatments (Read-Only for Doctors) */}
            <TabsContent value="treatments" className="space-y-4 mt-4">
              <div className="rounded-xl border border-slate-150 overflow-hidden">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="py-2.5 text-[10px] font-bold text-slate-500">Date/Time</TableHead>
                      <TableHead className="py-2.5 text-[10px] font-bold text-slate-500">Category</TableHead>
                      <TableHead className="py-2.5 text-[10px] font-bold text-slate-500">Item Description</TableHead>
                      <TableHead className="py-2.5 text-[10px] font-bold text-slate-500 text-right">Qty</TableHead>
                      <TableHead className="py-2.5 text-[10px] font-bold text-slate-500 text-right">Rate</TableHead>
                      <TableHead className="py-2.5 text-[10px] font-bold text-slate-500 text-right">Total Charge</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingTreatments ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-xs text-slate-400 py-6">
                          <Loader2 className="h-4 w-4 animate-spin mx-auto text-primary mb-1.5" />
                          Loading patient treatments log...
                        </TableCell>
                      </TableRow>
                    ) : treatments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-xs text-slate-400 py-6">
                          No treatment logs added for this admission stay.
                        </TableCell>
                      </TableRow>
                    ) : (
                      treatments.map((t) => (
                        <TableRow key={t._id} className="text-xs">
                          <TableCell className="py-2.5 font-medium text-slate-500">
                            {new Date(t.dateAndTime).toLocaleDateString('en-IN')} {new Date(t.dateAndTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                          </TableCell>
                          <TableCell className="py-2.5">
                            <Badge variant="secondary" className="text-[10px] font-medium px-2 py-0.5 rounded-full">{t.category}</Badge>
                          </TableCell>
                          <TableCell className="py-2.5">
                            <div>
                              <div className="font-semibold text-slate-900">{t.treatmentName}</div>
                              {(t.description || t.notes) && (
                                <div className="text-[10px] text-slate-400 truncate max-w-xs">{t.description || t.notes}</div>
                              )}
                              <div className="text-[9px] text-slate-350">Logged by: {t.addedByName}</div>
                            </div>
                          </TableCell>
                          <TableCell className="py-2.5 text-right font-medium">{t.quantity} {t.unit}</TableCell>
                          <TableCell className="py-2.5 text-right text-slate-600">₹{t.unitPrice.toFixed(2)}</TableCell>
                          <TableCell className="py-2.5 text-right font-semibold text-slate-900">₹{t.totalAmount.toFixed(2)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* Tab 2: Treatment Timeline */}
            <TabsContent value="timeline" className="space-y-4 mt-4">
              <div className="flex flex-wrap items-center gap-2 pb-2 border-b border-slate-100">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 h-3.5 w-3.5" />
                  <Input
                    value={timelineSearch}
                    onChange={(e) => setTimelineSearch(e.target.value)}
                    placeholder="Filter timeline by item name..."
                    className="pl-8 h-8 text-xs rounded-lg"
                  />
                </div>
                <Select value={timelineCategoryFilter} onValueChange={(val) => setTimelineCategoryFilter(val || 'all')}>
                  <SelectTrigger className="w-[140px] text-xs h-8 rounded-lg">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {[
                      "Medicines",
                      "Injections",
                      "IV Fluids",
                      "Lab Tests",
                      "X-Ray",
                      "CT Scan",
                      "MRI",
                      "ECG",
                      "Oxygen",
                      "Nebulization",
                      "Physiotherapy",
                      "Surgery/Operation",
                      "ICU Charges",
                      "Room Charges",
                      "Nursing Charges",
                      "Medical Equipment Usage",
                      "Hospital Consumables",
                      "Doctor Visit Charges",
                      "Custom Treatment/Procedure"
                    ].map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="date"
                  value={timelineDateFilter}
                  onChange={(e) => setTimelineDateFilter(e.target.value)}
                  className="w-[140px] text-xs h-8 rounded-lg"
                />
                {(timelineSearch || timelineCategoryFilter !== 'all' || timelineDateFilter) && (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setTimelineSearch('');
                      setTimelineCategoryFilter('all');
                      setTimelineDateFilter('');
                    }}
                    className="h-8 text-xs px-2 text-slate-500"
                  >
                    Clear Filters
                  </Button>
                )}
              </div>

              <div className="relative border-l border-slate-200 ml-4 pl-6 space-y-6 max-h-[50vh] overflow-y-auto py-2">
                {treatments
                  .filter((t) => {
                    const matchesSearch = !timelineSearch || t.treatmentName.toLowerCase().includes(timelineSearch.toLowerCase());
                    const matchesCat = timelineCategoryFilter === 'all' || t.category === timelineCategoryFilter;
                    const matchesDate = !timelineDateFilter || new Date(t.dateAndTime).toLocaleDateString('en-IN') === new Date(timelineDateFilter).toLocaleDateString('en-IN');
                    return matchesSearch && matchesCat && matchesDate;
                  })
                  .map((t) => (
                    <div key={t._id} className="relative">
                      <span className="absolute -left-[31px] top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-teal-500 border border-white shadow-sm ring-4 ring-white" />
                      
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-800">
                            {new Date(t.dateAndTime).toLocaleDateString('en-IN')} {new Date(t.dateAndTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <Badge variant="outline" className="text-[9px] font-medium text-slate-500 border-slate-200 px-2 py-0">{t.category}</Badge>
                        </div>
                        <div className="text-sm font-bold text-slate-900">{t.treatmentName}</div>
                        {(t.description || t.notes) && (
                          <p className="text-xs text-slate-500 leading-relaxed bg-slate-50/50 p-2 rounded-lg border border-slate-100 max-w-xl">
                            {t.description || t.notes}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-4 text-[10px] text-slate-400">
                          <span>Qty: <span className="font-semibold text-slate-600">{t.quantity} {t.unit}</span></span>
                          <span>Rate: <span className="font-semibold text-slate-600">₹{t.unitPrice.toFixed(2)}</span></span>
                          <span>Total: <span className="font-semibold text-slate-800 text-xs">₹{t.totalAmount.toFixed(2)}</span></span>
                          <span>Logged by: <span className="font-semibold text-slate-500">{t.addedByName}</span></span>
                        </div>
                      </div>
                    </div>
                  ))}
                
                {treatments.length === 0 && (
                  <div className="text-center text-xs text-slate-400 py-10 -ml-4 pr-6">
                    No timeline entries to show. Logged treatments will populate the timeline.
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Tab 3: Billing Summary */}
            <TabsContent value="billing" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 rounded-xl border border-slate-150 p-4 space-y-3 bg-white">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider pb-2 border-b border-slate-100">Category-wise Summary</div>
                  <div className="space-y-2">
                    {billingSummary?.categoriesBreakdown?.length === 0 ? (
                      <p className="text-xs text-slate-400 py-4 text-center">No billable entries logged yet.</p>
                    ) : (
                      billingSummary?.categoriesBreakdown?.map((b: any) => (
                        <div key={b.category} className="flex justify-between items-center text-xs py-1 border-b border-slate-50 last:border-0">
                          <span className="font-medium text-slate-700">{b.category} ({b.count} logs)</span>
                          <span className="font-semibold text-slate-900">₹{b.amount.toFixed(2)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-900 text-white p-5 space-y-4 flex flex-col justify-between">
                  <div className="space-y-2.5">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800 pb-1.5">Running Bill Total</div>
                    <div className="flex justify-between text-xs text-slate-350">
                      <span>Subtotal (Incl. GST)</span>
                      <span>₹{(billingSummary?.subtotal || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-350">
                      <span>Incl. Tax/GST (18%)</span>
                      <span>₹{(billingSummary?.tax || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-red-400">
                      <span>Discount (0%)</span>
                      <span>- ₹0.00</span>
                    </div>
                  </div>

                  <div className="border-t border-slate-800 pt-3 flex justify-between items-baseline">
                    <span className="text-xs font-bold text-slate-400 uppercase">Grand Total</span>
                    <span className="text-xl font-black text-teal-400">₹{(billingSummary?.total || 0).toFixed(2)}</span>
                  </div>
                </div>
              </div>
              
              <div className="rounded-xl border border-slate-150 overflow-hidden bg-slate-50/20">
                <div className="p-3 bg-slate-100/70 border-b border-slate-150 text-xs font-bold text-slate-600">Itemized Billings</div>
                <div className="max-h-[30vh] overflow-y-auto">
                  <Table>
                    <TableHeader className="bg-slate-50/50">
                      <TableRow>
                        <TableHead className="py-2 text-[9px] font-bold text-slate-500">Item / Category</TableHead>
                        <TableHead className="py-2 text-[9px] font-bold text-slate-500 text-right">Qty</TableHead>
                        <TableHead className="py-2 text-[9px] font-bold text-slate-500 text-right">Unit Price</TableHead>
                        <TableHead className="py-2 text-[9px] font-bold text-slate-500 text-right">Total Charge</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {treatments.map((t) => (
                        <TableRow key={t._id} className="text-xs">
                          <TableCell className="py-2">
                            <span className="font-semibold text-slate-900">{t.treatmentName}</span>
                            <span className="text-[10px] text-slate-400 ml-1.5">({t.category})</span>
                          </TableCell>
                          <TableCell className="py-2 text-right">{t.quantity} {t.unit}</TableCell>
                          <TableCell className="py-2 text-right text-slate-500">₹{t.unitPrice.toFixed(2)}</TableCell>
                          <TableCell className="py-2 text-right font-semibold text-slate-800">₹{t.totalAmount.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                      {treatments.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-xs text-slate-400 py-6">No billable treatments recorded yet.</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </TabsContent>

            {/* Tab 4: Discharge Summary & Clinical Notes */}
            <TabsContent value="discharge" className="space-y-4 mt-4">
              <div className="space-y-6">
                {/* Section 1: Clinical Details */}
                <div className="space-y-4 rounded-xl border border-slate-100 p-4 bg-slate-50/50">
                  <h3 className="text-sm font-bold text-teal-800 uppercase tracking-wider">1. Clinical Details</h3>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="diag">Final Diagnosis *</Label>
                      <Input
                        id="diag"
                        value={dischargeForm.diagnosis}
                        onChange={(e) => setDischargeForm({ ...dischargeForm, diagnosis: e.target.value })}
                        placeholder="e.g. Acute Appendicitis, Type 2 Diabetes Mellitus"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="clinical-hist">History & Clinical Summary</Label>
                      <Textarea
                        id="clinical-hist"
                        value={dischargeForm.historyAndClinicalSummary}
                        onChange={(e) => setDischargeForm({ ...dischargeForm, historyAndClinicalSummary: e.target.value })}
                        placeholder="Record symptoms on admission, comorbidities, previous history..."
                        rows={3}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="invest">Investigations / Lab Findings</Label>
                      <Textarea
                        id="invest"
                        value={dischargeForm.investigations}
                        onChange={(e) => setDischargeForm({ ...dischargeForm, investigations: e.target.value })}
                        placeholder="Blood panels, X-Ray, CT Scan reports..."
                        rows={2}
                      />
                    </div>
                  </div>
                </div>

                {/* Section 2: Hospital Course & Treatment */}
                <div className="space-y-4 rounded-xl border border-slate-100 p-4 bg-slate-50/50">
                  <h3 className="text-sm font-bold text-teal-800 uppercase tracking-wider">2. Hospital Course & Treatment</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Discharge Type</Label>
                      <Select
                        value={dischargeForm.dischargeType}
                        onValueChange={(val) => setDischargeForm({ ...dischargeForm, dischargeType: val || '' })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Regular">Regular Discharge</SelectItem>
                          <SelectItem value="LAMA">LAMA (Left Against Medical Advice)</SelectItem>
                          <SelectItem value="Absconded">Absconded</SelectItem>
                          <SelectItem value="Transferred">Transferred to another facility</SelectItem>
                          <SelectItem value="Expired">Expired</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Condition on Discharge</Label>
                      <Select
                        value={dischargeForm.conditionOnDischarge}
                        onValueChange={(val) => setDischargeForm({ ...dischargeForm, conditionOnDischarge: val || '' })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Stable">Stable</SelectItem>
                          <SelectItem value="Improved">Improved</SelectItem>
                          <SelectItem value="Guarded">Guarded</SelectItem>
                          <SelectItem value="Critical">Critical</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="treat-given">Treatment Given</Label>
                    <Textarea
                      id="treat-given"
                      value={dischargeForm.treatmentGiven}
                      onChange={(e) => setDischargeForm({ ...dischargeForm, treatmentGiven: e.target.value })}
                      placeholder="e.g. Intravenous antibiotics, laparoscopic surgery, saline hydration..."
                      rows={2}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="course-summ">Hospital Course Summary</Label>
                    <Textarea
                      id="course-summ"
                      value={dischargeForm.hospitalCourseSummary}
                      onChange={(e) => setDischargeForm({ ...dischargeForm, hospitalCourseSummary: e.target.value })}
                      placeholder="Describe clinical progress, stability levels, fever patterns during hospital stay..."
                      rows={3}
                    />
                  </div>
                </div>

                {/* Section 3: Surgery Details */}
                <div className="space-y-4 rounded-xl border border-slate-100 p-4 bg-slate-50/50">
                  <h3 className="text-sm font-bold text-teal-800 uppercase tracking-wider">3. Surgery/Procedure Details (Optional)</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="surg-name">Procedure Name</Label>
                      <Input
                        id="surg-name"
                        value={dischargeForm.surgeryProcedureName}
                        onChange={(e) => setDischargeForm({ ...dischargeForm, surgeryProcedureName: e.target.value })}
                        placeholder="e.g. Laparoscopic Appendectomy"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="surg-date">Surgery Date</Label>
                      <Input
                        id="surg-date"
                        type="date"
                        value={dischargeForm.surgeryDate}
                        onChange={(e) => setDischargeForm({ ...dischargeForm, surgeryDate: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="surg-surgeon">Surgeon Name</Label>
                      <Input
                        id="surg-surgeon"
                        value={dischargeForm.surgeonName}
                        onChange={(e) => setDischargeForm({ ...dischargeForm, surgeonName: e.target.value })}
                        placeholder="Dr. Rajesh Sharma"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="surg-anes">Anesthesiologist</Label>
                      <Input
                        id="surg-anes"
                        value={dischargeForm.anesthesiologistName}
                        onChange={(e) => setDischargeForm({ ...dischargeForm, anesthesiologistName: e.target.value })}
                        placeholder="Dr. Amit Patel"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="surg-notes">Surgical Notes</Label>
                    <Textarea
                      id="surg-notes"
                      value={dischargeForm.surgicalNotes}
                      onChange={(e) => setDischargeForm({ ...dischargeForm, surgicalNotes: e.target.value })}
                      placeholder="Findings, specimen removed, anesthetic used, post-operative stability..."
                      rows={2.5}
                    />
                  </div>
                </div>

                {/* Section 4: Continuing Medications */}
                <div className="space-y-4 rounded-xl border border-slate-100 p-4 bg-slate-50/50">
                  <h3 className="text-sm font-bold text-teal-800 uppercase tracking-wider">4. Continuing Medications (Post-Discharge)</h3>
                  
                  {dischargeTarget?.status !== 'Discharged' && (
                    <div className="p-3 bg-white rounded-lg border border-slate-200/60 space-y-3">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[10px]">Medicine Name</Label>
                          <Input
                            placeholder="e.g. Amoxicillin 500mg"
                            value={medName}
                            onChange={(e) => setMedName(e.target.value)}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px]">Dosage</Label>
                          <Input
                            placeholder="e.g. 1 tablet / 5ml"
                            value={medDose}
                            onChange={(e) => setMedDose(e.target.value)}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px]">Frequency</Label>
                          <Input
                            placeholder="e.g. Thrice daily (1-0-1)"
                            value={medFreq}
                            onChange={(e) => setMedFreq(e.target.value)}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px]">Duration</Label>
                          <Input
                            placeholder="e.g. 5 days"
                            value={medDur}
                            onChange={(e) => setMedDur(e.target.value)}
                            className="h-8 text-xs"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          onClick={handleAddMedication}
                          className="h-7 text-[10px] rounded-lg bg-teal-600 hover:bg-teal-700 text-white"
                        >
                          Add Medicine
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead className="py-2 text-[9px] font-bold">Medicine Name</TableHead>
                          <TableHead className="py-2 text-[9px] font-bold text-center">Dosage</TableHead>
                          <TableHead className="py-2 text-[9px] font-bold text-center">Frequency</TableHead>
                          <TableHead className="py-2 text-[9px] font-bold text-center">Duration</TableHead>
                          {dischargeTarget?.status !== 'Discharged' && <TableHead className="py-2 text-[9px] font-bold text-center">Action</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dischargeForm.medications.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-xs text-slate-400 py-4">No continuing medications added.</TableCell>
                          </TableRow>
                        ) : (
                          dischargeForm.medications.map((m, idx) => (
                            <TableRow key={idx} className="text-xs">
                              <TableCell className="py-2 font-medium">{m.medicineName}</TableCell>
                              <TableCell className="py-2 text-center text-slate-500">{m.dose || '-'}</TableCell>
                              <TableCell className="py-2 text-center text-slate-500">{m.frequency || '-'}</TableCell>
                              <TableCell className="py-2 text-center text-slate-500">{m.duration || '-'}</TableCell>
                              {dischargeTarget?.status !== 'Discharged' && (
                                <TableCell className="py-2 text-center">
                                  <Button
                                    type="button"
                                    onClick={() => handleDeleteMedication(idx)}
                                    variant="ghost"
                                    className="h-6 w-6 p-0 text-red-500 hover:text-red-750"
                                  >
                                    🗑️
                                  </Button>
                                </TableCell>
                              )}
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Section 5: Follow Up */}
                <div className="space-y-4 rounded-xl border border-slate-100 p-4 bg-slate-50/50">
                  <h3 className="text-sm font-bold text-teal-800 uppercase tracking-wider">5. Follow-Up Instructions</h3>
                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="follow-date">Follow-Up Date</Label>
                      <Input
                        id="follow-date"
                        type="date"
                        value={dischargeForm.followUpDate}
                        onChange={(e) => setDischargeForm({ ...dischargeForm, followUpDate: e.target.value })}
                        className="w-fit"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="follow-instr">Advice &amp; Instructions</Label>
                      <Textarea
                        id="follow-instr"
                        value={dischargeForm.followUpInstructions}
                        onChange={(e) => setDischargeForm({ ...dischargeForm, followUpInstructions: e.target.value })}
                        placeholder="e.g. Avoid heavy lifting, wash incision daily, return immediately if fever exceeds 101F..."
                        rows={3}
                      />
                    </div>
                  </div>
                </div>

                {/* Lock warning if already discharged */}
                {dischargeTarget?.status === 'Discharged' && (Math.abs(new Date().getTime() - new Date(dischargeTarget.admissionDate).getTime()) / (1000 * 60 * 60 * 24) > 7) && (
                  <div className="rounded-xl border border-slate-200 bg-slate-100 p-4 text-xs text-slate-500 font-semibold text-center">
                    🔒 Discharged patient record. Clinical discharge summary is locked.
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="pt-4 border-t border-slate-150 flex flex-row items-center justify-between gap-2 mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDischargeOpen(false)}
            >
              Cancel
            </Button>
            {(dischargeTarget?.status !== 'Discharged' || (Math.abs(new Date().getTime() - new Date(dischargeTarget.admissionDate).getTime()) / (1000 * 60 * 60 * 24) <= 7)) && (
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={dischargeSaving}
                  className="rounded-xl"
                  onClick={() => void submitDischarge(true)}
                >
                  <Save className="mr-1.5 h-4 w-4" />
                  Save Draft
                </Button>
                <Button
                  type="button"
                  disabled={dischargeSaving}
                  className="rounded-xl bg-teal-600 text-white hover:bg-teal-700"
                  onClick={() => void submitDischarge(false)}
                >
                  {dischargeSaving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                  <CheckCircle className="mr-1.5 h-4 w-4" />
                  Finalize Discharge
                </Button>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
