'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { clearAdminSessionCookie } from '@/lib/admin-session-cookie';
import { clearSuperAdminCache } from '@/lib/super-admin-cache';
import { ADMIN_LOGIN_PATH } from '@/lib/routes';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const IDLE_LIMIT_MS = 60 * 1000;
const WARNING_DURATION_MS = 5 * 1000;
const WARNING_START_MS = IDLE_LIMIT_MS - WARNING_DURATION_MS;

export function AdminIdleGuard() {
  const router = useRouter();
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const logoutTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastBeepSecondRef = useRef<number | null>(null);

  const [warningOpen, setWarningOpen] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(5);

  const clearTimers = useCallback(() => {
    if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
    if (logoutTimeoutRef.current) clearTimeout(logoutTimeoutRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
  }, []);

  const ensureAudioContext = useCallback(async () => {
    if (typeof window === 'undefined') return null;

    const AudioContextCtor =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextCtor) return null;

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextCtor();
    }

    if (audioContextRef.current.state === 'suspended') {
      try {
        await audioContextRef.current.resume();
      } catch {
        return audioContextRef.current;
      }
    }

    return audioContextRef.current;
  }, []);

  const playWarningBeep = useCallback(async () => {
    const audioContext = await ensureAudioContext();
    if (!audioContext || audioContext.state !== 'running') return;

    const masterGain = audioContext.createGain();
    const primaryOscillator = audioContext.createOscillator();
    const supportOscillator = audioContext.createOscillator();

    primaryOscillator.type = 'square';
    primaryOscillator.frequency.value = 1046;

    supportOscillator.type = 'triangle';
    supportOscillator.frequency.value = 1318;

    masterGain.gain.setValueAtTime(0.0001, audioContext.currentTime);
    masterGain.gain.exponentialRampToValueAtTime(0.18, audioContext.currentTime + 0.01);
    masterGain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.28);

    primaryOscillator.connect(masterGain);
    supportOscillator.connect(masterGain);
    masterGain.connect(audioContext.destination);

    primaryOscillator.start(audioContext.currentTime);
    supportOscillator.start(audioContext.currentTime);
    primaryOscillator.stop(audioContext.currentTime + 0.3);
    supportOscillator.stop(audioContext.currentTime + 0.3);
  }, [ensureAudioContext]);

  const logoutAdmin = useCallback(async () => {
    clearTimers();
    setWarningOpen(false);

    try {
      await api.post('/auth/logout');
    } catch {
      // Best effort logout; client cleanup still happens below.
    }

    if (typeof window !== 'undefined') {
      clearSuperAdminCache();
      clearAdminSessionCookie();
      sessionStorage.clear();
      window.location.href = `${ADMIN_LOGIN_PATH}?error=${encodeURIComponent('Your session expired due to inactivity.')}`;
    } else {
      router.push(ADMIN_LOGIN_PATH);
    }
  }, [clearTimers, router]);

  const startTimers = useCallback(() => {
    clearTimers();
    setWarningOpen(false);
    setSecondsLeft(5);

    warningTimeoutRef.current = setTimeout(() => {
      setWarningOpen(true);
      setSecondsLeft(5);

      countdownIntervalRef.current = setInterval(() => {
        setSecondsLeft((current) => (current > 0 ? current - 1 : 0));
      }, 1000);
    }, WARNING_START_MS);

    logoutTimeoutRef.current = setTimeout(() => {
      logoutAdmin();
    }, IDLE_LIMIT_MS);
  }, [clearTimers, logoutAdmin]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!sessionStorage.getItem('access_token')) return;

    const handleActivity = () => {
      void ensureAudioContext();
      startTimers();
    };

    const events: Array<keyof WindowEventMap> = [
      'mousemove',
      'mousedown',
      'keydown',
      'scroll',
      'touchstart',
      'click',
    ];

    const timeoutId = window.setTimeout(() => {
      startTimers();
    }, 0);

    events.forEach((event) => window.addEventListener(event, handleActivity, { passive: true }));

    return () => {
      window.clearTimeout(timeoutId);
      clearTimers();
      events.forEach((event) => window.removeEventListener(event, handleActivity));
    };
  }, [clearTimers, ensureAudioContext, startTimers]);

  useEffect(() => {
    if (!warningOpen) {
      lastBeepSecondRef.current = null;
      return;
    }

    if (secondsLeft <= 0 || lastBeepSecondRef.current === secondsLeft) {
      return;
    }

    lastBeepSecondRef.current = secondsLeft;
    void playWarningBeep();
  }, [playWarningBeep, secondsLeft, warningOpen]);

  return (
    <Dialog open={warningOpen}>
      <DialogContent className="sm:max-w-[420px] rounded-2xl p-6">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Session Expiring</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Your admin session will be destroyed in {secondsLeft} second{secondsLeft === 1 ? '' : 's'} due to inactivity.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-3">
          <Button
            variant="outline"
            className="rounded-xl px-6 h-11 border-gray-200"
            onClick={startTimers}
          >
            Stay Logged In
          </Button>
          <Button
            className="bg-primary hover:bg-primary/90 text-white rounded-xl px-8 h-11 shadow-sm"
            onClick={logoutAdmin}
          >
            Logout Now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
