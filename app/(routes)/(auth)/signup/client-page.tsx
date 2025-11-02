'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Check, Eye, EyeOff, Loader2, UserPlus, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { checkCallsignAvailabilityAction } from '@/actions/users/check-callsign-availability';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { authClient } from '@/lib/auth-client';
import { cn } from '@/lib/utils';
import { discordUsernameRegex } from '@/lib/validation/account';

interface Airline {
  id: string;
  name: string;
  callsign: string;
  setup: boolean;
  lightLogo: string | null;
  darkLogo: string | null;
  pirepsWebhookUrl: string | null;
  newApplicationsWebhookUrl: string | null;
  callsignMinRange: number;
  callsignMaxRange: number;
  createdAt: Date;
  updatedAt: Date;
}

interface SignupPageProps {
  lightLogo: string;
  darkLogo: string;
  airline: Airline | undefined;
  authImageUrl: string | null;
}

type BaseSignupParams = Parameters<typeof authClient.signUp.email>[0];

interface ExtendedSignupParams extends BaseSignupParams {
  callsign: number;
  discordUsername: string;
  discourseUsername?: string;
}

const DEFAULT_CALLSIGN_RANGE = { min: 1, max: 999 } as const;
const CALLSIGN_CHECK_DEBOUNCE_MS = 500;
const PASSWORD_MIN_LENGTH = 8;
const NAME_MAX_LENGTH = 30;
const DISCORD_USERNAME_MAX_LENGTH = 32;
const IFC_USERNAME_MAX_LENGTH = 20;

const createSignupSchema = (
  callsignMinRange: number,
  callsignMaxRange: number
) =>
  z
    .object({
      name: z
        .string()
        .min(1, 'Name is required')
        .max(
          NAME_MAX_LENGTH,
          `Name must be at most ${NAME_MAX_LENGTH} characters`
        )
        .trim(),
      email: z
        .string()
        .trim()
        .max(255, 'Email must be less than 255 characters')
        .pipe(z.email('Invalid email format')),
      password: z
        .string()
        .min(
          PASSWORD_MIN_LENGTH,
          `Password must be at least ${PASSWORD_MIN_LENGTH} characters`
        ),
      confirmPassword: z.string().min(1, 'Please confirm your password'),
      callsignNumber: z
        .string()
        .min(1, 'Callsign number is required')
        .refine((val) => {
          const num = parseInt(val, 10);
          return (
            !isNaN(num) && num >= callsignMinRange && num <= callsignMaxRange
          );
        }, `Callsign number must be between ${callsignMinRange} and ${callsignMaxRange}`),
      discordUsername: z
        .string()
        .min(1, 'Discord username is required')
        .regex(discordUsernameRegex, 'Invalid Discord username format'),
      ifcUsername: z
        .string()
        .min(3, 'IFC username must be at least 3 characters')
        .max(
          IFC_USERNAME_MAX_LENGTH,
          `IFC username must be at most ${IFC_USERNAME_MAX_LENGTH} characters`
        )
        .optional()
        .or(z.literal('')),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: "Passwords don't match",
      path: ['confirmPassword'],
    });

type SignupFormData = z.infer<ReturnType<typeof createSignupSchema>>;

const useCallsignValidation = (callsignNumber: string) => {
  const [isCallsignAvailable, setIsCallsignAvailable] = useState<
    boolean | null
  >(null);
  const [isCheckingCallsign, setIsCheckingCallsign] = useState(false);

  const checkAvailability = useCallback(async (callsign: number) => {
    setIsCheckingCallsign(true);
    try {
      const result = await checkCallsignAvailabilityAction({ callsign });
      setIsCallsignAvailable(result?.data?.available ?? null);
    } catch {
      setIsCallsignAvailable(null);
    } finally {
      setIsCheckingCallsign(false);
    }
  }, []);

  useEffect(() => {
    const numValue = parseInt(callsignNumber?.toString() || '', 10);

    if (!callsignNumber || isNaN(numValue) || numValue <= 0) {
      setIsCallsignAvailable(null);
      setIsCheckingCallsign(false);
      return;
    }

    const debounceTimer = setTimeout(() => {
      checkAvailability(numValue);
    }, CALLSIGN_CHECK_DEBOUNCE_MS);

    return () => clearTimeout(debounceTimer);
  }, [callsignNumber, checkAvailability]);

  return { isCallsignAvailable, isCheckingCallsign };
};

const getCallsignStatus = (
  callsignNumber: string,
  isCheckingCallsign: boolean,
  isCallsignAvailable: boolean | null
) => {
  const numValue = parseInt(callsignNumber?.toString() || '', 10);
  const hasValidNumber = callsignNumber && !isNaN(numValue) && numValue > 0;

  if (!hasValidNumber) {
    return null;
  }
  if (isCheckingCallsign) {
    return 'checking';
  }
  if (isCallsignAvailable === true) {
    return 'available';
  }
  if (isCallsignAvailable === false) {
    return 'unavailable';
  }
  return null;
};

const getButtonText = (
  isSubmitting: boolean,
  isCallsignAvailable: boolean | null
) => {
  if (isSubmitting) {
    return 'Creating Account...';
  }
  if (isCallsignAvailable === false) {
    return 'Callsign Unavailable';
  }
  return 'Create Account';
};

const CallsignStatusIcon = ({ status }: { status: string | null }) => {
  switch (status) {
    case 'checking':
      return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
    case 'available':
      return <Check className="h-4 w-4 text-green-600" />;
    case 'unavailable':
      return <X className="h-4 w-4 text-red-500" />;
    default:
      return null;
  }
};

const PasswordToggleButton = ({
  showPassword,
  onToggle,
  disabled,
}: {
  showPassword: boolean;
  onToggle: () => void;
  disabled: boolean;
}) => (
  <button
    aria-label={showPassword ? 'Hide password' : 'Show password'}
    className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
    disabled={disabled}
    onClick={onToggle}
    type="button"
  >
    {showPassword ? (
      <EyeOff className="h-5 w-5" />
    ) : (
      <Eye className="h-5 w-5" />
    )}
  </button>
);

const CallsignInput = ({
  field,
  airline,
  callsignMinRange,
  callsignMaxRange,
  isLoading,
  callsignStatus,
}: {
  field: {
    value: string;
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    onBlur: () => void;
  };
  airline: Airline | undefined;
  callsignMinRange: number;
  callsignMaxRange: number;
  isLoading: boolean;
  callsignStatus: string | null;
}) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const allowedKeys = [
      'Backspace',
      'Delete',
      'Tab',
      'ArrowLeft',
      'ArrowRight',
      'Home',
      'End',
    ];
    const isNumeric = /[0-9]/.test(e.key);

    if (!isNumeric && !allowedKeys.includes(e.key)) {
      e.preventDefault();
    }
  };

  const handleInput = (e: React.FormEvent<HTMLInputElement>) => {
    const input = e.target as HTMLInputElement;
    const numericValue = input.value.replace(/[^0-9]/g, '');
    const maxLength = callsignMaxRange.toString().length;

    input.value =
      numericValue.length > maxLength
        ? numericValue.slice(0, maxLength)
        : numericValue;
  };

  return (
    <div className="flex relative">
      <div
        className="flex items-center justify-center px-4 py-2 text-sm font-medium border border-input border-r-0 bg-panel text-foreground rounded-l-md"
        style={{ minWidth: 64 }}
      >
        {airline?.callsign || 'N/A'}
      </div>
      <input
        className="flex h-10 w-full border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:font-medium file:text-foreground file:text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm rounded-r-md border-l-0 pr-10"
        disabled={isLoading}
        placeholder={`${callsignMinRange}-${callsignMaxRange}`}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        min={callsignMinRange}
        max={callsignMaxRange}
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        {...field}
      />
      <div className="absolute right-3 top-1/2 -translate-y-1/2">
        <CallsignStatusIcon status={callsignStatus} />
      </div>
    </div>
  );
};

export default function SignupPage({
  lightLogo,
  darkLogo,
  airline,
  authImageUrl,
}: SignupPageProps) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [bgSrc, setBgSrc] = useState<string | null>(authImageUrl);

  // Logos are swapped via CSS (dark mode) like Navbar

  const callsignMinRange =
    airline?.callsignMinRange ?? DEFAULT_CALLSIGN_RANGE.min;
  const callsignMaxRange =
    airline?.callsignMaxRange ?? DEFAULT_CALLSIGN_RANGE.max;
  const signupSchema = useMemo(
    () => createSignupSchema(callsignMinRange, callsignMaxRange),
    [callsignMinRange, callsignMaxRange]
  );

  const form = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    mode: 'onBlur',
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      callsignNumber: '',
      discordUsername: '',
      ifcUsername: '',
    },
  });

  const { watch, formState } = form;
  const callsignNumber = watch('callsignNumber');

  const { isCallsignAvailable, isCheckingCallsign } =
    useCallsignValidation(callsignNumber);

  const callsignStatus = useMemo(
    () =>
      getCallsignStatus(
        callsignNumber,
        isCheckingCallsign,
        isCallsignAvailable
      ),
    [callsignNumber, isCheckingCallsign, isCallsignAvailable]
  );

  const isButtonDisabled = useMemo(() => {
    const { isValid, isDirty, isSubmitting } = formState;
    const callsignBlocked = isCheckingCallsign || isCallsignAvailable === false;

    return !isValid || !isDirty || isSubmitting || callsignBlocked;
  }, [formState, isCheckingCallsign, isCallsignAvailable]);

  const buttonText = useMemo(
    () => getButtonText(formState.isSubmitting, isCallsignAvailable),
    [formState.isSubmitting, isCallsignAvailable]
  );

  const handleSubmit = async (data: SignupFormData) => {
    setErrorMessage('');

    try {
      const signupParams: ExtendedSignupParams = {
        email: data.email,
        password: data.password,
        name: data.name,
        callsign: parseInt(data.callsignNumber.toString(), 10),
        discordUsername: data.discordUsername,
        discourseUsername:
          data.ifcUsername && data.ifcUsername.trim() !== ''
            ? data.ifcUsername
            : undefined,
        callbackURL: '/',
      };

      const { data: authData, error: authError } =
        await authClient.signUp.email(signupParams);

      if (authError) {
        if (authError.status === 403) {
          setErrorMessage(
            'Your account has not been verified yet. Please wait for an admin to verify your account.'
          );
          setIsError(false);
        } else {
          setErrorMessage(authError.message || 'Failed to sign up.');
          setIsError(true);
        }
        return;
      }

      if (authData) {
        router.push('/');
      }
    } catch {
      setErrorMessage('An unexpected error occurred');
    }
  };

  const togglePasswordVisibility = useCallback(() => {
    setShowPassword((prev) => !prev);
  }, []);

  const toggleConfirmPasswordVisibility = useCallback(() => {
    setShowConfirmPassword((prev) => !prev);
  }, []);

  return (
    <>
      {/* Centered layout, also shown on desktop when no auth image */}
      <div
        className={cn(
          'flex min-h-screen items-center justify-center bg-background',
          bgSrc ? 'md:hidden' : 'md:flex'
        )}
      >
        <div className="w-full max-w-md p-8">
          <div className="mb-8">
            <div className="flex items-center justify-center mb-1">
              <img
                src={lightLogo}
                alt="Logo (light)"
                className="h-10 w-10 object-contain block dark:hidden"
              />
              <img
                src={darkLogo}
                alt="Logo (dark)"
                className="h-10 w-10 object-contain hidden dark:block"
              />
            </div>
            <h1 className="mb-4 text-center font-bold text-3xl text-foreground">
              Create Account
            </h1>
          </div>

          {errorMessage &&
            (isError ? (
              <div className="mb-4 text-destructive text-center text-base font-normal">
                {errorMessage}
              </div>
            ) : (
              <Alert className="mb-4 border-success bg-success/10 text-success-foreground">
                <AlertDescription className="text-center">
                  {errorMessage}
                </AlertDescription>
              </Alert>
            ))}

          <Form {...form}>
            <form
              className="space-y-4 mt-4 text-foreground"
              onSubmit={form.handleSubmit(handleSubmit)}
            >
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="block text-sm font-medium text-foreground">
                      Pilot Name
                    </FormLabel>
                    <FormControl>
                      <Input
                        autoComplete="name"
                        disabled={formState.isSubmitting}
                        placeholder="Enter your pilot name"
                        type="text"
                        maxLength={NAME_MAX_LENGTH}
                        {...field}
                      />
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
                    <FormLabel className="block text-sm font-medium text-foreground">
                      Email Address
                    </FormLabel>
                    <FormControl>
                      <Input
                        autoComplete="email"
                        disabled={formState.isSubmitting}
                        placeholder="Enter your email address"
                        type="email"
                        maxLength={255}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="callsignNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="block text-sm font-medium text-foreground">
                      Callsign Number
                    </FormLabel>
                    <FormControl>
                      <CallsignInput
                        field={field}
                        airline={airline}
                        callsignMinRange={callsignMinRange}
                        callsignMaxRange={callsignMaxRange}
                        isLoading={formState.isSubmitting}
                        callsignStatus={callsignStatus}
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
                    <FormLabel className="block text-sm font-medium text-foreground">
                      Discord Username
                    </FormLabel>
                    <FormControl>
                      <Input
                        autoComplete="username"
                        disabled={formState.isSubmitting}
                        placeholder="Enter your Discord username"
                        type="text"
                        maxLength={DISCORD_USERNAME_MAX_LENGTH}
                        {...field}
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
                name="ifcUsername"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="block text-sm font-medium text-foreground">
                      IFC Username (Optional)
                    </FormLabel>
                    <FormControl>
                      <Input
                        disabled={formState.isSubmitting}
                        placeholder="Enter your Infinite Flight Community username"
                        type="text"
                        maxLength={IFC_USERNAME_MAX_LENGTH}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="block text-sm font-medium text-foreground">
                      Password
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          autoComplete="new-password"
                          disabled={formState.isSubmitting}
                          placeholder="Enter your password"
                          type={showPassword ? 'text' : 'password'}
                          {...field}
                        />
                        <PasswordToggleButton
                          showPassword={showPassword}
                          onToggle={togglePasswordVisibility}
                          disabled={formState.isSubmitting}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="block text-sm font-medium text-foreground">
                      Confirm Password
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          autoComplete="new-password"
                          disabled={formState.isSubmitting}
                          placeholder="Confirm your password"
                          type={showConfirmPassword ? 'text' : 'password'}
                          {...field}
                        />
                        <PasswordToggleButton
                          showPassword={showConfirmPassword}
                          onToggle={toggleConfirmPasswordVisibility}
                          disabled={formState.isSubmitting}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                className="w-full"
                disabled={isButtonDisabled}
                type="submit"
              >
                {formState.isSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <UserPlus className="mr-2 h-4 w-4" />
                )}
                {buttonText}
              </Button>
            </form>
          </Form>

          <p className="mt-4 text-center text-muted-foreground text-sm">
            Already have an account?{' '}
            <Link className="text-primary hover:underline" href="/login">
              Sign in
            </Link>
          </p>
        </div>
      </div>

      {/* Desktop layout with background image when available */}
      {bgSrc && (
        <div className="hidden min-h-screen bg-background md:flex">
          {/* Background on the left */}
          <div className="flex-1 md:basis-[61%] lg:basis-[66%] pr-6 sm:pr-10 pl-4 sm:pl-5 pt-4 pb-4 sm:py-5">
            <div className="relative w-full h-full rounded-3xl overflow-hidden">
              <img
                src={bgSrc}
                onError={() => setBgSrc(null)}
                alt="Signup background"
                className="absolute inset-0 w-full h-full object-cover"
              />
            </div>
          </div>

          {/* Form on the right */}
          <div className="flex-1 md:basis-[35%] lg:basis-[30%] text-foreground flex items-center justify-center py-8 pr-16 pl-8">
            <div className="w-full max-w-md">
              <div className="mb-8">
                <div className="flex items-center mb-2">
                  <img
                    src={lightLogo}
                    alt="Logo (light)"
                    className="h-10 w-10 object-contain block dark:hidden"
                  />
                  <img
                    src={darkLogo}
                    alt="Logo (dark)"
                    className="h-10 w-10 object-contain hidden dark:block"
                  />
                </div>
                <h1 className="text-3xl font-bold mb-2">Join the Crew</h1>
                <p className="text-muted-foreground text-sm">
                  Create your account to start logging flights.
                </p>
              </div>

              {errorMessage &&
                (isError ? (
                  <div className="mb-6 p-3 bg-red-500/20 border border-red-500/30 rounded text-red-300 text-sm">
                    {errorMessage}
                  </div>
                ) : (
                  <Alert className="mb-6 border-green-500/30 bg-green-500/20 text-green-300">
                    <AlertDescription className="text-center">
                      {errorMessage}
                    </AlertDescription>
                  </Alert>
                ))}

              {/* Form (duplicate of mobile form) */}
              <Form {...form}>
                <form
                  className="space-y-4"
                  onSubmit={form.handleSubmit(handleSubmit)}
                >
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="block text-sm font-medium text-foreground">
                          Pilot Name
                        </FormLabel>
                        <FormControl>
                          <Input
                            autoComplete="name"
                            disabled={formState.isSubmitting}
                            placeholder="Enter your pilot name"
                            type="text"
                            maxLength={NAME_MAX_LENGTH}
                            {...field}
                          />
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
                        <FormLabel className="block text-sm font-medium text-foreground">
                          Email Address
                        </FormLabel>
                        <FormControl>
                          <Input
                            autoComplete="email"
                            disabled={formState.isSubmitting}
                            placeholder="Enter your email address"
                            type="email"
                            maxLength={255}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="callsignNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="block text-sm font-medium text-foreground">
                          Callsign Number
                        </FormLabel>
                        <FormControl>
                          <CallsignInput
                            field={field}
                            airline={airline}
                            callsignMinRange={callsignMinRange}
                            callsignMaxRange={callsignMaxRange}
                            isLoading={formState.isSubmitting}
                            callsignStatus={callsignStatus}
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
                        <FormLabel className="block text-sm font-medium text-foreground">
                          Discord Username
                        </FormLabel>
                        <FormControl>
                          <Input
                            autoComplete="username"
                            disabled={formState.isSubmitting}
                            placeholder="Enter your Discord username"
                            type="text"
                            maxLength={DISCORD_USERNAME_MAX_LENGTH}
                            {...field}
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
                    name="ifcUsername"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="block text-sm font-medium text-foreground">
                          IFC Username (Optional)
                        </FormLabel>
                        <FormControl>
                          <Input
                            disabled={formState.isSubmitting}
                            placeholder="Enter your Infinite Flight Community username"
                            type="text"
                            maxLength={IFC_USERNAME_MAX_LENGTH}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="block text-sm font-medium text-foreground">
                          Password
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              autoComplete="new-password"
                              disabled={formState.isSubmitting}
                              placeholder="Enter your password"
                              type={showPassword ? 'text' : 'password'}
                              {...field}
                            />
                            <PasswordToggleButton
                              showPassword={showPassword}
                              onToggle={togglePasswordVisibility}
                              disabled={formState.isSubmitting}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="block text-sm font-medium text-foreground">
                          Confirm Password
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              autoComplete="new-password"
                              disabled={formState.isSubmitting}
                              placeholder="Confirm your password"
                              type={showConfirmPassword ? 'text' : 'password'}
                              className="w-full pr-10"
                              {...field}
                            />
                            <PasswordToggleButton
                              showPassword={showConfirmPassword}
                              onToggle={toggleConfirmPasswordVisibility}
                              disabled={formState.isSubmitting}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    className="w-full"
                    disabled={isButtonDisabled}
                    type="submit"
                  >
                    {formState.isSubmitting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <UserPlus className="mr-2 h-4 w-4" />
                    )}
                    {buttonText}
                  </Button>
                </form>
              </Form>

              <div className="mt-6 text-center">
                <span className="text-muted-foreground text-sm">
                  Already have an account?{' '}
                  <Link
                    className="text-primary hover:opacity-90 underline"
                    href="/login"
                  >
                    Sign In
                  </Link>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
