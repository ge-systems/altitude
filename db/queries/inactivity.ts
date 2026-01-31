import { and, eq, sql } from 'drizzle-orm';

import { db } from '@/db';
import { airline, leaveRequests, pireps, type User, users } from '@/db/schema';

type InactiveUserOutput = Pick<
  User,
  'id' | 'name' | 'callsign' | 'image' | 'email'
> & {
  lastFlight: number | null;
};

/**
 * Get the current time and calculated inactivity cutoff time (seconds)
 * Note: SQLite stores timestamps in seconds, not milliseconds
 */
async function getInactivityTimeframe() {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const airlineData = await db
    .select({ inactivityPeriod: airline.inactivityPeriod })
    .from(airline)
    .limit(1);
  const inactivityPeriod = airlineData[0]?.inactivityPeriod || 30;
  const cutoffSeconds = nowSeconds - inactivityPeriod * 24 * 60 * 60;

  return { nowSeconds, cutoffSeconds };
}

function createLastFlightSubquery() {
  return db
    .select({
      userId: pireps.userId,
      // Last time they submitted a PIREP (any status)
      lastFlight: sql<number>`MAX(${pireps.date})`.as('lastFlight'),
    })
    .from(pireps)
    .groupBy(pireps.userId)
    .as('lf');
}

/**
 * Create inactivity where condition
 *
 * A user is considered inactive if:
 * 1. They are verified (only check verified pilots)
 * 2. They are NOT banned
 * 3. Their last activity (last flight OR join date if no flights) is older than the cutoff
 * 4. They are NOT on an active approved leave
 */
function createInactiveUsersCondition(
  nowSeconds: number,
  cutoffSeconds: number
) {
  return sql<boolean>`
    ${users.verified} = 1
    AND ${users.banned} = 0
    AND COALESCE(
      (SELECT MAX(p_last.date) FROM ${pireps} p_last WHERE p_last.user_id = ${users.id}),
      ${users.createdAt}
    ) < ${cutoffSeconds}
    AND NOT EXISTS (
      SELECT 1 FROM ${leaveRequests} lr
      WHERE lr.user_id = ${users.id}
        AND lr.status = 'approved'
        AND lr.start_date <= ${nowSeconds}
        AND lr.end_date >= ${nowSeconds}
    )
  `;
}

/**
 * Retrieves a paginated list of "inactive" users
 * A user is considered inactive if they meet ALL of the following criteria:
 *
 * 1. **No Recent Approved Flights:** They have NOT logged an 'approved' flight within the configured inactivity period
 *    (This means their last approved flight date, if any, is more than the configured days ago, or they have no approved flights at all)
 * AND
 * 2. **No Active Approved Leave:** They do NOT currently have an 'approved' leave request that is active
 *    (An active leave request is one where the current date falls between or on its start and end dates)
 *
 * In simpler terms: A user is deemed inactive if they haven't flown recently *and* are not currently on an approved leave
 * If a user hasn't flown but IS on an approved leave, they are considered "active" due to their leave status
 */
async function getInactiveUsersPaginated(
  page: number,
  limit: number,
  search?: string
): Promise<{ users: InactiveUserOutput[]; total: number }> {
  const offset = (page - 1) * limit;
  const { nowSeconds, cutoffSeconds } = await getInactivityTimeframe();

  const searchCondition = search
    ? sql<boolean>`(
        ${users.name} LIKE ${`%${search}%`} COLLATE NOCASE 
        OR (${airline.callsign} || CAST(${users.callsign} AS TEXT)) LIKE ${`%${search}%`} COLLATE NOCASE
      )`
    : sql<boolean>`1 = 1`;

  const lastFlightSubquery = createLastFlightSubquery();
  const inactiveCondition = createInactiveUsersCondition(
    nowSeconds,
    cutoffSeconds
  );

  const result = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      callsign: users.callsign,
      image: users.image,
      lastFlight: lastFlightSubquery.lastFlight,
      totalCount: sql<number>`COUNT(*) OVER()`.as('totalCount'),
    })
    .from(users)
    .leftJoin(lastFlightSubquery, eq(users.id, lastFlightSubquery.userId))
    .innerJoin(airline, sql`1 = 1`)
    .where(and(searchCondition, inactiveCondition))
    .orderBy(
      sql`COALESCE(${lastFlightSubquery.lastFlight}, 0) DESC`,
      users.name
    )
    .limit(limit)
    .offset(offset);

  return {
    users: result.map(({ ...user }) => user) as InactiveUserOutput[],
    total: result[0]?.totalCount ?? 0,
  };
}

/**
 * Used for cron jobs, no pagination
 */
async function getAllInactiveUsers(): Promise<InactiveUserOutput[]> {
  const { nowSeconds, cutoffSeconds } = await getInactivityTimeframe();
  const lastFlightSubquery = createLastFlightSubquery();
  const inactiveCondition = createInactiveUsersCondition(
    nowSeconds,
    cutoffSeconds
  );

  const result = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      callsign: users.callsign,
      image: users.image,
      lastFlight: lastFlightSubquery.lastFlight,
    })
    .from(users)
    .leftJoin(lastFlightSubquery, eq(users.id, lastFlightSubquery.userId))
    .innerJoin(airline, sql`1 = 1`)
    .where(inactiveCondition)
    .orderBy(
      sql`COALESCE(${lastFlightSubquery.lastFlight}, 0) DESC`,
      users.name
    );

  return result as InactiveUserOutput[];
}

export {
  createInactiveUsersCondition,
  createLastFlightSubquery,
  getAllInactiveUsers,
  getInactiveUsersPaginated,
  getInactivityTimeframe,
};
