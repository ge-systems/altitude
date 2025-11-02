import { eq } from 'drizzle-orm';
import * as readline from 'readline';

import { db } from '@/db';
import { users } from '@/db/schema';
import { auth } from '@/lib/auth';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
}

async function main() {
  console.log('🔐 Password Reset Utility\n');

  const email = await question('Enter user email: ');

  if (!email.trim()) {
    console.error('❌ Email is required');
    rl.close();
    process.exit(1);
  }

  const user = await db
    .select()
    .from(users)
    .where(eq(users.email, email.trim()))
    .get();

  if (!user) {
    console.error(`❌ User not found with email: ${email}`);
    rl.close();
    process.exit(1);
  }

  console.log(`\n✅ Found user: ${user.name} (${user.email})`);

  const newPassword = await question('\nEnter new password: ');

  if (!newPassword.trim()) {
    console.error('❌ Password cannot be empty');
    rl.close();
    process.exit(1);
  }

  const confirmPassword = await question('Confirm new password: ');

  if (newPassword !== confirmPassword) {
    console.error('❌ Passwords do not match');
    rl.close();
    process.exit(1);
  }

  const confirm = await question(
    `\n⚠️  Reset password for ${user.email}? (yes/no): `
  );

  if (confirm.toLowerCase() !== 'yes') {
    console.log('❌ Operation cancelled');
    rl.close();
    process.exit(0);
  }

  try {
    const ctx = await auth.$context;
    const hash = await ctx.password.hash(newPassword);
    await ctx.internalAdapter.updatePassword(user.id, hash);

    console.log('\n✅ Password reset successfully!');
  } catch (error) {
    console.error('❌ Error resetting password:', error);
    rl.close();
    process.exit(1);
  }

  rl.close();
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
