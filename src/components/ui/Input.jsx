export default function Input({ label, error, className = '', ...props }) {
  return (
    <label className="grid gap-1.5">
      {label && <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">{label}</span>}
      <input
        className={`min-h-11 w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-2 text-slate-800 outline-none transition-all focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-500/10 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-100 dark:focus:bg-slate-800 ${className}`}
        {...props}
      />
      {error && <span className="text-sm text-red-600">{error}</span>}
    </label>
  );
}

export function Select({ label, error, children, className = '', ...props }) {
  return (
    <label className="grid gap-1.5">
      {label && <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">{label}</span>}
      <select
        className={`min-h-11 w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-2 text-slate-800 outline-none transition-all focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-500/10 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-100 dark:focus:bg-slate-800 ${className}`}
        {...props}
      >
        {children}
      </select>
      {error && <span className="text-sm text-red-600">{error}</span>}
    </label>
  );
}
