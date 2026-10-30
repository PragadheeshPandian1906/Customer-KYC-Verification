import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { Table, Tbody, Td, Th, Thead, Tr } from '@/components/ui/Table';
import { api } from '@/lib/api/client';
import { extractErrorMessage } from '@/lib/api/errors';
import { PageResponse } from '@/types/common';
import { formatDate } from '@/lib/utils';

interface AuditEvent {
  id: string;
  actorUserId: string | null;
  actorRole: string | null;
  eventType: string;
  resourceType: string;
  resourceId: string | null;
  outcome: string;
  createdAt: string;
}

export function AuditEventsPage() {
  const [events, setEvents] = useState<PageResponse<AuditEvent> | null>(null);
  const [draftEventType, setDraftEventType] = useState('');
  const [draftResourceType, setDraftResourceType] = useState('');
  const [eventType, setEventType] = useState('');
  const [resourceType, setResourceType] = useState('');
  const [page, setPage] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.get<PageResponse<AuditEvent>>('/api/v1/admin/audit-events', {
        params: {
          page,
          size: 50,
          eventType: eventType || undefined,
          resourceType: resourceType || undefined,
        },
      });
      setEvents(result);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [eventType, page, resourceType]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const applyFilters = (event: FormEvent) => {
    event.preventDefault();
    setEventType(draftEventType.trim());
    setResourceType(draftResourceType.trim());
    setPage(0);
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Audit events</h1>
        <p className="mt-1 text-sm text-slate-500">Read-only system activity records. Sensitive correlation data is not displayed.</p>
      </header>

      <form onSubmit={applyFilters} className="grid gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-800 sm:grid-cols-3">
        <Input label="Event type" value={draftEventType} onChange={(event) => setDraftEventType(event.target.value)} />
        <Input label="Resource type" value={draftResourceType} onChange={(event) => setDraftResourceType(event.target.value)} />
        <div className="flex items-end">
          <Button type="submit" size="sm">Apply filters</Button>
        </div>
      </form>

      {error && (
        <Alert variant="error" title="Unable to load audit events">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>{error}</span>
            <Button size="sm" variant="outline" onClick={() => void loadEvents()}>Retry</Button>
          </div>
        </Alert>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner label="Loading audit events..." /></div>
      ) : events && events.content.length > 0 ? (
        <>
          <Table>
            <Thead>
              <Tr><Th>Time</Th><Th>Event</Th><Th>Actor</Th><Th>Resource</Th><Th>Outcome</Th></Tr>
            </Thead>
            <Tbody>
              {events.content.map((event) => (
                <Tr key={event.id}>
                  <Td className="whitespace-nowrap text-xs">{formatDate(event.createdAt)}</Td>
                  <Td className="font-mono text-xs">{event.eventType}</Td>
                  <Td className="text-xs">{event.actorRole || 'System'}{event.actorUserId ? ` · ${event.actorUserId}` : ''}</Td>
                  <Td className="text-xs">{event.resourceType}{event.resourceId ? ` · ${event.resourceId}` : ''}</Td>
                  <Td className="text-xs">{event.outcome}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{events.totalElements} total audit events</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={events.first} onClick={() => setPage((value) => value - 1)}>Previous</Button>
              <span className="self-center">Page {events.page + 1} of {Math.max(events.totalPages, 1)}</span>
              <Button size="sm" variant="outline" disabled={events.last} onClick={() => setPage((value) => value + 1)}>Next</Button>
            </div>
          </div>
        </>
      ) : (
        <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">No audit events match the current filters.</p>
      )}
    </div>
  );
}
