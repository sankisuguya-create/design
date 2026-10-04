# 算数ロボ（頭だけ）の読み込み中アニメーションの生成器。python3 mascot/loading.py で同じフォルダに書き出す
import os; os.chdir(os.path.dirname(os.path.abspath(__file__)))
W,H=32,34
pal={'K':'#1B2238','W':'#E6ECF4','H':'#FFFFFF','S':'#B4C2D6','B':'#49B9DF','L':'#D9F3FC','M':'#2B3450','G':'#9FB0C8','F':'#35D0A5','f':'#1F9C7A'}
def frame(dy=0, sway=0, scan=0, squash=0):
  g=[['.']*W for _ in range(H)]
  def put(x,y,c):
    y+=dy+2
    if 0<=x<W and 0<=y<H: g[y][x]=c
  cx,cy,rx,ry=15.5,21.0,13.2+squash*0.6,9.2-squash*0.6
  cy+=squash*0.6
  def inb(x,y): return ((x+.5-cx)/rx)**2+((y+.5-cy)/ry)**2<=1
  for y in range(-2,H):
    for x in range(W):
      if inb(x,y):
        edge=any(not inb(x+a,y+b) for a,b in((1,0),(-1,0),(0,1),(0,-1)))
        if edge: put(x,y,'K')
        else:
          d=((x+.5-cx)/rx)*0.6+((y+.5-cy)/ry)*0.8
          put(x,y,'S' if d>0.55 else ('H' if d<-0.62 else 'W'))
  def eye(x0,y0,w,h,lines):
    y0+=squash
    for y in range(y0,y0+h):
      for x in range(x0,x0+w):
        if (y in(y0,y0+h-1)) and (x in(x0,x0+w-1)): continue
        put(x,y,'K' if (y in(y0,y0+h-1) or x in(x0,x0+w-1)) else 'B')
    for k in lines:
      ly=y0+1+((k+scan)%(h-2))
      for x in range(x0+1,x0+w-1): put(x,ly,'L')
  eye(8,15,5,7,[1,3]); eye(18,14,5,7,[1,3])
  oy=squash
  for y in range(22+oy,28):
    for x in range(14,20): put(x,y,'K' if (y in(22+oy,27) or x in(14,19)) else 'M')
  for y in range(23+oy,27): put(15,y,'G'); put(17,y,'G')
  for x in range(15,19): put(x,25,'G')
  # アンテナ：根元は固定、先ほど sway だけ横へ
  stem=[(15,12),(15,11),(15,10),(16,9),(16,8),(17,7),(17,6),(18,5)]
  shift=[0,0,0,0,0,1,1,1]                 # 揺れるのは茎の上半分と葉だけ。根元は頭に付いたまま
  for (x,y),k in zip(stem,shift): put(x+(sway if k else 0),y+squash,'K')
  if sway<0: put(16,7+squash,'K')        # 曲がり目のすき間を埋める
  if sway>0: put(17,8+squash,'K')
  put(14,12+squash,'K'); put(16,12+squash,'K')
  L=["....KK.","...KFFK","..KFFfK",".KFFfK.",".KFfK..","..KK..."]
  for r,row in enumerate(L):
    for c,ch in enumerate(row):
      if ch!='.': put(17+c+sway,r+squash,ch)
  return g
# 8コマ：ぴょこっと跳ねて着地でつぶれる。葉は遅れて揺れ、目の走査線は流れる
seq=[dict(dy=0,sway=0,scan=0,squash=0),dict(dy=-1,sway=0,scan=1,squash=0),dict(dy=-2,sway=-1,scan=2,squash=0),dict(dy=-1,sway=-1,scan=3,squash=0),
     dict(dy=0,sway=0,scan=4,squash=0),dict(dy=0,sway=1,scan=0,squash=1),dict(dy=0,sway=1,scan=1,squash=0),dict(dy=0,sway=0,scan=2,squash=0)]
frames=[frame(**p) for p in seq]
s=8; n=len(frames)
def rects(g,ox=0):
  return ''.join(f'<rect x="{ox+x*s}" y="{y*s}" width="{s}" height="{s}" fill="{pal[c]}"/>' for y in range(H) for x in range(W) for c in [g[y][x]] if c!='.')
# アニメSVG（SMIL で1コマずつ表示を切り替える。8コマ×110ms）
dur=n*0.11
parts=[]
for i,g in enumerate(frames):
  vals=';'.join('inline' if j==i else 'none' for j in range(n))
  parts.append(f'<g display="none">{rects(g)}<animate attributeName="display" values="{vals}" dur="{dur:.2f}s" repeatCount="indefinite" calcMode="discrete"/></g>')
dots=''.join(f'<text x="{196+i*15}" y="{H*s+40}" font-size="26" font-family="monospace" font-weight="bold" fill="#1B2238" opacity="0">.<animate attributeName="opacity" values="0;1;1;0" keyTimes="0;{0.25*(i+1):.2f};0.95;1" dur="1.6s" repeatCount="indefinite"/></text>' for i in range(3))
svg=(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W*s}" height="{H*s+56}" viewBox="0 0 {W*s} {H*s+56}" shape-rendering="crispEdges">'
     f'<rect width="100%" height="100%" fill="#F7F7F4"/>{"".join(parts)}'
     f'<text x="20" y="{H*s+40}" font-size="26" font-family="monospace" font-weight="bold" fill="#1B2238">now loading</text>{dots}</svg>')
open('loading.svg','w').write(svg)
# スプライトシート（横に8コマ、1コマ32×34ドット、等倍）
sheet=''.join(f'<rect x="{i*W+x}" y="{y}" width="1" height="1" fill="{pal[c]}"/>' for i,g in enumerate(frames) for y in range(H) for x in range(W) for c in [g[y][x]] if c!='.')
open('loading_sheet.svg','w').write(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W*n}" height="{H}" shape-rendering="crispEdges">{sheet}</svg>')
big=''.join(f'<g transform="translate({i*(W*s+16)},0)">{rects(g)}</g>' for i,g in enumerate(frames))
open('loading_frames.svg','w').write(f'<svg xmlns="http://www.w3.org/2000/svg" width="{n*(W*s+16)}" height="{H*s}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#F7F7F4"/>{big}</svg>')
print('ok')
