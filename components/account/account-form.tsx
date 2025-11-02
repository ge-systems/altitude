'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { HelpCircle } from 'lucide-react';
import { useAction } from 'next-safe-action/hooks';
import type { Resolver } from 'react-hook-form';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { updateAccountAction } from '@/actions/account/update-account';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useSession } from '@/lib/auth-client';
import { formatFullCallsign } from '@/lib/utils';
import { discordUsernameRegex } from '@/lib/validation/account';

import { DangerZone } from './danger-zone';
import { PasswordForm } from './password-form';

const emptyStringToUndefined = (val: unknown) =>
  typeof val === 'string' && val.trim() === '' ? undefined : val;

const emptyStringToNull = (val: unknown) =>
  typeof val === 'string' && val.trim() === '' ? null : val;

const formSchema = z.object({
  name: z
    .preprocess(
      emptyStringToUndefined,
      z
        .string()
        .min(1, 'Name is required')
        .max(20, 'Name must be at most 20 characters')
    )
    .optional(),
  email: z
    .preprocess(
      emptyStringToUndefined,
      z
        .string()
        .trim()
        .max(255, 'Email must be less than 255 characters')
        .email('Invalid email format')
    )
    .optional(),
  discordUsername: z
    .preprocess(
      emptyStringToNull,
      z
        .string()
        .refine(
          (val) => discordUsernameRegex.test(val),
          'Invalid Discord username format'
        )
        .nullable()
    )
    .optional(),
  discourseUsername: z
    .preprocess(
      emptyStringToNull,
      z
        .string()
        .min(3, 'Discourse username must be at least 3 characters')
        .max(20, 'Discourse username must be at most 20 characters')
        .nullable()
    )
    .optional(),
});

interface AccountFormProps {
  user: {
    id: string;
    name: string;
    email: string;
    callsign?: number | null;
    discordUsername?: string;
    discourseUsername?: string;
    infiniteFlightId?: string;
  };
  airlineCallsign?: string;
}

export function AccountForm({ user, airlineCallsign }: AccountFormProps) {
  const { refetch } = useSession();

  const { execute, isExecuting } = useAction(updateAccountAction, {
    onSuccess: async ({ data }) => {
      if (data?.success) {
        toast.success(data.message);
        await refetch();
      } else {
        toast.error(data?.error || 'Failed to update account');
      }
    },
    onError: ({ error }) => {
      toast.error(error.serverError || 'Failed to update account');
    },
  });

  type FormValues = z.infer<typeof formSchema>;
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as Resolver<FormValues>,
    defaultValues: {
      name: user.name,
      email: user.email,
      discordUsername: user.discordUsername || '',
      discourseUsername: user.discourseUsername || '',
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    const payload: Record<string, unknown> = {};

    const normalize = (v: unknown) => (typeof v === 'string' ? v.trim() : v);

    const currentDiscord = (user.discordUsername || '').toLowerCase();
    const nextDiscord = (
      normalize(values.discordUsername) as string | null | undefined
    )
      ?.toString()
      ?.toLowerCase();

    if (values.name !== undefined && normalize(values.name) !== user.name) {
      payload.name = normalize(values.name);
    }
    if (values.email !== undefined && normalize(values.email) !== user.email) {
      payload.email = normalize(values.email);
    }
    if (values.discordUsername !== undefined) {
      if (nextDiscord !== currentDiscord) {
        payload.discordUsername = normalize(values.discordUsername);
      }
    }
    if (values.discourseUsername !== undefined) {
      const currentDiscourse = user.discourseUsername || undefined;
      const nextDiscourse = normalize(values.discourseUsername) as
        | string
        | null
        | undefined;
      if (nextDiscourse !== currentDiscourse) {
        payload.discourseUsername = nextDiscourse;
      }
    }

    execute(payload as z.infer<typeof formSchema>);
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Changes may take a few minutes to update across the system. Due to
        caching, you might not see the changes immediately, please wait for a
        few minutes and refresh the page.
      </p>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormItem>
            <FormLabel>Callsign</FormLabel>
            <FormControl>
              {(() => {
                const hasNumeric = user.callsign !== null;
                let value = '';
                if (hasNumeric && airlineCallsign) {
                  try {
                    value = formatFullCallsign(
                      airlineCallsign,
                      user.callsign as number
                    );
                  } catch {
                    value = String(user.callsign);
                  }
                } else if (hasNumeric) {
                  value = String(user.callsign);
                }
                return (
                  <Input
                    value={value}
                    placeholder="Not assigned"
                    disabled
                    readOnly
                  />
                );
              })()}
            </FormControl>
            <FormMessage />
          </FormItem>

          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input placeholder="Enter your name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Enter your email"
                    type="email"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="discordUsername"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Discord Username</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Enter your Discord username"
                    {...field}
                    value={(field.value as string | null | undefined) ?? ''}
                    onChange={(e) => {
                      const value = e.target.value.toLowerCase();
                      field.onChange(value);
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="discourseUsername"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center gap-2">
                  <FormLabel>Discourse Username</FormLabel>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Your username on the Infinite Flight Community</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <FormControl>
                  <Input
                    placeholder="Enter your Discourse username"
                    {...field}
                    value={(field.value as string | null | undefined) ?? ''}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" disabled={isExecuting}>
            {isExecuting ? 'Saving...' : 'Save Changes'}
          </Button>
        </form>
      </Form>
      <PasswordForm />
      <DangerZone userName={user.name} />
    </div>
  );
}
