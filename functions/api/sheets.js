// ============================================================
// Cloudflare Pages Function：中間層 proxy 到 Google Apps Script
// 路由：/api/sheets （由檔案路徑自動對應，免 redirect 設定）
// 解決前端直接呼叫 GAS 的 CORS 與 GET URL 長度限制問題。
// ============================================================

const GAS_URL_DEFAULT = 'https://script.google.com/macros/s/AKfycbx0INZrbtCitxj-ag0WoJFDVJOpW-DW2ZZrS6h9T8tGKFf8Mf_zcxaLA1Qvl39xIqW_7A/exec';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json; charset=utf-8',
};

export async function onRequest(context) {
  const { request, env } = context;
  const GAS_URL = env.GAS_URL || GAS_URL_DEFAULT;

  // CORS 預檢
  if (request.method === 'OPTIONS') {
    return new Response('', { status: 204, headers: CORS });
  }

  try {
    // 取得前端送來的參數（POST body 或 GET query）
    let params = {};
    if (request.method === 'POST') {
      const body = await request.text();
      if (body) params = JSON.parse(body);
    } else {
      const url = new URL(request.url);
      params = Object.fromEntries(url.searchParams.entries());
    }

    // 以 POST 轉發給 GAS（body 沒有長度限制，且 server 端呼叫沒有 CORS）
    const resp = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      redirect: 'follow',
    });

    const text = await resp.text();
    let payload;
    try {
      payload = JSON.parse(text);
    } catch (_) {
      payload = { ok: resp.ok, raw: text };
    }

    return new Response(JSON.stringify(payload), { status: 200, headers: CORS });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 500, headers: CORS });
  }
}
