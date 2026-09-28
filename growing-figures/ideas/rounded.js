/* 試作の記録（見送った案を含む）。採用した案（whirl / flower / mandala）の正本は ../generators.js。
   ここは試作時点の写しで、見送った案（petals 渦の花びら・shippo 七宝つなぎ）を再検討するときの出発点。
   読み込むと window.ROUNDED に入る。見本帳で見るには sampler.html の GENS をこれに差し替える */
/* 丸みと対称性のある床（試作）。どれも円弧だけで囲まれたタイルで、平面を隙間なく覆う。
   育ち始める点を対称の中心（格子点）に置くので、育つ形がそのまま回転対称の花になる。 */
(function(root){
  var TAU=2*Math.PI;
  function onScreen(g,pts,m){var x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;for(var i=0;i<pts.length;i++){var p=pts[i];if(p[0]<x0)x0=p[0];if(p[0]>x1)x1=p[0];if(p[1]<y0)y0=p[1];if(p[1]>y1)y1=p[1]}return x1>-m&&x0<g.W+m&&y1>-m&&y0<g.H+m}
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

  /* 生命の花（6回対称）：三角格子の各点を中心に、隣の点を通る円を描く。
     円どうしが切り分ける「花びら」（格子の辺ごとに1枚）と「反った三角」（格子の三角ごとに1枚）がタイル。
     中心から育つと、6枚の花びらの花が同心の六角に広がる。色1＝花びら、色2＝反った三角。
     中心は同心円（円板1枚＋6・12・18等分の輪）で、その円に掛かる格子のタイルは円の分だけ削る */
  function flower(g){
    var a=g.edge*1.95, e0=[a,0], e1=[a/2,a*Math.sqrt(3)/2], e2=[-a/2,a*Math.sqrt(3)/2], N=range(g,a), out=[];
    // 中心は同心円にする：半径 R0 の円板の中を、円板1枚と輪3本（6・12・18に等分）で埋め、格子のタイルは円板の分だけ削る
    var O0=[g.ox,g.oy], R0=a*1.62, RINGS=4;
    function keep(pts,cls,dir){var q=minusDisk(pts,O0,R0);if(q&&q.length>2&&onScreen(g,q,g.edge))out.push({p:q,cls:cls,dir:dir})}
    for(var rk=0;rk<RINGS;rk++){
      var r1=R0*(rk+1)/RINGS, r0=R0*rk/RINGS, m=rk?6*rk:1;
      for(var sgm=0;sgm<m;sgm++){
        var sh=(rk&1)?Math.PI/m:0, t0=TAU*sgm/m-Math.PI/2+sh, t1=TAU*(sgm+1)/m-Math.PI/2+sh,   // 輪ごとに半区画ずらし、放射の線が一直線に通らないようにする
        pts=[], st=Math.max(4,Math.ceil((t1-t0)/0.05));
        for(var q=0;q<=st;q++){var tt=t0+(t1-t0)*q/st;pts.push([O0[0]+r1*Math.cos(tt),O0[1]+r1*Math.sin(tt)])}
        if(rk) for(q=st;q>=0;q--){var t2=t0+(t1-t0)*q/st;pts.push([O0[0]+r0*Math.cos(t2),O0[1]+r0*Math.sin(t2)])}
        out.push({p:pts,cls:rk?(sgm+rk)&1:1,dir:rk%5});
      }
    }
    function P(i,j){return[g.ox+i*e0[0]+j*e1[0],g.oy+i*e0[1]+j*e1[1]]}
    function rot(v,s){var c=0.5,sn=s*Math.sqrt(3)/2;return[v[0]*c-v[1]*sn,v[0]*sn+v[1]*c]}
    for(var i=-N;i<=N;i++)for(var j=-N;j<=N;j++){
      var O=P(i,j);
      if(O[0]<-2*a||O[0]>g.W+2*a||O[1]<-2*a||O[1]>g.H+2*a) continue;
      [e0,e1,e2].forEach(function(e,k){                      // 花びら：辺 O→V。両脇の格子点 W1・W2 を中心とする2本の弧で囲む
        var V=add(O,e), W1=add(O,rot(e,1)), W2=add(O,rot(e,-1));
        keep(arc(W1,O,V).concat(arc(W2,V,O)),1,k);
      });
      [[O,add(O,e0),add(O,e1),3],[add(O,e0),add(add(O,e0),e1),add(O,e1),4]].forEach(function(T){   // 反った三角：上向きと下向き
        var A=T[0],B=T[1],C=T[2];
        function D(X,Y,Z){return sub(add(X,Y),Z)}          // 辺 XY の向こう側の格子点（そこを中心とする弧が辺をふくらませる）
        keep(arc(D(A,B,C),A,B).concat(arc(D(B,C,A),B,C),arc(D(C,A,B),C,A)),0,T[3]);
      });
    }
    return out;
  }

  /* 案2 七宝つなぎ（4回対称）：正方格子の各点に、斜めの隣と接する大きさの円を描く。
     縦横の隣どうしが重なる「花びら」と、4つの花びらに削られた「星」がタイル。色1＝花びら、色2＝星 */
  function shippo(g){
    var a=g.edge*1.42, h=a/2, N=range(g,a), out=[];
    for(var i=-N;i<=N;i++)for(var j=-N;j<=N;j++){
      var O=[g.ox+i*a,g.oy+j*a];
      if(O[0]<-2*a||O[0]>g.W+2*a||O[1]<-2*a||O[1]>g.H+2*a) continue;
      [[a,0],[0,a]].forEach(function(e,k){                   // 花びら：O と O+e の円が重なるレンズ。先端は2つの正方形の中心
        var Q=add(O,e), M=mid(O,Q), n=[-e[1]/a*h,e[0]/a*h], t1=add(M,n), t2=sub(M,n);
        var pts=arc(O,t2,t1).concat(arc(Q,t1,t2));
        if(onScreen(g,pts,g.edge)) out.push({p:pts,cls:1,dir:k});
      });
      var c=[[h,-h],[h,h],[-h,h],[-h,-h]].map(function(v){return add(O,v)}), nb=[[a,0],[0,a],[-a,0],[0,-a]], pts=[];
      for(var k=0;k<4;k++) pts=pts.concat(arc(add(O,nb[k]),c[k],c[(k+1)%4]));   // 星：隣の円の弧で4方から削られた形
      if(onScreen(g,pts,g.edge)) out.push({p:pts,cls:0,dir:2+(i+j&1)});
    }
    return out;
  }

  /* 案3 円弧の曼荼羅（4回対称）：正方形のマスに四分円の弧を2本ずつ置く（スミスのトルシェ）。
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


  /* ---- 以下2案は、求心の螺旋（spirals.js と同じ対数極座標の作り）に丸みを足したもの ----
     腕の本数は6の倍数にして6回対称にする。花びらの仕切り（半径2倍の円）で本数が2倍になる */
  function farthest(g){var f=0;[[0,0],[g.W,0],[0,g.H],[g.W,g.H]].forEach(function(p){var dx=p[0]-g.ox,dy=p[1]-g.oy;f=Math.max(f,Math.sqrt(dx*dx+dy*dy))});return f}
  function bands6(g,width){
    var r0=g.edge*1.6, far=farthest(g)+g.edge*2, out=[], r=r0;
    var n=6*Math.pow(2,Math.max(0,Math.ceil(Math.log(TAU*r0/width/6)/Math.LN2)));
    while(r<far){out.push({s0:Math.log(r),s1:Math.log(2*r),n:n});r*=2;n*=2}
    return {r0:r0,list:out};
  }
  function xy(g,s,th){var r=Math.exp(s);return[g.ox+r*Math.cos(th),g.oy+r*Math.sin(th)]}
  function clipS(poly,s0,s1){
    function cut(P,v,up){var out=[];for(var i=0;i<P.length;i++){var A=P[i],B=P[(i+1)%P.length],da=up?A[0]-v:v-A[0],db=up?B[0]-v:v-B[0];if(da>=0)out.push(A);if((da>0&&db<0)||(da<0&&db>0)){var t=da/(da-db);out.push([A[0]+(B[0]-A[0])*t,A[1]+(B[1]-A[1])*t])}}return out}
    return cut(cut(poly,s0,true),s1,false);
  }

  /* 案A 渦の花びら：螺旋の腕を、外へふくらむ弧で切った一画一画。一画は上が丸く、下が前の一画の丸みを受けて反る
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

  /* 案B 丸い渦格子：右回りと左回りの螺旋が交わる格子の辺を、S字にしならせる。
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
    // 中心：最初の帯より内側を6枚の花びらで埋める
    var r0=Math.exp(B.list[0].s0);
    for(var c=0;c<6;c++){var pts=[[g.ox,g.oy]];for(var q=0;q<=10;q++){var th=TAU*(c+q/10)/6;pts.push([g.ox+r0*Math.cos(th),g.oy+r0*Math.sin(th)])}out.push({p:pts,cls:1-(c&1),dir:c%5})}
    return out;
  }

  root.ROUNDED={
    petals: {name:'A 渦の花びら（6回対称・螺旋）',make:petals},
    whirl:  {name:'B 丸い渦格子（6回対称・左右の螺旋）',make:whirl},
    flower: {name:'C 生命の花（6回対称）',make:flower}
  };
  if(typeof module!=='undefined'&&module.exports) module.exports=root.ROUNDED;
})(typeof window!=='undefined'?window:this);
