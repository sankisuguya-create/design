/**
 * 成長する図形 — 生成器
 *
 * 生成器は「画面の大きさと育ち始める点」を受け取り、タイルの配列を返すだけの純粋な関数。
 * 並べ替え・文字の際の薄め・3層の育ち・描画は、使う側の共通エンジンが受け持つ（SPEC.md）。
 *
 *   make(g) → [{ p: [[x,y], ...], cls: 1|0, dir: 0..4 }, ...]
 *     g   = { W, H, ox, oy, edge, margin }
 *           W,H     画面の大きさ（CSS px）
 *           ox,oy   育ち始める点
 *           edge    タイル1枚の目安の大きさ（px）
 *           margin  分割の途中で捨てる判定に使う余白（px。edge×2 が目安）
 *     p   閉じた多角形の頂点（最後の点から最初の点へ閉じる）。1枚まるごと描く単位
 *     cls 1＝色1（学年の色）の層で塗る、0＝色2（サイトの色）の層で塗る
 *     dir 同じ色の中の明暗の段（0..4）。宝石の切子面のように少しずつ変える
 *
 * ブラウザでは window.GrowingFigures、Node では module.exports に入る。
 * 依存は無い。DOM にも触れない（Node で検査できる：check.cjs）。
 */
(function (root) {
  'use strict';
  var PHI = (1 + Math.sqrt(5)) / 2;

  function lerp(p, q, t) { return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]; }
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
  function dirOf(a, b) {
    var ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    return ((Math.round(ang / (Math.PI / 5)) % 5) + 5) % 5;
  }

  /* ペンローズ（P3）。ロビンソン三角形の置き換えを繰り返し、辺BCを共有する2枚を組にして菱形にする。
     色1＝太い菱形（72°）、色2＝細い菱形（36°） */
  function penrose(g) {
    var R = g.edge, k = 0, far = farthest(g), T = [], i, j;
    while (R < far + g.edge * 2) { R *= PHI; k++; }
    for (i = 0; i < 10; i++) {
      var b = [g.ox + R * Math.cos((2 * i - 1) * Math.PI / 10), g.oy + R * Math.sin((2 * i - 1) * Math.PI / 10)],
          c = [g.ox + R * Math.cos((2 * i + 1) * Math.PI / 10), g.oy + R * Math.sin((2 * i + 1) * Math.PI / 10)];
      if (i % 2 === 0) { var t = b; b = c; c = t; }
      T.push([0, [g.ox, g.oy], b, c]);
    }
    for (var s = 0; s < k; s++) {
      var N = [];
      for (j = 0; j < T.length; j++) {
        var c0 = T[j][0], A = T[j][1], B = T[j][2], C = T[j][3];
        if (c0 === 0) { var P = lerp(A, B, 1 / PHI); N.push([0, C, P, B], [1, P, C, A]); }
        else { var Q = lerp(B, A, 1 / PHI), S = lerp(B, C, 1 / PHI); N.push([1, S, C, A], [1, Q, S, B], [0, S, Q, A]); }
      }
      // 画面（＋余白）に掛からない三角形は、それ以上分割せずに捨てる。
      // 余白を菱形2枚分とるのは、画面の縁で菱形の片割れだけが残らないようにするため
      T = N.filter(function (t) { return onScreen(g, [t[1], t[2], t[3]], g.margin); });
    }
    function key(p) { return Math.round(p[0] * 8) + ',' + Math.round(p[1] * 8); }
    var pair = {}, out = [];
    for (j = 0; j < T.length; j++) {
      var tr = T[j], kb = key(tr[2]), kc = key(tr[3]),
          kk = tr[0] + '|' + (kb < kc ? kb + '|' + kc : kc + '|' + kb), o = pair[kk];
      if (!o) { pair[kk] = tr; continue; }
      delete pair[kk];
      out.push({ p: [tr[1], tr[2], o[1], tr[3]], cls: tr[0], dir: dirOf(tr[1], o[1]) });
    }
    return out;
  }

  /* de Bruijn の多重格子。N 方向の平行線の束を重ね、2本の線の交点ごとに菱形を1枚作る。
     N が奇数なら N 回対称、偶数なら 2N 回対称（N=4 で8回、N=6 で12回）。
     色1＝角が広い菱形（最小角が55°より大きい）、色2＝細い菱形。
     格子のずれ GAM を全部同じにすると3本以上の線が1点で交わり、重なりや隙間が出る。
     わずかにずらしてある（0.2 + 0.0137×j） */
  function multigrid(N) {
    return function (g) {
      var E = [], GAM = [], j, step = (N % 2) ? 2 * Math.PI / N : Math.PI / N;
      for (j = 0; j < N; j++) { E.push([Math.cos(j * step), Math.sin(j * step)]); GAM.push(0.2 + 0.0137 * j); }
      var s = g.edge, R = farthest(g) + g.edge * 2, K = Math.ceil(2 * R / (N * s) * 1.15) + 2, out = [];
      for (var r = 0; r < N; r++) for (var q = r + 1; q < N; q++) {
        var er = E[r], eq = E[q], det = er[0] * eq[1] - er[1] * eq[0];
        var d = ((q - r) * step) % (2 * Math.PI), mn = Math.min(d, 2 * Math.PI - d);
        var cls = Math.min(mn, Math.PI - mn) > 55 * Math.PI / 180 ? 1 : 0;
        for (var kr = -K; kr <= K; kr++) for (var kq = -K; kq <= K; kq++) {
          var a = kr + GAM[r], b = kq + GAM[q];
          var x = (a * eq[1] - b * er[1]) / det, y = (b * er[0] - a * eq[0]) / det;   // 2本の線の交点
          var bx = 0, by = 0;
          for (j = 0; j < N; j++) {
            if (j === r || j === q) continue;
            var Kj = Math.ceil(x * E[j][0] + y * E[j][1] - GAM[j]); bx += Kj * E[j][0]; by += Kj * E[j][1];
          }
          var pts = [[kr, kq], [kr + 1, kq], [kr + 1, kq + 1], [kr, kq + 1]].map(function (v) {
            return [g.ox + s * (bx + v[0] * er[0] + v[1] * eq[0]), g.oy + s * (by + v[0] * er[1] + v[1] * eq[1])];
          });
          if (!onScreen(g, pts, g.edge)) continue;
          out.push({ p: pts, cls: cls, dir: (r + q) % 5 });
        }
      }
      return out;
    };
  }

  /* ひまわり（葉序）。n 番目の点を 半径 c√n・角度 n×137.5° に置き、各点の縄張り（ボロノイ細胞）をタイルにする。
     隣の細胞は番号が n±フィボナッチ数 のものに限られるので、候補はそれだけ見ればよい（1枚あたり約30回の切り取り）。
     色は「対数螺旋の腕」で分ける：角度から log(半径) に比例したねじれを引き、8本の腕に切って交互に塗る。
     輪郭の段階では細胞の並びのフィボナッチ数本の螺旋が、色の段階では別の向きにねじれた8本の腕が見える。
     番号の偶奇で塗る案は、色がまだらになり螺旋に見えなかったので採らない */
  function sunflower(g) {
    var GA = Math.PI * (3 - Math.sqrt(5)), c = g.edge * 0.62, far = farthest(g) + g.edge * 3;
    var Nmax = Math.ceil((far / c) * (far / c)), F = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597, 2584];
    var P = [[g.ox, g.oy]], n;   // 0 番は育ち始める点そのもの（中心に穴を空けない）
    for (n = 1; n <= Nmax + 3000; n++) {
      var r = c * Math.sqrt(n), t = n * GA; P.push([g.ox + r * Math.cos(t), g.oy + r * Math.sin(t)]);
    }
    function clip(poly, p, q) {   // p の側の半平面（p と q の垂直二等分線）で切る
      var mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2, nx = q[0] - p[0], ny = q[1] - p[1], out = [];
      for (var i = 0; i < poly.length; i++) {
        var A = poly[i], B = poly[(i + 1) % poly.length];
        var da = (A[0] - mx) * nx + (A[1] - my) * ny, db = (B[0] - mx) * nx + (B[1] - my) * ny;
        if (da <= 0) out.push(A);
        if ((da < 0 && db > 0) || (da > 0 && db < 0)) { var u = da / (da - db); out.push([A[0] + (B[0] - A[0]) * u, A[1] + (B[1] - A[1]) * u]); }
      }
      return out;
    }
    var out = [];
    for (n = 0; n <= Nmax; n++) {
      var p = P[n];
      if (p[0] < -g.edge * 2 || p[0] > g.W + g.edge * 2 || p[1] < -g.edge * 2 || p[1] > g.H + g.edge * 2) continue;
      var h = c * 4, poly = [[p[0] - h, p[1] - h], [p[0] + h, p[1] - h], [p[0] + h, p[1] + h], [p[0] - h, p[1] + h]];
      for (var i = 0; i < F.length; i++) {
        if (n - F[i] >= 0) poly = clip(poly, p, P[n - F[i]]);
        if (n + F[i] < P.length) poly = clip(poly, p, P[n + F[i]]);
      }
      if (poly.length < 3) continue;
      var th = (n * GA) % (2 * Math.PI), tw = th - 1.6 * Math.log(Math.sqrt(n) || 1);
      var arm = Math.floor((((tw / (2 * Math.PI)) % 1) + 1) % 1 * 8);
      out.push({ p: poly, cls: arm % 2, dir: n % 5 });
    }
    return out;
  }

  var GENERATORS = {
    penrose:   { name: 'ペンローズ（5回対称）', make: penrose },
    octagon:   { name: '八角の星（8回対称）',   make: multigrid(4) },
    heptagon:  { name: '七角（7回対称）',       make: multigrid(7) },
    dodecagon: { name: '十二角（12回対称）',    make: multigrid(6) },
    sunflower: { name: 'ひまわり（葉序）',      make: sunflower }
  };

  var api = { GENERATORS: GENERATORS, multigrid: multigrid };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GrowingFigures = api;
})(this);
