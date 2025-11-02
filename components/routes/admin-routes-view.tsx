'use client';

import { Map, MoreHorizontal, Plus, Trash, Upload } from 'lucide-react';
import { useAction } from 'next-safe-action/hooks';
import { parseAsInteger, parseAsString, useQueryState } from 'nuqs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import {
  deleteBulkRoutesAction,
  deleteRouteAction,
} from '@/actions/routes/delete-route';
import { fetchRoutesAction } from '@/actions/routes/search-routes';
import { ActiveFilters } from '@/components/routes/active-filters';
import CreateRouteDialog from '@/components/routes/create-route-dialog';
import EditRouteDialog from '@/components/routes/edit-route-dialog';
import ImportRoutesDialog from '@/components/routes/import-routes-dialog';
import type { FilterCondition } from '@/components/routes/route-filters-bar';
import { RouteFiltersBar } from '@/components/routes/route-filters-bar';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DataPagination } from '@/components/ui/data-pagination';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ResponsiveDialogFooter } from '@/components/ui/responsive-dialog-footer';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useResponsiveDialog } from '@/hooks/use-responsive-dialog';
import { formatHoursMinutes } from '@/lib/utils';

interface RouteItem {
  id: string;
  departureIcao: string;
  arrivalIcao: string;
  flightTime: number;
  details?: string | null;
  createdAt: string | Date;
  flightNumbers?: string[];
  aircraftIds?: string[];
}

interface AircraftWithLivery {
  id: string;
  name: string;
  livery?: string;
}

interface AdminRoutesViewProps {
  routes: RouteItem[];
  total: number;
  limit?: number;
  aircraft: AircraftWithLivery[];
  filters: FilterCondition[];
}

function useRouteFilterParams() {
  const [filtersParam, setFiltersParam] = useQueryState(
    'filters',
    parseAsString
  );

  const filters = useMemo(() => {
    if (!filtersParam) {
      return [];
    }
    try {
      return JSON.parse(filtersParam) as FilterCondition[];
    } catch {
      return [];
    }
  }, [filtersParam]);

  const setFilters = useCallback(
    async (newFilters: FilterCondition[]) => {
      if (newFilters.length === 0) {
        await setFiltersParam(null);
      } else {
        await setFiltersParam(JSON.stringify(newFilters));
      }
    },
    [setFiltersParam]
  );

  return { filters, setFilters };
}

export function AdminRoutesView({
  routes,
  total,
  limit = 10,
  aircraft,
}: AdminRoutesViewProps) {
  const [page, setPage] = useQueryState('page', parseAsInteger.withDefault(1));
  const { dialogStyles } = useResponsiveDialog({
    maxWidth: 'sm:max-w-[420px]',
  });

  const { filters: filtersFromParams, setFilters } = useRouteFilterParams();

  const [routesState, setRoutesState] = useState<RouteItem[]>(routes);
  const [totalState, setTotalState] = useState(total);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [editingFilter, setEditingFilter] = useState<FilterCondition | null>(
    null
  );

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [routeToDelete, setRouteToDelete] = useState<RouteItem | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [routeToEdit, setRouteToEdit] = useState<RouteItem | null>(null);
  const [selectedRouteIds, setSelectedRouteIds] = useState<Set<string>>(
    new Set()
  );
  const [isBulkDelete, setIsBulkDelete] = useState(false);

  const totalPages = Math.ceil(totalState / limit);

  const { execute: fetchRoutes, isExecuting } = useAction(fetchRoutesAction, {
    onSuccess: ({ data }) => {
      setRoutesState(data?.routes || []);
      setTotalState(data?.total || 0);
      setIsInitialLoad(false);
    },
  });

  useEffect(() => {
    fetchRoutes({ page, limit, filters: filtersFromParams });
  }, [page, filtersFromParams, fetchRoutes, limit]);

  const handleFiltersChange = async (newFilters: FilterCondition[]) => {
    await Promise.all([setFilters(newFilters), setPage(1)]);
  };

  const handlePageChange = async (newPage: number) => {
    await setPage(newPage);
    // fetch triggered automatically
  };

  const handleEditFilter = (filter: FilterCondition) => {
    setEditingFilter(filter);
  };

  const { execute: deleteRoute, isExecuting: isDeleting } = useAction(
    deleteRouteAction,
    {
      onSuccess: ({ data }) => {
        toast.success(data?.message || 'Route deleted');
        setDeleteDialogOpen(false);
        setRouteToDelete(null);
        setSelectedRouteIds(new Set());
        // Refresh the routes after deletion
        fetchRoutes({ page, limit, filters: filtersFromParams });
      },
      onError: ({ error }) => {
        toast.error(error.serverError || 'Failed to delete route');
      },
    }
  );

  const { execute: deleteBulkRoutes, isExecuting: isBulkDeleting } = useAction(
    deleteBulkRoutesAction,
    {
      onSuccess: ({ data }) => {
        toast.success(data?.message || 'Routes deleted');
        setDeleteDialogOpen(false);
        setSelectedRouteIds(new Set());
        setIsBulkDelete(false);
        // Refresh the routes after deletion
        fetchRoutes({ page, limit, filters: filtersFromParams });
      },
      onError: ({ error }) => {
        toast.error(error.serverError || 'Failed to delete routes');
      },
    }
  );

  useEffect(() => {
    // Fetch routes whenever page changes or filters in URL change
    fetchRoutes({ page, limit, filters: filtersFromParams });
  }, [page, filtersFromParams, fetchRoutes, limit]);

  const handleDeleteClick = (route: RouteItem) => {
    setRouteToDelete(route);
    setIsBulkDelete(false);
    setDeleteDialogOpen(true);
  };

  const handleBulkDeleteClick = () => {
    if (selectedRouteIds.size === 0) {
      return;
    }
    setIsBulkDelete(true);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (isBulkDelete) {
      deleteBulkRoutes({ ids: Array.from(selectedRouteIds) });
    } else if (routeToDelete) {
      deleteRoute({ id: routeToDelete.id });
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRouteIds(new Set(routesState.map((r) => r.id)));
    } else {
      setSelectedRouteIds(new Set());
    }
  };

  const handleSelectRoute = (routeId: string, checked: boolean) => {
    const newSelected = new Set(selectedRouteIds);
    if (checked) {
      newSelected.add(routeId);
    } else {
      newSelected.delete(routeId);
    }
    setSelectedRouteIds(newSelected);
  };

  const allSelected =
    routesState.length > 0 &&
    routesState.every((r) => selectedRouteIds.has(r.id));
  const someSelected = routesState.some((r) => selectedRouteIds.has(r.id));

  const handleEditClick = (route: RouteItem) => {
    setRouteToEdit(route);
    setEditDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1 w-full md:w-auto">
          <h3 className="font-medium text-2xl md:text-3xl text-foreground break-normal">
            Routes
          </h3>
          <p className="text-muted-foreground">
            Create and manage flight routes for your airline&apos;s network
          </p>
        </div>
        <div className="shrink-0">
          <div className="flex items-center gap-2">
            <RouteFiltersBar
              aircraft={aircraft}
              currentFilters={filtersFromParams}
              isExecuting={isExecuting && !isInitialLoad}
              onFiltersChange={handleFiltersChange}
              showFilterButtonOnly={true}
              editingFilter={editingFilter}
              onEditFilter={handleEditFilter}
              onClearEditingFilter={() => setEditingFilter(null)}
            />
            <CreateRouteDialog
              aircraft={
                aircraft as { id: string; name: string; livery: string }[]
              }
              onRouteCreated={() => {
                // Refresh the routes data
                fetchRoutes({ page, limit, filters: filtersFromParams });
              }}
            >
              <Button className="gap-2" size="default">
                <Plus className="h-4 w-4" />
                Add Route
              </Button>
            </CreateRouteDialog>
            <ImportRoutesDialog
              onImported={() => {
                fetchRoutes({ page, limit, filters: filtersFromParams });
              }}
            >
              <Button
                className="gap-1 md:gap-2"
                variant="outline"
                size="default"
                title="Import CSV"
              >
                <Upload className="h-4 w-4" />
                <span className="hidden md:inline">Import CSV</span>
                <span className="inline md:hidden">Import</span>
              </Button>
            </ImportRoutesDialog>
          </div>
        </div>
      </div>

      <ActiveFilters
        aircraft={aircraft}
        currentFilters={filtersFromParams}
        isExecuting={isExecuting && !isInitialLoad}
        onFiltersChange={handleFiltersChange}
        onEditFilter={handleEditFilter}
      />

      {someSelected && (
        <div className="flex flex-col gap-3 rounded-md border border-border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-foreground">
              {selectedRouteIds.size} route
              {selectedRouteIds.size === 1 ? '' : 's'} selected
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="destructive"
              onClick={handleBulkDeleteClick}
              disabled={isDeleting || isBulkDeleting}
              className="flex w-full items-center justify-center gap-2 sm:w-auto"
            >
              <Trash className="h-4 w-4" />
              Delete All
            </Button>
          </div>
        </div>
      )}

      <section className="space-y-4">
        <div className="overflow-hidden rounded-md border border-border bg-panel shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px] bg-muted/50">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={handleSelectAll}
                    disabled={isDeleting || isBulkDeleting}
                  />
                </TableHead>
                <TableHead className="bg-muted/50 font-semibold text-foreground">
                  Flight Numbers
                </TableHead>
                <TableHead className="bg-muted/50 font-semibold text-foreground">
                  Departure
                </TableHead>
                <TableHead className="bg-muted/50 font-semibold text-foreground">
                  Arrival
                </TableHead>
                <TableHead className="bg-muted/50 font-semibold text-foreground">
                  Flight Time
                </TableHead>
                <TableHead className="w-[50px] bg-muted/50" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {routesState.length === 0 ? (
                <TableRow>
                  <TableCell
                    className="px-6 py-12 text-center text-foreground"
                    colSpan={6}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <Map className="h-8 w-8 text-foreground" />
                      <span className="text-foreground">No routes found</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                routesState.map((route) => (
                  <TableRow
                    key={route.id}
                    className="transition-colors hover:bg-muted/30"
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedRouteIds.has(route.id)}
                        onCheckedChange={(checked) =>
                          handleSelectRoute(route.id, checked as boolean)
                        }
                        disabled={isDeleting || isBulkDeleting}
                      />
                    </TableCell>
                    <TableCell className="text-foreground">
                      <div className="flex flex-wrap gap-1">
                        {(() => {
                          const nums = route.flightNumbers || [];
                          const visible = nums.slice(0, 3);
                          return (
                            <>
                              {visible.map((n) => (
                                <span
                                  key={n}
                                  className="rounded px-2 py-0.5 text-xs bg-panel-accent text-panel-accent-foreground dark:bg-nav-hover dark:text-panel-foreground"
                                >
                                  {n}
                                </span>
                              ))}
                              {nums.length > 3 && (
                                <span className="rounded px-2 py-0.5 text-xs bg-panel-accent text-panel-accent-foreground dark:bg-nav-hover dark:text-panel-foreground">
                                  +{nums.length - 3}
                                </span>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium text-foreground uppercase">
                      {route.departureIcao}
                    </TableCell>
                    <TableCell className="font-medium text-foreground uppercase">
                      {route.arrivalIcao}
                    </TableCell>
                    <TableCell className="text-foreground">
                      {formatHoursMinutes(route.flightTime)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button className="h-8 w-8 p-0" variant="ghost">
                            <MoreHorizontal className="h-4 w-4 text-foreground" />
                            <span className="sr-only">Open menu</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleEditClick(route)}
                          >
                            Edit Route
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={isDeleting}
                            onClick={() => handleDeleteClick(route)}
                          >
                            Delete Route
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {totalPages > 1 && (
          <div className="flex justify-end">
            <DataPagination
              page={page}
              totalPages={totalPages}
              totalItems={totalState}
              itemsPerPage={limit}
              itemLabelPlural="routes"
              onPageChange={handlePageChange}
            />
          </div>
        )}
      </section>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent
          className={dialogStyles.className}
          style={dialogStyles.style}
          showCloseButton
          transitionFrom="top-right"
        >
          <DialogHeader>
            <DialogTitle className="text-foreground">
              Delete {isBulkDelete ? 'Routes' : 'Route'}
            </DialogTitle>
            <DialogDescription className="text-foreground">
              {isBulkDelete
                ? `Are you sure you want to delete ${selectedRouteIds.size} route${selectedRouteIds.size === 1 ? '' : 's'}? This action cannot be undone.`
                : 'Are you sure you want to delete this route?'}
            </DialogDescription>
          </DialogHeader>
          <ResponsiveDialogFooter
            primaryButton={{
              label: isDeleting || isBulkDeleting ? 'Deleting...' : 'Delete',
              onClick: confirmDelete,
              disabled: isDeleting || isBulkDeleting,
              loading: isDeleting || isBulkDeleting,
              loadingLabel: 'Deleting...',
              className:
                'bg-destructive text-destructive-foreground hover:bg-destructive/90',
            }}
            secondaryButton={{
              label: 'Cancel',
              onClick: () => setDeleteDialogOpen(false),
              disabled: isDeleting || isBulkDeleting,
            }}
          />
        </DialogContent>
      </Dialog>

      {routeToEdit && (
        <EditRouteDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          route={{
            id: routeToEdit.id,
            departureIcao: routeToEdit.departureIcao,
            arrivalIcao: routeToEdit.arrivalIcao,
            flightTime: routeToEdit.flightTime,
            details: routeToEdit.details || null,
            flightNumbers: routeToEdit.flightNumbers || [],
            aircraftIds: routeToEdit.aircraftIds || [],
          }}
          aircraft={aircraft}
          onSaved={() => {
            // refetch list after save
            fetchRoutes({ page, limit, filters: filtersFromParams });
          }}
        />
      )}
    </div>
  );
}
