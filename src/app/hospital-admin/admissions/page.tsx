'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Bed,
  Download,
  Search,
  FileText,
  RefreshCw,
  SlidersHorizontal,
  Activity,
  FileSpreadsheet,
  UserCheck,
  HeartPulse,
  Info,
  ChevronRight,
  Loader2,
  Plus,
  Trash2,
  Save,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useHospitalWorkspace } from '@/contexts/hospital-workspace-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConfirmDeleteDialog, useConfirmDelete } from '@/components/ui/confirm-delete-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

type AdmissionStatus = 'Admitted' | 'Under Treatment' | 'Critical' | 'Stable' | 'Discharged';

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

type StatsRecord = {
  totalAdmissions: number;
  activeAdmissions: number;
  dischargedPatients: number;
  occupiedBeds: number;
  availableBeds: number;
};

type DischargeRecord = {
  _id: string;
  admissionId: string;
  dischargeId: string;
  patientName: string;
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

export default function AdmissionsPage() {
  const workspace = useHospitalWorkspace();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [treatments, setTreatments] = useState<any[]>([]);
  const [loadingTreatments, setLoadingTreatments] = useState(false);
  const [billingSummary, setBillingSummary] = useState<any>(null);
  const [editingTreatmentId, setEditingTreatmentId] = useState<string | null>(null);

  const initialTreatmentForm = {
    category: 'Medicines',
    treatmentName: '',
    description: '',
    quantity: 1,
    unit: 'Qty',
    unitPrice: 0,
    notes: '',
    dateAndTime: new Date().toISOString().substring(0, 16)
  };
  const [treatmentForm, setTreatmentForm] = useState(initialTreatmentForm);

  const [timelineCategoryFilter, setTimelineCategoryFilter] = useState('all');
  const [timelineDateFilter, setTimelineDateFilter] = useState('');
  const [timelineSearch, setTimelineSearch] = useState('');
  const [admissions, setAdmissions] = useState<AdmissionRecord[]>([]);
  const [discharges, setDischarges] = useState<DischargeRecord[]>([]);
  const [stats, setStats] = useState<StatsRecord>({
    totalAdmissions: 0,
    activeAdmissions: 0,
    dischargedPatients: 0,
    occupiedBeds: 0,
    availableBeds: 0,
  });

  // Bed Reassignment dialog state
  const [isReassignOpen, setIsReassignOpen] = useState(false);
  const [reassignTarget, setReassignTarget] = useState<AdmissionRecord | null>(null);
  const [reassignForm, setReassignForm] = useState({ roomNumber: '', bedNumber: '' });
  const [reassigning, setReassigning] = useState(false);

  // Report export dialog state
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [exportType, setExportType] = useState<'daily' | 'monthly' | 'discharge'>('daily');
  const [exportFormat, setExportFormat] = useState<'pdf' | 'csv'>('pdf');
  const [exporting, setExporting] = useState(false);

  // Discharge Dialog state
  const [isDischargeOpen, setIsDischargeOpen] = useState(false);
  const [dischargeTarget, setDischargeTarget] = useState<AdmissionRecord | null>(null);
  const [dischargeForm, setDischargeForm] = useState<DischargeSummaryForm>(initialDischargeForm);
  const [medName, setMedName] = useState('');
  const [medDose, setMedDose] = useState('');
  const [medFreq, setMedFreq] = useState('');
  const [medDur, setMedDur] = useState('');
  const [dischargeSaving, setDischargeSaving] = useState(false);

  // Direct Admission Dialog state
  const [isAdmitDialogOpen, setIsAdmitDialogOpen] = useState(false);
  const [admitType, setAdmitType] = useState<'already' | 'custom'>('already');
  const [appointmentsList, setAppointmentsList] = useState<any[]>([]);
  const [doctorsList, setDoctorsList] = useState<any[]>([]);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState('');
  
  // Shared fields
  const [admissionReason, setAdmissionReason] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [bedNumber, setBedNumber] = useState('');
  const [notes, setNotes] = useState('');

  // Custom patient fields
  const [customForm, setCustomForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    age: '',
    gender: 'Male',
    bloodGroup: '',
    address: '',
    doctorId: '',
    department: '',
    consultationFee: '',
  });

  const [submittingAdmission, setSubmittingAdmission] = useState(false);

  const handleOpenAdmitDialog = async () => {
    try {
      setLoading(true);
      const [apptsRes, docsRes] = await Promise.all([
        api.get('/hospital-admin/appointments'),
        api.get('/hospital-admin/doctors'),
      ]);
      
      const appts = apptsRes.data?.data || [];
      const filteredAppts = appts.filter((a: any) => 
        (a.status === 'Scheduled' || a.status === 'Confirmed') && !a.isAdmitted
      );
      
      setAppointmentsList(filteredAppts);
      setDoctorsList(docsRes.data?.data || []);
      
      setAdmitType('already');
      setSelectedAppointmentId('');
      setAdmissionReason('');
      setRoomNumber('');
      setBedNumber('');
      setNotes('');
      setCustomForm({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        age: '',
        gender: 'Male',
        bloodGroup: '',
        address: '',
        doctorId: '',
        department: '',
        consultationFee: '',
      });
      setIsAdmitDialogOpen(true);
    } catch (err) {
      toast.error('Failed to load required data for direct admission.');
    } finally {
      setLoading(false);
    }
  };

  const handleDoctorChange = (docId: string) => {
    const doc = doctorsList.find((d) => d._id === docId);
    if (doc) {
      setCustomForm((prev) => ({
        ...prev,
        doctorId: docId,
        department: doc.department || doc.specialization || 'General Medicine',
        consultationFee: String(doc.consultationFee || 0),
      }));
    } else {
      setCustomForm((prev) => ({
        ...prev,
        doctorId: docId,
        department: '',
        consultationFee: '',
      }));
    }
  };

  const handleAdmitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingAdmission(true);

    try {
      let apptId = selectedAppointmentId;

      if (admitType === 'custom') {
        if (!customForm.firstName.trim() || !customForm.lastName.trim() || !customForm.email.trim() || !customForm.phone.trim() || !customForm.doctorId) {
          toast.error('Please fill in all required custom patient fields.');
          setSubmittingAdmission(false);
          return;
        }

        const patientPayload = {
          firstName: customForm.firstName.trim(),
          lastName: customForm.lastName.trim(),
          email: customForm.email.trim().toLowerCase(),
          phone: customForm.phone.trim(),
          age: customForm.age ? parseInt(customForm.age, 10) : undefined,
          gender: customForm.gender,
          bloodGroup: customForm.bloodGroup.trim() || undefined,
          address: customForm.address.trim() || undefined,
          status: 'Active'
        };

        const patientRes = await api.post('/hospital-admin/patients', patientPayload);
        const newPatient = patientRes.data?.data;
        if (!newPatient || !newPatient._id) {
          throw new Error('Failed to create patient record.');
        }

        const doctor = doctorsList.find((d) => d._id === customForm.doctorId);
        if (!doctor) {
          throw new Error('Selected doctor not found.');
        }

        const appointmentPayload = {
          patientRecordId: newPatient._id,
          patientName: `${newPatient.firstName} ${newPatient.lastName}`,
          patientFirstName: newPatient.firstName,
          patientLastName: newPatient.lastName,
          patientEmail: newPatient.email,
          patientPhone: newPatient.phone,
          doctorId: doctor._id,
          doctorName: `Dr. ${doctor.firstName} ${doctor.lastName}`,
          department: doctor.department || 'General Medicine',
          appointmentDate: new Date().toISOString().split('T')[0],
          appointmentTime: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
          consultationFee: doctor.consultationFee || 0,
          paymentStatus: 'Pending',
          paymentMethod: 'Cash',
          status: 'Confirmed'
        };

        const apptRes = await api.post('/hospital-admin/appointments', appointmentPayload);
        const newAppt = apptRes.data?.data;
        if (!newAppt || !newAppt._id) {
          throw new Error('Failed to create appointment.');
        }

        apptId = newAppt._id;
      } else {
        if (!apptId) {
          toast.error('Please select an appointment.');
          setSubmittingAdmission(false);
          return;
        }
      }

      if (!admissionReason.trim()) {
        toast.error('Admission reason is required.');
        setSubmittingAdmission(false);
        return;
      }

      await api.post('/hospital-admin/admissions', {
        appointmentId: apptId,
        admissionReason: admissionReason.trim(),
        roomNumber: roomNumber.trim() || undefined,
        bedNumber: bedNumber.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      toast.success('Patient admitted successfully!');
      setIsAdmitDialogOpen(false);
      void initData();
    } catch (err: any) {
      const errMsg = err.response?.data?.message || err.message || 'Failed to admit patient.';
      toast.error(errMsg);
    } finally {
      setSubmittingAdmission(false);
    }
  };

  const handleAddMedication = () => {
    if (!medName.trim()) {
      toast.error('Medicine name is required.');
      return;
    }
    const item: MedicationItem = {
      medicineName: medName.trim(),
      dose: medDose.trim(),
      frequency: medFreq.trim(),
      duration: medDur.trim(),
    };
    setDischargeForm((prev) => ({
      ...prev,
      medications: [...prev.medications, item],
    }));
    setMedName('');
    setMedDose('');
    setMedFreq('');
    setMedDur('');
  };

  const handleDeleteMedication = (idx: number) => {
    setDischargeForm((prev) => ({
      ...prev,
      medications: prev.medications.filter((_, i) => i !== idx),
    }));
  };

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

  const saveTreatment = async (e: React.FormEvent, admissionId: string) => {
    e.preventDefault();
    if (!treatmentForm.treatmentName.trim() || treatmentForm.quantity < 1 || treatmentForm.unitPrice < 0) {
      toast.error('Please enter valid treatment details.');
      return;
    }
    try {
      if (editingTreatmentId) {
        await api.put(`/hospital-admin/admissions/${admissionId}/treatments/${editingTreatmentId}`, treatmentForm);
        toast.success('Treatment entry updated successfully.');
      } else {
        await api.post(`/hospital-admin/admissions/${admissionId}/treatments`, treatmentForm);
        toast.success('Treatment entry logged successfully.');
      }
      setTreatmentForm({
        category: 'Medicines',
        treatmentName: '',
        description: '',
        quantity: 1,
        unit: 'Qty',
        unitPrice: 0,
        notes: '',
        dateAndTime: new Date().toISOString().substring(0, 16)
      });
      setEditingTreatmentId(null);
      void fetchTreatments(admissionId);
      void fetchBillingSummary(admissionId);
      void loadAdmissions();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save treatment entry.');
    }
  };

  const [deleteTreatmentTarget, setDeleteTreatmentTarget] = useState<{ admissionId: string; treatmentId: string } | null>(null);

  const { dialogProps: deleteTreatmentDialogProps, openConfirm: openDeleteTreatmentConfirm } = useConfirmDelete(async () => {
    if (!deleteTreatmentTarget) return;
    const { admissionId, treatmentId } = deleteTreatmentTarget;
    try {
      await api.delete(`/hospital-admin/admissions/${admissionId}/treatments/${treatmentId}`);
      toast.success('Treatment entry removed.');
      void fetchTreatments(admissionId);
      void fetchBillingSummary(admissionId);
      void loadAdmissions();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to remove treatment entry.');
    } finally {
      setDeleteTreatmentTarget(null);
    }
  });

  const deleteTreatment = (admissionId: string, treatmentId: string) => {
    setDeleteTreatmentTarget({ admissionId, treatmentId });
    openDeleteTreatmentConfirm({ title: 'Remove Treatment Entry', description: 'Are you sure you want to remove this treatment entry? This action cannot be undone.' });
  };

  const handleOpenDischarge = async (admission: AdmissionRecord) => {
    setDischargeTarget(admission);
    setDischargeForm(initialDischargeForm);
    setTreatmentForm({
      category: 'Medicines',
      treatmentName: '',
      description: '',
      quantity: 1,
      unit: 'Qty',
      unitPrice: 0,
      notes: '',
      dateAndTime: new Date().toISOString().substring(0, 16)
    });
    setEditingTreatmentId(null);
    setIsDischargeOpen(true);

    void fetchTreatments(admission._id);
    void fetchBillingSummary(admission._id);

    try {
      const response = await api.get('/hospital-admin/discharges', {
        params: { isDraft: 'all', search: admission._id },
      });
      const existing = (response.data?.data || []).find(
        (d: any) => d.admissionId === admission._id
      );
      if (existing) {
        setDischargeForm({
          diagnosis: existing.diagnosis || '',
          historyAndClinicalSummary: existing.historyAndClinicalSummary || '',
          treatmentGiven: existing.treatmentGiven || '',
          investigations: existing.investigations || '',
          surgeryProcedureName: existing.surgeryProcedureName || '',
          surgeryDate: existing.surgeryDate ? new Date(existing.surgeryDate).toISOString().split('T')[0] : '',
          surgeonName: existing.surgeonName || '',
          anesthesiologistName: existing.anesthesiologistName || '',
          surgicalNotes: existing.surgicalNotes || '',
          conditionOnDischarge: existing.conditionOnDischarge || 'Stable',
          hospitalCourseSummary: existing.hospitalCourseSummary || '',
          medications: existing.medications || [],
          followUpDate: existing.followUpDate ? new Date(existing.followUpDate).toISOString().split('T')[0] : '',
          followUpInstructions: existing.followUpInstructions || '',
          dischargeType: existing.dischargeType || 'Regular',
        });
      }
    } catch {
      // non-fatal
    }
  };

  const submitDischarge = async (isDraft: boolean) => {
    if (!dischargeTarget) return;

    if (!dischargeForm.diagnosis.trim()) {
      toast.error('Diagnosis is required.');
      return;
    }

    try {
      setDischargeSaving(true);
      await api.post(`/hospital-admin/admissions/${dischargeTarget._id}/discharge`, {
        ...dischargeForm,
        isDraft,
      });

      toast.success(isDraft ? 'Discharge summary draft saved.' : 'Patient discharged successfully.');
      setIsDischargeOpen(false);
      setDischargeTarget(null);
      void initData();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to complete discharge operation.';
      toast.error(msg);
    } finally {
      setDischargeSaving(false);
    }
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  const loadStats = useCallback(async () => {
    try {
      const response = await api.get('/hospital-admin/admissions/stats');
      if (response.data?.success) {
        setStats(response.data.data);
      }
    } catch (error) {
      console.error('Failed to load admission stats:', error);
    }
  }, []);

  const loadAdmissions = useCallback(async (query = debouncedSearch, status = statusFilter) => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (query.trim()) params.search = query.trim();
      if (status !== 'all') params.status = status;

      const response = await api.get('/hospital-admin/admissions', { params });
      if (response.data?.success) {
        setAdmissions(response.data.data || []);
      }
    } catch (error) {
      toast.error('Failed to load admissions directory.');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter]);

  const loadDischarges = useCallback(async () => {
    try {
      const response = await api.get('/hospital-admin/discharges');
      if (response.data?.success) {
        setDischarges(response.data.data || []);
      }
    } catch (error) {
      console.error('Failed to load discharge summaries:', error);
    }
  }, []);

  const initData = useCallback(async () => {
    await Promise.all([loadStats(), loadAdmissions(), loadDischarges()]);
  }, [loadStats, loadAdmissions, loadDischarges]);

  useEffect(() => {
    void initData();
  }, [initData]);

  // Real-time synchronization using socket events
  useEffect(() => {
    const socket = getSocket();
    if (socket) {
      const handleUpdate = () => {
        void loadStats();
        void loadAdmissions();
        void loadDischarges();
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
  }, [loadStats, loadAdmissions, loadDischarges]);

  const handleReassignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reassignTarget) return;

    try {
      setReassigning(true);
      await api.patch(`/hospital-admin/admissions/${reassignTarget._id}/room`, {
        roomNumber: reassignForm.roomNumber.trim() || undefined,
        bedNumber: reassignForm.bedNumber.trim() || undefined,
      });

      toast.success('Beds / Ward assigned successfully.');
      setIsReassignOpen(false);
      setReassignTarget(null);
      void initData();
    } catch (error) {
      toast.error('Failed to reassign room/bed.');
    } finally {
      setReassigning(false);
    }
  };

  const handleExportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setExporting(true);
      const response = await api.get('/hospital-admin/admissions/reports', {
        params: { reportType: exportType, format: exportFormat },
        responseType: 'blob',
      });

      const blob = new Blob([response.data], {
        type: exportFormat === 'csv' ? 'text/csv' : 'application/pdf',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${exportType}-admissions-report.${exportFormat}`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast.success('Report downloaded successfully.');
      setIsExportOpen(false);
    } catch (error) {
      toast.error('Failed to export report.');
    } finally {
      setExporting(false);
    }
  };

  const downloadAdmissionSlip = async (id: string, patientName: string) => {
    try {
      toast.info('Generating admission slip...');
      const response = await api.get(`/hospital-admin/admissions/${id}/slip`, {
        responseType: 'blob',
      });

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `admission-slip-${patientName.replace(/\s+/g, '_')}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Admission slip downloaded.');
    } catch (error) {
      toast.error('Failed to download admission slip.');
    }
  };

  const downloadDischargeSummary = async (admissionId: string, patientName: string) => {
    const summaryRecord = discharges.find((d) => d.admissionId === admissionId);
    if (!summaryRecord) {
      toast.error('Discharge summary is not generated yet.');
      return;
    }

    try {
      toast.info('Fetching discharge summary...');
      const response = await api.get(`/hospital-admin/discharges/${summaryRecord._id}/pdf`);
      if (response.data?.success && response.data.data?.url) {
        window.open(response.data.data.url, '_blank');
        toast.success('Discharge summary opened.');
      } else {
        throw new Error('Url not available');
      }
    } catch (error) {
      toast.error('Failed to retrieve discharge summary PDF.');
    }
  };

  return (
    <div className="mx-auto max-w-[1180px] space-y-6">
      <nav className="flex items-center gap-1.5 text-xs text-slate-500">
        <Link href="/" className="transition-colors hover:text-slate-900">
          Home
        </Link>
        <span>/</span>
        <Link href={workspace.homePath} className="transition-colors hover:text-slate-900">
          {workspace.portalLabel}
        </Link>
        <span>/</span>
        <span className="font-medium text-slate-900">Admissions</span>
      </nav>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Patient Admissions</h1>
          <p className="mt-1 text-sm text-slate-500">
            Monitor hospitalized patients, allocate beds, and export summaries.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="rounded-xl border-slate-200"
            onClick={() => void initData()}
          >
            <RefreshCw size={15} className="mr-1.5" />
            Refresh
          </Button>
          <Button
            className="rounded-xl bg-primary text-white hover:bg-primary/90"
            onClick={() => setIsExportOpen(true)}
          >
            <Download size={15} className="mr-1.5" />
            Export Reports
          </Button>
          <Button
            className="rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={() => void handleOpenAdmitDialog()}
          >
            <Plus size={15} className="mr-1.5" />
            Admit Patient
          </Button>
        </div>
      </div>

      {/* Stats Section */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-2xl border border-slate-200 shadow-sm p-4 bg-white flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Bed size={22} />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Active Admitted</p>
            <h3 className="text-2xl font-bold text-slate-950 mt-0.5">{stats.activeAdmissions}</h3>
          </div>
        </Card>
        <Card className="rounded-2xl border border-slate-200 shadow-sm p-4 bg-white flex items-center gap-4">
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
            <HeartPulse size={22} />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Critical Cases</p>
            <h3 className="text-2xl font-bold text-slate-950 mt-0.5">
              {admissions.filter((a) => a.status === 'Critical').length}
            </h3>
          </div>
        </Card>
        <Card className="rounded-2xl border border-slate-200 shadow-sm p-4 bg-white flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Activity size={22} />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Bed Occupancy</p>
            <h3 className="text-2xl font-bold text-slate-950 mt-0.5">
              {stats.occupiedBeds} / {stats.occupiedBeds + stats.availableBeds}
            </h3>
          </div>
        </Card>
        <Card className="rounded-2xl border border-slate-200 shadow-sm p-4 bg-white flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <UserCheck size={22} />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Discharged Patients</p>
            <h3 className="text-2xl font-bold text-slate-950 mt-0.5">{stats.dischargedPatients}</h3>
          </div>
        </Card>
      </div>

      {/* Filter and Board Section */}
      <Card className="rounded-3xl border border-slate-200 py-0 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
        <CardHeader className="px-5 pt-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="text-lg font-semibold text-slate-950">Admissions Directory</CardTitle>
              <CardDescription>Track all historical and currently hospitalized patient records</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-full sm:max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search patient or doctor..."
                  className="pl-9 h-9 text-xs"
                />
              </div>
              <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val || 'all')}>
                <SelectTrigger className="w-[150px] text-xs h-9">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="Admitted">Admitted</SelectItem>
                  <SelectItem value="Under Treatment">Under Treatment</SelectItem>
                  <SelectItem value="Critical">Critical</SelectItem>
                  <SelectItem value="Stable">Stable</SelectItem>
                  <SelectItem value="Discharged">Discharged</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-0 pb-0">
          <Table>
            <TableHeader className="bg-slate-50/70">
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Patient & ID</TableHead>
                <TableHead className="px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Admitting Doctor</TableHead>
                <TableHead className="px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Beds / Ward</TableHead>
                <TableHead className="px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Admission Details</TableHead>
                <TableHead className="px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Status</TableHead>
                <TableHead className="px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="px-5 py-10 text-center text-sm text-slate-500">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" />
                    <span className="mt-2 block text-xs">Loading admissions...</span>
                  </TableCell>
                </TableRow>
              ) : admissions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="px-5 py-10 text-center text-sm text-slate-500">
                    No admission records match your filter criteria.
                  </TableCell>
                </TableRow>
              ) : (
                admissions.map((admission) => (
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
                      <div className="space-y-0.5">
                        <div className="text-xs font-medium text-slate-900">Dr. {admission.doctorName}</div>
                        <div className="text-[10px] text-slate-500">{admission.department}</div>
                      </div>
                    </TableCell>
                    <TableCell className="px-5 py-3">
                      <div className="space-y-0.5">
                        {admission.roomNumber ? (
                          <div className="text-xs font-semibold text-slate-900">
                            Room {admission.roomNumber}
                            {admission.bedNumber && <span className="text-[11px] font-normal text-slate-500 ml-1">(Bed {admission.bedNumber})</span>}
                          </div>
                        ) : (
                          <div className="text-xs text-slate-400 italic">No bed assigned</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="px-5 py-3">
                      <div className="space-y-1">
                        <div className="text-xs text-slate-600">
                          {new Date(admission.admissionDate).toLocaleDateString()} at{' '}
                          {new Date(admission.admissionDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div className="text-[11px] text-slate-500 max-w-xs truncate" title={admission.admissionReason}>
                          Reason: {admission.admissionReason}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-5 py-3">
                      <StatusBadge status={admission.status} />
                    </TableCell>
                    <TableCell className="px-5 py-3">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {(admission.status !== 'Discharged' || (Math.abs(new Date().getTime() - new Date(admission.admissionDate).getTime()) / (1000 * 60 * 60 * 24) <= 7)) && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-lg px-2 text-xs"
                            onClick={() => {
                              setReassignTarget(admission);
                              setReassignForm({
                                roomNumber: admission.roomNumber || '',
                                bedNumber: admission.bedNumber || '',
                              });
                              setIsReassignOpen(true);
                            }}
                          >
                            Assign Bed
                          </Button>
                        )}
                        {admission.status !== 'Discharged' ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-lg px-2 text-xs bg-teal-600 text-white hover:bg-teal-700 hover:text-white"
                            onClick={() => void handleOpenDischarge(admission)}
                          >
                            Discharge Patient
                          </Button>
                        ) : (
                          (Math.abs(new Date().getTime() - new Date(admission.admissionDate).getTime()) / (1000 * 60 * 60 * 24) <= 7) && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 rounded-lg px-2 text-xs bg-teal-600 text-white hover:bg-teal-700 hover:text-white"
                              onClick={() => void handleOpenDischarge(admission)}
                            >
                              Edit Discharge
                            </Button>
                          )
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 rounded-lg px-2 text-xs"
                          onClick={() => void downloadAdmissionSlip(admission._id, admission.patientName)}
                        >
                          Print Slip
                        </Button>
                        {admission.status === 'Discharged' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-lg px-2 text-xs bg-slate-900 text-white hover:bg-slate-800"
                            onClick={() => void downloadDischargeSummary(admission._id, admission.patientName)}
                          >
                            Discharge Summary
                          </Button>
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

      {/* Bed Reassignment Dialog */}
      <Dialog open={isReassignOpen} onOpenChange={setIsReassignOpen}>
        <DialogContent className="rounded-2xl sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Assign Bed & Room</DialogTitle>
            <DialogDescription>
              Assign or update room details for {reassignTarget?.patientName}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void handleReassignSubmit(e)} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="reassign-room">Ward / Room Number</Label>
              <Input
                id="reassign-room"
                value={reassignForm.roomNumber}
                onChange={(e) => setReassignForm({ ...reassignForm, roomNumber: e.target.value })}
                placeholder="e.g. Ward 2A, Room 205"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reassign-bed">Bed Number</Label>
              <Input
                id="reassign-bed"
                value={reassignForm.bedNumber}
                onChange={(e) => setReassignForm({ ...reassignForm, bedNumber: e.target.value })}
                placeholder="e.g. Bed-3"
              />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsReassignOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={reassigning} className="bg-primary text-white hover:bg-primary/90">
                {reassigning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Export Report Dialog */}
      <Dialog open={isExportOpen} onOpenChange={setIsExportOpen}>
        <DialogContent className="rounded-2xl sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Export Admissions Report</DialogTitle>
            <DialogDescription>
              Select report filters and formats to download admissions summaries.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void handleExportSubmit(e)} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Report Scope</Label>
              <Select value={exportType} onValueChange={(val) => setExportType(val as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily Admissions (Admitted Today)</SelectItem>
                  <SelectItem value="monthly">Monthly Admissions (Admitted This Month)</SelectItem>
                  <SelectItem value="discharge">Discharged Patients (Only Historical Discharges)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Download Format</Label>
              <Select value={exportFormat} onValueChange={(val) => setExportFormat(val as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">Official PDF Document</SelectItem>
                  <SelectItem value="csv">Excel-friendly CSV Data Sheet</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsExportOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={exporting} className="bg-primary text-white hover:bg-primary/90">
                {exporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Download Report
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isDischargeOpen} onOpenChange={setIsDischargeOpen}>
        <DialogContent className="rounded-2xl sm:max-w-[850px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">IPD Portal - {dischargeTarget?.patientName}</DialogTitle>
            <DialogDescription>
              Manage treatment logs, running bill timeline, and clinical discharge records.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="treatments" className="w-full mt-4">
            <TabsList className="grid w-full grid-cols-4 rounded-xl bg-slate-100 p-1">
              <TabsTrigger value="treatments" className="rounded-lg text-xs font-semibold">Treatments Log</TabsTrigger>
              <TabsTrigger value="timeline" className="rounded-lg text-xs font-semibold">Timeline</TabsTrigger>
              <TabsTrigger value="billing" className="rounded-lg text-xs font-semibold">Billing Summary</TabsTrigger>
              <TabsTrigger value="discharge" className="rounded-lg text-xs font-semibold">Discharge &amp; Notes</TabsTrigger>
            </TabsList>

            {/* Tab 1: Admission Treatments */}
            <TabsContent value="treatments" className="space-y-4 mt-4">
              {dischargeTarget && dischargeTarget.status !== 'Discharged' && (
                <form onSubmit={(e) => void saveTreatment(e, dischargeTarget._id)} className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 space-y-3">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {editingTreatmentId ? '✏️ Edit Treatment Entry' : '➕ Log New Treatment / Charge'}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="treat-cat" className="text-xs text-slate-500">Category *</Label>
                      <Select
                        value={treatmentForm.category}
                        onValueChange={(val) => setTreatmentForm({ ...treatmentForm, category: val || 'Medicines' })}
                      >
                        <SelectTrigger id="treat-cat" className="h-9 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
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
                    </div>
                    <div className="space-y-1 col-span-1 md:col-span-2">
                      <Label htmlFor="treat-name" className="text-xs text-slate-500">Treatment/Item Name *</Label>
                      <Input
                        id="treat-name"
                        placeholder="e.g. Paracetamol 650mg, CBC Blood Panel"
                        value={treatmentForm.treatmentName}
                        onChange={(e) => setTreatmentForm({ ...treatmentForm, treatmentName: e.target.value })}
                        className="h-9 text-xs"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="treat-time" className="text-xs text-slate-500">Date &amp; Time *</Label>
                      <Input
                        id="treat-time"
                        type="datetime-local"
                        value={treatmentForm.dateAndTime}
                        onChange={(e) => setTreatmentForm({ ...treatmentForm, dateAndTime: e.target.value })}
                        className="h-9 text-xs"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="treat-qty" className="text-xs text-slate-500">Quantity *</Label>
                      <Input
                        id="treat-qty"
                        type="number"
                        min="1"
                        value={treatmentForm.quantity}
                        onChange={(e) => setTreatmentForm({ ...treatmentForm, quantity: Number(e.target.value) || 1 })}
                        className="h-9 text-xs text-right"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="treat-unit" className="text-xs text-slate-500">Unit *</Label>
                      <Input
                        id="treat-unit"
                        placeholder="e.g. Tab, Vial, Visit"
                        value={treatmentForm.unit}
                        onChange={(e) => setTreatmentForm({ ...treatmentForm, unit: e.target.value })}
                        className="h-9 text-xs"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="treat-price" className="text-xs text-slate-500">Unit Price (INR) *</Label>
                      <Input
                        id="treat-price"
                        type="number"
                        min="0"
                        value={treatmentForm.unitPrice}
                        onChange={(e) => setTreatmentForm({ ...treatmentForm, unitPrice: Number(e.target.value) || 0 })}
                        className="h-9 text-xs text-right"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500">Total Charge (INR)</Label>
                      <div className="h-9 rounded-lg border border-slate-200 bg-slate-100 flex items-center justify-end px-3 text-xs font-semibold text-slate-700">
                        ₹{(treatmentForm.quantity * treatmentForm.unitPrice).toFixed(2)}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="treat-desc" className="text-xs text-slate-500">Short Description</Label>
                      <Input
                        id="treat-desc"
                        placeholder="e.g. Administered intravenously, diagnostic screen"
                        value={treatmentForm.description}
                        onChange={(e) => setTreatmentForm({ ...treatmentForm, description: e.target.value })}
                        className="h-9 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="treat-notes" className="text-xs text-slate-500">Notes / Remarks</Label>
                      <Input
                        id="treat-notes"
                        placeholder="e.g. Patient showed no adverse reaction"
                        value={treatmentForm.notes}
                        onChange={(e) => setTreatmentForm({ ...treatmentForm, notes: e.target.value })}
                        className="h-9 text-xs"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-1.5">
                    {editingTreatmentId && (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          setTreatmentForm(initialTreatmentForm);
                          setEditingTreatmentId(null);
                        }}
                        className="h-9 text-xs rounded-lg"
                      >
                        Cancel Edit
                      </Button>
                    )}
                    <Button
                      type="submit"
                      className="h-9 text-xs bg-slate-900 text-white hover:bg-slate-800 rounded-lg px-4"
                    >
                      {editingTreatmentId ? 'Update Log' : 'Add to Treatment Log'}
                    </Button>
                  </div>
                </form>
              )}

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
                      {dischargeTarget?.status !== 'Discharged' && (
                        <TableHead className="py-2.5 text-[10px] font-bold text-slate-500 text-center">Actions</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingTreatments ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-xs text-slate-400 py-6">
                          <Loader2 className="h-4 w-4 animate-spin mx-auto text-primary mb-1.5" />
                          Loading patient treatments log...
                        </TableCell>
                      </TableRow>
                    ) : treatments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-xs text-slate-400 py-6">
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
                          {dischargeTarget && dischargeTarget.status !== 'Discharged' && (
                            <TableCell className="py-2.5 text-center">
                              <div className="flex justify-center gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setEditingTreatmentId(t._id);
                                    setTreatmentForm({
                                      category: t.category,
                                      treatmentName: t.treatmentName,
                                      description: t.description || '',
                                      quantity: t.quantity,
                                      unit: t.unit || 'Qty',
                                      unitPrice: t.unitPrice,
                                      notes: t.notes || '',
                                      dateAndTime: new Date(t.dateAndTime).toISOString().substring(0, 16)
                                    });
                                  }}
                                  className="h-6 w-6 p-0 text-slate-500 hover:text-slate-800 rounded-md"
                                >
                                  ✏️
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => deleteTreatment(dischargeTarget._id, t._id)}
                                  className="h-6 w-6 p-0 text-red-500 hover:text-red-700 rounded-md"
                                >
                                  🗑️
                                </Button>
                              </div>
                            </TableCell>
                          )}
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
                    No timeline entries to show. Log a treatment to populate the timeline.
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
                    🔒 Discharged patient record. Clinical discharge summary and final bill are locked.
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
                  className="rounded-xl bg-primary text-white hover:bg-primary/90"
                  onClick={() => void submitDischarge(false)}
                >
                  {dischargeSaving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                  Finalize Discharge &amp; Bill
                </Button>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Admit Patient Dialog */}
      <Dialog open={isAdmitDialogOpen} onOpenChange={setIsAdmitDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-[760px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">Admit Patient</DialogTitle>
            <DialogDescription>
              Select whether this patient booked an appointment via the app or if you want to add them manually.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={(e) => void handleAdmitSubmit(e)} className="space-y-4 py-2">
            {/* Tabs Selector */}
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1 mb-4">
              <button
                type="button"
                className={`rounded-lg py-1.5 text-xs font-semibold transition-all ${
                  admitType === 'already' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-950'
                }`}
                onClick={() => setAdmitType('already')}
              >
                App Patient (Already Booked)
              </button>
              <button
                type="button"
                className={`rounded-lg py-1.5 text-xs font-semibold transition-all ${
                  admitType === 'custom' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-950'
                }`}
                onClick={() => setAdmitType('custom')}
              >
                Custom Patient (Manual Entry)
              </button>
            </div>

            {/* Tab 1: App Patient */}
            {admitType === 'already' && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="appt-select">Select Appointment <span className="text-red-500">*</span></Label>
                  <Select value={selectedAppointmentId} onValueChange={(val) => setSelectedAppointmentId(val || '')}>
                    <SelectTrigger id="appt-select" className="w-full">
                      <SelectValue placeholder="Search scheduled / confirmed appointments..." />
                    </SelectTrigger>
                    <SelectContent>
                      {appointmentsList.length === 0 ? (
                        <SelectItem value="_none" disabled>No pending appointments to admit</SelectItem>
                      ) : (
                        appointmentsList.map((a) => (
                          <SelectItem key={a._id} value={a._id}>
                            {a.patientName} - Dr. {a.doctorName} ({a.department}) at {a.appointmentTime}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Tab 2: Custom Patient */}
            {admitType === 'custom' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="custom-first">First Name <span className="text-red-500">*</span></Label>
                    <Input
                      id="custom-first"
                      value={customForm.firstName}
                      onChange={(e) => setCustomForm({ ...customForm, firstName: e.target.value })}
                      placeholder="e.g. John"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="custom-last">Last Name <span className="text-red-500">*</span></Label>
                    <Input
                      id="custom-last"
                      value={customForm.lastName}
                      onChange={(e) => setCustomForm({ ...customForm, lastName: e.target.value })}
                      placeholder="e.g. Doe"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="custom-email">Email <span className="text-red-500">*</span></Label>
                    <Input
                      id="custom-email"
                      type="email"
                      value={customForm.email}
                      onChange={(e) => setCustomForm({ ...customForm, email: e.target.value })}
                      placeholder="e.g. john@example.com"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="custom-phone">Phone <span className="text-red-500">*</span></Label>
                    <Input
                      id="custom-phone"
                      value={customForm.phone}
                      onChange={(e) => setCustomForm({ ...customForm, phone: e.target.value })}
                      placeholder="e.g. +919876543210"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="custom-age">Age</Label>
                    <Input
                      id="custom-age"
                      type="number"
                      value={customForm.age}
                      onChange={(e) => setCustomForm({ ...customForm, age: e.target.value })}
                      placeholder="e.g. 35"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="custom-gender">Gender</Label>
                    <Select
                      value={customForm.gender}
                      onValueChange={(val) => setCustomForm({ ...customForm, gender: val || '' })}
                    >
                      <SelectTrigger id="custom-gender">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="custom-blood">Blood Group</Label>
                    <Input
                      id="custom-blood"
                      value={customForm.bloodGroup}
                      onChange={(e) => setCustomForm({ ...customForm, bloodGroup: e.target.value })}
                      placeholder="e.g. O+"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="custom-address">Address</Label>
                  <Textarea
                    id="custom-address"
                    value={customForm.address}
                    onChange={(e) => setCustomForm({ ...customForm, address: e.target.value })}
                    placeholder="Patient's residential address..."
                    rows={2}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="custom-doctor">Doctor <span className="text-red-500">*</span></Label>
                    <Select value={customForm.doctorId} onValueChange={(val) => handleDoctorChange(val || '')}>
                      <SelectTrigger id="custom-doctor">
                        <SelectValue placeholder="Select admitting doctor" />
                      </SelectTrigger>
                      <SelectContent>
                        {doctorsList.map((d) => (
                          <SelectItem key={d._id} value={d._id}>
                            Dr. {d.firstName} {d.lastName} ({d.department || d.specialization || 'General'})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="custom-fee">Consultation Fee (Rs.)</Label>
                    <Input
                      id="custom-fee"
                      type="number"
                      value={customForm.consultationFee}
                      disabled
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Shared Admission Fields */}
            <div className="space-y-4 pt-4 border-t border-slate-100 mt-4">
              <h3 className="text-sm font-semibold text-slate-900">Admission Details</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="admit-room">Room Number</Label>
                  <Input
                    id="admit-room"
                    value={roomNumber}
                    onChange={(e) => setRoomNumber(e.target.value)}
                    placeholder="e.g. 102"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="admit-bed">Bed Number</Label>
                  <Input
                    id="admit-bed"
                    value={bedNumber}
                    onChange={(e) => setBedNumber(e.target.value)}
                    placeholder="e.g. B-3"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="admit-reason">Reason for Admission <span className="text-red-500">*</span></Label>
                <Textarea
                  id="admit-reason"
                  value={admissionReason}
                  onChange={(e) => setAdmissionReason(e.target.value)}
                  placeholder="Primary complaints or diagnosis requiring hospitalization..."
                  rows={2.5}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="admit-notes">Admission Notes</Label>
                <Textarea
                  id="admit-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any extra instructions, medical history, or dietary requests..."
                  rows={2}
                />
              </div>
            </div>

            <DialogFooter className="pt-4 border-t border-slate-150">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAdmitDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submittingAdmission}
                className="bg-primary text-white hover:bg-primary/90 rounded-xl"
              >
                {submittingAdmission && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                Admit Patient
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDeleteDialog {...deleteTreatmentDialogProps} />
    </div>
  );
}
