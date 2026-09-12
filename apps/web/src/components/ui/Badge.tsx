import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

type Tone = 'neutral' | 'navy' | 'cyan' | 'green' | 'amber' | 'red' | 'indigo';

const TONES: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-600 border-slate-200',
  navy: 'bg-brand-navy/10 text-brand-navy border-brand-navy/20',
  cyan: 'bg-brand-cyan/15 text-brand-cyan border-brand-cyan/30',
  green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  red: 'bg-brand-red/10 text-brand-red border-brand-red/20',
  indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
};

interface BadgeProps {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}

export function Badge({ tone = 'neutral', children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-2 py-0.5 text-[11px] font-semibold',
        TONES[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
