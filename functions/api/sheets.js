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
        headers: { 'Content-Type': 'application/json'