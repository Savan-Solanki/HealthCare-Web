'use client';

import { useEffect, useRef, useState } from 'react';
import { ImageUp, Loader2, Megaphone, Trash2, Clock, CheckCircle, AlertTriangle, Search } from 'lucide-react';
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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConfirmDeleteDialog, useConfirmDelete } from '@/components/ui/confirm-delete-dialog';

type PlatformAd = {
  id: string;
  title: string;
  businessLink: string;
  posterUrl: string | null;
  durationDays: number;
  startsAt: string;
  expiresAt: string;
  targetAudience: 'all' | 'patient' | 'staff';
};

export default function SuperAdminAdsPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [ads, setAds] = useState<PlatformAd[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    title: '',
    businessLink: '',
    durationDays: '7',
    targetAudience: 'all',
  });

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'active' | 'expired'
  const [audienceFilter, setAudienceFilter] = useState('all'); // 'all' | 'all-target' | 'patient' | 'staff'

  const loadAds = async () => {
    try {
      setLoading(true);
      const response = await api.get('/ads');
      setAds(response.data?.data || []);
    } catch (error) {
      toast.error('Failed to load advertisements.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAds();
  }, []);

  const handlePublish = async () => {
    if (!selectedFile) {
      toast.error('Upload an ad poster first.');
      return;
    }

    if (!form.businessLink.trim()) {
      toast.error('Business link is required.');
      return;
    }

    try {
      setPublishing(true);

      const sessionResponse = await api.post('/ads/upload-session', {
        contentType: selectedFile.type || 'image/jpeg',
        fileSize: selectedFile.size,
      });

      const uploadUrl = sessionResponse.data?.data?.uploadUrl;
      const uploadToken = sessionResponse.data?.data?.uploadToken;
      const contentType = sessionResponse.data?.data?.contentType || selectedFile.type;

      if (!uploadUrl || !uploadToken) {
        throw new Error('Unable to start poster upload.');
      }

      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        body: selectedFile,
      });

      if (!uploadResponse.ok) {
        throw new Error('Poster upload failed.');
      }

      await api.post('/ads', {
        title: form.title.trim(),
        businessLink: form.businessLink.trim(),
        durationDays: Number(form.durationDays),
        targetAudience: form.targetAudience,
        uploadToken,
      });

      toast.success('Advertisement published.');
      setSelectedFile(null);
      setForm({ title: '', businessLink: '', durationDays: '7', targetAudience: 'all' });
      await loadAds();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to publish advertisement.');
    } finally {
      setPublishing(false);
    }
  };

  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const { dialogProps: deleteDialogProps, openConfirm: openDeleteConfirm } = useConfirmDelete(async () => {
    if (!deleteTargetId) return;
    try {
      await api.delete(`/ads/${deleteTargetId}`);
      toast.success('Advertisement removed.');
      await loadAds();
    } catch {
      toast.error('Failed to remove advertisement.');
    } finally {
      setDeleteTargetId(null);
    }
  });

  const handleDelete = (id: string) => {
    setDeleteTargetId(id);
    openDeleteConfirm({ title: 'Remove Advertisement', description: 'Are you sure you want to remove this advertisement? This action cannot be undone.' });
  };

  // Filtering Logic
  const filteredAds = ads.filter((ad) => {
    // 1. Search Query
    const matchesSearch =
      !searchQuery ||
      ad.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ad.businessLink.toLowerCase().includes(searchQuery.toLowerCase());

    // 2. Target Audience
    const matchesAudience =
      audienceFilter === 'all' ||
      (audienceFilter === 'all-target' && ad.targetAudience === 'all') ||
      ad.targetAudience === audienceFilter;

    // 3. Status
    const isExpired = new Date(ad.expiresAt).getTime() <= Date.now();
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && !isExpired) ||
      (statusFilter === 'expired' && isExpired);

    return matchesSearch && matchesAudience && matchesStatus;
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Platform advertisements</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload promotional posters with a business link and duration. Expired ads are removed automatically.
        </p>
      </div>

      <Card className="border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Publish new ad</CardTitle>
          <CardDescription>
            Users see the poster after login. Close button dismisses it for the session; clicking the poster opens the business link.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 lg:grid-cols-[1fr_280px]">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="ad-title">Title (optional)</Label>
              <Input
                id="ad-title"
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="Summer wellness campaign"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="ad-link">Business link</Label>
              <Input
                id="ad-link"
                value={form.businessLink}
                onChange={(event) => setForm((current) => ({ ...current, businessLink: event.target.value }))}
                placeholder="https://partner.example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Duration (days)</Label>
              <Input
                type="number"
                min={1}
                max={365}
                value={form.durationDays}
                onChange={(event) => setForm((current) => ({ ...current, durationDays: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Audience</Label>
              <Select
                value={form.targetAudience}
                onValueChange={(value) => setForm((current) => ({ ...current, targetAudience: value as any || 'all' }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select audience" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All users</SelectItem>
                  <SelectItem value="patient">Patients only</SelectItem>
                  <SelectItem value="staff">Staff only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-dashed border-border p-4">
            <div className="flex h-40 items-center justify-center overflow-hidden rounded-xl bg-muted/40">
              {selectedFile ? (
                <img
                  src={URL.createObjectURL(selectedFile)}
                  alt="Ad poster preview"
                  className="h-full w-full object-cover"
                />
              ) : (
                <Megaphone className="h-10 w-10 text-muted-foreground" />
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
            />
            <Button type="button" variant="outline" className="w-full" onClick={() => fileInputRef.current?.click()}>
              <ImageUp className="mr-2 h-4 w-4" />
              {selectedFile ? 'Change poster' : 'Upload poster'}
            </Button>
            <Button type="button" className="w-full" disabled={publishing} onClick={() => void handlePublish()}>
              {publishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {publishing ? 'Publishing...' : 'Publish ad'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border shadow-sm">
        <CardHeader className="border-b border-border bg-gray-50/30 p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-lg">Active and scheduled ads</CardTitle>
          </div>

          {/* ---- Filter bar ---- */}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {/* Search input */}
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none size-4" />
              <Input
                placeholder="Search ads..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-sm border-gray-200"
              />
            </div>

            {/* Status filter */}
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v || 'all')}>
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>

            {/* Audience filter */}
            <Select value={audienceFilter} onValueChange={(v) => setAudienceFilter(v || 'all')}>
              <SelectTrigger className="w-[150px] h-9">
                <SelectValue placeholder="Audience" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Audiences</SelectItem>
                <SelectItem value="all-target">Target: All Users</SelectItem>
                <SelectItem value="patient">Target: Patients Only</SelectItem>
                <SelectItem value="staff">Target: Staff Only</SelectItem>
              </SelectContent>
            </Select>

            {(statusFilter !== 'all' || audienceFilter !== 'all' || searchQuery) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStatusFilter('all');
                  setAudienceFilter('all');
                  setSearchQuery('');
                }}
                className="h-9 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                Reset
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading advertisements...
            </div>
          ) : filteredAds.length === 0 ? (
            <p className="text-sm text-muted-foreground">No advertisements found matching the filters.</p>
          ) : (
            filteredAds.map((ad) => (
              <div key={ad.id} className="flex flex-col gap-4 rounded-2xl border border-border p-4 sm:flex-row sm:items-center">
                <div className="h-24 w-40 shrink-0 overflow-hidden rounded-xl bg-muted">
                  {ad.posterUrl ? (
                    <img
                      src={ad.posterUrl}
                      alt={ad.title || 'Advertisement'}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Megaphone className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-foreground">{ad.title || 'Untitled ad'}</p>
                    <Badge variant="secondary">{ad.targetAudience}</Badge>
                    <Badge variant="outline">{ad.durationDays} days</Badge>
                    {new Date(ad.expiresAt).getTime() > Date.now() ? (
                      <Badge className="bg-green-50 text-green-700 border border-green-200 hover:bg-green-50">
                        <CheckCircle className="mr-1 h-3 w-3" />
                        Active
                      </Badge>
                    ) : (
                      <Badge className="bg-red-50 text-red-700 border border-red-200 hover:bg-red-50">
                        <AlertTriangle className="mr-1 h-3 w-3" />
                        Expired
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 truncate text-sm text-muted-foreground">{ad.businessLink}</p>
                  <p className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Runs until {new Date(ad.expiresAt).toLocaleString()}
                  </p>
                </div>
                <Button type="button" variant="outline" className="text-red-600" onClick={() => handleDelete(ad.id)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Remove
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
      <ConfirmDeleteDialog {...deleteDialogProps} />
    </div>
  );
}
