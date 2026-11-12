'use strict';

/**
 * Vercel Serverless Function — proxy ราคาน้ำมันบางจาก
 *
 *   GET /api/oil  →  JSON จาก API ต้นทาง
 *
 * ใช้แทน server.js เมื่อ deploy บน Vercel (server.js ยังใช้รันในเครื่องได้)
 * API ต้นทางไม่ส่ง header CORS จึงต้องดึงผ่าน function ฝั่งเซิร์ฟเวอร์
 */

const UPSTREAM = 'https://oil-price.bangchak.co.th/ApiOilPrice2/th';

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  try {
    const upstream = await fetch(UPSTREAM, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'bangchak-oil/1.0 (+vercel)',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!upstream.ok) throw new Error(`upstream responded ${upstream.status}`);

    const body = await upstream.text();
    JSON.parse(body); // กันข้อมูลเสียหายก่อนส่งต่อ

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60, stale-while-revalidate=300');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.status(200).send(body);
  } catch (err) {
    console.error('[api/oil]', err.message);
    res.setHeader('Cache-Control', 'no-store');
    res.status(502).json({ error: 'upstream_unavailable', message: err.message });
  }
};
