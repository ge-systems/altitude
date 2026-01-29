'use client';

import { ChevronDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAction } from 'next-safe-action/hooks';
import { useState } from 'react';
import { toast } from 'sonner';

import { addRoleAction } from '@/actions/users/add-role';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSession } from '@/lib/auth-client';
import {
  ADMIN_ROLE,
  ASSIGNABLE_ROLES,
  type AssignableRole,
  normalizeRoles,
  OWNER_ROLE,
} from '@/lib/roles';

interface AddRoleDropdownProps {
  userId: string;
  currentRoles: string[];
}

export function AddRoleDropdown({
  userId,
  currentRoles,
}: AddRoleDropdownProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const { data: session, refetch } = useSession();

  const sessionRoles = normalizeRoles(
    (session?.user as { role?: string[] | string | null } | undefined)?.role ??
      null
  );
  const isOwner = sessionRoles.includes(OWNER_ROLE);

  const remainingRoles = ASSIGNABLE_ROLES.filter(
    (r) => !currentRoles.includes(r)
  ).filter((role) => (role === ADMIN_ROLE ? isOwner : true));

  const { execute } = useAction(addRoleAction, {
    onSuccess: async ({ data }) => {
      if (data?.success) {
        toast.success(data.message);
        await refetch();
        router.refresh();
      }
      setIsLoading(false);
    },
    onError: ({ error }) => {
      toast.error(error.serverError || 'Failed to add role');
      setIsLoading(false);
    },
  });

  const handleAddRole = (role: AssignableRole) => {
    setIsLoading(true);
    execute({ userId, role });
  };

  if (remainingRoles.length === 0) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="inline-flex items-center px-4 py-2 rounded-lg bg-foreground text-background border border-input hover:bg-foreground/80 transition-colors text-sm font-medium disabled:opacity-50"
          disabled={isLoading}
        >
          Add Role
          <ChevronDown className="ml-2 h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {remainingRoles.map((role) => (
          <DropdownMenuItem
            key={role}
            onClick={() => handleAddRole(role)}
            disabled={isLoading}
          >
            {role.charAt(0).toUpperCase() + role.slice(1)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
