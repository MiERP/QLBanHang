import { X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { cn } from '../../lib/cn';

type Size = 'sm' | 'md' | 'lg' | 'xl' | '2xl';

const SIZES: Record<Size, string> = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  '2xl': 'max-w-6xl',
};

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  size?: Size;
  footer?: ReactNode;
  headerAction?: ReactNode;
  children: ReactNode;
}

export function Modal({ open, onClose, title, subtitle, size = 'lg', footer, headerAction, children }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm sm:items-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={cn('my-auto w-full overflow-hidden rounded-2xl bg-white shadow-2xl', SIZES[size])}
      >
        <div className="flex items-start justify-between gap-3 bg-brand-navy-darker px-5 py-3.5 text-white">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-extrabold">{title}</h3>
            {subtitle && <p className="mt-0.5 text-[11px] text-brand-cyan">{subtitle}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {headerAction}
            <button onClick={onClose} className="rounded-md p-1 text-slate-400 transition hover:bg-white/10 hover:text-white">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="max-h-[70vh] overflow-y-auto">{children}</div>

        {footer && <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}
