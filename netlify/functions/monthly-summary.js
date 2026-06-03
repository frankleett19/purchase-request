// ============================================================
// Netlify Scheduled Function：每月最後一天推播員購使用摘要
// 排程設定在 netlify.toml：[functions."monthly-summary"] schedule = "0 1 28-31 * *"
//   （每天 UTC 01:00 觸發，程式內判斷「明天是否為 1 號」才真正發送）
// 也可手動觸發：GET /.netlify/functions/monthly-summary?force=1
//   （force=1 會略過「最後一天」判斷，方便測試）
//
// 資料來源：呼叫 Apps Script getAll 取得 users / orders，
// 依每位有 lineUserId 的帳號彙整其本月申請，推送摘要。
// ============================================================

const { buildMessage } = require('./flexTemplates');

const GAS_URL = process.env.GAS_URL ||
  'https://script.google.com/macros/s/AKfycbx0INZrbtCitxj-ag0WoJFDVJOpW-DW2ZZrS6h9T8tGKFf8Mf_zcxaLA1Qvl39xIqW_7A/exec';
const LINE_PUSH_URL = 'https://api.line.me/v2/bot/message/push';
const SITE = process.env.SITE_URL || 'https://stately-manatee-fc25ff.netlify.app';
const MONTHLY_QUOTA = Number(process.env.MONTHLY_QUOTA || 0); // 每人每月額度，0 表示不顯示剩餘額度

// 台北時間（UTC+8）
function nowTPE() {
  return new Date(Date.now() + 8 * 3600 * 1000);
}
function isLastDayOfMonth(d) {
  const t = new Date(d.getTime());
  t.setUTCDate(t.getUTCDate() + 1);
  return t.getUTCDate() === 1;
}

// 把各種日期字串正規化成 {y, m}
function ym(dateStr) {
  if (!dateStr) return null;
  const m = String(dateStr).match(/(\d{4})\D+(\d{1,2})/);
  if (!m) return null;
  return { y: +m[1], m: +m[2] };
}

async function getData() {
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

exports.handler = async (event) => {
  const force = event && event.queryStringParameters && event.queryStringParameters.force === '1';
  const tpe = nowTPE();

  if (!force && !isLastDayOfMonth(tpe)) {
    return { statusCode: 200, body: JSON.stringify({ ok: true, skipped: '今天不是當月最後一天' }) };
  }

  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return { statusCode: 500, body: JSON.stringify({ ok: false, error: '缺少 LINE_CHANNEL_ACCESS_TOKEN' }) };

  try {
    const data = await getData();
    const users = data.users || {};
    const orders = data.orders || [];

    const curY = tpe.getUTCFullYear();
    const curM = tpe.getUTCMonth() + 1;
    const monthLabel = curY + ' 年 ' + curM + ' 月';

    const results = [];
    for (const uid of Object.keys(users)) {
      const u = users[uid];
      if (!u || !u.lineUserId) continue; // 沒綁定 LINE 的略過

      // 本月、屬於此使用者（依姓名或門市）的申請
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
      });

      results.push(await pushTo(u.lineUserId, msg, token));
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true, month: monthLabel, sent: results.length, results }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: String(err) }) };
  }
};
