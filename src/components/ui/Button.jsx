const variants = {
  primary: 'bg-gradient-to-r from-brand-600 to-brand-400 text-white hover:from-brand-500 hover:to-brand-300 shadow-md shadow-brand-500/30',
  secondary: 'bg-accent-500 text-white hover:bg-accent-600 shadow-sm',
  outline: 'border border-brand-300 bg-white text-brand-700 hover:bg-brand-50 dark:border-slate-600 dark:bg-slate-800 dark:text-brand-300 dark:hover:bg-slate-700',
  neutral: 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200',
  danger: 'bg-gradient-to-r from-red-600 to-red-500 text-white hover:from-red-500 hover:to-red-400 shadow-sm',
  ghost: 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
};

const sizes = {
  sm: 'min-h-8 px-2.5 text-xs',
  md: 'min-h-10 px-4 text-sm',
  lg: 'min-h-11 px-5 text-base',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  loading = false,
  full = false,
  children,
  disabled,
  ...props
}) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-bold transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:translate-y-0 ${variants[variant]} ${sizes[size]} ${full ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {loading ? 'กำลังดำเนินการ...' : children}
    </button>
  );
}
