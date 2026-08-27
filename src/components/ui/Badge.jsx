import { statusColor, statusLabel } from '../../utils/date.js';

const colors = {
  green: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
  yellow: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  red: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  cyan: 'bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300',
};

const statusIcons = {
  confirmed: '✓ ',
  pending: '⏳ ',
  cancelled: '✕ ',
};

export default function Badge({ status, children, color }) {
  const c = color || (status ? statusColor(status) : 'cyan');
  const icon = status && statusIcons[status] ? statusIcons[status] : '';
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${colors[c]}`}>
      {children || `${icon}${statusLabel(status)}`}
    </span>
  );
}

export function EmptyState({ children }) {
  return <div className="py-8 text-center text-sm text-slate-400">{children}</div>;
}

