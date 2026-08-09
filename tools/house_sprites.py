"""Нарезка спрайтов из генераций дома Серёги.

Источников два, и это не лишнее:
  assets/source/house_clean.png — дом без лишнего вокруг, из него режется
      сам подъезд: он выезжает в конце двора один раз и в бок не тайлится;
  assets/source/house.png — первая генерация с длинным фасадом, из неё
      набираются корпуса двора: там больше этажей, а для тайла это важнее
      чистоты краёв.

Что получается:
  gate_porch       — дом Серёги целиком, подъезд справа
  gate_porch_leaf  — одна створка двери (игра ставит её зеркально с двух сторон)
  bg2_far          — двор: три одинаковых корпуса, синий, зелёный и оранжевый

Геометрия проёма продублирована в GATE_DOOR в src/scenes/game.js: игра
ставит створки по долям от размера спрайта, а не по его середине —
подъезд у дома сбоку. Меняете кроп — правьте и те доли.

Запуск из корня репозитория:
    python3 tools/house_sprites.py [assets/sprites] [smooth|pixel]

Аргумент задаёт стиль дома. Корпуса двора всегда пиксельные: они далеко,
там детали не читаются, а рябь от гладкой картинки видна.
"""
import colorsys
import sys

from PIL import Image, ImageFilter

OUT = sys.argv[1] if len(sys.argv) > 1 else 'assets/sprites'
STYLE = sys.argv[2] if len(sys.argv) > 2 else 'smooth'   # стиль дома

# --- дом Серёги ------------------------------------------------------------
HOUSE = 'assets/source/house_clean.png'
BUILDING = (137, 0, 688, 683)           # без зелёного фона слева
DOOR = (519, 582, 596, 673)             # дверь: x0, y0, x1, y1
PORCH_SRC_W = 140                       # ширина рисованного код-арта
PORCH_SCALE = 3                         # HI.gate_porch — во сколько игра тянет

# --- двор ------------------------------------------------------------------
YARD = 'assets/source/house.png'
FACADE = (341, 20, 691, 1070)           # один корпус: узкий и высокий
TOWER_W, TOWER_H = 84, 272              # башня на экране
GAP = 28                                # просвет между башнями
BG_H = 300                              # вся полоса; над крышами — небо
TOWER_HUES = (212, 118, None)           # синий, зелёный, оранжевый как есть
NIGHT = (58, 48, 86)                    # вечерний воздух, к нему уводим дальний план


def posterize(img, colors=48):
    """Огрубляем цвет: генерация гладкая, игра — 16 бит."""
    q = img.quantize(colors=colors, method=Image.MEDIANCUT, dither=Image.Dither.NONE)
    return q.convert('RGB')


# --- 1. Дом с подъездом ----------------------------------------------------
house = Image.open(HOUSE).convert('RGB')
bx0, by0, bx1, by1 = BUILDING
dx0, dy0, dx1, dy1 = DOOR
porch = house.crop(BUILDING).copy()

# Проём вычерняем: створки — отдельные спрайты, они разъезжаются, и под
# ними должен открываться тёмный тамбур, а не вторая такая же дверь.
hw, hh = dx1 - dx0, dy1 - dy0
hall = Image.new('RGB', (hw, hh))
hp = hall.load()
floor = int(hh * 0.86)
for y in range(hh):
    for x in range(hw):
        # к центру и вниз чуть светлее — читается глубина, а не дырка
        k = 1 - abs(x - hw / 2) / (hw / 2)
        if y < floor:
            v = 11 + 9 * k * (y / floor) ** 2
            hp[x, y] = (int(v), int(v) - 1, int(v) + 4)
        else:
            t = (y - floor) / max(1, hh - floor)
            v = 26 + 16 * t * k
            hp[x, y] = (int(v) + 3, int(v), int(v) - 2)
hall = hall.filter(ImageFilter.GaussianBlur(2))
porch.paste(hall, (dx0 - bx0, dy0 - by0))

if STYLE == 'pixel':
    out_w = PORCH_SRC_W
else:
    # Ровно столько точек, сколько дом займёт на плотном холсте: игра
    # выводит без сглаживания, и любое дробное растяжение даёт рябь.
    out_w = PORCH_SRC_W * PORCH_SCALE * 2

def scaled(img, w):
    h = max(1, round(w * img.height / img.width))
    r = img.resize((w, h), Image.LANCZOS)
    if STYLE == 'pixel':
        return posterize(r)
    return r.filter(ImageFilter.UnsharpMask(radius=1.4, percent=55, threshold=3))

scaled(porch, out_w).save(f'{OUT}/gate_porch.png')

# --- 2. Створка ------------------------------------------------------------
# Левая половина двери. Игра подгоняет её под половину проёма, поэтому
# пропорции сходятся сами: створка вырезана ровно по этой половине.
leaf = house.crop((dx0, dy0, dx0 + hw // 2, dy1))
leaf_w = round(out_w * (hw / 2) / (bx1 - bx0))
scaled(leaf, max(8, leaf_w)).save(f'{OUT}/gate_porch_leaf.png')

# --- 3. Двор: три корпуса --------------------------------------------------
# Корпуса одинаковые, отличаются только цветом простенков. Красим поворотом
# тона: белые панели и стёкла почти не насыщены и остаются на месте, уходит
# только оранжевый. Между корпусами просвет, над крышами прозрачно — иначе
# ряд читается сплошной стеной, а не тремя домами.
yard = Image.open(YARD).convert('RGB')
body = posterize(yard.crop(FACADE).resize((TOWER_W // 2, TOWER_H // 2), Image.LANCZOS))
body = body.resize((TOWER_W, TOWER_H), Image.NEAREST)


def tower(hue):
    t = body.copy().convert('RGBA')
    tp = t.load()
    for y in range(TOWER_H):
        for x in range(TOWER_W):
            r, g, b, a = tp[x, y]
            if hue is not None:
                hh_, ss, vv = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
                # перекрашиваем только тёплые насыщенные пятна — простенки.
                # Насыщенность глушим: три ярких корпуса рядом начинают
                # рябить и спорят с героем.
                if ss > 0.22 and (hh_ < 0.11 or hh_ > 0.94):
                    r, g, b = [round(c * 255) for c in
                               colorsys.hsv_to_rgb(hue / 360, ss * 0.72, vv)]
            tp[x, y] = (round(r * .72 + NIGHT[0] * .28),
                        round(g * .72 + NIGHT[1] * .28),
                        round(b * .72 + NIGHT[2] * .28), a)
    # крыша: тёмный парапет, иначе корпус обрывается срезом
    t.paste(Image.new('RGBA', (TOWER_W, 5), (38, 33, 56, 255)), (0, 0))
    t.paste(Image.new('RGBA', (TOWER_W, 2), (78, 70, 104, 255)), (0, 0))
    return t


bg_w = (TOWER_W + GAP) * len(TOWER_HUES)
bg = Image.new('RGBA', (bg_w, BG_H), (0, 0, 0, 0))
for i, hue in enumerate(TOWER_HUES):
    bg.paste(tower(hue), (GAP // 2 + i * (TOWER_W + GAP), BG_H - TOWER_H))
bg.save(f'{OUT}/bg2_far.png')

print(f'дом ({STYLE}) {out_w}px, створка {leaf_w}px, двор {bg_w}x{BG_H} (три корпуса)')
