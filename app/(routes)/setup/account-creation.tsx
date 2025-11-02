'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Loader2, User } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { createAdminAccountAction } from '@/actions/setup/create-admin-account';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { discordUsernameRegex } from '@/lib/validation/account';

const accountCreationSchema = z
  .object({
    name: z.string().min(1, 'Name is required'),
    email: z
      .string()
      .trim()
      .max(255, 'Email must be less than 255 characters')
      .pipe(z.email('Invalid email format')),
    discordUsername: z
      .string()
      .regex(discordUsernameRegex, 'Invalid Discord username format'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

type AccountCreationFormData = z.infer<typeof accountCreationSchema>;

interface AccountCreationProps {
  onNext: () => void;
}

export default function AccountCreation({ onNext }: AccountCreationProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AccountCreationFormData>({
    resolver: zodResolver(accountCreationSchema),
    defaultValues: {
      name: '',
      email: '',
      discordUsername: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (data: AccountCreationFormData) => {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const result = await createAdminAccountAction({
        email: data.email,
        name: data.name,
        discordUsername: data.discordUsername,
        password: data.password,
      });

      if (result?.data?.success) {
        onNext();
      } else {
        const errorMsg =
          result?.data?.message ||
          result?.serverError ||
          'Failed to create admin account';
        setErrorMessage(errorMsg);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'An unexpected error occurred'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="mb-6 text-center">
        <h2 className="font-bold text-2xl text-foreground">
          Create Admin Account
        </h2>
        <p className="mt-2 text-muted-foreground text-sm">
          Set up your administrator account to manage the airline
        </p>
      </div>

      <form
        className="space-y-4 text-foreground"
        onSubmit={handleSubmit(onSubmit)}
      >
        <Input
          autoComplete="name"
          disabled={isLoading}
          id="name"
          placeholder="Pilot Name"
          type="text"
          {...register('name')}
        />
        {errors.name && (
          <p className="text-center text-destructive text-sm">
            {errors.name.message}
          </p>
        )}

        <Input
          autoComplete="email"
          disabled={isLoading}
          id="email"
          placeholder="Email"
          type="email"
          {...register('email')}
        />
        {errors.email && (
          <p className="text-center text-destructive text-sm">
            {errors.email.message}
          </p>
        )}

        <Input
          autoComplete="username"
          disabled={isLoading}
          id="discordUsername"
          placeholder="Discord Username"
          type="text"
          {...register('discordUsername', {
            onChange: (e) => {
              const value = e.target.value.toLowerCase();
              e.target.value = value;
            },
          })}
        />
        {errors.discordUsername && (
          <p className="text-center text-destructive text-sm">
            {errors.discordUsername.message}
          </p>
        )}

        <div className="relative">
          <Input
            autoComplete="new-password"
            disabled={isLoading}
            id="password"
            placeholder="Password"
            type={showPassword ? 'text' : 'password'}
            {...register('password')}
          />
          <button
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="-translate-y-1/2 absolute top-1/2 right-3 text-muted-foreground hover:text-foreground"
            disabled={isLoading}
            onClick={() => setShowPassword((v) => !v)}
            type="button"
          >
            {showPassword ? (
              <EyeOff className="h-5 w-5" />
            ) : (
              <Eye className="h-5 w-5" />
            )}
          </button>
        </div>
        {errors.password && (
          <p className="text-center text-destructive text-sm">
            {errors.password.message}
          </p>
        )}

        <div className="relative">
          <Input
            autoComplete="new-password"
            disabled={isLoading}
            id="confirmPassword"
            placeholder="Confirm Password"
            type={showConfirmPassword ? 'text' : 'password'}
            {...register('confirmPassword')}
          />
          <button
            aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
            className="-translate-y-1/2 absolute top-1/2 right-3 text-muted-foreground hover:text-foreground"
            disabled={isLoading}
            onClick={() => setShowConfirmPassword((v) => !v)}
            type="button"
          >
            {showConfirmPassword ? (
              <EyeOff className="h-5 w-5" />
            ) : (
              <Eye className="h-5 w-5" />
            )}
          </button>
        </div>
        {errors.confirmPassword && (
          <p className="text-center text-destructive text-sm">
            {errors.confirmPassword.message}
          </p>
        )}

        {errorMessage && (
          <p className="text-center text-destructive text-sm">{errorMessage}</p>
        )}

        <Button className="w-full" disabled={isLoading} type="submit">
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <User className="mr-2 h-4 w-4" />
          )}
          {isLoading ? 'Creating Account...' : 'Create Admin Account'}
        </Button>
      </form>
    </div>
  );
}
