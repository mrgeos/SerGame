"""Нарезка спрайтов из генерации реального дома Серёги.

Из одной картинки (assets/source/house.png) получаются три спрайта:
  gate_porch       — подъезд, выход с третьего уровня
  gate_porch_leaf  — одна створка двери (игра ставит её зеркально с двух сторон)
  bg2_far          — фасад в дальнем плане двора

Геометрия завязана на рисованный код-арт: проём занимает 36/102 ширины
портала, а створка — ровно половину проёма (её эталон 18 при проёме 36).
Поэтому кроп подъезда считается от найденной двери, а не подбирается на
глаз: поменяется рисованный портал — пересчитается и кроп.

Запуск из корня репозитория:
    python3 tools/house_sprites.py [assets/sprites] [pixel|smooth]

pixel  — спрайты в разрешении код-арта, игра растянет их без сглаживания;
         дом садится в общий 16-битный ряд (так сейчас и лежит в игре).
smooth — вчетверо плотнее, дом остаётся гладким и выделяется на фоне
         остальной графики.
"""
import sys
from PIL import Image, ImageFilter

SRC = 'assets/source/house.png'
OUT = sys.argv[1] if len(sys.argv) > 1 else 'assets/sprites'
STYLE = sys.argv[2] if len(sys.argv) > 2 else 'pixel'    # pixel | smooth

# --- найденное разметкой ---------------------------------------------------
DOOR = (885, 1134, 1009, 1291)          # дверь: x0, y0, x1, y1
PORCH_TOP = 746                         # докуда вверх берём дом: подъезд плюс этажи
DOOR_RATIO = 36 / 102                   # доля проёма в ширине спрайта (код-арт)

# Двор — три одинаковые башни: синяя, зелёная и оранжевая (Серёгина).
# Тайлом повторяется вся тройка, поэтому дом Серёги в фоне встречается
# ровно один раз на оборот, а не мельтешит.
FACADE = (341, 20, 691, 1070)           # один корпус: узкий и высокий
TOWER_W, TOWER_H = 84, 272              # башня на экране: узкая и высокая
GAP = 28                                # просвет между башнями
BG_H = 300                              # вся полоса; над крышами — небо
TOWER_HUES = (212, 118, None)           # синий, зелёный, оранжевый как есть

im = Image.open(SRC).convert('RGB')


def posterize(img, levels=6):
    """Огрубляем цвет: генерация гладкая, игра — 16 бит."""
    q = img.quantize(colors=levels * 8, method=Image.MEDIANCUT, dither=Image.Dither.NONE)
    return q.convert('RGB')


def styled(img, out_w):
    """Приводим к выбранному стилю и целевой ширине."""
    ratio = img.height / img.width
    out_h = max(1, round(out_w * ratio))
    if STYLE == 'pixel':
        small = img.resize((out_w, out_h), Image.LANCZOS)
        return posterize(small)
    return img.resize((out_w, out_h), Image.LANCZOS)


# --- 1. Подъезд ------------------------------------------------------------
dx0, dy0, dx1, dy1 = DOOR
door_w = dx1 - dx0
door_cx = (dx0 + dx1) / 2

crop_w = round(door_w / DOOR_RATIO)
cx0 = round(door_cx - crop_w / 2)
porch = im.crop((cx0, PORCH_TOP, cx0 + crop_w, dy1)).copy()

# Проём вычерняем: створки — отдельные спрайты, они разъезжаются,
# и под ними должен открываться тёмный тамбур, а не вторая дверь.
hw, hh = dx1 - dx0, dy1 - dy0
hall = Image.new('RGB', (hw, hh))
hp = hall.load()
floor = int(hh * 0.82)
for y in range(hh):
    for x in range(hw):
        # к центру и вниз чуть светлее — читается глубина, а не дырка
        cx = 1 - abs(x - hw / 2) / (hw / 2)
        if y < floor:
            v = 11 + 9 * cx * (y / floor) ** 2
            hp[x, y] = (int(v), int(v) - 1, int(v) + 4)
        else:
            k = (y - floor) / max(1, hh - floor)
            v = 26 + 16 * k * cx
            hp[x, y] = (int(v) + 3, int(v), int(v) - 2)
hall = hall.filter(ImageFilter.GaussianBlur(2.5))
porch.paste(hall, (dx0 - cx0, dy0 - PORCH_TOP))

porch_w = 102 if STYLE == 'pixel' else round(102 * 2.3 * 2)
styled(porch, porch_w).save(f'{OUT}/gate_porch.png')

# --- 2. Створка ------------------------------------------------------------
# Левая половина двери. Игра масштабирует её до половины проёма, поэтому
# пропорции сходятся сами: створка вырезана ровно по этой половине.
leaf = im.crop((dx0, dy0, dx0 + door_w // 2, dy1))
leaf_w = 18 if STYLE == 'pixel' else round(18 * 2.3 * 2)
styled(leaf, leaf_w).save(f'{OUT}/gate_porch_leaf.png')

# --- 3. Двор: три башни ----------------------------------------------------
# Корпуса одинаковые, отличаются только цветом простенков. Красим поворотом
# тона: белые панели и стёкла почти не насыщены и остаются на месте, уходит
# только оранжевый. Между башнями просвет, над крышами прозрачно — иначе
# ряд читается сплошной стеной, а не тремя домами.
import colorsys

fx0, fy0, fx1, fy1 = FACADE
body = im.crop((fx0, fy0, fx1, fy1))
if STYLE == 'pixel':
    body = posterize(body.resize((TOWER_W // 2, TOWER_H // 2), Image.LANCZOS))
    body = body.resize((TOWER_W, TOWER_H), Image.NEAREST)
else:
    body = body.resize((TOWER_W, TOWER_H), Image.LANCZOS)

NIGHT = (58, 48, 86)                          # вечерний воздух, к нему уводим


def tower(hue):
    t = body.copy().convert('RGBA')
    tp = t.load()
    for y in range(TOWER_H):
        for x in range(TOWER_W):
            r, g, b, a = tp[x, y]
            if hue is not None:
                hh, ss, vv = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
                # перекрашиваем только тёплые насыщенные пятна — простенки
                if ss > 0.22 and (hh < 0.11 or hh > 0.94):
                    # чуть глушим насыщенность: три ярких корпуса рядом
                    # начинают рябить и спорят с героем
                    r, g, b = [round(c * 255) for c in
                               colorsys.hsv_to_rgb(hue / 360, ss * 0.72, vv)]
            tp[x, y] = (round(r * .72 + NIGHT[0] * .28),
                        round(g * .72 + NIGHT[1] * .28),
                        round(b * .72 + NIGHT[2] * .28), a)
    # крыша: тёмный парапет, иначе корпус обрывается срезом
    d = Image.new('RGBA', (TOWER_W, 5), (38, 33, 56, 255))
    t.paste(d, (0, 0))
    t.paste(Image.new('RGBA', (TOWER_W, 2), (78, 70, 104, 255)), (0, 0))
    return t

bg_w = (TOWER_W + GAP) * len(TOWER_HUES)
bg = Image.new('RGBA', (bg_w, BG_H), (0, 0, 0, 0))
for i, hue in enumerate(TOWER_HUES):
    bg.paste(tower(hue), (GAP // 2 + i * (TOWER_W + GAP), BG_H - TOWER_H))
bg.save(f'{OUT}/bg2_far.png')

print(f'{STYLE}: подъезд {porch.size} -> {porch_w}px, '
      f'створка {leaf.size}, двор {bg_w}x{BG_H} (три башни)')
