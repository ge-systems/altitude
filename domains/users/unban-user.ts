import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { users } from '@/db/schema';

export async function unbanUser(userId: string) {
  const existingUser = await db
    .select({ id: users.id, banned: users.banned })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (existingUser.length === 0) {
    throw new Error('User not found');
  }

  if (!existingUser[0].banned) {
    throw new Error('User is not removed');
  }

  await db
    .update(users)
    .set({
      banned: false,
      bannedReason: null,
      banExpires: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}
