/* 試作の記録（見送り・旧版）。単体では動かない：../generators.js の中の道具（arc, minusDisk, bands6, xy, clipS,
   concentric, farthest, onScreen, TAU）を前提にした関数の写し。使うときは generators.js の中へ戻す。

   whirlS  … 丸い渦格子の旧版。格子の辺をS字にしならせた鱗（楕円に近い形）。
             「ウロコの重ね合わせはそのままに、楕円でなく真円が折り重なっているように」との指示で、
             真円を内側から重ねる今の whirl に置き換えた
   bubbles … 渦の真円（21・34の螺旋の円の詰め方。ドイル螺旋に近い）。上の指示を「円を並べる」と取り違えて作ったもの。
             検査は合格。円と円が重ならず並ぶ別の図形として、再検討の余地がある
*/
  /* 丸い渦格子：右回りと左回りの螺旋が交わる格子の辺を、S字にしならせる。
     辺はとなりのマスと共有するので、しならせても隙間はできない。マスは2辺がふくらみ2辺が反った、
     風車のように回る丸いマスになる。仕切りの円で両方の本数が2倍になる。色は右回りの腕ごとに交互 */
  function whirlS(g){
    var W0=g.edge*1.2,t=1,B=bands6(g,W0),out=[],dl=0.22;
    B.list.forEach(function(b){
      var n=b.n,k=n*t/Math.PI,d0=Math.floor(b.s0*k)-1,d1=Math.ceil(b.s1*k)+1;
      function st(a,bb){return[(bb-a)*Math.PI/(n*t),(a+bb)*Math.PI/n]}
      var mg=g.edge+TAU*Math.exp(b.s1)/n*2;
      for(var i=0;i<n;i++)for(var d=d0;d<=d1;d++){
        var j=i+d,poly=[],q,S=6, c0=st(i+0.5,j+0.5);
        if(c0[0]<b.s0-0.5||c0[0]>b.s1+0.5) continue;
        var cp=xy(g,c0[0],c0[1]); if(cp[0]<-mg||cp[0]>g.W+mg||cp[1]<-mg||cp[1]>g.H+mg) continue;
        for(q=0;q<S;q++){var u=q/S;poly.push(st(i+u,j-dl*Math.sin(Math.PI*u)))}             // b=j の辺（a が i→i+1）
        for(q=0;q<S;q++){var u2=q/S;poly.push(st(i+1+dl*Math.sin(Math.PI*u2),j+u2))}       // a=i+1 の辺（b が j→j+1）
        for(q=0;q<S;q++){var u3=q/S;poly.push(st(i+1-u3,j+1-dl*Math.sin(Math.PI*(1-u3))))} // b=j+1 の辺（a が i+1→i）
        for(q=0;q<S;q++){var u4=q/S;poly.push(st(i+dl*Math.sin(Math.PI*(1-u4)),j+1-u4))}   // a=i の辺（b が j+1→j）
        poly=clipS(poly,b.s0,b.s1); if(poly.length<3) continue;
        // 仕切りの円で切った辺は (s,θ) では直線でも画面では弧。細かく打ち直してから写す（隣と弦がずれて隙間ができないように）
        var pts=[];
        for(var e=0;e<poly.length;e++){var A=poly[e],Bq=poly[(e+1)%poly.length],onCut=(A[0]===Bq[0]&&(A[0]===b.s0||A[0]===b.s1)),m=onCut?Math.max(1,Math.ceil(Math.abs(Bq[1]-A[1])/0.02)):1;
          for(var z=0;z<m;z++){var f=z/m;pts.push(xy(g,A[0]+(Bq[0]-A[0])*f,A[1]+(Bq[1]-A[1])*f))}}
        if(onScreen(g,pts,g.edge)) out.push({p:pts,cls:i&1,dir:((d%5)+5)%5});
      }
    });
    // 中心：最初の帯より内側を同心円（円板＋6・12等分の輪）で埋める
    return out.concat(concentric(g, Math.exp(B.list[0].s0), 3));
  }


  /* 渦の真円：円の渦（ドイル螺旋に近い円の詰め方）。対数極座標 (s,θ) に正三角形の格子を張り、
     格子点ごとに真円を置く。格子は p·w1 + q·w2 = (0, 2π) を満たすように傾けるので、
     右回り p 本・左回り q 本（21 と 34：ひまわりと同じフィボナッチ数）の螺旋に円が並ぶ。
     等角写像なので円は外へ行くほど相似に大きくなり、仕切りの円は要らない（花びらの仕切りによる継ぎ目が出ない）。
     半径は、3方向の隣のうち一番近い隣と接する大きさ×0.97（全部の隣とは接しきれないので、わずかにすき間が残る）。
     円の間の「反った三角」（格子の三角 − 角の3つの円）がもう1種類のタイル。色1＝真円、色2＝すき間。
     中心は同心円。単元「円と球」の背景を想定 */
  function bubbles(g) {
    var P = 21, Q = 34, out = [];
    var al = Math.atan((2 * P + Q) / (Q * Math.sqrt(3))), L = TAU / (P * Math.sin(al) + Q * Math.sin(al + Math.PI / 3));
    var w1 = [L * Math.cos(al), L * Math.sin(al)], w2 = [L * Math.cos(al + Math.PI / 3), L * Math.sin(al + Math.PI / 3)];
    // 円の半径（中心までの距離に対する比）：隣 w へ接する比は |e^w − 1| / (1 + e^{Re w})。3方向で一番小さいもの
    var ratio = 1e9;
    [w1, w2, [w2[0] - w1[0], w2[1] - w1[1]]].forEach(function (w) {
      var ex = Math.exp(w[0]), dx = ex * Math.cos(w[1]) - 1, dy = ex * Math.sin(w[1]);
      ratio = Math.min(ratio, Math.sqrt(dx * dx + dy * dy) / (1 + ex));
    });
    ratio *= 0.97;
    var R0 = g.edge * 4.2, sMin = Math.log(R0), sMax = Math.log(farthest(g) + g.edge * 4);
    function node(m, k) {
      var s = m * w1[0] + k * w2[0], th = m * w1[1] + k * w2[1], r = Math.exp(s);
      return { s: s, c: [g.ox + r * Math.cos(th), g.oy + r * Math.sin(th)], r: r * ratio, th: th };
    }
    function near(c, m) { return c[0] > -m && c[0] < g.W + m && c[1] > -m && c[1] < g.H + m; }
    // 代表の選び方：(m,k) と (m+P, k+Q) は同じ点なので、k を 0..Q−1 に限り、m は s が範囲に入るだけ回す
    for (var k = 0; k < Q; k++) {
      var m0 = Math.floor((sMin - 2 * L - k * w2[0]) / w1[0]) - 1, m1 = Math.ceil((sMax - k * w2[0]) / w1[0]) + 1;
      for (var m = m0; m <= m1; m++) {
        var A = node(m, k);
        if (!near(A.c, A.r * 4 + g.edge)) continue;
        // 真円（中心の円板の外にあるものだけ）
        if (A.s - L / 2 > sMin) {
          var cp = [];
          for (var q = 0; q < 120; q++) { var a0 = TAU * q / 120; cp.push([A.c[0] + A.r * Math.cos(a0), A.c[1] + A.r * Math.sin(a0)]); }
          if (onScreen(g, cp, g.edge)) out.push({ p: cp, cls: 1, dir: ((m % 5) + 5) % 5 });
        }
        // すき間：格子の三角2枚（上向き・下向き）から角の円を取り除く。中心の円板に掛かる分も取り除く
        [[node(m, k), node(m + 1, k), node(m, k + 1)], [node(m + 1, k), node(m + 1, k + 1), node(m, k + 1)]].forEach(function (T, u) {
          var pts = [];
          for (var e = 0; e < 3; e++) {                        // 三角の辺は (s,θ) で直線 → 細かく打って写す（画面では螺旋の弧）
            var X = T[e], Y = T[(e + 1) % 3], xs = X.s, xt = X.th, ys = Y.s, yt = Y.th, n = 12;
            for (var z = 0; z < n; z++) { var f = z / n, ss = xs + (ys - xs) * f, tt = xt + (yt - xt) * f, rr = Math.exp(ss); pts.push([g.ox + rr * Math.cos(tt), g.oy + rr * Math.sin(tt)]); }
          }
          T.forEach(function (V) { if (pts && V.s - L / 2 > sMin) pts = minusDisk(pts, V.c, V.r); });
          if (pts) pts = minusDisk(pts, [g.ox, g.oy], R0);
          if (pts && pts.length > 2 && onScreen(g, pts, g.edge)) out.push({ p: pts, cls: 0, dir: 2 + u });
        });
      }
    }
    return out.concat(concentric(g, R0, Math.max(3, Math.round(R0 / (g.edge * 1.3)))));
  }

