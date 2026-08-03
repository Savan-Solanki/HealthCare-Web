'use client';

import { useEffect, useState, useCallback } from 'react';
import { Clock, Trash2, ShieldAlert, Plus, Check, Loader2, CalendarDays as CalendarIcon, Pencil, X, Zap, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import getSocket from '@/lib/socket';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConfirmDeleteDialog, useConfirmDelete } from '@/components/ui/confirm-delete-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type DoctorSlotsManageDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  doctorId: string;
  doctorName: string;
  isDoctor?: boolean;
};

type WeeklyAvailability = {
  _id?: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
};

type SlotRecord = {
  _id: string;
  date: string;
  slotTime: string;
  status: 'Available' | 'Booked' | 'Completed' | 'Cancelled' | 'Blocked' | 'Doctor On Leave';
  isActive: boolean;
  appointmentId?: string | null;
};

type LeaveRecord = {
  _id: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  halfDayOption: string | null;
  reason: string | null;
  status: string;
};

type GenRowState = {
  date: string;
  interval: number;
  loading: boolean;
};

const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const INTERVAL_OPTIONS = [
  { label: '15 minutes', value: 15 },
  { label: '30 minutes', value: 30 },
  { label: '45 minutes', value: 45 },
  { label: '60 minutes (1 hour)', value: 60 },
];

/** Returns true if the slot time has already passed today */
const isSlotPast = (date: string, slotTime: string): boolean => {
  const today = new Date().toISOString().split('T')[0];
  if (date !== today) return false;
  const now = new Date();
  const [h, m] = slotTime.split(':').map(Number);
  const slotDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0);
  return slotDate <= now;
};

/** Get nearest upcoming date (YYYY-MM-DD) that falls on the given dayOfWeek */
const getNextDateForWeekday = (dayOfWeek: number): string => {
  const today = new Date();
  const diff = (dayOfWeek - today.getDay() + 7) % 7;
  const target = new Date(today);
  target.setDate(today.getDate() + diff);
  return target.toISOString().split('T')[0];
};

const getErrorMessage = (error: unknown, fallback: string) =>
  typeof error === 'object' && error !== null && 'response' in error
    ? (error as { response?: { data?: { message?: string } } }).response?.data?.message || fallback
    : fallback;

export default function DoctorSlotsManageDialog({
  isOpen,
  onClose,
  doctorId,
  doctorName,
  isDoctor = false,
}: DoctorSlotsManageDialogProps) {
  const [activeTab, setActiveTab] = useState('slots');

  // API paths
  const availPath = isDoctor ? '/doctor/availabilities' : `/hospital-admin/doctors/${doctorId}/availabilities`;
  const slotsPath = isDoctor ? '/doctor/slots' : '/hospital-admin/slots';
  const leavesPath = isDoctor ? '/doctor/leaves' : '/hospital-admin/leaves';
  const generatePath = isDoctor ? '/doctor/slots/generate-from-availability' : '/hospital-admin/slots/generate-from-availability';

  // Weekly Availability State
  const [weeklyHours, setWeeklyHours] = useState<WeeklyAvailability[]>([]);
  const [loadingAvail, setLoadingAvail] = useState(false);
  const [newDay, setNewDay] = useState('1');
  const [newStart, setNewStart] = useState('09:00');
  const [newEnd, setNewEnd] = useState('17:00');
  const [genState, setGenState] = useState<Record<number, GenRowState>>({});

  // Manual Slots State
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [slots, setSlots] = useState<SlotRecord[]>([]);
  const [isOnLeave, setIsOnLeave] = useState(false);
  const [leaveDetails, setLeaveDetails] = useState<any>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [newSlotTime, setNewSlotTime] = useState('10:00');
  const [creatingSlots, setCreatingSlots] = useState(false);
  const [realtimeRefreshed, setRealtimeRefreshed] = useState(false);

  // Leaves State
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [loadingLeaves, setLoadingLeaves] = useState(false);
  const [leaveType, setLeaveType] = useState('Single Day Leave');
  const [leaveStart, setLeaveStart] = useState(new Date().toISOString().split('T')[0]);
  const [leaveEnd, setLeaveEnd] = useState(new Date().toISOString().split('T')[0]);
  const [halfDayOption, setHalfDayOption] = useState<string>('First Half');
  const [leaveReason, setLeaveReason] = useState('');
  const [submittingLeave, setSubmittingLeave] = useState(false);

  // Template & Edit State
  const [templateTimes, setTemplateTimes] = useState<string[]>([]);
  const [applyingTemplate, setApplyingTemplate] = useState(false);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [editingSlotTime, setEditingSlotTime] = useState('');

  const templateKey = `doctor_slots_template_${doctorId || 'self'}`;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(templateKey);
      setTemplateTimes(stored ? JSON.parse(stored) : []);
    } catch { setTemplateTimes([]); }
  }, [templateKey]);

  // Load Weekly Availability
  const fetchWeeklyAvailability = useCallback(async () => {
    if (!doctorId && !isDoctor) return;
    setLoadingAvail(true);
    try {
      const response = await api.get(availPath);
      const avails: WeeklyAvailability[] = response.data?.data || [];
      setWeeklyHours(avails);
      // Init generator state for each availability entry
      setGenState((prev) => {
        const next = { ...prev };
        avails.forEach((a, idx) => {
          if (!next[idx]) {
            next[idx] = { date: getNextDateForWeekday(a.dayOfWeek), interval: 30, loading: false };
          }
        });
        return next;
      });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to fetch weekly hours.'));
    } finally {
      setLoadingAvail(false);
    }
  }, [doctorId, availPath, isDoctor]);

  // Load Slots for selectedDate
  const fetchSlots = useCallback(async () => {
    if ((!doctorId && !isDoctor) || !selectedDate) return;
    setLoadingSlots(true);
    try {
      const response = await api.get(slotsPath, {
        params: isDoctor ? { date: selectedDate } : { doctorId, date: selectedDate },
      });
      setSlots(response.data?.data?.slots || []);
      setIsOnLeave(response.data?.data?.isOnLeave || false);
      setLeaveDetails(response.data?.data?.leaveDetails || null);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load slots.'));
    } finally {
      setLoadingSlots(false);
    }
  }, [doctorId, selectedDate, slotsPath, isDoctor]);

  // Load Leaves
  const fetchLeaves = useCallback(async () => {
    if (!doctorId && !isDoctor) return;
    setLoadingLeaves(true);
    try {
      const response = await api.get(leavesPath, {
        params: isDoctor ? {} : { doctorId },
      });
      setLeaves(response.data?.data || []);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load leaves.'));
    } finally {
      setLoadingLeaves(false);
    }
  }, [doctorId, leavesPath, isDoctor]);

  // Trigger loads on Open/Tab Change/Date Change
  useEffect(() => {
    if (!isOpen) return;
    if (activeTab === 'availabilities') void fetchWeeklyAvailability();
    else if (activeTab === 'slots') void fetchSlots();
    else if (activeTab === 'leaves') void fetchLeaves();
  }, [isOpen, activeTab, selectedDate, fetchWeeklyAvailability, fetchSlots, fetchLeaves]);

  // ── Real-time Socket Listener ──────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen || activeTab !== 'slots') return;
    const socket = getSocket();
    if (!socket) return;

    const handleSlotsUpdated = (data: { doctorId: string; date: string }) => {
      if (data.date === selectedDate && (isDoctor || String(data.doctorId) === String(doctorId))) {
        void fetchSlots().then(() => {
          setRealtimeRefreshed(true);
          setTimeout(() => setRealtimeRefreshed(false), 2500);
        });
      }
    };

    socket.on('slots:updated', handleSlotsUpdated);
    return () => { socket.off('slots:updated', handleSlotsUpdated); };
  }, [isOpen, activeTab, selectedDate, doctorId, isDoctor, fetchSlots]);

  // Add weekly availability hour range
  const handleAddWeeklyHour = async () => {
    const dayNum = parseInt(newDay, 10);
    const updated = [
      ...weeklyHours,
      { dayOfWeek: dayNum, startTime: newStart, endTime: newEnd, isActive: true },
    ].sort((a, b) => a.dayOfWeek - b.dayOfWeek);

    try {
      await api.post(availPath, {
        doctorId: isDoctor ? undefined : doctorId,
        availabilities: updated,
      });
      toast.success('Weekly availability added successfully.');
      void fetchWeeklyAvailability();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to save weekly hours.'));
    }
  };

  // Delete weekly availability range
  const [deleteWeeklyHourIndex, setDeleteWeeklyHourIndex] = useState<number | null>(null);

  const { dialogProps: deleteWeeklyHourDialogProps, openConfirm: openDeleteWeeklyHourConfirm } = useConfirmDelete(async () => {
    if (deleteWeeklyHourIndex === null) return;
    const updated = weeklyHours.filter((_, i) => i !== deleteWeeklyHourIndex);
    try {
      await api.post(availPath, { doctorId: isDoctor ? undefined : doctorId, availabilities: updated });
      toast.success('Weekly availability removed.');
      void fetchWeeklyAvailability();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to save weekly hours.'));
    } finally {
      setDeleteWeeklyHourIndex(null);
    }
  });

  const handleDeleteWeeklyHour = (index: number) => {
    setDeleteWeeklyHourIndex(index);
    openDeleteWeeklyHourConfirm({ title: 'Remove Weekly Availability', description: 'Are you sure you want to remove this weekly availability slot? This action cannot be undone.' });
  };

  // Generate slots from a weekly availability row
  const handleGenerateSlotsFromAvailability = async (index: number) => {
    const gen = genState[index];
    if (!gen) return;
    setGenState((prev) => ({ ...prev, [index]: { ...gen, loading: true } }));
    try {
      const response = await api.post(generatePath, {
        doctorId: isDoctor ? undefined : doctorId,
        date: gen.date,
        intervalMinutes: gen.interval,
      });
      const summary = response.data?.summary;
      toast.success(`Generated for ${gen.date}: ${summary?.created ?? 0} new, ${summary?.reactivated ?? 0} reactivated, ${summary?.skipped ?? 0} unchanged.`);
      setSelectedDate(gen.date);
      setActiveTab('slots');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to generate slots.'));
    } finally {
      setGenState((prev) => ({ ...prev, [index]: { ...prev[index], loading: false } }));
    }
  };

  // Add Manual Slot
  const handleAddManualSlot = async () => {
    if (!newSlotTime) return;
    setCreatingSlots(true);
    try {
      await api.post(slotsPath, {
        doctorId: isDoctor ? undefined : doctorId,
        date: selectedDate,
        slotTimes: [newSlotTime],
      });
      toast.success('Manual slot added successfully.');
      void fetchSlots();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to create slot.'));
    } finally {
      setCreatingSlots(false);
    }
  };

  // Update Slot Status (Block/Unblock/Activate/Deactivate)
  const handleUpdateSlotStatus = async (slotId: string, status: string, isActive?: boolean) => {
    try {
      await api.put(`${slotsPath}/${slotId}`, {
        doctorId: isDoctor ? undefined : doctorId,
        status,
        isActive,
      });
      toast.success('Slot updated successfully.');
      void fetchSlots();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to update slot.'));
    }
  };

  // Delete Manual Slot
  const [deleteSlotId, setDeleteSlotId] = useState<string | null>(null);

  const { dialogProps: deleteSlotDialogProps, openConfirm: openDeleteSlotConfirm } = useConfirmDelete(async () => {
    if (!deleteSlotId) return;
    try {
      await api.delete(`${slotsPath}/${deleteSlotId}`, {
        params: isDoctor ? {} : { doctorId },
      });
      toast.success('Slot deleted successfully.');
      void fetchSlots();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to delete slot.'));
    } finally {
      setDeleteSlotId(null);
    }
  });

  const handleDeleteSlot = (slotId: string) => {
    setDeleteSlotId(slotId);
    openDeleteSlotConfirm({ title: 'Delete Slot', description: 'Are you sure you want to delete this time slot? This action cannot be undone.' });
  };

  // Save as Template
  const handleSaveAsTemplate = () => {
    if (slots.length === 0) {
      toast.error('No slots configured to save as template.');
      return;
    }
    const times = slots.map((s) => s.slotTime);
    localStorage.setItem(templateKey, JSON.stringify(times));
    setTemplateTimes(times);
    toast.success('Current slots saved as template!');
  };

  // Apply Template
  const handleApplyTemplate = async () => {
    if (templateTimes.length === 0) return;
    setApplyingTemplate(true);
    try {
      await api.post(slotsPath, {
        doctorId: isDoctor ? undefined : doctorId,
        date: selectedDate,
        slotTimes: templateTimes,
      });
      toast.success('Template applied successfully.');
      void fetchSlots();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to apply template.'));
    } finally {
      setApplyingTemplate(false);
    }
  };

  // Update Slot Time (Edit)
  const handleUpdateSlotTime = async (slotId: string, newTime: string) => {
    if (!newTime) return;
    try {
      await api.put(`${slotsPath}/${slotId}`, {
        doctorId: isDoctor ? undefined : doctorId,
        slotTime: newTime,
      });
      toast.success('Slot time updated successfully.');
      setEditingSlotId(null);
      void fetchSlots();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to update slot time.'));
    }
  };

  // Mark Doctor Leave
  const handleMarkLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingLeave(true);
    try {
      await api.post(leavesPath, {
        doctorId: isDoctor ? undefined : doctorId,
        leaveType,
        startDate: leaveStart,
        endDate: leaveEnd,
        halfDayOption: leaveType === 'Half-Day Leave' ? halfDayOption : null,
        reason: leaveReason.trim() || null,
      });
      toast.success('Leave marked successfully.');
      setLeaveReason('');
      void fetchLeaves();
      setActiveTab('slots'); // Switch back to see leave overlay
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to mark leave.'));
    } finally {
      setSubmittingLeave(false);
    }
  };

  // Cancel Leave
  const handleCancelLeave = async (leaveId: string) => {
    try {
      await api.delete(`${leavesPath}/${leaveId}`, {
        params: isDoctor ? {} : { doctorId },
      });
      toast.success('Leave cancelled successfully.');
      void fetchLeaves();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to cancel leave.'));
    }
  };

  const getStatusBadge = (status: SlotRecord['status'], date: string, slotTime: string) => {
    if (isSlotPast(date, slotTime) && status === 'Available') {
      return <Badge variant="outline" className="rounded-lg bg-slate-100 text-slate-400 border-slate-200 text-[10px]">Past</Badge>;
    }
    const styles: Record<SlotRecord['status'], string> = {
      Available: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      Booked: 'bg-blue-50 text-primary border-blue-200',
      Completed: 'bg-slate-50 text-slate-600 border-slate-200',
      Cancelled: 'bg-slate-100 text-slate-500 border-slate-200',
      Blocked: 'bg-red-50 text-red-700 border-red-200',
      'Doctor On Leave': 'bg-amber-50 text-amber-700 border-amber-200',
    };
    return (
      <Badge variant="outline" className={`rounded-lg ${styles[status]}`}>
        {status}
      </Badge>
    );
  };

  return (
    <>
    <Dialog open={isOpen} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-3xl sm:max-w-[800px] border-slate-200 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Clock className="text-teal-600 h-6 w-6" />
            Slots & Leave Settings
          </DialogTitle>
          <p className="text-sm text-slate-500 mt-0.5">
            Configure slots, weekly ranges, and mark leave for Dr. {doctorName}.
          </p>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid grid-cols-3 rounded-2xl bg-slate-100 p-1">
            <TabsTrigger value="slots" className="rounded-xl py-2 text-sm font-semibold">
              Manual Slots
            </TabsTrigger>
            <TabsTrigger value="availabilities" className="rounded-xl py-2 text-sm font-semibold">
              Weekly Ranges
            </TabsTrigger>
            <TabsTrigger value="leaves" className="rounded-xl py-2 text-sm font-semibold">
              Leaves
            </TabsTrigger>
          </TabsList>

          {/* 1. MANUAL SLOTS TAB */}
          <TabsContent value="slots" className="space-y-4 pt-2">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end justify-between border-b border-slate-100 pb-4">
              <div className="space-y-1.5 flex-1 max-w-[200px]">
                <Label className="text-slate-600 font-medium">Select Date</Label>
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="rounded-xl border-slate-200"
                />
              </div>

              <div className="flex flex-wrap items-end gap-2">
                {slots.length > 0 && (
                  <Button
                    variant="outline"
                    onClick={handleSaveAsTemplate}
                    type="button"
                    className="rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold"
                  >
                    Save as Template
                  </Button>
                )}
                {templateTimes.length > 0 && (
                  <Button
                    variant="outline"
                    onClick={handleApplyTemplate}
                    disabled={applyingTemplate || isOnLeave}
                    type="button"
                    className="rounded-xl border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100 font-semibold"
                  >
                    {applyingTemplate ? <Loader2 className="animate-spin h-4 w-4" /> : `Apply Template (${templateTimes.length})`}
                  </Button>
                )}

                <div className="space-y-1.5">
                  <Label className="text-slate-600 font-medium">New Slot Time</Label>
                  <Input
                    type="time"
                    value={newSlotTime}
                    onChange={(e) => setNewSlotTime(e.target.value)}
                    className="rounded-xl border-slate-200 w-[140px]"
                  />
                </div>
                <Button
                  onClick={handleAddManualSlot}
                  disabled={creatingSlots || isOnLeave}
                  className="rounded-xl bg-primary hover:bg-primary/90 text-white font-semibold"
                >
                  {creatingSlots ? <Loader2 className="animate-spin h-4 w-4" /> : <Plus size={16} className="mr-1.5" />}
                  Add Slot
                </Button>
              </div>
            </div>

            {isOnLeave && (
              <div className="flex items-start gap-3 rounded-2xl bg-amber-50 p-4 border border-amber-200 text-amber-900 text-sm">
                <ShieldAlert className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <p className="font-bold">Doctor is on Leave ({leaveDetails?.leaveType || 'Leave'})</p>
                  <p className="text-xs text-amber-700 mt-1">
                    All scheduling slots on this date are automatically marked as unavailable. Reason: {leaveDetails?.reason || 'Not specified'}.
                  </p>
                </div>
              </div>
            )}

            {realtimeRefreshed && (
              <div className="flex items-center gap-2 text-xs font-semibold text-teal-600 bg-teal-50 border border-teal-200 rounded-xl px-3 py-2">
                <RefreshCw size={12} className="animate-spin" />
                Slots refreshed in real-time
              </div>
            )}

            {loadingSlots ? (
              <div className="flex h-32 items-center justify-center text-sm font-medium text-slate-500">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading slots...
              </div>
            ) : slots.length === 0 ? (
              <div className="text-center py-8 bg-slate-50/70 border border-dashed border-slate-200 rounded-2xl text-slate-500 text-sm">
                <Clock className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                No slots configured for this date. Use the tool above to add manual slots.
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {slots.map((slot) => {
                  const isPast = isSlotPast(slot.date, slot.slotTime);
                  const isBooked = slot.status === 'Booked';
                  const isBlocked = slot.status === 'Blocked';
                  const isEditing = editingSlotId === slot._id;

                  return (
                    <div
                      key={slot._id}
                      className={`flex items-center justify-between border border-slate-200 rounded-2xl p-4 bg-white shadow-sm transition-opacity ${
                        isPast && slot.status === 'Available' ? 'opacity-50' : ''
                      }`}
                    >
                      {isEditing ? (
                        <div className="flex items-center gap-2 flex-1 mr-3">
                          <Input
                            type="time"
                            value={editingSlotTime}
                            onChange={(e) => setEditingSlotTime(e.target.value)}
                            className="rounded-xl border-slate-200 h-9 w-[120px]"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 rounded-lg p-0 text-emerald-600 border-emerald-200 bg-emerald-50 hover:bg-emerald-100"
                            onClick={() => handleUpdateSlotTime(slot._id, editingSlotTime)}
                          >
                            <Check size={14} />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 rounded-lg p-0 text-slate-500 hover:bg-slate-50"
                            onClick={() => setEditingSlotId(null)}
                          >
                            <X size={14} />
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <div className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                            <Clock size={14} className="text-slate-400" />
                            {slot.slotTime}
                          </div>
                          <div>{getStatusBadge(slot.status, slot.date, slot.slotTime)}</div>
                        </div>
                      )}

                      <div className="flex items-center gap-1.5">
                        {!isEditing && !isBooked && !isOnLeave && !isPast && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 rounded-lg px-2 text-xs font-semibold"
                              onClick={() => {
                                setEditingSlotId(slot._id);
                                setEditingSlotTime(slot.slotTime);
                              }}
                            >
                              <Pencil size={13} className="mr-1" />
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 rounded-lg px-2 text-xs font-semibold"
                              onClick={() => handleUpdateSlotStatus(slot._id, isBlocked ? 'Available' : 'Blocked')}
                            >
                              {isBlocked ? 'Unblock' : 'Block'}
                            </Button>
                          </>
                        )}
                        {!isEditing && !isBooked && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-lg px-2 text-xs font-semibold text-red-500 hover:text-red-600"
                            onClick={() => handleDeleteSlot(slot._id)}
                          >
                            <Trash2 size={13} />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* 2. WEEKLY RANGES TAB */}
          <TabsContent value="availabilities" className="space-y-4 pt-2">
            <div className="flex flex-wrap items-end gap-3 border-b border-slate-100 pb-4">
              <div className="space-y-1.5 flex-1 min-w-[140px]">
                <Label className="text-slate-600 font-medium">Day of Week</Label>
                <Select value={newDay} onValueChange={(val) => val && setNewDay(val)}>
                  <SelectTrigger className="rounded-xl border-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {weekdayNames.map((name, idx) => (
                      <SelectItem key={idx} value={String(idx)}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-slate-600 font-medium">Start Time</Label>
                <Input
                  type="time"
                  value={newStart}
                  onChange={(e) => setNewStart(e.target.value)}
                  className="rounded-xl border-slate-200 w-[120px]"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-slate-600 font-medium">End Time</Label>
                <Input
                  type="time"
                  value={newEnd}
                  onChange={(e) => setNewEnd(e.target.value)}
                  className="rounded-xl border-slate-200 w-[120px]"
                />
              </div>

              <Button
                onClick={handleAddWeeklyHour}
                className="rounded-xl bg-primary hover:bg-primary/90 text-white font-semibold"
              >
                Add Hours Range
              </Button>
            </div>

            {loadingAvail ? (
              <div className="flex h-32 items-center justify-center text-sm font-medium text-slate-500">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading weekly hours...
              </div>
            ) : weeklyHours.length === 0 ? (
              <div className="text-center py-8 bg-slate-50/70 border border-dashed border-slate-200 rounded-2xl text-slate-500 text-sm">
                <Clock className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                No general working ranges configured. Use the form above to add weekly hours.
              </div>
            ) : (
              <div className="space-y-3">
                {weeklyHours.map((avail, index) => {
                  const gen = genState[index] ?? { date: getNextDateForWeekday(avail.dayOfWeek), interval: 30, loading: false };
                  const startMins = parseInt(avail.startTime.split(':')[0]) * 60 + parseInt(avail.startTime.split(':')[1]);
                  const endMins = parseInt(avail.endTime.split(':')[0]) * 60 + parseInt(avail.endTime.split(':')[1]);
                  const slotCount = endMins > startMins ? Math.floor((endMins - startMins) / gen.interval) : 0;

                  return (
                    <div key={index} className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
                      {/* Header */}
                      <div className="flex items-center justify-between px-5 py-3.5 bg-slate-50 border-b border-slate-100">
                        <div>
                          <span className="font-bold text-slate-900 text-sm">{weekdayNames[avail.dayOfWeek]}</span>
                          <span className="ml-3 text-slate-500 text-xs font-medium">{avail.startTime} – {avail.endTime}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 rounded-lg text-red-500 hover:bg-red-50 hover:text-red-600"
                          onClick={() => handleDeleteWeeklyHour(index)}
                        >
                          <Trash2 size={13} />
                        </Button>
                      </div>

                      {/* Slot generator panel */}
                      <div className="px-5 py-4 bg-gradient-to-r from-teal-50/50 to-slate-50/10">
                        <p className="text-[11px] font-bold text-teal-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                          <Zap size={11} /> Auto-generate slots for a date
                        </p>
                        <div className="flex flex-wrap items-end gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs text-slate-500 font-medium">Date</Label>
                            <Input
                              type="date"
                              value={gen.date}
                              min={new Date().toISOString().split('T')[0]}
                              onChange={(e) =>
                                setGenState((prev) => ({ ...prev, [index]: { ...gen, date: e.target.value } }))
                              }
                              className="rounded-xl border-slate-200 h-9 text-sm w-[160px]"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-slate-500 font-medium">Slot Interval</Label>
                            <Select
                              value={String(gen.interval)}
                              onValueChange={(val) =>
                                val && setGenState((prev) => ({ ...prev, [index]: { ...gen, interval: parseInt(val, 10) } }))
                              }
                            >
                              <SelectTrigger className="rounded-xl border-slate-200 h-9 text-sm w-[185px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {INTERVAL_OPTIONS.map((opt) => (
                                  <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleGenerateSlotsFromAvailability(index)}
                            disabled={gen.loading || !gen.date}
                            className="h-9 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs px-4"
                          >
                            {gen.loading ? (
                              <Loader2 className="animate-spin h-3.5 w-3.5 mr-1.5" />
                            ) : (
                              <Zap size={13} className="mr-1.5" />
                            )}
                            Generate Slots
                          </Button>
                        </div>
                        {slotCount > 0 && (
                          <p className="mt-2 text-[11px] text-teal-600 font-medium">
                            → Will create up to <span className="font-bold">{slotCount} slots</span> ({avail.startTime}–{avail.endTime} at {gen.interval} min intervals)
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>


          {/* 3. LEAVES TAB */}
          <TabsContent value="leaves" className="space-y-4 pt-2">
            <form onSubmit={handleMarkLeave} className="grid gap-4 sm:grid-cols-2 border-b border-slate-100 pb-5">
              <div className="space-y-1.5">
                <Label className="text-slate-600 font-medium">Leave Type</Label>
                <Select value={leaveType} onValueChange={(val) => val && setLeaveType(val)}>
                  <SelectTrigger className="rounded-xl border-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Single Day Leave">Single Day Leave</SelectItem>
                    <SelectItem value="Multiple Day Leave">Multiple Day Leave</SelectItem>
                    <SelectItem value="Half-Day Leave">Half-Day Leave</SelectItem>
                    <SelectItem value="Emergency Leave">Emergency Leave</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {leaveType === 'Half-Day Leave' && (
                <div className="space-y-1.5">
                  <Label className="text-slate-600 font-medium">Half-Day Option</Label>
                  <Select value={halfDayOption} onValueChange={(val) => val && setHalfDayOption(val)}>
                    <SelectTrigger className="rounded-xl border-slate-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="First Half">First Half (AM)</SelectItem>
                      <SelectItem value="Second Half">Second Half (PM)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-slate-600 font-medium">Start Date</Label>
                <Input
                  type="date"
                  value={leaveStart}
                  onChange={(e) => setLeaveStart(e.target.value)}
                  className="rounded-xl border-slate-200"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-slate-600 font-medium">End Date</Label>
                <Input
                  type="date"
                  value={leaveEnd}
                  onChange={(e) => setLeaveEnd(e.target.value)}
                  className="rounded-xl border-slate-200"
                  required
                  disabled={leaveType === 'Single Day Leave' || leaveType === 'Half-Day Leave' || leaveType === 'Emergency Leave'}
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-slate-600 font-medium">Reason</Label>
                <Input
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                  placeholder="e.g. Conference, Medical reasons, Family event"
                  className="rounded-xl border-slate-200"
                />
              </div>

              <div className="sm:col-span-2 text-right">
                <Button
                  type="submit"
                  disabled={submittingLeave}
                  className="rounded-xl bg-primary hover:bg-primary/90 text-white font-semibold w-full sm:w-auto px-6"
                >
                  {submittingLeave ? <Loader2 className="animate-spin h-4 w-4 mr-1.5" /> : null}
                  Mark Doctor Leave
                </Button>
              </div>
            </form>

            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <CalendarIcon size={14} className="text-slate-400" />
              Active Leave Records
            </h3>

            {loadingLeaves ? (
              <div className="flex h-24 items-center justify-center text-sm font-medium text-slate-500">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading leaves...
              </div>
            ) : leaves.length === 0 ? (
              <div className="text-center py-6 bg-slate-50/70 border border-dashed border-slate-200 rounded-2xl text-slate-500 text-xs">
                No active leaves on record.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
                <table className="w-full text-left text-sm text-slate-700">
                  <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-5 py-3">Leave Type</th>
                      <th className="px-5 py-3">Dates</th>
                      <th className="px-5 py-3">Reason</th>
                      <th className="px-5 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {leaves.map((leave) => (
                      <tr key={leave._id}>
                        <td className="px-5 py-3.5">
                          <div className="font-bold text-slate-900">{leave.leaveType}</div>
                          {leave.halfDayOption && (
                            <div className="text-xs text-amber-600 font-semibold">{leave.halfDayOption}</div>
                          )}
                        </td>
                        <td className="px-5 py-3.5 font-medium text-xs">
                          {leave.startDate} {leave.startDate !== leave.endDate ? `to ${leave.endDate}` : ''}
                        </td>
                        <td className="px-5 py-3.5 text-xs text-slate-500">{leave.reason || '-'}</td>
                        <td className="px-5 py-3.5 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 rounded-lg text-red-500 hover:bg-red-50 hover:text-red-600"
                            onClick={() => handleCancelLeave(leave._id)}
                          >
                            Cancel Leave
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
    <ConfirmDeleteDialog {...deleteWeeklyHourDialogProps} />
    <ConfirmDeleteDialog {...deleteSlotDialogProps} />
    </>
  );
}
