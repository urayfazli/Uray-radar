import fs from 'node:fs';
import path from 'node:path';

function readJsonFile(filename) {
  const possiblePaths = [
    path.resolve(process.cwd(), 'data', filename),
    path.resolve(process.cwd(), '..', 'data', filename),
    path.resolve('/var/task', 'data', filename),
    path.join(process.cwd(), 'data', filename)
  ];

  for (const filePath of possiblePaths) {
    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(content);
      }
    } catch (err) {
      // check next path
    }
  }
  console.warn(`[Netlify Function] Could not find or parse ${filename} in paths:`, possiblePaths);
  return null;
}

// Global in-memory cache for live SOL price
let cachedSolUsd = { price: 180, time: 0 };
async function getSolUsd() {
  if (Date.now() - cachedSolUsd.time < 60_000) {
    return cachedSolUsd.price;
  }
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
    if (res.ok) {
      const data = await res.json();
      if (data?.solana?.usd) {
        cachedSolUsd = { price: data.solana.usd, time: Date.now() };
        return data.solana.usd;
      }
    }
  } catch (e) {
    // ignore
  }
  return cachedSolUsd.price;
}

export async function handler(event, context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  // Normalize path
  const rawPath = event.path || '';
  const cleanPath = rawPath
    .replace(/^\/\.netlify\/functions\/api/, '')
    .replace(/^\/api/, '');

  try {
    // 1. /health
    if (cleanPath === '/health' || cleanPath === '' || cleanPath === '/') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          ok: true,
          time: Date.now(),
          mode: 'netlify-serverless',
          message: 'Uray Radar Netlify Backend is running!',
        }),
      };
    }

    // 2. /watchdog
    if (cleanPath === '/watchdog') {
      const watchdog = readJsonFile('watchdog.json') || {
        lastRun: Date.now(),
        tradableCount: 0,
        leakCount: 0,
        leaks: [],
        quarantine: [],
      };
      return { statusCode: 200, headers, body: JSON.stringify(watchdog) };
    }

    // 3. /old
    if (cleanPath === '/old') {
      const snapshot = readJsonFile('old.json') || { coins: [] };
      const solUsd = await getSolUsd();
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          updatedAt: Date.now(),
          solUsd,
          stats: snapshot.stats || { total: snapshot.coins?.length || 0 },
          coins: snapshot.coins || [],
        }),
      };
    }

    // 4. /bonded
    if (cleanPath === '/bonded') {
      const snapshot = readJsonFile('bonded.json') || { coins: [] };
      const solUsd = await getSolUsd();
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          updatedAt: Date.now(),
          solUsd,
          stats: snapshot.stats || { total: snapshot.coins?.length || 0 },
          coins: snapshot.coins || [],
        }),
      };
    }

    // 5. /new
    if (cleanPath === '/new') {
      const snapshot = readJsonFile('new.json') || { coins: [] };
      const solUsd = await getSolUsd();
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          updatedAt: Date.now(),
          solUsd,
          stats: snapshot.stats || { total: snapshot.coins?.length || 0 },
          coins: snapshot.coins || [],
        }),
      };
    }

    // 6. /token-meta
    if (cleanPath === '/token-meta') {
      const metaSnapshot = readJsonFile('token-meta.json') || {};
      const queryParams = event.queryStringParameters || {};
      const mints = (queryParams.mints || '').split(',').map((m) => m.trim()).filter(Boolean);
      
      const meta = {};
      for (const m of mints) {
        meta[m] = metaSnapshot[m] || { name: null, symbol: null, image: null };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ meta }),
      };
    }

    // Unmatched path
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: `Path not found: ${cleanPath}` }),
    };
  } catch (error) {
    console.error('[Netlify Function Handler Error]:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: String(error?.message || error) }),
    };
  }
}
