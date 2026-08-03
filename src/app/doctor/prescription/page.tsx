'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { ArrowLeft, Building2, ClipboardPlus, Clock3, Pill, Plus, Trash2 } from 'lucide-react';
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
import { getDoctorPath } from '@/lib/routes';
import { ConfirmDeleteDialog, useConfirmDelete } from '@/components/ui/confirm-delete-dialog';

type PrescriptionPatientContext = {
  patient: {
    _id: string;
    patientName: string;
    age?: number | null;
    gender?: string | null;
    bloodGroup?: string | null;
    status: string;
  };
  careSummary: {
    department: string;
    specialization: string;
  };
};

type MedicineSchedule = {
  morning: boolean;
  afternoon: boolean;
  night: boolean;
  morningTime: string;
  afternoonTime: string;
  nightTime: string;
};

type MedicineRow = {
  medicineName: string;
  dosage: string;
  frequency: string;
  duration: string;
  schedule: MedicineSchedule;
};

type PatientSuggestion = {
  _id: string;
  patientName: string;
  email?: string | null;
  phone?: string | null;
  age?: number | null;
  gender?: string | null;
  bloodGroup?: string | null;
};

type PrescriptionRecord = {
  _id: string;
  patientName: string;
  diagnosis: string;
  prescriptionDate: string;
  followUpDate?: string | null;
  instruction: string;
  medicines: MedicineRow[];
};

type PrescriptionTemplate = {
  _id: string;
  templateName: string;
  diagnosis: string;
  medicines: MedicineRow[];
  instruction: string;
  isFavorite: boolean;
  useCount: number;
  lastUsedAt?: string;
  createdAt: string;
};

type SavedMedicine = {
  _id: string;
  medicineName: string;
  dosage: string;
  frequency: string;
  duration: string;
  schedule: MedicineSchedule;
  useCount: number;
};

type HospitalProfile = {
  id: string;
  name: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  phone?: string | null;
  logoUrl?: string | null;
  hasLogo: boolean;
};

const emptyMedicine = (): MedicineRow => ({
  medicineName: '',
  dosage: '',
  frequency: '',
  duration: '',
  schedule: {
    morning: false,
    afternoon: false,
    night: false,
    morningTime: '',
    afternoonTime: '',
    nightTime: '',
  },
});

const getTodayDate = () => new Date().toISOString().split('T')[0];

const medicineScheduleOptions: Array<{
  key: 'morning' | 'afternoon' | 'night';
  label: string;
  timeKey: 'morningTime' | 'afternoonTime' | 'nightTime';
}> = [
  { key: 'morning', label: 'Morning', timeKey: 'morningTime' },
  { key: 'afternoon', label: 'Afternoon', timeKey: 'afternoonTime' },
  { key: 'night', label: 'Night', timeKey: 'nightTime' },
];

const getErrorMessage = (error: unknown, fallback: string) => {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    return (error as { response?: { data?: { message?: string } } }).response?.data?.message || fallback;
  }
  return fallback;
};

export default function DoctorPrescriptionPage() {
  const searchParams = useSearchParams();
  const patientId = searchParams.get('patientId');
  const patientInputRef = useRef<HTMLDivElement | null>(null);
  const [patientContext, setPatientContext] = useState<PrescriptionPatientContext | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(patientId);
  const [patientName, setPatientName] = useState('');
  const [patientSuggestions, setPatientSuggestions] = useState<PatientSuggestion[]>([]);
  const [patientSuggestionsOpen, setPatientSuggestionsOpen] = useState(false);
  const [patientSuggestionsLoading, setPatientSuggestionsLoading] = useState(false);
  const [diagnosis, setDiagnosis] = useState('');
  const [prescriptionDate, setPrescriptionDate] = useState(getTodayDate());
  const [followUpDate, setFollowUpDate] = useState('');
  const [instruction, setInstruction] = useState('');
  const [medicines, setMedicines] = useState<MedicineRow[]>([emptyMedicine()]);
  const [saving, setSaving] = useState(false);
  const [recentPrescriptions, setRecentPrescriptions] = useState<PrescriptionRecord[]>([]);
  const [hospitalProfile, setHospitalProfile] = useState<HospitalProfile | null>(null);
  const [includemedikwikLogo, setIncludemedikwikLogo] = useState(false);
  const [doctorNotes, setDoctorNotes] = useState('');

  // Template system
  const [templates, setTemplates] = useState<PrescriptionTemplate[]>([]);
  const [templateSearch, setTemplateSearch] = useState('');
  const [showTemplatePanel, setShowTemplatePanel] = useState(false);
  const [templateDropdownOpen, setTemplateDropdownOpen] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [activeTemplateTab, setActiveTemplateTab] = useState<'all' | 'favorites' | 'recent'>('recent');

  // Edit template
  const [editingTemplate, setEditingTemplate] = useState<PrescriptionTemplate | null>(null);
  const [editTemplateName, setEditTemplateName] = useState('');
  const [editDiagnosis, setEditDiagnosis] = useState('');
  const [editMedicines, setEditMedicines] = useState<MedicineRow[]>([]);
  const [editInstruction, setEditInstruction] = useState('');
  const [updatingTemplate, setUpdatingTemplate] = useState(false);

  // Doctor Medicine Library State & Methods
  const [savedMedicines, setSavedMedicines] = useState<SavedMedicine[]>([]);
  const [activeMedicineDropdown, setActiveMedicineDropdown] = useState<number | null>(null);
  const [savingMedicineRowIndex, setSavingMedicineRowIndex] = useState<number | null>(null);

  const loadSavedMedicines = useCallback(async () => {
    try {
      const response = await api.get('/doctor/medicines');
      setSavedMedicines(response.data?.data || []);
    } catch {
      // non-fatal
    }
  }, []);

  const handleSaveMedicineToLibrary = async (rowIndex: number) => {
    const med = medicines[rowIndex];
    if (!(med.medicineName || '').trim() || !(med.dosage || '').trim() || !(med.frequency || '').trim() || !(med.duration || '').trim()) {
      toast.error('Please complete the medicine details before saving.');
      return;
    }
    setSavingMedicineRowIndex(rowIndex);
    try {
      await api.post('/doctor/medicines', {
        medicineName: med.medicineName.trim(),
        dosage: med.dosage.trim(),
        frequency: med.frequency.trim(),
        duration: med.duration.trim(),
        schedule: med.schedule,
      });
      toast.success('Medicine saved to your library!');
      void loadSavedMedicines();
    } catch {
      toast.error('Failed to save medicine.');
    } finally {
      setSavingMedicineRowIndex(null);
    }
  };

  const [deleteMedicineId, setDeleteMedicineId] = useState<string | null>(null);

  const { dialogProps: deleteMedicineDialogProps, openConfirm: openDeleteMedicineConfirm } = useConfirmDelete(async () => {
    if (!deleteMedicineId) return;
    try {
      await api.delete(`/doctor/medicines/${deleteMedicineId}`);
      setSavedMedicines((prev) => prev.filter((m) => m._id !== deleteMedicineId));
      toast.success('Medicine removed from library.');
    } catch {
      toast.error('Failed to delete medicine from library.');
    } finally {
      setDeleteMedicineId(null);
    }
  });

  const handleDeleteMedicineFromLibrary = (id: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setDeleteMedicineId(id);
    openDeleteMedicineConfirm({ title: 'Remove Medicine', description: 'Are you sure you want to remove this medicine from your library? This action cannot be undone.' });
  };

  const applySavedMedicine = (rowIndex: number, savedMed: SavedMedicine) => {
    const updated = [...medicines];
    updated[rowIndex] = {
      medicineName: savedMed.medicineName,
      dosage: savedMed.dosage,
      frequency: savedMed.frequency,
      duration: savedMed.duration,
      schedule: { ...savedMed.schedule },
    };
    setMedicines(updated);
    setActiveMedicineDropdown(null);
  };

  const loadPrescriptions = async (targetPatientId: string | null) => {
    try {
      const response = await api.get('/doctor/prescriptions', {
        params: targetPatientId ? { patientId: targetPatientId } : undefined,
      });
      setRecentPrescriptions(response.data?.data || []);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to load prescription history'));
      setRecentPrescriptions([]);
    }
  };

  const loadTemplates = useCallback(async (sort = 'recent') => {
    try {
      const res = await api.get('/doctor/prescription-templates', { params: { sort, limit: 100 } });
      setTemplates(res.data?.data || []);
    } catch {
      // non-fatal
    }
  }, []);

  const applyTemplate = async (template: PrescriptionTemplate) => {
    setDiagnosis(template.diagnosis || '');
    setMedicines(template.medicines.length > 0 ? template.medicines : [emptyMedicine()]);
    setInstruction(template.instruction || '');
    setTemplateDropdownOpen(false);
    // Record usage
    try {
      await api.patch(`/doctor/prescription-templates/${template._id}/use`);
      await loadTemplates(activeTemplateTab === 'recent' ? 'recent' : activeTemplateTab === 'favorites' ? 'favorites' : 'mostUsed');
    } catch { /* non-fatal */ }
  };

  const handleSaveTemplate = async () => {
    if (!(newTemplateName || '').trim()) return;
    setSavingTemplate(true);
    try {
      await api.post('/doctor/prescription-templates', {
        templateName: (newTemplateName || '').trim(),
        diagnosis,
        medicines,
        instruction,
      });
      toast.success('Template saved!');
      setShowSaveTemplateModal(false);
      setNewTemplateName('');
      await loadTemplates();
    } catch {
      toast.error('Failed to save template.');
    } finally {
      setSavingTemplate(false);
    }
  };

  const [deleteTemplateId, setDeleteTemplateId] = useState<string | null>(null);

  const { dialogProps: deleteTemplateDialogProps, openConfirm: openDeleteTemplateConfirm } = useConfirmDelete(async () => {
    if (!deleteTemplateId) return;
    try {
      await api.delete(`/doctor/prescription-templates/${deleteTemplateId}`);
      setTemplates(prev => prev.filter(t => t._id !== deleteTemplateId));
      toast.success('Template deleted.');
    } catch {
      toast.error('Failed to delete template.');
    } finally {
      setDeleteTemplateId(null);
    }
  });

  const handleDeleteTemplate = (id: string) => {
    setDeleteTemplateId(id);
    openDeleteTemplateConfirm({ title: 'Delete Template', description: 'Are you sure you want to delete this prescription template? This action cannot be undone.' });
  };

  const openEditTemplate = (template: PrescriptionTemplate) => {
    setEditingTemplate(template);
    setEditTemplateName(template.templateName || '');
    setEditDiagnosis(template.diagnosis || '');
    setEditMedicines(template.medicines.length > 0 ? template.medicines : [emptyMedicine()]);
    setEditInstruction(template.instruction || '');
    setTemplateDropdownOpen(false);
  };

  const handleUpdateTemplate = async () => {
    if (!editingTemplate || !(editTemplateName || '').trim()) return;
    setUpdatingTemplate(true);
    try {
      await api.put(`/doctor/prescription-templates/${editingTemplate._id}`, {
        templateName: (editTemplateName || '').trim(),
        diagnosis: editDiagnosis,
        medicines: editMedicines,
        instruction: editInstruction,
      });
      toast.success('Template updated!');
      setEditingTemplate(null);
      await loadTemplates();
    } catch {
      toast.error('Failed to update template.');
    } finally {
      setUpdatingTemplate(false);
    }
  };

  const updateEditMedicine = (index: number, key: keyof Omit<MedicineRow, 'schedule'>, value: string) => {
    setEditMedicines(prev => prev.map((m, i) => i === index ? { ...m, [key]: value } : m));
  };

  const addEditMedicine = () => setEditMedicines(prev => [...prev, emptyMedicine()]);
  const removeEditMedicine = (index: number) => setEditMedicines(prev => prev.filter((_, i) => i !== index));

  const handleDuplicateTemplate = async (id: string) => {
    try {
      await api.post(`/doctor/prescription-templates/${id}/duplicate`);
      await loadTemplates();
      toast.success('Template duplicated.');
    } catch {
      toast.error('Failed to duplicate template.');
    }
  };

  const handleToggleFavorite = async (id: string) => {
    try {
      await api.patch(`/doctor/prescription-templates/${id}/favorite`);
      await loadTemplates();
    } catch { /* non-fatal */ }
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadPrescriptions(patientId);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [patientId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void (async () => {
        try {
          const response = await api.get('/doctor/hospital-profile');
          setHospitalProfile(response.data?.data || null);
        } catch (error) {
          toast.error(getErrorMessage(error, 'Failed to load hospital branding'));
          setHospitalProfile(null);
        }
      })();
      void loadSavedMedicines();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadSavedMedicines]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      if (!patientId) {
        setSelectedPatientId(null);
        setPatientContext(null);
        return;
      }

      void (async () => {
        try {
          const response = await api.get(`/doctor/patients/${patientId}`);
          const nextContext = response.data?.data || null;
          setPatientContext(nextContext);
          setPatientName(nextContext?.patient?.patientName || '');
          setSelectedPatientId(nextContext?.patient?._id || patientId);
        } catch (error) {
          toast.error(getErrorMessage(error, 'Failed to load patient context'));
          setPatientContext(null);
        }
      })();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [patientId]);

  useEffect(() => {
    if (!patientSuggestionsOpen) return;

    const timeoutId = window.setTimeout(() => {
      void (async () => {
        try {
          setPatientSuggestionsLoading(true);
          const response = await api.get('/doctor/patients', {
            params: {
              limit: 5,
              ...((patientName || '').trim() ? { search: (patientName || '').trim() } : {}),
            },
          });
          setPatientSuggestions(response.data?.data || []);
        } catch {
          setPatientSuggestions([]);
        } finally {
          setPatientSuggestionsLoading(false);
        }
      })();
    }, 180);

    return () => window.clearTimeout(timeoutId);
  }, [patientName, patientSuggestionsOpen]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!patientInputRef.current?.contains(event.target as Node)) {
        setPatientSuggestionsOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  useEffect(() => {
    void loadTemplates('recent');
  }, [loadTemplates]);

  const updateMedicine = (
    index: number,
    key: keyof Omit<MedicineRow, 'schedule'>,
    value: string
  ) => {
    setMedicines((current) =>
      current.map((medicine, medicineIndex) =>
        medicineIndex === index ? { ...medicine, [key]: value } : medicine
      )
    );
  };

  const updateMedicineSchedule = (
    index: number,
    key: keyof MedicineSchedule,
    value: boolean | string
  ) => {
    setMedicines((current) =>
      current.map((medicine, medicineIndex) =>
        medicineIndex === index
          ? {
              ...medicine,
              schedule: {
                ...medicine.schedule,
                [key]: value,
              },
            }
          : medicine
      )
    );
  };

  const addMedicine = () => {
    setMedicines((current) => [...current, emptyMedicine()]);
  };

  const removeMedicine = (index: number) => {
    setMedicines((current) => (current.length === 1 ? current : current.filter((_, medicineIndex) => medicineIndex !== index)));
  };

  const resetForm = () => {
    setDiagnosis('');
    setPrescriptionDate(getTodayDate());
    setFollowUpDate('');
    setInstruction('');
    setDoctorNotes('');
    setMedicines([emptyMedicine()]);
  };

  const handlePatientNameChange = (value: string) => {
    setPatientName(value);
    setSelectedPatientId(null);
    setPatientContext(null);
    setPatientSuggestionsOpen(true);
  };

  const selectPatientSuggestion = (patient: PatientSuggestion & { name?: string }) => {
    const name = patient.patientName || patient.name || '';
    setSelectedPatientId(patient._id);
    setPatientName(name);
    setPatientSuggestionsOpen(false);
    setPatientContext({
      patient: {
        _id: patient._id,
        patientName: name,
        age: patient.age,
        gender: patient.gender,
        bloodGroup: patient.bloodGroup,
        status: 'Active',
      },
      careSummary: {
        department: 'Selected patient',
        specialization: 'Linked from patient list',
      },
    });
    void loadPrescriptions(patient._id);
  };

  const handleSave = async () => {
    if (!(patientName || '').trim()) {
      toast.error('Patient name is required.');
      return;
    }

    if (!(diagnosis || '').trim()) {
      toast.error('Diagnosis is required.');
      return;
    }

    const validMedicines = medicines.filter(
      (medicine) =>
        (medicine.medicineName || '').trim() &&
        (medicine.dosage || '').trim() &&
        (medicine.frequency || '').trim() &&
        (medicine.duration || '').trim()
    );

    if (validMedicines.length === 0) {
      toast.error('Add at least one complete medicine entry.');
      return;
    }

    try {
      setSaving(true);
      const response = await api.post('/doctor/prescriptions', {
        patientId: selectedPatientId || undefined,
        patientName,
        diagnosis,
        prescriptionDate,
        followUpDate: followUpDate || undefined,
        instruction,
        doctorNotes,
        medicines: validMedicines,
        includemedikwikLogo,
      });

      toast.success(response.data?.message || 'Prescription created successfully.');
      resetForm();
      void loadSavedMedicines();
      await loadPrescriptions(selectedPatientId || patientId);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to save prescription'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
    <div className="mx-auto max-w-[1180px] space-y-4" onClick={() => { setTemplateDropdownOpen(false); setActiveMedicineDropdown(null); }}>
      <div className="flex items-center justify-between">
        <Link href={patientId ? getDoctorPath(`/my-patients/${patientId}`) : getDoctorPath('/my-patients')}>
          <Button variant="outline" className="rounded-xl border-slate-200">
            <ArrowLeft size={16} className="mr-2" />
            Back
          </Button>
        </Link>
        <Badge variant="secondary" className="rounded-full bg-emerald-50 text-emerald-600">
          Add new prescription
        </Badge>
      </div>

      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Prescription</h1>
        <p className="mt-1.5 text-sm text-slate-500">
          Add new prescription with patient name, diagnosis, date, follow up, medicines, and instruction.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <Card className="rounded-3xl border border-slate-200 py-0 shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
          <CardHeader className="px-5 pt-5">
            <CardTitle className="text-lg font-semibold text-slate-950">Patient context</CardTitle>
            <CardDescription>Selected patient and clinical context from doctor flow</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 px-5 pb-5 pt-0">
            {patientContext ? (
              <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-xl font-semibold text-slate-950">{patientContext.patient.patientName}</div>
                <div className="text-sm text-slate-600">
                  {patientContext.patient.age || '-'} yrs, {patientContext.patient.gender || '-'}, {patientContext.patient.bloodGroup || '-'}
                </div>
                <div className="text-sm text-slate-600">
                  {patientContext.careSummary.department} / {patientContext.careSummary.specialization}
                </div>
                <Badge variant="secondary" className="rounded-full bg-blue-50 text-primary">
                  {patientContext.patient.status}
                </Badge>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                Open this page from My Patients to attach patient context automatically.
              </div>
            )}

            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <h3 className="text-sm font-semibold text-slate-950">Recent prescriptions</h3>
              <div className="mt-3 space-y-3">
                {recentPrescriptions.length === 0 ? (
                  <p className="text-sm text-slate-500">No prescription history found yet.</p>
                ) : (
                  recentPrescriptions.slice(0, 4).map((item) => (
                    <div key={item._id} className="rounded-xl border border-slate-200 bg-white p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-950">{item.patientName}</p>
                          <p className="mt-0.5 text-xs text-slate-500">{item.diagnosis}</p>
                        </div>
                        <div className="text-right text-xs text-slate-500">
                          {new Date(item.prescriptionDate).toLocaleDateString()}
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
            <CardTitle className="text-lg font-semibold text-slate-950">Add new prescription</CardTitle>
            <CardDescription>Structured prescription form with hospital branding and medicine details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 px-5 pb-5 pt-0">
            {/* Template Selector */}
            <div className="relative mb-4" onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTemplateDropdownOpen(v => !v)}
                  className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 transition-colors"
                >
                  <span>📋</span>
                  <span>Use Template</span>
                  <span className="ml-1 text-xs text-blue-500">({templates.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowTemplatePanel(v => !v)}
                  className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  ⚙️ Manage
                </button>
              </div>

              {templateDropdownOpen && (
                <div className="absolute left-0 top-11 z-50 w-96 rounded-2xl border border-gray-200 bg-white shadow-2xl">
                  <div className="p-3 border-b border-gray-100">
                    <input
                      type="text"
                      placeholder="Search templates..."
                      value={templateSearch}
                      onChange={e => setTemplateSearch(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-blue-400"
                    />
                  </div>
                  <div className="flex border-b border-gray-100">
                    {(['recent', 'favorites', 'all'] as const).map(tab => (
                      <button
                        key={tab}
                        onClick={() => { setActiveTemplateTab(tab); void loadTemplates(tab === 'all' ? 'mostUsed' : tab); }}
                        className={`flex-1 py-2 text-xs font-medium capitalize transition-colors ${
                          activeTemplateTab === tab ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        {tab === 'recent' ? '🕐 Recent' : tab === 'favorites' ? '⭐ Favorites' : '📋 All'}
                      </button>
                    ))}
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {templates
                      .filter(t =>
                        !templateSearch || t.templateName.toLowerCase().includes(templateSearch.toLowerCase())
                      )
                      .filter(t => activeTemplateTab !== 'favorites' || t.isFavorite)
                      .map(template => (
                        <div
                          key={template._id}
                          className="group flex items-center justify-between px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-50 last:border-0"
                        >
                          <div className="flex-1" onClick={() => void applyTemplate(template)}>
                            <p className="text-sm font-semibold text-gray-800">{template.templateName}</p>
                            {template.diagnosis && <p className="text-xs text-gray-500 truncate">{template.diagnosis}</p>}
                            <p className="text-xs text-gray-400">{template.medicines.length} medicines · Used {template.useCount}×</p>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={e => { e.stopPropagation(); void handleToggleFavorite(template._id); }}
                              className="rounded-lg p-1 hover:bg-yellow-50" title={template.isFavorite ? 'Remove favorite' : 'Add favorite'}>
                              {template.isFavorite ? '⭐' : '☆'}
                            </button>
                            <button onClick={e => { e.stopPropagation(); openEditTemplate(template); }}
                              className="rounded-lg p-1 hover:bg-blue-50 text-gray-400" title="Edit template">
                              ✏️
                            </button>
                            <button onClick={e => { e.stopPropagation(); void handleDuplicateTemplate(template._id); }}
                              className="rounded-lg p-1 hover:bg-gray-100 text-gray-400" title="Duplicate">
                              📄
                            </button>
                            <button onClick={e => { e.stopPropagation(); handleDeleteTemplate(template._id); }}
                              className="rounded-lg p-1 hover:bg-red-50 text-gray-400" title="Delete">
                              🗑️
                            </button>
                          </div>
                        </div>
                      ))
                    }
                    {templates.length === 0 && (
                      <p className="px-4 py-8 text-center text-sm text-gray-400">No templates yet. Save a prescription as a template to get started.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-50 via-white to-emerald-50/60 p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    {hospitalProfile?.logoUrl ? (
                      <Image
                        src={hospitalProfile.logoUrl}
                        alt={`${hospitalProfile.name} logo`}
                        width={80}
                        height={80}
                        className="h-full w-full object-contain"
                        unoptimized
                      />
                    ) : (
                      <Building2 className="h-8 w-8 text-slate-300" />
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Hospital branding</p>
                    <h3 className="mt-1 text-lg font-semibold text-slate-950">
                      {hospitalProfile?.name || 'Assigned hospital'}
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {hospitalProfile?.hasLogo
                        ? 'Logo managed by hospital admin and shown on generated PDFs.'
                        : 'Hospital admin has not uploaded a logo yet.'}
                    </p>
                  </div>
                </div>

                <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <input
                    checked={includemedikwikLogo}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-primary"
                    onChange={(event) => setIncludemedikwikLogo(event.target.checked)}
                    type="checkbox"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-slate-950">Include healthcare logo</span>
                    <span className="mt-1 block text-xs text-slate-500">
                      Optional platform branding on the prescription PDF header.
                    </span>
                  </span>
                </label>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-900">Patient Name</label>
                <div className="relative" ref={patientInputRef}>
                  <Input
                    autoComplete="off"
                    value={patientName}
                    onChange={(event) => handlePatientNameChange(event.target.value)}
                    onFocus={() => setPatientSuggestionsOpen(true)}
                    placeholder="Search patient name"
                    className="h-10 rounded-xl border-slate-200"
                  />
                  {patientSuggestionsOpen ? (
                    <div className="absolute left-0 right-0 top-[calc(100%+0.4rem)] z-30 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                      {patientSuggestionsLoading ? (
                        <div className="px-3 py-3 text-sm text-slate-500">Searching patients...</div>
                      ) : patientSuggestions.length ? (
                        <div className="max-h-72 overflow-y-auto py-1">
                          {patientSuggestions.slice(0, 5).map((patient) => (
                            <button
                              className="flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-slate-50"
                              key={patient._id}
                              onMouseDown={(event) => {
                                event.preventDefault();
                                selectPatientSuggestion(patient);
                              }}
                              type="button"
                            >
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-semibold text-slate-950">
                                  {patient.patientName || (patient as any).name || ''}
                                </span>
                                <span className="mt-0.5 block truncate text-xs text-slate-500">
                                  {[patient.email, patient.phone].filter(Boolean).join(' / ') || 'No contact added'}
                                </span>
                              </span>
                              <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                                {[patient.age ? `${patient.age} yrs` : null, patient.gender].filter(Boolean).join(', ') || 'Patient'}
                              </span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="px-3 py-3 text-sm text-slate-500">
                          No matching patients found.
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
                {selectedPatientId ? (
                  <p className="text-xs text-emerald-600">Linked to selected patient record.</p>
                ) : (
                  <p className="text-xs text-slate-500">Select a patient from the list to link this prescription.</p>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-900">Diagnosis</label>
                <Input
                  value={diagnosis}
                  onChange={(event) => setDiagnosis(event.target.value)}
                  placeholder="Enter diagnosis"
                  className="h-10 rounded-xl border-slate-200"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-900">Date</label>
                <Input
                  type="date"
                  value={prescriptionDate}
                  onChange={(event) => setPrescriptionDate(event.target.value)}
                  className="h-10 rounded-xl border-slate-200"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-900">Follow up</label>
                <Input
                  type="date"
                  value={followUpDate}
                  onChange={(event) => setFollowUpDate(event.target.value)}
                  className="h-10 rounded-xl border-slate-200"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-950">Add Medicines</h3>
                  <p className="text-xs text-slate-500">Medicine name, dosage, frequency, and duration</p>
                </div>
                <Button type="button" variant="outline" className="rounded-xl border-slate-200" onClick={addMedicine}>
                  <Plus size={16} className="mr-2" />
                  Add medicine
                </Button>
              </div>

              <div className="space-y-3">
                {medicines.map((medicine, index) => (
                  <div key={index} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                        <Pill size={15} className="text-primary" />
                        Medicine {index + 1}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="rounded-lg border-slate-200 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                          onClick={() => void handleSaveMedicineToLibrary(index)}
                          disabled={savingMedicineRowIndex === index}
                        >
                          {savingMedicineRowIndex === index ? 'Saving...' : '💾 Save to Library'}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="rounded-lg border-slate-200 text-red-500 hover:text-red-500"
                          onClick={() => removeMedicine(index)}
                          disabled={medicines.length === 1}
                        >
                          <Trash2 size={14} className="mr-1.5" />
                          Remove
                        </Button>
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-2 relative" onClick={(e) => e.stopPropagation()}>
                        <label className="text-sm font-medium text-slate-900">Medicine Name</label>
                        <div className="relative">
                          <Input
                            value={medicine.medicineName}
                            onChange={(event) => {
                              updateMedicine(index, 'medicineName', event.target.value);
                              setActiveMedicineDropdown(index);
                            }}
                            onFocus={(e) => {
                              e.stopPropagation();
                              setActiveMedicineDropdown(index);
                            }}
                            placeholder="Medicine name"
                            className="h-10 rounded-xl border-slate-200 bg-white pr-10"
                            autoComplete="off"
                          />
                          {(medicine.medicineName || '').trim() && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                updateMedicine(index, 'medicineName', '');
                                setActiveMedicineDropdown(index);
                              }}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                        {activeMedicineDropdown === index && (
                          <div className="absolute z-50 left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl">
                            {(() => {
                              const typedName = (medicine.medicineName || '').toLowerCase().trim();
                              const filtered = savedMedicines.filter((m) =>
                                !typedName || m.medicineName.toLowerCase().includes(typedName)
                              );

                              if (filtered.length === 0) {
                                return (
                                  <div className="p-3 text-xs text-slate-400 text-center">
                                    No saved medicines match. Fill details and click "Save to Library" to add.
                                  </div>
                                );
                              }

                              return filtered.map((savedMed) => (
                                <div
                                  key={savedMed._id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    applySavedMedicine(index, savedMed);
                                  }}
                                  className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0"
                                >
                                  <div className="flex-1 min-w-0 pr-2">
                                    <p className="font-semibold text-slate-900 text-sm truncate">
                                      {savedMed.medicineName}
                                    </p>
                                    <p className="text-xs text-slate-500 truncate font-normal">
                                      {savedMed.dosage} · {savedMed.frequency} · {savedMed.duration}
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={(e) => handleDeleteMedicineFromLibrary(savedMed._id, e)}
                                    className="text-slate-400 hover:text-red-500 rounded p-1 hover:bg-red-50 transition-colors"
                                    title="Delete from library"
                                  >
                                    🗑️
                                  </button>
                                </div>
                              ));
                            })()}
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-900">Dosage</label>
                        <Input
                          value={medicine.dosage}
                          onChange={(event) => updateMedicine(index, 'dosage', event.target.value)}
                          placeholder="e.g. 500mg"
                          className="h-10 rounded-xl border-slate-200 bg-white"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-900">Frequency</label>
                        <Input
                          value={medicine.frequency}
                          onChange={(event) => updateMedicine(index, 'frequency', event.target.value)}
                          placeholder="e.g. Twice daily"
                          className="h-10 rounded-xl border-slate-200 bg-white"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-900">Duration</label>
                        <Input
                          value={medicine.duration}
                          onChange={(event) => updateMedicine(index, 'duration', event.target.value)}
                          placeholder="e.g. 5 days"
                          className="h-10 rounded-xl border-slate-200 bg-white"
                        />
                      </div>
                    </div>
                    <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
                      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-950">
                        <Clock3 size={15} className="text-primary" />
                        Medicine timing
                      </div>
                      <div className="grid gap-3 md:grid-cols-3">
                        {medicineScheduleOptions.map((option) => {
                          const enabled = medicine.schedule[option.key];

                          return (
                            <div
                              className="rounded-xl border border-slate-200 bg-slate-50/70 p-3"
                              key={option.key}
                            >
                              <label className="flex items-center gap-2 text-sm font-medium text-slate-900">
                                <input
                                  checked={enabled}
                                  className="h-4 w-4 rounded border-slate-300 text-primary"
                                  onChange={(event) =>
                                    updateMedicineSchedule(index, option.key, event.target.checked)
                                  }
                                  type="checkbox"
                                />
                                {option.label}
                              </label>
                              <Input
                                className="mt-2 h-9 rounded-lg border-slate-200 bg-white"
                                disabled={!enabled}
                                onChange={(event) =>
                                  updateMedicineSchedule(index, option.timeKey, event.target.value)
                                }
                                type="time"
                                value={medicine.schedule[option.timeKey]}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-900">Instruction</label>
              <textarea
                value={instruction}
                onChange={(event) => setInstruction(event.target.value)}
                placeholder="Add patient instructions, precautions, dietary advice, and notes"
                className="min-h-[140px] w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/30"
              />
            </div>

            <div className="space-y-2 mt-4">
              <label className="text-sm font-medium text-gray-700">Doctor Notes (Internal)</label>
              <textarea
                value={doctorNotes}
                onChange={e => setDoctorNotes(e.target.value)}
                placeholder="Private notes for the doctor record (not shown to patient)"
                className="min-h-[80px] w-full resize-none rounded-xl border border-gray-200 bg-gray-50/30 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:bg-white"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                className="rounded-xl bg-primary text-white hover:bg-primary/90"
                disabled={saving}
                onClick={() => void handleSave()}
              >
                <ClipboardPlus size={16} className="mr-2" />
                {saving ? 'Saving...' : 'Save Prescription'}
              </Button>
              <button
                type="button"
                onClick={() => setShowSaveTemplateModal(true)}
                className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-100 transition-colors"
              >
                💾 Save as Template
              </button>
              <Button variant="outline" className="rounded-xl border-slate-200" onClick={resetForm}>
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      {/* Save as Template Modal */}
      {showSaveTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Save as Template</h3>
            <p className="text-sm text-gray-500 mb-4">Give this prescription template a name so you can reuse it later.</p>
            <input
              type="text"
              placeholder="Template name (e.g. Common Cold, Follow-up Visit)"
              value={newTemplateName}
              onChange={e => setNewTemplateName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && void handleSaveTemplate()}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-blue-400 focus:bg-white mb-4"
              autoFocus
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setShowSaveTemplateModal(false); setNewTemplateName(''); }}
                className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleSaveTemplate()}
                disabled={savingTemplate || !(newTemplateName || '').trim()}
                className="rounded-xl bg-green-600 px-6 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
              >
                {savingTemplate ? 'Saving...' : 'Save Template'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Template Modal */}
      {editingTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">✏️ Edit Template</h3>
                <p className="text-xs text-gray-400 mt-0.5">Changes apply to future uses of this template only</p>
              </div>
              <button onClick={() => setEditingTemplate(null)} className="rounded-xl p-2 hover:bg-gray-100 text-gray-400">
                ✕
              </button>
            </div>

            {/* Scrollable body */}
            <div className="overflow-y-auto px-6 py-4 space-y-4 flex-1">
              {/* Name */}
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Template Name</label>
                <input
                  type="text"
                  value={editTemplateName}
                  onChange={e => setEditTemplateName(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-blue-400 focus:bg-white"
                  placeholder="e.g. Common Cold, Hypertension Follow-up"
                  autoFocus
                />
              </div>

              {/* Diagnosis */}
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Diagnosis</label>
                <input
                  type="text"
                  value={editDiagnosis}
                  onChange={e => setEditDiagnosis(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-blue-400 focus:bg-white"
                  placeholder="e.g. Acute Pharyngitis"
                />
              </div>

              {/* Medicines */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">Medicines</label>
                  <button
                    type="button"
                    onClick={addEditMedicine}
                    className="flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-1 text-xs font-medium text-blue-600 hover:bg-blue-100"
                  >
                    <Plus size={12} /> Add Medicine
                  </button>
                </div>
                {editMedicines.map((medicine, index) => (
                  <div key={index} className="rounded-xl border border-gray-200 bg-gray-50/60 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-500">Medicine {index + 1}</span>
                      {editMedicines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeEditMedicine(index)}
                          className="rounded-lg p-1 hover:bg-red-50 text-gray-400"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        value={medicine.medicineName}
                        onChange={e => updateEditMedicine(index, 'medicineName', e.target.value)}
                        placeholder="Medicine name"
                        className="col-span-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400"
                      />
                      <input
                        value={medicine.dosage}
                        onChange={e => updateEditMedicine(index, 'dosage', e.target.value)}
                        placeholder="Dosage (e.g. 500mg)"
                        className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400"
                      />
                      <input
                        value={medicine.frequency}
                        onChange={e => updateEditMedicine(index, 'frequency', e.target.value)}
                        placeholder="Frequency (e.g. Twice daily)"
                        className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400"
                      />
                      <input
                        value={medicine.duration}
                        onChange={e => updateEditMedicine(index, 'duration', e.target.value)}
                        placeholder="Duration (e.g. 5 days)"
                        className="col-span-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Instructions */}
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Instructions</label>
                <textarea
                  value={editInstruction}
                  onChange={e => setEditInstruction(e.target.value)}
                  rows={3}
                  placeholder="Patient instructions, dietary advice..."
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-blue-400 focus:bg-white resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-3 justify-end px-6 py-4 border-t border-gray-100">
              <button
                onClick={() => setEditingTemplate(null)}
                className="rounded-xl border border-gray-200 px-5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleUpdateTemplate()}
                disabled={updatingTemplate || !(editTemplateName || '').trim()}
                className="rounded-xl bg-blue-600 px-6 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {updatingTemplate ? 'Saving...' : '✓ Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
      <ConfirmDeleteDialog {...deleteMedicineDialogProps} />
      <ConfirmDeleteDialog {...deleteTemplateDialogProps} />
    </>
  );
}
