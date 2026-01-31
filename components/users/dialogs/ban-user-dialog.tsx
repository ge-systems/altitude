'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { CalendarIcon, UserX } from 'lucide-react';
import { useAction } from 'next-safe-action/hooks';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { banUserAction } from '@/actions/users/ban-user';
import { unbanUserAction } from '@/actions/users/unban-user';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ResponsiveDialogFooter } from '@/components/ui/responsive-dialog-footer';
import { Textarea } from '@/components/ui/textarea';
import { useResponsiveDialog } from '@/hooks/use-responsive-dialog';
import { cn } from '@/lib/utils';

const banFormSchema = z.object({
  reason: z.string().max(500, 'Reason must be less than 500 characters'),
  expiresAt: z.date().optional(),
});

type BanFormValues = z.infer<typeof banFormSchema>;

interface BanUserDialogProps {
  userId: string;
  userName: string;
  isCurrentlyBanned: boolean;
  currentBanReason?: string | null;
  banExpires?: Date | null;
  canBan?: boolean;
}

export function BanUserDialog({
  userId,
  userName,
  isCurrentlyBanned,
  currentBanReason,
  banExpires,
  canBan = true,
}: BanUserDialogProps) {
  const [open, setOpen] = useState(false);
  const { dialogStyles } = useResponsiveDialog({
    maxWidth: 'sm:max-w-[420px]',
  });

  const form = useForm<BanFormValues>({
    resolver: zodResolver(banFormSchema),
    defaultValues: {
      reason: '',
      expiresAt: undefined,
    },
  });

  const reasonValue = form.watch('reason') || '';

  const { execute: executeBan, isExecuting: isBanning } = useAction(
    banUserAction,
    {
      onSuccess: ({ data }) => {
        if (data?.success) {
          toast.success(data.message);
          setOpen(false);
          form.reset();
        }
      },
      onError: ({ error }) => {
        toast.error(error.serverError || 'Failed to remove user');
      },
    }
  );

  const { execute: executeUnban, isExecuting: isUnbanning } = useAction(
    unbanUserAction,
    {
      onSuccess: ({ data }) => {
        if (data?.success) {
          toast.success(data.message);
          setOpen(false);
        }
      },
      onError: ({ error }) => {
        toast.error(error.serverError || 'Failed to restore access');
      },
    }
  );

  const onSubmit = (values: BanFormValues) => {
    executeBan({
      userId,
      reason: values.reason,
      expiresAt: values.expiresAt,
    });
  };

  const handleUnban = () => {
    executeUnban({ userId });
  };

  const isLoading = isBanning || isUnbanning;

  if (!canBan) {
    return null;
  }

  if (isCurrentlyBanned) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="text-green-600 hover:text-green-700"
          >
            <UserX className="h-4 w-4" />
            Restore Access
          </Button>
        </DialogTrigger>
        <DialogContent
          className={`${dialogStyles.className} max-w-[380px]`}
          style={dialogStyles.style}
          showCloseButton
          transitionFrom="bottom-left"
        >
          <DialogHeader>
            <DialogTitle>Restore Access</DialogTitle>
            <DialogDescription>
              Are you sure you want to restore access for{' '}
              <strong>{userName}</strong>?
            </DialogDescription>
          </DialogHeader>

          {currentBanReason && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Current removal reason:</p>
              <p className="text-sm text-muted-foreground bg-muted p-3 rounded whitespace-pre-wrap break-all">
                {currentBanReason}
              </p>
              {banExpires && (
                <p className="text-sm text-muted-foreground">
                  Removal expires: {format(banExpires, 'PPP')}
                </p>
              )}
            </div>
          )}

          <ResponsiveDialogFooter
            primaryButton={{
              label: 'Restore Access',
              onClick: handleUnban,
              disabled: isLoading,
              loading: isUnbanning,
              loadingLabel: 'Restoring...',
              className: 'bg-green-600 hover:bg-green-700 text-white',
            }}
            secondaryButton={{
              label: 'Cancel',
              onClick: () => setOpen(false),
              disabled: isLoading,
            }}
          />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          className="bg-orange-600 hover:bg-orange-700 text-white"
        >
          <UserX className="h-4 w-4" />
          Remove from the VA
        </Button>
      </DialogTrigger>
      <DialogContent
        className={`${dialogStyles.className} max-w-[380px]`}
        style={dialogStyles.style}
        showCloseButton
        transitionFrom="bottom-left"
      >
        <DialogHeader>
          <DialogTitle>Remove from VA</DialogTitle>
          <DialogDescription>
            Remove <strong>{userName}</strong> from the VA. This will prevent
            them from logging in until access is restored or the removal
            expires.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>Reason (optional)</FormLabel>
                    <span className="text-xs text-muted-foreground">
                      {reasonValue.length} / 500
                    </span>
                  </div>
                  <FormControl>
                    <Textarea
                      placeholder="Add a note about this removal (optional)"
                      className="resize-none"
                      maxLength={500}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="expiresAt"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Removal expires (optional)</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          className={cn(
                            'w-full pl-3 text-left font-normal',
                            !field.value && 'text-muted-foreground'
                          )}
                        >
                          {field.value ? (
                            format(field.value, 'PPP')
                          ) : (
                            <span>Pick a date (leave empty for permanent)</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent
                      align="start"
                      className="w-auto border-0 p-0"
                    >
                      <Calendar
                        mode="single"
                        onSelect={field.onChange}
                        selected={field.value}
                        disabled={(date) => date <= new Date()}
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <ResponsiveDialogFooter
              primaryButton={{
                label: 'Remove from VA',
                disabled: isLoading,
                loading: isBanning,
                loadingLabel: 'Removing...',
                type: 'submit',
                className: 'bg-orange-600 hover:bg-orange-700 text-white',
              }}
              secondaryButton={{
                label: 'Cancel',
                onClick: () => setOpen(false),
                disabled: isLoading,
              }}
            />
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
