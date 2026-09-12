import { CalendarDays, Menu } from 'lucide-react';
import { TAB_META, type TabId } from '../../layout';

interface TopbarProps {
  tab: TabId;
  month: string;
  onMonthChange: (month: string) => void;
  onOpenMenu: () => void;
}

export function Topbar({ tab, month, onMonthChange, onOpenMenu }: TopbarProps) {
  const meta = TAB_META[tab];
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 lg:px-6">
      <div className="flex items-center gap-3">
        <button onClick={onOpenMenu} className="rounded-lg border border-slate-200 p-2 text-slate-500 lg:hidden">
          <Menu className="h-4 w-4" />
        </button>
        <div>
          <h2 className="text-base font-extrabold text-brand-navy-dark">{meta.title}</h2>
          <p className="text-xs text-slate-500">{meta.subtitle}</p>
        </div>
      </div>
      <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5">
        <CalendarDays className="h-4 w-4 text-brand-cyan" />
        <input
          type="month"
          value={month}
          onChange={(e) => onMonthChange(e.target.value)}
          className="bg-transparent text-xs font-semibold text-slate-600 focus:outline-none"
        />
      </label>
    </header>
  );
}
