#!/usr/bin/env python3
"""アプリのアイコン（タブ・ブックマーク用の小さな PNG）を作る。

文字を少しずつずらして重ね、1文字ずつ縁取って奥から順に置く（手前の字が奥の字を隠す）。
縦に伸ばして正方形に近づけ、16px でも大きく見えるようにする。

  python3 make_icon.py SSS -o sss.png                 # SSS の既定（SSS で採用した値）
  python3 make_icon.py KT --overlap .4 --stretch 1.3  # 2文字
  python3 make_icon.py SSS --b64                      # GAS に貼る base64 も出す
  python3 make_icon.py SSS --preview prev.png         # 16/32/64px と暗い背景の見本

要るもの：Python 3、Pillow（pip install pillow）、太いフォント（既定は Inter Display ExtraBold）。
"""
import argparse, base64, glob, io, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter

FONTS = ['/usr/share/fonts/opentype/inter/InterDisplay-ExtraBold.otf',
         '/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf',
         '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf']


def hexrgba(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (255,)


def make(text, font, overlap, stretch, stroke, line, fill, size=64, work=512):
    """text の各文字を overlap（字の幅に対する重なりの割合）でずらして重ねる。stroke は縁の太さ（作業用の大きさ 300px の字に対する px）"""
    d0 = ImageDraw.Draw(Image.new('L', (1, 1)))
    F = ImageFont.truetype(font, 300)
    widths = [d0.textbbox((0, 0), c, font=F) for c in text]
    W = 300 * (len(text) + 2)
    canvas = Image.new('RGBA', (W, W), (0, 0, 0, 0))
    x = 100
    k = stroke * 2 + 1
    for c, bb in zip(text, widths):  # 左が奥、右が手前（後から置く字が前の字を隠す）
        m = Image.new('L', (W, W), 0)
        ImageDraw.Draw(m).text((x - bb[0], 100 - bb[1]), c, font=F, fill=255)
        canvas.paste(line, (0, 0), m.filter(ImageFilter.MaxFilter(k)))
        canvas.paste(fill, (0, 0), m)
        x += (bb[2] - bb[0]) * (1 - overlap)
    im = canvas.crop(canvas.getbbox())
    im = im.resize((im.width, int(im.height * stretch)), Image.LANCZOS)  # 縦に伸ばす
    sc = work * 0.98 / max(im.size)
    im = im.resize((max(1, int(im.width * sc)), max(1, int(im.height * sc))), Image.LANCZOS)
    out = Image.new('RGBA', (work, work), (0, 0, 0, 0))
    out.paste(im, ((work - im.width) // 2, (work - im.height) // 2), im)
    return out.resize((size, size), Image.LANCZOS)  # 大きく描いて縮める（縁がなめらかになる）


def preview(im, path):
    bg = Image.new('RGBA', (300, 100), (255, 255, 255, 255))
    for sz, x in ((16, 10), (32, 40), (64, 85)):
        r = im.resize((sz, sz), Image.LANCZOS)
        bg.paste(r, (x, 50 - sz // 2), r)
    dk = Image.new('RGBA', (84, 84), (40, 40, 40, 255))
    dk.paste(im, (10, 10), im)
    bg.paste(dk, (200, 8))
    bg.save(path)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('text', help='重ねる文字（2〜3文字が目安）')
    ap.add_argument('-o', '--out', default='icon.png')
    ap.add_argument('--font', default=next((f for f in FONTS if glob.glob(f)), None))
    ap.add_argument('--overlap', type=float, default=.50, help='重なり（字の幅に対する割合）。SSS は .50')
    ap.add_argument('--stretch', type=float, default=1.6, help='縦の伸ばし。SSS は 1.6')
    ap.add_argument('--stroke', type=int, default=23, help='縁の太さ（300px の字に対する px）')
    ap.add_argument('--line', default='#606870', help='縁の色（既定は灰色：児童の目を引かない）')
    ap.add_argument('--fill', default='#ffffff', help='字の中の色')
    ap.add_argument('--size', type=int, default=64)
    ap.add_argument('--b64', action='store_true', help='base64 を標準出力に出す（GAS のコードに貼る）')
    ap.add_argument('--preview', help='見本の画像の保存先')
    a = ap.parse_args()
    if not a.font:
        sys.exit('太いフォントが見つかりません。--font で指定してください')
    im = make(a.text, a.font, a.overlap, a.stretch, a.stroke, hexrgba(a.line), hexrgba(a.fill), a.size)
    im.save(a.out, optimize=True)
    if a.preview:
        preview(im, a.preview)
    if a.b64:
        print(base64.b64encode(open(a.out, 'rb').read()).decode())
    print('%s：%d バイト' % (a.out, len(open(a.out, 'rb').read())), file=sys.stderr)


if __name__ == '__main__':
    main()
