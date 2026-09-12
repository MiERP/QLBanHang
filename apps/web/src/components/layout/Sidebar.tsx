import { Droplet, X } from 'lucide-react';
import { NAV_ITEMS, type TabId } from '../../layout';
import { cn } from '../../lib/cn';

interface SidebarProps {
  active: TabId;
  onSelect: (id: TabId) => void;
  alertCount: number;
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ active, onSelect, alertCount, open, onClose }: SidebarProps) {
  const groups = Array.from(new Set(NAV_ITEMS.map((i) => i.group)));

  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-slate-900/50 lg:hidden" onClick={onClose} />}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-brand-navy-darker text-white transition-transform lg:static lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-cyan text-white">
            <Droplet className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-extrabold tracking-wide">QAROMI ERP</p>
            <p className="truncate text-[10px] text-brand-cyan">Xí Nghiệp Nước Hồng Gai</p>
          </div>
          <button onClick={onClose} className="text-slate-300 lg:hidden">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
          {groups.map((group) => (
            <div key={group}>
              <p className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">{group}</p>
              <div className="space-y-0.5">
                {NAV_ITEMS.filter((i) => i.group === group).map((item) => {
                  const Icon = item.icon;
                  const isActive = item.id === active;
                  const isDelivery = item.id === 'delivery';
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        onSelect(item.id);
                        onClose();
                      }}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-semibold transition-colors',
                        isActive ? 'bg-brand-cyan text-white shadow-sm' : 'text-slate-300 hover:bg-white/10 hover:text-white'
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1 truncate">{item.label}</span>
                      {isDelivery && alertCount > 0 && (
                        <span className="rounded-full bg-brand-red px-1.5 py-0.5 text-[10px] font-bold text-white">{alertCount}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 px-4 py-3">
          <p className="text-xs font-bold">Trần Nam Trung</p>
          <p className="text-[10px] text-slate-400">Giám Đốc Xí Nghiệp</p>
        </div>
      </aside>
    </>
  );
}
