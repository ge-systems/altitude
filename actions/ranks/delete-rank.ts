'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { deleteRank } from '@/domains/ranks/delete-rank';
import { handleDbError } from '@/lib/db-error';
import { createRoleActionClient } from '@/lib/safe-action';

const deleteRankSchema = z.object({
  id: z.string().min(1, 'Rank ID is required'),
});

const deleteBulkRanksSchema = z.object({
  ids: z.array(z.string()).min(1),
});

export const deleteRankAction = createRoleActionClient(['ranks'])
  .inputSchema(deleteRankSchema)
  .action(async ({ parsedInput: { id } }) => {
    try {
      const deletedRank = await deleteRank(id);

      revalidatePath('/admin/ranks');

      return {
        success: true,
        message: 'Rank deleted successfully',
        deletedRank,
      };
    } catch (error) {
      handleDbError(error, {
        fallback: 'Failed to delete rank',
        constraint:
          'Cannot delete rank - it is being used by users or aircraft',
        reference:
          'Cannot delete rank - it has associated data that must be removed first',
      });
    }
  });

export const deleteBulkRanksAction = createRoleActionClient(['ranks'])
  .inputSchema(deleteBulkRanksSchema)
  .action(async ({ parsedInput: { ids } }) => {
    try {
      await Promise.all(ids.map((id) => deleteRank(id)));

      revalidatePath('/admin/ranks');

      return {
        success: true,
        message: `${ids.length} rank${ids.length === 1 ? '' : 's'} deleted successfully`,
      };
    } catch (error) {
      handleDbError(error, {
        fallback: 'Failed to delete ranks',
        constraint:
          'Cannot delete ranks - they are being used by users or aircraft',
        reference:
          'Cannot delete ranks - they have associated data that must be removed first',
      });
    }
  });
