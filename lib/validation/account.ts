import { z } from 'zod';

export const discordUsernameRegex = /^(?=.{2,32}$)(?!.*\.\.)[a-z0-9._]+$/;

export const emptyStringToUndefined = (val: unknown) =>
  typeof val === 'string' && val.trim() === '' ? undefined : val;

export const emptyStringToNull = (val: unknown) =>
  typeof val === 'string' && val.trim() === '' ? null : val;

export const accountUpdateSchema = z
  .object({
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
  })
  .partial();

export type AccountUpdateInput = z.infer<typeof accountUpdateSchema>;
