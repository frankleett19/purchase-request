// ============================================================
// Cloudflare Pages Function：LINE 推播
// 路由：POST /api/notify
// body: { type, to, data }
//   type : 'submitted' | 'approved' | 'rejected' | 'pending_review' | 'monthly_summary'
//   to   : 單一 userId 字串，或 userId 陣列（多人各推一則）
//   data : 帶入 Flex 的動態欄位（見 _flexTemplates.js 各 build* 的欄位）
// 使用 LINE Messaging API Push endpoint。
// ============================================================

import { buildMessage } from './_flexTemplates.js';

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

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') return new Response('', { status: 204, headers: CORS });
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'method not allowed' }), { status: 405, headers: CORS });
  }

  const token = env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    return new Response(JSON.stringify({ ok: false, error: '缺少 LINE_CHANNEL_ACCESS_TOKEN 環境變數' }), { status: 500, headers: CORS });
  }

  try {
    const raw = await request.text();
    const { type, to, data } = JSON.parse(raw || '{}');
    if (!type || !to) {
      return new Response(JSON.stringify({ ok: false, error: '缺少 type 或 to' }), { status: 400, headers: CORS });
    }

    const message = buildMessage(type, data || {}, env.SITE_URL);
    const targets = Array.isArray(to) ? to.filter(Boolean) : [to];
    if (!targets.length) {
      return new Response(JSON.stringify({ ok: true, skipped: '無有效 userId' }), { status: 200, headers: CORS });
    }

    const results = await Promise.all(targets.map((uid) => pushTo(uid, message, token)));
    const allOk = results.every((r) => r.ok);

    return new Response(JSON.stringify({ ok: allOk, results }), { status: 200, headers: CORS });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 500, headers: CORS });
  }
}
