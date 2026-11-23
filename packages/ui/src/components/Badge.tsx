import { cn } from '../lib/cn';
import { CONTRACT_STATUS_STYLES } from '../lib/constants';

interface BadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: BadgeProps) {
  const style = CONTRACT_STATUS_STYLES[status] || 'bg-slate-100 text-slate-700 ring-slate-200/60';
  return (
    <span className={cn(
      'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
      style,
      className,
    )}>
      {status.replace('_', ' ')}
    </span>
  );
}
