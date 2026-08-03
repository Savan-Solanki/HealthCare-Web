'use client';

import { cn } from '@/lib/utils';

export interface FileRow {
  _id?: string;
  fileName?: string;
  originalName?: string;
  module: string;
  mimeType?: string;
  fileSizeBytes: number;
  fileSizeBytesFormatted: string;
  uploadedAt?: string;
  s3Key?: string;
}

interface FileListTableProps {
  data: FileRow[];
  loading?: boolean;
  title?: string;
  emptyMessage?: string;
}

const Skeleton = ({ className }: { className?: string }) => (
  <div className={cn('animate-pulse rounded bg-gray-200', className)} />
);

const formatDate = (iso?: string | null) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

const mimeIcon = (mime?: string) => {
  if (!mime) return '📎';
  if (mime.includes('pdf')) return '📄';
  if (mime.includes('image')) return '🖼️';
  if (mime.includes('word') || mime.includes('doc')) return '📝';
  return '📎';
};

const MODULE_BADGE_COLOR: Record<string, string> = {
  'Prescription PDF':   'bg-purple-100 text-purple-700',
  'Prescription Image': 'bg-violet-100 text-violet-700',
  'Lab Report':         'bg-cyan-100 text-cyan-700',
  'Discharge Summary':  'bg-blue-100 text-blue-700',
  'Receipt':            'bg-green-100 text-green-700',
  'Admission File':     'bg-yellow-100 text-yellow-700',
  'Hospital Logo':      'bg-rose-100 text-rose-700',
  'Doctor Signature':   'bg-pink-100 text-pink-700',
  'Patient Profile':    'bg-indigo-100 text-indigo-700',
  'Staff Profile':      'bg-teal-100 text-teal-700',
  'Other':              'bg-gray-100 text-gray-700',
};

export function FileListTable({
  data,
  loading = false,
  title,
  emptyMessage = 'No files found',
}: FileListTableProps) {
  return (
    <div>
      {title && (
        <h3 className="mb-3 text-sm font-semibold text-foreground">{title}</h3>
      )}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded" />
          ))}
        </div>
      ) : data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="text-3xl mb-2">📂</div>
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="pb-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  File
                </th>
                <th className="pb-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden sm:table-cell">
                  Module
                </th>
                <th className="pb-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Size
                </th>
                <th className="pb-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell">
                  Uploaded
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.map((file, i) => (
                <tr key={file._id || i} className="hover:bg-gray-50 transition-colors">
                  <td className="py-2.5 pr-4 max-w-[180px]">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{mimeIcon(file.mimeType)}</span>
                      <span className="truncate text-xs font-medium text-foreground" title={file.fileName || file.originalName}>
                        {file.fileName || file.originalName || 'Unnamed'}
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 pr-4 hidden sm:table-cell">
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                        MODULE_BADGE_COLOR[file.module] || 'bg-gray-100 text-gray-700'
                      )}
                    >
                      {file.module}
                    </span>
                  </td>
                  <td className="py-2.5 text-right tabular-nums text-xs text-muted-foreground">
                    {file.fileSizeBytesFormatted}
                  </td>
                  <td className="py-2.5 text-right text-xs text-muted-foreground hidden md:table-cell">
                    {formatDate(file.uploadedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
