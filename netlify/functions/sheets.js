// Netlify Function: 中間層 proxy 到 Google Apps Script
// 解決前端直接呼叫 GAS 的 CORS 與 GET URL 長度限制問題。
// 前端改用 POST 把 payload 放在 body，這裡再以 POST 轉發給 GAS。

const GAS_URL = 'https://script.google.com/macros/s/AKfycbx0INZrbtCitxj-ag0WoJFDVJOpW-DW2ZZrS6h9T8tGKFf8Mf_zcxaLA1Qvl39xIqW_7A/exec';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json; charset=utf-8',
};

exports.handler = async (event) => {
  // CORS 預檢
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }

  try {
    // 取得前端送來的參數（POST body 或 GET query）
    let params = {};
    if (event.httpMethod === 'POST' && event.body) {
      params = JSON.parse(event.body);
    } else if (event.queryStringParameters) {
      params = event.queryStringParameters;
    }

    // 以 POST 轉發給 GAS（body 沒有長度限制，且 server 端呼叫沒有 CORS）
    const resp = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      redirect: 'follow',
    });

    const text = await resp.text();

    // GAS 正常會回 JSON；若回傳非 JSON 也原樣包起來
    let payload;
    try {
      payload = JSON.parse(text);
    } catch (_) {
      payload = { ok: resp.ok, raw: text };
    }

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify(payload),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: CORS,
      body: JSON.stringify({ ok: false, error: String(err) }),
    };
  }
};
