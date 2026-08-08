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
PORCH_TOP = 986                         # докуда вверх берём портал с козырьком
DOOR_RATIO = 36 / 102                   # доля проёма в ширине спрайта (код-арт)
FACADE = (341, 20, 889, 1048)           # фасад для фона: стык подобран по краям
BG_W, BG_H = 160, 300                   # тайл: панельке повторяться не грех

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

# --- 3. Фон двора ----------------------------------------------------------
# Тайлится по горизонтали, поэтому края сводим кросс-фейдом. Верх растворяем
# в прозрачность: дом выше полосы, и обрывать его ровной линией по небу нельзя.
# Заодно притемняем — дальний план не должен спорить с героем.
fx0, fy0, fx1, fy1 = FACADE
facade = im.crop((fx0, fy0, fx1, fy1))
if STYLE == 'pixel':
    bg = posterize(facade.resize((BG_W // 2, BG_H // 2), Image.LANCZOS))
    bg = bg.resize((BG_W, BG_H), Image.NEAREST)
else:
    bg = facade.resize((BG_W, BG_H), Image.LANCZOS)

bg = bg.convert('RGBA')
bp = bg.load()
NIGHT = (58, 48, 86)                          # к чему уводим — вечерний воздух
for y in range(BG_H):
    for x in range(BG_W):
        r, g, b, a = bp[x, y]
        bp[x, y] = (round(r * .72 + NIGHT[0] * .28),
                    round(g * .72 + NIGHT[1] * .28),
                    round(b * .72 + NIGHT[2] * .28), a)

BLEND = 10
for x in range(BLEND):                        # шов между левым и правым краем
    k = 0.5 * (1 - x / BLEND)
    for y in range(BG_H):
        a = bp[x, y]
        b = bp[BG_W - BLEND + x, y]
        bp[x, y] = tuple(round(a[i] * (1 - k) + b[i] * k) for i in range(3)) + (a[3],)

FADE = 84
for y in range(FADE):                         # верх уходит в небо
    al = round(255 * (y / FADE) ** 1.4)
    for x in range(BG_W):
        bp[x, y] = bp[x, y][:3] + (al,)
bg.save(f'{OUT}/bg2_far.png')

print(f'{STYLE}: подъезд {porch.size} -> {porch_w}px, створка {leaf.size}, фон {BG_W}x{BG_H}')
