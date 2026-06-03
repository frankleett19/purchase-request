# Cloudflare Pages 部署說明（取代 Netlify）

## 架構對應
- 靜態：`index.html`、`line/`、圖片 → 直接由 Pages 託管（根目錄）
- 函式：`functions/api/*.js` → 自動對應路由 `/api/*`（免 redirect 設定）
  - `functions/api/sheets.js`        → `/api/sheets`
  - `functions/api/notify.js`        → `/api/notify`
  - `functions/api/line-webhook.js`  → `/api/line-webhook`  ← LINE webhook 新網址
  - `functions/api/monthly-summary.js` → `/api/monthly-summary`
  - `functions/api/_flexTemplates.js`  → 共用模組（底線開頭，不路由）
- 前端 `/api/sheets`、`/api/notify` 路徑**不變**，無需改 index.html。
- 舊 `netlify/` 目錄與 `netlify.toml` 保留作參考，Cloudflare 會忽略。

## Cloudflare Pages 專案設定
- 連結 GitHub repo：`frankleett19/purchase-request`，branch `main`
- Build command：留空（無建置）
- Build output directory：`/`（根目錄）
- Functions 由 `functions/` 自動偵測，免設定

## 環境變數（Pages → Settings → Environment variables，Production）
| 變數 | 值 | 必填 |
|---|---|---|
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE OA 的 channel access token | 是 |
| `SITE_URL` | 部署後的網址，如 `https://purchase-request.pages.dev` | 建議 |
| `GAS_URL` | GAS exec 網址（已內建預設值，可不填） | 否 |
| `MONTHLY_QUOTA` | 每人每月額度，0=不顯示剩餘 | 否 |

## 部署後待辦
1. 取得 Pages 網址後，把 `SITE_URL` 環境變數設成該網址並重新部署。
2. LINE Official Account Manager → Messaging API → Webhook 網址改為：
   `https://<你的網址>/api/line-webhook`，並開啟「使用 Webhook」。
3. **開啟「允許加入群組／多人聊天室」**（OA Manager → 設定 → 回應設定），
   否則 Bot 一進群組就自動退出。

## 月報排程（Cloudflare Pages 無原生 cron）
每天打一次 `https://<你的網址>/api/monthly-summary`（端點內建月底防呆，
非最後一天會自動略過）。免費排程二選一：
- cron-job.org：新增任務，每天台北 09:00 觸發上述 URL（建議）
- 或 GAS 時間驅動觸發器：`UrlFetchApp.fetch('https://<你的網址>/api/monthly-summary')`
測試：手動開 `…/api/monthly-summary?force=1` 會立即發送。
