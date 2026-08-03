'use client';

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface ConfirmDeleteDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title?: string;
  description?: string;
  itemName?: string;
  loading?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────
export function ConfirmDeleteDialog({
  open,
  onClose,
  onConfirm,
  title = 'Delete Confirmation',
  description,
  itemName,
  loading = false,
}: ConfirmDeleteDialogProps) {
  const defaultDescription = itemName
    ? `Are you sure you want to delete "${itemName}"? This action cannot be undone.`
    : 'Are you sure you want to delete this item? This action cannot be undone.';

  return (
    <Dialog open={open} onOpenChange={(isOpen: boolean) => { if (!isOpen && !loading) onClose(); }}>
      <DialogContent showCloseButton={!loading} className="max-w-sm">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100">
              <AlertTriangle size={18} className="text-red-600" />
            </div>
            <DialogTitle className="text-base font-semibold text-foreground">
              {title}
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm text-muted-foreground leading-relaxed pl-[52px]">
            {description ?? defaultDescription}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="mt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={loading}
            className="min-w-[80px]"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => void onConfirm()}
            disabled={loading}
            className="min-w-[80px] bg-red-600 hover:bg-red-700 text-white"
          >
            {loading ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
/**
 * Convenience hook to manage ConfirmDeleteDialog state.
 *
 * Usage:
 *   const { dialogProps, openConfirm } = useConfirmDelete(async () => {
 *     await api.delete('/some/endpoint');
 *   });
 *
 *   // In JSX:
 *   <Button onClick={() => openConfirm({ itemName: row.name })}>Delete</Button>
 *   <ConfirmDeleteDialog {...dialogProps} />
 */
export function useConfirmDelete(onConfirmed: () => void | Promise<void>) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [opts, setOpts] = useState<{ title?: string; description?: string; itemName?: string }>({});

  const openConfirm = (options?: { title?: string; description?: string; itemName?: string }) => {
    setOpts(options ?? {});
    setOpen(true);
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirmed();
    } finally {
      setLoading(false);
      setOpen(false);
    }
  };

  const handleClose = () => {
    if (!loading) setOpen(false);
  };

  const dialogProps: ConfirmDeleteDialogProps = {
    open,
    onClose: handleClose,
    onConfirm: handleConfirm,
    loading,
    ...opts,
  };

  return { dialogProps, openConfirm };
}
