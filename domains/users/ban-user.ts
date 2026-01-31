import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { users } from '@/db/schema';
import { ADMIN_ROLE, OWNER_ROLE, parseRolesField } from '@/lib/roles';

export async function banUser(
  userId: string,
  reason: string | null,
  expiresAt: Date | undefined,
  actorRoles: string[]
) {
  const existingUser = await db
    .select({ id: users.id, banned: users.banned, role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (existingUser.length === 0) {
    throw new Error('User not found');
  }

  if (existingUser[0].banned) {
    throw new Error('User is already removed');
  }

  const targetRoles = parseRolesField(existingUser[0].role);

  // No one can ban the owner
  if (targetRoles.includes(OWNER_ROLE)) {
    throw new Error("You can't remove the owner");
  }

  // Only the owner can ban admins
  const actorIsOwner = actorRoles.includes(OWNER_ROLE);
  if (targetRoles.includes(ADMIN_ROLE) && !actorIsOwner) {
    throw new Error('Only the owner can remove admins');
  }

  await db
    .update(users)
    .set({
      banned: true,
      bannedReason: reason,
      banExpires: expiresAt,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}
