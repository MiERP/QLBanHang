import { Bell, CalendarDays, Check, ChevronDown, RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { NAV_ITEMS, type NavItem, type TabId } from '../../layout';
import { cn } from '../../lib/cn';
import { formatDate } from '../../lib/format';
import type { AppNotification, ReportPeriod } from '../../types';

interface TopNavProps {
  active: TabId;
  onSelect: (id: TabId) => void;
  notifications: AppNotification[];
  onOpenNotification: (n: AppNotification) => void;
  onRefreshNotifications: () => void;
  period: ReportPeriod | null;
}

const ITEM_BASE =
  'flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap';

// Nhãn module đích của một thông báo (để người dùng biết sẽ được đưa đi đâu).
function tabLabel(tabId: string): string {
  for (const item of NAV_ITEMS) {
    if (item.id === tabId) return item.label;
    const child = item.children?.find((c) => c.id === tabId);
    if (child) return child.label;
  }
  return tabId;
}

// Menu ngang trên cùng: thương hiệu QAROMI ERP = Tổng quan, các menu còn lại mở dropdown.
export function TopNav({
  active,
  onSelect,
  notifications,
  onOpenNotification,
  onRefreshNotifications,
  period,
}: TopNavProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [bellOpen, setBellOpen] = useState(false);
  const barRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setOpenId(null);
        setBellOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const groupActive = (item: NavItem) => item.children?.some((c) => c.id === active) ?? false;
  const unread = notifications.filter((n) => !n.read).length;
  const select = (id: TabId) => {
    onSelect(id);
    setOpenId(null);
    setBellOpen(false);
  };

  return (
    <header ref={barRef} className="relative z-30 shrink-0 bg-brand-navy-darker text-white shadow-sm">
      <div className="flex items-center gap-0.5 px-3 py-2 lg:px-5">
        {/* Thương hiệu = Tổng quan (màn mặc định) */}
        <button
          onClick={() => select('overview')}
          title="Tổng quan"
          className={cn(
            'flex shrink-0 items-center gap-2.5 rounded-lg px-2 py-1 text-left transition-colors',
            active === 'overview' ? 'bg-white/10' : 'hover:bg-white/10'
          )}
        >
          <img src="/logo-mark.png" alt="QUAWACO" className="h-8 w-auto shrink-0 rounded-lg" />
          <span>
            <span className="block text-sm font-extrabold tracking-wide">QAROMI ERP</span>
            <span className="hidden text-[10px] leading-tight text-brand-cyan sm:block">Xí Nghiệp Nước Hồng Gai</span>
          </span>
        </button>

        <div className="mx-1.5 my-1 h-8 w-px shrink-0 self-center bg-white/10" />

        {NAV_ITEMS.filter((item) => item.id !== 'overview').map((item) => {
          const ItemIcon = item.icon;
          const isActive = item.children ? groupActive(item) : item.id === active;

          if (!item.children) {
            return (
              <button
                key={item.id}
                onClick={() => select(item.id)}
                title={item.label}
                className={cn(ITEM_BASE, isActive ? 'bg-brand-cyan text-white shadow-sm' : 'text-slate-200 hover:bg-white/10 hover:text-white')}
              >
                <ItemIcon className="h-4 w-4 shrink-0" />
                <span className="hidden xl:inline">{item.label}</span>
              </button>
            );
          }

          const open = openId === item.id;
          return (
            <div key={item.id} className="relative shrink-0">
              <button
                onClick={() => setOpenId(open ? null : item.id)}
                title={item.label}
                className={cn(ITEM_BASE, isActive || open ? 'bg-brand-cyan text-white shadow-sm' : 'text-slate-200 hover:bg-white/10 hover:text-white')}
              >
                <ItemIcon className="h-4 w-4 shrink-0" />
                <span className="hidden xl:inline">{item.label}</span>
                <ChevronDown className={cn('hidden h-3.5 w-3.5 shrink-0 transition-transform xl:block', open && 'rotate-180')} />
              </button>
              {open && (
                <div className="absolute left-0 top-full z-40 mt-1 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white py-1.5 text-slate-700 shadow-xl">
                  <div className="border-b border-slate-100 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                    {item.label}
                  </div>
                  {item.children.map((child) => {
                    const ChildIcon = child.icon;
                    return (
                      <button
                        key={child.id}
                        onClick={() => select(child.id)}
                        className={cn(
                          'flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm transition-colors hover:bg-brand-cyan-subtle',
                          child.id === active ? 'bg-brand-cyan-subtle font-semibold text-brand-navy' : 'text-slate-600'
                        )}
                      >
                        <ChildIcon className="h-4 w-4 shrink-0 text-brand-cyan" />
                        {child.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        <div className="ml-auto flex shrink-0 items-center gap-2 pl-2">
          {/* Chuông thông báo: gom cảnh báo toàn hệ thống, bấm vào để đi tới nơi xử lý */}
          <div className="relative">
            <button
              onClick={() => setBellOpen((v) => !v)}
              title="Thông báo & cảnh báo"
              className={cn(
                'relative flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 transition-colors',
                bellOpen ? 'bg-brand-cyan text-white' : 'bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white'
              )}
            >
              <Bell className="h-4 w-4" />
              {unread > 0 && (
                <span className="absolute -right-1 -top-1 rounded-full bg-brand-red px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                  {unread}
                </span>
              )}
            </button>
            {bellOpen && (
              <div className="absolute right-0 top-full z-40 mt-1 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-700 shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-100 px-3.5 py-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                    Thông báo & cảnh báo ({unread} chưa xem / {notifications.length})
                  </span>
                  <button
                    onClick={onRefreshNotifications}
                    title="Làm mới"
                    className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-brand-cyan"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                </div>
                {notifications.length === 0 ? (
                  <p className="px-3.5 py-4 text-center text-sm text-slate-400">Không có thông báo nào</p>
                ) : (
                  <div className="max-h-96 overflow-y-auto">
                    {[...notifications]
                      .sort((a, b) => Number(a.read) - Number(b.read))
                      .map((n) => (
                        <button
                          key={n.id}
                          onClick={() => {
                            onOpenNotification(n);
                            setBellOpen(false);
                          }}
                          className="flex w-full items-start gap-2.5 border-b border-slate-50 px-3.5 py-2.5 text-left transition-colors last:border-0 hover:bg-brand-cyan-subtle"
                        >
                          {n.read ? (
                            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-300" />
                          ) : (
                            <span
                              className={cn(
                                'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                                n.severity === 'high' ? 'bg-brand-red' : 'bg-amber-500'
                              )}
                            />
                          )}
                          <span className="min-w-0 flex-1">
                            <span
                              className={cn(
                                'block text-sm',
                                n.read ? 'font-medium text-slate-500' : 'font-semibold text-slate-700'
                              )}
                            >
                              {n.title}
                            </span>
                            <span className="block text-xs text-slate-500">{n.message}</span>
                            <span className="mt-0.5 block text-[11px] font-semibold text-brand-cyan">
                              {n.read ? 'Đã xem · ' : ''}→ Xử lý tại: {tabLabel(n.tab)}
                            </span>
                          </span>
                        </button>
                      ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <span
            title="Kỳ báo cáo hiện tại"
            className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5"
          >
            <CalendarDays className="h-4 w-4 shrink-0 text-brand-cyan" />
            <span className="whitespace-nowrap text-xs font-semibold text-white">
              {period ? `${formatDate(period.from)} → ${formatDate(period.to)}` : 'Đang tải kỳ…'}
            </span>
          </span>
        </div>
      </div>
    </header>
  );
}
