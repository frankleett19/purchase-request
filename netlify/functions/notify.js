// ============================================================
// Netlify Function：LINE 推播
// 端點：POST /api/notify
// body: { type, to, data }
//   type : 'submitted' | 'approved' | 'rejected' | 'pending_review' | 'monthly_summary'
//   to   : 單一 userId 字串，或 userId 陣列（多人各推一則）
//   data : 帶入 Flex 的動態欄位（見 flexTemplates.js 各 build* 的欄位）
// 使用 LINE Messaging API v3 Push endpoint。
// ============================================================

const { buildMessage } = require('./flexTemplates');

const LINE_PUSH_URL = 'https://api.line.me/v2/bot/message/push';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json; charset=utf-8',
};

async function pushTo(userId, message, token) {
  const resp = await fetch(LINE_PUSH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token,
    },
    body: JSON.stringify({ to: userId, messages: [message] }),
  });
  const text = await resp.text();
  return { userId, status: resp.status, ok: resp.ok, body: text };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ ok: false, error: 'method not allowed' }) };
  }

  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ ok: false, error: '缺少 LINE_CHANNEL_ACCESS_TOKEN 環境變數' }) };
  }

  try {
    const { type, to, data } = JSON.parse(event.body || '{}');
    if (!type || !to) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ ok: false, error: '缺少 type 或 to' }) };
    }

    const message = buildMessage(type, data || {});
    const targets = Array.isArray(to) ? to.filter(Boolean) : [to];
    if (!targets.length) {
      return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, skipped: '無有效 userId' }) };
    }

    const results = await Promise.all(targets.map((uid) => pushTo(uid, message, token)));
    const allOk = results.every((r) => r.ok);

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ ok: allOk, results }),
    };
  } catch (err) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ ok: false, error: String(err) }) };
  }
};
