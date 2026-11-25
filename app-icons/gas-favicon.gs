// GAS のウェブアプリのタブ・ブックマークのアイコン（GitHub など外部の置き場を使わない）
// 使い方は README.md。ICON_PNG_B64 に make_icon.py --b64 の出力を貼る。
// setup や selfTest から ensureIcon_() を呼び、doGet で setFaviconUrl に iconUrl_() を渡す。

var ICON_PNG_B64 = '（make_icon.py --b64 の出力を貼る）';
var ICON_NAME = 'APP-icon.png'; // ドライブに置く画像の名前（アプリごとに替える）

// 所有者のドライブに PNG を作り、学校のドメインの中だけに共有する。画像を替えた版を貼ると作り直す
function ensureIcon_() {
  var props = PropertiesService.getScriptProperties(), id = props.getProperty('ICON_ID');
  var ver = String(ICON_PNG_B64.length) + ICON_PNG_B64.slice(-16); // 画像の版（中身が変われば変わる）
  if (id && props.getProperty('ICON_VER') === ver) { try { DriveApp.getFileById(id); return id; } catch (e) { /* 消されていたら作り直す */ } }
  if (id) { try { DriveApp.getFileById(id).setTrashed(true); } catch (e) { /* 前の画像が無くても続ける */ } }
  var f = DriveApp.createFile(Utilities.newBlob(Utilities.base64Decode(ICON_PNG_B64), 'image/png', ICON_NAME));
  try { f.setSharing(DriveApp.Access.DOMAIN_WITH_LINK, DriveApp.Permission.VIEW); } // 学校のドメインの中で、リンクを知っている人
  catch (e) { f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } // ドメインの共有が使えない時
  props.setProperty('ICON_ID', f.getId()); props.setProperty('ICON_VER', ver);
  return f.getId();
}
function iconUrl_() {
  var id = PropertiesService.getScriptProperties().getProperty('ICON_ID');
  return id ? 'https://drive.google.com/uc?export=view&id=' + id + '&.png' : ''; // 末尾の &.png は拡張子の見せかけ
}

// doGet の例：アイコンが無くても、失敗しても、画面は開く
function doGet() {
  var out = HtmlService.createHtmlOutputFromFile('Index').setTitle('APP');
  try { var u = iconUrl_(); if (u) out.setFaviconUrl(u); } catch (e) { /* アイコンは無くてよい */ }
  return out;
}
// selfTest の例：実行の記録に ○✕ を出す
function selfTestIcon() { try { console.log('○ タブのアイコン：' + ensureIcon_()); } catch (e) { console.log('✕ タブのアイコン：' + e.message); } }
