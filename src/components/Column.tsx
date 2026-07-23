import type { ReactNode } from 'react';

export type SortKey = 'age' | 'mc' | 'vol';
export type SortDir = 'asc' | 'desc';
export type SortOption = { key: SortKey; label: string };
export type Tab = { key: string; label: string; count: number };

export function Column({
  title, subtitle, accent, status, count, apiLoad,
  sortKey, sortDir, sortOptions, onSortKey, onSortDir,
  tabs, activeTab, onTab, children,
}: {
  title: string;
  subtitle: string;
  accent: string;
  status?: string;
  count: number;
  apiLoad?: { perMin: number; total: number };
  sortKey: SortKey;
  sortDir: SortDir;
  sortOptions: SortOption[];
  onSortKey: (k: SortKey) => void;
  onSortDir: (d: SortDir) => void;
  tabs?: Tab[];
  activeTab?: string;
  onTab?: (k: string) => void;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col min-h-0 bg-[#0a0b12]/90 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl shadow-black/60">
      <header className="p-3.5 border-b border-white/10 bg-white/[0.02]">
        {/* Row 1: Title, dot indicator, total count, API load */}
        <div className="flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full flex-none shadow-sm" style={{ backgroundColor: accent, boxShadow: `0 0 10px ${accent}` }} />
          <h2 className="m-0 text-sm font-bold text-white tracking-tight">{title}</h2>
          
          {!tabs && (
            <span className="text-[11px] font-mono text-slate-400 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">
              {count}
            </span>
          )}

          <span
            title={`API usage — ${apiLoad?.perMin ?? 0} requests/min · ${apiLoad?.total ?? 0} total this session`}
            className="ml-auto text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-cyan-400/90 whitespace-nowrap flex items-center gap-1"
          >
            <span className="text-amber-400">⚡</span> {apiLoad?.perMin ?? 0}/min
          </span>
        </div>

        {/* Row 2: Tabs (left) & Status + Sort controls (right) */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-2.5 justify-between">
          {tabs ? (
            <div className="flex gap-1 bg-black/40 p-1 rounded-xl border border-white/5 overflow-x-auto max-w-full scrollbar-none">
              {tabs.map((t) => {
                const on = t.key === activeTab;
                return (
                  <button
                    key={t.key}
                    onClick={() => onTab?.(t.key)}
                    className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1 whitespace-nowrap active:scale-95 ${
                      on
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-[0_0_12px_rgba(34,211,238,0.2)]'
                        : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                    }`}
                  >
                    {t.label}
                    <span className="text-[10px] font-mono opacity-70">({t.count})</span>
                  </button>
                );
              })}
            </div>
          ) : null}

          <div className="flex items-center justify-between sm:justify-end gap-2 text-xs w-full sm:w-auto">
            {status && (
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">{status}</span>
            )}
            
            <div className="flex items-center gap-1.5 ml-auto sm:ml-0">
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Sort</span>
              <div className="flex items-center bg-white/5 border border-white/10 rounded-lg overflow-hidden">
                <select
                  value={sortKey}
                  onChange={(e) => onSortKey(e.target.value as SortKey)}
                  className="bg-transparent text-[11px] font-medium text-slate-300 px-2 py-1 outline-none cursor-pointer border-r border-white/10 appearance-none font-sans"
                >
                  {sortOptions.map((o) => (
                    <option key={o.key} value={o.key} className="bg-[#0f1017] text-white">
                      {o.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => onSortDir(sortDir === 'desc' ? 'asc' : 'desc')}
                  title={sortDir === 'desc' ? 'Highest first' : 'Lowest first'}
                  className="px-2.5 py-1 text-[11px] font-bold text-cyan-400 hover:bg-white/10 transition-colors cursor-pointer active:bg-cyan-500/20"
                >
                  {sortDir === 'desc' ? '↓' : '↑'}
                </button>
              </div>
            </div>
          </div>
        </div>

        <p className="m-0 mt-2 text-[11px] text-slate-400/80 leading-snug">{subtitle}</p>
      </header>

      <div className="lily-scroll p-2.5 overflow-y-auto flex-1 min-h-0">
        {children}
      </div>
    </section>
  );
}

