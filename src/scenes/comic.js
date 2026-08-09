/* Комикс перед забегом: девять кадров, листаются кнопкой.
 *
 * Кадры приходят с прозрачным фоном (зелёнка снята, см. tools/comic_frames.py),
 * а страницу под ними рисует сцена. Благодаря этому кадр не обязан совпадать
 * с пропорциями экрана: на iPhone SE2 он ложится ровно (там тоже 16:9), а на
 * широких телефонах страница просто продолжается по бокам.
 *
 * Кадра может не оказаться (папку не заполнили) — тогда сцена его пропускает,
 * а если нет ни одного, сразу отдаёт управление игре. Так игра остаётся
 * играбельной, даже когда комикса ещё нет.
 */
window.SG = window.SG || {};

SG.ComicScene = new Phaser.Class({
  Extends: Phaser.Scene,
  initialize: function ComicScene() { Phaser.Scene.call(this, { key: 'Comic' }); },

  /* Страница светлая: на кадрах 6 и 8 реплики врисованы чёрным, и на тёмном
   * фоне они пропадали. Заодно всё вместе читается как страница комикса. */
  PAGE: 0xd8efaf,
  BAR: 34,                    // нижняя полоса под кнопки, чтобы не лезли на рисунок

  create: function () {
    SG.setupCamera(this);
    var self = this, C = SG.CFG.comic, W = SG.VIEW.W, H = SG.VIEW.H;

    this.W = W; this.H = H;
    this.frames = [];
    for (var i = 0; i < C.frames.length; i++) {
      if (this.textures.exists('comic' + (i + 1))) {
        this.frames.push({ key: 'comic' + (i + 1), data: C.frames[i] });
      }
    }
    if (!this.frames.length) { this.scene.start('Game'); return; }

    this.add.rectangle(0, 0, W, H, this.PAGE).setOrigin(0).setDepth(0);
    this.add.rectangle(0, H - this.BAR, W, 1, 0x171223, 0.25).setOrigin(0).setDepth(38);

    this.page = 0;
    this.done = false;
    this.shown = [];

    this.skipBtn = SG.txt(this, 14, H - this.BAR / 2, C.skip, 12, '#6b6480',
      { originX: 0, originY: 0.5, strokeThickness: 0 }).setDepth(40);
    this.skipBtn.setInteractive({ useHandCursor: true });
    this.skipBtn.on('pointerdown', function (p, lx, ly, ev) {
      if (ev) ev.stopPropagation();
      self.finish();
    });
    this.counter = SG.txt(this, W / 2, H - this.BAR / 2, '', 12, '#8b86a4',
      { strokeThickness: 0 }).setDepth(40);

    this.showPage();
  },

  showPage: function () {
    var self = this, C = SG.CFG.comic;
    var f = this.frames[this.page];

    this.shown.forEach(function (o) { o.destroy(); });
    this.shown = [];

    // кадр вписывается по высоте в область над полосой и центрируется:
    // сюжет обрезать нельзя, а по бокам продолжается страница
    var src = this.textures.get(f.key).getSourceImage();
    var area = this.H - this.BAR;
    var k = Math.min(this.W / src.width, area / src.height);
    var fw = src.width * k, fh = src.height * k;
    var fx = (this.W - fw) / 2, fy = (area - fh) / 2;

    this.shown.push(this.add.image(fx + fw / 2, fy + fh / 2, f.key).setScale(k).setDepth(1));

    if (f.data.caption) {
      this.shown.push(this.captionBox(f.data.caption, fx + 12, fy + 10, fw - 24));
    }
    (f.data.lines || []).forEach(function (l, i) {
      var box = self.speechBox(l, fx + fw * l.x, fy + fh * l.y, fw);
      box.appearDelay = 90 + i * 240;      // реплики проступают по очереди
      self.shown.push(box);
    });

    var last = this.page === this.frames.length - 1;
    this.shown.push(this.pageButton(last ? C.start : C.next, last));
    this.counter.setText((this.page + 1) + ' / ' + this.frames.length);

    this.shown.forEach(function (o) {
      o.setAlpha(0);
      self.tweens.add({ targets: o, alpha: 1, duration: 220, delay: o.appearDelay || 0 });
    });
  },

  /* Подпись-врезка: без хвостика, прижата к верхнему углу кадра */
  captionBox: function (text, x, y, wrap) {
    var t = SG.txt(this, 0, 0, text, 12, '#171223',
      { originX: 0, originY: 0, strokeThickness: 0, align: 'left', wrap: wrap - 20 });
    var w = t.width + 18, h = t.height + 12;

    var g = this.add.graphics();
    g.fillStyle(0xfffaf0, 1);
    g.fillRoundedRect(0, 0, w, h, 4);
    g.lineStyle(2, 0x171223, 1);
    g.strokeRoundedRect(0, 0, w, h, 4);
    t.setPosition(9, 6);

    var box = this.add.container(x, y).setDepth(20);
    box.add([g, t]);
    return box;
  },

  /* Реплика в такой же плашке, как в игре, — только обводка сплошная:
   * страница сама светлая, и без контура пузырь на ней растворяется.
   *
   * x/y — доли от размера кадра. up: true разворачивает хвостик вверх,
   * когда пузырь стоит ниже говорящего. */
  speechBox: function (line, x, y, fw) {
    var t = SG.txt(this, 0, 0, line.text, 12, '#171223',
      { originX: 0.5, originY: 0.5, strokeThickness: 0, align: 'center',
        wrap: Math.min(fw * (line.wrap || 0.36), 230) });
    var w = t.width + 18, h = t.height + 12;
    var tail = (line.tail || 0) * (w / 2 - 8);
    var dy = line.up ? -(h / 2 - 1) : (h / 2 - 1);
    var tip = line.up ? dy - 10 : dy + 10;

    var g = this.add.graphics();
    g.fillStyle(0xfffaf0, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 7);
    g.fillTriangle(tail - 6, dy, tail + 6, dy, tail - 2, tip);
    g.lineStyle(2, 0x171223, 1);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, 7);

    var box = this.add.container(
      Phaser.Math.Clamp(x, w / 2 + 6, this.W - w / 2 - 6),
      Phaser.Math.Clamp(y, h / 2 + 12, this.H - this.BAR - h / 2 - 12)).setDepth(20);
    box.add([g, t]);
    return box;
  },

  /* Кнопка листания в нижней полосе. Нажатие ловится по всему экрану:
   * попадать пальцем в кнопку на телефоне неудобно. */
  pageButton: function (label, last) {
    var self = this;
    var t = SG.txt(this, 0, 0, label, 13, '#f5c542');
    var bw = Math.max(110, t.width + 34), bh = 24;

    var g = this.add.graphics();
    g.fillStyle(0x171223, 1);
    g.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, 6);
    g.lineStyle(2, 0xf5c542, 1);
    g.strokeRoundedRect(-bw / 2, -bh / 2, bw, bh, 6);

    var btn = this.add.container(this.W - bw / 2 - 12, this.H - this.BAR / 2).setDepth(40);
    btn.add([g, t]);
    if (last) {
      this.tweens.add({ targets: btn, alpha: 0.45, duration: 620, yoyo: true,
        repeat: -1, delay: 400 });
    }

    var kb = this.input.keyboard;
    var press = function () {
      self.input.off('pointerdown', press);
      kb.off('keydown-SPACE', press);
      kb.off('keydown-ENTER', press);
      SG.Audio.sfx('select');
      self.turnPage();
    };
    // небольшая задержка, чтобы тот же тап не пролистнул сразу две страницы
    this.time.delayedCall(120, function () {
      self.input.on('pointerdown', press);
      kb.on('keydown-SPACE', press);
      kb.on('keydown-ENTER', press);
    });
    return btn;
  },

  turnPage: function () {
    if (this.done) return;
    if (this.page >= this.frames.length - 1) { this.finish(); return; }
    this.page++;
    this.showPage();
  },

  /* Один тап по «пропустить» доходит и до обработчика листания, поэтому
   * уход из сцены прикрыт флагом: иначе второй обработчик дёрнул бы
   * перелистывание уже на закрытой сцене. */
  finish: function () {
    if (this.done) return;
    this.done = true;
    this.input.removeAllListeners();
    this.input.keyboard.removeAllListeners();
    this.scene.start('Game');
  }
});
