'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import Image from 'next/image';
import Script from 'next/script';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import api from '@/lib/api';
import { clearSuperAdminCache, refreshSuperAdminCache } from '@/lib/super-admin-cache';
import { clearHospitalAdminCache, refreshHospitalAdminCache } from '@/lib/hospital-admin-cache';
import { setAdminSessionCookie } from '@/lib/admin-session-cookie';
import {
  ADMIN_LOGIN_PATH,
  DOCTOR_LOGIN_PATH,
  getDoctorPath,
  HOSPITAL_ADMIN_LOGIN_PATH,
  RECEPTIONIST_LOGIN_PATH,
  getHospitalAdminPath,
  getReceptionistPath,
  getSuperAdminPath,
  type AuthPortal,
} from '@/lib/routes';

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string;
          callback?: (token: string) => void;
          'expired-callback'?: () => void;
          'error-callback'?: () => void;
          theme?: 'light' | 'dark' | 'auto';
        }
      ) => string;
      remove: (widgetId: string) => void;
      reset: (widgetId?: string) => void;
    };
  }
}

const getErrorMessage = (error: unknown, fallback: string) => {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error
  ) {
    const response = error as { response?: { status?: number; data?: { message?: string } } };
    if (response.response?.status === 401) {
      return 'Incorrect email or password.';
    }

    return response.response?.data?.message || fallback;
  }

  return fallback;
};

interface AdminLoginScreenProps {
  mode?: 'super-admin' | 'hospital-admin' | 'receptionist' | 'doctor';
}

const requiresHospitalContext = (mode: AdminLoginScreenProps['mode']) =>
  mode === 'hospital-admin' || mode === 'receptionist' || mode === 'doctor';

export function AdminLoginScreen({ mode = 'super-admin' }: AdminLoginScreenProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const turnstileContainerId = useId().replace(/:/g, '');
  const turnstileWidgetId = useRef<string | null>(null);
  const turnstileScriptLoaded = useRef(false);
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const [step, setStep] = useState<'login' | 'otp' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [hospitalName, setHospitalName] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [isHospitalInfoOpen, setIsHospitalInfoOpen] = useState(requiresHospitalContext(mode));
  const [resendSecondsLeft, setResendSecondsLeft] = useState(0);
  const [otpPurpose, setOtpPurpose] = useState<'login' | 'password-reset'>('login');

  const navigateToPortal = useCallback((path: string) => {
    router.replace(path);
  }, [router]);

  const authPortal: AuthPortal | undefined =
    mode === 'hospital-admin'
      ? 'hospital-admin'
      : mode === 'receptionist'
        ? 'receptionist'
        : mode === 'doctor'
          ? 'doctor'
          : mode === 'super-admin'
            ? 'super-admin'
            : undefined;

  const loginPath =
    mode === 'hospital-admin'
      ? HOSPITAL_ADMIN_LOGIN_PATH
      : mode === 'receptionist'
        ? RECEPTIONIST_LOGIN_PATH
        : mode === 'doctor'
          ? DOCTOR_LOGIN_PATH
          : ADMIN_LOGIN_PATH;
  const loginTitle =
    mode === 'hospital-admin'
      ? 'Hospital admin access'
      : mode === 'receptionist'
        ? 'Receptionist access'
        : mode === 'doctor'
          ? 'Doctor access'
          : 'Admin access';
  const loginDescription =
    mode === 'hospital-admin'
      ? 'Sign in with hospital admin credentials created by super admin'
      : mode === 'receptionist'
        ? 'Sign in with receptionist credentials created by super admin'
        : mode === 'doctor'
          ? 'Sign in with credentials created and shared by your hospital admin'
          : 'Sign in to your healthcare admin workspace';

  const resetTurnstile = useCallback(() => {
    setTurnstileToken('');
    if (turnstileWidgetId.current && window.turnstile) {
      window.turnstile.reset(turnstileWidgetId.current);
    }
  }, []);

  const renderTurnstile = useCallback(() => {
    if (!turnstileSiteKey || !turnstileScriptLoaded.current || !window.turnstile || turnstileWidgetId.current) {
      return;
    }

    const container = document.getElementById(turnstileContainerId);
    if (!container) return;

    turnstileWidgetId.current = window.turnstile.render(container, {
      sitekey: turnstileSiteKey,
      theme: 'light',
      callback: (token: string) => {
        setTurnstileToken(token);
        setErrorMessage('');
      },
      'expired-callback': () => {
        setTurnstileToken('');
      },
      'error-callback': () => {
        setTurnstileToken('');
        setErrorMessage('Captcha failed to load. Please retry.');
      },
    });
  }, [turnstileContainerId, turnstileSiteKey]);

  useEffect(() => {
    const searchError = searchParams.get('error');
    if (!searchError) return;

    toast.error(searchError);
    router.replace(loginPath);
  }, [loginPath, router, searchParams]);

  useEffect(() => {
    if (step === 'login') {
      renderTurnstile();
    }
  }, [renderTurnstile, step]);

  useEffect(() => {
    if (resendSecondsLeft <= 0) return;

    const intervalId = window.setInterval(() => {
      setResendSecondsLeft((current) => (current > 0 ? current - 1 : 0));
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [resendSecondsLeft]);

  useEffect(() => {
    return () => {
      if (turnstileWidgetId.current && window.turnstile) {
        window.turnstile.remove(turnstileWidgetId.current);
      }
    };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!email || !password || (requiresHospitalContext(mode) && !hospitalName)) {
      const message =
        requiresHospitalContext(mode)
          ? 'Please enter hospital name, email, and password.'
          : 'Please enter both email and password.';
      setErrorMessage(message);
      toast.error(message);
      return;
    }

    if (!turnstileSiteKey) {
      const message = 'Turnstile site key is not configured.';
      setErrorMessage(message);
      toast.error(message);
      return;
    }

    if (!turnstileToken) {
      const message = 'Please complete the captcha verification.';
      setErrorMessage(message);
      toast.error(message);
      return;
    }

    try {
      setLoading(true);
      const res = await api.post('/auth/login', {
        email,
        password,
        hospitalName: requiresHospitalContext(mode) ? hospitalName : undefined,
        portal: authPortal,
        turnstileToken,
      });

      if (res.data.requiresOtp) {
        toast.success(res.data.message || 'OTP sent to email!');
        setOtpPurpose('login');
        setResendSecondsLeft(res.data.otpExpiresIn || 120);
        setStep('otp');
      }
    } catch (error: unknown) {
      const message = getErrorMessage(error, 'Login failed. Please try again.');
      setErrorMessage(message);
      resetTurnstile();
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendSecondsLeft > 0) return;

    try {
      setLoading(true);
      const res = await api.post('/auth/resend-otp', {
        email,
        hospitalName: requiresHospitalContext(mode) ? hospitalName : undefined,
        portal: authPortal,
        purpose: otpPurpose,
      });
      setResendSecondsLeft(res.data.otpExpiresIn || 120);
      toast.success(res.data.message || 'OTP resent successfully.');
    } catch (error: unknown) {
      const message =
        typeof error === 'object' &&
        error !== null &&
        'response' in error
          ? (error as { response?: { data?: { message?: string } } }).response?.data?.message || 'Failed to resend OTP.'
          : 'Failed to resend OTP.';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp) {
      toast.error('Please enter the OTP.');
      return;
    }

    try {
      setLoading(true);
      const res = await api.post('/auth/verify-otp', { email, otp, portal: authPortal });
      const { accessToken, user } = res.data;

      if (accessToken) {
        sessionStorage.setItem('access_token', accessToken);
        sessionStorage.setItem('auth_user', JSON.stringify(user));
        setAdminSessionCookie(user.role || 'Hospital Admin');
        toast.success('Login successful!');

        const navigateAfterAuth = (path: string) => {
          window.location.replace(path);
        };

        if (user.role === 'Super Admin') {
          clearSuperAdminCache();
          void refreshSuperAdminCache();
          navigateAfterAuth(getSuperAdminPath());
        } else if (user.role === 'Hospital Admin') {
          clearHospitalAdminCache();
          void refreshHospitalAdminCache();
          navigateAfterAuth(getHospitalAdminPath());
        } else if (user.role === 'Receptionist') {
          clearHospitalAdminCache();
          void refreshHospitalAdminCache(['patients', 'appointments', 'doctors']);
          navigateAfterAuth(getReceptionistPath('/patients'));
        } else if (user.role === 'Doctor') {
          navigateAfterAuth(getDoctorPath());
        } else {
          navigateAfterAuth(loginPath);
        }
      }
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Invalid or expired OTP.'));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email || !hospitalName) {
      toast.error('Please enter hospital name and email first.');
      return;
    }

    try {
      setLoading(true);
      const res = await api.post('/auth/forgot-password', {
        email,
        hospitalName,
        portal: authPortal,
      });
      setOtp('');
      setNewPassword('');
      setConfirmPassword('');
      setOtpPurpose('password-reset');
      setResendSecondsLeft(res.data.otpExpiresIn || 120);
      setStep('reset');
      toast.success(res.data.message || 'Password reset OTP sent.');
    } catch (error: unknown) {
      const message =
        typeof error === 'object' &&
        error !== null &&
        'response' in error
          ? (error as { response?: { data?: { message?: string } } }).response?.data?.message || 'Failed to start password reset.'
          : 'Failed to start password reset.';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!otp || !newPassword || !confirmPassword) {
      toast.error('Please fill all reset password fields.');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }

    try {
      setLoading(true);
      const res = await api.post('/auth/reset-password', {
        email,
        hospitalName,
        otp,
        newPassword,
        portal: authPortal,
      });
      toast.success(res.data.message || 'Password reset successful.');
      setStep('login');
      setOtp('');
      setNewPassword('');
      setConfirmPassword('');
      setPassword('');
      setResendSecondsLeft(0);
      setOtpPurpose('login');
    } catch (error: unknown) {
      const message =
        typeof error === 'object' &&
        error !== null &&
        'response' in error
          ? (error as { response?: { data?: { message?: string } } }).response?.data?.message || 'Failed to reset password.'
          : 'Failed to reset password.';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50/50 p-4">
      <div className="w-full max-w-[400px] bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden relative">
        {requiresHospitalContext(mode) ? (
          <Dialog open={isHospitalInfoOpen} onOpenChange={setIsHospitalInfoOpen}>
            <DialogContent className="sm:max-w-[420px] rounded-2xl">
              <DialogHeader>
                <DialogTitle>
                  {mode === 'doctor'
                    ? 'Doctor Access'
                    : mode === 'receptionist'
                      ? 'Receptionist Access'
                      : 'Hospital Admin Access'}
                </DialogTitle>
                <DialogDescription>
                  {mode === 'doctor'
                    ? 'Doctor accounts are created only by hospital admin. Use the credentials shared with you to sign in.'
                    : mode === 'receptionist'
                      ? 'Receptionist accounts are created only by super admin. Use the credentials shared with you to sign in.'
                      : 'Hospital admin accounts are created only by super admin. Use the credentials shared with you to sign in.'}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button onClick={() => setIsHospitalInfoOpen(false)} className="bg-primary text-white hover:bg-primary/90">
                  Continue
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : null}

        {step !== 'login' && (
          <button
            onClick={() => {
              setStep('login');
              setOtp('');
              setNewPassword('');
              setConfirmPassword('');
              setResendSecondsLeft(0);
              setOtpPurpose('login');
              resetTurnstile();
            }}
            className="absolute top-6 left-6 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
        )}

        <div className="p-8">
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center shrink-0 overflow-hidden mb-4 shadow-sm">
              <Image
                src="/logo.jpg"
                alt="healthcare Logo"
                width={48}
                height={48}
                className="w-full h-full object-cover"
                priority
              />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {step === 'login' ? loginTitle : step === 'otp' ? 'Verification Required' : 'Reset Password'}
            </h1>
            <p className="text-sm text-muted-foreground mt-1.5">
              {step === 'login'
                ? loginDescription
                : step === 'otp'
                  ? `We've sent a 6-digit code to ${email}`
                  : `Enter the OTP sent to ${email} and choose a new password`}
            </p>
          </div>

          {step === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-5">
              {errorMessage && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {errorMessage}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@medikwik.com"
                  className="h-11 rounded-xl border-gray-200 bg-gray-50/50 focus-visible:ring-1 focus-visible:ring-primary/30"
                  disabled={loading}
                  required
                />
              </div>

              {requiresHospitalContext(mode) ? (
                <div className="space-y-2">
                  <Label htmlFor="hospital-name" className="text-sm font-medium">Hospital Name</Label>
                  <Input
                    id="hospital-name"
                    type="text"
                    value={hospitalName}
                    onChange={(e) => setHospitalName(e.target.value)}
                    placeholder="Enter assigned hospital name"
                    className="h-11 rounded-xl border-gray-200 bg-gray-50/50 focus-visible:ring-1 focus-visible:ring-primary/30"
                    disabled={loading}
                    required
                  />
                </div>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="********"
                  className="h-11 rounded-xl border-gray-200 bg-gray-50/50 focus-visible:ring-1 focus-visible:ring-primary/30"
                  disabled={loading}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Security Check</Label>
                {turnstileSiteKey ? (
                  <div
                    id={turnstileContainerId}
                    className="min-h-[65px] rounded-xl border border-gray-200 bg-gray-50/50 px-3 py-3"
                  />
                ) : (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    Add `NEXT_PUBLIC_TURNSTILE_SITE_KEY` to enable captcha verification.
                  </div>
                )}
              </div>

              <Button
                type="submit"
                className="w-full h-11 bg-primary hover:bg-primary/90 text-white rounded-xl shadow-sm font-medium transition-all"
                disabled={loading || !turnstileToken}
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Continue'}
              </Button>

              {requiresHospitalContext(mode) ? (
                <button
                  type="button"
                  onClick={() => void handleForgotPassword()}
                  className="w-full text-sm font-medium text-primary transition-colors hover:text-primary/80"
                  disabled={loading}
                >
                  Forgot password?
                </button>
              ) : null}
            </form>
          ) : step === 'otp' ? (
            <form onSubmit={handleVerifyOtp} className="space-y-5">
              <div className="space-y-2 text-center">
                <Label htmlFor="otp" className="text-sm font-medium block mb-2">Enter Verification Code</Label>
                <Input
                  id="otp"
                  type="text"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="h-14 text-center text-2xl tracking-[0.5em] font-semibold rounded-xl border-gray-200 bg-gray-50/50 focus-visible:ring-1 focus-visible:ring-primary/30"
                  disabled={loading}
                  required
                />
              </div>

              <Button
                type="submit"
                className="w-full h-11 bg-primary hover:bg-primary/90 text-white rounded-xl shadow-sm font-medium transition-all mt-4"
                disabled={loading || otp.length < 6}
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Verify & Sign in'}
              </Button>

              <div className="text-center text-sm text-muted-foreground">
                {resendSecondsLeft > 0 ? (
                  <p>Resend OTP in {resendSecondsLeft}s</p>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleResendOtp()}
                    className="font-medium text-primary transition-colors hover:text-primary/80"
                    disabled={loading}
                  >
                    Resend OTP
                  </button>
                )}
              </div>
            </form>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-5">
              <div className="space-y-2 text-center">
                <Label htmlFor="reset-otp" className="text-sm font-medium block mb-2">Enter Reset OTP</Label>
                <Input
                  id="reset-otp"
                  type="text"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="h-14 text-center text-2xl tracking-[0.5em] font-semibold rounded-xl border-gray-200 bg-gray-50/50 focus-visible:ring-1 focus-visible:ring-primary/30"
                  disabled={loading}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-password" className="text-sm font-medium">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="h-11 rounded-xl border-gray-200 bg-gray-50/50 focus-visible:ring-1 focus-visible:ring-primary/30"
                  disabled={loading}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password" className="text-sm font-medium">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="h-11 rounded-xl border-gray-200 bg-gray-50/50 focus-visible:ring-1 focus-visible:ring-primary/30"
                  disabled={loading}
                  required
                />
              </div>

              <Button
                type="submit"
                className="w-full h-11 bg-primary hover:bg-primary/90 text-white rounded-xl shadow-sm font-medium transition-all mt-4"
                disabled={loading || otp.length < 6}
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Reset Password'}
              </Button>

              <div className="text-center text-sm text-muted-foreground">
                {resendSecondsLeft > 0 ? (
                  <p>Resend OTP in {resendSecondsLeft}s</p>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleResendOtp()}
                    className="font-medium text-primary transition-colors hover:text-primary/80"
                    disabled={loading}
                  >
                    Resend OTP
                  </button>
                )}
              </div>
            </form>
          )}

          <div className="mt-8 text-center text-xs text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} healthcare. All rights reserved.</p>
          </div>
        </div>
      </div>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={() => {
          turnstileScriptLoaded.current = true;
          renderTurnstile();
        }}
      />
    </div>
  );
}
