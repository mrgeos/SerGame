/* Пиксель-арт, который рисуется кодом.
 *
 * Каждая текстура регистрируется под ключом (см. SG.Art.KEYS).
 * Если в assets/sprites/<ключ>.png положить картинку — загрузчик (boot.js)
 * возьмёт её вместо нарисованной. Логика игры при этом не меняется.
 */
window.SG = window.SG || {};

SG.Art = (function () {
  'use strict';

  var P = {
    out:    '#171223',
    skin:   '#f0bd93', skinD: '#cf9469',
    hair:   '#4a3226', hairD: '#33221a',
    /* Серёга: русый зачёс, очки в тёмной оправе, бородка клинышком */
    hairS:  '#b98a4e', hairSL: '#dcae68', hairSD: '#8a6236',
    beard:  '#96693a', beardD: '#7a5430', lens: '#46648a',
    tee:    '#25222f', teeL:  '#3a3650',
    jean:   '#3b5c9e', jeanD: '#2b4478', jeanL: '#5479c2',
    boot:   '#3c2f28',
    gtr:    '#e33d3d', gtrD:  '#a52a2a', gtrHi: '#ff8a76',
    neck:   '#8a5a34', fret:  '#3b2818', str:   '#efe9dd',
    zSkin:  '#93c46b', zSkinD:'#6d9749',
    suit:   '#4b4864', suitD: '#33314a',
    shirtW: '#e2e6f2', tie:   '#bd3a32',
    paper:  '#f5f0e3', ink:   '#3b3652', inkL: '#8b86a4',
    blue:   '#3d84e0', red:   '#e04b4b', green: '#4fb06a', violet: '#9a5ad0',
    gold:   '#f5c542', goldD: '#c99a1e',
    white:  '#ffffff', cyan:  '#7de8ff',
    cream:  '#fff3e4', pink:  '#f2a8c0', pinkD: '#d3768f',
    cherry: '#e0364f', choco: '#6b4231',
    grey:   '#6f6b84', greyD: '#4a4760', greyL: '#9d99b4',
    plant:  '#3f8f57', plantD:'#2b6b3e',
    wood:   '#7a5330', woodD: '#553719',
    brick:  '#8d5f4d', night: '#2a2440'
  };

  /* ---- микро-хелперы для рисования ------------------------------------ */

  function cv(w, h) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    return { c: c, g: g, w: w, h: h };
  }

  function px(g, x, y, w, h, col) {
    g.fillStyle = col;
    g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  /* Толстая «пиксельная» линия — для грифа гитары, веток и т.п. */
  function line(g, x0, y0, x1, y1, t, col) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    var dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    var sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    var err = dx - dy;
    for (;;) {
      px(g, x0, y0, t, t, col);
      if (x0 === x1 && y0 === y1) break;
      var e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 < dx)  { err += dx; y0 += sy; }
    }
  }

  /* Заливка по строкам: rows = [[y, x, w], ...] — так удобно лепить формы */
  function rows(g, list, col) {
    for (var i = 0; i < list.length; i++) px(g, list[i][1], list[i][0], list[i][2], 1, col);
  }

  function ellipse(g, cx, cy, rx, ry, col) {
    for (var y = -ry; y <= ry; y++) {
      var w = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry))));
      if (w > 0) px(g, cx - w, cy + y, w * 2, 1, col);
    }
  }

  function ring(g, cx, cy, r, t, col) {
    for (var a = 0; a < 360; a += 4) {
      var rad = a * Math.PI / 180;
      px(g, cx + Math.cos(rad) * r, cy + Math.sin(rad) * r, t, t, col);
    }
  }

  /* Автоматическая светотень.
   *
   * Главное, что отличает 16-бит от 8-бит, — не количество пикселей, а объём.
   * Проходим по спрайту и подсвечиваем края, обращённые к свету (вверх-влево),
   * притемняя противоположные. Плоские заливки сразу перестают быть плоскими. */
  function volume(o, opts) {
    opts = opts || {};
    var g = o.g, w = o.w, h = o.h;
    var img = g.getImageData(0, 0, w, h);
    var d = img.data;
    var src = new Uint8ClampedArray(d);
    var lit = opts.light === undefined ? 0.30 : opts.light;
    var dark = opts.dark === undefined ? 0.26 : opts.dark;

    function solid(x, y) {
      if (x < 0 || y < 0 || x >= w || y >= h) return false;
      return src[(y * w + x) * 4 + 3] > 8;
    }

    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        if (!solid(x, y)) continue;
        var k = 0;
        if (!solid(x, y - 1) || !solid(x - 1, y)) k = lit;
        else if (!solid(x, y + 1) || !solid(x + 1, y)) k = -dark;
        if (!k) continue;
        var i = (y * w + x) * 4;
        for (var c = 0; c < 3; c++) {
          var v = src[i + c];
          d[i + c] = k > 0 ? v + (255 - v) * k : v * (1 + k);
        }
      }
    }
    g.putImageData(img, 0, 0);
    return o;
  }

  /* Тёплая контровая подсветка справа — «закатное» солнце сцены */
  function rim(o, col, alpha) {
    var g = o.g, w = o.w, h = o.h;
    var img = g.getImageData(0, 0, w, h);
    var d = img.data;
    var src = new Uint8ClampedArray(d);
    var rgb = [parseInt(col.substr(1, 2), 16), parseInt(col.substr(3, 2), 16),
               parseInt(col.substr(5, 2), 16)];
    var a = alpha === undefined ? 0.5 : alpha;

    function solid(x, y) {
      if (x < 0 || y < 0 || x >= w || y >= h) return false;
      return src[(y * w + x) * 4 + 3] > 8;
    }
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        if (!solid(x, y) || solid(x + 1, y)) continue;
        var i = (y * w + x) * 4;
        for (var c = 0; c < 3; c++) d[i + c] = src[i + c] * (1 - a) + rgb[c] * a;
      }
    }
    g.putImageData(img, 0, 0);
    return o;
  }

  /* Обводка непрозрачных пикселей — придаёт спрайтам «мультяшность» */
  function outline(o, col) {
    var g = o.g, w = o.w, h = o.h;
    var src = g.getImageData(0, 0, w, h);
    var d = src.data;
    var out = cv(w, h);
    out.g.fillStyle = col;
    function solid(x, y) {
      if (x < 0 || y < 0 || x >= w || y >= h) return false;
      return d[(y * w + x) * 4 + 3] > 8;
    }
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        if (solid(x, y)) continue;
        if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) {
          out.g.fillRect(x, y, 1, 1);
        }
      }
    }
    g.globalCompositeOperation = 'destination-over';
    g.drawImage(out.c, 0, 0);
    g.globalCompositeOperation = 'source-over';
    return o;
  }

  /* =====================================================================
   *  СЕРЁГА
   * ===================================================================== */

  /* Гитара: висит на бедре, гриф уходит вправо-вверх.
   * lift = 0 (покой) … 1 (замах на аккорд) */
  /* Гитара висит низко, на бедре — так на груди остаётся место под принт */
  function guitar(g, lift) {
    var bx = 12, by = 23;                    // центр корпуса
    var tipX = 27, tipY = 16 - Math.round(lift * 7);

    // гриф
    line(g, bx + 4, by - 2, tipX, tipY, 3, P.neck);
    line(g, bx + 4, by - 2, tipX, tipY, 1, P.fret);
    // голова грифа
    px(g, tipX - 1, tipY - 1, 5, 5, P.woodD);
    px(g, tipX, tipY, 3, 2, P.gold);

    // корпус (двойной вырез — грубая «суперстратовская» форма)
    ellipse(g, bx, by, 6, 5, P.gtr);
    ellipse(g, bx + 3, by - 2, 4, 3, P.gtr);
    ellipse(g, bx - 3, by + 1, 4, 4, P.gtrD);
    ellipse(g, bx - 1, by - 2, 3, 2, P.gtrHi);
    // струнодержатель + звукосниматели
    px(g, bx + 1, by - 1, 3, 3, P.greyD);
    px(g, bx - 2, by + 2, 4, 2, P.grey);
    // струны
    line(g, bx + 3, by - 2, tipX, tipY, 1, P.str);
  }

  /* ноги: pose — 0..3 бег, 4 — в воздухе, 5 — стоит */
  function legs(g, pose) {
    var J = P.jean, JD = P.jeanD, B = P.boot;
    function leg(x, y, h, bx, by) {
      px(g, x, y, 4, h, J);
      px(g, x, y, 1, h, JD);
      px(g, bx, by, 6, 3, B);
    }
    if (pose === 0)      { leg(16, 25, 5, 16, 30); leg(10, 25, 4, 8, 29); }
    else if (pose === 1) { leg(14, 25, 6, 14, 31); leg(11, 25, 5, 10, 30); }
    else if (pose === 2) { leg(11, 25, 5, 9, 30);  leg(16, 25, 4, 17, 29); }
    else if (pose === 3) { leg(13, 25, 6, 13, 31); leg(15, 25, 4, 15, 29); }
    else if (pose === 4) { // прыжок: колени поджаты
      px(g, 15, 24, 5, 4, J); px(g, 18, 26, 5, 3, J); px(g, 21, 27, 6, 3, B);
      px(g, 10, 25, 4, 5, J); px(g, 8, 28, 6, 3, B);
    } else               { leg(15, 25, 6, 15, 31); leg(11, 25, 6, 11, 31); }
  }

  function hero(pose, opt) {
    opt = opt || {};
    var o = cv(32, 34), g = o.g;
    var lift = opt.lift || 0;
    var bob = (pose === 1 || pose === 3) ? 1 : 0;   // лёгкая раскачка на бегу
    var Y = bob;

    // задняя рука
    px(g, 8, 15 + Y, 3, 7, P.teeL);

    legs(g, pose === 'air' ? 4 : pose);

    // корпус — тёмная футболка
    px(g, 10, 13 + Y, 11, 10, P.tee);
    px(g, 10, 13 + Y, 2, 10, P.teeL);
    // ремень
    px(g, 10, 23 + Y, 11, 2, P.hairD);
    px(g, 14, 23 + Y, 3, 2, P.gold);
    // ремень гитары через плечо
    line(g, 11, 13 + Y, 19, 22 + Y, 2, P.woodD);
    // принт — череп. Рисуем после ремня, иначе он его перечёркивает
    px(g, 13, 13 + Y, 5, 3, P.str);        // черепушка
    px(g, 14, 14 + Y, 1, 2, P.out);        // глазницы
    px(g, 16, 14 + Y, 1, 2, P.out);
    px(g, 14, 16 + Y, 3, 1, P.str);        // челюсть
    px(g, 15, 16 + Y, 1, 1, P.out);        // зубы

    // шея + голова
    px(g, 14, 11 + Y, 4, 3, P.skinD);
    px(g, 10, 4 + Y, 10, 9, P.skin);
    px(g, 10, 4 + Y, 2, 9, P.skinD);
    // волосы: короткие бока и зачёсанный вверх кок
    px(g, 9, 2 + Y, 12, 3, P.hairS);
    px(g, 13, 1 + Y, 8, 2, P.hairS);
    px(g, 15, 1 + Y, 5, 1, P.hairSL);
    px(g, 9, 5 + Y, 2, 2, P.hairSD);
    px(g, 19, 3 + Y, 2, 2, P.hairSD);
    // ухо
    px(g, 12, 8 + Y, 2, 2, P.skinD);
    // очки в тёмной прямоугольной оправе
    px(g, 11, 7 + Y, 2, 1, P.out);          // заушник
    px(g, 13, 6 + Y, 7, 3, P.out);          // оправа
    px(g, 14, 7 + Y, 2, 1, P.lens);
    px(g, 17, 7 + Y, 2, 1, P.lens);
    px(g, 18, 7 + Y, 1, 1, P.white);        // блик на линзе
    // нос
    px(g, 19, 9 + Y, 1, 1, P.skinD);
    // усы и бородка клинышком
    px(g, 13, 10 + Y, 7, 2, P.beard);
    px(g, 15, 12 + Y, 5, 1, P.beard);
    px(g, 16, 11 + Y, 3, 1, P.out);         // рот

    guitar(g, lift);

    // передняя рука — на грифе / у корпуса
    if (lift > 0.5) {
      px(g, 19, 14 + Y, 4, 4, P.skin);       // рука взлетела после боя по струнам
      px(g, 20, 12 + Y, 3, 3, P.skin);
    } else {
      px(g, 18, 18 + Y, 4, 4, P.skin);
      px(g, 20, 15 + Y, 3, 4, P.teeL);
    }

    return outline(o, P.out);
  }

  /* =====================================================================
   *  СЕРЁГА В ВЫСОКОМ РАЗРЕШЕНИИ (64x68)
   *
   *  Тот же силуэт, но вчетверо больше пикселей: детальная гитара,
   *  оправа очков с бликом, складки на футболке, объём и контровой свет.
   *  Мир и хитбоксы не меняются — спрайт просто рисуется в масштабе 1:1.
   * ===================================================================== */

  function legs2(g, pose) {
    function leg(x, y, h, bx, by) {
      x *= 2; y *= 2; h *= 2; bx *= 2; by *= 2;
      px(g, x, y, 8, h, P.jean);
      px(g, x, y, 2, h, P.jeanD);
      px(g, x + 6, y, 2, h, P.jeanL);
      px(g, x, y + Math.floor(h * 0.5), 8, 1, P.jeanD);     // складка под коленом
      px(g, x + 1, y + Math.floor(h * 0.75), 6, 1, P.jeanD);
      px(g, bx, by, 12, 4, P.boot);                          // ботинок
      px(g, bx, by + 4, 12, 2, '#241c18');                   // подошва
      px(g, bx + 2, by + 1, 6, 1, '#54423a');                // блик на носке
    }
    if (pose === 0)      { leg(16, 25, 5, 16, 30); leg(10, 25, 4, 8, 29); }
    else if (pose === 1) { leg(14, 25, 6, 14, 31); leg(11, 25, 5, 10, 30); }
    else if (pose === 2) { leg(11, 25, 5, 9, 30);  leg(16, 25, 4, 17, 29); }
    else if (pose === 3) { leg(13, 25, 6, 13, 31); leg(15, 25, 4, 15, 29); }
    else if (pose === 4) {                                    // прыжок: колени поджаты
      px(g, 30, 48, 10, 8, P.jean);  px(g, 30, 48, 2, 8, P.jeanD);
      px(g, 36, 52, 10, 6, P.jean);
      px(g, 42, 54, 12, 4, P.boot);  px(g, 42, 58, 12, 2, '#241c18');
      px(g, 20, 50, 8, 10, P.jean);  px(g, 20, 50, 2, 10, P.jeanD);
      px(g, 16, 56, 12, 4, P.boot);  px(g, 16, 60, 12, 2, '#241c18');
    } else               { leg(15, 25, 6, 15, 31); leg(11, 25, 6, 11, 31); }
  }

  /* Голова: эллипс, сужающийся к подбородку — прямоугольник при такой
   * плотности пикселей читается как кирпич */
  function headShape(g, cx, cy, rx, ry, col) {
    for (var y = -ry; y <= ry; y++) {
      var k = y / ry;
      var w = rx * Math.sqrt(Math.max(0, 1 - k * k));
      if (y > 0) w *= 1 - 0.28 * k;
      w = Math.floor(w);
      if (w > 0) px(g, cx - w, cy + y, w * 2, 1, col);
    }
  }

  function guitar2(g, lift) {
    var bx = 24, by = 48;                                    // центр корпуса
    var tipX = 55, tipY = 30 - Math.round(lift * 13);

    // гриф с накладкой и ладами
    var nx = bx + 7, ny = by - 3;
    line(g, nx, ny, tipX, tipY, 5, P.neck);
    line(g, nx, ny, tipX, tipY, 3, P.fret);
    for (var f = 1; f < 8; f++) {
      var t = f / 8;
      var fx = Math.round(nx + (tipX - nx) * t);
      var fy = Math.round(ny + (tipY - ny) * t);
      px(g, fx, fy, 1, 3, '#8f7a5c');                        // порожки
      if (f === 3 || f === 5) px(g, fx, fy + 1, 1, 1, P.str);  // точки-ориентиры
    }
    // голова грифа и колки
    px(g, tipX - 1, tipY - 3, 8, 8, P.woodD);
    for (var k = 0; k < 3; k++) {
      px(g, tipX + k * 2, tipY - 5, 1, 2, P.gold);
      px(g, tipX + k * 2, tipY + 5, 1, 2, P.gold);
    }

    // корпус
    ellipse(g, bx, by, 10, 8, P.gtr);
    ellipse(g, bx + 6, by - 4, 6, 5, P.gtr);                 // верхний рог
    ellipse(g, bx - 6, by + 1, 7, 7, P.gtr);
    ellipse(g, bx - 5, by + 3, 5, 5, P.gtrD);                // тень снизу
    ellipse(g, bx - 3, by - 4, 5, 3, P.gtrHi);               // блик лака
    px(g, bx - 5, by - 6, 4, 1, '#ffd6cc');                  // резкий отсвет

    // пикгард, звукосниматели, бридж, ручки
    rows(g, [[by - 3, bx - 7, 11], [by - 1, bx - 8, 13],
             [by + 1, bx - 8, 13], [by + 3, bx - 7, 11]], '#f0ece2');
    px(g, bx - 2, by - 4, 8, 3, '#2b2740');                  // хамбакер у грифа
    px(g, bx - 2, by + 1, 8, 3, '#2b2740');                  // хамбакер у бриджа
    for (var pp = 0; pp < 3; pp++) {
      px(g, bx - 1 + pp * 3, by - 3, 1, 1, P.greyL);
      px(g, bx - 1 + pp * 3, by + 2, 1, 1, P.greyL);
    }
    px(g, bx + 6, by - 1, 3, 5, P.greyD);                    // бридж
    px(g, bx - 6, by + 6, 2, 2, P.greyL);                    // ручки громкости
    px(g, bx - 2, by + 7, 2, 2, P.greyL);

    // струны
    for (var s = 0; s < 3; s++) {
      line(g, bx + 8, by - 3 + s, tipX + 1, tipY - 1 + s, 1, P.str);
    }
  }

  function hero2(pose, opt) {
    opt = opt || {};
    var o = cv(64, 68), g = o.g;
    var lift = opt.lift || 0;
    var Y = (pose === 1 || pose === 3) ? 2 : 0;

    /* строки со смещением на «покачивание» при беге */
    function R(list, col) {
      for (var i = 0; i < list.length; i++) {
        px(g, list[i][1], list[i][0] + Y, list[i][2], 1, col);
      }
    }
    function B(x, y, w, h, col) { px(g, x, y + Y, w, h, col); }

    // задняя рука
    B(17, 30, 7, 15, P.tee);

    legs2(g, pose === 'air' ? 4 : pose);

    // корпус: плечи шире, талия уже
    R([[26, 21, 23], [27, 20, 25], [28, 20, 25], [29, 20, 25], [30, 20, 25],
       [31, 20, 25], [32, 20, 25], [33, 20, 25], [34, 20, 25], [35, 21, 23],
       [36, 21, 23], [37, 21, 23], [38, 21, 23], [39, 22, 21], [40, 22, 21],
       [41, 22, 21], [42, 22, 21], [43, 23, 19], [44, 23, 19], [45, 23, 19]], P.tee);
    B(23, 38, 12, 1, '#1b1926');                             // складки ткани
    B(25, 42, 13, 1, '#1b1926');
    B(21, 30, 3, 6, P.teeL);
    // ремень гитары — уводим левее принта, чтобы не перечёркивал череп
    line(g, 22, 26 + Y, 27, 46 + Y, 4, P.woodD);
    line(g, 23, 26 + Y, 28, 46 + Y, 1, '#9a6a40');
    // ремень
    R([[46, 23, 19], [47, 23, 19], [48, 23, 19], [49, 23, 19]], P.hairD);
    B(23, 46, 19, 1, '#5c4433');
    B(30, 46, 6, 4, P.gold);
    B(31, 47, 4, 2, P.goldD);

    // принт-череп
    R([[29, 29, 8], [30, 28, 10], [31, 28, 10], [32, 28, 10],
       [33, 28, 10], [34, 29, 8], [36, 30, 6], [37, 30, 6]], P.str);
    B(30, 30, 3, 3, P.out);                                  // глазницы
    B(34, 30, 3, 3, P.out);
    B(32, 33, 2, 2, P.out);                                  // нос черепа
    B(32, 36, 1, 2, P.out);                                  // зубы
    B(34, 36, 1, 2, P.out);

    // шея
    B(29, 21, 8, 6, P.skinD);

    // голова: тёмный контур-подложка, светлая маска сверху
    headShape(g, 32, 14 + Y, 9, 10, P.skinD);
    headShape(g, 33, 14 + Y, 8, 9, P.skin);
    B(37, 11, 3, 8, '#ffd2a8');                              // засвеченная щека

    // волосы: шапка по черепу, кок сметён вверх-вправо, бока короткие
    R([[2, 28, 10], [3, 26, 14], [4, 25, 16], [5, 24, 18],
       [6, 23, 19], [7, 23, 19]], P.hairS);
    R([[0, 33, 9], [1, 31, 12]], P.hairS);                   // кок
    R([[0, 35, 6], [1, 34, 7]], P.hairSL);                   // блик на коке
    R([[8, 23, 5], [9, 23, 4], [10, 23, 4], [11, 23, 3], [12, 24, 3]], P.hairSD);
    R([[8, 38, 4], [9, 39, 3], [10, 39, 3]], P.hairSD);
    line(g, 29, 6 + Y, 36, 1 + Y, 1, P.hairSL);              // одна прядь по зачёсу

    // уши
    B(22, 15, 3, 5, P.skinD);
    B(40, 15, 3, 5, P.skinD);

    // очки
    B(21, 15, 5, 2, P.out);                                  // заушник
    B(25, 12, 8, 7, P.out);                                  // левая оправа
    B(35, 12, 8, 7, P.out);                                  // правая оправа
    B(33, 13, 2, 2, P.out);                                  // переносица
    B(26, 13, 6, 5, P.lens);
    B(36, 13, 6, 5, P.lens);
    line(g, 37, 17 + Y, 41, 13 + Y, 1, '#cfe6ff');           // блик
    line(g, 27, 17 + Y, 30, 14 + Y, 1, '#9dbde0');
    B(39, 15, 2, 2, '#22304a');                              // зрачок

    // нос
    B(32, 17, 3, 2, P.skinD);
    B(33, 17, 1, 1, '#ffd2a8');

    // усы, рот, бородка клинышком (щёки почти выбриты — как на фото)
    B(26, 17, 2, 6, P.beard);                                // тонкая связка от бакенбарда
    B(38, 17, 2, 6, P.beard);
    R([[19, 29, 8], [20, 28, 10]], P.beard);                 // усы
    B(31, 21, 5, 2, '#6b3236');                              // рот
    R([[22, 29, 8], [23, 28, 10], [24, 28, 10],
       [25, 29, 8], [26, 30, 6], [27, 31, 4]], P.beard);
    R([[22, 29, 8]], P.beardD);
    B(30, 23, 3, 3, '#b0834c');                              // блик на бороде

    guitar2(g, lift);

    // передняя рука
    if (lift > 0.5) {
      B(42, 26, 8, 8, P.tee);
      B(46, 19, 7, 9, P.skin);
      B(46, 19, 2, 9, P.skinD);
    } else {
      B(42, 28, 7, 10, P.tee);
      B(44, 37, 7, 8, P.skin);
      B(44, 37, 2, 8, P.skinD);
    }

    if (opt.raw) return o;                       // без пост-обработки — для hero3
    volume(o, { light: 0.26, dark: 0.24 });
    rim(o, '#ffbe7a', 0.4);
    return outline(o, P.out);
  }

  /* =====================================================================
   *  СЕРЁГА, МЕЛКАЯ ПРОРАБОТКА (128x136)
   *
   *  Базовая фигура берётся из hero2 и растягивается вдвое без сглаживания —
   *  так пропорции и все кадры гарантированно совпадают. Поверх дорисованы
   *  детали, которые в сетке 64 просто не помещались: зрачки за линзами,
   *  брови, ноздря, отдельные пряди и волоски бороды, шесть струн, лады,
   *  пальцы, шнуровка на ботинках, швы на джинсах.
   * ===================================================================== */

  function hero3(pose, opt) {
    opt = opt || {};
    var lift = opt.lift || 0;
    var base = hero2(pose, opt.raw === undefined ? { lift: lift, raw: true } : opt);

    var o = cv(128, 136), g = o.g;
    g.imageSmoothingEnabled = false;
    g.drawImage(base.c, 0, 0, 128, 136);

    var Y = ((pose === 1 || pose === 3) ? 2 : 0) * 2;
    function d(x, y, w, h, col) { px(g, x, y + Y, w, h, col); }

    // --- лицо -----------------------------------------------------------
    d(52, 19, 11, 2, P.hairSD);                    // брови над оправой
    d(73, 19, 11, 2, P.hairSD);
    d(55, 29, 4, 5, '#22304a');                    // зрачки за линзами
    d(76, 29, 4, 5, '#22304a');
    d(56, 30, 1, 1, P.white);                      // блики в глазах
    d(77, 30, 1, 1, P.white);
    line(g, 74, 34 + Y, 82, 26 + Y, 1, '#dbeeff');  // блик на стекле
    line(g, 54, 34 + Y, 60, 28 + Y, 1, '#9dbde0');
    d(52, 24, 16, 1, '#3a3550');                   // верхняя грань оправы
    d(72, 24, 16, 1, '#3a3550');
    d(65, 37, 2, 1, '#a8724f');                    // ноздря
    d(68, 34, 2, 3, '#ffd2a8');                    // блик на носу
    d(78, 33, 4, 7, '#ffd2a8');                    // скула
    d(63, 42, 8, 1, '#8a4a4a');                    // верхняя губа

    // борода: несколько неровных пятен вместо равномерной гребёнки —
    // регулярный частокол на удвоенной основе читается как рябь
    d(58, 45, 3, 5, '#b0834c');
    d(64, 47, 2, 4, '#a87a44');
    d(69, 44, 3, 6, '#b0834c');
    d(62, 39, 4, 2, '#a87a44');                    // блик на усах
    d(60, 52, 8, 1, P.beardD);                     // кончик клина

    // волосы: широкая полоса засвета по зачёсу и пара неровных прядей
    line(g, 56, 12 + Y, 74, 2 + Y, 3, P.hairSL);
    line(g, 50, 17 + Y, 64, 7 + Y, 2, P.hairSL);
    line(g, 47, 20 + Y, 53, 13 + Y, 2, P.hairSD);
    line(g, 76, 10 + Y, 82, 16 + Y, 2, P.hairSD);

    // --- футболка -------------------------------------------------------
    d(56, 52, 16, 3, P.teeL);                      // ворот
    d(58, 53, 12, 1, '#1b1926');
    d(44, 62, 16, 1, '#1b1926');                   // складки
    d(48, 70, 20, 1, '#1b1926');
    d(46, 84, 14, 1, '#1b1926');
    d(43, 58, 2, 22, P.teeL);                      // засвет по краю

    // --- гитара ---------------------------------------------------------
    // Гриф со струнами и ладами уже нарисован в базе — здесь только то,
    // что в сетке 64 не помещалось: точки-ориентиры и мелкая фурнитура.
    d(88, 74, 2, 2, P.str);
    d(98, 68, 2, 2, P.str);
    d(38, 108, 3, 3, P.greyL);                     // ручки громкости
    d(39, 108, 1, 1, P.white);
    d(46, 110, 3, 3, P.greyL);
    d(47, 110, 1, 1, P.white);
    d(30, 100, 3, 3, P.greyD);                     // джек
    d(56, 88, 3, 2, P.gold);                       // штифт ремня

    // --- руки, ноги -----------------------------------------------------
    if (lift > 0.5) {
      d(95, 43, 1, 11, '#c98f60');                 // разделение пальцев
      d(100, 42, 1, 11, '#c98f60');
    } else {
      d(91, 79, 1, 11, '#c98f60');
      d(96, 78, 1, 12, '#c98f60');
    }

    volume(o, { light: 0.22, dark: 0.2 });
    rim(o, '#ffbe7a', 0.38);
    return outline(o, P.out);
  }

  function heroHurt() {
    var o = hero3(5, {});
    var g = o.g;
    g.globalCompositeOperation = 'source-atop';
    px(g, 0, 0, o.w, o.h, 'rgba(255,90,90,0.55)');
    g.globalCompositeOperation = 'source-over';
    return o;
  }

  /* =====================================================================
   *  ЗОМБИ-КЛИЕНТ
   * ===================================================================== */

  function zombie(frame) {
    var o = cv(33, 34), g = o.g;
    var s = frame ? 1 : 0;

    // ноги
    px(g, 10 + s, 25, 5, 6, P.suitD);
    px(g, 16 - s, 25, 5, 6, P.suitD);
    px(g, 9 + s, 31, 7, 3, P.out);
    px(g, 15 - s, 31, 7, 3, P.out);

    // пиджак
    px(g, 8, 13, 15, 13, P.suit);
    px(g, 8, 13, 2, 13, P.suitD);
    px(g, 13, 13, 5, 12, P.shirtW);        // рубашка
    px(g, 14, 14, 3, 9, P.tie);            // галстук
    px(g, 14, 22, 3, 2, P.tie);
    px(g, 9, 17, 3, 4, P.white);           // бейдж
    px(g, 9, 17, 3, 1, P.blue);

    // руки вперёд (классическая зомби-поза)
    px(g, 22, 15 - s, 7, 4, P.suit);
    px(g, 28, 15 - s, 3, 4, P.zSkin);
    px(g, 22, 20 + s, 6, 4, P.suit);
    px(g, 27, 20 + s, 3, 4, P.zSkin);

    // голова
    px(g, 10, 4, 11, 10, P.zSkin);
    px(g, 10, 4, 2, 10, P.zSkinD);
    px(g, 10, 3, 11, 2, P.hairD);          // остатки причёски
    px(g, 20, 5, 1, 4, P.zSkinD);
    // пустые глаза
    px(g, 13, 7, 2, 3, P.white);
    px(g, 17, 7, 2, 3, P.white);
    px(g, 13, 8, 1, 1, P.out);
    px(g, 17, 8, 1, 1, P.out);
    // рот
    px(g, 14, 11, 5, 2, P.out);
    px(g, 15, 11, 1, 1, P.white);
    px(g, 17, 11, 1, 1, P.white);
    // гарнитура
    line(g, 10, 5, 20, 4, 1, P.greyD);
    px(g, 9, 6, 3, 3, P.greyD);
    line(g, 11, 9, 14, 11, 1, P.greyD);

    return outline(o, P.out);
  }

  /* =====================================================================
   *  БОСС
   * ===================================================================== */

  function boss(state) {
    var o = cv(56, 62), g = o.g;
    var up = (state === 'windup');
    var sw = (state === 'swing');

    // ноги
    px(g, 18, 46, 8, 12, P.suitD);
    px(g, 30, 46, 8, 12, P.suitD);
    px(g, 16, 57, 11, 5, P.out);
    px(g, 29, 57, 11, 5, P.out);

    // корпус — широкий пиджак
    px(g, 12, 22, 32, 26, P.suit);
    px(g, 12, 22, 4, 26, P.suitD);
    px(g, 40, 22, 4, 26, P.suitD);
    px(g, 24, 22, 8, 24, P.shirtW);
    px(g, 26, 24, 4, 18, P.tie);
    px(g, 26, 41, 4, 4, P.tie);
    // бейдж на шнурке
    line(g, 22, 24, 20, 32, 1, P.greyD);
    px(g, 17, 32, 7, 6, P.white);
    px(g, 17, 32, 7, 2, P.red);

    // руки
    if (up || sw) {
      var ay = up ? 10 : 26;
      px(g, 42, ay, 12, 7, P.suit);
      px(g, 52, ay - 1, 5, 6, P.zSkin);
      px(g, 6, ay + 4, 10, 7, P.suit);
      px(g, 2, ay + 3, 6, 6, P.zSkin);
    } else {
      px(g, 42, 26, 12, 6, P.suit);
      px(g, 52, 25, 5, 6, P.zSkin);
      px(g, 6, 28, 10, 6, P.suit);
      px(g, 2, 27, 6, 6, P.zSkin);
      // свиток со спринт-планом
      px(g, 0, 24, 4, 16, P.paper);
      px(g, 0, 27, 4, 1, P.inkL);
      px(g, 0, 31, 4, 1, P.inkL);
      px(g, 0, 35, 4, 1, P.inkL);
    }

    // голова
    px(g, 18, 4, 20, 18, P.zSkin);
    px(g, 18, 4, 4, 18, P.zSkinD);
    px(g, 17, 2, 22, 4, P.hairD);
    px(g, 16, 6, 2, 8, P.hairD);
    // глаза
    var eye = (up || sw) ? P.red : P.white;
    px(g, 23, 10, 4, 5, eye);
    px(g, 31, 10, 4, 5, eye);
    px(g, 24, 12, 2, 2, P.out);
    px(g, 32, 12, 2, 2, P.out);
    // рот
    px(g, 24, 18, 10, 3, P.out);
    for (var t = 0; t < 4; t++) px(g, 25 + t * 2, 18, 1, 2, P.white);
    // гарнитура
    line(g, 18, 7, 38, 6, 2, P.greyD);
    px(g, 15, 9, 5, 6, P.greyD);
    line(g, 18, 15, 24, 19, 2, P.greyD);
    px(g, 23, 18, 3, 3, P.red);

    if (state === 'hurt') {
      g.globalCompositeOperation = 'source-atop';
      px(g, 0, 0, o.w, o.h, 'rgba(255,255,255,0.7)');
      g.globalCompositeOperation = 'source-over';
    }
    return outline(o, P.out);
  }

  /* =====================================================================
   *  ТАСКИ, БОНУСЫ, ЭФФЕКТЫ
   * ===================================================================== */

  function card(col, flying) {
    var w = flying ? 42 : 34, h = 26;
    var o = cv(w, h), g = o.g;
    var x0 = flying ? 4 : 0;

    if (flying) {   // крылья у «срочной» задачи
      px(g, 0, 8, 5, 3, P.white);
      px(g, 1, 11, 4, 2, P.greyL);
      px(g, 37, 8, 5, 3, P.white);
      px(g, 37, 11, 4, 2, P.greyL);
    }

    px(g, x0, 0, 34, 26, P.paper);
    px(g, x0, 0, 34, 6, col);              // шапка тикета
    px(g, x0 + 2, 2, 3, 2, P.white);
    // «текст» тикета
    px(g, x0 + 3, 10, 22, 2, P.ink);
    px(g, x0 + 3, 14, 26, 2, P.inkL);
    px(g, x0 + 3, 18, 16, 2, P.inkL);
    // аватар исполнителя
    px(g, x0 + 26, 17, 5, 5, col);
    px(g, x0 + 27, 18, 3, 1, P.paper);
    return outline(o, P.out);
  }

  function pick() {   // медиатор = жизнь
    var o = cv(18, 18), g = o.g;
    rows(g, [[3, 5, 8], [4, 4, 10], [5, 3, 12], [6, 3, 12], [7, 3, 12],
             [8, 4, 10], [9, 4, 10], [10, 5, 8], [11, 6, 6], [12, 7, 4], [13, 8, 2]], P.gold);
    rows(g, [[4, 5, 4], [5, 4, 4], [6, 4, 3]], P.white);
    rows(g, [[9, 9, 5], [10, 9, 4], [11, 9, 3]], P.goldD);
    return outline(o, P.out);
  }

  function coffee() {  // кофе = режим «шред»
    var o = cv(18, 20), g = o.g;
    px(g, 3, 6, 11, 11, P.white);
    px(g, 3, 6, 11, 3, P.red);
    px(g, 4, 9, 9, 6, P.choco);
    px(g, 14, 9, 3, 5, P.white);
    px(g, 15, 10, 1, 3, P.greyL);
    px(g, 5, 1, 2, 4, P.greyL);
    px(g, 9, 0, 2, 5, P.greyL);
    return outline(o, P.out);
  }

  function slash() {   // взмах по струнам
    var o = cv(46, 70), g = o.g;
    for (var i = 0; i < 3; i++) {
      var col = i === 0 ? P.white : (i === 1 ? P.cyan : '#3aa6d8');
      for (var a = -62; a <= 62; a += 2) {
        var r = 30 - i * 5;
        var rad = a * Math.PI / 180;
        px(g, 6 + Math.cos(rad) * r, 35 + Math.sin(rad) * r, 4 - i, 4 - i, col);
      }
    }
    return o;
  }

  function wave() {    // звуковая волна по боссу
    var o = cv(28, 40), g = o.g;
    ring(g, 6, 20, 12, 3, P.cyan);
    ring(g, 2, 20, 16, 2, P.white);
    px(g, 10, 18, 8, 4, P.white);
    return o;
  }

  function note() {
    var o = cv(12, 14), g = o.g;
    ellipse(g, 4, 10, 4, 3, P.white);
    px(g, 7, 1, 2, 9, P.white);
    px(g, 9, 1, 3, 3, P.white);
    return o;
  }

  function spark(col) {
    var o = cv(6, 6), g = o.g;
    px(g, 1, 1, 4, 4, col);
    px(g, 2, 0, 2, 6, col);
    px(g, 0, 2, 6, 2, col);
    return o;
  }

  /* =====================================================================
   *  ПОДГОНЫ ОТ ГЕОСА
   * ===================================================================== */

  /* Купол шапки-дурилки: цветные дольки по радиусу */
  function capDome(g, cx, cy, rx, ry) {
    var cols = ['#e04b4b', '#f5c542', '#4fb06a', '#3d84e0'];
    for (var y = cy - ry; y <= cy; y++) {
      var k = (y - cy) / ry;
      var hw = Math.floor(rx * Math.sqrt(Math.max(0, 1 - k * k)));
      if (hw <= 0) continue;
      for (var x = cx - hw; x <= cx + hw; x++) {
        var t = (x - (cx - hw)) / Math.max(1, 2 * hw);
        px(g, x, y, 1, 1, cols[Math.min(3, Math.floor(t * 4))]);
      }
    }
  }

  function hatCap(withProp) {
    var o = cv(26, 20), g = o.g;
    capDome(g, 12, 13, 9, 8);
    px(g, 2, 13, 21, 3, P.tee);          // околыш
    px(g, 15, 13, 9, 2, P.red);          // козырёк
    px(g, 11, 4, 3, 2, P.white);         // кнопка сверху
    px(g, 12, 1, 1, 4, P.greyL);         // штырь под пропеллер
    if (withProp) {
      px(g, 3, 1, 8, 2, P.str);
      px(g, 14, 1, 8, 2, P.str);
      px(g, 11, 0, 3, 4, P.greyL);
    }
    return outline(o, P.out);
  }

  function propeller() {
    var o = cv(22, 6), g = o.g;
    px(g, 0, 2, 9, 2, P.str);
    px(g, 13, 2, 9, 2, P.str);
    px(g, 1, 1, 4, 1, P.white);
    px(g, 17, 3, 4, 1, P.greyL);
    px(g, 9, 1, 4, 4, P.greyL);
    return outline(o, P.out);
  }

  function dragonHead() {   // иконка подгона
    var o = cv(22, 22), g = o.g;
    ellipse(g, 11, 12, 8, 7, P.plant);
    px(g, 15, 10, 7, 5, P.plant);        // морда
    px(g, 17, 14, 5, 2, P.cherry);       // пасть
    px(g, 6, 3, 3, 5, P.gold);           // рог
    px(g, 12, 3, 3, 5, P.gold);
    px(g, 15, 9, 3, 3, P.gold);          // глаз
    px(g, 16, 10, 1, 1, P.out);
    px(g, 3, 10, 5, 8, P.plantD);        // грива
    return outline(o, P.out);
  }

  function dragon() {
    var o = cv(80, 50), g = o.g;

    // хвост: сужается к наконечнику
    line(g, 24, 32, 14, 25, 5, P.plantD);
    line(g, 14, 25, 7, 19, 3, P.plantD);
    rows(g, [[17, 2, 6], [18, 1, 7], [19, 1, 7], [20, 2, 6], [21, 3, 4]], P.gold);

    // тело
    ellipse(g, 32, 30, 17, 10, P.plant);
    ellipse(g, 32, 33, 13, 6, P.gold);        // брюхо

    // крыло
    rows(g, [[4, 34, 12], [6, 30, 18], [8, 27, 22], [10, 25, 25], [12, 24, 27],
             [14, 24, 27], [16, 25, 25], [18, 27, 21]], P.plantD);
    rows(g, [[8, 30, 14], [10, 29, 17], [12, 28, 19], [14, 29, 17]], P.plant);
    line(g, 30, 20, 48, 6, 1, P.woodD);
    line(g, 32, 21, 40, 5, 1, P.woodD);

    // шея и голова
    line(g, 44, 26, 58, 16, 7, P.plant);
    px(g, 55, 10, 16, 11, P.plant);
    px(g, 55, 10, 4, 11, P.plantD);
    px(g, 68, 14, 10, 5, P.plant);            // морда
    px(g, 68, 19, 11, 4, P.cherry);           // раскрытая пасть
    for (var t = 0; t < 4; t++) px(g, 69 + t * 3, 19, 2, 2, P.white);
    px(g, 64, 13, 4, 4, P.gold);              // глаз
    px(g, 65, 14, 2, 2, P.out);
    px(g, 58, 3, 4, 8, P.gold);               // рога
    px(g, 65, 4, 4, 7, P.gold);
    // гребень по шее
    for (var s = 0; s < 4; s++) px(g, 46 + s * 3, 22 - s * 3, 3, 4, P.gold);

    // лапы
    px(g, 26, 38, 6, 8, P.plantD);
    px(g, 38, 38, 6, 8, P.plantD);
    px(g, 24, 44, 9, 3, P.gold);
    px(g, 36, 44, 9, 3, P.gold);

    return outline(o, P.out);
  }

  function flame() {
    var o = cv(16, 16), g = o.g;
    ellipse(g, 8, 9, 7, 6, '#e0642a');
    ellipse(g, 8, 9, 5, 4, P.gold);
    ellipse(g, 8, 8, 3, 3, '#fff3b0');
    px(g, 7, 1, 3, 4, '#e0642a');
    return o;
  }

  /* Аватарка Геоса: тёмные волосы назад, густая борода, косуха */
  function geos() {
    var o = cv(22, 24), g = o.g;
    var hairG = '#3a2a20', beardG = '#4a3226', leather = '#1c1822', leatherL = '#332d3d';

    // косуха с воротником
    px(g, 2, 19, 18, 5, leather);
    px(g, 2, 19, 18, 1, leatherL);
    px(g, 6, 19, 4, 4, leatherL);        // отворот
    px(g, 12, 19, 4, 4, leatherL);
    px(g, 9, 18, 4, 3, P.skinD);         // шея

    // лицо
    ellipse(g, 11, 10, 7, 8, P.skin);
    px(g, 4, 8, 2, 5, P.skinD);

    // волосы: короткие бока, зачёсаны наверх
    rows(g, [[1, 6, 10], [2, 4, 14], [3, 3, 16], [4, 3, 16]], hairG);
    px(g, 3, 5, 2, 5, hairG);
    px(g, 17, 5, 2, 5, hairG);
    px(g, 9, 0, 6, 2, hairG);

    // борода: скулы, усы и подбородок одним куском
    rows(g, [[12, 4, 14], [13, 4, 14], [14, 4, 14], [15, 5, 12],
             [16, 6, 10], [17, 7, 8]], beardG);
    px(g, 4, 8, 2, 5, beardG);           // бакенбарды
    px(g, 17, 8, 2, 5, beardG);

    // брови, глаза, нос, рот
    px(g, 6, 7, 4, 1, hairG);
    px(g, 12, 7, 4, 1, hairG);
    px(g, 7, 9, 2, 2, P.out);
    px(g, 13, 9, 2, 2, P.out);
    px(g, 7, 9, 1, 1, P.white);
    px(g, 13, 9, 1, 1, P.white);
    px(g, 10, 11, 2, 1, P.skinD);
    px(g, 9, 14, 5, 1, '#7a4a48');       // губы в бороде

    return outline(o, P.out);
  }

  /* =====================================================================
   *  ВЫХОДЫ С УРОВНЕЙ
   *
   *  Каждая зона кончается своим выходом: офис — лифтом, улица — метро,
   *  двор — подъездом. Створки лифта и подъезда вынесены в отдельные
   *  спрайты: игра разъезжает их масштабом по X, прижимая к косякам,
   *  поэтому створка рисуется закрытой и без обводки — она примыкает
   *  к порталу вплотную.
   * ===================================================================== */

  function gateElevator() {
    var o = cv(60, 56), g = o.g;
    var wall = '#3a3556', jamb = '#6b6784', jambD = '#4a4760';

    px(g, 0, 4, 60, 52, wall);                   // кусок офисной стены
    px(g, 0, 4, 60, 2, '#4a4568');

    px(g, 4, 8, 52, 48, jamb);                   // портал
    px(g, 4, 8, 52, 2, '#8b87a4');
    px(g, 4, 8, 2, 48, '#8b87a4');
    px(g, 54, 8, 2, 48, jambD);

    px(g, 8, 12, 44, 44, '#14111f');             // шахта
    px(g, 12, 18, 36, 24, '#1c1830');            // задняя стенка кабины
    px(g, 12, 18, 36, 1, '#2c2647');
    px(g, 10, 46, 40, 10, '#221d33');            // пол кабины
    px(g, 22, 14, 16, 2, '#ffe9a8');             // плафон

    px(g, 20, 0, 20, 8, P.out);                  // табло этажей
    px(g, 22, 2, 16, 4, '#1d2a1d');
    rows(g, [[3, 27, 7], [4, 28, 5], [5, 29, 3]], '#7ef08a');   // стрелка вниз

    px(g, 56, 26, 4, 9, jambD);                  // кнопка вызова
    px(g, 57, 28, 2, 2, P.gold);
    px(g, 57, 31, 2, 2, P.greyL);
    return outline(o, P.out);
  }

  function elevLeaf() {
    var o = cv(22, 44), g = o.g;
    px(g, 0, 0, 22, 44, '#8a8698');              // шлифованный металл
    for (var i = 0; i < 22; i += 3) px(g, i, 0, 1, 44, i % 6 ? '#7a768c' : '#9c98ab');
    px(g, 0, 0, 22, 2, '#b0acbe');
    px(g, 0, 42, 22, 2, '#5f5b72');
    px(g, 0, 0, 1, 44, '#5f5b72');               // стык — по обоим краям,
    px(g, 21, 0, 1, 44, '#5f5b72');              // створки одинаковые
    return o;
  }

  function gateMetro() {
    var o = cv(70, 60), g = o.g;
    var stone = '#5a5470', stoneD = '#443f5a', glass = '#3d5a78';

    px(g, 6, 16, 58, 44, stone);                 // павильон
    px(g, 6, 16, 58, 2, '#6d6786');
    px(g, 6, 16, 3, 44, '#6d6786');
    px(g, 61, 16, 3, 44, stoneD);
    px(g, 2, 12, 66, 6, stoneD);                 // карниз
    px(g, 2, 12, 66, 2, '#6d6786');

    for (var i = 0; i < 3; i++) {                // витражи по бокам
      px(g, 12, 24 + i * 9, 12, 8, glass);
      px(g, 46, 24 + i * 9, 12, 8, glass);
      px(g, 13, 25 + i * 9, 4, 2, '#7fb0d0');
      px(g, 47, 25 + i * 9, 4, 2, '#7fb0d0');
    }

    ellipse(g, 35, 30, 11, 9, '#14111f');        // арка входа
    px(g, 24, 30, 22, 30, '#14111f');
    for (var s = 0; s < 4; s++) {                // ступени вниз
      px(g, 26 + s, 44 + s * 4, 18 - s * 2, 2, '#2a2440');
    }
    px(g, 23, 38, 2, 22, P.greyL);               // поручни
    px(g, 45, 38, 2, 22, P.greyL);
    px(g, 30, 20, 10, 3, '#ffe9a8');             // лампа над входом

    ellipse(g, 35, 5, 9, 6, P.red);              // буква М в круге
    ellipse(g, 35, 4, 7, 4, '#f05a4a');
    px(g, 31, 1, 2, 9, P.white);
    px(g, 37, 1, 2, 9, P.white);
    px(g, 33, 2, 1, 3, P.white);
    px(g, 34, 5, 2, 2, P.white);
    px(g, 36, 2, 1, 3, P.white);
    return outline(o, P.out);
  }

  /* Дом Серёги: кусок панельки в несколько этажей с подъездом справа.
   * Раскладка повторяет генерацию, которой этот спрайт подменяют, — от неё
   * зависит, куда игра поставит створки (см. GATE_DOOR в game.js):
   * центр проёма на 0.77 ширины, сам проём 0.142, порог на 0.015 от низа. */
  function gatePorch() {
    var o = cv(140, 174), g = o.g;
    var wall = '#cfc9c0', wallD = '#a9a49c', band = '#b8603c', bandD = '#93472c';
    var trim = '#e6e1d8', glass = '#46586e', glassL = '#6d8199', dark = '#2a2433';

    px(g, 0, 0, 140, 174, wall);

    // этажи: оранжевый простенок, белый пояс, лента окон
    for (var f = 0; f < 5; f++) {
      var y = f * 27;
      px(g, 0, y + 1, 140, 9, band);
      px(g, 0, y + 1, 140, 1, '#c9714a');
      px(g, 0, y + 9, 140, 1, bandD);
      px(g, 0, y + 11, 140, 3, trim);
      px(g, 0, y + 14, 140, 11, glass);
      px(g, 0, y + 14, 140, 1, dark);
      for (var w = 0; w < 14; w++) {                 // переплёты
        px(g, 4 + w * 10, y + 14, 1, 11, trim);
        px(g, 6 + w * 10, y + 16, 4, 3, glassL);
      }
      px(g, 0, y + 25, 140, 2, wallD);
      // белые пилястры через простенок — панелька собрана из плит
      for (var c = 0; c < 5; c++) px(g, 4 + c * 32, y + 1, 6, 10, trim);
    }

    // козырёк подъезда и тамбур
    px(g, 88, 134, 44, 5, '#3b3540');
    px(g, 88, 139, 44, 2, '#2b2630');
    px(g, 88, 141, 8, 33, band);                     // пилоны
    px(g, 124, 141, 8, 33, band);
    px(g, 88, 141, 2, 33, '#c9714a');
    px(g, 130, 141, 2, 33, bandD);
    px(g, 96, 141, 28, 33, '#3a2c2a');               // ниша
    px(g, 96, 141, 28, 3, '#2a2028');
    px(g, 106, 143, 4, 2, '#ffe9a8');                // плафон
    px(g, 98, 148, 20, 23, '#14111f');               // проём
    px(g, 133, 152, 5, 9, '#4a4658');                // домофон
    px(g, 134, 153, 3, 4, '#2b4056');

    // цоколь: порог двери стоит на нём, а не на самой земле
    px(g, 0, 171, 140, 3, '#4a4550');
    px(g, 0, 171, 140, 1, '#5d5866');

    return outline(o, P.out);
  }

  function porchLeaf() {
    var o = cv(18, 44), g = o.g;
    var door = '#3c5a48', doorD = '#2b4234', doorL = '#4e7059';
    px(g, 0, 0, 18, 44, door);
    px(g, 0, 0, 18, 2, doorL);
    px(g, 0, 0, 1, 44, doorD);
    px(g, 17, 0, 1, 44, doorD);
    px(g, 2, 4, 14, 12, '#2b4056');              // стеклянная вставка в решётке
    for (var i = 0; i < 3; i++) px(g, 2 + i * 5, 4, 1, 12, doorD);
    px(g, 2, 4, 14, 1, doorD);
    px(g, 3, 6, 4, 3, '#7fb0d0');
    px(g, 2, 20, 14, 20, doorD);                 // филёнка
    px(g, 3, 21, 12, 18, door);
    px(g, 13, 26, 3, 6, P.greyL);                // ручка
    return o;
  }

  /* =====================================================================
   *  ФИНАЛЬНАЯ СЦЕНА
   * ===================================================================== */

  function cake() {
    var o = cv(52, 46), g = o.g;
    px(g, 2, 40, 48, 4, P.greyL);          // блюдо
    px(g, 6, 26, 40, 14, P.choco);         // нижний ярус
    px(g, 6, 26, 40, 4, P.cream);
    px(g, 12, 14, 28, 12, P.pink);         // верхний ярус
    px(g, 12, 14, 28, 4, P.cream);
    for (var i = 0; i < 5; i++) px(g, 9 + i * 8, 30, 4, 3, P.cream);
    // свечи
    for (var c = 0; c < 3; c++) {
      var x = 18 + c * 8;
      px(g, x, 6, 3, 9, P.white);
      px(g, x, 6, 1, 9, P.pinkD);
      px(g, x, 2, 3, 4, P.gold);
      px(g, x, 0, 3, 3, '#ffd98a');
    }
    px(g, 24, 10, 4, 4, P.cherry);
    return outline(o, P.out);
  }

  /* Таня: тёмные волосы, собранные в пучок наверху, светлый верх, джинсы */
  function wife() {
    var o = cv(28, 34), g = o.g;
    var top = '#e9edf5', topD = '#ccd3e3', topB = '#a8cfe8', jean = '#2c3550';

    // ноги и обувь
    px(g, 9, 27, 4, 5, jean);  px(g, 15, 27, 4, 5, jean);
    px(g, 9, 27, 1, 5, P.out); px(g, 15, 27, 1, 5, P.out);
    px(g, 8, 31, 6, 3, P.out); px(g, 14, 31, 6, 3, P.out);

    // кофта
    px(g, 7, 17, 14, 11, top);
    px(g, 7, 17, 3, 11, topD);
    px(g, 9, 20, 2, 2, topB);          // голубой узор
    px(g, 13, 23, 2, 2, topB);
    px(g, 17, 19, 2, 2, topB);
    px(g, 11, 25, 2, 2, topB);
    // руки
    px(g, 4, 18, 3, 8, top);   px(g, 21, 18, 3, 8, top);
    px(g, 4, 18, 1, 8, topD);
    px(g, 4, 26, 3, 3, P.skin); px(g, 21, 26, 3, 3, P.skin);

    // шея и цепочка
    px(g, 12, 15, 4, 3, P.skinD);
    px(g, 11, 17, 6, 1, P.gold);

    // голова
    px(g, 9, 6, 10, 10, P.skin);
    px(g, 9, 6, 2, 10, P.skinD);
    // волосы: чёлка зачёсана назад, пучок наверху
    px(g, 8, 4, 12, 3, P.hair);
    px(g, 8, 6, 2, 7, P.hair);
    px(g, 18, 6, 2, 7, P.hair);
    ellipse(g, 15, 2, 4, 3, P.hair);
    px(g, 13, 4, 5, 1, P.hairD);       // резинка
    // серёжки
    px(g, 8, 12, 1, 1, P.gold); px(g, 19, 12, 1, 1, P.gold);
    // брови и глаза держим на разных строках, иначе сливаются в маску
    px(g, 11, 9, 3, 1, P.hairD);  px(g, 15, 9, 3, 1, P.hairD);
    px(g, 11, 11, 2, 2, P.out);   px(g, 16, 11, 2, 2, P.out);
    px(g, 14, 13, 1, 1, P.skinD);
    px(g, 13, 14, 3, 1, P.pinkD);

    return outline(o, P.out);
  }

  /* Майя, 2 года: большая голова, светлый пушок, платье в цветочек,
   * одна рука тянется вперёд — как на фото */
  function daughter() {
    var o = cv(22, 25), g = o.g;
    var hairB = '#ecd9b0', hairBL = '#f7ecd2';
    var dress = '#f7f0e2', dressD = '#e0d5c0';

    // ноги и башмачки
    px(g, 7, 20, 3, 3, P.skin); px(g, 12, 20, 3, 3, P.skin);
    px(g, 6, 22, 5, 3, P.pinkD); px(g, 11, 22, 5, 3, P.pinkD);

    // платье-разлетайка
    rows(g, [[13, 6, 10], [14, 5, 12], [15, 5, 12], [16, 4, 14],
             [17, 4, 14], [18, 3, 16], [19, 3, 16]], dress);
    rows(g, [[16, 4, 3], [17, 4, 3], [18, 3, 3], [19, 3, 3]], dressD);
    // цветочки
    px(g, 7, 15, 2, 2, P.pink);  px(g, 12, 14, 2, 2, '#d05a6a');
    px(g, 5, 18, 2, 2, '#d05a6a'); px(g, 14, 17, 2, 2, P.pink);
    px(g, 10, 18, 2, 2, '#8fae7a');

    // ручки: одна тянется вперёд, вторая вдоль тела
    px(g, 16, 11, 4, 3, P.skin);
    px(g, 19, 9, 3, 3, P.skin);
    px(g, 1, 14, 3, 5, P.skin);

    // голова
    ellipse(g, 11, 8, 7, 7, P.skin);
    px(g, 4, 6, 2, 5, P.skinD);
    px(g, 3, 8, 1, 3, P.skinD); px(g, 18, 8, 1, 3, P.skinD);   // ушки
    // редкий светлый пушок
    rows(g, [[1, 7, 8], [2, 5, 12], [3, 4, 14]], hairB);
    px(g, 8, 0, 3, 2, hairBL); px(g, 12, 1, 2, 1, hairBL);
    // большие глаза
    px(g, 7, 7, 2, 3, P.out);  px(g, 13, 7, 2, 3, P.out);
    px(g, 7, 7, 1, 1, P.white); px(g, 13, 7, 1, 1, P.white);
    // румянец
    px(g, 5, 10, 2, 2, '#f0a0a0'); px(g, 15, 10, 2, 2, '#f0a0a0');
    // улыбка с двумя нижними зубками
    px(g, 8, 11, 6, 3, '#8a3a4a');
    px(g, 9, 13, 2, 1, P.white); px(g, 12, 13, 1, 1, P.white);
    px(g, 10, 9, 1, 1, P.skinD);       // носик

    return outline(o, P.out);
  }

  /* =====================================================================
   *  ФОНЫ (тайлятся по горизонтали)
   * ===================================================================== */

  function skyTex(top, bottom) {
    var o = cv(8, 360), g = o.g;
    var grad = g.createLinearGradient(0, 0, 0, 360);
    grad.addColorStop(0, top);
    grad.addColorStop(1, bottom);
    g.fillStyle = grad;
    g.fillRect(0, 0, 8, 360);
    return o;
  }

  /* Пол/земля между дальним планом и уровнем, по которому бежит Серёга.
   * Без неё под фоном зияет дыра до полосы земли. */
  function floorBand(g, fromY, col, edge) {
    px(g, 0, fromY, 240, 220 - fromY, col);
    px(g, 0, fromY, 240, 2, edge);
    for (var i = 0; i < 240; i += 8) {
      px(g, i, fromY + 4 + (i % 24) / 8, 4, 1, edge);
    }
  }

  function bgOffice(layer) {
    var o = cv(240, 220), g = o.g;
    if (layer === 0) {
      px(g, 0, 0, 240, 220, '#2a2740');
      for (var i = 0; i < 4; i++) {           // окна с вечерним городом
        var x = 12 + i * 60;
        px(g, x, 24, 44, 70, '#4a4670');
        px(g, x + 2, 26, 40, 66, '#7a6ea8');
        px(g, x + 2, 70, 40, 22, '#3b3560');
        for (var w = 0; w < 6; w++) px(g, x + 4 + w * 6, 74 + (w % 3) * 5, 3, 4, P.gold);
      }
      px(g, 0, 100, 240, 6, '#3b3760');
    } else {
      floorBand(g, 150, '#3f3856', '#4d4568');
      // рабочие места: стол, монитор, кресло, растение
      for (var d = 0; d < 2; d++) {
        var bx = d * 120;
        px(g, bx + 10, 120, 70, 6, P.wood);        // столешница
        px(g, bx + 14, 126, 5, 34, P.woodD);
        px(g, bx + 71, 126, 5, 34, P.woodD);
        px(g, bx + 28, 92, 34, 24, P.greyD);       // монитор
        px(g, bx + 31, 95, 28, 18, '#4f9ad8');
        px(g, bx + 33, 98, 14, 3, P.white);
        px(g, bx + 33, 103, 20, 2, 'rgba(255,255,255,.5)');
        px(g, bx + 42, 116, 6, 4, P.greyD);
        px(g, bx + 86, 128, 6, 32, P.greyD);       // кресло
        px(g, bx + 78, 104, 22, 26, '#3f5c6d');
        px(g, bx + 76, 152, 22, 4, P.greyD);
        px(g, bx + 104, 138, 12, 22, P.brick);     // фикус
        ellipse(g, bx + 110, 126, 14, 13, P.plantD);
        ellipse(g, bx + 108, 122, 10, 9, P.plant);
      }
    }
    return o;
  }

  function bgStreet(layer) {
    var o = cv(240, 220), g = o.g;
    if (layer === 0) {
      for (var i = 0; i < 6; i++) {
        var w = 30 + (i % 3) * 14, h = 90 + ((i * 37) % 70);
        var x = i * 40;
        px(g, x, 220 - h, w, h, i % 2 ? '#3a3358' : '#332e4e');
        for (var r = 0; r < 8; r++)
          for (var c = 0; c < 3; c++)
            if ((i + r + c) % 3) px(g, x + 5 + c * 9, 226 - h + r * 11, 5, 6, (r + c) % 4 ? '#f3c869' : '#5a5480');
      }
    } else {
      floorBand(g, 152, '#332f46', '#43405c');
      px(g, 0, 150, 240, 8, '#4b4768');           // бордюр
      for (var l = 0; l < 2; l++) {               // фонари
        var lx = 30 + l * 130;
        px(g, lx, 60, 5, 92, P.greyD);
        px(g, lx - 8, 56, 21, 6, P.greyD);
        px(g, lx - 6, 62, 17, 5, '#ffe9a8');
      }
      // припаркованная машина
      px(g, 120, 118, 62, 20, '#c4483f');
      px(g, 132, 104, 38, 16, '#c4483f');
      px(g, 136, 107, 30, 11, '#8fd0e8');
      px(g, 118, 132, 66, 8, '#8f382f');
      ellipse(g, 134, 140, 9, 9, P.out); ellipse(g, 170, 140, 9, 9, P.out);
      ellipse(g, 134, 140, 4, 4, P.greyL); ellipse(g, 170, 140, 4, 4, P.greyL);
      px(g, 60, 128, 14, 24, P.plantD);           // куст
      ellipse(g, 67, 122, 18, 15, P.plant);
    }
    return o;
  }

  function bgYard(layer) {
    var o = cv(240, 220), g = o.g;
    if (layer === 0) {
      for (var i = 0; i < 3; i++) {               // панельки
        var x = i * 84, h = 130 + (i % 2) * 24;
        px(g, x, 220 - h, 76, h, i % 2 ? '#4a4468' : '#413b5e');
        px(g, x, 220 - h, 76, 5, '#5b5480');
        for (var r = 0; r < 9; r++)
          for (var c = 0; c < 5; c++)
            px(g, x + 5 + c * 14, 226 - h + r * 13, 9, 8, ((i + r + c) % 3) ? '#2f2a4a' : '#ffd583');
      }
    } else {
      floorBand(g, 154, '#3a3450', '#474063');
      // дерево
      px(g, 26, 110, 10, 46, P.woodD);
      line(g, 31, 118, 18, 104, 3, P.woodD);
      line(g, 31, 118, 44, 102, 3, P.woodD);
      ellipse(g, 30, 96, 30, 22, P.plantD);
      ellipse(g, 24, 90, 20, 15, P.plant);
      ellipse(g, 42, 94, 16, 12, P.plant);
      // лавочка
      px(g, 110, 132, 52, 6, P.wood);
      px(g, 110, 116, 52, 5, P.wood);
      px(g, 112, 138, 5, 18, P.greyD);
      px(g, 155, 138, 5, 18, P.greyD);
      // качели
      px(g, 190, 96, 4, 60, P.greyD);
      px(g, 226, 96, 4, 60, P.greyD);
      px(g, 188, 94, 44, 4, P.greyD);
      px(g, 200, 98, 2, 26, P.greyL);
      px(g, 216, 98, 2, 26, P.greyL);
      px(g, 198, 124, 22, 4, P.red);
    }
    return o;
  }

  function bgHome(layer) {
    var o = cv(240, 220), g = o.g;
    if (layer === 0) {
      px(g, 0, 20, 240, 200, '#4a4468');
      px(g, 0, 20, 240, 6, '#5b5480');
      for (var r = 0; r < 8; r++)
        for (var c = 0; c < 8; c++)
          px(g, 8 + c * 29, 34 + r * 22, 18, 14, ((r + c) % 3) ? '#2f2a4a' : '#ffd583');
    } else {
      floorBand(g, 156, '#413a58', '#4e4668');
      px(g, 90, 96, 62, 60, P.brick);             // подъезд
      px(g, 96, 104, 50, 52, '#3a2c46');
      px(g, 100, 108, 20, 46, '#6b4231');
      px(g, 122, 108, 20, 46, '#6b4231');
      px(g, 118, 128, 3, 6, P.gold);
      px(g, 84, 88, 74, 10, P.greyD);
      px(g, 108, 90, 26, 7, '#ffe9a8');
    }
    return o;
  }

  function groundTex(zone) {
    var o = cv(96, 64), g = o.g;
    if (zone === 0) {                              // ковролин
      px(g, 0, 0, 96, 64, '#4a4260');
      px(g, 0, 0, 96, 3, '#5d5478');
      for (var i = 0; i < 96; i += 6) px(g, i, 6 + (i % 12), 3, 2, '#3f3854');
    } else if (zone === 1) {                       // асфальт
      px(g, 0, 0, 96, 64, '#39354c');
      px(g, 0, 0, 96, 3, '#4c4763');
      px(g, 10, 12, 34, 4, '#c9c3a8');
      for (var j = 0; j < 20; j++) px(g, (j * 17) % 92, 20 + (j * 13) % 40, 3, 2, '#2e2a40');
    } else if (zone === 2) {                       // плитка во дворе
      px(g, 0, 0, 96, 64, '#4d4356');
      px(g, 0, 0, 96, 3, '#61566d');
      for (var y = 4; y < 64; y += 14)
        for (var x = ((y / 14) | 0) % 2 ? 0 : 10; x < 96; x += 22)
          px(g, x, y, 20, 12, '#443b4e');
    } else {                                       // дорожка к дому
      px(g, 0, 0, 96, 64, '#54495c');
      px(g, 0, 0, 96, 3, '#6a5d73');
      for (var k = 0; k < 96; k += 16) px(g, k + 2, 8, 12, 46, '#4a4053');
    }
    return o;
  }

  /* =====================================================================
   *  Регистрация
   * ===================================================================== */

  var BUILDERS = {
    hero_run0:   function () { return hero3(0); },
    hero_run1:   function () { return hero3(1); },
    hero_run2:   function () { return hero3(2); },
    hero_run3:   function () { return hero3(3); },
    hero_air:    function () { return hero3('air'); },
    hero_idle:   function () { return hero3(5); },
    hero_atk0:   function () { return hero3(5, { lift: 1 }); },
    hero_atk1:   function () { return hero3(4, { lift: 0.4 }); },
    hero_hurt:   heroHurt,

    zombie0:     function () { return zombie(0); },
    zombie1:     function () { return zombie(1); },
    // Запасной код-арт для четырёх кадров и удара: рисованных поз всего две,
    // поэтому 2/3 повторяют 0/1, а удар — вспышка поверх.
    zombie2:     function () { return zombie(0); },
    zombie3:     function () { return zombie(1); },
    zombie_hit:  function () {
      var o = zombie(1), g = o.g;
      g.globalCompositeOperation = 'source-atop';
      px(g, 0, 0, o.w, o.h, 'rgba(255,255,255,0.65)');
      g.globalCompositeOperation = 'source-over';
      return o;
    },

    boss_idle:   function () { return boss('idle'); },
    boss_windup: function () { return boss('windup'); },
    boss_swing:  function () { return boss('swing'); },
    boss_hurt:   function () { return boss('hurt'); },

    card_blue:   function () { return card(P.blue); },
    card_red:    function () { return card(P.red); },
    card_green:  function () { return card(P.green); },
    card_violet: function () { return card(P.violet); },
    card_fly:    function () { return card(P.red, true); },

    pick_life:   pick,
    pick_coffee: coffee,

    pick_hat:    function () { return hatCap(true); },
    hat_worn:    function () { return hatCap(false); },
    hat_prop:    propeller,
    pick_dragon: dragonHead,
    dragon:      dragon,
    fx_flame:    flame,
    geos:        geos,

    gate_elevator:   gateElevator,
    gate_elev_leaf:  elevLeaf,
    gate_metro:      gateMetro,
    gate_porch:      gatePorch,
    gate_porch_leaf: porchLeaf,

    fx_slash:    slash,
    fx_wave:     wave,
    fx_note:     note,
    fx_spark:    function () { return spark(P.gold); },
    fx_sparkc:   function () { return spark(P.cyan); },

    cake:        cake,
    wife:        wife,
    daughter:    daughter,

    sky0:        function () { return skyTex('#2b2545', '#54406b'); },
    sky1:        function () { return skyTex('#3d3060', '#e08a5c'); },
    sky2:        function () { return skyTex('#2f2a55', '#7a5a8c'); },
    sky3:        function () { return skyTex('#1e1a38', '#463a68'); },

    bg0_far:     function () { return bgOffice(0); },
    bg0_near:    function () { return bgOffice(1); },
    bg1_far:     function () { return bgStreet(0); },
    bg1_near:    function () { return bgStreet(1); },
    bg2_far:     function () { return bgYard(0); },
    bg2_near:    function () { return bgYard(1); },
    bg3_far:     function () { return bgHome(0); },
    bg3_near:    function () { return bgHome(1); },

    ground0:     function () { return groundTex(0); },
    ground1:     function () { return groundTex(1); },
    ground2:     function () { return groundTex(2); },
    ground3:     function () { return groundTex(3); }
  };

  /* Во сколько раз растягивать нарисованный кодом спрайт. По умолчанию
   * это SG.VIEW.SCALE; тут — исключения.
   *
   * Серёга нарисован в новом разрешении, поэтому выводится 1:1 (0.5 от
   * двукратного растяжения). Выходы с уровней, наоборот, растягиваются
   * сильнее: дверь должна быть заметно выше человека. Створка тянется
   * ровно так же, как её портал, — на этом держится ширина проёма. */
  var HI = {
    hero_run0: 0.5, hero_run1: 0.5, hero_run2: 0.5, hero_run3: 0.5,
    hero_air: 0.5, hero_idle: 0.5, hero_atk0: 0.5, hero_atk1: 0.5, hero_hurt: 0.5,

    gate_elevator: 2.4, gate_elev_leaf: 2.4,
    gate_metro: 2.3,
    /* Подъезд — не дверь, а весь дом Серёги: он шире прочих выходов и
     * заведомо выше кадра, верхние этажи срезаются обрезом экрана. Так и
     * задумано. Створке масштаб не нужен: игра подгоняет её под проём. */
    gate_porch: 3
  };

  /* Эталонные размеры: сколько спрайт занимает на экране в игровых точках.
   * Заполняется при отрисовке кода-арта и не зависит от того, какой
   * картинкой его потом подменят. */
  var DESIGN = {};

  return {
    P: P,
    HI: HI,
    DESIGN: DESIGN,
    KEYS: Object.keys(BUILDERS),

    /* Во сколько раз растягивать нарисованный кодом спрайт */
    scaleFor: function (key) {
      return HI[key] !== undefined ? HI[key] : SG.VIEW.SCALE;
    },

    /* Рисует всё, чего ещё нет в кэше текстур, и запоминает эталонные размеры */
    build: function (scene) {
      SG.Art.KEYS.forEach(function (key) {
        if (scene.textures.exists(key)) return;
        var o = BUILDERS[key]();
        scene.textures.addCanvas(key, o.c);
        var s = HI[key] !== undefined ? HI[key] : SG.VIEW.SCALE;
        DESIGN[key] = { w: o.w, h: o.h, dw: o.w * s, dh: o.h * s };
      });
    },

    /* Подгоняет спрайт под эталонный размер независимо от разрешения
     * картинки. Благодаря этому вместо кода-арта можно положить PNG
     * любого размера — хоть 1024px, он встанет на своё место. */
    fit: function (obj, key, mul) {
      var d = DESIGN[key];
      if (!d) return obj;
      var img = obj.texture && obj.texture.getSourceImage
        ? obj.texture.getSourceImage() : null;
      var w = (img && img.width) ? img.width : d.w;
      obj.setScale((d.dw / w) * (mul === undefined ? 1 : mul));
      return obj;
    }
  };
})();
