// ============================================================
// LINE Webhook：抓 userId 用的小工具
// 端點：POST /.netlify/functions/line-webhook
// 任何人對官方帳號傳訊息，Bot 會回覆對方自己的 userId，方便填入帳號管理。
// 設定：LINE Official Account Manager → Messaging API → Webhook網址 填本端點，並開啟 Webhook。
// ============================================================

const LINE_REPLY_URL = 'https://api.line.me/v2/bot/message/reply';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 200, body: 'ok' };
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;

  try {
    const body = JSON.parse(event.body || '{}');
    const events = body.events || [];
    for (const ev of events) {
      const userId = ev.source && ev.source.userId;
      if (ev.type === 'message' && ev.replyToken && userId && token) {
        await fetch(LINE_REPLY_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
          body: JSON.stringify({
            replyToken: ev.replyToken,
            messages: [{ type: 'text', text: '你的 LINE userId 是：\n' + userId + '\n\n請把這串（U 開頭）填到員購系統的「LINE User ID」欄位。' }],
          }),
        });
      }
    }
  } catch (e) {
    // webhook 一律回 200，避免 LINE 重送
  }
  return { statusCode: 200, body: 'ok' };
};
