'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { addRole } from '@/domains/users/add-role';
import { handleDbError } from '@/lib/db-error';
import { ADMIN_ROLE, ASSIGNABLE_ROLES, OWNER_ROLE } from '@/lib/roles';
import { createRoleActionClient } from '@/lib/safe-action';

const addRoleSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  role: z.enum(ASSIGNABLE_ROLES, {
    message: 'Invalid role',
  }),
});

export const addRoleAction = createRoleActionClient(['users'])
  .inputSchema(addRoleSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { userId, role } = parsedInput;

    if (role === ADMIN_ROLE) {
      const callerIsOwner = Array.isArray(ctx.userRoles)
        ? ctx.userRoles.includes(OWNER_ROLE)
        : false;
      if (!callerIsOwner) {
        throw new Error('Only the owner can grant the admin role');
      }
    }

    try {
      const result = await addRole({ userId, role });

      revalidatePath('/admin/users');
      revalidatePath(`/admin/users/${userId}`);

      return {
        success: true,
        message: result.message,
        roles: result.roles,
      };
    } catch (error) {
      handleDbError(error, {
        fallback: 'Failed to add role',
      });
    }
  });
