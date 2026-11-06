// お弁当づめ：お弁当箱（ます目）を、形のちがうおかずですき間なく埋めるパズル。
// make(seed, size) が種から箱とおかずを作る：先に箱をおかずに切り分けてから（必ず解ける）、おかずを並べ替えて出す。
(function (root) {
  "use strict";
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function seedOf(str) { let h = 2166136261; for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  // 大きさ：w×h、おかずの大きさ min〜max、仕切り（使えないます）の数
  const SIZES = [
    { name: "小", w: 4, h: 4, min: 2, max: 4, block: 0 },
    { name: "中", w: 5, h: 4, min: 3, max: 4, block: 0 },
    { name: "大", w: 5, h: 5, min: 3, max: 5, block: 0 },
  ];
  const HARD = { name: "特盛", w: 6, h: 6, min: 4, max: 5, block: 2 };
  // とことん・練習だけで使う箱の形のちがい（今日の3箱・上級は SIZES・HARD のまま。変えると過去の日の箱が変わる）。
  // 4×4 の小・5×4 の中は、おかずの組み合わせが120通りほどしか無く、すぐ同じ箱が出た（2026-11-06）。形と大きさの幅を足して千通り以上にする
  const VARIANTS = [
    [SIZES[0], { name: "小", w: 4, h: 4, min: 2, max: 5, block: 0 }, { name: "小", w: 5, h: 3, min: 2, max: 5, block: 0 }],
    [SIZES[1], { name: "中", w: 5, h: 4, min: 3, max: 5, block: 0 }, { name: "中", w: 6, h: 3, min: 3, max: 4, block: 0 }],
    [SIZES[2]],
    [HARD],
  ];
  // 形：[[x,y]...]。回すと同じになる形は同じ形（裏返しは別の形）
  const norm = (cells) => { const mx = Math.min(...cells.map((c) => c[0])), my = Math.min(...cells.map((c) => c[1])); return cells.map(([x, y]) => [x - mx, y - my]).sort((a, b) => a[1] - b[1] || a[0] - b[0]); };
  const rot = (cells) => norm(cells.map(([x, y]) => [-y, x]));
  const key = (cells) => cells.map((c) => c.join(",")).join(";");
  function rotations(cells) { const out = [], seen = new Set(); let c = norm(cells); for (let i = 0; i < 4; i++) { const k = key(c); if (!seen.has(k)) { seen.add(k); out.push(c); } c = rot(c); } return out; }
  const canon = (cells) => rotations(cells).map(key).sort()[0];
  // おかず：形ごとに決まる（canon の文字で選ぶ）
  const FOODS = [["えびフライ", "🍤", "#f2a33a"], ["卵焼き", "🥚", "#f7dc5c"], ["ブロッコリー", "🥦", "#5f9e45"], ["おにぎり", "🍙", "#ddd5c2"], ["からあげ", "🍗", "#a8642f"], ["焼き鮭", "🐟", "#f4a08c"], ["ミニトマト", "🍅", "#dd3b2c"], ["ウインナー", "🌭", "#e77d9a"], ["ハンバーグ", "🍖", "#6b3f2a"], ["枝豆", "🫛", "#a9d66f"], ["コロッケ", "🥔", "#c9955a"], ["ぶどう", "🍇", "#8a4fa0"], ["ブルーベリー", "🫐", "#5b6bb8"]];
  // 箱の見分け：大きさ・仕切り・おかずの形の組み合わせが同じなら同じ問題
  const boxKey = (p) => p.w + "x" + p.h + "|" + p.blocks.join(",") + "|" + p.shapes.map(canon).sort().join("/");
  const foodOf = (cells) => FOODS[seedOf(canon(cells)) % FOODS.length];

  // 箱を切り分ける。返り値 { w, h, blocks:[i], pieces:[[[x,y]...]], sol:[[i...]]（おかずごとのます） }
  function carve(R, S) {
    for (let tries = 0; tries < 500; tries++) {
      const N = S.w * S.h, own = new Array(N).fill(-1), blocks = [];
      while (blocks.length < S.block) { const i = Math.floor(R() * N); const x = i % S.w, y = Math.floor(i / S.w); if (own[i] === -1 && x > 0 && y > 0 && x < S.w - 1 && y < S.h - 1) { own[i] = -2; blocks.push(i); } }
      const nb = (i) => { const x = i % S.w, y = Math.floor(i / S.w), r = []; if (x > 0) r.push(i - 1); if (x < S.w - 1) r.push(i + 1); if (y > 0) r.push(i - S.w); if (y < S.h - 1) r.push(i + S.w); return r; };
      const pieces = [];
      let ok = true;
      while (true) {
        const start = own.indexOf(-1); if (start < 0) break;
        const want = S.min + Math.floor(R() * (S.max - S.min + 1));
        const cells = [start]; own[start] = pieces.length;
        while (cells.length < want) {
          const front = []; for (const c of cells) for (const n of nb(c)) if (own[n] === -1 && !front.includes(n)) front.push(n);
          if (!front.length) break;
          const n = front[Math.floor(R() * front.length)]; own[n] = pieces.length; cells.push(n);
        }
        if (cells.length < S.min) { ok = false; break; }
        // 残りに、min より小さい切れ端ができたらやり直す
        const seen = new Set(); let bad = false;
        for (let i = 0; i < N && !bad; i++) if (own[i] === -1 && !seen.has(i)) { const st = [i]; seen.add(i); let n = 0; while (st.length) { const c = st.pop(); n++; for (const m of nb(c)) if (own[m] === -1 && !seen.has(m)) { seen.add(m); st.push(m); } } if (n < S.min) bad = true; }
        if (bad) { ok = false; break; }
        pieces.push(cells);
      }
      if (!ok) continue;
      // 同じ形は2つまで
      const cnt = {}; let dup = false;
      const shapes = pieces.map((p) => norm(p.map((i) => [i % S.w, Math.floor(i / S.w)])));
      for (const s of shapes) { const k = canon(s); cnt[k] = (cnt[k] || 0) + 1; if (cnt[k] > 2) dup = true; }
      if (dup) continue;
      return { w: S.w, h: S.h, blocks: blocks.sort((a, b) => a - b), shapes, sol: pieces };
    }
    return null;
  }
  // 詰め方の数を数える（同じ形のおかずは区別しない。cap で打ち切る）
  function count(p, cap = 1000) {
    const N = p.w * p.h, filled = new Array(N).fill(false); for (const b of p.blocks) filled[b] = true;
    const groups = {}; for (const s of p.shapes) { const k = canon(s); (groups[k] = groups[k] || { rots: rotations(s), n: 0 }).n++; }
    const G = Object.values(groups); let total = 0;
    (function go() {
      if (total >= cap) return;
      const i = filled.indexOf(false); if (i < 0) { total++; return; }
      const x0 = i % p.w, y0 = Math.floor(i / p.w);
      for (const g of G) { if (!g.n) continue; for (const r of g.rots) {
        // r の最初のます（読む順で最初）を i に合わせる
        const [ax, ay] = r[0], cells = [];
        let fit = true; for (const [x, y] of r) { const X = x - ax + x0, Y = y - ay + y0; if (X < 0 || Y < 0 || X >= p.w || Y >= p.h || filled[Y * p.w + X]) { fit = false; break; } cells.push(Y * p.w + X); }
        if (!fit) continue;
        cells.forEach((c) => (filled[c] = true)); g.n--; go(); g.n++; cells.forEach((c) => (filled[c] = false));
      } }
    })();
    return total;
  }
  // 種から1箱。候補を何個か作り、詰め方の少ない（考えがいのある）ものを選ぶ。おかずの並びも種で混ぜる
  function make(seed, S) {
    const R = rng(seed); let best = null;
    for (let a = 0; a < 10 && !best; a++) for (let k = 0; k < 4; k++) { const p = carve(R, S); if (!p) continue; p.ways = count(p, 300); if (!best || p.ways < best.ways) best = p; } // 4回とも切り分けに失敗したときだけ、4回ずつやり直す（最初の4回で作れる種は、今までと同じ箱）
    if (!best) return null;
    const order = best.shapes.map((_, i) => i); for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    // 出すときの向きも種で回す（答えの向きのまま並べない）
    const turns = order.map(() => Math.floor(R() * 4));
    // おかず：1箱の中で、形がちがえば必ずちがうおかず（同じ形は同じおかず）。形ごとの好みの番号から、空いている番号を順にさがす
    const assign = {}, used = new Set();
    for (const k of [...new Set(best.shapes.map(canon))].sort()) { let f = seedOf(k) % FOODS.length; while (used.has(f)) f = (f + 1) % FOODS.length; used.add(f); assign[k] = FOODS[f]; }
    best.tray = order.map((i, j) => { let s = best.shapes[i]; for (let t = 0; t < turns[j]; t++) s = rot(s); return { id: j, cells: s, sol: best.sol[i], food: assign[canon(s)] }; });
    best.size = S.name;
    return best;
  }
  const api = { rng, seedOf, SIZES, HARD, VARIANTS, boxKey, norm, rot, rotations, canon, key, foodOf, FOODS, carve, count, make };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.BENTO = api;
})(typeof self !== "undefined" ? self : this);
