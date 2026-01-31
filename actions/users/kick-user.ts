'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { kickUser } from '@/domains/users/kick-user';
import { handleDbError } from '@/lib/db-error';
import { createRoleActionClient } from '@/lib/safe-action';

const kickUserSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
});

export const kickUserAction = createRoleActionClient(['users'])
  .inputSchema(kickUserSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { userId } = parsedInput;

    try {
      await kickUser(userId, ctx.userRoles);

      revalidatePath('/admin/users');

      return {
        success: true,
        message: 'Account deleted successfully',
      };
    } catch (error) {
      handleDbError(error, {
        fallback: 'Failed to delete account',
      });
    }
  });
