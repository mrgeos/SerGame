/* Комикс перед забегом: девять кадров, листаются кнопкой.
 *
 * Сценарий и реплики — в SG.CFG.comic, картинки в assets/comic/. Кадра
 * может не оказаться (папку не заполнили) — тогда сцена просто пропускает
 * его, а если нет ни одного, сразу отдаёт управление игре. Так игра
 * остаётся играбельной, даже когда комикса ещё нет.
 */
window.SG = window.SG || {};

SG.ComicScene = new Phaser.Class({
  Extends: Phaser.Scene,
  initialize: function ComicScene() { Phaser.Scene.call(this, { key: 'Comic' }); },

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

    this.add.rectangle(0, 0, W, H, 0x0d0a16).setOrigin(0).setDepth(0);
    this.page = 0;
    this.done = false;
    this.shown = [];

    this.skipBtn = SG.txt(this, W - 12, 12, C.skip, 12, '#8b86a4',
      { originX: 1, originY: 0, strokeThickness: 3 }).setDepth(40);
    this.skipBtn.setInteractive({ useHandCursor: true });
    this.skipBtn.on('pointerdown', function (p, lx, ly, ev) {
      if (ev) ev.stopPropagation();
      self.finish();
    });

    this.showPage();
  },

  /* Кадр вписывается в экран целиком: пропорции у картинок могут быть
   * любые, и обрезать сюжет нельзя. Пустое место по краям — фон сцены. */
  showPage: function () {
    var self = this, C = SG.CFG.comic;
    var f = this.frames[this.page];

    this.shown.forEach(function (o) { o.destroy(); });
    this.shown = [];

    var img = this.add.image(this.W / 2, this.H / 2, f.key).setDepth(1);
    var src = this.textures.get(f.key).getSourceImage();
    var k = Math.min(this.W / src.width, (this.H - 40) / src.height);
    img.setScale(k);
    this.shown.push(img);

    var fw = src.width * k, fh = src.height * k;
    var fx = this.W / 2 - fw / 2, fy = this.H / 2 - fh / 2;

    if (f.data.caption) {
      this.shown.push(this.captionBox(f.data.caption, fx + 10, fy + 8, fw - 20));
    }
    (f.data.lines || []).forEach(function (l) {
      self.shown.push(self.speechBox(l, fx + fw * l.x, fy + fh * l.y, fw));
    });

    var last = this.page === this.frames.length - 1;
    this.shown.push(this.pageButton(last ? C.start : C.next, last));

    // счётчик страниц, чтобы было видно, сколько ещё листать
    this.shown.push(SG.txt(this, 12, this.H - 14,
      (this.page + 1) + ' / ' + this.frames.length, 11, '#8b86a4',
      { originX: 0, originY: 1, strokeThickness: 3 }).setDepth(40));

    this.shown.forEach(function (o) { o.setAlpha(0); });
    this.tweens.add({ targets: this.shown, alpha: 1, duration: 220 });
  },

  /* Подпись-врезка: без хвостика, во всю ширину кадра */
  captionBox: function (text, x, y, wrap) {
    var t = SG.txt(this, 0, 0, text, 13, '#171223',
      { originX: 0, originY: 0, strokeThickness: 0, align: 'left', wrap: wrap - 20 });
    var w = t.width + 18, h = t.height + 12;

    var g = this.add.graphics();
    g.fillStyle(0xf2e9d8, 1);
    g.fillRoundedRect(0, 0, w, h, 5);
    g.lineStyle(1, 0x171223, 0.4);
    g.strokeRoundedRect(0, 0, w, h, 5);
    t.setPosition(9, 6);

    var box = this.add.container(x, y).setDepth(20);
    box.add([g, t]);
    return box;
  },

  /* Реплика в такой же плашке, как в игре: комикс и забег должны читаться
   * одним набором. Плашка держится в границах кадра — реплика у самого
   * края иначе уезжала бы за картинку. */
  speechBox: function (line, x, y, fw) {
    var t = SG.txt(this, 0, 0, line.text, 13, '#171223',
      { originX: 0.5, originY: 0.5, strokeThickness: 0, align: 'center',
        wrap: Math.min(fw * 0.44, 240) });
    var w = t.width + 20, h = t.height + 14;
    var tail = (line.tail === undefined ? 0 : line.tail) * (w / 2 - 8);

    var g = this.add.graphics();
    g.fillStyle(0xf2e9d8, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 7);
    g.fillTriangle(tail - 6, h / 2 - 1, tail + 6, h / 2 - 1, tail - 2, h / 2 + 10);
    g.lineStyle(1, 0x171223, 0.4);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, 7);

    var box = this.add.container(
      Phaser.Math.Clamp(x, w / 2 + 6, this.W - w / 2 - 6),
      Phaser.Math.Clamp(y, h / 2 + 6, this.H - h / 2 - 16)).setDepth(20);
    box.add([g, t]);
    return box;
  },

  /* Кнопка листания. Нажатие ловится по всему экрану, кроме «пропустить». */
  pageButton: function (label, last) {
    var self = this;
    var t = SG.txt(this, 0, 0, label, 15, '#f5c542');
    var bw = Math.max(130, t.width + 44), bh = 32;

    var g = this.add.graphics();
    g.fillStyle(0x171223, 0.92);
    g.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, 8);
    g.lineStyle(2, 0xf5c542, 1);
    g.strokeRoundedRect(-bw / 2, -bh / 2, bw, bh, 8);

    var btn = this.add.container(this.W - bw / 2 - 14, this.H - bh / 2 - 10).setDepth(40);
    btn.add([g, t]);
    if (last) {
      this.tweens.add({ targets: btn, alpha: 0.4, duration: 620, yoyo: true, repeat: -1, delay: 300 });
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
