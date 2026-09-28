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
  function multigrid(N, gam) {
    return function (g) {
      var E = [], GAM = [], j, step = (N % 2) ? 2 * Math.PI / N : Math.PI / N;
      for (j = 0; j < N; j++) { E.push([Math.cos(j * step), Math.sin(j * step)]); GAM.push(gam === undefined ? 0.2 + 0.0137 * j : gam); }
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

  /* ================================================================
   *  丸みのある図形（円弧だけで囲まれたタイル）
   *  3つとも利用者の評価で採用。丸み・回転対称・同心の育ち方が揃う
   * ================================================================ */
  var TAU = 2 * Math.PI;
  /* 中心 c・半径 r の円の上を、点 p から点 q まで短い向きに進む円弧の点列（p は含み q は含まない） */
  function arc(c,p,q,step,longWay){
    var a0=Math.atan2(p[1]-c[1],p[0]-c[0]), a1=Math.atan2(q[1]-c[1],q[0]-c[0]), d=a1-a0;
    while(d>Math.PI)d-=TAU; while(d<-Math.PI)d+=TAU;
    if(longWay) d=d>0?d-TAU:d+TAU;                     // 長い向きに回る
    var r=Math.hypot(p[0]-c[0],p[1]-c[1]), n=Math.max(2,Math.ceil(Math.abs(d)/(step||0.12))), out=[];
    for(var k=0;k<n;k++){var t=a0+d*k/n;out.push([c[0]+r*Math.cos(t),c[1]+r*Math.sin(t)])}
    return out;
  }
  /* 多角形から円板（中心 c・半径 R）を取り除いた残り。円の内側に入った区間は、円周に沿った弧に置き換える。
     弧は「元の多角形の内側を通る向き」に回る。ふつうは短い向きだが、取り除く円の中心が多角形の内側にあると
     長い向きになる（大きな円から、中心が中に入った小さな円を取り除くとき。内向きの丸い渦格子の仕切りで起きた）。
     短い向きの弧の中点が多角形の内側かどうかで決める。全部が内側なら null */
  function inPoly(pt,poly){var c=false;for(var i=0,j=poly.length-1;i<poly.length;j=i++){var a=poly[i],b=poly[j];if((a[1]>pt[1])!==(b[1]>pt[1])&&pt[0]<(b[0]-a[0])*(pt[1]-a[1])/(b[1]-a[1])+a[0])c=!c}return c}
  function minusDisk(pts,c,R){
    var n=pts.length,R2=R*R,ins=pts.map(function(p){var dx=p[0]-c[0],dy=p[1]-c[1];return dx*dx+dy*dy<R2});   // Math.hypot は遅いので2乗で比べる
    var s0=ins.indexOf(false); if(s0<0) return null; if(ins.indexOf(true)<0) return pts;
    function hit(A,B){var dx=B[0]-A[0],dy=B[1]-A[1],fx=A[0]-c[0],fy=A[1]-c[1],a=dx*dx+dy*dy,b=2*(fx*dx+fy*dy),cc=fx*fx+fy*fy-R*R,D=Math.sqrt(Math.max(0,b*b-4*a*cc));
      var t1=(-b-D)/(2*a),t2=(-b+D)/(2*a),t=(t1>=0&&t1<=1)?t1:t2;return[A[0]+dx*t,A[1]+dy*t]}
    var out=[],exitP=null;
    for(var k=0;k<n;k++){
      var i=(s0+k)%n,j=(i+1)%n,A=pts[i],B=pts[j];
      if(!ins[i]) out.push(A);
      if(!ins[i]&&ins[j]){exitP=hit(A,B);out.push(exitP)}                 // 円の内側へ入る点
      if(ins[i]&&!ins[j]){
        var Y=hit(A,B), a0=Math.atan2(exitP[1]-c[1],exitP[0]-c[0]), a1=Math.atan2(Y[1]-c[1],Y[0]-c[0]), dd=a1-a0;
        while(dd>Math.PI)dd-=TAU; while(dd<-Math.PI)dd+=TAU;
        var am=a0+dd/2, longWay=!inPoly([c[0]+R*Math.cos(am),c[1]+R*Math.sin(am)],pts);
        out=out.concat(arc(c,exitP,Y,0.07,longWay).slice(1));out.push(Y);exitP=null;    // 円周をたどって出る点へ
      }
    }
    return out;
  }
  function add(p,q){return[p[0]+q[0],p[1]+q[1]]}
  function sub(p,q){return[p[0]-q[0],p[1]-q[1]]}
  function mid(p,q){return[(p[0]+q[0])/2,(p[1]+q[1])/2]}
  function range(g,a){var R=Math.max(g.W,g.H)*1.2/a+3;return Math.ceil(R)}

  /* 同心円の中心：半径 R0 の円板を、円板1枚と輪（6・12・18…に等分）で埋める。
     輪ごとに半区画ずらし、放射の線が一直線に通らないようにする（的のような機械的な見え方を避ける） */
  function concentric(g, R0, rings) {
    var O0 = [g.ox, g.oy], out = [];
    for (var rk = 0; rk < rings; rk++) {
      var r1 = R0 * (rk + 1) / rings, r0 = R0 * rk / rings, m = rk ? 6 * rk : 1;
      for (var sg = 0; sg < m; sg++) {
        var sh = (rk & 1) ? Math.PI / m : 0, t0 = TAU * sg / m - Math.PI / 2 + sh, t1 = TAU * (sg + 1) / m - Math.PI / 2 + sh;
        var pts = [], st = Math.max(4, Math.ceil((t1 - t0) / 0.05)), q;
        for (q = 0; q <= st; q++) { var a1 = t0 + (t1 - t0) * q / st; pts.push([O0[0] + r1 * Math.cos(a1), O0[1] + r1 * Math.sin(a1)]); }
        if (rk) for (q = st; q >= 0; q--) { var a0 = t0 + (t1 - t0) * q / st; pts.push([O0[0] + r0 * Math.cos(a0), O0[1] + r0 * Math.sin(a0)]); }
        out.push({ p: pts, cls: rk ? (sg + rk) & 1 : 1, dir: rk % 5 });
      }
    }
    return out;
  }

  /* 5重の同心円（区切りの無い輪）。輪はドーナツ形なので、外の円 p と穴 h（内の円）を持つタイルにする。
     タイルの形式の拡張：h があれば穴（描く側は p と h を1本のパスにして塗る。穴の向きは逆回り） */
  function rings(g, R0, count) {
    var out = [], NQ = 120;
    function circle(r, rev) { var pts = []; for (var q = 0; q < NQ; q++) { var a0 = TAU * (rev ? NQ - q : q) / NQ; pts.push([g.ox + r * Math.cos(a0), g.oy + r * Math.sin(a0)]); } return pts; }
    for (var k = 0; k < count; k++) {
      var t = { p: circle(R0 * (k + 1) / count, false), cls: 1 - (k & 1), dir: k % 5 };
      if (k) t.h = circle(R0 * k / count, true);
      out.push(t);
    }
    return out;
  }

  /* 生命の花（6回対称）：三角格子の各点を中心に、隣の点を通る円を描く。
     円どうしが切り分ける「花びら」（格子の辺ごとに1枚）と「反った三角」（格子の三角ごとに1枚）がタイル。
     中心から育つと、6枚の花びらの花が同心の六角に広がる。色1＝花びら、色2＝反った三角 */
  function flower(g){
    var a=g.edge*1.95, e0=[a,0], e1=[a/2,a*Math.sqrt(3)/2], e2=[-a/2,a*Math.sqrt(3)/2], N=range(g,a), out=[];
    function P(i,j){return[g.ox+i*e0[0]+j*e1[0],g.oy+i*e0[1]+j*e1[1]]}
    function rot(v,s){var c=0.5,sn=s*Math.sqrt(3)/2;return[v[0]*c-v[1]*sn,v[0]*sn+v[1]*c]}
    for(var i=-N;i<=N;i++)for(var j=-N;j<=N;j++){
      var O=P(i,j);
      if(O[0]<-2*a||O[0]>g.W+2*a||O[1]<-2*a||O[1]>g.H+2*a) continue;
      [e0,e1,e2].forEach(function(e,k){                      // 花びら：辺 O→V。両脇の格子点 W1・W2 を中心とする2本の弧で囲む
        var V=add(O,e), W1=add(O,rot(e,1)), W2=add(O,rot(e,-1));
        var pts=arc(W1,O,V).concat(arc(W2,V,O));
        if(onScreen(g,pts,g.edge)) out.push({p:pts,cls:1,dir:k});
      });
      [[O,add(O,e0),add(O,e1),3],[add(O,e0),add(add(O,e0),e1),add(O,e1),4]].forEach(function(T){   // 反った三角：上向きと下向き
        var A=T[0],B=T[1],C=T[2];
        function D(X,Y,Z){return sub(add(X,Y),Z)}          // 辺 XY の向こう側の格子点（そこを中心とする弧が辺をふくらませる）
        var pts=arc(D(A,B,C),A,B).concat(arc(D(B,C,A),B,C),arc(D(C,A,B),C,A));
        if(onScreen(g,pts,g.edge)) out.push({p:pts,cls:0,dir:T[3]});
      });
    }
    return out;
  }

  /* 円弧の曼荼羅（4回対称）：正方形のマスに四分円の弧を2本ずつ置く（スミスのトルシェ）。
     弧の向きを「中心からの距離の輪」と「象限」で決め、90°回すと向きが入れ替わる規則にしてあるので、
     全体が4回対称の、丸い迷路のような同心の文様になる。
     マスの中の3片（角の四分円2つと、間の帯）がタイル。色は片が含む格子点の偶奇（弧の両側で必ず色が変わる） */
  function mandala(g){
    var a=g.edge*1.42, h=a/2, N=range(g,a), out=[];
    for(var i=-N;i<N;i++)for(var j=-N;j<N;j++){
      var x0=g.ox+i*a, y0=g.oy+j*a;
      if(x0<-2*a||x0>g.W+a||y0<-2*a||y0>g.H+a) continue;
      var cx=i+0.5, cy=j+0.5, ring=Math.floor(Math.sqrt(cx*cx+cy*cy)/1.6);
      var o=(ring+(cx*cy>0?1:0))%2;                          // 90°回すと cx*cy の符号が変わる → 向きが入れ替わる
      var A=[x0,y0],B=[x0+a,y0],C=[x0+a,y0+a],D=[x0,y0+a], mAB=mid(A,B),mBC=mid(B,C),mCD=mid(C,D),mDA=mid(D,A);
      var par=function(di,dj){return (i+di+j+dj)&1};
      var disc, band;
      if(o===0){      // 四分円は A と C の角。帯は B と D を含む
        out.push({p:[A].concat(arc(A,mAB,mDA),[mDA]),cls:par(0,0),dir:0});
        out.push({p:[C].concat(arc(C,mCD,mBC),[mBC]),cls:par(1,1),dir:1});
        band=[mAB,B,mBC].concat(arc(C,mBC,mCD),[mCD,D,mDA]).concat(arc(A,mDA,mAB));
        out.push({p:band,cls:par(1,0),dir:4});
      }else{          // 四分円は B と D の角。帯は A と C を含む
        out.push({p:[B].concat(arc(B,mBC,mAB),[mAB]),cls:par(1,0),dir:2});
        out.push({p:[D].concat(arc(D,mDA,mCD),[mCD]),cls:par(0,1),dir:3});
        band=[mDA,A,mAB].concat(arc(B,mAB,mBC),[mBC,C,mCD]).concat(arc(D,mCD,mDA));
        out.push({p:band,cls:par(0,0),dir:4});
      }
    }
    return out.filter(function(t){return onScreen(g,t.p,g.edge)});
  }


  /* 丸い渦格子で使う：対数極座標 (s = log r, θ) の道具。この座標では対数螺旋も円も直線になる。
     花びらの仕切り（半径が2倍の円）ごとに腕の本数を2倍にして、どこでもマスの大きさを揃える */
  function bands6(g,width,r0mul){
    var r0=g.edge*(r0mul||1.6), far=farthest(g)+g.edge*2, out=[], r=r0;
    var n=6*Math.pow(2,Math.max(0,Math.ceil(Math.log(TAU*r0/width/6)/Math.LN2)));
    while(r<far){out.push({s0:Math.log(r),s1:Math.log(2*r),n:n});r*=2;n*=2}
    return {r0:r0,list:out};
  }
  function xy(g,s,th){var r=Math.exp(s);return[g.ox+r*Math.cos(th),g.oy+r*Math.sin(th)]}
  function clipS(poly,s0,s1){
    function cut(P,v,up){var out=[];for(var i=0;i<P.length;i++){var A=P[i],B=P[(i+1)%P.length],da=up?A[0]-v:v-A[0],db=up?B[0]-v:v-B[0];if(da>=0)out.push(A);if((da>0&&db<0)||(da<0&&db>0)){var t=da/(da-db);out.push([A[0]+(B[0]-A[0])*t,A[1]+(B[1]-A[1])*t])}}return out}
    return cut(cut(poly,s0,true),s1,false);
  }

  /* 丸い渦格子（真円の鱗）：丸い渦格子と同じ格子点（右回り・左回りの螺旋の交点。花びらの仕切りで本数2倍）に、
     真円を1枚ずつ置き、内側の円ほど手前に重ねる（屋根瓦・青海波の重ね方）。
     タイル＝その円から、手前に重なる円を取り除いた見えている部分。縁はすべて真円の弧になる。
     半径は、同じ輪の隣の円と接する大きさ（格子の間隔の√2/2 倍）を少し大きくして、重ねたときにすき間が残らないようにする。
     仕切りの両側では、内と外の帯の円がそのまま重なる（内の帯の円を手前にする）。
     色は右回りの腕ごとに交互。中心は同心円 */
  function whirl(g, inward) {
    var W0 = g.edge * 1.2, t = 1, B = bands6(g, W0), discs = [], out = [];
    B.list.forEach(function (b, bi) {
      var n = b.n, u = Math.PI / (n * t), k = 1 / u;
      // 帯の外へ半歩はみ出す格子点まで円を置く（隣の帯の円と重なって、仕切りにすき間を作らない）
      var lo = b.s0 - 1.5 * u, hi = b.s1 + (bi === B.list.length - 1 ? 3 : 1.5) * u;
      var d0 = Math.floor(lo * k) - 1, d1 = Math.ceil(hi * k) + 1;
      var rho = u * Math.SQRT2 / 2 * Math.SQRT2 * 1.04;          // 対数極座標での半径（斜めの隣までの距離の半分×√2 ×1.04）
      var mg = g.edge + TAU * Math.exp(hi) / n * 2;
      for (var i = 0; i < n; i++) for (var d = d0; d <= d1; d++) {
        var j = i + d, sN = (j - i) * u, th = (i + j) * Math.PI / n;
        if (sN < lo || sN > hi) continue;
        var c = xy(g, sN, th), r = Math.exp(sN) * rho;
        if (c[0] < -mg || c[0] > g.W + mg || c[1] < -mg || c[1] > g.H + mg) continue;
        discs.push({ c: c, r: r, s: sN, band: bi, cls: i & 1, dir: ((d % 5) + 5) % 5 });
      }
    });
    // 画面に掛からない円は最初に捨てる（以降の比べる数を減らす）
    discs = discs.filter(function (D) { return !(D.c[0] + D.r < 0 || D.c[0] - D.r > g.W || D.c[1] + D.r < 0 || D.c[1] - D.r > g.H); });
    // 近くの円だけを比べるための升目。キーは数（文字列のキーと forEach の関数は、生成の時間の大半を食っていた）
    var cell = g.edge * 4, grid = new Map(), GW = 4096;
    function cellsOf(D, fn) {
      var gx0 = Math.floor((D.c[0] - D.r) / cell), gx1 = Math.floor((D.c[0] + D.r) / cell),
          gy0 = Math.floor((D.c[1] - D.r) / cell), gy1 = Math.floor((D.c[1] + D.r) / cell);
      for (var x = gx0; x <= gx1; x++) for (var y = gy0; y <= gy1; y++) fn((x + 64) * GW + (y + 64));
    }
    discs.forEach(function (D, idx) { cellsOf(D, function (key) { var a = grid.get(key); if (!a) grid.set(key, a = []); a.push(idx); }); });
    var stamp = new Int32Array(discs.length), mark = 0;
    // D に重なる円を1度ずつ fn に渡す
    function nearby(D, idx, fn) {
      mark++;
      cellsOf(D, function (key) {
        var a = grid.get(key); if (!a) return;
        for (var m = 0; m < a.length; m++) { var o = a[m]; if (o === idx || stamp[o] === mark) continue; stamp[o] = mark; fn(o); }
      });
    }
    var R0 = Math.exp(B.list[0].s0);
    // 重ねる順。外向き（inward が偽）：内側の円ほど手前 → 見えるのは各円の外側の縁（鱗の丸みが外を向く）。
    // 内向き：同じ帯の中では外側の円ほど手前 → 鱗の丸みが中心を向く。帯を先に比べ、同じ帯なら中心からの距離、同じなら番号で決める
    function inFront(E, eo, D, dox) {
      var sgn = inward ? -1 : 1;
      // 帯どうしは、向きによらず内の帯（大きい円）を手前にする。外の帯の小さな円を手前にすると、
      // 仕切りの近くで小さな円の列が大きな円を横切って2つに切り分け、1枚のタイルにならなくなる
      if (E.band !== D.band) return E.band < D.band;
      if (Math.abs(E.s - D.s) > 1e-9) return sgn * (E.s - D.s) < 0;
      return eo < dox;
    }
    // 手前の円が奥の円の中にすっぽり入ると、奥の円に穴が空く（穴のあるタイルは作れない）。
    // 仕切りの近くで小さな円が大きな円の中に入るときに起きるので、その小さな円は置かない（大きな円の一部になる）
    var hidden = {};
    discs.forEach(function (D, idx) {
      nearby(D, idx, function (o) {
        var E = discs[o];
        if (E.r >= D.r || !inFront(E, o, D, idx)) return;
        var dx = E.c[0] - D.c[0], dy = E.c[1] - D.c[1];
        if (Math.sqrt(dx * dx + dy * dy) + E.r <= D.r) hidden[o] = 1;
      });
    });
    discs.forEach(function (D, idx) {
      if (hidden[idx]) return;
      var front = [];
      nearby(D, idx, function (o) {
        if (hidden[o]) return;
        var E = discs[o];
        if (!inFront(E, o, D, idx)) return;
        var dx = E.c[0] - D.c[0], dy = E.c[1] - D.c[1];
        if (dx * dx + dy * dy >= (E.r + D.r) * (E.r + D.r)) return;
        front.push(E);
      });
      var pts = [], q, NQ = 90;
      for (q = 0; q < NQ; q++) { var a0 = TAU * q / NQ; pts.push([D.c[0] + D.r * Math.cos(a0), D.c[1] + D.r * Math.sin(a0)]); }
      front.sort(function (A, Bq) { return Math.hypot(A.c[0] - D.c[0], A.c[1] - D.c[1]) - Math.hypot(Bq.c[0] - D.c[0], Bq.c[1] - D.c[1]); });
      for (var f = 0; f < front.length && pts; f++) pts = minusDisk(pts, front[f].c, front[f].r);
      if (pts) pts = minusDisk(pts, [g.ox, g.oy], R0);
      if (pts && pts.length > 2 && onScreen(g, pts, 0)) out.push({ p: pts, cls: D.cls, dir: D.dir });
    });
    return out.concat(rings(g, R0, 5));
  }

  /* 渦の花びら（6回対称・螺旋）：螺旋の腕を、外へふくらむ弧で切った一画一画。一画は上が丸く、下が前の一画の丸みを受けて反る
     （花びら・鱗の形）。境目の丸みは「その境目の下の帯の腕の幅」で1つずつふくらむので、
     仕切りで腕が2本に分かれても、境目は上下の一画で同じ曲線になり、隙間ができない。色は腕ごとに交互 */
  function petals(g){
    var W0=g.edge*0.85,K=1.3,t=0.8,B=bands6(g,W0),out=[],rows=[];
    // 境目の列を作る：{s, n（ふくらみの幅を決める腕の本数）, h（ふくらみの高さ）}
    B.list.forEach(function(b){
      var m=Math.max(1,Math.round((b.s1-b.s0)*(1+t*t)*b.n/(TAU*K)));
      for(var k=0;k<m;k++) rows.push({s0:b.s0+(b.s1-b.s0)*k/m, s1:b.s0+(b.s1-b.s0)*(k+1)/m, n:b.n});
    });
    var bd=rows.map(function(r,k){return {s:r.s0,n:k?rows[k-1].n:r.n/2,h:(r.s1-r.s0)*0.42}});
    bd.push({s:rows[rows.length-1].s1,n:rows[rows.length-1].n,h:0});
    function sOn(k,v,n){var b=bd[k];return b.s+b.h*Math.abs(Math.sin(Math.PI*v*b.n/n))}
    function P(v,s,n){return xy(g,s,TAU*v/n+t*s)}
    // 中心の花：6の倍数枚の花びら。外の縁は最初の境目の丸み
    var n0=bd[0].n;
    for(var i=0;i<n0;i++){
      var pts=[[g.ox,g.oy]];
      for(var q=0;q<=8;q++){var v=i+q/8;pts.push(P(v,sOn(0,v,n0),n0))}
      out.push({p:pts,cls:1-(i&1),dir:i%5});
    }
    // 画面の外の一画は、点を打つ前に中心の位置だけで捨てる（外側の帯は腕の本数が多く、大半が画面の外）
    function near(p,m){return p[0]>-m&&p[0]<g.W+m&&p[1]>-m&&p[1]<g.H+m}
    rows.forEach(function(r,k){
      var mg=g.edge+TAU*Math.exp(r.s1)/r.n*2;
      for(var i=0;i<r.n;i++){
        if(!near(P(i+0.5,(r.s0+r.s1)/2,r.n),mg)) continue;
        var pts=[],q,S=16;
        for(q=0;q<=S;q++){var v=i+q/S;pts.push(P(v,sOn(k,v,r.n),r.n))}                  // 下の境目（反り）
        var sA=sOn(k,i+1,r.n),sB=sOn(k+1,i+1,r.n);
        for(q=1;q<4;q++) pts.push(P(i+1,sA+(sB-sA)*q/4,r.n));                                 // 右の腕
        for(q=S;q>=0;q--){var v2=i+q/S;pts.push(P(v2,sOn(k+1,v2,r.n),r.n))}               // 上の境目（丸み）
        var sC=sOn(k+1,i,r.n),sD=sOn(k,i,r.n);
        for(q=1;q<4;q++) pts.push(P(i,sC+(sD-sC)*q/4,r.n));                                   // 左の腕
        if(onScreen(g,pts,g.edge)) out.push({p:pts,cls:i&1,dir:(i+k)%5});
      }
    });
    return out;
  }


  /* 十分目盛りの輪（小数の背景の案）：同心円の輪を、内側は10等分、外側は100等分する（0.1 と 0.01）。
     輪の幅は外ほど広げ、1区画の形（半径方向の長さ÷円周方向の幅＝0.5。横長の目盛りの形）を揃える。
     色は「10区画ごとのまとまり」と輪の偶奇で交互に塗る。100等分の輪では、10区画ずつの帯が0.1の目盛りのように並ぶ */
  function dial(g) {
    var out = [], ASP = 0.5, far = farthest(g) + g.edge * 2, R0 = g.edge * 1.6, r = R0, ring = 0;
    out.push({ p: (function () { var p = []; for (var q = 0; q < 60; q++) { var a0 = TAU * q / 60; p.push([g.ox + R0 * Math.cos(a0), g.oy + R0 * Math.sin(a0)]); } return p; })(), cls: 1, dir: 0 });
    while (r < far) {
      var n = (2 * Math.PI * r / 100 < g.edge * 0.45) ? 10 : 100;      // 100等分が細すぎる内側は10等分
      var r2 = r * (1 + TAU * ASP / n), st = Math.max(2, Math.ceil(TAU / n / 0.05));
      for (var i = 0; i < n; i++) {
        var t0 = TAU * i / n - Math.PI / 2, t1 = TAU * (i + 1) / n - Math.PI / 2, pts = [], q;
        for (q = 0; q <= st; q++) { var a1 = t0 + (t1 - t0) * q / st; pts.push([g.ox + r2 * Math.cos(a1), g.oy + r2 * Math.sin(a1)]); }
        for (q = st; q >= 0; q--) { var a2 = t0 + (t1 - t0) * q / st; pts.push([g.ox + r * Math.cos(a2), g.oy + r * Math.sin(a2)]); }
        if (!onScreen(g, pts, 0)) continue;
        var grp = n === 100 ? Math.floor(i / 10) : i;
        out.push({ p: pts, cls: (grp + ring) & 1, dir: (i % 10) % 5 });
      }
      r = r2; ring++;
    }
    return out;
  }

  /* 巻き尺の渦（長さの背景の案）：一定の幅の帯がアルキメデスの渦（r = a + bθ）を巻く。帯の幅は1周で広がる長さ 2πb と同じなので、
     となりの周の帯とすき間なく接する（巻いた巻き尺）。帯を1目盛りずつ同じ長さに区切り、10目盛りごとに色を替える。
     1周の長さは10目盛りの倍数にならないので、色の帯が周ごとに少しずつずれ、別の渦が浮かんで見える */
  function tape(g) {
    var W = g.edge * 1.35, b = W / TAU, a = g.edge * 1.2, L = g.edge * 1.05, far = farthest(g) + W * 2, out = [];
    var thMax = (far - a) / b, th = 0, idx = 0, cur = 0;
    // 帯の中心線（r = a + bθ + W/2）の長さで区切る。区切りの角度を細かい刻みで積算して求める
    var cuts = [0];
    for (var tt = 0; tt < thMax; tt += 0.004) {
      var rc = a + b * tt + W / 2; cur += rc * 0.004;
      if (cur >= L) { cuts.push(tt); cur -= L; }
    }
    function P(t, off) { var rr = a + b * t + off; return [g.ox + rr * Math.cos(t), g.oy + rr * Math.sin(t)]; }
    for (var k = 0; k + 1 < cuts.length; k++) {
      var t0 = cuts[k], t1 = cuts[k + 1], pts = [], st = Math.max(2, Math.ceil((t1 - t0) / 0.04)), q;
      for (q = 0; q <= st; q++) pts.push(P(t0 + (t1 - t0) * q / st, W));     // 外の縁
      for (q = st; q >= 0; q--) pts.push(P(t0 + (t1 - t0) * q / st, 0));     // 内の縁
      if (!onScreen(g, pts, 0)) continue;
      out.push({ p: pts, cls: Math.floor(k / 10) & 1, dir: k % 5 });
    }
    // 中心：渦の始まりまでを埋める（半径 a の円板と、最初の1周の内側のすき間）
    var hub = [];
    for (q = 0; q <= 120; q++) { var t2 = TAU * q / 120; hub.push(P(t2, 0)); }
    out.push({ p: hub, cls: 1, dir: 0 });
    return out;
  }

  var GENERATORS = {
    penrose:   { name: 'ペンローズ（5回対称）', make: penrose },
    octagon:   { name: '八角の星（8回対称）',   make: multigrid(4) },
    heptagon:  { name: '七角（7回対称）',       make: multigrid(7) },
    dodecagon: { name: '十二角（12回対称）',    make: multigrid(6) },
    sunflower: { name: 'ひまわり（葉序）',      make: sunflower },
    // 丸い渦格子は内向き（鱗の丸みが中心を向く）を採用。外向きは whirl(g, false) で出せる（SPEC.md「見送った図形」）
    whirl:     { name: '丸い渦格子（6回対称・真円の鱗）', make: function (g) { return whirl(g, true); } },
    flower:    { name: '生命の花（6回対称）',   make: flower },
    mandala:   { name: '円弧の曼荼羅（4回対称）', make: mandala },
    decagon:   { name: '十角の星（10回対称）',   make: multigrid(5, 0.5) },
    petals:    { name: '渦の花びら（6回対称）',  make: petals },
    dial:      { name: '十分目盛りの輪',         make: dial },
    tape:      { name: '巻き尺の渦',             make: tape }
  };

  var api = { GENERATORS: GENERATORS, multigrid: multigrid };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GrowingFigures = api;
})(this);
