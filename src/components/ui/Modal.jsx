import { useEffect } from 'react';
import Button from './Button.jsx';

export default function Modal({ open, onClose, title, children, size = 'md' }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const width = size === 'sm' ? 'max-w-md' : size === 'lg' ? 'max-w-3xl' : 'max-w-xl';

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true">
      <button type="button" className="absolute inset-0 bg-slate-900/50" aria-label="ปิด" onClick={onClose} />
      <section className={`relative max-h-[90vh] w-full ${width} overflow-auto rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900`}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="ปิด">×</Button>
        </div>
        {children}
      </section>
    </div>
  );
}

