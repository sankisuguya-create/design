/* 試作：ピルの床（3つのパラメータ）。生成器の形は ../generators.js と同じ。
   ブラウザでは window.GrowingFigures.GENERATORS に足す。Node では module.exports.GENERATORS。

   ピル＝長方形の短辺に半円（直径＝帯の幅）が付いた形。どの版も「帯」にピルを並べ、ピルとピルの継ぎ目に
   すき間（両側が半円にえぐれた蝶ネクタイ形）を置く。色はピル＝色1、すき間＝色2（図と地）。

   3つのパラメータ（id は pills_<c|s><r|n><o|x>）
     曲がる c ／曲がらない s … 帯を同心の輪（極座標）に巻くか、平行な帯（直交座標）のままにするか。
                               曲がったピルは、まっすぐなピルの帯を輪に巻いたもの（同じ規則を2つの座標で描く）
     輪郭あり r ／なし n     … 帯の境の線（同心円・平行線）のうち、すき間どうしが接する部分を残すか。
                               なしでは接するすき間を1枚にまとめ、残る線はピルの縁だけになる
     重なりあり o ／なし x   … 継ぎ目で、ピルの終わりの端を次のピルの始まりの端の後ろに入れてよいか。
                               ありでは継ぎ目の約38%を重ね（フィボナッチ語の 0 の位置）、残りをすき間にする。
                               全部を重ねるとすき間が消えて「輪郭なし」が意味を失うので、一部だけにする
   帯ごとに並びの始まりを黄金比ぶんずらす（曲がる版は黄金角）。 */
(function (root) {
  'use strict';
  var TAU = 2 * Math.PI, GA = Math.PI * (3 - Math.sqrt(5)), PHI = (1 + Math.sqrt(5)) / 2;

  function farthest(g) {
    var f = 0;
    [[0, 0], [g.W, 0], [0, g.H], [g.W, g.H]].forEach(function (p) {
      var dx = p[0] - g.ox, dy = p[1] - g.oy; f = Math.max(f, Math.sqrt(dx * dx + dy * dy));
    });
    return f;
  }
  function onScreen(g, pts, m) {
    var x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i];
      if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0];
      if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1];
    }
    return x1 > -m && x0 < g.W + m && y1 > -m && y0 < g.H + m;
  }
  function fib(j) { return Math.floor((j + 2) / PHI) - Math.floor((j + 1) / PHI); }   // フィボナッチ語（1 が約62%）

  function makePills(curved, outline, overlap) {
    return function (g) {
      var w = g.edge * 0.72, BODY = 1.7 * w, GAP = 1.3 * w, m = w * 3, out = [];
      var pGap = overlap ? 1 / PHI : 1, avg = BODY + GAP * pGap;
      // 帯の座標 (u, v)：u は帯に沿う向き（曲がる版は角度、曲がらない版は x）、v は帯を横切る向き（半径／y）
      function P(u, v) { return curved ? [g.ox + v * Math.cos(u), g.oy + v * Math.sin(u)] : [u, v]; }
      function side(v, ua, ub) {   // 帯の縁（v 一定）を ua から ub へ（ua を含み ub を含まない）
        if (!curved) return [P(ua, v)];
        var d = ub - ua, n = Math.max(1, Math.ceil(Math.abs(d) / Math.min(0.25, Math.sqrt(0.2 / v)))), o = [];
        for (var k = 0; k < n; k++) o.push(P(ua + d * k / n, v));
        return o;
      }
      // 端の半円：u の位置の横切る線分（v0〜v1）を直径にして、s（+1／−1）の向きへふくらむ。外（v1）から内（v0）へ、内は含まない
      function cap(v0, v1, u, s) {
        var c = P(u, (v0 + v1) / 2), h = (v1 - v0) / 2, cr, ct;
        if (curved) { cr = [Math.cos(u), Math.sin(u)]; ct = [-Math.sin(u) * s, Math.cos(u) * s]; }
        else { cr = [0, 1]; ct = [s, 0]; }
        var n = Math.max(6, Math.ceil(Math.PI * h / 3)), o = [];
        for (var k = 0; k < n; k++) {
          var a = Math.PI * k / n;
          o.push([c[0] + h * (Math.cos(a) * cr[0] + Math.sin(a) * ct[0]), c[1] + h * (Math.cos(a) * cr[1] + Math.sin(a) * ct[1])]);
        }
        return o;
      }
      function rev(pts, first) { return [first].concat(pts.slice(1).reverse()); }   // 内の端から外へ（外の端は含まない）

      /* ---- 帯ごとの並び ---- */
      var strips = [];   // { v0, v1, pills:[{s0,s1,gap}], ties:[{s1,s2}] }
      if (curved) {
        var r0 = w * 0.8, far = farthest(g) + w * 2;
        for (var k = 0, v0 = r0; v0 < far; k++, v0 += w) {
          var vm = v0 + w / 2, n = Math.max(3, Math.round(TAU * vm / avg)), types = [], ng = 0;
          for (var j = 0; j < n; j++) { var gp = !overlap || fib(j + k * 5) === 1; types.push(gp); if (gp) ng++; }
          if (!ng) { types[0] = true; ng = 1; }
          var f = TAU / (n * BODY + ng * GAP), cur = k * GA, S = { v0: v0, v1: v0 + w, k: k, pills: [], ties: [], wrap: true };
          for (j = 0; j < n; j++) {
            var s0 = cur, s1 = s0 + BODY * f;
            S.pills.push({ s0: s0, s1: s1, gap: types[j] });
            if (types[j]) { S.ties.push({ s1: s1, s2: s1 + GAP * f }); cur = s1 + GAP * f; } else cur = s1;
          }
          strips.push(S);
        }
      } else {
        var k0 = Math.floor((-m - g.oy) / w), k1 = Math.ceil((g.H + m - g.oy) / w);
        for (var kk = k0; kk < k1; kk++) {
          var sv0 = g.oy + kk * w, sh = ((kk * (PHI - 1)) % 1 + 1) % 1;
          var cur2 = g.ox + sh * avg - Math.ceil((g.ox + m) / avg + 2) * avg, S2 = { v0: sv0, v1: sv0 + w, k: kk, pills: [], ties: [], wrap: false };
          for (var jj = 0; cur2 < g.W + m; jj++) {
            var t0 = cur2, t1 = t0 + BODY, gp2 = !overlap || fib(jj + ((kk * 5) % 1000 + 1000)) === 1;
            S2.pills.push({ s0: t0, s1: t1, gap: gp2 });
            if (gp2) { S2.ties.push({ s1: t1, s2: t1 + GAP }); cur2 = t1 + GAP; } else cur2 = t1;
          }
          strips.push(S2);
        }
      }

      /* ---- ピル：始まりの端はいつも手前（ふくらむ）。終わりは、すき間なら自分の端（ふくらむ）、
         重なりなら次のピルの始まりの端（えぐれる：自分の端はその後ろに隠れる） ---- */
      strips.forEach(function (S) {
        var N = S.pills.length;
        S.pills.forEach(function (p, i) {
          var e = p.s1;   // 重なりのときも、次のピルの始まりは p.s1
          var endCap = cap(S.v0, S.v1, e, p.gap ? 1 : -1);
          var poly = side(S.v1, p.s0, e).concat(endCap, side(S.v0, e, p.s0), rev(cap(S.v0, S.v1, p.s0, -1), P(p.s0, S.v0)));
          if (onScreen(g, poly, 0)) out.push({ p: poly, cls: 1, dir: (((S.k * 2 + i) % 5) + 5) % 5 });
        });
      });

      /* ---- すき間 ---- */
      function tiePoly(S, t) {
        return side(S.v1, t.s1, t.s2).concat(cap(S.v0, S.v1, t.s2, -1), side(S.v0, t.s2, t.s1), rev(cap(S.v0, S.v1, t.s1, 1), P(t.s1, S.v0)));
      }
      var disk = null;
      if (curved) { disk = []; for (var q = 0; q < 60; q++) disk.push(P(q * TAU / 60, strips[0].v0)); }
      if (outline) {
        strips.forEach(function (S) { S.ties.forEach(function (t) { var p = tiePoly(S, t); if (onScreen(g, p, 0)) out.push({ p: p, cls: 0, dir: ((S.k % 5) + 5) % 5 }); }); });
        if (disk) out.push({ p: disk, cls: 0, dir: 0 });
        return out;
      }
      mergeGaps(g, strips, curved, P, side, cap, rev, out);
      return out;
    };
  }

  /* 輪郭なし：帯の境で、下の帯のすき間（外の縁）と上の帯のすき間（内の縁）が両方掛かる区間は線を消し、2つを同じ組にする。
     片方だけの区間と半円は縁として残し、組ごとに向きどおりにつなぐ。曲がる版は中心の円もすき間の側に入れる */
  function mergeGaps(g, strips, curved, P, side, cap, rev, out) {
    var ties = [], par = [], edges = [];
    function find(x) { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; }
    function unite(a, b) { a = find(a); b = find(b); if (a !== b) par[a] = b; }
    function md(a) { return curved ? ((a % TAU) + TAU) % TAU : a; }
    function key(c, a) { return c + '|' + (curved ? Math.round(md(a) * 1e9) % Math.round(TAU * 1e9) : Math.round(a * 1e6)); }
    var CENTER = -1;
    if (curved) { CENTER = 0; ties.push({ full: true }); par.push(0); }
    var byStrip = strips.map(function (S, si) {
      return S.ties.map(function (t) {
        var id = ties.length; ties.push({ si: si, s1: t.s1, s2: t.s2 }); par.push(id);
        edges.push({ t: id, from: key(si + 1, t.s2), to: key(si, t.s2), kind: 'cap', S: S, u: t.s2, sg: -1, fwd: true });
        edges.push({ t: id, from: key(si, t.s1), to: key(si + 1, t.s1), kind: 'cap', S: S, u: t.s1, sg: 1, fwd: false });
        return id;
      });
    });
    // 境 c は帯 c-1 の外の縁と帯 c の内の縁
    for (var c = 0; c <= strips.length; c++) {
      var L = c > 0 ? byStrip[c - 1] : [], U = c < strips.length ? byStrip[c] : [], ev = [], cur = { L: -1, U: -1 };
      var v = c < strips.length ? strips[c].v0 : strips[c - 1].v1;
      function addIv(list, sd) {
        list.forEach(function (id) {
          var a = md(ties[id].s1), b = md(ties[id].s2);
          ev.push({ a: a, sd: sd, t: id, on: true }, { a: b, sd: sd, t: id, on: false });
          if (curved && a > b) cur[sd] = id;
        });
      }
      addIv(L, 'L'); addIv(U, 'U');
      if (curved && c === 0) cur.L = CENTER;
      if (!ev.length) continue;
      ev.sort(function (x, y) { return x.a - y.a; });
      for (var e = 0; e < ev.length; e++) {
        var E = ev[e];
        if (E.on) cur[E.sd] = E.t; else if (cur[E.sd] === E.t) cur[E.sd] = -1;
        var a0 = E.a, a1;
        if (e + 1 < ev.length) a1 = ev[e + 1].a; else if (curved) a1 = ev[0].a + TAU; else break;
        if (a1 - a0 < 1e-9) continue;
        if (cur.L >= 0 && cur.U >= 0) unite(cur.L, cur.U);
        else if (cur.L >= 0) edges.push({ t: cur.L, from: key(c, a0), to: key(c, a1), kind: 'side', v: v, a0: a0, a1: a1 });
        else if (cur.U >= 0) edges.push({ t: cur.U, from: key(c, a1), to: key(c, a0), kind: 'side', v: v, a0: a1, a1: a0 });
      }
    }
    var groups = {};
    edges.forEach(function (E) { var r = find(E.t); (groups[r] = groups[r] || []).push(E); });
    var cnt = 0;
    for (var gk in groups) {
      var es = groups[gk], start = {}, used = new Set(), loops = [];
      es.forEach(function (E) { start[E.from] = E; });
      es.forEach(function (E0) {
        if (used.has(E0)) return;
        var pts = [], E = E0, guard = 0;
        while (E && !used.has(E) && guard++ < 200000) {
          used.add(E);
          if (E.kind === 'side') {
            var d = E.a1 - E.a0;
            if (curved) { if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; }
            pts = pts.concat(side(E.v, E.a0, E.a0 + d));
          } else {
            var cp = cap(E.S.v0, E.S.v1, E.u, E.sg);
            pts = pts.concat(E.fwd ? cp : rev(cp, P(E.u, E.S.v0)));
          }
          E = start[E.to];
        }
        if (pts.length > 2) loops.push(pts);
      });
      if (!loops.length) continue;
      var area = function (p) { var s = 0; for (var i = 0; i < p.length; i++) { var a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; } return Math.abs(s / 2); };
      loops.sort(function (a, b) { return area(b) - area(a); });
      var tile = { p: loops[0], cls: 0, dir: (cnt++) % 5 };
      if (loops.length > 1) tile.h = loops[1];
      if (onScreen(g, tile.p, 0)) out.push(tile);
    }
  }

  /* 鱗のピル：曲がる・隙間なし。どの継ぎ目でも、片方のピルの端をもう片方の端の後ろに入れ、輪をピルだけで埋める。
     見える形はどれも「片方の端がふくらみ、もう片方がえぐれた」同じ形（鱗）。中心の円は長さ0のピル。
     dirMode：'same'＝どの輪も同じ向きに重ねる、'alt'＝輪ごとに向きを逆にする（隣の輪が逆回りに見える）
     colMode：'alt'＝輪の中で A/B 交互、'fib'＝フィボナッチ語、'arm'＝対数螺旋の腕（色の層に渦が浮かぶ） */
  function makeScales(dirMode, colMode) {
    return function (g) {
      var w = g.edge * 0.72, SLOT = 2.6 * w, r0 = w * 0.8, far = farthest(g) + w * 2, out = [];
      function P(u, v) { return [g.ox + v * Math.cos(u), g.oy + v * Math.sin(u)]; }
      function side(v, ua, ub) {
        var d = ub - ua, n = Math.max(1, Math.ceil(Math.abs(d) / Math.min(0.25, Math.sqrt(0.2 / v)))), o = [];
        for (var k = 0; k < n; k++) o.push(P(ua + d * k / n, v));
        return o;
      }
      function cap(v0, v1, u, s) {
        var c = P(u, (v0 + v1) / 2), h = (v1 - v0) / 2, cr = [Math.cos(u), Math.sin(u)], ct = [-Math.sin(u) * s, Math.cos(u) * s];
        var n = Math.max(6, Math.ceil(Math.PI * h / 3)), o = [];
        for (var k = 0; k < n; k++) {
          var a = Math.PI * k / n;
          o.push([c[0] + h * (Math.cos(a) * cr[0] + Math.sin(a) * ct[0]), c[1] + h * (Math.cos(a) * cr[1] + Math.sin(a) * ct[1])]);
        }
        return o;
      }
      function rev(pts, first) { return [first].concat(pts.slice(1).reverse()); }
      var ARMS = 8, TW = 1.6;
      function color(k, i, n, uc, vm) {
        if (colMode === 'alt') return i & 1;
        if (colMode === 'fib') return fib(i + k * 7);
        var t = uc - TW * Math.log(vm / r0 + 1);
        return Math.floor((((t / TAU) % 1 + 1) % 1) * ARMS) & 1;
      }
      var disk = []; for (var q = 0; q < 60; q++) disk.push(P(q * TAU / 60, r0));
      out.push({ p: disk, cls: 1, dir: 0 });
      for (var k = 0, v0 = r0; v0 < far; k++, v0 += w) {
        var v1 = v0 + w, vm = v0 + w / 2, n = Math.max(3, Math.round(TAU * vm / SLOT));
        if (colMode === 'alt' && n % 2) n++;                       // 交互は偶数でないと1周で食い違う
        var al = TAU / n, off = k * GA, fwd = dirMode === 'same' || (k & 1) === 0;
        // fwd：どのピルも終わりの端が次のピルの始まりの後ろ（始まり＝ふくらむ、終わり＝えぐれる）。逆はその鏡
        for (var i = 0; i < n; i++) {
          var s0 = off + i * al, s1 = s0 + al;
          var mc = P(s0 + al / 2, vm), rad = vm * al / 2 + w * 2;
          if (mc[0] < -rad || mc[0] > g.W + rad || mc[1] < -rad || mc[1] > g.H + rad) continue;
          var sg = fwd ? -1 : 1;   // 継ぎ目の半円がふくらむ向き（手前のピルの端）
          var poly = side(v1, s0, s1).concat(cap(v0, v1, s1, sg), side(v0, s1, s0), rev(cap(v0, v1, s0, sg), P(s0, v0)));
          if (!onScreen(g, poly, 0)) continue;
          out.push({ p: poly, cls: color(k, i, n, s0 + al / 2, vm), dir: (k + i) % 5 });
        }
      }
      return out;
    };
  }

  var G = {};
  [[true, '曲がる'], [false, '曲がらない']].forEach(function (a) {
    [[true, '輪郭あり'], [false, '輪郭なし']].forEach(function (b) {
      [[false, '重なりなし'], [true, '重なりあり']].forEach(function (c) {
        var id = 'pills_' + (a[0] ? 'c' : 's') + (b[0] ? 'r' : 'n') + (c[0] ? 'o' : 'x');
        G[id] = { name: 'ピル：' + a[1] + '・' + b[1] + '・' + c[1], make: makePills(a[0], b[0], c[0]) };
      });
    });
  });
  [['same', 'そろえる'], ['alt', '輪ごとに逆']].forEach(function (a) {
    [['alt', '交互'], ['fib', 'フィボナッチ'], ['arm', '渦の腕']].forEach(function (b) {
      G['scales_' + a[0] + '_' + b[0]] = { name: '鱗のピル：重なり' + a[1] + '・染め分け ' + b[1], make: makeScales(a[0], b[0]) };
    });
  });
  if (typeof module !== 'undefined' && module.exports) module.exports = { GENERATORS: G };
  else for (var id in G) root.GrowingFigures.GENERATORS[id] = G[id];
})(typeof window !== 'undefined' ? window : global);
