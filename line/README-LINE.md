# 三花生活館員購系統 — LINE Flex Message 通知整合

## 架構概覽

沿用現有的前後端分離架構，推播邏輯放在 Netlify Functions（Node.js），不動現有系統主流程：

```
前端 index.html
   │  事件發生（送出 / 核准 / 退回）
   ▼
POST /api/notify  ──►  netlify/functions/notify.js
                            │ 依 type 組 Flex（flexTemplates.js）
                            ▼
                       LINE Messaging API v3  Push（api.line.me）
                            ▼
                       使用者的 LINE

月底排程：netlify/functions/monthly-summary.js（Netlify Scheduled Function）
   讀 Apps Script getAll → 算每人本月摘要 → 推播
```

## 交付物對照

| 檔案 | 用途 |
| --- | --- |
| `line/flex/01-submitted.json` ~ `05-monthly-summary.json` | 5 種 Flex 純 JSON，可直接貼入 [Flex Message Simulator](https://developers.line.biz/flex-simulator/) 預覽 |
| `netlify/functions/flexTemplates.js` | 後端共用 Flex 產生器（與 JSON 同設計，帶入動態欄位） |
| `netlify/functions/notify.js` | `POST /api/notify` 推播端點 |
| `netlify/functions/monthly-summary.js` | 月底自動摘要（含手動觸發） |
| `.env.example` | 環境變數範本 |

## 5 種通知與觸發時機

| type | 推送對象 | 觸發點（index.html） |
| --- | --- | --- |
| `submitted` | 申請員工（目前登入者） | `doSubmitNew()` 送出成功後 |
| `pending_review` | 督導（role=supervisor） | `doSubmitNew()` 送出成功後 |
| `approved` | 申請員工 | `doAdminApprove()` 放行後 |
| `rejected` | 申請員工 | `doReject()` 退回後 |
| `monthly_summary` | 所有有綁定的帳號 | `monthly-summary.js` 每月最後一天 |

動態欄位（`{{placeholder}}`）由前端在呼叫 `notify(type, to, data)` 時帶入 `data`，例如送出時帶
`{ empName, store, submitTime, orderId }`。對應關係見 `flexTemplates.js` 各 `build*` 函式。

---

## 設定步驟

### 1. 建立 LINE Messaging API channel
1. 登入 [LINE Developers Console](https://developers.line.biz/console/)。
2. 建立一個 Provider（若還沒有）→ 在其下「Create a new channel」→ 選 **Messaging API**。
3. 填基本資料（channel 名稱、類別等）建立完成。

### 2. 取得 Channel access token
1. 進入該 channel → **Messaging API** 分頁。
2. 找到「Channel access token (long-lived)」→ 按 **Issue** → 複製這串 token。
3. 貼到 Netlify：Site settings → Environment variables → 新增 `LINE_CHANNEL_ACCESS_TOKEN`。

### 3. 取得每位使用者的 User ID（推播一定要有）
推播的 `to` 必須是該使用者的 LINE **userId**（U 開頭那串）。本系統把它存在帳號資料的 `lineUserId` 欄位。最簡單的取得方式：

**方法一：用官方帳號 webhook 抓（建議正式用）**
1. 在上面那個 channel 的 Messaging API 分頁打開「Use webhook」。
2. 員工用手機加這個官方帳號為好友、或傳一則訊息。
3. webhook 事件的 `source.userId` 就是該員工的 userId（需自架一支簡單 webhook 接收，或先用下面方法二）。

**方法二：先手動測（最快）**
1. 加官方帳號好友後，在 LINE Developers Console 的「Messaging API → 」或用 webhook 工具看一次事件，取得自己的 userId。
2. 登入員購系統用 `ceo` 進「帳號管理」→ 編輯帳號 → 把 userId 貼進新欄位「LINE User ID」→ 儲存（會寫回 Google Sheets）。

> 小提醒：userId 不是 LINE ID（@xxxx），是 U 開頭 33 碼的字串，只能從 Bot 事件取得。

### 4. 設定環境變數
照 `.env.example`，在 Netlify 後台至少設 `LINE_CHANNEL_ACCESS_TOKEN`。設定後要 **重新部署**（或 Trigger deploy）才會生效。

---

## 測試步驟

### A. 先用 Simulator 看版型
把 `line/flex/*.json` 任一檔內容貼到 [Flex Message Simulator](https://developers.line.biz/flex-simulator/)，確認手機版顯示正常（`{{...}}` 會原樣顯示，正式推播時才會被換成真值）。

### B. 測單則推播（curl）
把 `<YOUR_USER_ID>` 換成你已綁定的 userId：

```bash
curl -X POST https://stately-manatee-fc25ff.netlify.app/api/notify \
  -H "Content-Type: application/json" \
  -d '{
    "type": "submitted",
    "to": "<YOUR_USER_ID>",
    "data": { "empName": "王曉明", "store": "05民生", "submitTime": "2026/05/29 10:30", "orderId": "EP260529-001" }
  }'
```
成功會回 `{"ok":true,...}`，手機 LINE 收到綠色「員購申請已送出」卡片。

### C. 測完整流程
1. 把店長/督導/你自己的 userId 都填到對應帳號的 LINE User ID。
2. 在系統送出一張申請單 → 申請者收到 `submitted`、督導收到 `pending_review`。
3. 行政放行 → 申請者收到 `approved`。
4. 退回一張 → 申請者收到 `rejected`。

### D. 測月底摘要（不用等月底）
```bash
curl "https://stately-manatee-fc25ff.netlify.app/.netlify/functions/monthly-summary?force=1"
```
`force=1` 會略過「最後一天」判斷，立即對所有已綁定帳號推送本月摘要。

---

## 疑難排解
- 回 `缺少 LINE_CHANNEL_ACCESS_TOKEN` → 環境變數沒設或沒重新部署。
- 回 `ok:false` 且 results 內 status 401 → token 錯或過期，重新 Issue。
- 回 status 400、message `Invalid to` → userId 格式不對（要 U 開頭那串，不是 @ID）。
- 沒報錯但沒收到 → 該使用者沒加官方帳號好友，或封鎖了官方帳號。
