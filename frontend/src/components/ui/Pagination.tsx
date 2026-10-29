import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';

export interface PaginationProps {
  page: number;
  totalPages: number;
  totalElements?: number;
  onPageChange: (newPage: number) => void;
  isLoading?: boolean;
}

export function Pagination({
  page,
  totalPages,
  totalElements,
  onPageChange,
  isLoading = false,
}: PaginationProps) {
  if (totalPages <= 1 && (totalElements === undefined || totalElements <= 0)) {
    return null;
  }

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-slate-100 rounded-b-xl dark:bg-slate-900 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
      <div>
        {totalElements !== undefined ? (
          <span>
            Total: <strong className="font-semibold text-slate-700 dark:text-slate-200">{totalElements}</strong> items
          </span>
        ) : (
          <span>
            Page <strong className="font-semibold text-slate-700 dark:text-slate-200">{page + 1}</strong> of{' '}
            <strong className="font-semibold text-slate-700 dark:text-slate-200">{Math.max(1, totalPages)}</strong>
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span className="hidden sm:inline">
          Page {page + 1} of {Math.max(1, totalPages)}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 0 || isLoading}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages - 1 || isLoading}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
        >
          Next
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
