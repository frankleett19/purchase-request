// ============================================================
// Cloudflare Pages Function：LINE Webhook（抓 userId / groupId 用）
// 路由：POST /api/line-webhook
// 一對一傳訊 → 回覆對方 userId；群組內傳訊 → 回覆 groupId。
// 設定：LINE Official Account Manager → Messaging API → Webhook網址
//       填  https://<你的網域>/api/line-webhook  並開啟 Webhook。
// 注意：Bot 一進群組就退出，請先到 OA Manager 開「允許加入群組／多人聊天室」。
// ============================================================

const LINE_REPLY_URL = 'https://api.line.me/v2/bot/message/reply';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return new Response('ok', { status: 200 });
  const token = env.LINE_CHANNEL_ACCESS_TOKEN;

  try {
    const raw = await request.text();
    const body = JSON.parse(raw || '{}');
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
  return new Response('ok', { status: 200 });
}
