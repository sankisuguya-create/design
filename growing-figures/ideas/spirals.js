/* 試作の記録（すべて見送り）：求心の螺旋の一画一画を育てる3案。巻き貝・ひまわり格子・八重咲き。
   評価は「悪くないが、丸みと神秘的な対称性が足りない」。丸い渦格子（../generators.js の whirl）はここの lattice に丸みを足したもの。
   読み込むと window.SPIRALS に入る */
/* 求心状の螺旋の生成器（試作）。
   すべて「対数極座標」(s = log r, θ) で組み立てる。この座標では対数螺旋も円も直線になるので、
   タイルは (s,θ) の上の直線の四角形として作り、辺を細かく打ってから (x,y) に写すと螺旋の曲線になる。
   ・腕（一画）の本数は、外へ行くほど2倍ずつ増やす（「花びらの仕切り」＝半径が2倍になる円）。
     こうすると一画の太さが画面のどこでもほぼ同じになる
   ・仕切りの間はさらに細い円で切り、一画の長さが太さの K 倍を超えないようにする
   ・中心は小さな花（腕の本数ぶんの花びら）にして、中心に穴を空けない */
(function(root){
  function farthest(g){var f=0;[[0,0],[g.W,0],[0,g.H],[g.W,g.H]].forEach(function(p){var dx=p[0]-g.ox,dy=p[1]-g.oy;f=Math.max(f,Math.sqrt(dx*dx+dy*dy))});return f}
  function onScreen(g,pts,m){var x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;for(var i=0;i<pts.length;i++){var p=pts[i];if(p[0]<x0)x0=p[0];if(p[0]>x1)x1=p[0];if(p[1]<y0)y0=p[1];if(p[1]>y1)y1=p[1]}return x1>-m&&x0<g.W+m&&y1>-m&&y0<g.H+m}
  var TAU=2*Math.PI;
  /* (s,θ) の多角形の辺を細かく打ってから (x,y) に写す。曲がり具合に応じて、θ は 0.07rad、s は 0.05 ごとに点を置く */
  function toXY(g,poly){
    var out=[];
    for(var i=0;i<poly.length;i++){
      var a=poly[i],b=poly[(i+1)%poly.length];
      var n=Math.max(1,Math.ceil(Math.max(Math.abs(b[1]-a[1])/0.07,Math.abs(b[0]-a[0])/0.05)));
      for(var k=0;k<n;k++){var t=k/n,s=a[0]+(b[0]-a[0])*t,th=a[1]+(b[1]-a[1])*t,r=Math.exp(s);out.push([g.ox+r*Math.cos(th),g.oy+r*Math.sin(th)])}
    }
    return out;
  }
  /* s の範囲 [s0,s1] で切る（(s,θ) では円 s=一定 は直線なので、半平面で切るだけ） */
  function clipS(poly,s0,s1){
    function cut(P,v,keepAbove){var out=[];for(var i=0;i<P.length;i++){var A=P[i],B=P[(i+1)%P.length],da=keepAbove?A[0]-v:v-A[0],db=keepAbove?B[0]-v:v-B[0];if(da>=0)out.push(A);if((da>0&&db<0)||(da<0&&db>0)){var t=da/(da-db);out.push([A[0]+(B[0]-A[0])*t,A[1]+(B[1]-A[1])*t])}}return out}
    return cut(cut(poly,s0,true),s1,false);
  }
  /* 花びらの仕切り（半径が2倍ずつの円）と、各帯の腕の本数を決める */
  function bands(g,width){
    var r0=g.edge*1.3, far=farthest(g)+g.edge*2, out=[], r=r0;
    var n=Math.pow(2,Math.ceil(Math.log(TAU*r0/width)/Math.LN2));
    while(r<far){out.push({s0:Math.log(r),s1:Math.log(2*r),n:n});r*=2;n*=2}
    return {r0:r0,list:out};
  }
  /* 中心の花：腕の本数ぶんの花びら（扇形）。育ち始める点に置く */
  function center(g,r0,n,twist){
    var out=[],s0=Math.log(r0);
    for(var i=0;i<n;i++){
      var a=TAU*i/n+twist*s0,b=TAU*(i+1)/n+twist*s0,pts=[[g.ox,g.oy]];
      for(var k=0;k<=6;k++){var th=a+(b-a)*k/6;pts.push([g.ox+r0*Math.cos(th),g.oy+r0*Math.sin(th)])}
      out.push({p:pts,cls:1-i%2,dir:i%5});
    }
    return out;
  }

  /* 案A 巻き貝：一方向の螺旋の腕を、花びらの仕切りと細い円で切った一画一画。
     仕切りを越えるたびに腕が2本に分かれる。色1・色2は腕ごとに交互 */
  function shell(g){
    var W0=g.edge*0.8,K=2.8,t=0.9,B=bands(g,W0),out=center(g,B.r0,B.list[0].n/2,t);
    B.list.forEach(function(b){
      // 一画の長さ÷太さ＝K になるように細い円で切る。螺旋が斜めに走るぶん（1+t²）長くなるので、その分だけ多く切る
      var m=Math.max(1,Math.round((b.s1-b.s0)*(1+t*t)*b.n/(TAU*K)));
      for(var k=0;k<m;k++){
        var sa=b.s0+(b.s1-b.s0)*k/m, sb=b.s0+(b.s1-b.s0)*(k+1)/m;
        for(var i=0;i<b.n;i++){
          var th=function(j,s){return TAU*j/b.n+t*s};
          var poly=[[sa,th(i,sa)],[sb,th(i,sb)],[sb,th(i+1,sb)],[sa,th(i+1,sa)]], p=toXY(g,poly);
          if(!onScreen(g,p,g.edge)) continue;
          out.push({p:p,cls:i%2,dir:(i+k)%5});
        }
      }
    });
    return out;
  }

  /* 案B ひまわり格子：右回りと左回りの2組の螺旋が交わってできる菱形。
     花びらの仕切りで両方の本数が2倍になる（仕切りの上の菱形は円で切れた形になる）。
     色は右回りの腕ごとに交互：色1の段で右回りの渦が現れ、輪郭では左右の渦が重なって見える */
  function lattice(g){
    var W0=g.edge*1.75,t=1,B=bands(g,W0),out=center(g,B.r0,B.list[0].n/2,0);
    B.list.forEach(function(b){
      var n=b.n, k=n*t/Math.PI, d0=Math.floor(b.s0*k)-1, d1=Math.ceil(b.s1*k)+1;
      for(var i=0;i<n;i++) for(var d=d0;d<=d1;d++){
        // (a,b) 格子の1マス → (s,θ)：θ=(a+b)π/n, s=(b−a)π/(n t)
        var poly=[[i,i+d],[i+1,i+d],[i+1,i+d+1],[i,i+d+1]].map(function(v){return[(v[1]-v[0])*Math.PI/(n*t),(v[0]+v[1])*Math.PI/n]});
        poly=clipS(poly,b.s0,b.s1); if(poly.length<3) continue;
        var p=toXY(g,poly); if(!onScreen(g,p,g.edge)) continue;
        out.push({p:p,cls:i%2,dir:((d%5)+5)%5});
      }
    });
    return out;
  }

  /* 案C 八重咲き：花びらの仕切りごとに渦の向きを反転させる。腕は仕切りで折れ曲がり、
     帯ごとに「く」の字が重なって八重の花びらのように見える。色1・色2は腕ごとに交互 */
  function dahlia(g){
    var W0=g.edge*0.8,K=2.8,t=1.25,B=bands(g,W0),out=center(g,B.r0,B.list[0].n/2,t),off=0,sign=1;
    B.list.forEach(function(b){
      var tt=t*sign, base=off-tt*b.s0;   // 仕切りの上で前の帯の腕とつながるように、角度のずれを持ち越す
      var m=Math.max(1,Math.round((b.s1-b.s0)*(1+tt*tt)*b.n/(TAU*K)));
      for(var k=0;k<m;k++){
        var sa=b.s0+(b.s1-b.s0)*k/m, sb=b.s0+(b.s1-b.s0)*(k+1)/m;
        for(var i=0;i<b.n;i++){
          var th=function(j,s){return TAU*j/b.n+base+tt*s};
          var poly=[[sa,th(i,sa)],[sb,th(i,sb)],[sb,th(i+1,sb)],[sa,th(i+1,sa)]], p=toXY(g,poly);
          if(!onScreen(g,p,g.edge)) continue;
          out.push({p:p,cls:i%2,dir:(i+k)%5});
        }
      }
      off=base+tt*b.s1; sign=-sign;
    });
    return out;
  }

  root.SPIRALS={
    shell:  {name:'A 巻き貝（一方向の渦・枝分かれ）',make:shell},
    lattice:{name:'B ひまわり格子（左右の渦の菱形）',make:lattice},
    dahlia: {name:'C 八重咲き（仕切りごとに向きが反転）',make:dahlia}
  };
  if(typeof module!=='undefined'&&module.exports) module.exports=root.SPIRALS;
})(typeof window!=='undefined'?window:this);
