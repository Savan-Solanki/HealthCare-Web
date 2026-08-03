'use client';

import { useEffect, useState, useRef } from 'react';
import { 
  Search, 
  Plus, 
  FileDown, 
  Printer, 
  Trash2, 
  Loader2, 
  FileText, 
  CircleDollarSign, 
  Calendar,
  CheckCircle2,
  AlertCircle,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ConfirmDeleteDialog, useConfirmDelete } from '@/components/ui/confirm-delete-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type UserProfile = {
  id: string;
  name: string;
  email: string;
  role: 'Super Admin' | 'Hospital Admin' | 'Doctor' | 'Receptionist' | 'Staff';
  hospitalId?: string | { _id: string; name: string } | null;
};

type ReceiptTemplate = {
  _id: string;
  templateName: string;
  amount: number;
  consultationType: string;
  description: string;
  useCount: number;
  createdAt: string;
};


type PatientRecord = {
  _id: string;
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
  age?: number;
  gender?: string;
};

type DoctorRecord = {
  _id: string;
  firstName: string;
  lastName: string;
  consultationFee: number;
  specialization?: string;
  department?: string;
};

type ReceiptRecord = {
  _id: string;
  receiptNumber: string;
  patientId: PatientRecord;
  doctorId: DoctorRecord;
  subtotal: number;
  discount: number;
  tax: number;
  amount: number;
  paidAmount: number;
  dueAmount: number;
  createdAt: string;
};

export function ReceiptsDashboard() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [receipts, setReceipts] = useState<ReceiptRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Search Filters
  const [receiptNumber, setReceiptNumber] = useState('');
  const [patientName, setPatientName] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Create Modal
  const [isOpen, setIsOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form State
  const [searchPatient, setSearchPatient] = useState('');
  const [patientSuggestions, setPatientSuggestions] = useState<PatientRecord[]>([]);
  const [patientSuggestionsLoading, setPatientSuggestionsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<PatientRecord | null>(null);

  const [doctorsList, setDoctorsList] = useState<DoctorRecord[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorRecord | null>(null);

  const [discount, setDiscount] = useState('0');
  const [tax, setTax] = useState('18');
  const [paidAmount, setPaidAmount] = useState('0');

  const patientInputRef = useRef<HTMLDivElement | null>(null);

  // Admissions & Custom line items state
  const [admissions, setAdmissions] = useState<any[]>([]);
  const [selectedAdmissionId, setSelectedAdmissionId] = useState('');
  const [loadingAdmissions, setLoadingAdmissions] = useState(false);
  const [lineItems, setLineItems] = useState<{ description: string; amount: number }[]>([]);

  const handleAddLineItem = (description: string, amount: number) => {
    setLineItems([...lineItems, { description, amount }]);
  };

  const handleRemoveLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const fetchPatientAdmissions = async (patientId: string) => {
    try {
      setLoadingAdmissions(true);
      const response = await api.get('/hospital-admin/admissions', {
        params: { search: patientId }
      });
      setAdmissions(response.data?.data || []);
    } catch {
      setAdmissions([]);
    } finally {
      setLoadingAdmissions(false);
    }
  };

  // Receipt Template state
  const [receiptTemplates, setReceiptTemplates] = useState<ReceiptTemplate[]>([]);
  const [templateDropdownOpen, setTemplateDropdownOpen] = useState(false);
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [templateSearch, setTemplateSearch] = useState('');

  // Fetch Current User
  useEffect(() => {
    void (async () => {
      try {
        const response = await api.get('/auth/me');
        setUser(response.data?.user || null);
      } catch {
        toast.error('Failed to load user profile');
      }
    })();
  }, []);

  // Close suggestions on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (patientInputRef.current && !patientInputRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load receipt templates
  const loadReceiptTemplates = async () => {
    try {
      const res = await api.get('/receipts/templates', { params: { sort: 'mostUsed' } });
      setReceiptTemplates(res.data?.data || []);
    } catch {
      // non-fatal
    }
  };

  const applyReceiptTemplate = async (tpl: ReceiptTemplate) => {
    setTemplateDropdownOpen(false);
    setSelectedAdmissionId('');
    
    let loadedLineItems = [];
    let loadedDiscount = '0';
    let loadedTax = '18';

    if (tpl.description) {
      try {
        const parsed = JSON.parse(tpl.description);
        if (parsed && typeof parsed === 'object') {
          if (Array.isArray(parsed.lineItems)) {
            loadedLineItems = parsed.lineItems;
          }
          if (parsed.discount !== undefined) {
            loadedDiscount = String(parsed.discount);
          }
          if (parsed.tax !== undefined) {
            loadedTax = String(parsed.tax);
          }
        }
      } catch {
        // Fallback for legacy templates where description is just text
      }
    }

    if (loadedLineItems.length > 0) {
      setLineItems(loadedLineItems);
    } else if (tpl.amount > 0) {
      setLineItems([
        { description: 'Consultation Fee', amount: tpl.amount }
      ]);
    }

    setDiscount(loadedDiscount);
    setTax(loadedTax);

    // Record usage (non-fatal)
    try {
      await api.patch(`/receipts/templates/${tpl._id}/use`);
      void loadReceiptTemplates();
    } catch { /* non-fatal */ }
  };

  const handleSaveReceiptTemplate = async () => {
    if (!newTemplateName.trim()) return;
    setSavingTemplate(true);
    try {
      await api.post('/receipts/templates', {
        templateName: newTemplateName.trim(),
        amount: subtotal,
        consultationType: selectedDoctor
          ? `Dr. ${selectedDoctor.firstName} ${selectedDoctor.lastName}`
          : '',
        description: JSON.stringify({
          lineItems,
          discount,
          tax,
        }),
      });
      toast.success('Receipt template saved!');
      setShowSaveTemplateModal(false);
      setNewTemplateName('');
      void loadReceiptTemplates();
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
      await api.delete(`/receipts/templates/${deleteTemplateId}`);
      setReceiptTemplates(prev => prev.filter(t => t._id !== deleteTemplateId));
      toast.success('Template deleted.');
    } catch {
      toast.error('Failed to delete template.');
    } finally {
      setDeleteTemplateId(null);
    }
  });

  const handleDeleteReceiptTemplate = (id: string) => {
    setDeleteTemplateId(id);
    openDeleteTemplateConfirm({ title: 'Delete Receipt Template', description: 'Are you sure you want to delete this receipt template? This action cannot be undone.' });
  };

  // Fetch receipts list
  const fetchReceipts = async (page = 1) => {
    try {
      setLoading(true);
      const params: Record<string, string> = { page: String(page), limit: '20' };
      if (receiptNumber.trim()) params.receiptNumber = receiptNumber.trim();
      if (patientName.trim()) params.patientName = patientName.trim();
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;

      const response = await api.get('/receipts', { params });
      setReceipts(response.data?.data || []);
    } catch {
      toast.error('Failed to load receipts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      void fetchReceipts();
      void loadReceiptTemplates();
    }
  }, [user]);

  // Load doctors if user is not Doctor
  useEffect(() => {
    if (isOpen && user && user.role !== 'Doctor') {
      void (async () => {
        try {
          const response = await api.get('/hospital-admin/doctors');
          setDoctorsList(response.data?.data || []);
        } catch {
          toast.error('Failed to load doctor profiles');
        }
      })();
    }
  }, [isOpen, user]);

  // Load Doctor own context
  useEffect(() => {
    if (isOpen && user && user.role === 'Doctor') {
      void (async () => {
        try {
          const response = await api.get('/doctor/dashboard');
          const docProfile = response.data?.data?.doctorProfile;
          if (docProfile) {
            // Find doctor ID via active doctor profiles
            const doctorsResp = await api.get('/hospital-admin/doctors');
            const match = (doctorsResp.data?.data || []).find(
              (d: any) => d.email === user.email
            );
            if (match) {
              setSelectedDoctor(match);
              setSelectedDoctorId(match._id);
              const sub = match.consultationFee || 0;
              setLineItems([{ description: 'Consultation Fee', amount: sub }]);
            }
          }
        } catch {
          toast.error('Failed to resolve doctor details');
        }
      })();
    }
  }, [isOpen, user]);

  // Reset form states on modal close
  useEffect(() => {
    if (!isOpen) {
      setSelectedPatient(null);
      setSearchPatient('');
      setSelectedDoctorId('');
      setDiscount('0');
      setTax('18');
      setPaidAmount('0');
      setLineItems([]);
    }
  }, [isOpen]);

  // Handle Doctor select (for Receptionist)
  useEffect(() => {
    if (selectedDoctorId) {
      const doc = doctorsList.find((d) => d._id === selectedDoctorId) || null;
      setSelectedDoctor(doc);
      if (doc) {
        const fee = doc.consultationFee || 0;
        setLineItems(current => {
          const hasConsultationFee = current.some(item => item.description === 'Consultation Fee');
          if (hasConsultationFee) {
            return current.map(item => item.description === 'Consultation Fee' ? { ...item, amount: fee } : item);
          } else {
            return [{ description: 'Consultation Fee', amount: fee }, ...current];
          }
        });
      }
    } else {
      setSelectedDoctor(null);
      setLineItems(current => current.filter(item => item.description !== 'Consultation Fee'));
    }
  }, [selectedDoctorId, doctorsList]);

  // Handle Patient Search Suggestions
  const handlePatientSearchChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchPatient(val);
    setSelectedPatient(null);

    if (val.trim().length < 2) {
      setPatientSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    try {
      setPatientSuggestionsLoading(true);
      setShowSuggestions(true);
      
      const searchPath = user?.role === 'Doctor' ? '/doctor/patients' : '/hospital-admin/patients';
      const response = await api.get(searchPath, {
        params: { search: val, limit: 10 }
      });
      setPatientSuggestions(response.data?.data || []);
    } catch {
      // Ignore search errors silently
    } finally {
      setPatientSuggestionsLoading(false);
    }
  };

  const handleSelectPatient = (patient: PatientRecord) => {
    setSelectedPatient(patient);
    setSearchPatient(`${patient.firstName} ${patient.lastName} (${patient.phone || 'No phone'})`);
    setShowSuggestions(false);
    void fetchPatientAdmissions(patient._id);
  };

  // Billing calculation values
  const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);

  const discountPercent = Number(discount) || 0;
  const discountAmount = (subtotal * discountPercent) / 100;
  const finalAmount = Math.max(0, subtotal - discountAmount);

  const taxPercent = Number(tax) || 0;
  const taxAmount = (finalAmount * taxPercent) / 100;

  const dueAmount = Math.max(0, finalAmount - (Number(paidAmount) || 0));

  useEffect(() => {
    if (isOpen) {
      setPaidAmount(finalAmount.toFixed(2));
    }
  }, [finalAmount, isOpen]);

  // Reset Filters
  const handleResetFilters = () => {
    setReceiptNumber('');
    setPatientName('');
    setDateFrom('');
    setDateTo('');
    setTimeout(() => {
      void fetchReceipts();
    }, 0);
  };

  // Submit Receipt Creation
  const handleGenerateReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) {
      toast.error('Please select a patient.');
      return;
    }
    if (!selectedDoctorId) {
      toast.error('Please select a doctor.');
      return;
    }

    try {
      setSaving(true);
      const response = await api.post('/receipts', {
        patientId: selectedPatient._id,
        doctorId: selectedDoctorId,
        discount: discountAmount,
        tax: taxAmount,
        paidAmount: Number(paidAmount) || 0,
        admissionId: selectedAdmissionId || undefined,
        lineItems: lineItems.length > 0 ? lineItems : undefined,
      });

      toast.success('Receipt generated successfully!');
      setIsOpen(false);
      
      // Reset form
      setSelectedPatient(null);
      setSearchPatient('');
      setSelectedDoctorId('');
      setDiscount('0');
      setTax('18');
      setPaidAmount('0');
      setAdmissions([]);
      setSelectedAdmissionId('');
      setLineItems([]);

      void fetchReceipts();

      // Automatically trigger PDF print/download
      const receiptId = response.data?.data?._id;
      if (receiptId) {
        void handleReprint(receiptId);
      }
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Failed to generate receipt';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  // Reprint Receipt PDF
  const handleReprint = async (receiptId: string) => {
    try {
      const response = await api.get(`/receipts/${receiptId}/download`);
      const url = response.data?.data?.url;
      if (url) {
        window.open(url, '_blank');
      } else {
        toast.error('PDF URL not available');
      }
    } catch {
      toast.error('Failed to load receipt PDF');
    }
  };

  // Export CSV Reports
  const handleExportCSV = async () => {
    try {
      setExporting(true);
      const params: Record<string, string> = {};
      if (receiptNumber.trim()) params.receiptNumber = receiptNumber.trim();
      if (patientName.trim()) params.patientName = patientName.trim();
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;

      const response = await api.get('/receipts/export', {
        params,
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `receipts-export-${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('CSV Report exported successfully.');
    } catch {
      toast.error('Failed to export CSV report');
    } finally {
      setExporting(false);
    }
  };

  const isUserAdmin = user?.role === 'Super Admin' || user?.role === 'Hospital Admin';

  return (
    <>
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Receipt Management</h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Generate, search, and reprint consultation bill receipts.
          </p>
        </div>

        <Button onClick={() => setIsOpen(true)} className="rounded-xl bg-primary text-white hover:bg-primary/90">
          <Plus size={16} className="mr-2" />
          Generate Bill Receipt
        </Button>
      </div>

      {/* Search Filter Panel */}
      <Card className="rounded-2xl border border-slate-200 shadow-sm">
        <CardContent className="p-5">
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="receiptNumber" className="text-xs font-semibold text-slate-500">Receipt Number</Label>
              <Input
                id="receiptNumber"
                placeholder="e.g. RCP-2026-000001"
                value={receiptNumber}
                onChange={(e) => setReceiptNumber(e.target.value)}
                className="rounded-xl border-slate-200"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="patientName" className="text-xs font-semibold text-slate-500">Patient Name</Label>
              <Input
                id="patientName"
                placeholder="e.g. Aakash"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                className="rounded-xl border-slate-200"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dateFrom" className="text-xs font-semibold text-slate-500">Date From</Label>
              <Input
                id="dateFrom"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="rounded-xl border-slate-200"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dateTo" className="text-xs font-semibold text-slate-500">Date To</Label>
              <Input
                id="dateTo"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="rounded-xl border-slate-200"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap justify-between items-center gap-3 border-t border-slate-100 pt-4">
            <Button
              onClick={handleExportCSV}
              disabled={exporting || receipts.length === 0}
              variant="outline"
              className="rounded-xl border-slate-200 text-slate-700"
            >
              {exporting ? <Loader2 size={16} className="mr-2 animate-spin" /> : <FileDown size={16} className="mr-2 text-primary" />}
              Export Report (CSV)
            </Button>

            <div className="flex items-center gap-2">
              <Button onClick={handleResetFilters} variant="ghost" className="rounded-xl text-slate-500">
                Reset
              </Button>
              <Button onClick={() => void fetchReceipts()} className="rounded-xl">
                <Search size={16} className="mr-2" />
                Apply Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Receipts Table */}
      <Card className="rounded-3xl border border-slate-200 py-0 shadow-[0_10px_28px_rgba(15,23,42,0.05)] overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex h-64 items-center justify-center text-slate-500">
              <Loader2 size={24} className="mr-2 animate-spin text-primary" />
              Loading receipts list...
            </div>
          ) : receipts.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center text-slate-400 p-6 text-center">
              <CircleDollarSign size={48} className="text-slate-200 mb-3" />
              <p className="text-lg font-medium">No receipts generated yet</p>
              <p className="text-sm text-slate-400 mt-1 max-w-xs">
                Generated bills will be listed here. Click "Generate Bill Receipt" to create one.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 hover:bg-slate-50 border-b border-slate-100">
                  <TableHead className="py-3.5 text-xs font-bold uppercase text-slate-500 pl-6">Receipt No</TableHead>
                  <TableHead className="py-3.5 text-xs font-bold uppercase text-slate-500">Date</TableHead>
                  <TableHead className="py-3.5 text-xs font-bold uppercase text-slate-500">Patient</TableHead>
                  <TableHead className="py-3.5 text-xs font-bold uppercase text-slate-500">Consulting Doctor</TableHead>
                  <TableHead className="py-3.5 text-xs font-bold uppercase text-slate-500 text-right">Paid Amount</TableHead>
                  <TableHead className="py-3.5 text-xs font-bold uppercase text-slate-500 text-right">Due Amount</TableHead>
                  <TableHead className="py-3.5 text-xs font-bold uppercase text-slate-500 pr-6 text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receipts.map((r) => {
                  const patientFullName = [r.patientId?.firstName, r.patientId?.lastName].filter(Boolean).join(' ');
                  const doctorFullName = [r.doctorId?.firstName, r.doctorId?.lastName].filter(Boolean).join(' ');

                  return (
                    <TableRow key={r._id} className="border-b border-slate-100 hover:bg-slate-50/50">
                      <TableCell className="font-semibold text-slate-900 py-4 pl-6">{r.receiptNumber}</TableCell>
                      <TableCell className="text-slate-500 text-sm">
                        {new Date(r.createdAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium text-slate-900 text-sm">{patientFullName}</div>
                          <div className="text-xs text-slate-400">{r.patientId?.phone || 'No phone'}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-700 text-sm">
                        <div>
                          <div className="font-medium">Dr. {doctorFullName}</div>
                          <div className="text-xs text-slate-400">{r.doctorId?.specialization || 'Consultant'}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium text-slate-900 text-sm">
                        ₹{r.paidAmount.toFixed(2)}
                        <div className="text-[10px] text-slate-400">Total: ₹{r.amount.toFixed(2)}</div>
                      </TableCell>
                      <TableCell className="text-right">
                        {r.dueAmount > 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600">
                            <AlertCircle size={12} />
                            ₹{r.dueAmount.toFixed(2)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600">
                            <CheckCircle2 size={12} />
                            Paid
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="pr-6 text-center">
                        <Button
                          onClick={() => void handleReprint(r._id)}
                          variant="ghost"
                          size="sm"
                          className="h-8 rounded-lg text-primary hover:text-primary hover:bg-primary/5 px-2"
                        >
                          <Printer size={15} className="mr-1.5" />
                          Reprint
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Generate Receipt Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto rounded-3xl p-6 border-slate-100 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-900">Generate Consultation Receipt</DialogTitle>
            <DialogDescription className="text-sm text-slate-500">
              Select patient, doctor, and input billing details to issue a bill receipt.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={(e) => void handleGenerateReceipt(e)} className="space-y-4 py-2">
            {/* Template Selector */}
            <div className="relative">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTemplateDropdownOpen(v => !v)}
                  className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors"
                >
                  <span>📋</span>
                  <span>Use Template</span>
                  {receiptTemplates.length > 0 && <span className="text-blue-400">({receiptTemplates.length})</span>}
                </button>
              </div>
              {templateDropdownOpen && (
                <div className="absolute left-0 top-9 z-50 w-full rounded-xl border border-gray-200 bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
                  <div className="p-2 border-b border-gray-100">
                    <input
                      type="text"
                      placeholder="Search templates..."
                      value={templateSearch}
                      onChange={e => setTemplateSearch(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs outline-none focus:border-blue-400"
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {receiptTemplates
                      .filter(t => !templateSearch || t.templateName.toLowerCase().includes(templateSearch.toLowerCase()))
                      .map(tpl => (
                        <div key={tpl._id} className="group flex items-center justify-between px-3 py-2.5 hover:bg-blue-50 border-b border-gray-50 last:border-0">
                          <div className="flex-1 cursor-pointer" onClick={() => void applyReceiptTemplate(tpl)}>
                            <p className="text-sm font-semibold text-gray-800">{tpl.templateName}</p>
                            <p className="text-xs text-gray-400">₹{tpl.amount.toFixed(2)} · Used {tpl.useCount}×</p>
                          </div>
                          <button
                            type="button"
                            onClick={e => { e.stopPropagation(); handleDeleteReceiptTemplate(tpl._id); }}
                            className="opacity-0 group-hover:opacity-100 rounded-lg p-1 hover:bg-red-50 text-gray-400 text-xs transition-opacity"
                            title="Delete template"
                          >
                            🗑️
                          </button>
                        </div>
                      ))
                    }
                    {receiptTemplates.length === 0 && (
                      <p className="px-3 py-6 text-center text-xs text-gray-400">No templates yet. Save a receipt as a template to reuse it.</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Patient Search */}
            <div className="space-y-1.5 relative" ref={patientInputRef}>
              <Label htmlFor="searchPatient" className="text-xs font-bold uppercase text-slate-500">Patient</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <Input
                  id="searchPatient"
                  placeholder="Type patient name to search..."
                  value={searchPatient}
                  onChange={(e) => void handlePatientSearchChange(e)}
                  className="rounded-xl border-slate-200 pl-10 pr-8"
                  autoComplete="off"
                />
                {selectedPatient && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPatient(null);
                      setSearchPatient('');
                      setAdmissions([]);
                      setSelectedAdmissionId('');
                      setLineItems([]);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>

              {showSuggestions && (
                <div className="absolute z-50 left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl">
                  {patientSuggestionsLoading ? (
                    <div className="p-3 text-sm text-slate-400 flex items-center justify-center">
                      <Loader2 size={14} className="mr-1.5 animate-spin" />
                      Searching patients...
                    </div>
                  ) : patientSuggestions.length === 0 ? (
                    <div className="p-3 text-sm text-slate-400 text-center">
                      No patients found. Verify name or phone.
                    </div>
                  ) : (
                    patientSuggestions.map((p) => (
                      <button
                        key={p._id}
                        type="button"
                        onClick={() => handleSelectPatient(p)}
                        className="flex flex-col w-full text-left px-4 py-2 hover:bg-slate-50 border-b border-slate-100 last:border-b-0"
                      >
                        <span className="font-semibold text-slate-900 text-sm">{p.firstName} {p.lastName}</span>
                        <span className="text-xs text-slate-400">Phone: {p.phone || 'No phone'} | Age: {p.age || 'N/A'}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Doctor Select */}
            <div className="space-y-1.5">
              <Label htmlFor="doctorSelect" className="text-xs font-bold uppercase text-slate-500">Consulting Doctor</Label>
              {user?.role === 'Doctor' ? (
                <Input
                  id="doctorSelect"
                  value={selectedDoctor ? `Dr. ${selectedDoctor.firstName} ${selectedDoctor.lastName}` : 'Resolving doctor...'}
                  disabled
                  className="rounded-xl border-slate-200 bg-slate-50/70"
                />
              ) : (
                <Select value={selectedDoctorId} onValueChange={(val) => setSelectedDoctorId(val || '')}>
                  <SelectTrigger className="rounded-xl border-slate-200">
                    <SelectValue placeholder="Select Doctor" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {doctorsList.map((d) => (
                      <SelectItem key={d._id} value={d._id} className="rounded-lg">
                        Dr. {d.firstName} {d.lastName} ({d.specialization || 'Consultant'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Associate Admission (Optional) */}
            {selectedPatient && admissions.length > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="admissionSelect" className="text-xs font-bold uppercase text-slate-500">
                  Link to Admission Stay (Optional)
                </Label>
                <Select value={selectedAdmissionId} onValueChange={(val) => {
                  setSelectedAdmissionId(val || '');
                  setLineItems([]); // Clear line items when toggling admissions
                }}>
                  <SelectTrigger className="rounded-xl border-slate-200">
                    <SelectValue placeholder="Not linked to stay" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="">Not linked to stay</SelectItem>
                    {admissions.map((adm: any) => (
                      <SelectItem key={adm._id} value={adm._id} className="rounded-lg">
                        {adm.admissionId} - {adm.department} ({new Date(adm.admissionDate).toLocaleDateString()})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Receipt Items Preview Table */}
            <div className="rounded-xl border border-slate-150 bg-slate-50/50 p-3.5 space-y-2">
              <div className="flex justify-between items-center text-xs font-bold text-slate-500 pb-1.5 border-b border-slate-150">
                <span>Description</span>
                <span className="w-16 text-right">Rate (INR)</span>
              </div>
              <div className="max-h-40 overflow-y-auto space-y-2 pt-1.5">
                {lineItems.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-2">No charges added yet</p>
                ) : (
                  lineItems.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center text-sm font-semibold text-slate-900">
                      <span>{item.description}</span>
                      <div className="flex items-center gap-1.5">
                        {item.description === 'Consultation Fee' && isUserAdmin ? (
                          <Input
                            type="number"
                            value={item.amount}
                            onChange={(e) => {
                              const fee = Number(e.target.value) || 0;
                              setLineItems(current => 
                                current.map((li, i) => i === idx ? { ...li, amount: fee } : li)
                              );
                            }}
                            className="w-20 h-7 text-right rounded-lg text-xs"
                          />
                        ) : (
                          <span>₹{item.amount.toFixed(2)}</span>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-6 w-6 p-0 text-red-500 hover:text-red-750 hover:bg-red-50 rounded-md"
                          onClick={() => handleRemoveLineItem(idx)}
                        >
                          <Trash2 size={12} />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Custom Line Items Builder (Other Charges) */}
            <div className="rounded-xl border border-slate-150 bg-slate-50/50 p-3.5 space-y-3">
              <p className="text-xs font-bold uppercase text-slate-500">Add Other Charges</p>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. Registration, Pharmacy, Lab"
                  id="newItemDesc"
                  className="flex-1 rounded-lg h-9 text-xs"
                />
                <Input
                  type="number"
                  placeholder="Rate"
                  id="newItemAmount"
                  className="w-20 rounded-lg h-9 text-xs text-right"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-lg h-9 px-2.5 text-xs bg-slate-900 text-white hover:bg-slate-800"
                  onClick={() => {
                    const descInput = document.getElementById('newItemDesc') as HTMLInputElement;
                    const amountInput = document.getElementById('newItemAmount') as HTMLInputElement;
                    const desc = descInput?.value?.trim();
                    const rate = parseFloat(amountInput?.value);
                    if (!desc) {
                      toast.error('Item description is required');
                      return;
                    }
                    if (isNaN(rate) || rate <= 0) {
                      toast.error('Please enter a valid rate');
                      return;
                    }
                    handleAddLineItem(desc, rate);
                    if (descInput) descInput.value = '';
                    if (amountInput) amountInput.value = '';
                  }}
                >
                  Add
                </Button>
              </div>
            </div>

            {/* Pricing Adjustments */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label htmlFor="discount" className="text-[10px] font-bold uppercase text-slate-500">Discount (%)</Label>
                <Input
                  id="discount"
                  type="number"
                  min="0"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  className="rounded-xl border-slate-200 h-9"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="tax" className="text-[10px] font-bold uppercase text-slate-500">Tax/GST (%)</Label>
                <Input
                  id="tax"
                  type="number"
                  min="0"
                  value={tax}
                  onChange={(e) => setTax(e.target.value)}
                  className="rounded-xl border-slate-200 h-9"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="paidAmount" className="text-[10px] font-bold uppercase text-slate-500">Paid Amt</Label>
                <Input
                  id="paidAmount"
                  type="number"
                  min="0"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                  className="rounded-xl border-slate-200 h-9"
                />
              </div>
            </div>

            {/* Calculations Breakdown */}
            <div className="rounded-2xl bg-slate-900 text-white p-4 space-y-2 mt-4">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Subtotal (Incl. GST)</span>
                <span>₹{subtotal.toFixed(2)}</span>
              </div>
              {Number(discount) > 0 && (
                <div className="flex justify-between text-xs text-red-400">
                  <span>Discount ({discount}%)</span>
                  <span>- ₹{discountAmount.toFixed(2)}</span>
                </div>
              )}
              {Number(tax) > 0 && (
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Incl. Tax/GST ({tax}%)</span>
                  <span>₹{taxAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-semibold border-t border-slate-800 pt-2 text-slate-100">
                <span>Final Amount</span>
                <span>₹{finalAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-400">
                <span>Paid Amount</span>
                <span>₹{(Number(paidAmount) || 0).toFixed(2)}</span>
              </div>
              <div className={`flex justify-between text-sm font-bold border-t border-slate-800 pt-2 ${dueAmount > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                <span>Due Amount</span>
                <span>₹{dueAmount.toFixed(2)}</span>
              </div>
            </div>

            <DialogFooter className="mt-4 flex flex-wrap gap-2 sm:justify-end">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsOpen(false)}
                className="rounded-xl"
              >
                Cancel
              </Button>
              <button
                type="button"
                onClick={() => setShowSaveTemplateModal(true)}
                className="flex items-center gap-1.5 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-xs font-medium text-green-700 hover:bg-green-100 transition-colors"
              >
                💾 Save as Template
              </button>
              <Button
                type="submit"
                disabled={saving || !selectedPatient || !selectedDoctorId}
                className="rounded-xl bg-primary text-white hover:bg-primary/90"
              >
                {saving && <Loader2 size={16} className="mr-2 animate-spin" />}
                Generate &amp; Print
              </Button>
            </DialogFooter>

          </form>
        </DialogContent>
      </Dialog>

      {/* Save Receipt Template Modal */}
      {showSaveTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl mx-4">
            <h3 className="text-base font-semibold text-gray-900 mb-1">Save as Receipt Template</h3>
            <p className="text-xs text-gray-500 mb-4">
              This saves ₹{subtotal.toFixed(2)} as a reusable template for quick receipt generation.
            </p>
            <input
              type="text"
              placeholder="Template name (e.g. OPD Consultation, Follow-up)"
              value={newTemplateName}
              onChange={e => setNewTemplateName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && void handleSaveReceiptTemplate()}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-blue-400 focus:bg-white mb-4"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setShowSaveTemplateModal(false); setNewTemplateName(''); }}
                className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleSaveReceiptTemplate()}
                disabled={savingTemplate || !newTemplateName.trim()}
                className="rounded-xl bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
              >
                {savingTemplate ? 'Saving...' : 'Save Template'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    <ConfirmDeleteDialog {...deleteTemplateDialogProps} />
    </>
  );
}
