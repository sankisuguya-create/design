'use strict';
/**
 * 生成器の採否の検査（SPEC.md「採否の基準」の機械で測れる部分）。
 *   node growing-figures/check.cjs            … 全部の生成器
 *   node growing-figures/check.cjs heptagon   … 1つだけ
 * 画面は Chromebook（1366×768）とスマホ（390×844）の2つで測る。
 * 目で見て決める基準（神秘性・色の分かれ方）はここでは測らない。sampler.html で見る。
 */
const { GENERATORS } = require('./generators.js');

const SCREENS = [{ name: 'Chromebook', W: 1366, H: 768 }, { name: 'スマホ', W: 390, H: 844 }];
const LIMITS = { minTiles: 1200, maxTiles: 5000, maxMs: 150, minShare: 0.15, maxGap: 0.002 };

function setup(W, H) {
  const edge = Math.max(15, Math.min(28, Math.sqrt(W * H) / 40));
  // 育ち始める点は共通エンジンと同じ規則（横長は左下寄り、縦長は上端）
  return { W, H, ox: W * (W < H ? 0.5 : 0.14), oy: H * (W < H ? 0.06 : 0.78), edge, margin: edge * 2 };
}
function inside(pt, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a[1] > pt[1]) !== (b[1] > pt[1]) && pt[0] < (b[0] - a[0]) * (pt[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}
/** 画面を格子状に点で刺し、どのタイルにも入らない点（隙間）と2枚以上に入る点（重なり）の割合を出す */
function coverage(tiles, g) {
  const cell = 40, grid = new Map();
  tiles.forEach((t, i) => {
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    t.p.forEach(p => { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); });
    for (let gx = Math.floor(x0 / cell); gx <= Math.floor(x1 / cell); gx++)
      for (let gy = Math.floor(y0 / cell); gy <= Math.floor(y1 / cell); gy++) {
        const k = gx + ',' + gy; if (!grid.has(k)) grid.set(k, []); grid.get(k).push(i);
      }
  });
  let n = 0, gap = 0, over = 0;
  for (let x = 3.3; x < g.W; x += 7.1) for (let y = 2.9; y < g.H; y += 7.3) {
    const hits = (grid.get(Math.floor(x / cell) + ',' + Math.floor(y / cell)) || []).filter(i => inside([x, y], tiles[i].p) && !(tiles[i].h && inside([x, y], tiles[i].h))).length;   // h は穴
    n++; if (hits === 0) gap++; if (hits > 1) over++;
  }
  return { gap: gap / n, over: over / n };
}

const names = process.argv[2] ? [process.argv[2]] : Object.keys(GENERATORS);
let bad = 0;
names.forEach(name => {
  const G = GENERATORS[name];
  if (!G) { console.log(`✗ ${name}: 生成器がありません`); bad++; return; }
  SCREENS.forEach(sc => {
    const g = setup(sc.W, sc.H);
    G.make(g);                                   // 1回目は JIT の暖機。測るのは2回目
    const t0 = process.hrtime.bigint();
    const raw = G.make(g);
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    // 共通エンジンと同じく、画面に掛からないタイルは捨ててから数える（外接する四角が画面と重なるかで見る。
    // 中心の位置で捨てると、渦の真円の外側の大きな円のように、中心は画面の外でも一部が画面に掛かるタイルが抜けて穴になる）
    const tiles = raw.filter(t => {
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      t.p.forEach(p => { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); });
      return x1 > 0 && x0 < g.W && y1 > 0 && y0 < g.H;
    });
    const c1 = tiles.filter(t => t.cls === 1).length, share = Math.min(c1, tiles.length - c1) / tiles.length;
    const cov = coverage(tiles, g);
    const shapeOk = tiles.every(t => t.p.length >= 3 && (t.cls === 0 || t.cls === 1) && t.dir >= 0 && t.dir <= 4);
    const probs = [];
    if (G.tileCount && tiles.length !== G.tileCount) probs.push('規定の円の個数と異なる');
    if (G.coverage !== 'sparse' && sc.name === 'Chromebook' && (tiles.length < LIMITS.minTiles || tiles.length > LIMITS.maxTiles)) probs.push(`枚数 ${tiles.length}（${LIMITS.minTiles}〜${LIMITS.maxTiles}）`);
    if (ms > LIMITS.maxMs) probs.push(`生成 ${ms.toFixed(0)}ms（${LIMITS.maxMs}ms 以下。実機はこの数倍）`);
    if (share < LIMITS.minShare) probs.push(`色の片寄り（少ない方が ${(share * 100).toFixed(0)}%。${LIMITS.minShare * 100}% 以上）`);
    if (G.coverage !== 'sparse' && cov.gap > LIMITS.maxGap) probs.push(`隙間 ${(cov.gap * 100).toFixed(2)}%`);
    if (cov.over > LIMITS.maxGap) probs.push(`重なり ${(cov.over * 100).toFixed(2)}%`);
    if (!shapeOk) probs.push('タイルの形式（p / cls / dir）が仕様と違う');
    const head = `${probs.length ? '✗' : '✓'} ${G.name} [${sc.name}]`;
    console.log(`${head}  ${tiles.length}枚（色1 ${c1}・色2 ${tiles.length - c1}）生成 ${ms.toFixed(0)}ms 隙間 ${(cov.gap * 100).toFixed(2)}% 重なり ${(cov.over * 100).toFixed(2)}%`);
    probs.forEach(p => console.log('    - ' + p));
    if (probs.length) bad++;
  });
});
process.exit(bad ? 1 : 0);
