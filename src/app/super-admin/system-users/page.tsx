'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Search,
  SlidersHorizontal,
  Edit2,
  Trash2,
  Plus,
  Loader2,
  ShieldCheck,
  Coins,
  Smartphone,
  Laptop,
  Tablet,
  ShieldAlert,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ConfirmDeleteDialog, useConfirmDelete } from '@/components/ui/confirm-delete-dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import { toast } from 'sonner';
import {
  SUPER_ADMIN_CACHE_EVENT,
  getSuperAdminCacheData,
  refreshSuperAdminCache,
  setSuperAdminCacheData,
} from '@/lib/super-admin-cache';
import { getSuperAdminPath } from '@/lib/routes';

type User = {
  id: string; // From backend: mapped from _id
  _id?: string;
  name: string;
  role: string;
  email: string;
  lastLogin: string | null;
  status: string;
  hospitalId?: {
    _id?: string;
    name?: string;
    city?: string;
    hospitalCode?: string;
    accessType?: 'demo' | 'permanent';
    demoExpiresAt?: string;
  } | string | null;
};

type HospitalOption = {
  id: string;
  name: string;
  city?: string;
  hospitalCode?: string;
  adminId?: { _id?: string; name?: string } | string | null;
};

type EditableUser = User & {
  password?: string;
  accessType?: 'permanent' | 'demo';
  demoDays?: string;
};
type UserFormState = {
  name: string;
  email: string;
  password: string;
  role: User['role'];
  status: User['status'];
  hospitalId: string;
  accessType: 'permanent' | 'demo';
  demoDays: string;
};
type UserPayload = {
  name: string;
  email: string;
  password?: string;
  role: string;
  status: string;
  hospitalId?: string;
  accessType?: 'permanent' | 'demo';
  demoDays?: number;
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error
  ) {
    return (error as { response?: { data?: { message?: string } } }).response?.data?.message || fallback;
  }

  return fallback;
};

const mapUsers = (users: User[]) =>
  users.map((u) => ({
    ...u,
    id: u.id || u._id || '',
    lastLogin: u.lastLogin ? new Date(u.lastLogin).toLocaleString() : 'Never',
  }));

const mapHospitals = (data: HospitalOption[]) =>
  data.map((hospital) => ({
    id: hospital.id,
    name: hospital.name,
    city: hospital.city,
    hospitalCode: hospital.hospitalCode,
    adminId: hospital.adminId || null,
  }));

const creatableAccountRoles = ['Hospital Admin', 'Receptionist'] as const;
const isCreatableAccountRole = (role?: string | null): role is (typeof creatableAccountRoles)[number] =>
  Boolean(role && creatableAccountRoles.includes(role as (typeof creatableAccountRoles)[number]));
const isPatientUser = (user: User) => user.role === 'Patient';
const isHospitalScopedAccountRole = (role?: string | null): boolean =>
  Boolean(role && (role === 'Hospital Admin' || role === 'Receptionist'));

export default function SystemUsersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialCachedUsers = getSuperAdminCacheData<User[]>('users');
  const initialCachedHospitals = getSuperAdminCacheData<(HospitalOption & { _id?: string })[]>('hospitals');
  const [userData, setUserData] = useState<User[]>(() => mapUsers(initialCachedUsers || []));
  const [loading, setLoading] = useState(() => !initialCachedUsers);
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [hospitalFilter, setHospitalFilter] = useState('all');

  const roles = useMemo(() => {
    const set = new Set<string>();
    userData.forEach((user) => {
      if (user.role) set.add(user.role);
    });
    return Array.from(set).sort();
  }, [userData]);

  const statuses = useMemo(() => {
    const set = new Set<string>();
    userData.forEach((user) => {
      if (user.status) set.add(user.status);
    });
    return Array.from(set).sort();
  }, [userData]);

  const userHospitals = useMemo(() => {
    const set = new Set<string>();
    userData.forEach((user) => {
      const hospitalName = typeof user.hospitalId === 'object' ? user.hospitalId?.name : null;
      if (hospitalName) set.add(hospitalName);
    });
    return Array.from(set).sort();
  }, [userData]);

  const resetFilters = () => {
    setRoleFilter('all');
    setStatusFilter('all');
    setHospitalFilter('all');
    setSearch('');
  };
  
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<User | null>(null);
  const [isPatientManageOpen, setIsPatientManageOpen] = useState(false);
  
  const [editingUser, setEditingUser] = useState<EditableUser | null>(null);
  const [newUser, setNewUser] = useState<UserFormState>({
    name: '',
    email: '',
    password: '',
    role: 'Hospital Admin',
    status: 'Active',
    hospitalId: '',
    accessType: 'permanent',
    demoDays: '14',
  });
  const [hospitals, setHospitals] = useState<HospitalOption[]>(() =>
    initialCachedHospitals
      ? mapHospitals(
          initialCachedHospitals.map((hospital) => ({
            id: hospital.id || hospital._id || '',
            name: hospital.name,
            city: hospital.city,
            hospitalCode: hospital.hospitalCode,
            adminId: hospital.adminId || null,
          }))
        )
      : []
  );
  const [isSaving, setIsSaving] = useState(false);

  const updateEditingUser = (updates: Partial<EditableUser>) => {
    setEditingUser((current) => (current ? { ...current, ...updates } : current));
  };

  useEffect(() => {
    const shouldOpenAdd = searchParams.get('openAdd') === '1';
    const role = searchParams.get('role');
    const hospitalId = searchParams.get('hospitalId') || '';
    const editUserId = searchParams.get('editUserId');
    const timeoutId = window.setTimeout(() => {
      if (shouldOpenAdd) {
        const requestedRole = isCreatableAccountRole(role) ? role : 'Hospital Admin';
        setNewUser((prev) => ({
          ...prev,
          role: requestedRole,
          hospitalId,
        }));
        setIsAddOpen(true);
        router.replace(getSuperAdminPath('/system-users'));
      }

      if (editUserId && userData.length > 0) {
        const matchedUser = userData.find((user) => user.id === editUserId || user._id === editUserId);
        if (matchedUser) {
          setEditingUser(matchedUser);
          setIsEditOpen(true);
        }
        router.replace(getSuperAdminPath('/system-users'));
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [router, searchParams, userData]);

  const fetchUsers = useCallback(async () => {
    try {
      const hasCache = !!getSuperAdminCacheData<User[]>('users');
      if (!hasCache) {
        setLoading(true);
      }
      const res = await api.get('/users', { params: { includePatients: true, limit: 100 } });
      const users = res.data.data?.users || res.data.data || res.data;
      const formatted = mapUsers(Array.isArray(users) ? users : []);
      setSuperAdminCacheData('users', Array.isArray(users) ? users : []);
      setUserData(formatted);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Failed to fetch users'));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchHospitals = useCallback(async () => {
    try {
      const res = await api.get('/hospitals');
      const raw = res.data.data?.hospitals || res.data.data || res.data;
      const data = Array.isArray(raw) ? raw : [];
      const mappedHospitals = data.map((hospital: HospitalOption & { _id?: string }) => ({
        id: hospital.id || hospital._id || '',
        name: hospital.name,
        city: hospital.city,
        hospitalCode: hospital.hospitalCode,
        adminId: hospital.adminId || null,
      }));
      setSuperAdminCacheData('hospitals', data);
      setHospitals(mapHospitals(mappedHospitals));
    } catch {
      // Keep user management usable even if hospital options fail to load.
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchUsers();
      void fetchHospitals();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fetchHospitals, fetchUsers]);

  useEffect(() => {
    const handleCacheUpdate = () => {
      const cachedUsers = getSuperAdminCacheData<User[]>('users');
      const cachedHospitals = getSuperAdminCacheData<(HospitalOption & { _id?: string })[]>('hospitals');

      if (cachedUsers) {
        setUserData(mapUsers(cachedUsers));
        setLoading(false);
      }

      if (cachedHospitals) {
        setHospitals(
          mapHospitals(
            cachedHospitals.map((hospital) => ({
              id: hospital.id || hospital._id || '',
              name: hospital.name,
              city: hospital.city,
              hospitalCode: hospital.hospitalCode,
              adminId: hospital.adminId || null,
            }))
          )
        );
      }
    };

    window.addEventListener(SUPER_ADMIN_CACHE_EVENT, handleCacheUpdate);
    return () => window.removeEventListener(SUPER_ADMIN_CACHE_EVENT, handleCacheUpdate);
  }, []);

  const availableHospitalsForCreate =
    newUser.role === 'Hospital Admin'
      ? hospitals.filter((hospital) => !hospital.adminId)
      : hospitals;

  const availableHospitalsForEdit = hospitals.filter((hospital) => {
    if (!editingUser) return true;
    if (editingUser.role !== 'Hospital Admin') return true;
    const currentHospitalId =
      typeof editingUser.hospitalId === 'object'
        ? editingUser.hospitalId?._id
        : editingUser.hospitalId;
    const hospitalAdminId =
      typeof hospital.adminId === 'object' ? hospital.adminId?._id : hospital.adminId;
    return !hospitalAdminId || hospital.id === currentHospitalId;
  });

  const handleToggleUserStatus = async (userId: string) => {
    try {
      await api.patch(`/users/${userId}/toggle-status`);
      setUserData(prev => prev.map(u =>
        u.id === userId
          ? { ...u, status: u.status === 'Active' ? 'Inactive' : 'Active' }
          : u
      ));
      await refreshSuperAdminCache(['users', 'dashboardOverview']);
      toast.success('Status updated successfully');
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Failed to update status'));
    }
  };

  const handleCreateUser = async () => {
    try {
      setIsSaving(true);
      if (isHospitalScopedAccountRole(newUser.role) && !newUser.hospitalId) {
        toast.error('Select a hospital before creating this account.');
        return;
      }
      const payload: UserPayload = {
        name: newUser.name,
        email: newUser.email,
        password: newUser.password,
        role: newUser.role,
        status: newUser.status,
        hospitalId: newUser.hospitalId || undefined,
      };
      if (newUser.role === 'Hospital Admin') {
        payload.accessType = newUser.accessType;
        if (newUser.accessType === 'demo') {
          payload.demoDays = Number(newUser.demoDays);
        }
      }
      await api.post('/users', payload);
      toast.success('User created successfully');
      setIsAddOpen(false);
      setNewUser({
        name: '',
        email: '',
        password: '',
        role: 'Hospital Admin',
        status: 'Active',
        hospitalId: '',
        accessType: 'permanent',
        demoDays: '14',
      });
      await refreshSuperAdminCache(['users', 'hospitals', 'dashboardOverview']);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Failed to create user'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveUser = async () => {
    if (editingUser) {
      try {
        setIsSaving(true);
        const { id, _id, name, email, role, status, hospitalId } = editingUser;
        // Don't send password if empty (it's optional in update)
        const updateData: UserPayload = {
          name,
          email,
          role,
          status,
          hospitalId: typeof hospitalId === 'object' ? hospitalId?._id : hospitalId || undefined,
        };
        if (editingUser.password) {
          updateData.password = editingUser.password;
        }
        if (role === 'Hospital Admin') {
          updateData.accessType = editingUser.accessType || 'permanent';
          if (updateData.accessType === 'demo') {
            updateData.demoDays = Number(editingUser.demoDays || '14');
          }
        }
        await api.put(`/users/${id || _id}`, updateData);
        toast.success('User updated successfully');
        setIsEditOpen(false);
        setEditingUser(null);
        await refreshSuperAdminCache(['users', 'hospitals', 'dashboardOverview']);
      } catch (error: unknown) {
        toast.error(getErrorMessage(error, 'Failed to update user'));
      } finally {
        setIsSaving(false);
      }
    }
  };

  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);

  const { dialogProps: deleteUserDialogProps, openConfirm: openDeleteUserConfirm } = useConfirmDelete(async () => {
    if (!deleteUserId) return;
    try {
      await api.delete(`/users/${deleteUserId}`);
      toast.success('User deleted successfully');
      setUserData(prev => prev.filter(u => u.id !== deleteUserId));
      await refreshSuperAdminCache(['users', 'hospitals', 'dashboardOverview']);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Failed to delete user'));
    } finally {
      setDeleteUserId(null);
    }
  });

  const handleDeleteUser = (userId: string) => {
    setDeleteUserId(userId);
    openDeleteUserConfirm({ title: 'Delete User', description: 'Are you sure you want to delete this user? This action cannot be undone.' });
  };

  const filteredUsers = userData.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.role.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());

    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || u.status === statusFilter;

    const matchesHospital =
      hospitalFilter === 'all' ||
      (typeof u.hospitalId === 'object' && u.hospitalId?.name === hospitalFilter);

    return matchesSearch && matchesRole && matchesStatus && matchesHospital;
  });

  return (
    <>
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <nav className="flex text-xs text-muted-foreground gap-1 items-center">
        <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
        <span>/</span>
        <Link href={getSuperAdminPath()} className="hover:text-foreground transition-colors">Super Admin</Link>
        <span>/</span>
        <span className="text-foreground font-medium">System Users</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">System Users</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage staff accounts and registered patient users across healthcare.
          </p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 h-10 px-5 bg-primary hover:bg-primary/90 text-white rounded-lg shadow-sm">
              <Plus size={16} />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[450px] rounded-2xl p-6 max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">Add New User</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Create hospital admin or receptionist accounts for a hospital. Receptionists use the receptionist portal only.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-5 py-6">
              <div className="space-y-2">
                <Label htmlFor="new-name" className="text-sm font-medium">Full Name</Label>
                <Input
                  id="new-name"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  className="h-11 rounded-xl border-gray-200 bg-gray-50/30"
                  placeholder="John Doe"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-email" className="text-sm font-medium">Email Address</Label>
                <Input
                  id="new-email"
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="h-11 rounded-xl border-gray-200 bg-gray-50/30"
                  placeholder="john@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password" className="text-sm font-medium">Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="h-11 rounded-xl border-gray-200 bg-gray-50/30"
                  placeholder="SecurePass@123"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Access Role</Label>
                <Select
                  value={newUser.role}
                  onValueChange={(val) =>
                    setNewUser((current) => ({
                      ...current,
                      role: (val || 'Hospital Admin') as User['role'],
                      hospitalId: isHospitalScopedAccountRole(val) ? current.hospitalId : '',
                    }))
                  }
                >
                  <SelectTrigger className="h-11 rounded-xl border-gray-200 bg-gray-50/30">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Hospital Admin">Hospital Admin</SelectItem>
                    <SelectItem value="Receptionist">Receptionist</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {isHospitalScopedAccountRole(newUser.role) && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Hospital</Label>
                  <Select
                    value={newUser.hospitalId}
                    onValueChange={(val) =>
                      setNewUser((current) => ({ ...current, hospitalId: val || '' }))
                    }
                  >
                    <SelectTrigger className="h-11 rounded-xl border-gray-200 bg-gray-50/30">
                      <SelectValue placeholder="Select hospital" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableHospitalsForCreate.map((hospital) => (
                        <SelectItem key={hospital.id} value={hospital.id}>
                          {hospital.name} {hospital.hospitalCode ? `(${hospital.hospitalCode})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {newUser.role === 'Hospital Admin' && availableHospitalsForCreate.length === 0 ? (
                    <p className="text-xs text-muted-foreground">All hospitals already have an admin assigned. Update the existing admin instead.</p>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    Admin and receptionist accounts cannot self-register. Create the account here and share the login credentials manually.
                  </p>
                </div>
              )}
              {newUser.role === 'Hospital Admin' && newUser.hospitalId ? (
                <div className="space-y-4 rounded-xl border border-border bg-muted/20 p-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Hospital access type</Label>
                    <Select
                      value={newUser.accessType}
                      onValueChange={(value) =>
                        setNewUser((current) => ({ ...current, accessType: value || 'permanent' }))
                      }
                    >
                      <SelectTrigger className="h-11 rounded-xl border-gray-200 bg-gray-50/30">
                        <SelectValue placeholder="Select access type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="permanent">Permanent access</SelectItem>
                        <SelectItem value="demo">Demo access</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {newUser.accessType === 'demo' ? (
                    <div className="space-y-2">
                      <Label htmlFor="demo-days" className="text-sm font-medium">Demo duration (days)</Label>
                      <Input
                        id="demo-days"
                        type="number"
                        min={1}
                        max={365}
                        value={newUser.demoDays}
                        onChange={(event) => setNewUser((current) => ({ ...current, demoDays: event.target.value }))}
                        className="h-11 rounded-xl border-gray-200 bg-gray-50/30"
                      />
                      <p className="text-xs text-muted-foreground">
                        Super admins receive an email alert 3 days before demo expiry. When demo ends, the entire hospital portal is suspended until you reactivate it.
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
            <DialogFooter className="gap-3">
              <Button variant="outline" className="rounded-xl px-6 h-11 border-gray-200" onClick={() => setIsAddOpen(false)} disabled={isSaving}>
                Cancel
              </Button>
              <Button className="bg-primary hover:bg-primary/90 text-white rounded-xl px-8 h-11 shadow-sm" onClick={handleCreateUser} disabled={isSaving}>
                {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Create User
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Main Table Card */}
      <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
        {/* Controls */}
        <div className="p-5 flex items-center justify-between border-b border-border">
          <div className="relative w-80">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              size={16}
            />
            <Input
              placeholder="Search by name, role or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-11 bg-gray-50/50 border-gray-200 focus-visible:ring-primary/20 rounded-lg"
            />
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className={cn(
                'gap-2 h-11 px-5 border-gray-200 rounded-lg font-medium',
                showFilters && 'bg-primary/5 text-primary border-primary/20 hover:bg-primary/10'
              )}
              onClick={() => setShowFilters((prev) => !prev)}
            >
              <SlidersHorizontal size={16} />
              {showFilters ? 'Hide Filters' : 'Filter'}
            </Button>
            {(roleFilter !== 'all' || statusFilter !== 'all' || hospitalFilter !== 'all' || search) && (
              <Button
                variant="ghost"
                className="h-11 px-3 text-muted-foreground text-sm font-medium hover:text-foreground"
                onClick={resetFilters}
              >
                Reset
              </Button>
            )}
          </div>
        </div>

        {showFilters && (
          <div className="p-6 border-b border-border bg-gray-50/30 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Role</Label>
              <Select
                value={roleFilter}
                onValueChange={(val) => setRoleFilter(val || 'all')}
              >
                <SelectTrigger className="h-11 bg-white border-gray-200 rounded-lg">
                  <SelectValue placeholder="All roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All roles</SelectItem>
                  {roles.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</Label>
              <Select
                value={statusFilter}
                onValueChange={(val) => setStatusFilter(val || 'all')}
              >
                <SelectTrigger className="h-11 bg-white border-gray-200 rounded-lg">
                  <SelectValue placeholder="All status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All status</SelectItem>
                  {statuses.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Hospital</Label>
              <Select
                value={hospitalFilter}
                onValueChange={(val) => setHospitalFilter(val || 'all')}
              >
                <SelectTrigger className="h-11 bg-white border-gray-200 rounded-lg">
                  <SelectValue placeholder="All hospitals" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All hospitals</SelectItem>
                  {userHospitals.map((hospital) => (
                    <SelectItem key={hospital} value={hospital}>
                      {hospital}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <Table>
          <TableHeader className="bg-gray-50/50">
            <TableRow className="hover:bg-transparent border-b border-border">
              <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground py-4 pl-6">Name</TableHead>
              <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground py-4">Role</TableHead>
              <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground py-4">Last Login</TableHead>
              <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground py-4 w-48">Status</TableHead>
              <TableHead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground py-4 text-right pr-6 w-32">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-48 text-center">
                  <div className="flex flex-col items-center justify-center text-muted-foreground">
                    <Loader2 className="w-8 h-8 animate-spin mb-2" />
                    <span>Loading users...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-48 text-center text-muted-foreground">
                  No users found.
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => (
                <TableRow key={user.id} className="border-b border-border last:border-0 hover:bg-gray-50/30 transition-colors h-20">
                  <TableCell className="pl-6">
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-foreground">{user.name}</span>
                      <span className="text-xs text-muted-foreground">{user.email}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn(
                        'rounded-lg font-medium px-2 py-0.5',
                        isPatientUser(user)
                          ? 'bg-teal-50 text-teal-700 border-teal-100'
                          : 'bg-blue-50 text-blue-700 border-blue-100'
                      )}
                    >
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{user.lastLogin}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-[100px] flex-shrink-0">
                        <Badge
                          variant="secondary"
                          className={cn(
                            'px-2.5 py-1 rounded-full text-[11px] font-medium border-0 gap-1.5 inline-flex items-center w-full justify-center',
                            user.status === 'Active' ? 'bg-green-50 text-green-700' :
                              user.status === 'On Leave' ? 'bg-orange-50 text-orange-700' : 'bg-gray-100 text-gray-700'
                          )}
                        >
                          <span className={cn(
                            'w-1.5 h-1.5 rounded-full shrink-0',
                            user.status === 'Active' ? 'bg-green-500' :
                              user.status === 'On Leave' ? 'bg-orange-500' : 'bg-gray-400'
                          )} />
                          {user.status}
                        </Badge>
                      </div>
                      {user.role === 'Super Admin' ? (
                        <span
                          title="Super Admin accounts cannot be deactivated"
                          className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary/70 bg-primary/5 border border-primary/10 rounded-full px-2 py-0.5 select-none"
                        >
                          <ShieldCheck size={10} />
                          Protected
                        </span>
                      ) : isPatientUser(user) ? (
                        <span className="text-[10px] font-medium text-muted-foreground">Mobile account</span>
                      ) : (
                        <Switch
                          checked={user.status === 'Active'}
                          onCheckedChange={() => handleToggleUserStatus(user.id)}
                        />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right pr-6">
                    <div className="flex items-center justify-end gap-2">
                      {isPatientUser(user) ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 rounded-xl text-teal-700 border-teal-200 hover:bg-teal-50 hover:text-teal-800 font-semibold"
                          onClick={() => {
                            setSelectedPatient(user);
                            setIsPatientManageOpen(true);
                          }}
                        >
                          Manage Patient
                        </Button>
                      ) : (
                      <>
                      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                        <DialogTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-9 w-9 text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-full" 
                            onClick={() => {
                              const hospital =
                                typeof user.hospitalId === 'object' ? user.hospitalId : null;
                              setEditingUser({
                                ...user,
                                accessType:
                                  hospital?.accessType === 'demo' ? 'demo' : 'permanent',
                                demoDays: '14',
                              });
                            }}
                          >
                            <Edit2 size={15} />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[450px] rounded-2xl p-6 text-left max-h-[85vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle className="text-xl font-bold">Edit User Information</DialogTitle>
                            <DialogDescription className="text-sm text-muted-foreground">
                              Update account details and access roles.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="grid gap-5 py-6 text-left">
                            <div className="space-y-2">
                                <Label htmlFor="edit-name" className="text-sm font-medium">Full Name</Label>
                              <Input
                                id="edit-name"
                                value={editingUser?.name || ''}
                                onChange={(e) => updateEditingUser({ name: e.target.value })}
                                className="h-11 rounded-xl border-gray-200 bg-gray-50/30"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="edit-email" className="text-sm font-medium">Email Address</Label>
                              <Input
                                id="edit-email"
                                type="email"
                                value={editingUser?.email || ''}
                                onChange={(e) => updateEditingUser({ email: e.target.value })}
                                className="h-11 rounded-xl border-gray-200 bg-gray-50/30"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="edit-password" className="text-sm font-medium">New Password (leave blank to keep current)</Label>
                              <Input
                                id="edit-password"
                                type="password"
                                value={editingUser?.password || ''}
                                onChange={(e) => updateEditingUser({ password: e.target.value })}
                                className="h-11 rounded-xl border-gray-200 bg-gray-50/30"
                                placeholder="********"
                              />
                            </div>
                            <div className="space-y-2 text-left">
                              <Label className="text-sm font-medium">Access Role</Label>
                              <Select
                                value={editingUser?.role || ''}
                                onValueChange={(val) =>
                                  updateEditingUser({
                                    role: (val || editingUser?.role || 'Hospital Admin') as User['role'],
                                    hospitalId:
                                      isHospitalScopedAccountRole(val)
                                        ? editingUser?.hospitalId ?? ''
                                        : '',
                                  })
                                }
                              >
                                <SelectTrigger className="h-11 rounded-xl border-gray-200 bg-gray-50/30">
                                  <SelectValue placeholder="Select a role" />
                                </SelectTrigger>
                                <SelectContent>
                                  {editingUser?.role && !isCreatableAccountRole(editingUser.role) ? (
                                    <SelectItem value={editingUser.role}>{editingUser.role}</SelectItem>
                                  ) : null}
                                  <SelectItem value="Hospital Admin">Hospital Admin</SelectItem>
                                  <SelectItem value="Receptionist">Receptionist</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            {isHospitalScopedAccountRole(editingUser?.role) && (
                              <div className="space-y-2 text-left">
                                <Label className="text-sm font-medium">Hospital</Label>
                                <Select
                                  value={
                                    typeof editingUser?.hospitalId === 'object'
                                      ? editingUser?.hospitalId?._id || ''
                                      : editingUser?.hospitalId || ''
                                  }
                                  onValueChange={(val) => updateEditingUser({ hospitalId: val })}
                                >
                                  <SelectTrigger className="h-11 rounded-xl border-gray-200 bg-gray-50/30">
                                    <SelectValue placeholder="Select hospital" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {availableHospitalsForEdit.map((hospital) => (
                                      <SelectItem key={hospital.id} value={hospital.id}>
                                        {hospital.name} {hospital.hospitalCode ? `(${hospital.hospitalCode})` : ''}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                            {editingUser?.role === 'Hospital Admin' && (
                              <>
                                <div className="space-y-2 text-left">
                                  <Label className="text-sm font-medium">Hospital access</Label>
                                  <Select
                                    value={editingUser.accessType || 'permanent'}
                                    onValueChange={(value) =>
                                      updateEditingUser({ accessType: (value as 'permanent' | 'demo') || 'permanent' })
                                    }
                                  >
                                    <SelectTrigger className="h-11 rounded-xl border-gray-200 bg-gray-50/30">
                                      <SelectValue placeholder="Select access type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="permanent">Permanent</SelectItem>
                                      <SelectItem value="demo">Demo (time-limited)</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                {editingUser.accessType === 'demo' ? (
                                  <div className="space-y-2 text-left">
                                    <Label htmlFor="edit-demo-days" className="text-sm font-medium">
                                      Demo duration (days)
                                    </Label>
                                    <Input
                                      id="edit-demo-days"
                                      type="number"
                                      min={1}
                                      max={365}
                                      value={editingUser.demoDays || '14'}
                                      onChange={(event) =>
                                        updateEditingUser({ demoDays: event.target.value })
                                      }
                                      className="h-11 rounded-xl border-gray-200 bg-gray-50/30"
                                    />
                                    {typeof editingUser.hospitalId === 'object' &&
                                    editingUser.hospitalId?.demoExpiresAt ? (
                                      <p className="text-xs text-muted-foreground">
                                        Current demo ends:{' '}
                                        {new Date(
                                          editingUser.hospitalId.demoExpiresAt
                                        ).toLocaleDateString()}
                                      </p>
                                    ) : null}
                                  </div>
                                ) : null}
                              </>
                            )}
                          </div>
                          <DialogFooter className="gap-3">
                            <Button variant="outline" className="rounded-xl px-6 h-11 border-gray-200" onClick={() => setIsEditOpen(false)} disabled={isSaving}>
                              Cancel
                            </Button>
                            <Button className="bg-primary hover:bg-primary/90 text-white rounded-xl px-8 h-11 shadow-sm" onClick={handleSaveUser} disabled={isSaving}>
                              {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                              Save changes
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                      {user.role !== 'Super Admin' && !isPatientUser(user) && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-9 w-9 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-full"
                          onClick={() => handleDeleteUser(user.id)}
                        >
                          <Trash2 size={15} />
                        </Button>
                      )}
                      </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Footer */}
        <div className="p-5 border-t border-border bg-gray-50/30 flex items-center justify-between">
          <p className="text-xs text-muted-foreground font-medium">
            Showing {filteredUsers.length} of {userData.length} users
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 rounded-lg border-gray-200 disabled:opacity-40" disabled>
              Previous
            </Button>
            <Button variant="outline" size="sm" className="h-8 rounded-lg border-gray-200 disabled:opacity-40" disabled>
              Next
            </Button>
          </div>
        </div>
      </div>
      <ManagePatientDialog
        isOpen={isPatientManageOpen}
        onClose={() => {
          setIsPatientManageOpen(false);
          setSelectedPatient(null);
        }}
        patient={selectedPatient}
      />
    </div>
    <ConfirmDeleteDialog {...deleteUserDialogProps} />
    </>
  );
}

// ─── Manage Patient Dialog Component ──────────────────────────────────────────
type ManagePatientDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  patient: User | null;
};

function ManagePatientDialog({ isOpen, onClose, patient }: ManagePatientDialogProps) {
  const [activeTab, setActiveTab] = useState<'credits' | 'sessions'>('credits');
  const [loading, setLoading] = useState(true);
  const [creditsData, setCreditsData] = useState<{
    reportCredits: number;
    prescriptionCredits: number;
    transactions: any[];
  } | null>(null);
  const [sessions, setSessions] = useState<any[]>([]);

  // Adjustment form state
  const [creditType, setCreditType] = useState<'report' | 'prescription'>('report');
  const [action, setAction] = useState<'add' | 'deduct' | 'reset'>('add');
  const [amount, setAmount] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [adjusting, setAdjusting] = useState(false);

  const loadData = useCallback(async () => {
    if (!patient?.id) return;
    setLoading(true);
    try {
      const [creditsRes, sessionsRes] = await Promise.all([
        api.get(`/users/patients/${patient.id}/credits`),
        api.get(`/users/patients/${patient.id}/sessions`),
      ]);
      setCreditsData(creditsRes.data.data);
      setSessions(sessionsRes.data.data || []);
    } catch {
      toast.error('Failed to load patient credentials & sessions.');
    } finally {
      setLoading(false);
    }
  }, [patient]);

  useEffect(() => {
    if (isOpen && patient?.id) {
      void loadData();
      setAmount('');
      setReason('');
      setAction('add');
      setCreditType('report');
      setActiveTab('credits');
    }
  }, [isOpen, patient, loadData]);

  const handleAdjustCredits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patient?.id) return;

    if (action !== 'reset' && (!amount || Number(amount) <= 0)) {
      toast.error('Please enter a positive amount.');
      return;
    }
    if (!reason.trim()) {
      toast.error('Please enter a reason for audit log.');
      return;
    }

    setAdjusting(true);
    try {
      await api.post(`/users/patients/${patient.id}/credits/adjust`, {
        creditType,
        action,
        amount: action === 'reset' ? undefined : Number(amount),
        reason: reason.trim(),
      });
      toast.success('Credits adjusted successfully.');
      setAmount('');
      setReason('');
      void loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to adjust credits.');
    } finally {
      setAdjusting(false);
    }
  };

  const handleTerminateSession = async (sessionId: string) => {
    if (!patient?.id) return;
    try {
      await api.delete(`/users/patients/${patient.id}/sessions/${sessionId}`);
      toast.success('Session terminated successfully.');
      void loadData();
    } catch {
      toast.error('Failed to terminate device session.');
    }
  };

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType?.toLowerCase()) {
      case 'mobile':
        return <Smartphone className="h-4 w-4 text-slate-500" />;
      case 'tablet':
        return <Tablet className="h-4 w-4 text-slate-500" />;
      default:
        return <Laptop className="h-4 w-4 text-slate-500" />;
    }
  };

  if (!isOpen || !patient) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] rounded-2xl p-6 text-left max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Coins className="h-5 w-5 text-teal-600" />
            Manage Patient: {patient.name}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Adjust available credits or terminate device sessions.
          </DialogDescription>
        </DialogHeader>

        {/* Tab Controls */}
        <div className="flex border-b border-gray-100 mt-4">
          <button
            type="button"
            onClick={() => setActiveTab('credits')}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'credits'
                ? 'border-teal-600 text-teal-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Credits Adjustment
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sessions')}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === 'sessions'
                ? 'border-teal-600 text-teal-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Active Sessions ({sessions.length})
          </button>
        </div>

        {loading ? (
          <div className="py-20 flex justify-center items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
            <span className="text-sm font-semibold text-slate-500">Loading details...</span>
          </div>
        ) : (
          <div className="py-4 space-y-6">
            {activeTab === 'credits' && (
              <>
                {/* Credit Summary Cards */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Report Credits</p>
                    <p className="mt-1 text-2xl font-extrabold text-slate-900">
                      {creditsData?.reportCredits ?? 0}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Prescription Credits</p>
                    <p className="mt-1 text-2xl font-extrabold text-slate-900">
                      {creditsData?.prescriptionCredits ?? 0}
                    </p>
                  </div>
                </div>

                {/* Adjustment Form */}
                <form onSubmit={handleAdjustCredits} className="rounded-2xl border border-slate-100 p-5 space-y-4">
                  <h4 className="text-sm font-bold text-slate-900">Adjust Credit Balance</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="adj-type" className="text-xs font-semibold text-slate-600">Credit Type</Label>
                      <Select
                        value={creditType}
                        onValueChange={(val: any) => setCreditType(val)}
                      >
                        <SelectTrigger id="adj-type" className="h-10 rounded-xl bg-gray-50/50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="report">Report Credit</SelectItem>
                          <SelectItem value="prescription">Prescription Credit</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="adj-action" className="text-xs font-semibold text-slate-600">Action</Label>
                      <Select
                        value={action}
                        onValueChange={(val: any) => {
                          setAction(val);
                          if (val === 'reset') setAmount('0');
                          else if (amount === '0') setAmount('');
                        }}
                      >
                        <SelectTrigger id="adj-action" className="h-10 rounded-xl bg-gray-50/50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="add">Add Credits</SelectItem>
                          <SelectItem value="deduct">Deduct Credits</SelectItem>
                          <SelectItem value="reset">Reset to 0</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {action !== 'reset' && (
                    <div className="space-y-1.5">
                      <Label htmlFor="adj-amount" className="text-xs font-semibold text-slate-600">Amount</Label>
                      <Input
                        id="adj-amount"
                        type="number"
                        min={1}
                        required
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="Number of credits"
                        className="h-10 rounded-xl bg-gray-50/50"
                      />
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label htmlFor="adj-reason" className="text-xs font-semibold text-slate-600">Reason / Notes</Label>
                    <Input
                      id="adj-reason"
                      type="text"
                      required
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="e.g. Compensation for failed upload"
                      className="h-10 rounded-xl bg-gray-50/50"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={adjusting}
                    className="w-full bg-teal-700 hover:bg-teal-800 text-white rounded-xl h-10 shadow-sm"
                  >
                    {adjusting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Confirm Credit Adjustment
                  </Button>
                </form>

                {/* Audit Ledger List */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Transaction History</h4>
                  {creditsData?.transactions && creditsData.transactions.length > 0 ? (
                    <div className="rounded-2xl border border-slate-100 overflow-hidden max-h-[200px] overflow-y-auto">
                      <Table>
                        <TableHeader className="bg-slate-50">
                          <TableRow>
                            <TableHead className="text-[10px] font-bold uppercase">Date</TableHead>
                            <TableHead className="text-[10px] font-bold uppercase">Credit</TableHead>
                            <TableHead className="text-[10px] font-bold uppercase">Type</TableHead>
                            <TableHead className="text-[10px] font-bold uppercase text-right">Reason</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {creditsData.transactions.map((tx) => (
                            <TableRow key={tx._id || tx.id} className="text-xs">
                              <TableCell className="py-2.5 font-medium text-slate-500">
                                {new Date(tx.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                              </TableCell>
                              <TableCell className="py-2.5 capitalize">{tx.creditType}</TableCell>
                              <TableCell className="py-2.5">
                                <Badge className={tx.type === 'addition' ? 'bg-green-50 text-green-700 font-bold border-0 text-[10px] py-0 px-2' : 'bg-red-50 text-red-700 font-bold border-0 text-[10px] py-0 px-2'}>
                                  {tx.type === 'addition' ? `+${tx.amount}` : `-${tx.amount}`}
                                </Badge>
                              </TableCell>
                              <TableCell className="py-2.5 text-right font-medium text-slate-700 max-w-[150px] truncate" title={tx.reason}>
                                {tx.reason}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-4">No transactions found for this account.</p>
                  )}
                </div>
              </>
            )}

            {activeTab === 'sessions' && (
              <div className="space-y-3">
                {sessions.length > 0 ? (
                  sessions.map((session) => (
                    <div
                      key={session._id || session.id}
                      className="flex items-start justify-between gap-4 p-4 border border-slate-100 rounded-2xl bg-white shadow-sm"
                    >
                      <div className="flex gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 shrink-0">
                          {getDeviceIcon(session.deviceType)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-900 truncate">
                            {session.deviceName || 'Unknown device'}
                          </p>
                          <p className="text-xs text-slate-500 truncate">
                            {session.browserVersion || 'Unknown browser'} • IP: {session.ipAddress || 'Unknown'}
                          </p>
                          <p className="mt-1 text-[10px] text-slate-400">
                            Last Active: {new Date(session.lastActive).toLocaleString()}
                          </p>
                        </div>
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleTerminateSession(session._id || session.id)}
                        className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl"
                      >
                        Terminate
                      </Button>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12">
                    <Smartphone className="h-10 w-10 mx-auto text-slate-300 mb-2" />
                    <p className="text-sm font-semibold text-slate-500">No active login sessions</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
