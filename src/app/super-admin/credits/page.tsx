'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Search,
  Coins,
  Loader2,
  Settings,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import api from '@/lib/api';
import { toast } from 'sonner';

type PatientUser = {
  id: string;
  name: string;
  email: string;
  phone: string;
  reportCredits: number;
  prescriptionCredits: number;
  createdAt: string;
};

export default function UserCreditsPage() {
  const [users, setUsers] = useState<PatientUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // Bulk adjustment state
  const [creditType, setCreditType] = useState<'report' | 'prescription'>('report');
  const [action, setAction] = useState<'add' | 'deduct' | 'reset'>('add');
  const [amount, setAmount] = useState<string>('');
  const [reason, setReason] = useState<string>('Admin adjustment');
  const [updating, setUpdating] = useState(false);

  // Welcome bonus state
  const [welcomeReportCredits, setWelcomeReportCredits] = useState<number>(10);
  const [welcomePrescriptionCredits, setWelcomePrescriptionCredits] = useState<number>(15);
  const [loadingWelcome, setLoadingWelcome] = useState(true);
  const [updatingWelcome, setUpdatingWelcome] = useState(false);

  // Fetch patient users
  const fetchPatients = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/users', {
        params: { role: 'Patient', limit: 200, search: search || undefined },
      });
      const data = res.data.data?.users || res.data.data || res.data;
      setUsers(Array.isArray(data) ? data : []);
      // Reset selections on new search/fetch
      setSelectedIds([]);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to fetch patients.');
    } finally {
      setLoading(false);
    }
  }, [search]);

  // Fetch welcome bonus settings
  const fetchWelcomeSettings = useCallback(async () => {
    try {
      setLoadingWelcome(true);
      const res = await api.get('/users/patients/credits/welcome-bonus');
      if (res.data?.success && res.data?.data) {
        setWelcomeReportCredits(res.data.data.reportCredits ?? 10);
        setWelcomePrescriptionCredits(res.data.data.prescriptionCredits ?? 15);
      }
    } catch (err: any) {
      console.error('Failed to fetch welcome bonus settings:', err);
    } finally {
      setLoadingWelcome(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void fetchPatients();
    }, 300); // debounce search
    return () => clearTimeout(timeoutId);
  }, [fetchPatients]);

  useEffect(() => {
    void fetchWelcomeSettings();
  }, [fetchWelcomeSettings]);

  // Handle select all / deselect all
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(users.map((u) => u.id));
    } else {
      setSelectedIds([]);
    }
  };

  // Handle individual selection toggle
  const handleToggleSelect = (userId: string) => {
    setSelectedIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  // Handle bulk credit update
  const handleBulkUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIds.length === 0) {
      toast.error('Please select at least one user.');
      return;
    }
    const finalAmount = action === 'reset' ? 0 : Number(amount);
    if (action !== 'reset' && (isNaN(finalAmount) || finalAmount <= 0)) {
      toast.error('Please enter a valid positive number for amount.');
      return;
    }
    if (!reason.trim()) {
      toast.error('Please enter a reason for audit log.');
      return;
    }

    try {
      setUpdating(true);
      const res = await api.post('/users/patients/credits/bulk-adjust', {
        userIds: selectedIds,
        creditType,
        action,
        amount: action === 'reset' ? undefined : finalAmount,
        reason: reason.trim(),
      });

      if (res.data?.success) {
        toast.success(res.data.message || 'Credits updated successfully.');
        setAmount('');
        // Refresh patient list to show updated credits
        void fetchPatients();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update credits.');
    } finally {
      setUpdating(false);
    }
  };

  // Handle welcome bonus update
  const handleUpdateWelcomeBonus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (welcomeReportCredits < 0 || welcomePrescriptionCredits < 0) {
      toast.error('Credits cannot be negative.');
      return;
    }

    try {
      setUpdatingWelcome(true);
      const res = await api.post('/users/patients/credits/welcome-bonus', {
        reportCredits: welcomeReportCredits,
        prescriptionCredits: welcomePrescriptionCredits,
      });
      if (res.data?.success) {
        toast.success(res.data.message || 'Welcome bonus updated successfully.');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update welcome bonus.');
    } finally {
      setUpdatingWelcome(false);
    }
  };

  return (
    <div className="flex-1 bg-gray-50/50 p-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Coins className="text-primary w-7 h-7" /> User Credits Management
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Bulk adjust patient credits and configure the system welcome bonus.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Welcome Bonus Settings & Bulk Actions */}
        <div className="lg:col-span-1 space-y-6">
          {/* Welcome Bonus Config */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-4">
              <Settings className="w-5 h-5 text-slate-500" /> Welcome Bonus Config
            </h3>
            {loadingWelcome ? (
              <div className="flex items-center justify-center py-6 text-slate-500">
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                <span>Loading settings...</span>
              </div>
            ) : (
              <form onSubmit={handleUpdateWelcomeBonus} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="welcome-report" className="text-xs font-semibold text-slate-600">
                    New Account Report Credits
                  </Label>
                  <Input
                    id="welcome-report"
                    type="number"
                    min="0"
                    value={welcomeReportCredits}
                    onChange={(e) => setWelcomeReportCredits(Math.max(0, parseInt(e.target.value) || 0))}
                    className="h-10 rounded-xl border-slate-200"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="welcome-presc" className="text-xs font-semibold text-slate-600">
                    New Account Prescription Credits
                  </Label>
                  <Input
                    id="welcome-presc"
                    type="number"
                    min="0"
                    value={welcomePrescriptionCredits}
                    onChange={(e) => setWelcomePrescriptionCredits(Math.max(0, parseInt(e.target.value) || 0))}
                    className="h-10 rounded-xl border-slate-200"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={updatingWelcome}
                  className="w-full h-10 rounded-xl bg-primary text-white hover:bg-primary/95 flex justify-center items-center gap-2"
                >
                  {updatingWelcome && <Loader2 className="w-4 h-4 animate-spin" />}
                  Save Welcome Bonus
                </Button>
              </form>
            )}
          </div>

          {/* Bulk Update Controls */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-2">
              Bulk Adjust Credits
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Apply a change to all selected users simultaneously ({selectedIds.length} currently selected).
            </p>
            <form onSubmit={handleBulkUpdate} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600">Credit Type</Label>
                <Select
                  value={creditType}
                  onValueChange={(val: any) => setCreditType(val)}
                >
                  <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-white">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="report">Report Credits</SelectItem>
                    <SelectItem value="prescription">Prescription Credits</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-600">Action</Label>
                <Select
                  value={action}
                  onValueChange={(val: any) => setAction(val)}
                >
                  <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-white">
                    <SelectValue placeholder="Select action" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="add">Add Credits</SelectItem>
                    <SelectItem value="deduct">Deduct Credits</SelectItem>
                    <SelectItem value="reset">Reset to Zero</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {action !== 'reset' && (
                <div className="space-y-1.5">
                  <Label htmlFor="adjust-amount" className="text-xs font-semibold text-slate-600">
                    Amount of Credits
                  </Label>
                  <Input
                    id="adjust-amount"
                    type="number"
                    min="1"
                    placeholder="Enter quantity"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="h-10 rounded-xl border-slate-200"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="adjust-reason" className="text-xs font-semibold text-slate-600">
                  Reason for Adjustment
                </Label>
                <Input
                  id="adjust-reason"
                  placeholder="e.g. Campaign bonus"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="h-10 rounded-xl border-slate-200"
                />
              </div>

              <Button
                type="submit"
                disabled={updating || selectedIds.length === 0}
                className="w-full h-10 rounded-xl bg-slate-900 text-white hover:bg-slate-800 disabled:bg-slate-100 disabled:text-slate-400 flex justify-center items-center gap-2"
              >
                {updating && <Loader2 className="w-4 h-4 animate-spin" />}
                Apply to Selected ({selectedIds.length})
              </Button>
            </form>
          </div>
        </div>

        {/* Right Column: User Selection List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
            {/* Search Bar */}
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row items-center gap-4">
              <div className="relative w-full">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search patients by name, email, or mobile..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 h-10 rounded-xl border-slate-200 bg-white"
                />
              </div>
              <div className="flex gap-2 shrink-0 w-full md:w-auto justify-end">
                <Button
                  onClick={() => handleSelectAll(true)}
                  variant="outline"
                  size="sm"
                  className="rounded-xl h-10 text-xs font-semibold px-3.5 border-slate-200"
                >
                  Select All
                </Button>
                <Button
                  onClick={() => handleSelectAll(false)}
                  variant="outline"
                  size="sm"
                  className="rounded-xl h-10 text-xs font-semibold px-3.5 border-slate-200 text-slate-600"
                >
                  Clear Selection
                </Button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/70 border-b border-slate-100">
                  <TableRow>
                    <TableHead className="w-12 text-center py-4 pl-4">
                      <input
                        type="checkbox"
                        checked={users.length > 0 && selectedIds.length === users.length}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary shrink-0 cursor-pointer"
                      />
                    </TableHead>
                    <TableHead className="text-xs font-bold text-slate-500 uppercase tracking-wider py-4">
                      Patient Details
                    </TableHead>
                    <TableHead className="text-xs font-bold text-slate-500 uppercase tracking-wider py-4 text-center">
                      Report Credits
                    </TableHead>
                    <TableHead className="text-xs font-bold text-slate-500 uppercase tracking-wider py-4 text-center">
                      Prescription Credits
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-64 text-center">
                        <div className="flex flex-col items-center justify-center text-slate-400">
                          <Loader2 className="w-8 h-8 animate-spin mb-2" />
                          <span className="text-sm">Loading users...</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-64 text-center">
                        <div className="flex flex-col items-center justify-center text-slate-400">
                          <span className="text-sm font-medium">No patient users found</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    users.map((user) => {
                      const isSelected = selectedIds.includes(user.id);
                      return (
                        <TableRow
                          key={user.id}
                          className={`border-b border-slate-50 hover:bg-slate-50/50 transition-colors ${
                            isSelected ? 'bg-primary/5' : ''
                          }`}
                        >
                          <TableCell className="text-center py-3 pl-4">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelect(user.id)}
                              className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary shrink-0 cursor-pointer"
                            />
                          </TableCell>
                          <TableCell className="py-3">
                            <div className="flex flex-col">
                              <span className="text-sm font-semibold text-slate-900">{user.name}</span>
                              <span className="text-xs text-slate-500">{user.email}</span>
                              <span className="text-xs text-slate-400">{user.phone}</span>
                            </div>
                          </TableCell>
                          <TableCell className="py-3 text-center">
                            <span className="inline-flex items-center gap-1 bg-teal-50 text-teal-700 text-xs font-semibold px-2.5 py-1 rounded-full border border-teal-100">
                              {user.reportCredits ?? 0}
                            </span>
                          </TableCell>
                          <TableCell className="py-3 text-center">
                            <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs font-semibold px-2.5 py-1 rounded-full border border-blue-100">
                              {user.prescriptionCredits ?? 0}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
            {/* Footer Summary info */}
            {!loading && users.length > 0 && (
              <div className="p-4 border-t border-slate-100 bg-slate-50/20 text-xs text-slate-500 flex justify-between items-center">
                <span>Showing {users.length} patient records.</span>
                <span className="font-semibold text-primary">{selectedIds.length} users selected.</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
