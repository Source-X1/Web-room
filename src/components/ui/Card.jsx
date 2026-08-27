export default function Card({ title, icon, note, children, className = '' }) {
  return (
    <article className={`glass-card p-4 sm:p-5 ${className}`}>
      {title && (
        <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-slate-800 dark:text-slate-100">
          {icon && (
            <span className="inline-grid h-6 w-6 place-items-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400">
              {icon}
            </span>
          )}
          {title}
        </h2>
      )}
      {note && <p className="-mt-2 mb-4 text-xs text-slate-500 dark:text-slate-400">{note}</p>}
      {children}
    </article>
  );
}
