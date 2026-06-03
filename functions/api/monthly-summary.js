// ============================================================
// Cloudflare Pages Function：每月最後一天推播員購使用摘要
// 路由：GET /api/monthly-summary  （程式內判斷「明天是否為 1 號」才真正發送）
//   手動 / 測試：GET /api/monthly-summary?force=1 （略過最後一天判斷）
//
// ⚠️ Cloudflare Pages 沒有原生 cron。請用外部排程每天打這個端點一次：
//   方案A（建議，免費）：cron-job.org 設每天 09:00 (台北) 觸發此 URL
//   方案B：GAS 時間驅動觸發器 UrlFetchApp.fetch(此URL)
//   端點本身有「最後一天」防呆，所以每天打也只會在月底真正發送。
//
// 資料來源：呼叫 Apps Script getAll 取得 users / orders，
// 依每位有 lineUserId 的帳號彙整其本月申請，推送摘要。
// ============================================================

import { buildMessage } from './_flexTemplates.js';

const GAS_URL_DEFAULT = 'https://script.google.com/macros/s/AKfycbx0INZrbtCitxj-ag0WoJFDVJOpW-DW2ZZrS6h9T8tGKFf8Mf_zcxaLA1Qvl39xIqW_7A/exec';
const LINE_PUSH_URL = 'https://api.line.me/v2/bot/message/push';

// 台北時間（UTC+8）
function nowTPE() {
  return new Date(Date.now() + 8 * 3600 * 1000);
}
function isLastDayOfMonth(d) {
  const t = new Date(d.getTime());
  t.setUTCDate(t.getUTCDate() + 1);
  return t.getUTCDate() === 1;
}
function ym(dateStr) {
  if (!dateStr) return null;
  const m = String(dateStr).match(/(\d{4})\D+(\d{1,2})/);
  if (!m) return null;
  return { y: +m[1], m: +m[2] };
}

async function getData(GAS_URL) {
  const resp = await fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'getAll' }),
  });
  return await resp.json();
}

async function pushTo(userId, message, token) {
  const resp = await fetch(LINE_PUSH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({ to: userId, messages: [message] }),
  });
  return { userId, status: resp.status, ok: resp.ok };
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const force = url.searchParams.get('force') === '1';
  const tpe = nowTPE();

  const GAS_URL = env.GAS_URL || GAS_URL_DEFAULT;
  const SITE = env.SITE_URL || 'https://purchase-request.pages.dev';
  const MONTHLY_QUOTA = Number(env.MONTHLY_QUOTA || 0);

  if (!force && !isLastDayOfMonth(tpe)) {
    return new Response(JSON.stringify({ ok: true, skipped: '今天不是當月最後一天' }), { status: 200 });
  }

  const token = env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return new Response(JSON.stringify({ ok: false, error: '缺少 LINE_CHANNEL_ACCESS_TOKEN' }), { status: 500 });

  try {
    const data = await getData(GAS_URL);
    const users = data.users || {};
    const orders = data.orders || [];

    const curY = tpe.getUTCFullYear();
    const curM = tpe.getUTCMonth() + 1;
    const monthLabel = curY + ' 年 ' + curM + ' 月';

    const results = [];
    for (const uid of Object.keys(users)) {
      const u = users[uid];
      if (!u || !u.lineUserId) continue;

      const mine = orders.filter((o) => {
        const t = ym(o.date);
        if (!t || t.y !== curY || t.m !== curM) return false;
        return o.emp === u.name || (u.store && o.store === u.store);
      });

      const approved = mine.filter((o) => o.status === 'approved' || o.status === 'ready');
      const pending = mine.filter((o) => o.status === 'pending_sup' || o.status === 'pending_admin');
      const usedAmount = approved.reduce((s, o) => s + (o.total || 0), 0);

      const msg = buildMessage('monthly_summary', {
        empName: u.name,
        monthLabel,
        totalCount: mine.length,
        approvedCount: approved.length,
        pendingCount: pending.length,
        usedAmount,
        remainingQuota: MONTHLY_QUOTA ? Math.max(0, MONTHLY_QUOTA - usedAmount) : null,
        historyUrl: SITE + '/#history',
      }, SITE);

      results.push(await pushTo(u.lineUserId, msg, token));
    }

    return new Response(JSON.stringify({ ok: true, month: monthLabel, sent: results.length, results }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 500 });
  }
}
