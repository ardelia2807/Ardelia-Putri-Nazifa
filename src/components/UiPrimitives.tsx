import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  X,
  Menu,
  LogOut,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

export function StatCard({
  label,
  value,
  subtext,
  accent = false,
}: {
  label: string;
  value: string | number;
  subtext?: string;
  accent?: boolean;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-2">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <div className={`text-2xl sm:text-3xl font-bold font-mono tabular-nums tracking-tight ${accent ? 'text-violet-700' : 'text-slate-900'}`}>
        {value}
      </div>
      {subtext && <span className="text-xs text-slate-500">{subtext}</span>}
    </div>
  );
}

export function StatusLabel({
  status,
}: {
  status: 'ACTIVE' | 'INACTIVE' | 'MENUNGGU' | 'DIPROSES' | 'SELESAI' | 'BERJALAN' | string;
}) {
  if (status === 'ACTIVE' || status === 'SELESAI') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
        <span>{status === 'ACTIVE' ? 'Aktif' : 'Selesai'}</span>
      </span>
    );
  }
  if (status === 'DIPROSES' || status === 'BERJALAN') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-700">
        <Clock className="w-3.5 h-3.5 shrink-0" />
        <span>{status === 'DIPROSES' ? 'Diproses' : 'Berjalan'}</span>
      </span>
    );
  }
  if (status === 'MENUNGGU') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700">
        <Clock className="w-3.5 h-3.5 shrink-0" />
        <span>Menunggu</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700">
      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
      <span>Nonaktif</span>
    </span>
  );
}

export function SimpleBarChart({
  data,
  unit = '',
  emptyText = 'Belum ada data tercatat.',
}: {
  data: Array<{ label: string; value: number }>;
  unit?: string;
  emptyText?: string;
}) {
  if (!data.length) {
    return <div className="py-10 text-center text-sm text-slate-500">{emptyText}</div>;
  }
  const maxVal = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="space-y-3">
      {data.map((item) => {
        const pct = Math.max(4, Math.round((item.value / maxVal) * 100));
        return (
          <div key={item.label} className="space-y-1">
            <div className="flex items-center justify-between text-xs gap-3">
              <span className="font-medium text-slate-700 truncate">{item.label}</span>
              <span className="font-mono tabular-nums font-semibold text-slate-900 shrink-0">
                {item.value}
                {unit ? ` ${unit}` : ''}
              </span>
            </div>
            <div className="h-2.5 w-full bg-slate-100 rounded-md overflow-hidden">
              <div
                className="h-full bg-violet-600 rounded-md transition-all duration-300"
                style={{ width: `${item.value === 0 ? 0 : pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  maxWidth = 'max-w-lg',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className={`bg-white border border-slate-200 rounded-xl w-full ${maxWidth} shadow-xl my-8`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-violet-600"
            aria-label="Tutup dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 max-h-[80vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Ya, Hapus',
  loading = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  loading?: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} maxWidth="max-w-md">
      <p className="text-sm text-slate-600 leading-relaxed mb-6">{message}</p>
      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
        >
          Batal
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={loading}
          className="px-4 py-2 text-sm font-medium text-white bg-rose-600 rounded-lg hover:bg-rose-700 disabled:opacity-60"
        >
          {loading ? 'Memproses...' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

export function DashboardShell({
  roleTitle,
  subtitle,
  userName,
  navItems,
  activeTab,
  onSelectTab,
  onLogout,
  mobileBottomIds,
  accessNotice,
  onDismissNotice,
  children,
}: {
  roleTitle: string;
  subtitle: string;
  userName: string;
  navItems: NavItem[];
  activeTab: string;
  onSelectTab: (id: string) => void;
  onLogout: () => void;
  mobileBottomIds?: string[];
  accessNotice?: string | null;
  onDismissNotice?: () => void;
  children: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const bottomItems = mobileBottomIds
    ? navItems.filter((item) => mobileBottomIds.includes(item.id)).slice(0, 4)
    : navItems.slice(0, 4);

  const currentNav = navItems.find((n) => n.id === activeTab);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-white border-r border-slate-200 no-print">
        <div className="px-6 py-5 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-violet-700 text-white flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold tracking-tight text-slate-900 font-display whitespace-nowrap">
                DIGITAL BALANCE
              </div>
              <div className="text-[11px] font-semibold tracking-wider text-violet-700 truncate">
                {roleTitle}
              </div>
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-500 truncate">{subtitle}</p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" aria-label="Menu utama">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-violet-700 text-white'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 space-y-3">
          <div className="px-2">
            <div className="text-xs font-medium text-slate-900 truncate">{userName}</div>
            <div className="text-[11px] text-slate-500 truncate">{roleTitle}</div>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="lg:hidden sticky top-0 z-30 h-14 bg-white border-b border-slate-200 px-4 flex items-center justify-between gap-4 no-print">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="p-2 -ml-2 rounded-lg text-slate-700 hover:bg-slate-100"
            aria-label="Buka menu navigasi"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="text-sm font-bold text-slate-900 font-display whitespace-nowrap">
            DIGITAL BALANCE
          </span>
        </div>
        <span className="text-xs font-medium text-violet-700 truncate">{roleTitle}</span>
      </header>

      {/* Mobile Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-slate-900/50" onClick={() => setDrawerOpen(false)} />
          <div className="relative w-72 max-w-[85vw] bg-white h-full flex flex-col border-r border-slate-200 z-10">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-slate-900 font-display">DIGITAL BALANCE</div>
                <div className="text-xs font-semibold text-violet-700">{roleTitle}</div>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
                aria-label="Tutup menu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-2 text-xs text-slate-500 border-b border-slate-100 truncate">
              {userName} · {subtitle}
            </div>
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onSelectTab(item.id);
                      setDrawerOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${
                      active ? 'bg-violet-700 text-white' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="p-4 border-t border-slate-200">
              <button
                type="button"
                onClick={onLogout}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium text-rose-700 bg-rose-50 rounded-lg"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Desktop Top Contextual Bar */}
        <div className="hidden lg:flex items-center justify-between gap-8 px-8 h-14 bg-white border-b border-slate-200 no-print">
          <div className="flex items-center gap-2 text-sm text-slate-500 min-w-0">
            <span className="font-medium text-slate-900 whitespace-nowrap">{roleTitle}</span>
            <span aria-hidden="true">/</span>
            <span className="truncate">{currentNav?.label ?? 'Dashboard'}</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-600 shrink-0">
            <span className="truncate max-w-xs">{subtitle}</span>
            <span aria-hidden="true">·</span>
            <span className="font-medium text-slate-900 whitespace-nowrap">{userName}</span>
          </div>
        </div>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-24 lg:pb-10 max-w-7xl w-full mx-auto">
          {accessNotice && (
            <div className="mb-5 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-4 text-sm text-amber-900">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                <span>{accessNotice}</span>
              </div>
              {onDismissNotice && (
                <button
                  type="button"
                  onClick={onDismissNotice}
                  className="text-xs font-semibold text-amber-800 hover:underline shrink-0"
                >
                  Tutup
                </button>
              )}
            </div>
          )}
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 h-16 bg-white border-t border-slate-200 grid grid-cols-4 no-print"
        aria-label="Navigasi bawah"
      >
        {bottomItems.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`flex flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium ${
                active ? 'text-violet-700' : 'text-slate-500'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate max-w-full">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
