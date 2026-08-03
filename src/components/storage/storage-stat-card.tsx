'use client';

import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StorageStatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  iconColor?: string;
  iconBg?: string;
  trend?: { value: number; label: string };
  loading?: boolean;
  className?: string;
}

const Skeleton = ({ className }: { className?: string }) => (
  <div className={cn('animate-pulse rounded bg-gray-200', className)} />
);

export function StorageStatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor = 'text-blue-600',
  iconBg = 'bg-blue-50',
  trend,
  loading = false,
  className,
}: StorageStatCardProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border border-border bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5',
        className
      )}
    >
      {/* Decorative gradient orb */}
      <div
        className={cn(
          'pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-10',
          iconBg.replace('bg-', 'bg-')
        )}
      />

      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {title}
          </p>
          {loading ? (
            <Skeleton className="mt-2 h-7 w-32" />
          ) : (
            <p className="mt-1.5 text-2xl font-bold text-foreground leading-tight">
              {value}
            </p>
          )}
          {subtitle && !loading && (
            <p className="mt-0.5 text-xs text-muted-foreground truncate">{subtitle}</p>
          )}
          {loading && subtitle && <Skeleton className="mt-1.5 h-3.5 w-24" />}
          {trend && !loading && (
            <div className={cn('mt-2 flex items-center gap-1 text-xs font-medium',
              trend.value >= 0 ? 'text-emerald-600' : 'text-red-500')}>
              <span>{trend.value >= 0 ? '↑' : '↓'}</span>
              <span>{Math.abs(trend.value)}% {trend.label}</span>
            </div>
          )}
        </div>
        <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', iconBg)}>
          <Icon size={20} className={iconColor} />
        </div>
      </div>
    </div>
  );
}
