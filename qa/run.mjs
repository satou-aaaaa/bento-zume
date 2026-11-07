// お弁当づめの検査。箱の作り方（すき間なく埋まる・何千箱）・3箱の組み方・詰める/回す/戻す・ヒント・続きから・上級・図鑑・記録・スマホ幅・PWA を確かめる。
// 使い方: node qa/run.mjs   失敗があれば終了コード 1。結果は qa-report/report.md。
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { checkTransfer } from "./transfer-check.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const url = pathToFileURL(path.join(root, "index.html")).href;
const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: !!ok, detail });
const B = createRequire(import.meta.url)(path.join(root, "gen.js"));

// 1. 箱の作り方（ブラウザを使わない）。大きさごとに何百箱も作って確かめる
{
  const S = [...new Set(B.VARIANTS.flat())], bad = [], dupShape = [], small = [], same = [];
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
  check(`どの箱も、答えのとおりにすき間なく埋まる・おかずはつながった形（とことん・練習の形も入れて${S.length}つの大きさ×400箱）`, bad.length === 0, bad.slice(0, 3).join(","));
  check("同じ種からは同じ箱ができる（だれでも同じ問題）", same.length === 0, same.slice(0, 3).join(","));
  check("おかずの大きさは決めた範囲（今日の小2〜4・中3〜4・大3〜5・特盛4〜5、とことん・練習の形は VARIANTS のとおり）", small.length === 0, small.slice(0, 3).join(","));
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

{ // 今日の3箱・上級の箱は、とことん・練習の形を足しても変わらない（過去の日の箱が変わらない。2026-11-06）
  const { createHash } = await import("node:crypto"), out = [];
  for (let d = -60; d <= 30; d++) { const k = new Date(Date.parse("2026-11-06") + d * 864e5).toISOString().slice(0, 10);
    B.SIZES.forEach((S, i) => out.push(JSON.stringify(B.make(B.seedOf(k + ":d:" + i), S)))); [0, 1].forEach((i) => out.push(JSON.stringify(B.make(B.seedOf(k + ":h:" + i), B.HARD)))); }
  check("今日の3箱・上級の箱は前と同じ（2026-09-07〜12-06 の91日分の中身が、形を足す前の値と一致）", createHash("sha256").update(out.join("\n")).digest("hex") === "578405133fd4cd51b11b27c95c436d5d5e369841100215c7bc730e1578eb8d4a");
  check("今日の3箱・上級の大きさは VARIANTS の先頭（v なしの箱は今までと同じ大きさ）", B.VARIANTS[0][0] === B.SIZES[0] && B.VARIANTS[1][0] === B.SIZES[1] && B.VARIANTS[2][0] === B.SIZES[2] && B.VARIANTS[3][0] === B.HARD);
}
{ // とことん・練習の箱の数：小・中も、おかずの組み合わせが300通り以上（2026-11-06 satou さん「同様の問題がでないよう、数を増やして」。前は小123・中84通り）
  const pool = B.VARIANTS.slice(0, 2).map((V) => { const k = new Set(); V.forEach((S) => { for (let i = 0; i < 300; i++) k.add(B.boxKey(B.make(B.seedOf("pool" + S.w + S.h + S.max + ":" + i), S))); }); return k.size; });
  check("とことん・練習の小・中の箱は、それぞれ300通り以上の組み合わせから出る（各形300箱を作って数える）", pool.every((n) => n >= 300), pool.join("/"));
}

const html = readFileSync(path.join(root, "index.html"), "utf8");
check("終えた回を消すのは同じ回のときだけ・0時を過ぎたホームの「今日」のボタンは描き直す（2026-11-04 CodeRabbit）", /c\.date === run\.date && c\.id === run\.id\) s2\.runs\[MODE\] = null/.test(html) && /\$\("go-d"\)\.onclick = \(\) => \(k !== todayKey\(\) \? home\(\)/.test(html));
check("別のタブで今日の分を終えたあと、古い画面から今日・上級をもう一度始めない（2026-11-04 CodeRabbit）", /\(mode === "d" && s\.days\[k\]\) \|\| \(mode === "h" && s\.hdays\[k\]\)\) return;/.test(html));
check("README の URL のすぐ後ろに全角の字を続けない（Link check が URL の一部と読む。2026-11-04）", !/https?:\/\/[\x21-\x7e]*[^\x00-\x7f]/.test(readFileSync(new URL("../README.md", import.meta.url), "utf8").replace(/\]\(https?:\/\/[^)\s]+\)/g, "").replace(/<https?:\/\/[^>\s]+>/g, "")));
const ext = [...html.matchAll(/(?:src|href)="(https?:[^"]+)"/g)].map((m) => m[1]).filter((u) => !/^https:\/\/fonts\.googleapis\.com(\/|$)|^https:\/\/ko-fi\.com\/satouaaaaa$/.test(u));
check("外から読むのは文字（Google Fonts）だけ。スクリプト・広告・解析を入れない", ext.length === 0, ext.join(","));
check("CSP で通信先を自分だけにしている", /connect-src 'self'/.test(html) && !/connect-src[^;"]*https/.test(html));
check("Math.random は練習・とことんの箱の種だけ（今日の3箱・上級は日付の種）", (html.match(/Math\.random/g) || []).length === 3 && !/Math\.random/.test(readFileSync(path.join(root, "gen.js"), "utf8")));
check("画面にお笑いの言葉を入れない（本物っぽく）", !/お笑い|ギャグ|ボケ|ツッコミ|なんでやねん|（うそ）/.test(html));
{ const og = (k) => (html.match(new RegExp(`<meta (?:property|name)="${k}" content="([^"]+)"`)) || [])[1] || "";
  const png = readFileSync(path.join(root, "og.png"));
  check("SNS で貼ると絵と題が出る（OGP・1200×630・絶対URL）", og("og:title") && og("og:description") && og("og:image") === "https://satou-aaaaa.github.io/bento-zume/og.png" && og("twitter:card") === "summary_large_image" && png.readUInt32BE(16) === 1200 && png.readUInt32BE(20) === 630); }
{ const fy = readFileSync(path.join(root, ".github/ISSUE_TEMPLATE/feedback.yml"), "utf8");
  check("感想フォームの name が3字以上（「感想」の2字だと GitHub がフォームを出さず白紙の Issue になる。shared-workflows incidents/2026-11-05-feedback-form-not-shown.md）", [...((fy.match(/^name:\s*(.+)$/m) || [])[1] || "").trim()].length >= 3 && /^description:\s*\S/m.test(fy), (fy.match(/^name:.*$/m) || [""])[0]);
  check("感想フォームは名前・メールを聞かない（楽しさ・よかった所・直してほしい所だけ）", /id: fun/.test(fy) && /id: good/.test(fy) && /id: fix/.test(fy) && !/id: (name|email|mail)/.test(fy) && /labels: \["感想"\]/.test(fy)); }
{ const sw = readFileSync(path.join(root, "sw.js"), "utf8"), mf = JSON.parse(readFileSync(path.join(root, "manifest.webmanifest"), "utf8"));
  const shell = JSON.parse(sw.match(/SHELL = (\[[^\]]+\])/)[1].replace(/'/g, '"'));
  const need = ["./index.html", "./transfer.js", "./gen.js", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"];
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
  check("詰めたおかずのますだけが、ぽんと入る動き（flash）になる", (await page.locator("#bx .cell.flash").count()) === t0.sol.length);
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
  check("完成すると、全部のますが左上から順に光る（wave）・ぽんの動きは残らない", (await page.locator("#bx .cell.wave").count()) === 16 && (await page.locator("#bx .cell.flash").count()) === 0 && (await page.getAttribute("#bx .cell.wave >> nth=15", "style")).includes("animation-delay:270ms"));
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
  check("新しく取れた実績が結果の画面に1行だけ出る（はじめての★3）", (await page.locator(".ach-new").count()) === 1 && (await page.textContent(".ach-new")).includes("はじめての★3"));
  check("X・LINE は押したときに開くリンクだけ", /^https:\/\/twitter\.com\/intent\/tweet\?text=/.test(await page.getAttribute("#toX", "href")) && /^https:\/\/line\.me\/R\/share\?text=/.test(await page.getAttribute("#toLine", "href")));
  check("結果に3箱の完成図が出る", (await page.locator(".minis .box").count()) === 3);
  check("今日の3箱の結果に「続けて遊ぶ：とことん」の大きなボタン", (await page.locator("#go-e.main").count()) === 1);
  check("ヒントを使った日は Ko-fi のひとことを出さない", (await page.locator(".kofi").count()) === 0);
  await page.click("#back");
  check("ホームで連続1日・今日の結果を見るに変わる・詰めた箱3", (await page.textContent(".stats")).includes("1連続の日") && (await page.textContent(".stats")).includes("3詰めた箱") && (await page.textContent("#go-d")).includes("今日の結果"));
  // 上級
  await page.click("#go-h");
  check("上級は特盛（6×6・仕切り2つ）でヒントのボタンが無い", (await page.locator("#bx .cell").count()) === 36 && (await page.locator("#bx .cell.blk").count()) === 2 && (await page.locator("#hint").count()) === 0);
  await page.click("#bx .cell.blk").catch(() => {});
  for (let j = 0; j < 2; j++) { await solveNow(page); await page.click("#next"); }
  check("上級をヒントなしで初めて終えると、結果に Ko-fi のひとことが1行", (await page.locator(".kofi").count()) === 1 && (await page.textContent(".big")).includes("ヒントなし"));
  check("実績は1度だけ知らせる（上級の結果には特盛デビューが出て、はじめての★3は出ない）", (await page.locator(".ach-new").count()) === 1 && (await page.textContent(".ach-new")).includes("特盛デビュー") && !(await page.textContent(".ach-new")).includes("はじめての★3"));
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
    check("前の日の結果の画面には、今日の上級のボタンを出さない（日付がちがう）", !(await pn.locator("#go-h").count()));
    check("保存に失敗したあと別のタブが新しく保存していたら、古いメモリで上書きせずそちらを読む", await pn.evaluate((K) => { const g = window.__bz, s0 = g.load(); mem = JSON.stringify(Object.assign({}, s0, { t: 1, tagA: 1 })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 2, tagB: 1 }))); const r = g.load(); mem = null; return !!r.tagB && !r.tagA; }, KEY));
    check("保存に失敗したあと別のタブが保存しても、両方の記録（日ごとの結果）を残し、図鑑の数は多いほう", await pn.evaluate((K) => { const g = window.__bz, s0 = g.load(); mem = JSON.stringify(Object.assign({}, s0, { t: 5, days: { "2000-01-01": 1 }, eat: { 卵焼き: 9 } })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 9, days: { "2000-01-02": 1 }, eat: { 卵焼き: 2 } }))); const r = g.load(); mem = null; return !!r.days["2000-01-01"] && !!r.days["2000-01-02"] && r.eat["卵焼き"] === 9; }, KEY));
    check("保存に失敗したタブの時刻が進んでいても、別のタブで先に進んだ途中経過を古いメモリで戻さない", await pn.evaluate((K) => { const g = window.__bz, s0 = g.load(), base = { mode: "d", date: "2000-01-01", list: [{ seed: 1, s: 0 }], id: "x", res: [] }; mem = JSON.stringify(Object.assign({}, s0, { t: 99, runs: { d: Object.assign({}, base) } })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 1, runs: { d: Object.assign({}, base, { res: [{ h: 0 }] }) } }))); const r = g.load(); mem = null; return r.runs.d.res.length === 1; }, KEY));
    check("保存に失敗したタブにだけある途中経過は、別のタブが保存しても消さない（その日を終えた記録があれば null を使う・終えた回は日ごとの結果に残す）", await pn.evaluate((K) => { const g = window.__bz, s0 = g.load(); const base = { mode: "d", date: "2000-01-01", list: [1, 2, 3], tags: [1, 2, 3], id: "x", res: [], i: 0, hints: [0, 0, 0] }, done = Object.assign({}, base, { res: [0, 1, 2].map(() => ({ m: 0, g: 1, h: 0, f: 0, p: 90, n: 1 })), i: 3 }); const put = (a, b, dd) => { mem = JSON.stringify(Object.assign({}, s0, { t: 5, runs: a })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 9, runs: b }, dd ? { days: Object.assign({}, s0.days, dd) } : {}))); const r = g.load(); mem = null; return r; }; const r1 = put({ d: base }, {}), r2 = put({ d: base }, { d: null }, { "2000-01-01": 1 }), r3 = put({ d: base }, { d: null }), r4 = put({ d: done }, { d: null }); return !!r1.runs.d && r1.runs.d.date === "2000-01-01" && r2.runs.d === null && !!r3.runs.d && r3.runs.d.date === "2000-01-01" && r4.runs.d === null && !!r4.days["2000-01-01"]; }, KEY));
    check("同じ進み具合なら、新しく保存したほうの途中経過を使う", await pn.evaluate((K) => { const g = window.__bz, s0 = g.load(); const base = { mode: "d", date: "2000-01-01", list: [1, 2, 3], tags: [1, 2, 3], id: "x", res: [], i: 0, hints: [0, 0, 0] }, done = Object.assign({}, base, { res: [0, 1, 2].map(() => ({ m: 0, g: 1, h: 0, f: 0, p: 90, n: 1 })), i: 3 }); const put = (ta, tb) => { mem = JSON.stringify(Object.assign({}, s0, { t: ta, runs: { d: Object.assign({}, base, { zz: "a" }) } })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: tb, runs: { d: Object.assign({}, base, { zz: "b" }) } }))); const r = g.load(); mem = null; return r.runs.d.zz; }; return put(9, 5) === "a" && put(5, 9) === "b"; }, KEY));
    check("結果を見る前に別のタブが次の日を保存しても、終えた日の記録を残す", await pn.evaluate((K) => { const g = window.__bz, s0 = g.load(); const base = { mode: "d", date: "2000-01-01", list: [1, 2, 3], tags: [1, 2, 3], id: "x", res: [], i: 0, hints: [0, 0, 0] }, done = Object.assign({}, base, { res: [0, 1, 2].map(() => ({ m: 0, g: 1, h: 0, f: 0, p: 90, n: 1 })), i: 3 }); mem = JSON.stringify(Object.assign({}, s0, { t: 5, runs: { d: done } })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 9, runs: { d: Object.assign({}, base, { date: "2000-01-02" }) } }))); const r = g.load(); mem = null; return !!r.days["2000-01-01"] && r.runs.d.date === "2000-01-02"; }, KEY));
    check("同じ問題の練習をやり直したら、前の回（終えたもの）と取り違えず新しい回を使う", await pn.evaluate((K) => { const g = window.__bz, s0 = g.load(), base = { mode: "p", date: "2000-01-01", list: [1], tags: [1], res: [], i: 0, hints: [] }; mem = JSON.stringify(Object.assign({}, s0, { t: 9, runs: { p: Object.assign({}, base, { id: "new" }) } })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 5, runs: { p: Object.assign({}, base, { id: "old", res: [{}], i: 1 }) } }))); const r = g.load(); mem = null; return r.runs.p.id === "new"; }, KEY));
    check("時計が戻っても、保存の時刻 t は前より大きくなる", await pn.evaluate((K) => { const s0 = JSON.parse(localStorage.getItem(K)); const far = Date.now() + 1e9; localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: far }))); save(() => {}); return JSON.parse(localStorage.getItem(K)).t > far; }, KEY));
    await pn.close(); }
  { // 入らないすき間の知らせ：答えどおりに詰めている途中では出ない・小さすぎるかたまりには出る
    const pg = await newPage();
    const r = await pg.evaluate(() => {
      const g = window.__bz, B = g.B, S = [...B.SIZES, B.HARD], bad = []; let n = 0;
      for (let d = 0; d < 300; d++) S.forEach((sz, si) => {
        const p = B.make(B.seedOf(`gap${d}:${si}`), sz), placed = {};
        for (const t of p.tray) { placed[t.id] = t.sol; const rest = p.tray.filter((x) => !(x.id in placed)).map((x) => x.cells.length); if (g.gapsOf(p, g.ownOf(p, placed), rest).size) bad.push(`${d}:${si}`); n++; }
      });
      const p = B.make(1, B.SIZES[0]), own = new Array(16).fill(0); own[0] = -1; own[14] = -1; own[15] = -1; // 左上の1ますと右下の2ますが空き・残りは2ます2つ
      const one = g.gapsOf(p, own, [2, 2]), ok2 = g.gapsOf(p, Object.assign(new Array(16).fill(0), { 0: -1, 1: -1 }), [2]);
      const own3 = new Array(16).fill(0); own3[0] = own3[1] = own3[2] = -1; const only = g.gapsOf(p, own3, [2]); // 空きは3ますのかたまり1つだけ・残りは2ます1つ
      return { bad: bad.slice(0, 3), nb: bad.length, n, one: [...one], ok2: ok2.size, only: [...only].sort((a, b) => a - b).join() };
    });
    check("答えどおりに途中まで詰めているときは、すき間の印を出さない（4つの大きさ×300箱の全部の途中）", r.nb === 0 && r.n > 3000, r.bad.join(","));
    check("どのおかずの大きさを足しても埋まらない空きのかたまりだけに、すき間の印が付く（いちばん大きいかたまりには付けない）", r.one.join() === "0" && r.ok2 === 0);
    check("埋まらない空きが、いちばん大きいかたまり1つだけのときも、すき間の印を付ける", r.only === "0,1,2", r.only);
    await pg.click("#howto-ok"); // 特盛（おかずは4〜5ます）の練習の箱で、1品目を隅からずらして置く
    await pg.evaluate((k) => { const g = window.__bz; localStorage.setItem(k, JSON.stringify({ v: 1, tut: true, days: {}, hdays: {}, eat: {}, boxes: 0, kofi: {}, runs: { p: { mode: "p", date: g.todayKey(), list: [{ seed: 5, s: 3 }], res: [], cur: null, id: "qa" } } })); g.play("p"); }, KEY);
    check("はじめ（何も詰めていない箱）には、すき間の印が出ない", (await pg.locator("#bx .cell.gap").count()) === 0 && (await pg.textContent("#left")).includes("のこり"));
    const made = await pg.evaluate(() => { const g = window.__bz, c = g.cur(), p = c.p, B = g.B;
      for (const t of p.tray) for (const r of B.rotations(t.cells)) for (let oy = 0; oy < p.h; oy++) for (let ox = 0; ox < p.w; ox++) {
        const cs = r.map(([x, y]) => [x + ox, y + oy]); if (cs.some(([x, y]) => x >= p.w || y >= p.h)) continue;
        const placed = { [t.id]: cs.map(([x, y]) => y * p.w + x) }, rest = p.tray.filter((x) => x.id !== t.id).map((x) => x.cells.length);
        if (g.gapsOf(p, g.ownOf(p, placed), rest).size) { c.placed = placed; g.paint(); return true; } }
      return false; });
    check("行き詰まる置き方をすると、すき間に斜線が出て「入らないすき間があります」と出る", made && (await pg.locator("#bx .cell.gap").count()) > 0 && (await pg.textContent("#left")).includes("入らないすき間"));
    await pg.close(); }
  { // 実績の数え方（いまの記録から毎回数える）
    const pa = await newPage();
    const a = await pa.evaluate(() => {
      const g = window.__bz, base = () => ({ v: 1, days: {}, hdays: {}, pdays: {}, eat: {}, boxes: 0, runs: {}, ach: {}, kofi: {} }), by = (s) => Object.fromEntries(g.achOf(s).map((x) => [x.id, x]));
      const day = (i) => new Date(Date.UTC(2026, 10, 4 + i)).toISOString().slice(0, 10);
      const e = by(base());
      const s1 = base(); for (let i = 0; i < 7; i++) s1.days[day(i)] = { h: [0, 0, 0] }; s1.days[day(9)] = { h: [1, 0, 2] }; s1.pdays[day(20)] = { h: [0, 0, 1] };
      g.B.FOODS.slice(0, 9).forEach((f) => (s1.eat[f[0]] = 2)); s1.hdays[day(2)] = { h: [0, 0] };
      const s2 = base(); for (const i of [0, 1, 2, 4, 5, 6, 7]) s2.days[day(i)] = { h: [1, 1, 1] }; for (let i = 8; i < 12; i++) s2.pdays[day(i)] = { h: [0, 0, 0] }; s2.days["x"] = 1; s2.hdays[day(1)] = { h: [0, 0] };
      const f1 = by(s1), f2 = by(s2), ids = g.ACH.map((x) => x[0]);
      return { n: g.ACH.length, uniq: new Set(ids).size === ids.length, none: Object.values(e).every((x) => !x.got && x.n === 0 && x.g >= 1), f1, f2, ms: [g.maxStreak(s1.days), g.maxStreak(s2.days), g.maxStreak({})] };
    });
    check("実績は10〜14個・名前が重ならない・記録が無ければどれも未達成で 0/目標", a.n >= 10 && a.n <= 14 && a.uniq && a.none, `${a.n}`);
    check("実績は腕前（★3の箱・ヒントなしの日・上級）・集める（図鑑）・続ける（遊んだ日）を数える", a.f1.c1.got && a.f1.clean.got && a.f1.c30.n === 21 + 1 + 2 + 2 && a.f1.h1.got && a.f1.h5.n === 1 && a.f1.e5.got && a.f1.e9.got && !a.f1.eAll.got && a.f1.eAll.n === 9 && a.f1.d3.got && a.f1.d10.n === 9 && a.f1.st7.got, JSON.stringify(a.f1.c30));
    check("7日つづけては今日の3箱の連続だけ（休んだ日・あとから遊んだ日では続かない）・遊んだ日はあとからも数える・ヒントの日は「ヒントいらず」に入らない", a.ms.join() === "7,4,0" && !a.f2.st7.got && a.f2.st7.n === 4 && a.f2.d10.got && a.f2.d30.n === 11 && a.f2.clean.got && a.f2.c30.n === 14, a.ms.join());
    check("まだの実績は「いま/目標」で、目標を超えない", a.f1.d30.n === 9 && a.f1.d30.g === 30 && a.f1.c1.n === 1);
    await pa.close(); }
  { // 保存に失敗したあとの読み直しで、片方にしか無い新しいキー（pdays・ach）を失わない（2026-11-04 CodeRabbit が前のゲームで指摘）
    const pf = await newPage();
    const ok = await pf.evaluate((K) => { const g = window.__bz; mem = JSON.stringify({ v: 1, t: 5, days: {}, pdays: { "2026-11-05": { h: [0, 0, 0] } }, ach: { c1: 1 } }); localStorage.setItem(K, JSON.stringify({ v: 1, t: 9, days: { "2026-11-06": { h: [0, 0, 0] } }, eat: {}, runs: {} })); const r1 = g.load(); mem = JSON.stringify({ v: 1, t: 9, days: {} }); localStorage.setItem(K, JSON.stringify({ v: 1, t: 5, pdays: { "2026-11-07": { h: [1, 0, 0] } }, ach: { h1: 1 } })); const r2 = g.load(); mem = null; return !!r1.pdays["2026-11-05"] && r1.ach.c1 === 1 && !!r1.days["2026-11-06"] && !!r2.pdays["2026-11-07"] && r2.ach.h1 === 1; }, KEY);
    check("保存に失敗したあと、片方にしか無い記録（あとから遊んだ日・知らせた実績）も合わせて残す", ok);
    await pf.close(); }
  // カレンダーと、取りこぼした日をあとから遊ぶ（時計を 2026-12-03 にする）
  async function clockPage(w, iso, seed) {
    const p = await browser.newPage({ viewport: { width: w, height: 760 } });
    p.on("pageerror", (e) => errors.push(e.message));
    p.on("console", (m) => { if (m.type() === "error" && !isNoise(m.text())) errors.push(m.text()); });
    await p.addInitScript((iso) => { const RD = Date, off = RD.parse(iso) - RD.now(); window.Date = class extends RD { constructor(...a) { if (a.length) super(...a); else super(RD.now() + off); } static now() { return RD.now() + off; } }; }, iso);
    await p.goto(url); await p.evaluate(([K, seed]) => localStorage.setItem(K, JSON.stringify(Object.assign({ v: 1, tut: true, days: {}, hdays: {}, eat: {}, boxes: 0, runs: {}, kofi: {} }, seed))), [KEY, seed]); await p.reload();
    return p;
  }
  { const seed = { days: { "2026-11-04": { h: [0, 0, 0] }, "2026-11-20": { h: [2, 2, 1] }, "2026-12-01": { h: [0, 1, 0] }, "2026-12-02": { h: [0, 0, 0] } }, hdays: { "2026-12-02": { h: [0, 0] } }, pdays: { "2026-11-28": { h: [0, 1, 0] } } };
    const pc = await clockPage(390, "2026-12-03T03:00:00Z", seed);
    check("ホームのカレンダーに、取りこぼした日の数（↺4）が出る", (await pc.textContent("#go-cal")).includes("↺4"));
    await pc.click("#go-cal");
    const c1 = await pc.evaluate(() => ({ on: [...document.querySelectorAll(".cal .d.on")].map((e) => e.dataset.k), h: document.querySelectorAll(".cal .d .h").length, st: (document.getElementById("cal-st") || {}).textContent || "", today: document.querySelectorAll(".cal .d.today").length, next: document.getElementById("cal-next").disabled, n1: document.querySelector('.cal [data-k="2026-12-01"]').textContent }));
    check("カレンダー：今月の遊んだ日に★の合計の印・上級の点・今日の枠・連続2日", c1.on.join() === "2026-12-01,2026-12-02" && c1.n1.includes("★8") && c1.h === 1 && c1.today === 1 && c1.st.includes("2日") && c1.next, JSON.stringify(c1));
    await pc.click("#cal-prev");
    const c2 = await pc.evaluate(() => ({ head: document.querySelector(".calnav b").textContent, on: [...document.querySelectorAll(".cal .d.on")].map((e) => e.dataset.k), later: [...document.querySelectorAll(".cal .d.later")].map((e) => e.dataset.k), can: [...document.querySelectorAll(".cal button.d.can")].map((e) => e.dataset.k), prev: document.getElementById("cal-prev").disabled, n20: document.querySelector('.cal [data-k="2026-11-20"]').textContent }));
    check("カレンダー：前の月へ戻れる・あとから遊んだ日は別の印（点線）・取りこぼした日（7日以内）だけ押せる・始めた月より前へは戻らない", c2.head === "2026年11月" && c2.on.join() === "2026-11-04,2026-11-20" && c2.later.join() === "2026-11-28" && c2.can.sort().join() === "2026-11-26,2026-11-27,2026-11-29,2026-11-30" && c2.prev && c2.n20.includes("★4"), JSON.stringify(c2));
    // あとから遊ぶ前に、今日の途中経過を作っておく（あとからで消さない）
    await pc.click("#back"); await pc.click("#go-d"); { const t = (await curB(pc)).tray[0]; await pc.click(`#bx .cell[data-i="${t.sol[0]}"]`); } await pc.click("#back");
    const before = await pc.evaluate(() => { const g = window.__bz, s = g.load(); return { days: Object.keys(s.days).length, st: g.streak(s.days), rd: JSON.stringify(s.runs.d), eat: Object.values(s.eat).reduce((a, b) => a + b, 0) }; });
    // A日（11/29）を途中まで → B日（11/27）を始める → A日に戻ると続きから
    await pc.click("#go-cal"); await pc.click('.misses button[data-k="2026-11-29"]');
    const runA = await pc.evaluate(() => { const g = window.__bz, r = g.load().runs["a:2026-11-29"]; return { list: r.list, want: g.dailyList("2026-11-29"), head: document.querySelector("header").textContent, mode: g.mode() }; });
    check("取りこぼした日は、その日付の種で今日の3箱と同じ3箱が出る（runs の「a:日付」に置く）", JSON.stringify(runA.list) === JSON.stringify(runA.want) && runA.head.includes("11/29") && runA.mode === "a:2026-11-29", runA.head);
    { const t = (await curB(pc)).tray[0]; await pc.click(`#bx .cell[data-i="${t.sol[0]}"]`); }
    const placedA = JSON.stringify((await curB(pc)).placed);
    await pc.click("#back"); await pc.click("#go-cal"); await pc.click('.misses button[data-k="2026-11-27"]');
    { const t = (await curB(pc)).tray[1]; await pc.click(`.pc[data-j="${t.id}"]`); await pc.click(`#bx .cell[data-i="${t.sol[0]}"]`); }
    await pc.click("#back"); await pc.click("#go-cal");
    const cont = await pc.textContent('.misses button[data-k="2026-11-29"]');
    await pc.click('.misses button[data-k="2026-11-29"]');
    check("A日を途中まで→B日を始める→A日に戻ると続きから（別の日を選んでも前の日の途中経過を消さない）", cont.includes("続き") && JSON.stringify((await curB(pc)).placed) === placedA && (await pc.evaluate(() => !!window.__bz.load().runs["a:2026-11-27"])), cont);
    for (let r = 0; r < 3; r++) { await solveNow(pc); await pc.click("#next"); }
    const after = await pc.evaluate(() => { const g = window.__bz, s = g.load(); return { days: Object.keys(s.days).length, st: g.streak(s.days), rd: JSON.stringify(s.runs.d), p: !!s.pdays["2026-11-29"], ra: s.runs["a:2026-11-29"], rb: !!s.runs["a:2026-11-27"], eat: Object.values(s.eat).reduce((a, b) => a + b, 0), today: !!s.days[g.todayKey()] }; });
    check("あとから遊んだ日は pdays に残り、今日の記録・連続の日・今日の途中経過・ほかの日の途中を変えない・図鑑には載る", after.p && after.days === before.days && after.st === before.st && after.rd === before.rd && !after.today && !after.ra && after.rb && after.eat > before.eat, JSON.stringify(after));
    check("あとから遊んだ結果にはシェア・Ko-fi を出さない", (await pc.locator("#share, .kofi").count()) === 0 && (await pc.textContent("header")).includes("あとから"));
    await pc.click("#go-cal"); await pc.click("#cal-prev");
    check("あとから遊んだ日はカレンダーで点線の印になり、もう押せない", (await pc.locator('.cal .d.later[data-k="2026-11-29"]').count()) === 1 && (await pc.locator('.misses button[data-k="2026-11-29"]').count()) === 0);
    const r8 = await pc.evaluate(() => { const g = window.__bz; g.startRun("a", "2026-11-20"); g.startRun("a", "2026-11-25"); g.startRun("a", "2026-12-03"); const s = g.load(); return Object.keys(s.runs).filter((x) => /2026-11-2[05]|2026-12-03/.test(x)).length + (document.querySelector(".calnav") ? "cal" : "x"); });
    check("遊んだ日・7日より前・今日の日は、あとからでは始めない", r8 === "0cal", r8);
    await pc.close(); }
  { const pz = await clockPage(390, "2026-12-03T03:00:00Z", { days: { "2026-11-20": { h: [0, 0, 0] } } });
    await pz.click("#go-cal");
    check("連続の日が0のときは、カレンダーに連続の言葉を出さない（休んだ日を責めない）", (await pz.locator("#cal-st").count()) === 0 && !/休|サボ|途切/.test(await pz.textContent("#app")));
    await pz.close(); }
  { // 取りこぼした日の選び方を600日分：きのう〜7日前・始めた日より後・遊んだ日を除く。問題は日付どおりで毎回同じ
    const pm = await newPage();
    const r = await pm.evaluate(() => {
      const g = window.__bz, bad = []; let shown = 0;
      for (let d = 0; d < 600; d++) {
        const k = new Date(Date.UTC(2026, 10, 4 + d)).toISOString().slice(0, 10), s = { days: {}, pdays: {} };
        for (let i = 1; i <= 9; i++) { const x = new Date(Date.parse(k) - i * 864e5).toISOString().slice(0, 10); if ((d * 7 + i * 3) % 5 === 0) s.days[x] = { h: [0, 0, 0] }; else if ((d + i) % 7 === 0) s.pdays[x] = { h: [0, 0, 0] }; }
        const m = g.missed(s, k), want = [];
        for (let i = 1; i <= 7; i++) { const x = new Date(Date.parse(k) - i * 864e5).toISOString().slice(0, 10); if (x >= "2026-11-04" && !s.days[x] && !s.pdays[x]) want.push(x); }
        if (m.join() !== want.join()) bad.push(k);
        if (d % 3 === 0) for (const x of m) { const a = g.dailyList(x); if (a.map((it) => g.boxOf(it).size).join() !== "小,中,大" || JSON.stringify(a) !== JSON.stringify(g.dailyList(x))) bad.push(k + ":" + x); }
        shown += m.length;
      }
      return { bad: bad.slice(0, 3), n: bad.length, shown };
    });
    check("600日分で、取りこぼした日はきのう〜7日前・始めた日より後・遊んだ日を除いたもの（問題は日付どおりの小・中・大）", r.n === 0 && r.shown > 600, `${r.bad.join(" | ")} 出た数${r.shown}`);
    await pm.close(); }
  for (const w of [320, 390]) { // ホーム・実績・カレンダー・結果の画面が狭い幅で崩れない
    const pw = await clockPage(w, "2026-12-03T03:00:00Z", { days: { "2026-12-01": { h: [0, 0, 0] }, "2026-12-03": { h: [0, 1, 2] } }, pdays: { "2026-11-29": { h: [1, 0, 0] } } });
    const look = async () => pw.evaluate(() => ({ over: document.documentElement.scrollWidth > innerWidth, small: [...document.querySelectorAll("button, a")].filter((e) => e.offsetParent && e.getBoundingClientRect().height < 44).map((e) => e.textContent.trim() || e.id) }));
    const h = await look(); await pw.click("#go-ach"); const a = await look(); const rows = await pw.locator(".ach").count(); await pw.click("#back"); await pw.click("#go-cal"); const c = await look(); await pw.click("#cal-prev"); const c2 = await look(); await pw.click("#back"); await pw.click("#go-d"); const rs = await look();
    check(`幅${w}px：ホーム・実績・カレンダー・結果が横にはみ出さず、押せる所は高さ44px以上`, [h, a, c, c2, rs].every((x) => !x.over && x.small.length === 0) && rows >= 10 && (await pw.locator(".minis .box").count()) === 3, JSON.stringify([h, a, c, c2, rs].map((x) => [x.over, x.small])));
    await pw.close(); }
} catch (e) {
  check("QA の操作が最後まで完了する", false, e.message.split("\n")[0]);
} finally {
  try { // キーボードで選んだボタンに枠が出る（all:unset のカレンダーのます目でも消えない。2026-11-04 CodeRabbit の指摘）。止まっても失敗として記録し、レポートまで進む
    const pf = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await pf.goto(url); await pf.evaluate(() => localStorage.clear()); await pf.reload();
    await pf.click("#howto-ok").catch(() => {});
    const bad = [];
    for (const open of [null, "#go-cal"]) {
      if (open) await pf.click(open);
      await pf.keyboard.press("Shift");
      bad.push(...await pf.evaluate(() => {
        const cal = document.querySelector(".cal");
        if (cal) { const b = document.createElement("button"); b.className = (cal.querySelector("button") || cal.lastElementChild).className + " miss"; b.textContent = "1"; cal.append(b); }
        return [...document.querySelectorAll("button:not([disabled]),a[href]")].filter((b) => b.checkVisibility()).filter((b) => { b.focus(); const cs = getComputedStyle(b); return !b.matches(":focus-visible") || cs.outlineStyle === "none" || parseFloat(cs.outlineWidth) < 2; }).map((b) => b.className || b.id || b.tagName);
      }));
    }
    check("キーボードで選んだボタン（カレンダーのあとから遊ぶ日も）に枠が出る", bad.length === 0, bad.join(","));
    await pf.close();
  } catch (e) { check("キーボードで選んだボタン（カレンダーのあとから遊ぶ日も）に枠が出る", false, e.message.split("\n")[0]); }
{ let pe; try { // とことん：箱が次々に出る・小→中→大→特盛・チケットなしで好きなだけ・降りると自己ベスト（2026-11-05「一日で遊べる量が少なすぎる」・2026-11-06「好きなだけ遊んでほしい」satou さん）
  check("ページに🎫・チケットが無い（好きなだけ遊べる）", !/🎫|チケット(?!・回数制限は無い)|life/.test(html.replace(/<!-- a11y:begin[\s\S]*?<!-- a11y:end -->/, "")));
  check("「…すると開く」のような、遊ぶと開くモードが無い", !/すると開く|で開きます|🔒(?!";position)/.test(html));
  check("Ko-fi は結果の1行と下のリンクだけ（ページの中に2か所）", (html.match(/ko-fi\.com/g) || []).length === 2);
  pe = await newPage();
  await pe.evaluate((k) => localStorage.setItem(k, JSON.stringify({ v: 1, tut: true })), KEY); await pe.reload();
  check("はじめて開いた日から、上級・とことん・練習のボタンがある", (await pe.locator("#go-h").count()) === 1 && (await pe.locator("#go-e").count()) === 1 && (await pe.locator("#go-p").count()) === 1);
  check("ホームに Ko-fi のひとことは出ない", (await pe.locator(".kofi").count()) === 0);
  check("とことんの並び（200回）：小3→中5→大10→特盛42、1回の中で同じ組み合わせの箱が出ない・種はばらばら", await pe.evaluate(() => { const g = window.__bz; for (let n = 0; n < 200; n++) { const L = g.endlessList(); if (L.length !== 60 || new Set(L.map((x) => x.seed)).size < 59) return false; if (!L.every((x, i) => x.s === (i < 3 ? 0 : i < 8 ? 1 : i < 18 ? 2 : 3))) return false; const ks = L.slice(0, 18).map((x) => g.B.boxKey(g.boxOf(x))); if (new Set(ks).size !== 18) return false; } return true; }));
  check("とことんは前の回・最近遊んだ箱と同じ組み合わせを出さない（100回つなげて）", await pe.evaluate(() => { const g = window.__bz; let prev = []; for (let n = 0; n < 100; n++) { const L = g.endlessList(prev); const ks = L.slice(0, 18).map((x) => g.B.boxKey(g.boxOf(x))); if (ks.some((k) => prev.includes(k))) return false; prev = prev.concat(ks).slice(-g.RECENT); } return true; }));
  check("練習の小・中は、続けて60回遊んでも同じ組み合わせの箱が出ない（最近の150箱を覚えて選び直す）", await pe.evaluate(() => { const g = window.__bz; for (const s of [0, 1]) { const av = new Set(), seen = new Set(); for (let n = 0; n < 60; n++) { const k = g.B.boxKey(g.boxOf(g.pickBox(s, av))); if (seen.has(k)) return false; seen.add(k); } } return true; }));
  check("ホームに「とことん」の大きなボタン", (await pe.locator("#go-e.main").count()) === 1);
  await pe.click("#go-e");
  for (let j = 0; j < 2; j++) { await solveNow(pe); await pe.click("#next"); }
  check("とことんは何箱目かを出す（🎫は出さない）", (await pe.textContent("header")).includes("3箱目") && !(await pe.textContent("body")).includes("🎫"));
  await pe.click("#hint"); await pe.click("#hint");
  check("とことんのヒントは何も減らさず、2回使っても続けられる", (await pe.evaluate(() => window.__bz.cur().hints)) === 2 && (await pe.evaluate(() => !("life" in window.__bz.load().runs.e))));
  await pe.click("#back"); await pe.click("#go-e");
  check("とことんは途中で閉じても続きから（3箱目・ヒント2回のまま）", (await pe.textContent("header")).includes("3箱目") && (await pe.evaluate(() => window.__bz.cur().hints)) === 2);
  await solveNow(pe); await pe.click("#next");
  check("ヒントを使った箱のあとも、とことんは続く（4箱目）", (await pe.textContent("header")).includes("4箱目") && (await pe.locator("#hint").isEnabled()));
  await pe.click("#quit");
  check("降りると詰めた箱の数・ヒントの回数・自己ベスト更新が出て、記録に残る（今日の記録には入らない）", (await pe.textContent("#eres")).includes("3箱") && (await pe.textContent("#ehint")).includes("2回") && (await pe.textContent("#ebest")).includes("自己ベスト更新") && (await pe.evaluate(() => { const s = window.__bz.load(); return s.ebest === 3 && !s.runs.e && Object.keys(s.days).length === 0 && s.recent.length === 3; })));
  check("とことんの結果の画面に Ko-fi のひとことは出ない", (await pe.locator(".kofi").count()) === 0);
  await pe.click("#go-e"); await pe.click("#quit");
  check("ベストに届かないと、ベストと「あと何箱で更新」を出し、ベストは下げない", (await pe.textContent("#ebest")).includes("あと4箱で更新") && (await pe.evaluate(() => window.__bz.load().ebest)) === 3);
  // 前の版の途中（🎫 life:0 付き・v の無い箱）も読めて、ヒントが押せる
  await pe.evaluate((k) => { const g = window.__bz, s = JSON.parse(localStorage.getItem(k)); s.runs.e = { mode: "e", date: g.todayKey(), list: [{ seed: 11, s: 0 }, { seed: 12, s: 1 }], res: [], cur: null, life: 0, id: "old" }; localStorage.setItem(k, JSON.stringify(s)); }, KEY);
  await pe.click("#back"); await pe.click("#go-e");
  check("前の版のとことんの途中（🎫0枚）も続きから遊べて、ヒントが押せる", (await pe.textContent("header")).includes("1箱目") && (await pe.locator("#hint").isEnabled()) && (await pe.locator("#bx .cell").count()) === 16);
  check("とことんの並びが残り少なくなったら箱を足して、終わらない", (await pe.evaluate(() => window.__bz.load().runs.e.list.length)) === 2 + 20);
  await solveNow(pe); await pe.click("#next");
  check("足した箱へ続けて進める（2箱目）", (await pe.textContent("header")).includes("2箱目"));
  // 練習を始めるときも、保存してある最近の箱を避ける（同じ乱数で最初に出る箱を履歴に入れておき、別の箱が選ばれるか。2026-11-06 CodeRabbit）
  const pr = await pe.evaluate((k) => { const g = window.__bz, R = Math.random, seq = () => { let x = 7; Math.random = () => { x = (x * 48271) % 2147483647; return x / 2147483647; }; }; try { seq(); const first = g.B.boxKey(g.boxOf(g.pickBox(0, new Set()))); const s = JSON.parse(localStorage.getItem(k)); s.recent = [first]; localStorage.setItem(k, JSON.stringify(s)); seq(); g.startRun("p", 0); const L = g.load().runs.p.list; return { first, got: g.B.boxKey(g.boxOf(L[0])) }; } finally { Math.random = R; } }, KEY);
  check("練習を始めるとき、保存してある最近の箱と同じ組み合わせは選び直す", pr.first !== pr.got, JSON.stringify(pr));
  // 保存に失敗したタブにだけある「最近の箱」も、別のタブの保存のあとで消えない
  const rm = await pe.evaluate((k) => { const keep = localStorage.getItem(k); try { mem = JSON.stringify({ v: 1, t: 1, recent: ["A", "B"] }); localStorage.setItem(k, JSON.stringify({ v: 1, t: 2, recent: ["B", "C"] })); const r = load().recent; return { r, ok: JSON.stringify(r) === JSON.stringify(["A", "B", "C"]) }; } finally { mem = null; localStorage.setItem(k, keep); } }, KEY);
  check("最近遊んだ箱は、保存したものとこのタブにだけあるものを合わせる", rm.ok, JSON.stringify(rm));
  } catch (e) { check("とことん・練習の検査", false, e.message.split("\n")[0]); } finally { if (pe) await pe.close().catch(() => {}); } }
  try { // 引き継ぎコード（別の端末へ記録を移す。shared-workflows template/qa/transfer-check.mjs）
    await checkTransfer({ browser, url, game: "bento-zume", sample: { "bento-v1": JSON.stringify({ v: 1, tut: true }) }, check, open: async (p) => { await p.click("#howto-ok", { timeout: 1500 }).catch(() => {}); } });
  } catch (e) { check("引き継ぎコード", false, e.message.split("\n")[0]); }
{ // 色だけで分けない・キーボードで詰められる・知らせを読み上げに届ける（shared-workflows routines/game-dev.md A1・A6・A7・A8）
  for (const cvd of [false, true]) {
    const pa = await newPage();
    await pa.evaluate(([k, cvd]) => { localStorage.setItem(k, JSON.stringify({ v: 1, tut: true })); localStorage.setItem("a11y-v1", JSON.stringify(cvd ? { cvd: true, calm: true } : {})); }, [KEY, cvd]);
    await pa.reload();
    await pa.evaluate(() => { window.__vib = 0; try { Object.defineProperty(navigator, "vibrate", { value: () => { window.__vib++; return true; }, configurable: true }); } catch (e) {} });
    await pa.click("#go-d");
    const tag = cvd ? "（色の見分けを助ける・動きを減らす）" : "（ふだん）";
    const c = await curB(pa);
    // キーボード：Tab で入れるますは1つだけ。矢印で動き、Enter で選んだおかずを詰め、描き直しても枠はますに残る
    const tabs = await pa.locator('#bx .cell[tabindex="0"]').count();
    await pa.focus('#bx .cell[tabindex="0"]');
    const start = await pa.evaluate(() => +document.activeElement.dataset.i);
    const t0 = c.tray.find((t) => t.id === c.sel), target = t0.sol[0];
    // 目当てのますまで矢印で動く
    const W = await pa.evaluate(() => window.__bz.cur().p.w);
    for (let i = 0; i < Math.floor(target / W) - Math.floor(start / W); i++) await pa.keyboard.press("ArrowDown");
    for (let i = 0; i < (target % W) - (start % W); i++) await pa.keyboard.press("ArrowRight");
    const at = await pa.evaluate(() => +document.activeElement.dataset.i);
    await pa.keyboard.press("Enter");
    const n = await curB(pa);
    const fo = await pa.evaluate(() => ({ inBox: !!document.activeElement.closest("#bx"), i: +document.activeElement.dataset.i }));
    check(`キーボード：Tab で箱に入り、矢印でますを動き、Enter でおかずを詰める・描き直しても枠はそのます${tag}`, tabs === 1 && at === target && n.placed[t0.id] && n.placed[t0.id].includes(target) && fo.inBox && fo.i === target, JSON.stringify({ tabs, at, target, fo }));
    await pa.waitForTimeout(80);
    const sr = await pa.evaluate(() => { const e = document.getElementById("sr"); return { live: e.getAttribute("aria-live"), role: e.getAttribute("role"), text: e.textContent }; });
    check(`詰めた知らせが読み上げの場所（aria-live）に文字で出る${tag}`, sr.live === "polite" && sr.role === "status" && sr.text.includes("詰めました"), JSON.stringify(sr));
    // 色だけで分けない：選んだおかずは ✓ の印と aria-pressed・詰めたおかずは点線の枠と「詰めた」・ますの名前は場所とおかず・境目に線
    const look = await pa.evaluate(() => {
      const sel = document.querySelector(".pc.sel"), used = document.querySelector(".pc.used"), cur = window.__bz.cur(), j = Object.keys(cur.placed)[0], cells = cur.placed[j];
      const placed = cells.map((i) => document.querySelector(`#bx .cell[data-i="${i}"]`));
      const ic2 = placed.map((b) => b.querySelector(".ic2")).filter(Boolean);
      return {
        selMark: sel ? getComputedStyle(sel, "::after").content : "", selPressed: sel ? sel.getAttribute("aria-pressed") : "",
        usedBorder: used ? getComputedStyle(used).borderStyle : "", usedLabel: used ? used.getAttribute("aria-label") : "",
        label: placed[0].getAttribute("aria-label"), food: cur.p.tray[+j].food[0], emoji: cur.p.tray[+j].food[1],
        firstEmoji: placed.some((b) => b.textContent.includes(cur.p.tray[+j].food[1]) && !b.querySelector(".ic2")),
        ic2: ic2.length, ic2Shown: ic2.filter((e) => getComputedStyle(e).display !== "none").length, cells: cells.length,
        edge: placed.some((b) => /rgba\(58, 42, 31/.test(getComputedStyle(b).borderTopColor + getComputedStyle(b).borderLeftColor + getComputedStyle(b).borderRightColor + getComputedStyle(b).borderBottomColor)),
        dots: [...document.querySelectorAll(".dots i")].map((i) => i.getBoundingClientRect().height + ":" + getComputedStyle(i).boxShadow.slice(0, 4)),
      };
    });
    check(`選んだおかずは色の枠だけでなく ✓ の印と aria-pressed でも分かる${tag}`, look.selMark.includes("✓") && look.selPressed === "true", JSON.stringify(look));
    check(`詰めたおかずは台で点線の枠と「詰めた」で分かり、箱のますは「行・列・おかずの名前」で読める${tag}`, look.usedBorder === "dashed" && /詰めた/.test(look.usedLabel) && /\d+行\d+列 /.test(look.label) && look.label.includes(look.food), JSON.stringify(look));
    check(`詰めたおかずは色だけでなく絵と境目の線でも分かる（色の見分けを助ける設定では全部のますに絵）${tag}`, look.firstEmoji && look.ic2 === look.cells - 1 && look.ic2Shown === (cvd ? look.cells - 1 : 0) && look.edge, JSON.stringify(look));
    check(`進み具合の点は色だけでなく、大きさ・塗り/枠でも分かる${tag}`, look.dots.length === 3 && look.dots[0] !== look.dots[1], look.dots.join(","));
    await pa.evaluate(() => { const c = window.__bz.cur(); for (const t of c.p.tray) c.placed[t.id] = t.sol.slice(); window.__bz.paint(); });
    // 最後の1品をキーボードで詰め直して完成させる
    await pa.evaluate(() => { const c = window.__bz.cur(), t = c.p.tray[c.p.tray.length - 1]; delete c.placed[t.id]; c.sel = t.id; window.__bz.paint(); document.querySelector(`#bx .cell[data-i="${t.sol[0]}"]`).focus(); });
    await pa.keyboard.press("Enter");
    if (!(await curB(pa)).done) { await pa.keyboard.press("Enter"); } // 向きがちがったら同じますでもう一度
    for (let k = 0; k < 30 && !(await curB(pa)).done; k++) await pa.keyboard.press("Enter");
    await pa.waitForTimeout(100);
    const fin = await pa.evaluate(() => ({ done: window.__bz.cur().done, st: document.querySelector(".verdict[role=status]") ? document.querySelector(".verdict .stars").getAttribute("aria-label") : "", off: [...document.querySelectorAll(".verdict .stars .off")].map((e) => e.textContent).join(""), next: document.activeElement && document.activeElement.id, sr: document.getElementById("sr").textContent }));
    check(`キーボードで詰め終えると「次の箱へ」に枠が移り、できあがりと★の数が文字で知らされる${tag}`, fin.done && fin.next === "next" && /星\dつ/.test(fin.st) && fin.sr.includes("できあがり"), JSON.stringify(fin));
    check(`★の数は色だけでなく、★と☆の形でも分かる${tag}`, !fin.off || /^☆+$/.test(fin.off), fin.off);
    const vib = await pa.evaluate(() => window.__vib);
    check(`動きを減らす設定では震わせない（ふだんは震える）${tag}`, cvd ? vib === 0 : vib > 0, String(vib));
    await pa.close();
  }
}
{ // スマホでの使いやすさ（2026-11-07 UI/UX の見直し）：1画面目に押すボタン・ボタンの字が折れない・できあがりで箱と「次の箱へ」が並ぶ・結果とホームで「もう1回」が上
  for (const [w, h] of [[390, 844], [320, 640]]) { let pu; const tag = `（${w}×${h}）`; try {
    pu = await newPage(w, h);
    await pu.evaluate((k) => localStorage.setItem(k, JSON.stringify({ v: 1, tut: true })), KEY); await pu.reload();
    const lay = () => pu.evaluate(() => { window.scrollTo(0, 0); const r = (id) => { const e = document.getElementById(id); return e ? e.getBoundingClientRect() : null; };
      const subs = [...document.querySelectorAll("#app button.sub")].filter((b) => b.offsetParent && b.id !== "hint").map((b) => [b.textContent.trim(), Math.round(b.getBoundingClientRect().height)]);
      const l1 = [...document.querySelectorAll("#app .main .l1")].map((e) => [e.textContent, Math.round(e.getBoundingClientRect().width), Math.round(e.closest("button").getBoundingClientRect().width)]);
      return { vh: innerHeight, over: document.documentElement.scrollWidth - innerWidth, d: r("go-d"), e: r("go-e"), sh: r("share"), subs, l1, eMain: !!document.querySelector("#go-e.main:not(.alt)"), dSub: !!document.querySelector("#go-d.sub"), eFirst: (() => { const a = document.getElementById("go-e"), b = document.getElementById("go-d"); return !!(a && b && (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)); })() }; });
    const wrapOk = (L) => L.subs.every(([, hh]) => hh <= 48) && L.l1.every(([, a, b]) => a <= b - 16);
    let L = await lay();
    check(`ホーム：「今日の3箱を詰める」が1画面目に入り、横にはみ出さない${tag}`, L.d.bottom <= L.vh && L.over <= 0, JSON.stringify({ d: L.d.bottom, vh: L.vh, over: L.over }));
    check(`ホーム：ボタンの字が言葉の途中で折れない（小さいボタンは1行・大きいボタンの名前は1行）${tag}`, wrapOk(L), JSON.stringify([L.subs, L.l1]));
    await pu.click("#go-d");
    const tut = await pu.evaluate(() => { const e = document.getElementById("tut"); return e ? e.getBoundingClientRect().bottom <= innerHeight : false; });
    check(`はじめての箱では、遊び方のひとことが箱のすぐ下（1画面目）に出る${tag}`, tut);
    await solveNow(pu); await pu.waitForTimeout(150);
    const dn = await pu.evaluate(() => { const bx = document.getElementById("bx").getBoundingClientRect(), nx = document.getElementById("next").getBoundingClientRect(); return { span: Math.round(nx.bottom - bx.top), vh: innerHeight, tray: !!document.getElementById("tray").offsetParent, clear: !!document.getElementById("clear").offsetParent, hint: !!(document.getElementById("hint") || {}).offsetParent }; });
    check(`できあがったら台・ヒント・全部もどすを隠し、箱と「次の箱へ」が1画面に収まる${tag}`, !dn.tray && !dn.clear && !dn.hint && dn.span <= dn.vh, JSON.stringify(dn));
    await pu.click("#next");
    check(`次の箱では台・ヒントがまた出る${tag}`, await pu.evaluate(() => !!document.getElementById("tray").offsetParent && !!document.getElementById("hint").offsetParent));
    for (let j = 0; j < 2; j++) { await solveNow(pu); await pu.click("#next"); }
    L = await lay();
    check(`今日の結果：「続けて遊ぶ：とことん」がシェアより上で、1画面目に入る${tag}`, L.e && L.sh && L.e.top < L.sh.top && L.e.bottom <= L.vh && L.over <= 0, JSON.stringify({ e: L.e && L.e.bottom, vh: L.vh }));
    check(`今日の結果：小さいボタンの字が折れない${tag}`, wrapOk(L), JSON.stringify(L.subs));
    await pu.click("#back"); L = await lay();
    check(`今日の3箱を終えたホームは、とことんが赤い大きなボタンで「今日の結果を見る」より上・1画面目${tag}`, L.eMain && L.dSub && L.eFirst && L.e.bottom <= L.vh, JSON.stringify({ eMain: L.eMain, dSub: L.dSub, eFirst: L.eFirst, e: L.e && L.e.bottom }));
    check(`今日の3箱を終えたホームでもボタンの字が折れない${tag}`, wrapOk(L), JSON.stringify([L.subs, L.l1]));
  } catch (e) { check(`スマホでの使いやすさ${tag}`, false, e.message.split("\n")[0]); } finally { if (pu) await pu.close(); } }
}
  await browser.close();
}
check("画面のエラーが無い", errors.length === 0, errors.slice(0, 3).join(" | "));

{ // 見やすさ・読みやすさ・偏り（shared-workflows template/qa/a11y.mjs の写し。routines/game-dev.md「だれでも遊べるように」）
  const { spawnSync } = await import("node:child_process");
  const a = spawnSync(process.execPath, [path.join(root, "qa", "a11y.mjs")], { encoding: "utf8", env: process.env });
  check("見やすさ・読みやすさの検査（qa/a11y.mjs。中身は qa-report/a11y.md）", a.status === 0, (a.stdout.match(/^- ❌.*$/gm) || []).join(" / ") || (a.status ? a.stderr.slice(-300) : ""));
}

const ng = results.filter((r) => !r.ok);
const md = `# お弁当づめ QA\n\n${results.map((r) => `- ${r.ok ? "✅" : "❌"} ${r.name}${r.detail ? `（${r.detail}）` : ""}`).join("\n")}\n\n${ng.length ? `❌ ${ng.length}件` : `✅ ${results.length}項目すべて通過`}\n`;
mkdirSync(path.join(root, "qa-report"), { recursive: true });
writeFileSync(path.join(root, "qa-report/report.md"), md);
console.log(md);
process.exit(ng.length ? 1 : 0);
