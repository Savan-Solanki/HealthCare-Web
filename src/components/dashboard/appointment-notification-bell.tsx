'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, CalendarClock, Check, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { API_BASE_URL } from '@/lib/api-url';
import { Button } from '@/components/ui/button';

const NOTIFICATION_EVENT = 'medkwik:appointment-notification';

type AppointmentNotification = {
  id: string;
  appointmentId: string;
  title: string;
  message: string;
  patientName: string;
  doctorName: string | null;
  department: string | null;
  appointmentDate: string;
  appointmentTime: string | null;
  actionUrl: string;
  createdAt: string;
};

type NotificationsResponse = {
  data?: AppointmentNotification[];
};

type DismissedPayload = {
  id?: string;
  appointmentId?: string;
};

type WindowWithAudioContext = Window & {
  webkitAudioContext?: typeof AudioContext;
};

const formatNotificationTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
};

const buildStreamUrl = () => {
  const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
  return `${base}/notifications/stream`;
};

export function AppointmentNotificationBell() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<AppointmentNotification[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const soundUnlockedRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  const playNotificationSound = useCallback(() => {
    if (!soundUnlockedRef.current || typeof window === 'undefined') return;

    const AudioContextCtor =
      window.AudioContext || (window as WindowWithAudioContext).webkitAudioContext;
    if (!AudioContextCtor) return;

    const context = audioContextRef.current || new AudioContextCtor();
    audioContextRef.current = context;

    const startSound = () => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, context.currentTime);
      oscillator.frequency.setValueAtTime(660, context.currentTime + 0.11);
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.2, context.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.32);

      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.34);
    };

    if (context.state === 'suspended') {
      void context.resume().then(startSound).catch(() => undefined);
      return;
    }

    startSound();
  }, []);

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get<NotificationsResponse>('/notifications');
      setNotifications(response.data?.data || []);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unlockSound = () => {
      soundUnlockedRef.current = true;
    };

    window.addEventListener('pointerdown', unlockSound, { once: true });
    window.addEventListener('keydown', unlockSound, { once: true });

    return () => {
      window.removeEventListener('pointerdown', unlockSound);
      window.removeEventListener('keydown', unlockSound);
    };
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadNotifications();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadNotifications]);

  useEffect(() => {
    const stream = new EventSource(buildStreamUrl(), { withCredentials: true });

    stream.addEventListener('appointment-notification', (event) => {
      const notification = JSON.parse(event.data) as AppointmentNotification;

      setNotifications((current) => [
        notification,
        ...current.filter((item) => item.id !== notification.id),
      ].slice(0, 20));

      playNotificationSound();
      toast.success(notification.title, {
        description: `${notification.patientName} - ${notification.appointmentTime || 'Time pending'}`,
      });

      window.dispatchEvent(
        new CustomEvent(NOTIFICATION_EVENT, {
          detail: notification,
        })
      );
    });

    stream.addEventListener('appointment-notification-dismissed', (event) => {
      const payload = JSON.parse(event.data) as DismissedPayload;
      setNotifications((current) =>
        current.filter((item) => item.id !== payload.id && item.appointmentId !== payload.appointmentId)
      );
    });

    return () => stream.close();
  }, [playNotificationSound]);

  const dismissNotification = async (notification: AppointmentNotification, navigate: boolean) => {
    try {
      setDismissingId(notification.id);
      await api.delete(`/notifications/${notification.id}`);
      setNotifications((current) => current.filter((item) => item.id !== notification.id));

      if (navigate) {
        router.push(notification.actionUrl);
      }
    } catch {
      toast.error('Unable to clear this notification.');
    } finally {
      setDismissingId(null);
      setOpen(false);
    }
  };

  const clearAll = async () => {
    const currentNotifications = [...notifications];
    setNotifications([]);

    try {
      await Promise.all(currentNotifications.map((item) => api.delete(`/notifications/${item.id}`)));
      setOpen(false);
    } catch {
      setNotifications(currentNotifications);
      toast.error('Unable to clear all notifications.');
    }
  };

  return (
    <div className="relative">
      <Button
        aria-label="Appointment notifications"
        className="relative h-9 w-9 rounded-full hover:bg-gray-100"
        onClick={() => setOpen((value) => !value)}
        size="icon"
        type="button"
        variant="ghost"
      >
        <Bell size={18} className="text-gray-500" />
        {notifications.length ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-red-500 px-1 text-[10px] font-bold text-white">
            {notifications.length > 9 ? '9+' : notifications.length}
          </span>
        ) : null}
      </Button>

      {open ? (
        <div className="absolute right-0 top-11 z-50 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_80px_-45px_rgba(15,23,42,0.45)]">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div>
              <p className="text-sm font-bold text-slate-950">Appointment alerts</p>
              <p className="text-xs text-slate-500">New patient bookings arrive live</p>
            </div>
            {notifications.length ? (
              <button
                className="text-xs font-semibold text-teal-700 hover:text-teal-800"
                onClick={() => {
                  void clearAll();
                }}
                type="button"
              >
                Clear all
              </button>
            ) : null}
          </div>

          <div className="max-h-[360px] overflow-y-auto p-2">
            {loading ? (
              <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading notifications
              </div>
            ) : notifications.length ? (
              notifications.map((notification) => (
                <article
                  className="group rounded-xl border border-transparent p-3 transition-colors hover:border-teal-100 hover:bg-teal-50/50"
                  key={notification.id}
                >
                  <div className="flex items-start gap-3">
                    <button
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-700 text-white"
                      onClick={() => {
                        void dismissNotification(notification, true);
                      }}
                      type="button"
                    >
                      <CalendarClock className="h-5 w-5" />
                    </button>
                    <button
                      className="min-w-0 flex-1 text-left"
                      onClick={() => {
                        void dismissNotification(notification, true);
                      }}
                      type="button"
                    >
                      <p className="text-sm font-bold text-slate-950">{notification.title}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-600">{notification.message}</p>
                      <p className="mt-2 text-xs font-medium text-slate-400">
                        {formatNotificationTime(notification.createdAt)}
                      </p>
                    </button>
                    <button
                      aria-label="Dismiss notification"
                      className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-white hover:text-slate-700"
                      disabled={dismissingId === notification.id}
                      onClick={() => {
                        void dismissNotification(notification, false);
                      }}
                      type="button"
                    >
                      {dismissingId === notification.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <X className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <div className="px-4 py-8 text-center">
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <Check className="h-5 w-5" />
                </div>
                <p className="mt-3 text-sm font-semibold text-slate-950">All caught up</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">New appointment bookings will show here.</p>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export { NOTIFICATION_EVENT };
