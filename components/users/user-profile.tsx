import { Check } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { InlineUsernameEditor } from '@/components/users/inline-username-editor';
import { userAvatarUrl } from '@/lib/urls';
import { cn } from '@/lib/utils';

interface UserProfileProps {
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
    verified: boolean;
    role: unknown;
    discordUsername?: string | null;
    discourseUsername?: string | null;
  };
  canManageRoles: boolean;
  rankName?: string | null;
}

export function UserProfile({
  user,
  canManageRoles,
  rankName,
}: UserProfileProps) {
  return (
    <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-4 p-1">
      <Avatar className="size-20 sm:size-20 flex-shrink-0">
        {user.image && userAvatarUrl(user.image) && (
          <AvatarImage src={userAvatarUrl(user.image)!} alt={user.name || ''} />
        )}
        <AvatarFallback className="text-2xl">
          {(user.name || 'U')[0]}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0 text-center sm:text-left">
        <div className="space-y-1 sm:space-y-0">
          <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
            <InlineUsernameEditor
              userId={user.id}
              currentName={user.name}
              disabled={!canManageRoles}
              textClassName="text-xl sm:text-2xl md:text-3xl font-semibold leading-tight break-words"
            />
            {user.verified && (
              <span
                className={cn(
                  'inline-flex items-center justify-center rounded-full',
                  'w-5 h-5 sm:w-6 sm:h-6',
                  'shadow-sm',
                  'flex-shrink-0'
                )}
                title="Verified"
                aria-label="Verified"
                style={{
                  backgroundColor: '#0f4c23',
                  color: 'white',
                }}
              >
                <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5" strokeWidth={3} />
              </span>
            )}
          </div>
          <div className="flex flex-col items-center sm:items-start justify-center sm:justify-start gap-1 w-full max-w-full">
            <p className="text-sm sm:text-base text-muted-foreground break-all text-center sm:text-left">
              {user.email}
            </p>
            {user.discourseUsername && (
              <p className="text-sm sm:text-base text-muted-foreground text-center sm:text-left">
                IFC: {user.discourseUsername}
              </p>
            )}
            {typeof rankName === 'string' && rankName.length > 0 ? (
              <span className="rounded px-2 py-0.5 text-xs bg-panel-accent text-panel-accent-foreground dark:bg-nav-hover dark:text-panel-foreground">
                {rankName}
              </span>
            ) : (
              <span className="rounded px-2 py-0.5 text-xs bg-panel-accent text-panel-accent-foreground dark:bg-nav-hover dark:text-panel-foreground">
                N/A
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
