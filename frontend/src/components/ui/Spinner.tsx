import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  label?: string;
}

export function Spinner({ size = 'md', className, label }: SpinnerProps) {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-10 h-10',
  };

  return (
    <div className="flex flex-col items-center justify-center gap-2 p-4 text-slate-500 dark:text-slate-400">
      <Loader2 className={cn('animate-spin text-blue-600 dark:text-blue-500', sizes[size], className)} />
      {label && <span className="text-xs font-medium">{label}</span>}
    </div>
  );
}
