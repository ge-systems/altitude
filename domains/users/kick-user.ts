import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { users } from '@/db/schema';
import { ADMIN_ROLE, OWNER_ROLE, parseRolesField } from '@/lib/roles';

export async function kickUser(userId: string, actorRoles: string[]) {
  const existingUser = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (existingUser.length === 0) {
    throw new Error('User not found');
  }

  const targetRoles = parseRolesField(existingUser[0].role);

  // No one can delete the owner
  if (targetRoles.includes(OWNER_ROLE)) {
    throw new Error("You can't delete the owner");
  }

  // Only the owner can delete admins
  const actorIsOwner = actorRoles.includes(OWNER_ROLE);
  if (targetRoles.includes(ADMIN_ROLE) && !actorIsOwner) {
    throw new Error('Only the owner can delete admins');
  }

  await db.delete(users).where(eq(users.id, userId));
}
