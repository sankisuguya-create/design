/* 試作：ピルで数理的な模様を再現する3案。生成器の形は ../generators.js と同じ。
   どれもピル（まっすぐ／曲がった）だけで隙間なく敷き詰める。継ぎ目では前のピルの終わりの端を
   次のピルの始まりの端の後ろに入れる（鱗のピルと同じ重ね方）。見える形は「始まりがふくらみ、終わりがえぐれた」ピル。

   帯の考え方：幅 w が一定の帯を「区間」に分ける。区間は、同心の2つの弧で挟まれた扇形の帯（曲がったピルの体）か、
   平行な2本の線で挟まれた長方形の帯（まっすぐなピルの体）。1枚のピルは必ず1つの区間の中に収める。
   区間どうしの継ぎ目では、中心どうしを結ぶ線の上で帯の端がぴったり重なるように組む（向きもそろう）。

   spiral2  二心の二重渦：上半分は中心 A、下半分は中心 B（A と B は幅 w だけ離す）の同心の半円の帯。
            半円をつなぐたびに帯が1本ずつ外へずれ、2本の腕の渦（二心渦巻き線）になる。A/B＝2本の腕
   golden   黄金の分岐輪：同心の輪。輪の中のピルの長さは長 L と短 S（L/S＝黄金比）で、並びはフィボナッチ語。
            半径がほぼ黄金比倍になるごとに L→LS、S→L と置き換える。A/B＝L/S
   stadium  ピルの入れ子：中心の1本のピル（線分からの距離 w 以内）のまわりを、ピル形の輪（線分からの距離が
            kw〜(k+1)w）で入れ子にする。輪は上下のまっすぐな帯と左右の半円の帯。A/B＝まっすぐ/曲がった */
(function (root) {
  'use strict';
  var TAU = 2 * Math.PI, PHI = (1 + Math.sqrt(5)) / 2;

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

  /* ---- 区間 ----
     arc(c, ri, ro, a0, d)：中心 c、内の半径 ri・外の半径 ro、角 a0 から d（符号つき）だけ進む
     line(p, t, n, len, di, dout)：基準点 p から向き t に len 進む。帯は基準線から n の向きに di〜dout 離れた所 */
  function arcSeg(c, ri, ro, a0, d) {
    return {
      len: Math.abs(d) * (ri + ro) / 2,
      st: function (s) {
        var a = a0 + d * s, ca = Math.cos(a), sa = Math.sin(a), sg = d > 0 ? 1 : -1;
        return { O: [c[0] + ro * ca, c[1] + ro * sa], I: [c[0] + ri * ca, c[1] + ri * sa], t: [-sa * sg, ca * sg] };
      },
      side: function (outer, s0, s1) {   // s0 から s1 へ（s0 を含み s1 を含まない）
        var r = outer ? ro : ri;
        if (r < 1e-9) return [c.slice()];
        var da = d * (s1 - s0), n = Math.max(1, Math.ceil(Math.abs(da) / Math.min(0.25, Math.sqrt(0.2 / r)))), o = [];
        for (var k = 0; k < n; k++) { var a = a0 + d * s0 + da * k / n; o.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]); }
        return o;
      }
    };
  }
  function lineSeg(p, t, nrm, len, di, dout) {
    return {
      len: len,
      st: function (s) {
        var b = [p[0] + t[0] * len * s, p[1] + t[1] * len * s];
        return { O: [b[0] + nrm[0] * dout, b[1] + nrm[1] * dout], I: [b[0] + nrm[0] * di, b[1] + nrm[1] * di], t: t };
      },
      side: function (outer, s0) { var q = this.st(s0); return [outer ? q.O : q.I]; }
    };
  }
  // 端の半円：O から I へ（I は含まない）、後ろ（−t）へふくらむ
  function cap(q) {
    var c = [(q.O[0] + q.I[0]) / 2, (q.O[1] + q.I[1]) / 2], ux = q.O[0] - c[0], uy = q.O[1] - c[1], h = Math.hypot(ux, uy);
    ux /= h; uy /= h;
    var n = Math.max(6, Math.ceil(Math.PI * h / 2.5)), o = [];
    for (var k = 0; k < n; k++) {
      var a = Math.PI * k / n;
      o.push([c[0] + h * (Math.cos(a) * ux - Math.sin(a) * q.t[0]), c[1] + h * (Math.cos(a) * uy - Math.sin(a) * q.t[1])]);
    }
    return o;
  }
  /* 区間をピルに分けて並べる。cuts＝区間の中の切れ目（0〜1、両端を含む）。区間の始まりの端は前の区間のピルの上に出る */
  function emit(g, out, seg, cuts, clsOf, dirOf) {
    var qs = cuts.map(function (s) { return seg.st(s); });
    for (var j = 0; j + 1 < cuts.length; j++) {
      var a = qs[j], b = qs[j + 1];
      if (!onScreen(g, [a.O, a.I, b.O, b.I], seg.len / (cuts.length - 1) + 40)) continue;
      var rc = cap(a), poly = seg.side(true, cuts[j], cuts[j + 1]).concat(cap(b), seg.side(false, cuts[j + 1], cuts[j]), [a.I].concat(rc.slice(1).reverse()));
      if (onScreen(g, poly, 0)) out.push({ p: poly, cls: clsOf(j), dir: dirOf(j) });
    }
  }
  function even(n) { var o = []; for (var i = 0; i <= n; i++) o.push(i / n); return o; }

  /* ---------- 二心の二重渦 ---------- */
  function spiral2(g) {
    var w = g.edge * 0.72, L = 2.5 * w, far = farthest(g) + w * 3, out = [];
    var A = [g.ox - w / 2, g.oy], B = [g.ox + w / 2, g.oy], K = Math.ceil(far / w) + 1;
    for (var k = 0; k <= K; k++) {
      var ri = k * w, ro = ri + w, rm = (ri + ro) / 2, n = Math.max(1, Math.round(Math.PI * rm / L));
      // 上（画面の上）：中心 A、右端（角0）から左端（角−π）へ。下：中心 B、左端（角π）から右端（角0）へ
      var top = arcSeg(A, ri, ro, 0, -Math.PI), bot = arcSeg(B, ri, ro, Math.PI, -Math.PI);
      var ct = k & 1, cb = (k & 1) ^ 1;
      emit(g, out, top, even(n), function () { return ct; }, function (j) { return (k + j) % 5; });
      emit(g, out, bot, even(n), function () { return cb; }, function (j) { return (k + j + 2) % 5; });
    }
    return out;
  }

  /* ---------- 黄金の分岐輪 ---------- */
  function golden(g) {
    var w = g.edge * 0.62, far = farthest(g) + w * 3, out = [];
    var r0 = w, word = [1, 0, 1, 1, 0];   // 1＝L、0＝S。中心の円のまわりの最初の並び「LSLLS」（フィボナッチ語の頭5文字）
    var disk = []; for (var q = 0; q < 60; q++) disk.push([g.ox + r0 * Math.cos(q * TAU / 60), g.oy + r0 * Math.sin(q * TAU / 60)]);
    out.push({ p: disk, cls: 1, dir: 0 });
    var nL = 3, nS = 2, aL = TAU / (nL + nS / PHI), R = r0, band = 0, a0 = -Math.PI / 2;
    while (R < far) {
      var rings = Math.max(2, Math.round((PHI - 1) * R / w));
      var cuts = [0], acc = 0, tot = 0;
      word.forEach(function (x) { tot += x ? aL : aL / PHI; });
      word.forEach(function (x) { acc += x ? aL : aL / PHI; cuts.push(acc / tot); });
      cuts[cuts.length - 1] = 1;
      for (var k = 0; k < rings; k++) {
        var ri = R + k * w, seg = arcSeg([g.ox, g.oy], ri, ri + w, a0, TAU);
        emit(g, out, seg, cuts, function (j) { return word[j]; }, function (j) { return (band + j) % 5; });
      }
      R += rings * w; band++;
      var nw = []; word.forEach(function (x) { if (x) nw.push(1, 0); else nw.push(1); });   // L→LS、S→L
      word = nw; aL /= PHI;
    }
    return out;
  }

  /* ---------- ピルの入れ子 ---------- */
  function stadium(g) {
    var w = g.edge * 0.72, L = 2.5 * w, S = Math.round(Math.min(g.W, g.H) * 0.42 / w) * w, out = [];
    var P = [g.ox - S / 2, g.oy], Q = [g.ox + S / 2, g.oy];
    var far = Math.max(farthest({ W: g.W, H: g.H, ox: P[0], oy: P[1] }), farthest({ W: g.W, H: g.H, ox: Q[0], oy: Q[1] })) + w * 3;
    var GR = PHI - 1;
    function cutsLine(k) {   // まっすぐな帯の切れ目。輪ごとに黄金比ぶんずらし、継ぎ目が縦にそろわないようにする
      var n = Math.max(1, Math.round(S / L)), f = (k * GR) % 1, o = [0];
      for (var j = 0; j < n; j++) { var s = (j + f) / n; if (s > 0.35 / n && s < 1 - 0.35 / n) o.push(s); }
      o.push(1); return o;
    }
    for (var k = 0; k * w < far; k++) {
      var di = k * w, dout = di + w, rm = di + w / 2, na = Math.max(1, Math.round(Math.PI * rm / L));
      var segs = [
        [lineSeg(P, [1, 0], [0, -1], S, di, dout), cutsLine(k), 1],          // 上：左から右へ
        [arcSeg(Q, di, dout, -Math.PI / 2, Math.PI), even(na), 0],          // 右の半円
        [lineSeg(Q, [-1, 0], [0, 1], S, di, dout), cutsLine(k + 7), 1],      // 下：右から左へ
        [arcSeg(P, di, dout, Math.PI / 2, Math.PI), even(na), 0]            // 左の半円
      ];
      segs.forEach(function (z, si) {
        emit(g, out, z[0], z[1], function () { return z[2]; }, function (j) { return (k + j + si) % 5; });
      });
    }
    return out;
  }

  var G = {
    spiral2: { name: '二心の二重渦', make: spiral2 },
    golden:  { name: '黄金の分岐輪', make: golden },
    stadium: { name: 'ピルの入れ子', make: stadium }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = { GENERATORS: G };
  else for (var id in G) root.GrowingFigures.GENERATORS[id] = G[id];
})(typeof window !== 'undefined' ? window : global);
