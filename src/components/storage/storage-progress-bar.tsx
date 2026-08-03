'use client';

import { cn } from '@/lib/utils';

interface StorageProgressBarProps {
  used: number;        // bytes used
  total?: number;      // reference max in bytes (default: 10 GB)
  label?: string;      // displayed below bar (e.g. "3.4 GB Used")
  className?: string;
  showPercent?: boolean;
  size?: 'sm' | 'md';
}

const REFERENCE_MAX_BYTES = 10 * 1024 * 1024 * 1024; // 10 GB soft reference

const colorFromPercent = (pct: number) => {
  if (pct < 50) return 'bg-emerald-500';
  if (pct < 75) return 'bg-amber-400';
  if (pct < 90) return 'bg-orange-500';
  return 'bg-red-500';
};

export function StorageProgressBar({
  used,
  total = REFERENCE_MAX_BYTES,
  label,
  className,
  showPercent = false,
  size = 'md',
}: StorageProgressBarProps) {
  const pct = Math.min(100, total > 0 ? Math.round((used / total) * 100) : 0);
  const barColor = colorFromPercent(pct);

  return (
    <div className={cn('w-full', className)}>
      <div
        className={cn(
          'w-full overflow-hidden rounded-full bg-gray-100',
          size === 'sm' ? 'h-1.5' : 'h-2'
        )}
      >
        <div
          className={cn(
            'h-full rounded-full transition-all duration-700 ease-out',
            barColor
          )}
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
      {(label || showPercent) && (
        <p className="mt-1 text-[10px] text-muted-foreground">
          {label}{showPercent && label ? ` · ${pct}%` : showPercent ? `${pct}%` : ''}
        </p>
      )}
    </div>
  );
}
