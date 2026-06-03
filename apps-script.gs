/**
 * 三花生活館 員購系統 — Google Apps Script 後端
 *
 * 部署方式：
 *  1. 開啟你的 Google Sheet（ID: 12yVB68JuDwZAknbjmuqhoZgBHF0J-bdOAyoC-NC3SKs）
 *  2. 擴充功能 → Apps Script，把這份貼上覆蓋
 *  3. 部署 → 新增部署 → 類型「網頁應用程式」
 *     - 執行身分：我自己
 *     - 具有存取權的使用者：所有人
 *  4. 複製新的 /exec 網址（若網址有變，要同步更新 netlify/functions/sheets.js 的 GAS_URL）
 *
 * 資料以「單一儲存格存 JSON」的方式保存，最穩定也最簡單：
 *   工作表 DATA：A1=users(JSON), A2=orders(JSON), A3=rejectLog(JSON)
 */

var SHEET_ID = '12yVB68JuDwZAknbjmuqhoZgBHF0J-bdOAyoC-NC3SKs';
var TAB = 'DATA';

function getSheet_() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sh = ss.getSheetByName(TAB);
  if (!sh) {
    sh = ss.insertSheet(TAB);
    sh.getRange('A1').setValue('{}');   // users
    sh.getRange('A2').setValue('[]');   // orders
    sh.getRange('A3').setValue('[]');   // rejectLog
  }
  return sh;
}

function readCell_(row) {
  var v = getSheet_().getRange('A' + row).getValue();
  if (!v) return null;
  try { return JSON.parse(v); } catch (e) { return null; }
}

function writeCell_(row, obj) {
  getSheet_().getRange('A' + row).setValue(JSON.stringify(obj));
}

// 統一輸出（同時支援 JSONP callback，向下相容舊的讀取方式）
function out_(obj, callback) {
  var json = JSON.stringify(obj);
  if (callback) {
    return ContentService
      .createTextOutput(callback + '(' + json + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

// 把參數正規化（POST body 的 JSON 或 GET query 都能用）
function parseParams_(e) {
  var p = {};
  if (e && e.postData && e.postData.contents) {
    try { p = JSON.parse(e.postData.contents); } catch (err) { p = {}; }
  }
  if (e && e.parameter) {
    for (var k in e.parameter) { if (!(k in p)) p[k] = e.parameter[k]; }
  }
  return p;
}

function handle_(e) {
  var p = parseParams_(e);
  var action = p.action || 'getAll';
  var callback = p.callback || null;

  // data 欄位可能是已 stringify 的字串，也可能是物件
  function payload() {
    var d = p.data;
    if (typeof d === 'string') { try { return JSON.parse(d); } catch (err) { return d; } }
    return d;
  }

  switch (action) {
    case 'getAll':
      return out_({
        ok: true,
        users: readCell_(1) || {},
        orders: readCell_(2) || [],
        rejectLog: readCell_(3) || [],
        stores: readCell_(4) || []
      }, callback);

    case 'saveUsers':
      writeCell_(1, payload() || {});
      return out_({ ok: true }, callback);

    case 'saveOrders':
      writeCell_(2, payload() || []);
      return out_({ ok: true }, callback);

    case 'saveRejectLog':
      writeCell_(3, payload() || []);
      return out_({ ok: true }, callback);

    case 'saveStores':
      writeCell_(4, payload() || []);
      return out_({ ok: true }, callback);

    // 向下相容：分批存單（合併進現有 orders）
    case 'saveOrdersBatch':
      var all = readCell_(2) || [];
      var start = parseInt(p.start, 10) || 0;
      var batch = payload() || [];
      for (var i = 0; i < batch.length; i++) { all[start + i] = batch[i]; }
      if (p.total) all = all.slice(0, parseInt(p.total, 10));
      writeCell_(2, all);
      return out_({ ok: true }, callback);

    default:
      return out_({ ok: false, error: 'unknown action: ' + action }, callback);
  }
}

function doGet(e)  { return handle_(e); }   // 讀取 + JSONP 相容
function doPost(e) { return handle_(e); }   // 寫入（主要路徑）
