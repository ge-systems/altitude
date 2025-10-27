import type { BetterAuthOptions, User } from 'better-auth';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError } from 'better-auth/api';
import { customSession } from 'better-auth/plugins';
import { admin } from 'better-auth/plugins/admin';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import {
  accounts,
  airline,
  sessions,
  type User as DbUser,
  users,
  verifications,
} from '@/db/schema';
import { sendPasswordResetEmail } from '@/lib/email-utils';
import { ADMIN_ROLE, OWNER_ROLE } from '@/lib/roles';
import { sendApplicationWebhook } from '@/lib/webhooks/applications';

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'sqlite',
    schema: { users, sessions, accounts, verifications },
    usePlural: true,
  }),
  secret: process.env.BETTER_AUTH_SECRET,
  user: {
    additionalFields: {
      callsign: {
        type: 'number',
        required: true,
        input: true,
      },
      discordUsername: {
        type: 'string',
        required: true,
        input: true,
      },
      discourseUsername: {
        type: 'string',
        required: false,
        input: true,
      },
    },
    deleteUser: {
      enabled: true,
      beforeDelete: async (user: User) => {
        // Prevent deletion of accounts that have the "owner" or "admin" roles.
        const dbUser = user as User & { role?: string | string[] | null };

        const hasProtectedRole = Array.isArray(dbUser.role)
          ? dbUser.role?.includes?.(OWNER_ROLE) ||
            dbUser.role?.includes?.(ADMIN_ROLE)
          : dbUser.role === OWNER_ROLE || dbUser.role === ADMIN_ROLE;

        if (hasProtectedRole) {
          throw new APIError('BAD_REQUEST', {
            message: "Owner and admin accounts can't be deleted",
          });
        }
      },
    },
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 300, // 5 minutes
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    sendResetPassword: async (data) => {
      const { user, url } = data;

      await sendPasswordResetEmail(user.email, user.name, url);
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const dbUser = user as unknown as DbUser;

          if (dbUser.discordUsername) {
            const discordRegex =
              /^(?=.{2,32}$)(?!.*[._]{2})(?!.*[_.]{2})(?!.*[_.]$)(?!^[_.])[a-z0-9._]+$/;
            if (!discordRegex.test(dbUser.discordUsername)) {
              throw new APIError('BAD_REQUEST', {
                message: 'Invalid Discord username format',
              });
            }
          }

          if (dbUser.discourseUsername) {
            const existingUser = await db
              .select()
              .from(users)
              .where(eq(users.discourseUsername, dbUser.discourseUsername))
              .get();

            if (existingUser) {
              throw new APIError('BAD_REQUEST', {
                message: 'This IFC username is already registered',
              });
            }
          }

          // Enforce pilot callsign range at signup (staff roles are not present yet)
          if (typeof dbUser.callsign === 'number') {
            const airlineData = await db
              .select({
                min: airline.callsignMinRange,
                max: airline.callsignMaxRange,
              })
              .from(airline)
              .get();

            const min = airlineData?.min ?? null;
            const max = airlineData?.max ?? null;

            if (
              min !== null &&
              max !== null &&
              (dbUser.callsign < min || dbUser.callsign > max)
            ) {
              throw new APIError('BAD_REQUEST', {
                message: `Callsign must be between ${min} and ${max}`,
              });
            }
          }
        },
        after: async (user) => {
          try {
            const airlineData = await db
              .select({
                name: airline.name,
                callsign: airline.callsign,
                newApplicationsWebhookUrl: airline.newApplicationsWebhookUrl,
              })
              .from(airline)
              .get();

            if (airlineData?.newApplicationsWebhookUrl) {
              const dbUser = user as unknown as DbUser;
              await sendApplicationWebhook(
                airlineData.newApplicationsWebhookUrl,
                {
                  userId: user.id,
                  email: user.email,
                  name: user.name,
                  callsign: dbUser.callsign || undefined,
                  discordUsername: dbUser.discordUsername,
                  submittedAt: new Date(),
                },
                {
                  airlineName: airlineData.name,
                  airlineCallsign: airlineData.callsign,
                  baseUrl: process.env.BETTER_AUTH_URL,
                }
              );
            }
          } catch {
            // Log error but don't fail the signup process
          }
        },
      },
    },
  },
  plugins: [
    admin(),
    customSession(async ({ user, session }) => {
      const userData = await db
        .select({
          verified: users.verified,
          role: users.role,
          discordUsername: users.discordUsername,
          discourseUsername: users.discourseUsername,
          infiniteFlightId: users.infiniteFlightId,
          banned: users.banned,
          bannedReason: users.bannedReason,
          banExpires: users.banExpires,
        })
        .from(users)
        .where(eq(users.id, user.id))
        .get();

      return {
        user: {
          ...user,
          verified: userData?.verified,
          role: userData?.role || null,
          discordUsername: userData?.discordUsername || null,
          discourseUsername: userData?.discourseUsername || null,
          infiniteFlightId: userData?.infiniteFlightId || null,
          banned: userData?.banned || false,
          bannedReason: userData?.bannedReason || null,
          banExpires: userData?.banExpires || null,
        },
        session,
      };
    }),
  ],
} satisfies BetterAuthOptions);
