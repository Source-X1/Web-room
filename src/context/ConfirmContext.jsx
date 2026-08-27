import { createContext, useCallback, useContext, useRef, useState } from 'react';
import Button from '../components/ui/Button.jsx';

const ConfirmContext = createContext(null);

/**
 * Drop-in replacement for window.confirm() — returns a Promise<boolean>
 * Usage: const confirmed = await confirm({ title, message, confirmText, variant })
 */
export function ConfirmProvider({ children }) {
  const [modal, setModal] = useState(null);
  const resolveRef = useRef(null);

  const confirm = useCallback(({ title = 'ยืนยันการดำเนินการ', message, confirmText = 'ยืนยัน', variant = 'danger' } = {}) => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setModal({ title, message, confirmText, variant });
    });
  }, []);

  const handleClose = (result) => {
    setModal(null);
    resolveRef.current?.(result);
    resolveRef.current = null;
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {modal && (
        <div className="fixed inset-0 z-[200] grid place-items-center p-4" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            aria-label="ปิด"
            onClick={() => handleClose(false)}
          />
          <section className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
            {/* Color accent top bar */}
            <div className={`h-1.5 w-full ${modal.variant === 'danger' ? 'bg-red-500' : 'bg-brand-500'}`} />
            <div className="p-6">
              <div className="mb-1 flex items-center gap-2.5">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg ${
                  modal.variant === 'danger'
                    ? 'bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-400'
                    : 'bg-brand-100 text-brand-600 dark:bg-brand-950/60 dark:text-brand-400'
                }`}>
                  {modal.variant === 'danger' ? '⚠' : '?'}
                </span>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">{modal.title}</h2>
              </div>
              {modal.message && (
                <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{modal.message}</p>
              )}
              <div className="mt-6 flex justify-end gap-2.5">
                <Button variant="ghost" onClick={() => handleClose(false)}>
                  ยกเลิก
                </Button>
                <Button
                  variant={modal.variant === 'danger' ? 'danger' : 'primary'}
                  onClick={() => handleClose(true)}
                >
                  {modal.confirmText}
                </Button>
              </div>
            </div>
          </section>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used inside <ConfirmProvider>');
  return ctx;
}
