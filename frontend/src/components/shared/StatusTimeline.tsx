import { StatusHistoryResponse, CaseStatus } from '@/types/case';
import { formatDate } from '@/lib/utils';
import { StatusBadge } from './StatusBadge';
import { ArrowRight, History } from 'lucide-react';

interface StatusTimelineProps {
  history: StatusHistoryResponse[];
  currentStatus: CaseStatus;
}

export function StatusTimeline({ history, currentStatus }: StatusTimelineProps) {
  if (!history || history.length === 0) {
    return (
      <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-xs text-slate-500">
        <History className="w-4 h-4 text-slate-400" />
        <span>Current status: <StatusBadge status={currentStatus} /> (No recorded transitions yet)</span>
      </div>
    );
  }

  return (
    <div className="flow-root">
      <ul className="-mb-8">
        {history.map((event, idx) => {
          const isLast = idx === history.length - 1;
          return (
            <li key={event.id || idx}>
              <div className="relative pb-8">
                {!isLast && (
                  <span
                    className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-slate-200 dark:bg-slate-800"
                    aria-hidden="true"
                  />
                )}
                <div className="relative flex items-start space-x-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950/80 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 text-xs font-semibold">
                    {idx + 1}
                  </div>
                  <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <StatusBadge status={event.fromStatus} />
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <StatusBadge status={event.toStatus} />
                      </div>
                      {event.reasonCode && (
                        <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 font-mono">
                          Reason: <span className="font-semibold">{event.reasonCode}</span>
                        </p>
                      )}
                      <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
                        Actor ID: {event.changedByUserId}
                      </p>
                    </div>
                    <div className="text-right text-xs whitespace-nowrap text-slate-500 dark:text-slate-400">
                      <time dateTime={event.changedAt}>{formatDate(event.changedAt)}</time>
                    </div>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
