'use client';

import { UserMinus } from 'lucide-react';
import { useAction } from 'next-safe-action/hooks';
import { useState } from 'react';
import { toast } from 'sonner';

import { kickUserAction } from '@/actions/users/kick-user';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ResponsiveDialogFooter } from '@/components/ui/responsive-dialog-footer';
import { useResponsiveDialog } from '@/hooks/use-responsive-dialog';

interface KickUserDialogProps {
  userId: string;
  userName: string;
  canKick?: boolean;
}

export function KickUserDialog({
  userId,
  userName,
  canKick = true,
}: KickUserDialogProps) {
  const [open, setOpen] = useState(false);
  const { dialogStyles } = useResponsiveDialog({
    maxWidth: 'sm:max-w-[420px]',
  });

  const { execute: executeKick, isExecuting: isKicking } = useAction(
    kickUserAction,
    {
      onSuccess: ({ data }) => {
        if (data?.success) {
          toast.success(data.message);
          setOpen(false);
        }
      },
      onError: ({ error }) => {
        toast.error(error.serverError || 'Failed to delete account');
      },
    }
  );

  const handleKick = () => {
    executeKick({ userId });
  };

  if (!canKick) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <UserMinus className="h-4 w-4" />
          Delete Account
        </Button>
      </DialogTrigger>
      <DialogContent
        className={`${dialogStyles.className} max-w-[380px]`}
        style={dialogStyles.style}
        showCloseButton
        transitionFrom="bottom-left"
      >
        <DialogHeader>
          <DialogTitle>Delete Account</DialogTitle>
          <DialogDescription>
            Are you sure you want to <strong>permanently delete</strong>{' '}
            <strong>{userName}</strong>? This will{' '}
            <strong>completely remove the user and all associated data</strong>{' '}
            from the system. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md bg-red-50 p-4 dark:bg-red-900/20">
          <p className="text-sm text-red-800 dark:text-red-200">
            <strong>Warning:</strong> Deleting this user will erase all their
            data, including flight logs, statistics, and any other associated
            records. This action is irreversible.
          </p>
        </div>

        <ResponsiveDialogFooter
          primaryButton={{
            label: 'Delete Account',
            onClick: handleKick,
            disabled: isKicking,
            loading: isKicking,
            loadingLabel: 'Deleting...',
            className:
              'bg-destructive text-destructive-foreground hover:bg-destructive/90',
          }}
          secondaryButton={{
            label: 'Cancel',
            onClick: () => setOpen(false),
            disabled: isKicking,
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
