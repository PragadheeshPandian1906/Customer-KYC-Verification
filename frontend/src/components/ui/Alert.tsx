import React from 'react';
import { cn } from '@/lib/utils';
import { AlertCircle, CheckCircle2, Info, AlertTriangle } from 'lucide-react';

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  correlationId?: string;
}

export function Alert({
  className,
  variant = 'info',
  title,
  correlationId,
  children,
  ...props
}: AlertProps) {
  const configs = {
    info: {
      container: 'bg-blue-50/80 border-blue-200 text-blue-900 dark:bg-blue-950/40 dark:border-blue-900/60 dark:text-blue-200',
      icon: <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />,
    },
    success: {
      container: 'bg-emerald-50/80 border-emerald-200 text-emerald-900 dark:bg-emerald-950/40 dark:border-emerald-900/60 dark:text-emerald-200',
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />,
    },
    warning: {
      container: 'bg-amber-50/80 border-amber-200 text-amber-900 dark:bg-amber-950/40 dark:border-amber-900/60 dark:text-amber-200',
      icon: <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />,
    },
    error: {
      container: 'bg-rose-50/80 border-rose-200 text-rose-900 dark:bg-rose-950/40 dark:border-rose-900/60 dark:text-rose-200',
      icon: <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />,
    },
  };

  const current = configs[variant];

  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-3 p-4 rounded-xl border text-sm',
        current.container,
        className
      )}
      {...props}
    >
      {current.icon}
      <div className="flex-1 space-y-1">
        {title && <h4 className="font-semibold tracking-tight">{title}</h4>}
        <div className="text-xs leading-relaxed opacity-90">{children}</div>
        {correlationId && (
          <p className="pt-1 text-[11px] font-mono text-slate-500 dark:text-slate-400">
            Trace ID: {correlationId}
          </p>
        )}
      </div>
    </div>
  );
}
