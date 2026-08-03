'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Building2, ImageUp, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { uploadHospitalLogo } from '@/lib/media-upload';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

type HospitalRecord = {
  _id: string;
  name: string;
  city?: string | null;
  state?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  registrationNumber?: string | null;
  logoUrl?: string | null;
};

type AuthUser = {
  hospitalId?: { _id?: string; name?: string } | string | null;
};

const getHospitalId = (user: AuthUser | null) => {
  if (!user?.hospitalId) return '';
  return typeof user.hospitalId === 'object' ? String(user.hospitalId._id || '') : String(user.hospitalId);
};

export default function HospitalAdminSettingsPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [hospital, setHospital] = useState<HospitalRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        setLoading(true);
        const meResponse = await api.get('/auth/me');
        const nextUser = meResponse.data?.user || null;
        setUser(nextUser);

        const hospitalId = getHospitalId(nextUser);
        if (!hospitalId) {
          throw new Error('Hospital assignment not found for this account.');
        }

        const hospitalResponse = await api.get(`/hospitals/${hospitalId}`);
        setHospital(hospitalResponse.data?.data || null);
      } catch (error) {
        const message =
          typeof error === 'object' && error !== null && 'response' in error
            ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
            : error instanceof Error
              ? error.message
              : 'Failed to load hospital settings.';
        toast.error(message || 'Failed to load hospital settings.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleInputChange = (field: keyof HospitalRecord, value: string) => {
    setHospital((curr) => (curr ? { ...curr, [field]: value } : null));
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hospital?._id) return;

    try {
      setSaving(true);
      await api.put(`/hospitals/${hospital._id}`, {
        name: hospital.name,
        city: hospital.city || '',
        state: hospital.state || '',
        address: hospital.address || '',
        phone: hospital.phone || '',
        email: hospital.email || '',
        registrationNumber: hospital.registrationNumber || '',
      });
      toast.success('Hospital profile updated successfully.');
    } catch (error) {
      const message =
        typeof error === 'object' && error !== null && 'response' in error
          ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
          : error instanceof Error
            ? error.message
            : 'Failed to update profile details.';
      toast.error(message || 'Failed to update profile details.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !hospital?._id) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Choose a JPG, PNG, or WEBP image.');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Hospital logo must be 2 MB or smaller.');
      return;
    }

    try {
      setUploading(true);
      const logoUrl = await uploadHospitalLogo({
        hospitalId: hospital._id,
        file,
      });
      setHospital((current) => (current ? { ...current, logoUrl } : current));
      toast.success('Hospital logo updated successfully.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to upload hospital logo.';
      toast.error(message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Hospital Settings</h1>
        <p className="mt-1.5 text-sm text-slate-500">
          Manage branding assets, contact information, and licensing details used across all documents.
        </p>
      </div>

      {loading ? (
        <Card className="rounded-3xl border border-slate-200 py-10 shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
          <div className="flex flex-col items-center justify-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            Loading hospital profile...
          </div>
        </Card>
      ) : (
        <>
          {/* Logo Card */}
          <Card className="rounded-3xl border border-slate-200 py-0 shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
            <CardHeader className="px-5 pt-5">
              <CardTitle className="text-lg font-semibold text-slate-950">Hospital Logo</CardTitle>
              <CardDescription>
                This logo appears at the top of prescriptions, admission slips, discharge summaries, and medical reports.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 px-5 pb-5 pt-0">
              <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-5 sm:flex-row sm:items-center">
                <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  {hospital?.logoUrl ? (
                    <Image
                      src={hospital.logoUrl}
                      alt={`${hospital.name} logo`}
                      width={96}
                      height={96}
                      className="h-full w-full object-contain"
                      unoptimized
                    />
                  ) : (
                    <Building2 className="h-10 w-10 text-slate-300" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-slate-950">{hospital?.name || 'Hospital'}</h2>
                    <Badge variant="secondary" className="rounded-full bg-emerald-50 text-emerald-600">
                      {hospital?.logoUrl ? 'Logo uploaded' : 'No logo yet'}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    Stored in AWS under <code className="rounded bg-white px-1.5 py-0.5 text-xs">media/logos/hospitals/</code>
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    Recommended: square PNG or JPG, at least 256×256 px, max 2 MB.
                  </p>
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(event) => void handleLogoChange(event)}
              />

              <Button
                type="button"
                className="rounded-xl"
                disabled={uploading || !hospital?._id}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImageUp className="mr-2 h-4 w-4" />}
                {uploading ? 'Uploading logo...' : hospital?.logoUrl ? 'Replace hospital logo' : 'Upload hospital logo'}
              </Button>
            </CardContent>
          </Card>

          {/* Profile details form */}
          <Card className="rounded-3xl border border-slate-200 py-0 shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
            <CardHeader className="px-5 pt-5">
              <CardTitle className="text-lg font-semibold text-slate-950">Hospital Profile</CardTitle>
              <CardDescription>
                Configure the legal and contact details displayed on all customer-facing PDFs and reports.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-5 pb-5 pt-0">
              <form onSubmit={(e) => void handleSaveProfile(e)} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="hospital-name">Hospital Name *</Label>
                    <Input
                      id="hospital-name"
                      value={hospital?.name || ''}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      placeholder="e.g. City General Hospital"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="hospital-reg">Registration / Licence Number</Label>
                    <Input
                      id="hospital-reg"
                      value={hospital?.registrationNumber || ''}
                      onChange={(e) => handleInputChange('registrationNumber', e.target.value)}
                      placeholder="e.g. REG-123456-HMS"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="hospital-email">Official Email Address</Label>
                    <Input
                      id="hospital-email"
                      type="email"
                      value={hospital?.email || ''}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      placeholder="e.g. contact@hospital.com"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="hospital-phone">Official Phone Number</Label>
                    <Input
                      id="hospital-phone"
                      type="tel"
                      value={hospital?.phone || ''}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      placeholder="e.g. +1 (555) 019-2834"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="hospital-address">Street Address</Label>
                  <Textarea
                    id="hospital-address"
                    value={hospital?.address || ''}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                    placeholder="e.g. 100 Medical Plaza, Suite 400"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="hospital-city">City *</Label>
                    <Input
                      id="hospital-city"
                      value={hospital?.city || ''}
                      onChange={(e) => handleInputChange('city', e.target.value)}
                      placeholder="e.g. New York"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="hospital-state">State / Province</Label>
                    <Input
                      id="hospital-state"
                      value={hospital?.state || ''}
                      onChange={(e) => handleInputChange('state', e.target.value)}
                      placeholder="e.g. NY"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button type="submit" disabled={saving} className="rounded-xl">
                    {saving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    {saving ? 'Saving changes...' : 'Save Settings'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
