'use client';

import { Check, Edit2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAction } from 'next-safe-action/hooks';
import React, { useState } from 'react';
import { toast } from 'sonner';

import { editPirepAction } from '@/actions/pireps/edit-pirep';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { formatHoursMinutes } from '@/lib/utils';

interface MultiplierOption {
  id: string;
  name: string;
  value: number;
}

export interface DetailsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  children?: React.ReactNode;
  className?: string;
  pirepId?: string;
  isEditable?: boolean;
  field?:
    | 'cargo'
    | 'fuelBurned'
    | 'passengers'
    | 'flightTime'
    | 'comments'
    | 'multiplier'
    | 'deniedReason';
  multipliers?: MultiplierOption[];
  currentMultiplierId?: string | null;
  currentMultiplierValue?: number;
  icon?: React.ReactNode;
}

export const DetailsCard = ({
  title,
  value,
  subtitle,
  children,
  className = '',
  pirepId,
  isEditable = false,
  field,
  multipliers = [],
  currentMultiplierId = null,
  currentMultiplierValue = 1,
  icon,
}: DetailsCardProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(String(value ?? ''));
  const [isHovering, setIsHovering] = useState(false);
  const [selectedMultiplierId, setSelectedMultiplierId] = useState(
    currentMultiplierId ?? 'none'
  );

  const router = useRouter();

  const { execute, isExecuting } = useAction(editPirepAction, {
    onSuccess: ({ data }) => {
      if (data?.success) {
        toast.success(data.message);
        setIsEditing(false);
        router.refresh();
      }
    },
    onError: ({ error }) => {
      toast.error(error.serverError || 'Failed to update PIREP');
    },
  });

  const isNumericField =
    field &&
    field !== 'comments' &&
    field !== 'multiplier' &&
    field !== 'deniedReason';
  const isFlightTime = field === 'flightTime';
  const isMultiplier = field === 'multiplier';

  const numericFlightTime = typeof value === 'number' ? value : Number(value);

  // Calculate original (base) flight time before multiplier was applied
  const originalFlightTime = isFlightTime
    ? Math.round(numericFlightTime / currentMultiplierValue)
    : numericFlightTime;
  const originalHours =
    isFlightTime && !isNaN(originalFlightTime)
      ? Math.floor(originalFlightTime / 60)
      : 0;
  const originalMinutes =
    isFlightTime && !isNaN(originalFlightTime) ? originalFlightTime % 60 : 0;

  const [hoursValue, setHoursValue] = useState(originalHours.toString());
  const [minutesValue, setMinutesValue] = useState(originalMinutes.toString());

  // Update hours and minutes when value changes or when entering edit mode
  React.useEffect(() => {
    if (isFlightTime) {
      setHoursValue(originalHours.toString());
      setMinutesValue(originalMinutes.toString());
    }
  }, [value, isFlightTime, originalHours, originalMinutes]);

  const handleSave = () => {
    if (!field || !pirepId) {
      return;
    }

    if (isMultiplier) {
      const multiplierId =
        selectedMultiplierId === 'none' ? null : selectedMultiplierId;
      execute({ id: pirepId, multiplierId });
      return;
    }

    if (isFlightTime) {
      const hrs = parseInt(hoursValue, 10);
      const mins = parseInt(minutesValue, 10);
      if (
        isNaN(hrs) ||
        hrs < 0 ||
        hrs > 1000 ||
        isNaN(mins) ||
        mins < 0 ||
        mins > 59
      ) {
        toast.error('Enter valid hours (0-1000) and minutes (0-59)');
        return;
      }
      const originalTotalMinutes = hrs * 60 + mins;
      // Apply current multiplier to get the final flight time
      const finalFlightTime = Math.round(
        originalTotalMinutes * currentMultiplierValue
      );
      execute({ id: pirepId, flightTime: finalFlightTime });
      return;
    }

    if (isNumericField) {
      // Remove commas before parsing
      const num = parseInt(inputValue.replace(/,/g, ''), 10);
      if (isNaN(num) || num < 0) {
        toast.error('Please enter a valid number');
        return;
      }

      const updates: {
        cargo?: number;
        fuelBurned?: number;
        passengers?: number;
      } = {};
      if (field === 'cargo') {
        updates.cargo = num;
      }
      if (field === 'fuelBurned') {
        updates.fuelBurned = num;
      }
      if (field === 'passengers') {
        updates.passengers = num;
      }

      execute({ id: pirepId, ...updates });
    } else if (field === 'deniedReason') {
      execute({ id: pirepId, deniedReason: inputValue });
    } else if (field === 'comments') {
      execute({ id: pirepId, comments: inputValue });
    }
  };

  const handleClose = () => {
    setIsEditing(false);
    if (isMultiplier) {
      setSelectedMultiplierId(currentMultiplierId ?? 'none');
    }
    if (isFlightTime) {
      setHoursValue(originalHours.toString());
      setMinutesValue(originalMinutes.toString());
    }
    if (isNumericField) {
      setInputValue(
        String(
          typeof value === 'number'
            ? value
            : (value?.toString().replace(/,/g, '') ?? '')
        )
      );
    }
    if (field === 'comments') {
      setInputValue(String(value ?? ''));
    }
  };

  const renderedValue =
    isFlightTime && !isNaN(numericFlightTime)
      ? formatHoursMinutes(numericFlightTime)
      : isNumericField && typeof value === 'number'
        ? value.toLocaleString('en-US')
        : value;

  const renderContent = () => {
    if (isEditing && isEditable && pirepId && field) {
      if (isMultiplier) {
        return (
          <div className="space-y-2 mt-1">
            <Select
              value={selectedMultiplierId}
              onValueChange={setSelectedMultiplierId}
            >
              <SelectTrigger className="w-full min-w-0">
                <SelectValue placeholder="Select multiplier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {multipliers.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name} ({m.value}x)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2 justify-end">
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isExecuting}
                className="h-8 w-8 p-0"
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleClose();
                }}
                disabled={isExecuting}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        );
      }

      return (
        <div className="flex items-center gap-2 flex-wrap">
          {isFlightTime ? (
            <>
              <Input
                value={hoursValue}
                onChange={(e) =>
                  setHoursValue(e.target.value.replace(/[^0-9]/g, ''))
                }
                className="w-16 h-8"
                disabled={isExecuting}
                placeholder="0"
              />
              <span className="text-sm text-muted-foreground">h</span>
              <Input
                value={minutesValue}
                onChange={(e) =>
                  setMinutesValue(e.target.value.replace(/[^0-9]/g, ''))
                }
                className="w-14 h-8"
                disabled={isExecuting}
                placeholder="00"
              />
              <span className="text-sm text-muted-foreground">m</span>
              <span className="text-sm text-muted-foreground ml-2">
                (Original time)
              </span>
            </>
          ) : isNumericField ? (
            <Input
              value={inputValue.replace(/,/g, '')}
              onChange={(e) =>
                setInputValue(e.target.value.replace(/[^0-9]/g, ''))
              }
              className="w-40 h-8"
              disabled={isExecuting}
              type="text"
              autoFocus
            />
          ) : (
            <Textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="w-full h-24"
              disabled={isExecuting}
              autoFocus
            />
          )}
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isExecuting}
            className="h-8 w-8 p-0"
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleClose();
            }}
            disabled={isExecuting}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      );
    }

    return (
      <div>
        {field === 'comments' || field === 'deniedReason' ? (
          <div className="space-y-2">
            <p className="font-bold text-foreground text-lg leading-relaxed whitespace-pre-wrap break-words">
              {renderedValue}
            </p>
            {subtitle && (
              <p className="text-muted-foreground text-sm mt-1">{subtitle}</p>
            )}
          </div>
        ) : (
          <>
            <p className="font-bold text-foreground text-2xl">
              {renderedValue}
            </p>
            {subtitle && (
              <p className="text-muted-foreground text-sm mt-1">{subtitle}</p>
            )}
            {isFlightTime && currentMultiplierValue > 1 && (
              <p className="text-muted-foreground text-sm mt-1">
                Original: {formatHoursMinutes(originalFlightTime)} ×{' '}
                {currentMultiplierValue}
              </p>
            )}
          </>
        )}
        {children}
      </div>
    );
  };

  const cardContent = (
    <Card
      className={`rounded-[var(--radius-sm)] border border-input bg-panel shadow-sm flex flex-col gap-4 p-4 h-full ${className}`}
    >
      <CardHeader className="p-0 flex flex-row items-center gap-1">
        {icon && <span className="text-muted-foreground mr-0.5">{icon}</span>}
        <span className="font-medium text-muted-foreground text-sm">
          {title}
        </span>
      </CardHeader>
      <CardContent className="p-0 flex flex-col flex-1 justify-center">
        {renderContent()}
      </CardContent>
    </Card>
  );

  if (isEditable && pirepId && field) {
    return (
      <div
        className="group cursor-pointer relative"
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        onClick={() => setIsEditing(true)}
      >
        {cardContent}
        <Button
          size="sm"
          variant="ghost"
          className={`absolute top-2 right-2 h-6 w-6 p-0 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity ${
            isHovering ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <Edit2 className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return cardContent;
};
