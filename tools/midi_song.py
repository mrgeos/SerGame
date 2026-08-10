"""Перегон MIDI-аранжировки в партитуру для синтезатора игры.

Звук в игре синтезируется в браузере, аудиофайлов нет и заводить их не
хочется: минута записи весит больше, чем вся остальная игра. Поэтому песня
едет в виде нот, а играет её тот же движок, что и остальные темы.

Из одиннадцати дорожек берутся четыре — больше на квадратах и пилах
превращается в кашу:

* lead   — вокальная мелодия, а там, где не поют, соло-гитара;
* rhythm — ритм-гитара (вторая её дублирует, дубль выкидываем);
* bass   — бас;
* drums  — бочка, рабочий, хэт, том, крэш.

Времена и длительности — в миллисекундах, дельтами от предыдущей ноты:
так партитура ужимается вдвое против абсолютных времён и всё ещё читается
глазами. Ноты — MIDI-номера.

Запуск из корня репозитория:
    python3 tools/midi_song.py <файл.mid> [assets/music/run.json]
"""
import json
import os
import sys

import mido

# канал → партия. У баса канал 10, у барабанов 9 — так в файле.
PART = {0: 'lead', 7: 'lead', 5: 'rhythm', 10: 'bass'}
DRUMS = 9

# GM-перкуссия → чем играем
HIT = {35: 'kick', 36: 'kick', 38: 'snare', 40: 'snare', 37: 'snare',
       42: 'hat', 44: 'hat', 46: 'hat',
       41: 'tom', 43: 'tom', 45: 'tom', 47: 'tom', 48: 'tom', 50: 'tom',
       49: 'crash', 52: 'crash', 55: 'crash', 57: 'crash'}
KINDS = ['kick', 'snare', 'hat', 'tom', 'crash']

MIN_DUR = 40        # совсем короткие ноты не слышно, подтягиваем
MAX_DUR = 2000      # длинные тянуть незачем: осциллятор всё равно затухает


def convert(path):
    mid = mido.MidiFile(path)
    now = 0.0
    open_notes = {}                       # (канал, нота) → время начала
    parts = {'lead': [], 'rhythm': [], 'bass': []}
    drums = []

    for msg in mid:                       # итератор сам разворачивает темп
        now += msg.time
        if msg.type == 'note_on' and msg.velocity > 0:
            if msg.channel == DRUMS:
                kind = HIT.get(msg.note)
                if kind:
                    drums.append([now, KINDS.index(kind)])
            elif msg.channel in PART:
                open_notes[(msg.channel, msg.note)] = now
        elif msg.type == 'note_off' or (msg.type == 'note_on' and not msg.velocity):
            t0 = open_notes.pop((msg.channel, msg.note), None)
            if t0 is not None and msg.channel in PART:
                parts[PART[msg.channel]].append([t0, msg.note, now - t0])

    out = {'ms': int(mid.length * 1000)}
    for name in ('lead', 'rhythm', 'bass'):
        ev = sorted(parts[name])
        prev = 0.0
        packed = []
        for t, note, dur in ev:
            dt = int(round((t - prev) * 1000))
            prev = t
            packed.append([dt, note, max(MIN_DUR, min(MAX_DUR, int(dur * 1000)))])
        out[name] = packed

    prev = 0.0
    packed = []
    for t, kind in sorted(drums):
        packed.append([int(round((t - prev) * 1000)), kind])
        prev = t
    out['drums'] = packed
    return out


src = sys.argv[1] if len(sys.argv) > 1 else 'assets/source/music/run.mid'
dst = sys.argv[2] if len(sys.argv) > 2 else 'assets/music/run.json'
song = convert(src)

os.makedirs(os.path.dirname(dst), exist_ok=True)
with open(dst, 'w') as fp:
    json.dump(song, fp, separators=(',', ':'))

print(f'{dst}: {song["ms"] / 1000:.1f} с, ' +
      ', '.join(f'{k} {len(song[k])}' for k in ('lead', 'rhythm', 'bass', 'drums')) +
      f', {os.path.getsize(dst) // 1024} КБ')
