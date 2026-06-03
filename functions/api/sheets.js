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

    // 移除使用者物件中的敏感欄位（密碼）。lineUserId 保留給通知用。
    const stripPass = (users) => {
      if (!users || typeof users !== 'object') return users;
      const out = {};
      for (const [k, v] of Object.entries(users)) {
        if (v && typeof v === 'object') {
          const { pass, password, ...rest } = v;
          out[k] = rest;
        } else {
          out[k] = v;
        }
      }
      return out;
    };

    // 共用：向 GAS 取得完整資料
    const fetchGas = async (body) => {
      const r = await fetch(GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        redirect: 'follow',
      });
      const t = await r.text();
      try { return { ok: r.ok, data: JSON.parse(t) }; }
      catch (_) { return { ok: r.ok, data: { ok: r.ok, raw: t } }; }
    };

    // ── 伺服器端登入：驗證帳密，回傳不含密碼的使用者 ──
    if (params.action === 'login') {
      const username = String(params.username || '').trim();
      const password = String(params.password || '');
      const { data } = await fetchGas({ action: 'getAll' });
      const users = (data && data.users) || {};
      const u = users[username];
      const valid = u && String(u.pass ?? u.password ?? '') === password;
      if (!valid) {
        return new Response(JSON.stringify({ ok: false, error: '帳號或密碼錯誤' }), { status: 200, headers: CORS });
      }
      const { pass, password: _pw, ...safeUser } = u;
      return new Response(JSON.stringify({ ok: true, username, user: safeUser }), { status: 200, headers: CORS });
    }

    // ── 儲存帳號：保留既有密碼（前端不再持有明文密碼）──
    if (params.action === 'saveUsers') {
      let incoming = {};
      try { incoming = JSON.parse(params.data || '{}'); } catch (_) { incoming = {}; }
      const { data: cur } = await fetchGas({ action: 'getAll' });
      const existing = (cur && cur.users) || {};
      for (const [uid, u] of Object.entries(incoming)) {
        if (!u || typeof u !== 'object') continue;
        const hasPass = u.pass != null && String(u.pass).length > 0;
        if (!hasPass) {
          // 沿用既有密碼；全新帳號則預設 1234
          u.pass = (existing[uid] && existing[uid].pass) || '1234';
        }
      }
      const merged = { ...params, data: JSON.stringify(incoming) };
      const { data: saveRes } = await fetchGas(merged);
      return new Response(JSON.stringify(saveRes), { status: 200, headers: CORS });
    }

    // ── 其他動作：照常轉發 GAS，但 getAll 回傳前濾掉密碼 ──
    const { ok, data: payload } = await fetchGas(params);
    if (payload && payload.users) payload.users = stripPass(payload.users);

    return new Response(JSON.stringify(payload), { status: 200, headers: CORS });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 500, headers: CORS });
  }
}
