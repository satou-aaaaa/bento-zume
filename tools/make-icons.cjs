// アプリのアイコン（icon-192.png・icon-512.png）を作る。木のお弁当箱に色とりどりのおかず。
// 使い方: node tools/make-icons.cjs（qa/ の playwright を使う）
const path = require("path");
const { chromium } = require(path.join(__dirname, "..", "qa", "node_modules", "playwright"));
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  for (const s of [192, 512]) {
    const p = await b.newPage({ viewport: { width: s, height: s } });
    await p.setContent(`<body style="margin:0"><svg width="${s}" height="${s}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" fill="#f4ecdf"/>
      <rect x="12" y="18" width="76" height="64" rx="12" fill="#c98f57" stroke="#9c6a3c" stroke-width="3"/>
      <rect x="19" y="25" width="62" height="50" rx="6" fill="#fbf6ea"/>
      <rect x="21" y="27" width="28" height="22" rx="3" fill="#f6d65a"/><rect x="51" y="27" width="28" height="22" rx="3" fill="#7dbb5c"/>
      <rect x="21" y="51" width="18" height="22" rx="3" fill="#e5533d"/><rect x="41" y="51" width="38" height="22" rx="3" fill="#f2b04c"/></svg></body>`);
    await p.screenshot({ path: path.join(__dirname, "..", `icon-${s}.png`), clip: { x: 0, y: 0, width: s, height: s } });
  }
  await b.close();
})();
