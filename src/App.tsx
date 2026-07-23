import { useEffect, useMemo, useState } from 'react';
import { useFeed, useTokenMeta } from './api';
import type { OldCoin, BondedCoin, TokenMeta } from './api';
import { Column } from './components/Column';
import type { SortKey, SortDir } from './components/Column';
import { CoinCard, fmtUsd, pct } from './components/CoinCard';
import type { Stat, Tone } from './components/CoinCard';

const devTone = (p: number | null | undefined): Tone => p == null ? 'muted' : p < 5 ? 'good' : p < 10 ? 'warn' : 'bad';
const t10Tone = (p: number | null | undefined): Tone => p == null ? 'muted' : p < 40 ? 'good' : p < 65 ? 'warn' : 'bad';
const dipTone = (p: number): Tone => p > -20 ? 'good' : p > -40 ? 'warn' : 'bad';

function sortCoins<T>(coins: T[], key: SortKey, dir: SortDir, val: (c: T, k: SortKey) => number): T[] {
  const s = [...coins].sort((a, b) => val(a, key) - val(b, key));
  return dir === 'desc' ? s.reverse() : s;
}

/** True on phone-width viewports — drives the columns-to-tabs collapse. */
function useIsMobile(maxWidth = 760) {
  const q = `(max-width: ${maxWidth}px)`;
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const fn = () => setM(mq.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, [q]);
  return m;
}

export function App() {
  const oldFeed = useFeed<OldCoin>('/api/old');
  const newFeed = useFeed<BondedCoin>('/api/new');
  const bondedFeed = useFeed<BondedCoin>('/api/bonded');

  const [oldSort, setOldSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'vol', dir: 'desc' });
  const [newSort, setNewSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'age', dir: 'asc' });
  const [bondSort, setBondSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'age', dir: 'asc' });
  const [newTab, setNewTab] = useState<'unchecked' | 'tradable' | 'blocked'>('tradable');
  const [bondTab, setBondTab] = useState<'unchecked' | 'tradable' | 'blocked' | 'stale'>('tradable');
  const [mobileTab, setMobileTab] = useState<'old' | 'new' | 'bonded'>('new');
  const isMobile = useIsMobile();
  const [showIntro, setShowIntro] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const filterCoins = <T extends { mint: string; symbol?: string | null; name?: string | null }>(list: T[]) => {
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter((c) =>
      c.mint.toLowerCase().includes(q) ||
      (c.symbol && c.symbol.toLowerCase().includes(q)) ||
      (c.name && c.name.toLowerCase().includes(q))
    );
  };

  const oldCoins = filterCoins(oldFeed.data?.coins ?? []);

  const NEW_TRADABLE_MIN_MC = 3000;
  const newAll = filterCoins(newFeed.data?.coins ?? []);
  const isNewTradable = (c: BondedCoin) => !c.hidden && (c.marketCapUsd ?? 0) >= NEW_TRADABLE_MIN_MC;
  const newBlocked = newAll.filter((c) => c.hidden);
  const newTradable = newAll.filter(isNewTradable);
  const newUnchecked = newAll.filter((c) => !c.hidden && !c.checked);
  const newActive = newTab === 'unchecked' ? newUnchecked : newTab === 'blocked' ? newBlocked : newTradable;

  const bondAll = filterCoins(bondedFeed.data?.coins ?? []);
  const bondStale = bondAll.filter((c) => c.stale);
  const bondBlocked = bondAll.filter((c) => !c.stale && c.hidden);
  const bondTradable = bondAll.filter((c) => !c.stale && !c.hidden);
  const bondUnchecked = bondAll.filter((c) => !c.stale && !c.checked && !c.hidden);
  const bondActive = bondTab === 'unchecked' ? bondUnchecked
    : bondTab === 'blocked' ? bondBlocked
    : bondTab === 'stale' ? bondStale
    : bondTradable;

  const oldSorted = sortCoins(oldCoins, oldSort.key, oldSort.dir,
    (c, k) => k === 'age' ? c.ageMs : k === 'mc' ? (c.marketCapUsd ?? 0) : c.recentTrades);
  const mcVol = (c: BondedCoin, k: SortKey) => k === 'age' ? c.ageMs : k === 'mc' ? (c.marketCapUsd ?? 0) : (c.volumeUsd ?? 0);
  const newSorted = sortCoins(newActive, newSort.key, newSort.dir, mcVol);
  const bondSorted = sortCoins(bondActive, bondSort.key, bondSort.dir, mcVol);

  const allMints = useMemo(
    () => [...oldSorted, ...newSorted, ...bondSorted].slice(0, 120).map((c) => c.mint),
    [oldSorted, newSorted, bondSorted],
  );
  const meta = useTokenMeta(allMints);
  const mm = (mint: string): TokenMeta | undefined => meta[mint];

  return (
    <div className="h-screen flex flex-col p-3 md:p-4 box-border bg-[#050507] text-slate-300 font-sans selection:bg-cyan-500/30">
      {/* ---------- INTRO MODAL ---------- */}
      {showIntro && (
        <div
          onClick={() => setShowIntro(false)}
          className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-[#0c0d16]/95 border border-cyan-500/30 rounded-2xl p-6 text-slate-200 text-center shadow-2xl shadow-cyan-500/20 relative overflow-hidden"
          >
            <div className="w-16 h-16 rounded-2xl p-0.5 bg-gradient-to-br from-cyan-400 via-blue-500 to-purple-600 mx-auto mb-3 shadow-[0_0_25px_rgba(34,211,238,0.5)]">
              <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Uray Radar" className="w-full h-full rounded-[14px] object-cover" />
            </div>
            
            <h2 className="text-2xl font-black text-white tracking-tight">Uray Radar</h2>
            <p className="text-xs font-mono text-cyan-400 font-medium mt-0.5">Live pump.fun Token Discovery</p>
            
            <p className="mt-3 text-xs text-slate-400 leading-relaxed">
              Surfacing reawakened old coins, fresh launches, and bonded graduates, filtered by transparent on-chain quality gates.
            </p>
            
            <div className="mt-4 p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-xl text-xs font-semibold text-cyan-300 leading-normal flex items-center justify-center gap-1.5 flex-wrap">
              <span>Developed by <strong className="text-white font-bold">Uray Fazli</strong></span>
              <span>•</span>
              <a
                href="https://x.com/urayfazli17"
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-400 hover:underline flex items-center gap-1 font-mono"
              >
                @urayfazli17
              </a>
            </div>

            <button
              onClick={() => setShowIntro(false)}
              className="mt-5 w-full py-3 bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-black font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-cyan-500/25 transition-all cursor-pointer active:scale-95"
            >
              Start Discovery
            </button>
          </div>
        </div>
      )}

      {/* ---------- HEADER ---------- */}
      <header className="mb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-2.5 sm:p-3 rounded-2xl bg-black/40 border border-white/10 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-2 w-full sm:w-auto">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl p-0.5 bg-gradient-to-br from-cyan-400 to-purple-600 shadow-[0_0_18px_rgba(34,211,238,0.4)] flex-none">
              <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Uray Radar" className="w-full h-full rounded-[10px] object-cover" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="m-0 text-base font-extrabold text-white tracking-tight uppercase">
                  Uray<span className="text-cyan-400">Radar</span>
                </h1>
                <span className="px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-widest rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  Radar
                </span>
              </div>
              {!isMobile && (
                <p className="m-0 text-[10px] text-slate-500 font-medium">
                  Live pump.fun token discovery • On-chain quality gates
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:hidden">
            {bondedFeed.data?.solUsd ? (
              <div className="flex items-center gap-1.5 px-2 py-0.5 bg-white/5 border border-white/10 rounded-full text-[10px] font-mono text-slate-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_6px_rgba(16,185,129,0.8)]" />
                SOL ${bondedFeed.data.solUsd.toFixed(1)}
              </div>
            ) : null}

            <button
              onClick={() => setShowIntro(true)}
              className="p-1.5 bg-white/5 hover:bg-cyan-500/10 text-slate-400 hover:text-cyan-300 rounded-full text-xs border border-white/10 transition-all cursor-pointer"
              title="About Uray Radar"
            >
              ℹ️
            </button>
          </div>
        </div>

        {/* Search Input Bar */}
        <div className="w-full sm:flex-1 sm:max-w-md sm:mx-2">
          <div className="relative group">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 group-focus-within:text-cyan-400 transition-colors"
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Mint address or Symbol..."
              className="w-full bg-white/5 border border-white/10 rounded-xl sm:rounded-full py-1.5 pl-9 pr-8 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:bg-white/[0.07] transition-all font-mono"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-white"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Right Info & Network Indicators */}
        <div className="hidden sm:flex items-center gap-2 sm:gap-3 ml-auto">
          <a
            href="https://x.com/urayfazli17"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden md:flex items-center gap-1.5 px-3 py-1 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 hover:border-cyan-500/40 rounded-full text-xs text-cyan-300 font-medium transition-all"
          >
            <span className="text-slate-400">Dev:</span>
            <span className="font-bold text-white">Uray Fazli</span>
            <span className="font-mono text-cyan-400">@urayfazli17</span>
          </a>

          {bondedFeed.data?.solUsd ? (
            <div className="flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs font-mono text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
              SOL ${bondedFeed.data.solUsd.toFixed(2)}
            </div>
          ) : null}

          <button
            onClick={() => setShowIntro(true)}
            className="px-2.5 py-1 bg-white/5 hover:bg-cyan-500/10 hover:border-cyan-500/30 text-slate-400 hover:text-cyan-300 rounded-full text-xs font-semibold border border-white/10 transition-all cursor-pointer flex items-center gap-1"
          >
            ℹ️ Intro
          </button>
        </div>
      </header>

      {/* Mobile Feed Navigation Bar */}
      {isMobile ? (
        <div className="flex gap-1.5 mb-2.5 p-1 bg-black/40 border border-white/10 rounded-2xl">
          {([
            { key: 'old', label: 'Old Pre-bond', count: oldCoins.length, icon: '🔥' },
            { key: 'new', label: 'New Pairs', count: newAll.length, icon: '⚡' },
            { key: 'bonded', label: 'Bonded', count: bondAll.length, icon: '🎓' },
          ] as const).map((t) => {
            const on = mobileTab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setMobileTab(t.key)}
                className={`flex-1 text-xs font-bold py-2 px-1.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1 active:scale-95 ${
                  on
                    ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 border border-cyan-500/40 shadow-lg shadow-cyan-500/20'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                <span>{t.icon}</span>
                <span>{t.label}</span>
                <span className="text-[10px] font-mono opacity-80 bg-white/5 px-1.5 py-0.2 rounded-full">
                  {t.count}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      {/* ---------- MAIN THREE-COLUMN DISCOVERY BOARD ---------- */}
      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* OLD PRE-BOND */}
        <div className={isMobile && mobileTab !== 'old' ? 'hidden' : 'contents'}>
          <Column
            title="Old pre-bond" accent="#f59e0b"
            subtitle="Older, still-unbonded coins taking fresh bids again."
            count={oldCoins.length} apiLoad={oldFeed.data?.api}
            status={feedStatus(oldFeed.data?.updatedAt, oldFeed.error)}
            sortKey={oldSort.key} sortDir={oldSort.dir}
            sortOptions={[{ key: 'age', label: 'Age' }, { key: 'mc', label: 'MC' }, { key: 'vol', label: 'Bids' }]}
            onSortKey={(k) => setOldSort((s) => ({ ...s, key: k }))} onSortDir={(d) => setOldSort((s) => ({ ...s, dir: d }))}
          >
            {oldSorted.map((c) => (
              <CoinCard key={c.mint} mint={c.mint} symbol={c.symbol} meta={mm(c.mint)}
                ticker={c.symbol || c.mint.slice(0, 6)} name={c.name} age={c.ageMs} mcapUsd={c.marketCapUsd}
                secondary={[{ label: 'bids', value: String(c.recentTrades) }]}
                stats={[{ label: 'reawakened', value: `${c.recentTrades}/1h`, tone: 'good' }]}
              />
            ))}
            {oldCoins.length === 0 ? <Empty hint={searchQuery ? 'no coins matching query…' : 'waiting for reawakened coins…'} /> : null}
          </Column>
        </div>

        {/* NEW PAIRS */}
        <div className={isMobile && mobileTab !== 'new' ? 'hidden' : 'contents'}>
          <Column
            title="New pairs" accent="#38bdf8"
            subtitle={
              newTab === 'unchecked' ? 'Every new pump.fun launch, before gates.'
              : newTab === 'blocked' ? 'Launches that tripped a gate (bundle / rug / dump / crater).'
              : 'Clean launches over $3k mcap.'}
            count={newActive.length} apiLoad={newFeed.data?.api}
            status={feedStatus(newFeed.data?.updatedAt, newFeed.error)}
            sortKey={newSort.key} sortDir={newSort.dir}
            sortOptions={[{ key: 'age', label: 'Age' }, { key: 'mc', label: 'MC' }, { key: 'vol', label: 'Vol' }]}
            onSortKey={(k) => setNewSort((s) => ({ ...s, key: k }))} onSortDir={(d) => setNewSort((s) => ({ ...s, dir: d }))}
            tabs={[
              { key: 'unchecked', label: 'Unchecked', count: newUnchecked.length },
              { key: 'blocked', label: 'Blocked', count: newBlocked.length },
              { key: 'tradable', label: 'Tradable', count: newTradable.length },
            ]}
            activeTab={newTab} onTab={(k) => setNewTab(k as 'unchecked' | 'tradable' | 'blocked')}
          >
            {newSorted.map((c) => {
              const stats: Stat[] = [
                { label: 'Dev', value: pct(c.creatorPct), tone: devTone(c.creatorPct) },
                { label: 'T10', value: pct(c.holderTop10), tone: t10Tone(c.holderTop10) },
                { label: 'dip', value: `${c.dipPct.toFixed(0)}%`, tone: dipTone(c.dipPct) },
              ];
              return (
                <CoinCard key={c.mint} mint={c.mint} symbol={c.symbol} meta={mm(c.mint)}
                  ticker={c.symbol || c.mint.slice(0, 6)} name={c.name} age={c.ageMs} mcapUsd={c.marketCapUsd}
                  secondary={[{ label: 'V', value: fmtUsd(c.volumeUsd) }, { label: 'TX', value: String(c.trades) }]}
                  stats={stats} pill={c.hidden ? { label: 'blocked', tone: 'bad' } : !c.checked ? { label: 'checking…', tone: 'warn' } : c.revived ? { label: 'revival', tone: 'info' } : (c.marketCapUsd ?? 0) >= NEW_TRADABLE_MIN_MC ? { label: 'tradable', tone: 'good' } : { label: 'clean', tone: 'muted' }}
                />
              );
            })}
            {newActive.length === 0 ? <Empty hint={searchQuery ? 'no coins matching query…' : 'waiting for fresh launches…'} /> : null}
          </Column>
        </div>

        {/* BONDED */}
        <div className={isMobile && mobileTab !== 'bonded' ? 'hidden' : 'contents'}>
          <Column
            title="Bonded" accent="#4ade80"
            subtitle={
              bondTab === 'unchecked' ? 'Fresh graduates still being checked.'
              : bondTab === 'blocked' ? 'Graduates that tripped a gate (bundle / rug / dump / crater).'
              : bondTab === 'stale' ? 'Aged-out graduates — kept for reference.'
              : 'Graduates that passed every gate (bundle / rug / dump).'}
            count={bondActive.length} apiLoad={bondedFeed.data?.api}
            status={feedStatus(bondedFeed.data?.updatedAt, bondedFeed.error)}
            sortKey={bondSort.key} sortDir={bondSort.dir}
            sortOptions={[{ key: 'age', label: 'Age' }, { key: 'mc', label: 'MC' }, { key: 'vol', label: 'Vol' }]}
            onSortKey={(k) => setBondSort((s) => ({ ...s, key: k }))} onSortDir={(d) => setBondSort((s) => ({ ...s, dir: d }))}
            tabs={[
              { key: 'unchecked', label: 'Unchecked', count: bondUnchecked.length },
              { key: 'blocked', label: 'Blocked', count: bondBlocked.length },
              { key: 'tradable', label: 'Tradable', count: bondTradable.length },
              { key: 'stale', label: 'Stale', count: bondStale.length },
            ]}
            activeTab={bondTab} onTab={(k) => setBondTab(k as 'unchecked' | 'tradable' | 'blocked' | 'stale')}
          >
            {bondSorted.map((c) => {
              const stats: Stat[] = [
                { label: 'Dev', value: pct(c.creatorPct), tone: devTone(c.creatorPct) },
                { label: 'T10', value: pct(c.holderTop10), tone: t10Tone(c.holderTop10) },
                { label: 'dip', value: `${c.dipPct.toFixed(0)}%`, tone: dipTone(c.dipPct) },
              ];
              return (
                <CoinCard key={c.mint} mint={c.mint} symbol={c.symbol} meta={mm(c.mint)}
                  ticker={c.symbol || c.mint.slice(0, 6)} name={c.name} age={c.ageMs} mcapUsd={c.marketCapUsd}
                  secondary={[{ label: 'V', value: fmtUsd(c.volumeUsd) }, { label: 'TX', value: String(c.trades) }]}
                  stats={stats} pill={c.stale ? { label: 'stale', tone: 'muted' } : c.hidden ? { label: 'blocked', tone: 'bad' } : !c.checked ? { label: 'checking…', tone: 'warn' } : c.revived ? { label: 'revival', tone: 'info' } : { label: 'tradable', tone: 'good' }}
                />
              );
            })}
            {bondActive.length === 0 ? <Empty hint={searchQuery ? 'no coins matching query…' : 'waiting for the next migration…'} /> : null}
          </Column>
        </div>
      </div>

      {/* Footer Credit */}
      <footer className="mt-2 text-center text-[11px] text-slate-500 py-1 flex items-center justify-center gap-1.5 flex-none">
        <span>Developed by <strong className="text-slate-300 font-semibold">Uray Fazli</strong></span>
        <span>•</span>
        <a
          href="https://x.com/urayfazli17"
          target="_blank"
          rel="noopener noreferrer"
          className="text-cyan-400 hover:text-cyan-300 font-mono transition-colors"
        >
          @urayfazli17
        </a>
      </footer>
    </div>
  );
}

function feedStatus(updatedAt: number | undefined, error: string | null | undefined): string {
  if (error) return 'offline';
  if (!updatedAt) return 'waiting…';
  const age = Math.floor((Date.now() - updatedAt) / 1000);
  return age < 15 ? 'live' : `stale ${age}s`;
}

function Empty({ hint }: { hint?: string }) {
  return (
    <div className="text-slate-500 font-mono text-xs text-center py-8 px-4 border border-dashed border-white/5 rounded-xl my-2">
      {hint || 'nothing yet…'}
    </div>
  );
}

