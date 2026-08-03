'use client';

import { cn } from '@/lib/utils';
import { StorageProgressBar } from './storage-progress-bar';

export interface ModuleRow {
  module: string;
  totalFiles: number;
  totalBytes: number;
  totalBytesFormatted: string;
  avgFileSize: number;
  avgFileSizeFormatted: string;
  lastUpload?: string | null;
}

interface StorageModuleTableProps {
  data: ModuleRow[];
  loading?: boolean;
  totalBytes?: number;
}

const Skeleton = ({ className }: { className?: string }) => (
  <div className={cn('animate-pulse rounded bg-gray-200', className)} />
);

const MODULE_ICONS: Record<string, string> = {
  'Prescription PDF':   '📄',
  'Prescription Image': '🖼️',
  'Lab Report':         '🧪',
  'Discharge Summary':  '📋',
  'Receipt':            '🧾',
  'Admission File':     '📁',
  'Hospital Logo':      '🏥',
  'Doctor Signature':   '✍️',
  'Patient Profile':    '👤',
  'Staff Profile':      '👨‍⚕️',
  'Other':              '📦',
};

export function StorageModuleTable({ data, loading = false, totalBytes = 0 }: StorageModuleTableProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="text-4xl mb-3">📊</div>
        <p className="text-sm font-medium text-muted-foreground">No storage data yet</p>
        <p className="text-xs text-muted-foreground mt-1">Files will appear here once uploaded</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="pb-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Module
            </th>
            <th className="pb-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Files
            </th>
            <th className="pb-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Storage Used
            </th>
            <th className="pb-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell">
              Avg Size
            </th>
            <th className="pb-2 pl-4 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden lg:table-cell w-40">
              Usage
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.map((row) => (
            <tr key={row.module} className="group hover:bg-gray-50 transition-colors">
              <td className="py-3 pr-4">
                <div className="flex items-center gap-2">
                  <span className="text-base">{MODULE_ICONS[row.module] || '📦'}</span>
                  <span className="font-medium text-foreground text-sm">{row.module}</span>
                </div>
              </td>
              <td className="py-3 text-right tabular-nums text-muted-foreground">
                {row.totalFiles.toLocaleString()}
              </td>
              <td className="py-3 text-right tabular-nums font-medium text-foreground">
                {row.totalBytesFormatted}
              </td>
              <td className="py-3 text-right tabular-nums text-muted-foreground hidden md:table-cell text-xs">
                {row.avgFileSizeFormatted}
              </td>
              <td className="py-3 pl-4 hidden lg:table-cell">
                <StorageProgressBar
                  used={row.totalBytes}
                  total={totalBytes || row.totalBytes * 5}
                  size="sm"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
