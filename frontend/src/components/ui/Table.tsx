import React from 'react';
import { cn } from '@/lib/utils';

export function Table({ className, children, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-800">
      <table className={cn('w-full text-left text-sm border-collapse', className)} {...props}>
        {children}
      </table>
    </div>
  );
}

export function Thead({ className, children, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead className={cn('bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200 dark:bg-slate-900/80 dark:text-slate-400 dark:border-slate-800', className)} {...props}>
      {children}
    </thead>
  );
}

export function Tbody({ className, children, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={cn('divide-y divide-slate-100 bg-white dark:divide-slate-800/60 dark:bg-slate-900', className)} {...props}>
      {children}
    </tbody>
  );
}

export function Tr({ className, children, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={cn('hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors', className)} {...props}>
      {children}
    </tr>
  );
}

export function Th({ className, children, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th className={cn('px-4 py-3 font-semibold text-slate-600 dark:text-slate-300', className)} {...props}>
      {children}
    </th>
  );
}

export function Td({ className, children, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn('px-4 py-3 text-slate-700 dark:text-slate-300 align-middle', className)} {...props}>
      {children}
    </td>
  );
}
