'use client';

import { useRouter } from 'next/navigation';
import { parseAsString, useQueryState } from 'nuqs';

import { AdminSearchBar } from '@/components/admin/admin-search-bar';
import { Button } from '@/components/ui/button';

export function UsersFilters() {
  const router = useRouter();
  const [inactiveParam, setInactiveParam] = useQueryState(
    'inactive',
    parseAsString
  );
  const hideInactive = inactiveParam === 'true' || inactiveParam === '1';

  const handleToggle = async () => {
    const nextHideInactive = !hideInactive;
    await setInactiveParam(nextHideInactive ? 'true' : null);

    const currentUrl = new URL(window.location.href);
    if (nextHideInactive) {
      currentUrl.searchParams.set('inactive', 'true');
    } else {
      currentUrl.searchParams.delete('inactive');
    }
    currentUrl.searchParams.delete('page');

    router.push(currentUrl.pathname + currentUrl.search);
    router.refresh();
  };

  return (
    <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
      <Button
        variant={hideInactive ? 'secondary' : 'outline'}
        size="sm"
        onClick={handleToggle}
        className="w-full sm:w-auto"
      >
        {hideInactive ? 'Show Inactive' : 'Hide Inactive'}
      </Button>
      <AdminSearchBar placeholder="Search users..." />
    </div>
  );
}
