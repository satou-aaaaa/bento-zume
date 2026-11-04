// お弁当づめの検査。箱の作り方（すき間なく埋まる・何千箱）・3箱の組み方・詰める/回す/戻す・ヒント・続きから・上級・図鑑・記録・スマホ幅・PWA を確かめる。
// 使い方: node qa/run.mjs   失敗があれば終了コード 1。結果は qa-report/report.md。
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const url = pathToFileURL(path.join(root, "index.html")).href;
const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: !!ok, detail });
const B = createRequire(import.meta.url)(path.join(root, "gen.js"));

// 1. 箱の作り方（ブラウザを使わない）。大きさごとに何百箱も作って確かめる
{
  const S = [...B.SIZES, B.HARD], bad = [], dupShape = [], small = [], same = [];
  for (let d = 0; d < 400; d++) S.forEach((sz, si) => {
    const seed = B.seedOf(`qa${d}:${si}`), p = B.make(seed, sz), q = B.make(seed, sz);
    if (!p) { bad.push(`${d}:${si} 作れない`); return; }
    if (JSON.stringify(p) !== JSON.stringify(q)) same.push(`${d}:${si}`);
    // 答え（sol）で、仕切り以外のますがちょうど1回ずつ埋まる
    const N = p.w * p.h, cnt = new Array(N).fill(0);
    p.tray.forEach((t) => t.sol.forEach((c) => cnt[c]++));
    if (p.blocks.length !== sz.block || p.blocks.some((b) => cnt[b]) || cnt.some((n, i) => !p.blocks.includes(i) && n !== 1)) bad.push(`${d}:${si} 埋まらない`);
    // 台のおかずの形は、答えのますの形を回したもの
    if (p.tray.some((t) => !B.rotations(t.cells).map(B.key).includes(B.key(B.norm(t.sol.map((c) => [c % p.w, Math.floor(c / p.w)])))))) bad.push(`${d}:${si} 形がちがう`);
    // 答えのおかずは、ますがつながっている
    if (p.tray.some((t) => { const set = new Set(t.sol), st = [t.sol[0]], seen = new Set(st); while (st.length) { const c = st.pop(); for (const n of [c - 1, c + 1, c - p.w, c + p.w]) if (set.has(n) && !seen.has(n) && (Math.abs((n % p.w) - (c % p.w)) + Math.abs(Math.floor(n / p.w) - Math.floor(c / p.w))) === 1) { seen.add(n); st.push(n); } } return seen.size !== t.sol.length; })) bad.push(`${d}:${si} つながっていない`);
    if (p.tray.some((t) => t.cells.length < sz.min || t.cells.length > sz.max)) small.push(`${d}:${si}`);
    const c = {}; p.tray.forEach((t) => { const k = B.canon(t.cells); c[k] = (c[k] || 0) + 1; }); if (Object.values(c).some((n) => n > 2)) dupShape.push(`${d}:${si}`);
    { const f = {}; p.tray.forEach((t) => { const k = B.canon(t.cells); if (f[t.food[0]] && f[t.food[0]] !== k) dupShape.push(`${d}:${si} おかず`); f[t.food[0]] = k; }); }
    if (p.ways < 1 || B.count(p, 2) < 1) bad.push(`${d}:${si} 詰め方0`);
  });
  check("どの箱も、答えのとおりにすき間なく埋まる・おかずはつながった形（4つの大きさ×400箱）", bad.length === 0, bad.slice(0, 3).join(","));
  check("同じ種からは同じ箱ができる（だれでも同じ問題）", same.length === 0, same.slice(0, 3).join(","));
  check("おかずの大きさは決めた範囲（小2〜4・中3〜4・大3〜5・特盛4〜5）", small.length === 0, small.slice(0, 3).join(","));
  check("同じ形のおかずは1箱に2つまで・形がちがえばちがうおかず（見分けられる）", dupShape.length === 0, dupShape.slice(0, 3).join(","));
  check("特盛は仕切りが2つ（使えないます）", (() => { const p = B.make(1, B.HARD); return p.blocks.length === 2; })());
  { // 詰め方の数を、別の数え方（全部の置き方を試す）で確かめる
    const brute = (p) => { const N = p.w * p.h; let n = 0; const used = new Array(p.tray.length).fill(false), own = new Array(N).fill(false); p.blocks.forEach((b) => (own[b] = true));
      const go = () => { const i = own.indexOf(false); if (i < 0) { n++; return; } for (let j = 0; j < p.tray.length; j++) { if (used[j]) continue; for (const r of B.rotations(p.tray[j].cells)) for (const [ax, ay] of r) { const cs = []; let ok = true; for (const [x, y] of r) { const X = x - ax + (i % p.w), Y = y - ay + Math.floor(i / p.w); if (X < 0 || Y < 0 || X >= p.w || Y >= p.h || own[Y * p.w + X]) { ok = false; break; } cs.push(Y * p.w + X); } if (!ok || cs[0] !== i && !cs.includes(i)) continue; if (Math.min(...cs) !== i) continue; cs.forEach((c) => (own[c] = true)); used[j] = true; go(); used[j] = false; cs.forEach((c) => (own[c] = false)); } } };
      go(); // 同じ形のおかずの入れかえ分を割る
      const c = {}; p.tray.forEach((t) => { const k = B.canon(t.cells); c[k] = (c[k] || 0) + 1; }); let f = 1; for (const v of Object.values(c)) for (let k = 2; k <= v; k++) f *= k; return n / f; };
    const ng = []; for (let d = 0; d < 40; d++) { const p = B.make(B.seedOf("w" + d), B.SIZES[d % 2]); const w = brute(p); if (Math.min(w, 300) !== p.ways) ng.push(`${d}:${p.ways}/${w}`); }
    check("「この箱の詰め方は○通り」の数が、別の数え方と合う", ng.length === 0, ng.slice(0, 3).join(",")); }
}

const html = readFileSync(path.join(root, "index.html"), "utf8");
check("終えた回を消すのは同じ回のときだけ・0時を過ぎたホームの「今日」のボタンは描き直す（2026-11-04 CodeRabbit）", /c\.date === run\.date && c\.id === run\.id\) s2\.runs\[MODE\] = null/.test(html) && /\$\("go-d"\)\.onclick = \(\) => \(k !== todayKey\(\) \? home\(\)/.test(html));
check("別のタブで今日の分を終えたあと、古い画面から今日・上級をもう一度始めない（2026-11-04 CodeRabbit）", /\(mode === "d" && s\.days\[k\]\) \|\| \(mode === "h" && s\.hdays\[k\]\)\) return;/.test(html));
check("README の URL のすぐ後ろに全角の字を続けない（Link check が URL の一部と読む。2026-11-04）", !/https?:\/\/[\x21-\x7e]*[^\x00-\x7f]/.test(readFileSync(new URL("../README.md", import.meta.url), "utf8").replace(/\]\(https?:\/\/[^)\s]+\)/g, "").replace(/<https?:\/\/[^>\s]+>/g, "")));
const ext = [...html.matchAll(/(?:src|href)="(https?:[^"]+)"/g)].map((m) => m[1]).filter((u) => !/^https:\/\/fonts\.googleapis\.com(\/|$)|^https:\/\/ko-fi\.com\/satouaaaaa$/.test(u));
check("外から読むのは文字（Google Fonts）だけ。スクリプト・広告・解析を入れない", ext.length === 0, ext.join(","));
check("CSP で通信先を自分だけにしている", /connect-src 'self'/.test(html) && !/connect-src[^;"]*https/.test(html));
check("Math.random は練習の箱の種だけ（今日の3箱・上級は日付の種）", (html.match(/Math\.random/g) || []).length === 1 && !/Math\.random/.test(readFileSync(path.join(root, "gen.js"), "utf8")));
check("画面にお笑いの言葉を入れない（本物っぽく）", !/お笑い|ギャグ|ボケ|ツッコミ|なんでやねん|（うそ）/.test(html));
{ const og = (k) => (html.match(new RegExp(`<meta (?:property|name)="${k}" content="([^"]+)"`)) || [])[1] || "";
  const png = readFileSync(path.join(root, "og.png"));
  check("SNS で貼ると絵と題が出る（OGP・1200×630・絶対URL）", og("og:title") && og("og:description") && og("og:image") === "https://satou-aaaaa.github.io/bento-zume/og.png" && og("twitter:card") === "summary_large_image" && png.readUInt32BE(16) === 1200 && png.readUInt32BE(20) === 630); }
{ const fy = readFileSync(path.join(root, ".github/ISSUE_TEMPLATE/feedback.yml"), "utf8");
  check("感想フォームは名前・メールを聞かない（楽しさ・よかった所・直してほしい所だけ）", /id: fun/.test(fy) && /id: good/.test(fy) && /id: fix/.test(fy) && !/id: (name|email|mail)/.test(fy) && /labels: \["感想"\]/.test(fy)); }
{ const sw = readFileSync(path.join(root, "sw.js"), "utf8"), mf = JSON.parse(readFileSync(path.join(root, "manifest.webmanifest"), "utf8"));
  const shell = JSON.parse(sw.match(/SHELL = (\[[^\]]+\])/)[1].replace(/'/g, '"'));
  const need = ["./index.html", "./gen.js", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"];
  check("PWA：ネットの返事の保存は、イベントの中で waitUntil に預ける（遅れて届いた新しい版も保存できる）", /e\.waitUntil\(Promise\.race\(\[net\.then[^\n]*Promise\.race\(\[caches\.open[^\n]*wait\(15000\)\]\); \}, \(\) => \{\}\)\.catch\(\(\) => \{\}\), wait\(60000\)\]\)\);/.test(sw) && !/\.then\([^\n]*e\.waitUntil/.test(sw));
  check("PWA：sw.js は画面のファイルを全部保存し、外へ何も送らない", need.every((f) => shell.includes(f)) && !/https?:\/\//.test(sw.replace(/^\/\/.*$/gm, "")));
  check("PWA：manifest にアイコン2つと名前がある", mf.name === "お弁当づめ" && mf.icons.length >= 2 && mf.start_url === "./"); }
{ const src = html + readFileSync(path.join(root, "gen.js"), "utf8");
  const bad = src.match(/\.sort\(\s*\([^)]*\)\s*=>[^\n;]*\b(R|rng|rand|Math\.random)\s*\(/g) || [];
  check("並べ替えの比較の中で乱数を引いていない（同じ日に人によって問題が変わらない）", bad.length === 0, bad.join(" | ")); }

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const isNoise = (t) => /fonts\.(googleapis|gstatic)\.com|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|net::ERR_/.test(t);
const errors = [];
async function newPage(w = 390, h = 844) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  page.on("pageerror", (e) => errors.push(e.stack));
  page.on("console", (m) => { if (m.type() === "error" && !isNoise(m.text())) errors.push(m.text()); });
  await page.goto(url);
  await page.evaluate(() => localStorage.clear()); await page.reload();
  return page;
}
const curB = (page) => page.evaluate(() => { const c = window.__bz.cur(); return { placed: c.placed, sel: c.sel, done: c.done, tray: c.p.tray.map((t) => ({ id: t.id, sol: t.sol })), lock: c.lock }; });
const sorted = (a) => JSON.stringify((a || []).slice().sort((x, y) => x - y));
// 答えのとおりに詰める：おかずを選び、答えのますを押し、合うまで同じますを押し直す
async function solveNow(page, skip = []) {
  const c = await curB(page);
  for (const t of c.tray) {
    if (skip.includes(t.id)) continue;
    let now = await curB(page); if (now.done) return;
    if (sorted(now.placed[t.id]) === sorted(t.sol)) continue;
    if (now.placed[t.id]) await page.click(`#bx .cell[data-i="${now.placed[t.id][0]}"]`); // 台に戻す（選んだ状態になる）
    now = await curB(page); if (now.sel !== t.id) await page.click(`.pc[data-j="${t.id}"]`);
    await page.click(`#bx .cell[data-i="${t.sol[0]}"]`);
    for (let k = 0; k < 40; k++) { now = await curB(page); if (now.done || sorted(now.placed[t.id]) === sorted(t.sol)) break; await page.click(`#bx .cell[data-i="${t.sol[0]}"]`); }
  }
}
const KEY = "bento-v1";
try {
  const page = await newPage();
  // 2. 3箱の組み方（日付の種）
  const sel = await page.evaluate(() => {
    const g = window.__bz, out = { bad: [], same: 0 };
    let prev = null;
    for (let n = 0; n < 120; n++) {
      const k = new Date(Date.parse("2026-11-04") + n * 864e5).toISOString().slice(0, 10);
      const d = g.dailyList(k).map(g.boxOf), h = g.hardList(k).map(g.boxOf);
      if (d.map((p) => p.size).join() !== "小,中,大" || h.some((p) => p.size !== "特盛")) out.bad.push(k);
      const sig = JSON.stringify(d.map((p) => p.tray.map((t) => t.sol)));
      if (sig === prev) out.same++; prev = sig;
    }
    out.d1201 = JSON.stringify(g.dailyList("2026-12-01").map(g.boxOf).map((p) => p.tray));
    return out;
  });
  check("今日の3箱は毎日「小・中・大」、上級は特盛2箱（120日分）", sel.bad.length === 0, sel.bad.slice(0, 3).join(","));
  check("前の日と同じ箱にならない（120日分）", sel.same === 0);
  { const ctx = await browser.newContext(); const p2 = await ctx.newPage(); await p2.goto(url);
    const d2 = await p2.evaluate(() => { const g = window.__bz; return JSON.stringify(g.dailyList("2026-12-01").map(g.boxOf).map((p) => p.tray)); });
    await ctx.close();
    check("同じ日は別のブラウザで開いても同じ3箱", sel.d1201 === d2); }

  // 3. 通しで遊ぶ
  check("初めて開くと遊び方が出る", await page.locator("#howto[open]").count() === 1);
  await page.click("#howto-ok");
  await page.click("#go-d");
  let c = await curB(page);
  check("1箱目は小（4×4）・はじめから台の先頭のおかずが選ばれている", (await page.locator("#bx .cell").count()) === 16 && c.sel === c.tray[0].id);
  // 詰める・回す・戻す
  const t0 = c.tray[0];
  await page.click(`#bx .cell[data-i="${t0.sol[0]}"]`);
  let n1 = await curB(page);
  check("ますを押すと、選んだおかずがそのますを通るように詰まる", n1.placed[t0.id] && n1.placed[t0.id].includes(t0.sol[0]));
  const before = sorted(n1.placed[t0.id]);
  await page.click(`#bx .cell[data-i="${t0.sol[0]}"]`);
  n1 = await curB(page);
  check("同じますをもう一度押すと、向きか場所が変わる（同じますは通ったまま）", sorted(n1.placed[t0.id]) !== before && n1.placed[t0.id].includes(t0.sol[0]));
  await page.click(`#bx .cell[data-i="${n1.placed[t0.id].find((x) => x !== t0.sol[0]) ?? n1.placed[t0.id][0]}"]`);
  n1 = await curB(page);
  check("詰めたおかずの別のますを押すと台に戻り、選んだ状態になる", !n1.placed[t0.id] && n1.sel === t0.id);
  await page.click("#hint");
  n1 = await curB(page);
  check("ヒントで1品が答えの場所に詰まり、動かせなくなる", n1.lock.length === 1 && sorted(n1.placed[n1.lock[0]]) === sorted(n1.tray.find((t) => t.id === n1.lock[0]).sol) && (await page.locator(".cell.lock").count()) > 0);
  await page.reload(); await page.click("#go-d");
  n1 = await curB(page);
  check("途中で閉じても、詰めたおかずとヒントはそのまま（続きから）", n1.lock.length === 1 && Object.keys(n1.placed).length >= 1 && (await page.textContent("#left")).includes("ヒント 1"));
  // 練習を始めても今日の途中は消えない
  await page.click("#back"); await page.click("#go-p"); await page.locator(".lv button").first().click(); await page.click("#back"); await page.click("#go-d");
  check("練習を始めても、今日の途中経過は消えない", (await curB(page)).lock.length === 1 && (await page.evaluate(() => window.__bz.mode())) === "d");
  { const n2 = await curB(page), t = n2.tray.find((x) => !n2.lock.includes(x.id) && !x.sol.some((c) => Object.values(n2.placed).flat().includes(c))); if (n2.sel !== t.id) await page.click(`.pc[data-j="${t.id}"]`); await page.click(`#bx .cell[data-i="${t.sol[0]}"]`); }
  check("ヒントのおかずだけのときは「全部もどす」を押せず、ほかを詰めると押せる", !(await page.isDisabled("#clear")) && Object.keys((await curB(page)).placed).length === 2);
  await page.click("#clear");
  check("「全部もどす」でもヒントのおかずは残る", Object.keys((await curB(page)).placed).length === 1);
  await solveNow(page);
  check("すき間なく埋めると完成になり、★2（ヒント1）と詰め方の数が出る", (await curB(page)).done && (await page.locator(".verdict .stars .off").textContent()).length === 1 && /詰め方/.test(await page.textContent(".verdict")));
  await page.click("#next");
  // 別のタブで先に進んでいたら、古い画面の答えは足さない
  await page.evaluate((k) => { const s = JSON.parse(localStorage.getItem(k)); s.runs.d.res.push({ h: 0 }); localStorage.setItem(k, JSON.stringify(s)); }, KEY);
  await solveNow(page);
  check("別のタブで先に進んでいたら、古い画面の答えは足さず今の箱を出し直す", (await page.evaluate(() => window.__bz.load().runs.d.res.length)) === 2 && (await page.textContent("header")).includes("3/3"));
  await page.evaluate((k) => { const s = JSON.parse(localStorage.getItem(k)); s.runs.d.res.pop(); localStorage.setItem(k, JSON.stringify(s)); }, KEY);
  await page.reload(); await page.click("#go-d");
  for (let j = 0; j < 2; j++) { await solveNow(page); await page.click("#next"); }
  const share = await page.textContent(".share");
  check("3箱で結果・シェアの文は番号と色だけ", /お弁当づめ #\d+/.test(share) && /🟨🍱🍱/.test(share));
  check("X・LINE は押したときに開くリンクだけ", /^https:\/\/twitter\.com\/intent\/tweet\?text=/.test(await page.getAttribute("#toX", "href")) && /^https:\/\/line\.me\/R\/share\?text=/.test(await page.getAttribute("#toLine", "href")));
  check("結果に3箱の完成図が出る", (await page.locator(".minis .box").count()) === 3);
  check("ヒントを使った日は Ko-fi のひとことを出さない", (await page.locator(".kofi").count()) === 0);
  await page.click("#back");
  check("ホームで連続1日・今日の結果を見るに変わる・詰めた箱3", (await page.textContent(".stats")).includes("1連続の日") && (await page.textContent(".stats")).includes("3詰めた箱") && (await page.textContent("#go-d")).includes("今日の結果"));
  // 上級
  await page.click("#go-h");
  check("上級は特盛（6×6・仕切り2つ）でヒントのボタンが無い", (await page.locator("#bx .cell").count()) === 36 && (await page.locator("#bx .cell.blk").count()) === 2 && (await page.locator("#hint").count()) === 0);
  await page.click("#bx .cell.blk").catch(() => {});
  for (let j = 0; j < 2; j++) { await solveNow(page); await page.click("#next"); }
  check("上級をヒントなしで初めて終えると、結果に Ko-fi のひとことが1行", (await page.locator(".kofi").count()) === 1 && (await page.textContent(".big")).includes("ヒントなし"));
  await page.click("#back"); await page.click("#go-h");
  check("2回目に結果を開いても Ko-fi のひとことは出ない", (await page.locator(".kofi").count()) === 0);
  await page.click("#back");
  // 練習：記録の日を増やさず、図鑑には載る
  await page.click("#go-p"); await page.locator(".lv button").nth(1).click();
  await solveNow(page); await page.click("#next");
  const after = await page.evaluate(() => { const s = window.__bz.load(); return { days: Object.keys(s.days).length, boxes: s.boxes, eat: Object.keys(s.eat).length }; });
  check("練習は今日の記録を増やさず、詰めた箱と図鑑には入る", after.days === 1 && after.boxes === 6 && (await page.locator(".share").count()) === 0);
  await page.click("#go-dex");
  check("おかず図鑑に出会ったおかずが出て、まだのものは「？？？」", (await page.locator(".dex div:not(.no)").count()) === after.eat && (await page.locator(".dex div").count()) === B.FOODS.length);
  await page.close();

  // 4. スマホ幅：はみ出さない・押せる所は44px以上（箱のますは幅320でも36px以上）
  for (const w of [320, 390]) {
    const p3 = await newPage(w, 700); const fb2 = await p3.evaluate(() => { const a = document.querySelector("#howto #fb2"); return a ? a.getBoundingClientRect().height : 0; }); check(`幅${w}px：遊び方の「感想を送る」も高さ44px以上`, fb2 >= 44, `${fb2}px`); await p3.click("#howto-ok");
    const homeOk = await p3.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
    await p3.click("#go-d");
    const r = await p3.evaluate(() => ({ over: document.documentElement.scrollWidth > innerWidth, small: [...document.querySelectorAll("button, a")].filter((e) => e.offsetParent && !e.classList.contains("cell") && e.getBoundingClientRect().height < 44).map((e) => e.textContent.trim() || e.id), cell: Math.min(...[...document.querySelectorAll("#bx .cell")].map((e) => e.getBoundingClientRect().width)) }));
    check(`幅${w}px：横にはみ出さず、押せる所は高さ44px以上・ますは36px以上`, homeOk && !r.over && r.small.length === 0 && r.cell >= 36, `${r.small.join(",")} ます${r.cell.toFixed(0)}px`);
    if (w === 320) { // 特盛（6×6）でもますが押せる大きさ
      await p3.evaluate(() => { window.__bz.play("h"); }).catch(() => {});
      await p3.evaluate((k) => { const g = window.__bz; localStorage.setItem(k, JSON.stringify({ v: 1, tut: true, days: {}, hdays: {}, eat: {}, boxes: 0, kofi: {}, runs: { p: { mode: "p", date: g.todayKey(), list: [{ seed: 5, s: 3 }], res: [], cur: null, id: "qa" } } })); g.play("p"); }, KEY);
      const cw = await p3.evaluate(() => Math.min(...[...document.querySelectorAll("#bx .cell")].map((e) => e.getBoundingClientRect().width)));
      check("幅320pxの特盛（6×6）でも、ますは36px以上", cw >= 36, `${cw.toFixed(0)}px`);
    }
    await p3.close();
  }
  { // 保存してあった置き方が壊れていたら使わない
    const pv = await newPage(); await pv.click("#howto-ok");
    await pv.evaluate((k) => { const g = window.__bz, d = g.todayKey(); localStorage.setItem(k, JSON.stringify({ v: 1, tut: true, days: {}, hdays: {}, eat: {}, boxes: 0, kofi: {}, runs: { d: { mode: "d", date: d, list: g.dailyList(d), res: [], cur: { i: 0, placed: { 0: [0, 1, 2, 3, 4, 5, 6, 7, 8] }, lock: [], hints: 0 }, id: "a" } } })); }, KEY);
    await pv.reload(); await pv.click("#go-d");
    check("壊れた途中経過（形が合わない置き方）は使わず、空の箱から始める", Object.keys((await curB(pv)).placed).length === 0);
    await pv.close(); }
  { // 保存できないブラウザでも遊べる
    const pb = await browser.newPage({ viewport: { width: 390, height: 844 } });
    pb.on("pageerror", (e) => errors.push(e.message));
    await pb.addInitScript(() => { Storage.prototype.setItem = () => { throw new Error("blocked"); }; });
    await pb.goto(url); await pb.click("#howto-ok"); await pb.click("#go-d");
    const t = (await curB(pb)).tray[0]; await pb.click(`#bx .cell[data-i="${t.sol[0]}"]`);
    check("保存できないブラウザでも、今日の1箱目に詰められる", (await pb.textContent("header")).includes("1/3") && Object.keys((await curB(pb)).placed).length === 1);
    await pb.click("#back");
    check("保存できないブラウザでも、遊び方が何度も開かない", !(await pb.locator("#howto[open]").count()));
    await pb.close(); }
  { // 前の記録が残っていて、書き込みだけ失敗するとき
    const pq = await browser.newPage({ viewport: { width: 390, height: 844 } });
    pq.on("pageerror", (e) => errors.push(e.message));
    await pq.addInitScript(() => { const orig = Storage.prototype.setItem; orig.call(localStorage, "bento-v1", JSON.stringify({ v: 1, tut: true, days: {}, hdays: {}, eat: {}, boxes: 0, kofi: {}, runs: {} })); Storage.prototype.setItem = () => { throw new Error("full"); }; });
    await pq.goto(url); await pq.click("#go-d");
    check("前の記録があり書き込みだけ失敗しても、今日の1箱目が始まる", (await pq.textContent("header")).includes("1/3"));
    await pq.close(); }
  { const pc = await newPage();
    await pc.evaluate((k) => { const g = window.__bz, d = g.todayKey(); localStorage.setItem(k, JSON.stringify({ v: 1, tut: true, days: {}, hdays: {}, eat: {}, boxes: 0, kofi: {}, runs: { d: { mode: "d", date: d, list: g.dailyList(d), res: [0, 1, 2].map(() => ({ h: 0 })), id: "a" } } })); }, KEY);
    await pc.reload();
    check("最後の1箱のあと閉じても、開き直すと結果へ進み今日の記録がつく", await pc.evaluate(() => { const g = window.__bz; return !!g.load().days[g.todayKey()] && !g.load().runs.d; }));
    await pc.close(); }
  { const pm = await newPage();
    await pm.evaluate((k) => { const g = window.__bz, d = g.todayKey(); localStorage.setItem(k, JSON.stringify({ v: 1, tut: true, days: {}, hdays: {}, eat: {}, boxes: 0, kofi: {}, runs: { d: { mode: "d", date: d, list: g.dailyList(d), res: [0, 1, 2].map(() => ({ h: 0 })), id: "a" } } })); }, KEY);
    await pm.reload();
    const had = await pm.locator("#go-h").count();
    await pm.evaluate(() => { const RD = Date, off = 864e5; window.Date = class extends RD { constructor(...a) { if (a.length) super(...a); else super(RD.now() + off); } static now() { return RD.now() + off; } }; });
    if (had) await pm.click("#go-h");
    check("結果を開いたまま日付が変わったら、上級のボタンを押しても翌日の上級は始まらない", had > 0 && (await pm.evaluate(() => window.__bz.mode())) !== "h");
    await pm.close(); }
  { const pn = await newPage();
    await pn.evaluate((k) => { const g = window.__bz, d = new Date(Date.parse(g.todayKey()) - 864e5).toISOString().slice(0, 10); localStorage.setItem(k, JSON.stringify({ v: 1, tut: true, days: {}, hdays: {}, eat: {}, boxes: 0, kofi: {}, runs: { d: { mode: "d", date: d, list: g.dailyList(d), res: [0, 1, 2].map(() => ({ h: 0 })), id: "a" } } })); }, KEY);
    await pn.reload();
    check("前の日に終えて閉じても、翌日に開くとその日の記録がつく", await pn.evaluate(() => { const g = window.__bz; return !!g.load().days[new Date(Date.parse(g.todayKey()) - 864e5).toISOString().slice(0, 10)] && !g.load().runs.d; }));
    check("前の日の結果の画面からは、今日の上級を始められない（今日の分を先に）", !(await pn.locator("#go-h").count()));
    check("保存に失敗したあと別のタブが新しく保存していたら、古いメモリで上書きせずそちらを読む", await pn.evaluate((K) => { const g = window.__bz, s0 = g.load(); mem = JSON.stringify(Object.assign({}, s0, { t: 1, tagA: 1 })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 2, tagB: 1 }))); const r = g.load(); mem = null; return !!r.tagB && !r.tagA; }, KEY));
    check("保存に失敗したあと別のタブが保存しても、両方の記録（日ごとの結果）を残し、図鑑の数は多いほう", await pn.evaluate((K) => { const g = window.__bz, s0 = g.load(); mem = JSON.stringify(Object.assign({}, s0, { t: 5, days: { "2000-01-01": 1 }, eat: { 卵焼き: 9 } })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 9, days: { "2000-01-02": 1 }, eat: { 卵焼き: 2 } }))); const r = g.load(); mem = null; return !!r.days["2000-01-01"] && !!r.days["2000-01-02"] && r.eat["卵焼き"] === 9; }, KEY));
    check("保存に失敗したタブの時刻が進んでいても、別のタブで先に進んだ途中経過を古いメモリで戻さない", await pn.evaluate((K) => { const g = window.__bz, s0 = g.load(), base = { mode: "d", date: "2000-01-01", list: [{ seed: 1, s: 0 }], id: "x", res: [] }; mem = JSON.stringify(Object.assign({}, s0, { t: 99, runs: { d: Object.assign({}, base) } })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 1, runs: { d: Object.assign({}, base, { res: [{ h: 0 }] }) } }))); const r = g.load(); mem = null; return r.runs.d.res.length === 1; }, KEY));
    check("保存に失敗したタブにだけある途中経過は、別のタブが保存しても消さない（終えた回の null は戻さない）", await pn.evaluate((K) => { const g = window.__bz, s0 = g.load(); const base = { mode: "d", date: "2000-01-01", list: [1, 2, 3], tags: [1, 2, 3], id: "x", res: [], i: 0, hints: [0, 0, 0] }, done = Object.assign({}, base, { res: [0, 1, 2].map(() => ({ m: 0, g: 1, h: 0, f: 0, p: 90, n: 1 })), i: 3 }); const put = (a, b) => { mem = JSON.stringify(Object.assign({}, s0, { t: 5, runs: a })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 9, runs: b }))); const r = g.load(); mem = null; return r; }; const r1 = put({ d: base }, {}), r2 = put({ d: base }, { d: null }); return !!r1.runs.d && r1.runs.d.date === "2000-01-01" && r2.runs.d === null; }, KEY));
    check("同じ進み具合なら、新しく保存したほうの途中経過を使う", await pn.evaluate((K) => { const g = window.__bz, s0 = g.load(); const base = { mode: "d", date: "2000-01-01", list: [1, 2, 3], tags: [1, 2, 3], id: "x", res: [], i: 0, hints: [0, 0, 0] }, done = Object.assign({}, base, { res: [0, 1, 2].map(() => ({ m: 0, g: 1, h: 0, f: 0, p: 90, n: 1 })), i: 3 }); const put = (ta, tb) => { mem = JSON.stringify(Object.assign({}, s0, { t: ta, runs: { d: Object.assign({}, base, { zz: "a" }) } })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: tb, runs: { d: Object.assign({}, base, { zz: "b" }) } }))); const r = g.load(); mem = null; return r.runs.d.zz; }; return put(9, 5) === "a" && put(5, 9) === "b"; }, KEY));
    check("結果を見る前に別のタブが次の日を保存しても、終えた日の記録を残す", await pn.evaluate((K) => { const g = window.__bz, s0 = g.load(); const base = { mode: "d", date: "2000-01-01", list: [1, 2, 3], tags: [1, 2, 3], id: "x", res: [], i: 0, hints: [0, 0, 0] }, done = Object.assign({}, base, { res: [0, 1, 2].map(() => ({ m: 0, g: 1, h: 0, f: 0, p: 90, n: 1 })), i: 3 }); mem = JSON.stringify(Object.assign({}, s0, { t: 5, runs: { d: done } })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 9, runs: { d: Object.assign({}, base, { date: "2000-01-02" }) } }))); const r = g.load(); mem = null; return !!r.days["2000-01-01"] && r.runs.d.date === "2000-01-02"; }, KEY));
    check("同じ問題の練習をやり直したら、前の回（終えたもの）と取り違えず新しい回を使う", await pn.evaluate((K) => { const g = window.__bz, s0 = g.load(), base = { mode: "p", date: "2000-01-01", list: [1], tags: [1], res: [], i: 0, hints: [] }; mem = JSON.stringify(Object.assign({}, s0, { t: 9, runs: { p: Object.assign({}, base, { id: "new" }) } })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 5, runs: { p: Object.assign({}, base, { id: "old", res: [{}], i: 1 }) } }))); const r = g.load(); mem = null; return r.runs.p.id === "new"; }, KEY));
    check("時計が戻っても、保存の時刻 t は前より大きくなる", await pn.evaluate((K) => { const s0 = JSON.parse(localStorage.getItem(K)); const far = Date.now() + 1e9; localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: far }))); save(() => {}); return JSON.parse(localStorage.getItem(K)).t > far; }, KEY));
    await pn.close(); }
} catch (e) {
  check("QA の操作が最後まで完了する", false, e.message.split("\n")[0]);
} finally {
  await browser.close();
}
check("画面のエラーが無い", errors.length === 0, errors.slice(0, 3).join(" | "));

const ng = results.filter((r) => !r.ok);
const md = `# お弁当づめ QA\n\n${results.map((r) => `- ${r.ok ? "✅" : "❌"} ${r.name}${r.detail ? `（${r.detail}）` : ""}`).join("\n")}\n\n${ng.length ? `❌ ${ng.length}件` : `✅ ${results.length}項目すべて通過`}\n`;
mkdirSync(path.join(root, "qa-report"), { recursive: true });
writeFileSync(path.join(root, "qa-report/report.md"), md);
console.log(md);
process.exit(ng.length ? 1 : 0);
