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

  /* ================================================================
   *  丸みのある図形（円弧だけで囲まれたタイル）
   *  3つとも利用者の評価で採用。丸み・回転対称・同心の育ち方が揃う
   * ================================================================ */
  var TAU = 2 * Math.PI;
  /* 中心 c・半径 r の円の上を、点 p から点 q まで短い向きに進む円弧の点列（p は含み q は含まない） */
  function arc(c,p,q,step){
    var a0=Math.atan2(p[1]-c[1],p[0]-c[0]), a1=Math.atan2(q[1]-c[1],q[0]-c[0]), d=a1-a0;
    while(d>Math.PI)d-=TAU; while(d<-Math.PI)d+=TAU;
    var r=Math.hypot(p[0]-c[0],p[1]-c[1]), n=Math.max(2,Math.ceil(Math.abs(d)/(step||0.12))), out=[];
    for(var k=0;k<n;k++){var t=a0+d*k/n;out.push([c[0]+r*Math.cos(t),c[1]+r*Math.sin(t)])}
    return out;
  }
  /* 多角形から円板（中心 c・半径 R）を取り除いた残り。円の内側に入った区間は、円周に沿った弧に置き換える。
     タイルが円より十分小さいので、出て入る間の弧は短い向きでよい。全部が内側なら null */
  function minusDisk(pts,c,R){
    var n=pts.length,ins=pts.map(function(p){return Math.hypot(p[0]-c[0],p[1]-c[1])<R});
    var s0=ins.indexOf(false); if(s0<0) return null; if(ins.indexOf(true)<0) return pts;
    function hit(A,B){var dx=B[0]-A[0],dy=B[1]-A[1],fx=A[0]-c[0],fy=A[1]-c[1],a=dx*dx+dy*dy,b=2*(fx*dx+fy*dy),cc=fx*fx+fy*fy-R*R,D=Math.sqrt(Math.max(0,b*b-4*a*cc));
      var t1=(-b-D)/(2*a),t2=(-b+D)/(2*a),t=(t1>=0&&t1<=1)?t1:t2;return[A[0]+dx*t,A[1]+dy*t]}
    var out=[],exitP=null;
    for(var k=0;k<n;k++){
      var i=(s0+k)%n,j=(i+1)%n,A=pts[i],B=pts[j];
      if(!ins[i]) out.push(A);
      if(!ins[i]&&ins[j]){exitP=hit(A,B);out.push(exitP)}                 // 円の内側へ入る点
      if(ins[i]&&!ins[j]){var Y=hit(A,B);out=out.concat(arc(c,exitP,Y,0.05).slice(1));out.push(Y);exitP=null}   // 円周をたどって出る点へ
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

  /* 丸い渦格子：右回りと左回りの螺旋が交わる格子の辺を、S字にしならせる。
     辺はとなりのマスと共有するので、しならせても隙間はできない。マスは2辺がふくらみ2辺が反った、
     風車のように回る丸いマスになる。仕切りの円で両方の本数が2倍になる。色は右回りの腕ごとに交互 */
  function whirl(g){
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

  var GENERATORS = {
    penrose:   { name: 'ペンローズ（5回対称）', make: penrose },
    octagon:   { name: '八角の星（8回対称）',   make: multigrid(4) },
    heptagon:  { name: '七角（7回対称）',       make: multigrid(7) },
    dodecagon: { name: '十二角（12回対称）',    make: multigrid(6) },
    sunflower: { name: 'ひまわり（葉序）',      make: sunflower },
    whirl:     { name: '丸い渦格子（6回対称）', make: whirl },
    flower:    { name: '生命の花（6回対称）',   make: flower },
    mandala:   { name: '円弧の曼荼羅（4回対称）', make: mandala },
    bubbles:   { name: '渦の真円（21・34の螺旋）', make: bubbles }
  };

  var api = { GENERATORS: GENERATORS, multigrid: multigrid };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GrowingFigures = api;
})(this);
