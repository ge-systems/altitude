'use client';

import { CheckCircle, User as UserIcon, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAction } from 'next-safe-action/hooks';
import { parseAsInteger, useQueryState } from 'nuqs';
import { useState } from 'react';
import { toast } from 'sonner';

import { verifyUserAction } from '@/actions/users/verify-user';
import { denyApplicationAction } from '@/actions/users/deny-application';
import { Button } from '@/components/ui/button';
import { DataPagination } from '@/components/ui/data-pagination';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { UserAvatar } from '@/components/ui/user-avatar';
import { Airline, User } from '@/db/schema';

interface ApplicationsTableProps {
  airline: Airline;
  users: User[];
  total: number;
  limit?: number;
}

export function ApplicationsTable({
  airline,
  users,
  total,
  limit = 10,
}: ApplicationsTableProps) {
  const router = useRouter();
  const [page, setPage] = useQueryState('page', parseAsInteger.withDefault(1));
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const totalPages = Math.ceil(total / limit);

  const { execute: executeVerify } = useAction(verifyUserAction, {
    onSuccess: ({ data }) => {
      if (data?.success) {
        toast.success(data.message);
        router.refresh();
      }
      setIsLoading(null);
    },
    onError: ({ error }) => {
      toast.error(error.serverError || 'Failed to verify user');
      setIsLoading(null);
    },
  });

  const { execute: executeDeny } = useAction(denyApplicationAction, {
    onSuccess: ({ data }) => {
      if (data?.success) {
        toast.success(data.message);
        router.refresh();
      }
      setIsLoading(null);
    },
    onError: ({ error }) => {
      toast.error(error.serverError || 'Failed to deny application');
      setIsLoading(null);
    },
  });

  const handlePageChange = async (newPage: number) => {
    await setPage(newPage);
    router.refresh();
  };

  function getFullCallsign(user: User) {
    if (!user.callsign) {
      return '-';
    }
    const airlinePrefix = airline?.callsign || airline?.name || '';
    return airlinePrefix ? `${airlinePrefix}${user.callsign}` : user.callsign;
  }

  const handleVerify = (userId: string) => {
    setIsLoading(userId);
    executeVerify({ id: userId });
  };

  const handleDeny = (userId: string) => {
    setIsLoading(userId);
    executeDeny({ userId });
  };

  return (
    <>
      <div className="overflow-hidden rounded-md border border-border bg-panel shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="bg-muted/50 font-semibold text-foreground">
                Name
              </TableHead>
              <TableHead className="bg-muted/50 font-semibold text-foreground">
                Callsign
              </TableHead>
              <TableHead className="bg-muted/50 font-semibold text-foreground">
                Email
              </TableHead>
              <TableHead className="bg-muted/50 font-semibold text-foreground">
                Joined
              </TableHead>
              <TableHead className="w-[50px] bg-muted/50" />
              <TableHead className="w-[50px] bg-muted/50" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell
                  className="px-6 py-12 text-center text-foreground"
                  colSpan={6}
                >
                  <div className="flex flex-col items-center gap-2">
                    <UserIcon className="h-6 w-6 text-muted-foreground" />
                    <p>No applications found</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow
                  key={user.id}
                  className="transition-colors hover:bg-muted/30"
                >
                  <TableCell className="font-medium text-foreground">
                    <div className="flex items-center gap-3">
                      <UserAvatar
                        user={{
                          id: user.id,
                          name: user.name,
                          email: user.email,
                          image: user.image,
                        }}
                        className="h-8 w-8 flex-shrink-0"
                      />
                      <span>{user.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-foreground">
                    {getFullCallsign(user)}
                  </TableCell>
                  <TableCell className="font-medium text-foreground">
                    {user.email}
                  </TableCell>
                  <TableCell className="text-foreground">
                    {new Date(user.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button size="sm" asChild>
                        <Link href={`/admin/users/${user.id}`}>View</Link>
                      </Button>
                      <Button
                        size="sm"
                        variant="accept"
                        onClick={() => handleVerify(user.id)}
                        disabled={isLoading === user.id}
                      >
                        <CheckCircle className="h-4 w-4" />
                        {isLoading === user.id ? 'Accepting...' : 'Accept'}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeny(user.id)}
                        disabled={isLoading === user.id}
                      >
                        <XCircle className="h-4 w-4" />
                        {isLoading === user.id ? 'Denying...' : 'Deny'}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <DataPagination
          page={page}
          totalPages={totalPages}
          totalItems={total}
          itemsPerPage={limit}
          itemLabelPlural="applications"
          onPageChange={handlePageChange}
          className="mt-4"
        />
      )}
    </>
  );
}
