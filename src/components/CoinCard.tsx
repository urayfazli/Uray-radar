import { useState } from 'react';
import { Avatar } from './Avatar';
import type { TokenMeta } from '../api';

export type Stat = { label: string; value: string; tone?: Tone };
export type Tone = 'good' | 'warn' | 'bad' | 'muted' | 'info';

const TONE_CLASSES: Record<Tone, { text: string; bg: string; border: string }> = {
  good: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/25' },
  warn: { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/25' },
  bad: { text: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/25' },
  muted: { text: 'text-slate-400', bg: 'bg-white/5', border: 'border-white/10' },
  info: { text: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/25' },
};

export function fmtUsd(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  if (n >= 1) return `$${n.toFixed(0)}`;
  return `$${n.toFixed(2)}`;
}

export function fmtAge(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function pct(n: number | null | undefined): string {
  return n == null ? '—' : `${n.toFixed(n >= 10 ? 0 : 1)}%`;
}

export function CoinCard({ mint, symbol, meta, ticker, name, age, mcapUsd, secondary, stats, pill }: {
  mint: string;
  symbol?: string | null;
  meta?: TokenMeta;
  ticker: string;
  name?: string | null;
  age: number;
  mcapUsd: number | null;
  secondary?: { label: string; value: string }[];
  stats: Stat[];
  pill?: { label: string; tone: Tone };
}) {
  const [copied, setCopied] = useState(false);
  const shortMint = `${mint.slice(0, 4)}…${mint.slice(-4)}`;

  const handleCopy = () => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(mint);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <div className="bg-[#12131b]/90 hover:bg-[#181a26] border border-white/5 hover:border-cyan-500/30 transition-all duration-200 rounded-xl p-3 sm:p-3.5 mb-2.5 shadow-lg shadow-black/40 group relative overflow-hidden">
      <div className="flex gap-2.5 sm:gap-3 items-start">
        <Avatar mint={mint} symbol={meta?.symbol || symbol} image={meta?.image} size={42} />
        
        <div className="flex-1 min-w-0">
          {/* Header Row: Symbol / Name + Market Cap */}
          <div className="flex justify-between gap-1.5 items-baseline mb-1">
            <div className="min-w-0 flex items-baseline gap-1.5">
              <span className="font-extrabold text-sm text-white group-hover:text-cyan-300 transition-colors truncate">
                {(meta?.symbol || symbol || ticker).slice(0, 14)}
              </span>
              <span className="text-[11px] text-slate-400 truncate max-w-[90px] sm:max-w-[130px]">
                {meta?.name || name}
              </span>
            </div>
            
            <span className="font-mono text-[11px] sm:text-xs font-bold px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-white flex-none tracking-tight">
              MC {fmtUsd(mcapUsd)}
            </span>
          </div>

          {/* Subheader Row: Age + Mint Copy + Explorer links + Secondary stats */}
          <div className="flex flex-wrap justify-between items-center gap-1.5 my-1.5">
            <div className="flex items-center gap-1.5 text-xs flex-wrap">
              <span className="text-cyan-400 font-mono text-[11px] font-semibold">{fmtAge(age)}</span>
              
              <button
                onClick={handleCopy}
                title="Copy Mint Address"
                className="font-mono text-[11px] text-slate-400 hover:text-cyan-300 bg-white/5 active:bg-cyan-500/20 px-2 py-0.5 rounded-md border border-white/5 transition-all cursor-pointer flex items-center gap-1 active:scale-95"
              >
                {copied ? '✓ Copied' : shortMint}
              </button>

              <div className="flex gap-1 text-slate-400 text-xs items-center">
                <a
                  href={`https://pump.fun/coin/${mint}`}
                  target="_blank"
                  rel="noreferrer"
                  title="Open on pump.fun"
                  className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-cyan-500/20 hover:text-cyan-300 border border-white/5 transition-all flex items-center justify-center text-[11px]"
                >
                  💊
                </a>
                <a
                  href={`https://dexscreener.com/solana/${mint}`}
                  target="_blank"
                  rel="noreferrer"
                  title="Open on DexScreener"
                  className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-cyan-500/20 hover:text-cyan-300 border border-white/5 transition-all flex items-center justify-center text-[11px]"
                >
                  📈
                </a>
              </div>
            </div>

            {secondary && secondary.length > 0 && (
              <div className="flex gap-2 text-xs font-mono ml-auto">
                {secondary.map((s, i) => (
                  <span key={i} className="text-slate-300 text-[11px]">
                    <span className="text-slate-500">{s.label}</span> {s.value}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Stats strip + Verdict pill */}
          <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-white/5">
            <div className="flex gap-2.5 text-[11px] font-mono flex-wrap">
              {stats.map((s, i) => {
                const toneStyle = TONE_CLASSES[s.tone || 'muted'];
                return (
                  <span key={i} className={`${toneStyle.text} font-medium`}>
                    <span className="text-slate-500 font-sans text-[10px] uppercase">{s.label}</span> {s.value}
                  </span>
                );
              })}
            </div>

            {pill && (
              <span
                className={`text-[9px] sm:text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider border ${TONE_CLASSES[pill.tone].bg} ${TONE_CLASSES[pill.tone].text} ${TONE_CLASSES[pill.tone].border}`}
              >
                {pill.label}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

