"""Снятие зелёнки с кадров комикса.

Кадры приходят на хромакее (assets/source/comic/frameN.png) и кладутся
в assets/comic/ уже с прозрачным фоном — страницу под ними рисует игра.

Две тонкости, из-за которых это не одна строчка:

* Оттенок хромакея гуляет от кадра к кадру, а у седьмого по углам вообще
  чёрная рамка — поэтому ключ ищется как самый частый зелёный по всему
  кадру, а не берётся из угла.
* У зомби зелёная кожа. Она заметно менее насыщенная, чем хромакей, так
  что ключ берётся с допуском по расстоянию до найденного цвета, а не по
  одному «зелёный ли пиксель». Проверено: зомби остаётся на месте.

Ещё снимаем деспилл — зелёную кайму по контуру фигур: без неё вырезанные
персонажи светятся зелёным ободком на светлой странице.

Запуск из корня репозитория:
    python3 tools/comic_frames.py
"""
import collections
import glob
import os
import re

from PIL import Image, ImageFilter

SRC = 'assets/source/comic'
OUT = 'assets/comic'

KEY_DIST = 110      # допуск до цвета хромакея
SPILL = 18          # насколько гасим зелёную кайму в глубине кадра
EDGE = 7            # ширина каймы у выреза, где деспилл работает в полную силу
EDGE_CUT = 70       # в кайме всё зеленее этого — тоже фон, дорезаем


def greenish(c):
    r, g, b = c[:3]
    return g > 90 and g > r + 45 and g > b + 45


def cut(path):
    im = Image.open(path).convert('RGBA')
    w, h = im.size
    px = im.load()

    hits = collections.Counter(px[x, y][:3] for x in range(0, w, 2)
                               for y in range(0, h, 2) if greenish(px[x, y]))
    if not hits:
        return im, None
    key = hits.most_common(1)[0][0]
    kr, kg, kb = key

    out = im.copy()
    op = out.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if not greenish((r, g, b)):
                continue
            if abs(r - kr) + abs(g - kg) + abs(b - kb) < KEY_DIST:
                op[x, y] = (0, 0, 0, 0)
            elif g > (r + b) / 2 + SPILL:
                mid = (r + b) // 2
                op[x, y] = (r, min(g, mid + SPILL), b, a)

    # Кайма у самого выреза остаётся зелёной: там пиксель наполовину фон,
    # и до цвета хромакея ему далеко, а тёмные обводки вдобавок не проходят
    # проверку greenish. Поэтому вдоль границы деспилл идёт в полную силу —
    # зелень сводится к серому. Внутрь фигуры это не лезет, так что зелёная
    # кожа зомби не страдает: она далеко от края.
    hole = out.split()[3].point(lambda v: 0 if v else 255)
    near = hole.filter(ImageFilter.MaxFilter(EDGE)).load()
    for y in range(h):
        for x in range(w):
            if not near[x, y]:
                continue
            r, g, b, a = op[x, y]
            if not a:
                continue
            top = max(r, b)
            if g - top > EDGE_CUT:
                op[x, y] = (0, 0, 0, 0)
            elif g > top:
                op[x, y] = (r, top, b, a)
    return out, key


os.makedirs(OUT, exist_ok=True)
names = []
files = sorted(glob.glob(f'{SRC}/*.png'),
               key=lambda p: int(re.sub(r'\D', '', os.path.basename(p)) or 0))
for path in files:
    n = int(re.sub(r'\D', '', os.path.basename(path)))
    img, key = cut(path)
    name = f'frame{n}.png'
    img.save(f'{OUT}/{name}')
    names.append(name)
    print(f'кадр {n}: {img.size[0]}x{img.size[1]}, хромакей {key}')

print('\nв assets/comic/manifest.json:', names)
