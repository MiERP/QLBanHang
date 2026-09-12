import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

type Tone = 'navy' | 'cyan' | 'green' | 'amber' | 'red' | 'indigo';

const ICON_TONES: Record<Tone, string> = {
  navy: 'bg-brand-navy/10 text-brand-navy',
  cyan: 'bg-brand-cyan/15 text-brand-cyan',
  green: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
  red: 'bg-brand-red/10 text-brand-red',
  indigo: 'bg-indigo-50 text-indigo-600',
};

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
  onClick?: () => void;
}

export function StatCard({ icon: Icon, label, value, hint, tone = 'navy', onClick }: StatCardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm',
        onClick && 'cursor-pointer transition hover:border-brand-cyan/50 hover:shadow-md'
      )}
    >
      <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', ICON_TONES[tone])}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
        <p className="mt-0.5 truncate text-lg font-bold text-slate-800">{value}</p>
        {hint && <p className="mt-0.5 text-[11px] text-slate-500">{hint}</p>}
      </div>
    </div>
  );
}
