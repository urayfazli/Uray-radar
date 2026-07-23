// Public read API & App Server. Serves the daemons' persisted board (SQLite, snapshot
// fallback) with USD enrichment, a short response cache, CORS, optional API
// keys, rate limit, and Vite frontend middleware.
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createServer as createViteServer } from 'vite';
import { config } from '../discovery/lib/config.mjs';
import { readSnapshot, writeSnapshot } from '../discovery/lib/store.mjs';
import { getCoin } from '../discovery/lib/pumpfun.mjs';
import { getSolUsd } from '../discovery/lib/solprice.mjs';
import { getCoins, getFeedMeta } from '../discovery/lib/db.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const PORT = 3000;

// Auto-launch discovery daemons
const SERVICES = [
  { name: 'old    ', file: 'discovery/old-prebond.mjs' },
  { name: 'new    ', file: 'discovery/new-pairs.mjs' },
  { name: 'bonded ', file: 'discovery/bonded.mjs' },
  { name: 'watch  ', file: 'discovery/watchdog.mjs' },
];

function launchDaemon(svc) {
  const child = spawn('node', [svc.file], { cwd: root, env: process.env });
  child.stdout.on('data', (d) => process.stdout.write(`[${svc.name}] ${d}`));
  child.stderr.on('data', (d) => process.stderr.write(`[${svc.name}] ${d}`));
  child.on('exit', (code) => {
    console.log(`[${svc.name}] exited (${code}) — restarting in 3s`);
    setTimeout(() => launchDaemon(svc), 3000);
  });
}

for (const svc of SERVICES) {
  launchDaemon(svc);
}

const FEEDS = {
  old: { file: 'old.json', freshMs: config.old.activeMs * 2 },
  bonded: { file: 'bonded.json', freshMs: config.bonded.staleMs },
  new: { file: 'new.json', freshMs: config.newPairs.trackMs },
};

const API_KEYS = new Set(config.apiKeys.split(',').map((s) => s.trim()).filter(Boolean));
const metaCache = readSnapshot('token-meta.json') || {};

function authed(req) {
  if (!API_KEYS.size) return true;
  const k = req.headers['x-api-key'] || req.query.key;
  return !!k && API_KEYS.has(k);
}

const buckets = new Map();
function rateOk(id) {
  const now = Date.now();
  let b = buckets.get(id);
  if (!b || now - b.start >= 60_000) { b = { start: now, count: 0 }; buckets.set(id, b); }
  b.count++;
  return b.count <= config.rateLimitPerMin;
}

function enrichCoin(c, solUsd) {
  return {
    ...c,
    marketCapUsd: c.marketCapUsd ?? (c.marketCapSol != null && solUsd ? c.marketCapSol * solUsd : null),
    athMcapUsd: c.athMcapUsd ?? (c.athMcapSol != null && solUsd ? c.athMcapSol * solUsd : null),
    volumeUsd: c.volumeSol != null && solUsd ? c.volumeSol * solUsd : null,
  };
}

const cache = new Map();
async function buildFeed(feed) {
  const hit = cache.get(feed);
  if (hit && Date.now() - hit.at < 2000) return hit.body;
  const def = FEEDS[feed];
  let coins = getCoins(feed, def.freshMs);
  let meta = getFeedMeta(feed);
  if ((!coins || !coins.length) && !meta) {
    const snap = readSnapshot(def.file);
    if (snap) { coins = snap.coins || []; meta = snap; }
  }
  const solUsd = await getSolUsd();
  const wd = readSnapshot('watchdog.json');
  const quarantine = new Map((wd?.leaks || []).map((l) => [l.mint, l.reason]));
  const revived = new Set((wd?.revivals || []).map((r) => r.mint));
  const cleared = new Set((wd?.falseBlocks || []).map((f) => f.mint));
  const body = {
    updatedAt: meta?.updatedAt ?? 0,
    ws: meta?.ws,
    api: meta?.api,
    stats: meta?.stats,
    scanner: meta?.scanner,
    solUsd,
    coins: (coins || []).map((c) => {
      const e = enrichCoin(c, solUsd);
      const qr = quarantine.get(e.mint);
      if (qr) { e.hidden = true; e.hideReason = e.hideReason || `watchdog:${qr}`; }
      else if (revived.has(e.mint)) {
        e.hidden = false; e.hideReason = null; e.bundled = false;
        e.dipPct = 0; e.maxDipPct = 0; e.revived = true;
      }
      else if (cleared.has(e.mint)) {
        e.hidden = false; e.hideReason = null; e.bundled = false;
      }
      return e;
    }),
  };
  cache.set(feed, { at: Date.now(), body });
  return body;
}

async function resolveMeta(mints) {
  const out = {};
  const missing = [];
  for (const m of mints) (metaCache[m] ? (out[m] = metaCache[m]) : missing.push(m));
  for (const m of missing.slice(0, 25)) {
    try {
      const c = await getCoin(m);
      out[m] = metaCache[m] = { name: c?.name ?? null, symbol: c?.symbol ?? null, image: c?.image ?? null };
    } catch { out[m] = { name: null, symbol: null, image: null }; }
  }
  writeSnapshot('token-meta.json', metaCache);
  return out;
}

async function startServer() {
  const app = express();

  // CORS headers middleware for API routes
  app.use('/api', (req, res, next) => {
    res.setHeader('access-control-allow-origin', '*');
    res.setHeader('access-control-allow-headers', 'x-api-key, content-type');
    res.setHeader('cache-control', 'no-store');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  // Rate limit and auth middleware for API routes
  app.use('/api', (req, res, next) => {
    if (req.path === '/health' || req.path === '/watchdog') return next();
    const id = req.headers['x-api-key'] || req.query.key || req.ip || 'anon';
    if (!rateOk(id)) return res.status(429).json({ error: 'rate limit exceeded' });
    if (!authed(req)) return res.status(401).json({ error: 'invalid or missing api key' });
    next();
  });

  // API Endpoints
  app.get('/api/health', (req, res) => res.json({ ok: true, time: Date.now() }));
  app.get('/api/watchdog', (req, res) => {
    res.json(readSnapshot('watchdog.json') || { lastRun: 0, tradableCount: 0, leakCount: 0, leaks: [], quarantine: [] });
  });

  app.get('/api/old', async (req, res) => {
    try { res.json(await buildFeed('old')); } catch (e) { res.status(500).json({ error: String(e?.message || e) }); }
  });
  app.get('/api/bonded', async (req, res) => {
    try { res.json(await buildFeed('bonded')); } catch (e) { res.status(500).json({ error: String(e?.message || e) }); }
  });
  app.get('/api/new', async (req, res) => {
    try { res.json(await buildFeed('new')); } catch (e) { res.status(500).json({ error: String(e?.message || e) }); }
  });

  app.get('/api/token-meta', async (req, res) => {
    try {
      const mints = String(req.query.mints || '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 60);
      res.json({ meta: await resolveMeta(mints) });
    } catch (e) {
      res.status(500).json({ error: String(e?.message || e) });
    }
  });

  // Vite Middleware for Frontend in Dev mode, or express static in Prod
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(root, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Lily Server] http://0.0.0.0:${PORT} keys:${API_KEYS.size ? 'on' : 'off'} rate:${config.rateLimitPerMin}/min`);
  });
}

startServer();
