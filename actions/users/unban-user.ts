'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { unbanUser } from '@/domains/users/unban-user';
import { handleDbError } from '@/lib/db-error';
import { createRoleActionClient } from '@/lib/safe-action';

const unbanUserSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
});

export const unbanUserAction = createRoleActionClient(['users'])
  .inputSchema(unbanUserSchema)
  .action(async ({ parsedInput }) => {
    const { userId } = parsedInput;

    try {
      await unbanUser(userId);

      revalidatePath('/admin/users');
      revalidatePath(`/admin/users/${userId}`);

      return {
        success: true,
        message: 'User access restored successfully',
      };
    } catch (error) {
      handleDbError(error, {
        fallback: 'Failed to restore access',
      });
    }
  });
