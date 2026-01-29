import type { Metadata } from 'next';

import { AdminPage } from '@/components/admin/admin-page';
import { UsersFilters } from '@/components/users/users-filters';
import { UsersTable } from '@/components/users/users-table';
import { getAirline, getUsersPaginated } from '@/db/queries';
import { requireRole } from '@/lib/auth-check';
import { parsePaginationParams } from '@/lib/pagination';

export function generateMetadata(): Metadata {
  return {
    title: 'Users',
  };
}

interface UsersPageProps {
  searchParams?: Promise<{
    page?: string;
    q?: string;
    inactive?: string;
  }>;
}

export default async function UsersPage({ searchParams }: UsersPageProps) {
  await requireRole(['users']);

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const { page, search, limit } =
    await parsePaginationParams(resolvedSearchParams);
  const hideInactive = resolvedSearchParams.inactive === 'true';

  const [usersResult, airline] = await Promise.all([
    getUsersPaginated(page, limit, search, { hideInactive }),
    getAirline(),
  ]);

  const { users, total } = usersResult;

  return (
    <AdminPage
      title="Users"
      description="Manage your pilots and their account information"
      searchBar={<UsersFilters />}
      createDialog={<></>}
      table={
        airline && (
          <UsersTable
            airline={airline}
            users={users}
            total={total}
            limit={limit}
          />
        )
      }
    />
  );
}
