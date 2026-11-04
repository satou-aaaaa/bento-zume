// SNS で貼られたときの絵（og.png 1200×630）を作る。今日の箱（答え）は入れず、見本の箱だけ。
// 使い方: node tools/make-og.cjs（qa/ の playwright を使う）
const path = require("path");
const B = require(path.join(__dirname, "..", "gen.js"));
const { chromium } = require(path.join(__dirname, "..", "qa", "node_modules", "playwright"));
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
  const box = B.make(7, B.SIZES[0]), own = new Array(16).fill(-1); box.tray.forEach((t) => t.sol.forEach((c) => (own[c] = t.id)));
  const cells = own.map((j, i) => { const t = box.tray[j], first = own.indexOf(j) === i; return `<div style="background:${t.food[2]};display:grid;place-items:center;font-size:54px">${first ? t.food[1] : ""}</div>`; }).join("");
  await p.setContent(`<body style="margin:0;font-family:'Noto Sans CJK JP','IPAPGothic',sans-serif">
  <div style="width:1200px;height:630px;box-sizing:border-box;padding:70px 80px;background:#f4ecdf;color:#3a2a1f;position:relative;overflow:hidden">
    <div style="font-size:34px;color:#9e3b29;letter-spacing:.1em">だれでも同じ 1日3箱・3分</div>
    <div style="font-size:108px;font-weight:900;margin-top:16px;letter-spacing:.06em">お弁当づめ</div>
    <div style="font-size:40px;margin-top:18px;line-height:1.5">形のちがうおかずを、<br>すき間なく詰められる？</div>
    <div style="position:absolute;left:770px;top:150px;width:360px;height:360px;background:#c98f57;border-radius:36px;padding:22px;box-sizing:border-box;box-shadow:inset 0 0 0 6px #9c6a3c,0 10px 0 #6d482633;transform:rotate(4deg)">
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px;background:#fbf6ea;border-radius:14px;padding:6px;width:100%;height:100%;box-sizing:border-box">${cells}</div>
    </div>
  </div></body>`);
  await p.screenshot({ path: path.join(__dirname, "..", "og.png") });
  await b.close();
})();
