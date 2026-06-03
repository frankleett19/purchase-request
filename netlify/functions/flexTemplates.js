// ============================================================
// 三花生活館員購系統 — LINE Flex Message 範本（共用模組）
// 每個 build* 函式回傳一個 Flex bubble 物件（已帶入動態欄位）。
// 對應的純 JSON 預覽檔在 /line/flex/*.json（含 {{placeholder}}）。
// 品牌主色：三花紅 #E8001D
// ============================================================

const BRAND = '#E8001D';
const SITE = process.env.SITE_URL || 'https://stately-manatee-fc25ff.netlify.app';

// 小工具：一列「標籤 + 值」
function row(label, value, valueColor, bold) {
  return {
    type: 'box', layout: 'baseline', spacing: 'sm',
    contents: [
      { type: 'text', text: label, color: '#8C8C8C', size: 'xs', flex: 3 },
      { type: 'text', text: String(value == null ? '—' : value), color: valueColor || '#333333',
        size: 'sm', weight: bold ? 'bold' : 'regular', flex: 7, wrap: true }
    ]
  };
}
function btn(label, uri) {
  return { type: 'button', style: 'primary', color: BRAND, height: 'sm',
    action: { type: 'uri', label: label, uri: uri } };
}
function bubble(headerColor, title, subtitle, bodyContents, footerButtons) {
  const header = { type: 'box', layout: 'vertical', backgroundColor: headerColor, paddingAll: '16px',
    contents: [{ type: 'text', text: title, color: '#FFFFFF', weight: 'bold', size: 'lg', wrap: true }] };
  if (subtitle) header.contents.push({ type: 'text', text: subtitle, color: '#CCCCCC', size: 'xs', margin: 'sm' });
  return {
    type: 'bubble', size: 'full',
    header: header,
    body: { type: 'box', layout: 'vertical', spacing: 'md', paddingAll: '16px', contents: bodyContents },
    footer: { type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: '12px', contents: footerButtons }
  };
}
function intro(text) { return { type: 'text', text: text, size: 'sm', color: '#555555', wrap: true }; }
function sep() { return { type: 'separator', margin: 'md' }; }
function group(rows) { return { type: 'box', layout: 'vertical', spacing: 'sm', margin: 'md', contents: rows }; }

// 1) 申請單送出確認 → 申請員工
function buildSubmitted(d) {
  return bubble('#2BB673', '✅ 員購申請已送出', null, [
    intro('您的員購申請單已成功送出，系統已通知店主管進行線上簽核。'),
    sep(),
    group([
      row('申請人', d.empName),
      row('分店', d.store),
      row('申請時間', d.submitTime),
      row('申請單號', d.orderId, BRAND, true)
    ])
  ], [ btn('查看申請單詳情', d.detailUrl || (SITE + '/#order/' + encodeURIComponent(d.orderId || ''))) ]);
}

// 2) 審核通過通知 → 申請員工
function buildApproved(d) {
  return bubble('#1B9E4B', '🟢 您的員購申請已核准', null, [
    intro('恭喜！您的員購申請已通過審核，請依下方取貨方式辦理。'),
    sep(),
    group([
      row('申請單號', d.orderId, BRAND, true),
      row('審核人', d.approverName),
      row('核准時間', d.approveTime),
      row('取貨方式', d.pickupMethod || '至門市倉庫憑單取貨')
    ])
  ], [
    btn('查看訂單', d.detailUrl || (SITE + '/#order/' + encodeURIComponent(d.orderId || ''))),
    btn('取貨說明', d.pickupUrl || (SITE + '/#pickup'))
  ]);
}

// 3) 申請退回通知 → 申請員工
function buildRejected(d) {
  return bubble('#D32030', '🔴 您的員購申請已退回', null, [
    intro('您的員購申請未通過，請參考退回原因修改後重新申請。'),
    sep(),
    group([
      row('申請單號', d.orderId, BRAND, true),
      row('退回時間', d.rejectTime),
      { type: 'box', layout: 'vertical', spacing: 'xs', margin: 'sm', contents: [
        { type: 'text', text: '退回原因', color: '#8C8C8C', size: 'xs' },
        { type: 'text', text: String(d.rejectReason || '—'), color: '#D32030', size: 'sm', wrap: true } ] }
    ])
  ], [ btn('重新申請', d.reapplyUrl || (SITE + '/#new')) ]);
}

// 4) 待審核提醒 → 店長/督導
function buildPendingReview(d) {
  return bubble('#1A6FB5', '📬 您有新的員購申請待審核', null, [
    intro('有員工送出新的員購申請，等待您線上簽核。'),
    sep(),
    group([
      row('申請人', d.empName),
      row('送出時間', d.submitTime),
      row('待審筆數', (d.pendingCount != null ? d.pendingCount : '?') + ' 筆', '#1A6FB5', true)
    ])
  ], [ btn('前往審核後台', d.reviewUrl || (SITE + '/#review')) ]);
}

// 5) 每月員購使用摘要 → 所有員工
function buildMonthlySummary(d) {
  function statRow(label, value, color) {
    return { type: 'box', layout: 'baseline', spacing: 'sm', contents: [
      { type: 'text', text: label, color: '#8C8C8C', size: 'xs', flex: 4 },
      { type: 'text', text: String(value), color: color || '#333333', size: 'sm', flex: 6, align: 'end' } ] };
  }
  return bubble('#4A4A4A', '📅 本月員購使用摘要', d.monthLabel, [
    intro((d.empName || '您') + ' 您好，以下是本月的員購使用情形：'),
    sep(),
    { type: 'box', layout: 'vertical', spacing: 'sm', margin: 'md', contents: [
      statRow('申請筆數', (d.totalCount || 0) + ' 筆'),
      statRow('已核准', (d.approvedCount || 0) + ' 筆', '#1B9E4B'),
      statRow('待審核', (d.pendingCount || 0) + ' 筆', '#B45309'),
      sep(),
      { type: 'box', layout: 'baseline', spacing: 'sm', margin: 'md', contents: [
        { type: 'text', text: '本月使用金額', color: '#8C8C8C', size: 'xs', flex: 4 },
        { type: 'text', text: 'NT$ ' + (d.usedAmount || 0).toLocaleString(), color: BRAND, size: 'sm', weight: 'bold', flex: 6, align: 'end' } ] },
      statRow('剩餘額度', 'NT$ ' + (d.remainingQuota != null ? Number(d.remainingQuota).toLocaleString() : '—'))
    ] }
  ], [ btn('查看完整紀錄', d.historyUrl || (SITE + '/#history')) ]);
}

const BUILDERS = {
  submitted: buildSubmitted,
  approved: buildApproved,
  rejected: buildRejected,
  pending_review: buildPendingReview,
  monthly_summary: buildMonthlySummary,
};

// 依 type 產生完整 message 物件（含 altText）
function buildMessage(type, data) {
  const fn = BUILDERS[type];
  if (!fn) throw new Error('unknown flex type: ' + type);
  const altTexts = {
    submitted: '您的員購申請已送出',
    approved: '您的員購申請已核准',
    rejected: '您的員購申請已退回',
    pending_review: '您有新的員購申請待審核',
    monthly_summary: '本月員購使用摘要',
  };
  return { type: 'flex', altText: altTexts[type] || '員購系統通知', contents: fn(data || {}) };
}

module.exports = { buildMessage, BUILDERS, BRAND };
