#!/usr/bin/env node
/**
 * Static server + proxy สำหรับ Bangchak Oil Price API (zero dependency)
 *
 *   node server.js          → http://localhost:3000
 *   PORT=8080 node server.js
 *
 * จำเป็นต้องมี proxy เพราะ API ต้นทางไม่ส่ง header CORS
 * ทำให้ fetch จากเบราว์เซอร์ตรง ๆ ถูกบล็อก
 */

const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');

const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
const UPSTREAM = 'https://oil-price.bangchak.co.th/ApiOilPrice2/th';
const CACHE_MS = 60_000; // แคชฝั่งเซิร์ฟเวอร์ 1 นาที

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

let cache = { at: 0, body: '' };

async function getOilPrice() {
  if (cache.body && Date.now() - cache.at < CACHE_MS) {
    return { body: cache.body, cached: true };
  }

  const res = await fetch(UPSTREAM, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'oil-price-demo/1.0 (+local development)',
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) throw new Error(`upstream responded ${res.status}`);

  const body = await res.text();
  JSON.parse(body); // กันข้อมูลเสียหายก่อนใส่แคช
  cache = { at: Date.now(), body };
  return { body, cached: false };
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  });
  res.end(body);
}

async function serveStatic(req, res, pathname) {
  const rel = pathname === '/' ? 'index.html' : decodeURIComponent(pathname.slice(1));
  const filePath = path.resolve(ROOT, rel);

  // ป้องกัน path traversal
  if (!filePath.startsWith(ROOT + path.sep) && filePath !== path.join(ROOT, 'index.html')) {
    return send(res, 403, 'Forbidden');
  }

  try {
    const stat = await fs.stat(filePath);
    if (stat.isDirectory()) return send(res, 404, 'Not found');
    const data = await fs.readFile(filePath);
    const type = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    return send(res, 200, data, {
      'Content-Type': type,
      'Cache-Control': type.startsWith('text/html') ? 'no-store' : 'public, max-age=0, must-revalidate',
      'Content-Length': data.length,
    });
  } catch {
    return send(res, 404, 'Not found');
  }
}

const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (pathname === '/api/oil') {
    try {
      const { body, cached } = await getOilPrice();
      return send(res, 200, body, {
        'Content-Type': MIME['.json'],
        'Access-Control-Allow-Origin': '*',
        'X-Proxy-Cache': cached ? 'HIT' : 'MISS',
      });
    } catch (err) {
      console.error('[proxy]', err.message);
      return send(res, 502, JSON.stringify({ error: 'upstream_unavailable', message: err.message }), {
        'Content-Type': MIME['.json'],
        'Access-Control-Allow-Origin': '*',
      });
    }
  }

  if (pathname === '/healthz') {
    return send(res, 200, 'ok', { 'Content-Type': 'text/plain; charset=utf-8' });
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return send(res, 405, 'Method not allowed', { Allow: 'GET, HEAD' });
  }

  return serveStatic(req, res, pathname);
});

server.listen(PORT, () => {
  console.log(`\n  ราคาน้ำมันบางจาก\n  → http://localhost:${PORT}\n`);
  console.log(`  proxy: /api/oil  (แคช ${CACHE_MS / 1000} วินาที)`);
  console.log('  กด Ctrl+C เพื่อหยุด\n');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  พอร์ต ${PORT} ถูกใช้งานอยู่ — ลองรันด้วยพอร์ตอื่น:`);
    console.error(`  PORT=3001 node server.js\n`);
  } else {
    console.error('\n  เปิดเซิร์ฟเวอร์ไม่สำเร็จ:', err.message, '\n');
  }
  process.exit(1);
});
