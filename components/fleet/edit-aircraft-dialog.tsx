'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAction } from 'next-safe-action/hooks';
import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { editAircraftAction } from '@/actions/aircraft/edit-aircraft';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useAircraftData } from '@/hooks/use-aircraft-data';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  ActionErrorResponse,
  extractActionErrorMessage,
} from '@/lib/error-handler';
import { cn, getResponsiveDialogStyles } from '@/lib/utils';

const formSchema = z.object({
  name: z
    .string()
    .min(1, 'Aircraft name is required')
    .max(100, 'Aircraft name must be less than 100 characters'),
  livery: z
    .string()
    .min(1, 'Livery is required')
    .max(100, 'Livery must be less than 100 characters'),
});

type FormData = z.infer<typeof formSchema>;

interface EditAircraftDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  aircraft: {
    id: string;
    name: string;
    livery: string;
  };
}

export default function EditAircraftDialog({
  open,
  onOpenChange,
  aircraft,
}: EditAircraftDialogProps) {
  const router = useRouter();
  const isMobile = useIsMobile();
  const { aircraft: aircraftData, loading: aircraftLoading } =
    useAircraftData();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: aircraft.name,
      livery: aircraft.livery,
    },
  });

  const { execute, isExecuting } = useAction(editAircraftAction, {
    onSuccess: () => {
      toast.success('Aircraft updated successfully');
      onOpenChange(false);
      router.refresh();
    },
    onError: ({ error }) => {
      const errorMessage = extractActionErrorMessage(
        error as ActionErrorResponse
      );
      toast.error(errorMessage);
    },
  });

  const selectedAircraftName = form.watch('name');

  // Get aircraft names and liveries for the selected aircraft
  const aircraftNames = useMemo(
    () => aircraftData.map((a) => a.name).sort(),
    [aircraftData]
  );

  const availableLiveries = useMemo(() => {
    const selectedAircraft = aircraftData.find(
      (a) => a.name === selectedAircraftName
    );
    return selectedAircraft ? selectedAircraft.liveries.sort() : [];
  }, [aircraftData, selectedAircraftName]);

  const onSubmit = (data: FormData) => {
    execute({ id: aircraft.id, ...data });
  };

  useEffect(() => {
    if (open) {
      form.reset({
        name: aircraft.name,
        livery: aircraft.livery,
      });
    }
  }, [aircraft.id, aircraft.livery, aircraft.name, form, open]);

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      form.reset({
        name: aircraft.name,
        livery: aircraft.livery,
      });
    }
    onOpenChange(newOpen);
  };

  const dialogStyles = getResponsiveDialogStyles(
    isMobile,
    'border border-border bg-card shadow-lg',
    'sm:max-w-[425px]',
    'fit'
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(dialogStyles.className, 'max-w-[360px]')}
        style={dialogStyles.style}
        showCloseButton
        onInteractOutside={(e) => {
          if (isExecuting) {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            Edit Aircraft
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-left">
            Update the aircraft details. Select from available aircraft or enter
            custom details.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="w-full">
                  <FormLabel className="text-foreground">
                    Aircraft Name
                  </FormLabel>
                  <Combobox
                    value={field.value}
                    onValueChange={field.onChange}
                    options={aircraftNames}
                    placeholder="Type aircraft name or select from list"
                    loading={aircraftLoading}
                    disabled={isExecuting}
                  />
                  <FormMessage className="text-destructive" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="livery"
              render={({ field }) => (
                <FormItem className="w-full">
                  <FormLabel className="text-foreground">Livery</FormLabel>
                  <Combobox
                    value={field.value}
                    onValueChange={field.onChange}
                    options={availableLiveries.map((livery) => livery.name)}
                    placeholder={
                      selectedAircraftName
                        ? 'Type livery name or select from list'
                        : 'Select aircraft first to see available liveries'
                    }
                    loading={aircraftLoading}
                    disabled={isExecuting}
                  />
                  <FormMessage className="text-destructive" />
                </FormItem>
              )}
            />

            <div
              className={`flex ${isMobile ? 'flex-col space-y-2' : 'justify-end gap-3'} pt-4`}
            >
              {isMobile ? (
                <>
                  <Button
                    className="min-w-[100px] bg-primary text-primary-foreground hover:bg-primary/90 w-full"
                    disabled={isExecuting}
                    type="submit"
                  >
                    {isExecuting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save Changes'
                    )}
                  </Button>
                  <Button
                    className="border border-border bg-background text-foreground hover:bg-muted w-full"
                    disabled={isExecuting}
                    onClick={() => onOpenChange(false)}
                    type="button"
                    variant="outline"
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    className="border border-border bg-background text-foreground hover:bg-muted"
                    disabled={isExecuting}
                    onClick={() => onOpenChange(false)}
                    type="button"
                    variant="outline"
                  >
                    Cancel
                  </Button>
                  <Button
                    className="min-w-[100px] bg-primary text-primary-foreground hover:bg-primary/90"
                    disabled={isExecuting}
                    type="submit"
                  >
                    {isExecuting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save Changes'
                    )}
                  </Button>
                </>
              )}
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
