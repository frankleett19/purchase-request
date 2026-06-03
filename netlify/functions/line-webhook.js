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
      if (ev.type !== 'message' || !ev.replyToken || !token) continue;
      const src = ev.source || {};
      let text;
      if (src.type === 'group' && src.groupId) {
        // 在群組裡：回覆群組 ID（C 開頭），用來綁定門市群組
        text = '這個群組的 groupId 是：\n' + src.groupId +
          '\n\n請把這串（C 開頭）對應到門市，填到員購系統的門市群組設定。';
      } else if (src.userId) {
        // 一對一：回覆個人 userId
        text = '你的 LINE userId 是：\n' + src.userId +
          '\n\n請把這串（U 開頭）填到員購系統的「LINE User ID」欄位。';
      } else {
        continue;
      }
      await fetch(LINE_REPLY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ replyToken: ev.replyToken, messages: [{ type: 'text', text }] }),
      });
    }
  } catch (e) {
    // webhook 一律回 200，避免 LINE 重送
  }
  return { statusCode: 200, body: 'ok' };
};
