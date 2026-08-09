/* Титульный экран.
 *
 * Обычно это постер (assets/title.jpg) во весь экран: заголовок на нём уже
 * нарисован, поэтому своего текста поверх минимум — управление, счёт и
 * «тап — поехали». Постер вписывается целиком, по краям остаётся тёмный
 * фон: обрезать его нельзя, в нижних углах кружка и дракон.
 *
 * Постера может не оказаться — тогда рисуется прежняя заставка из код-арта
 * с бегущим Серёгой. Так игра остаётся с титульником в любом случае.
 */
window.SG = window.SG || {};

SG.MenuScene = new Phaser.Class({
  Extends: Phaser.Scene,
  initialize: function MenuScene() { Phaser.Scene.call(this, { key: 'Menu' }); },

  create: function () {
    SG.setupCamera(this);
    var W = SG.VIEW.W, H = SG.VIEW.H;

    this.add.rectangle(0, 0, W, H, 0x12101c).setOrigin(0).setDepth(-1);

    if (this.textures.exists('title')) this.poster();
    else this.retroBg();

    this.overlay();
    this.makeMuteButton();

    var self = this;
    var go = function (p) {
      if (p && self.hitMute(p)) return;      // не стартуем по кнопке звука
      SG.Audio.init();
      SG.Audio.sfx('select');
      // комикс сам отдаст управление игре — и если кадров нет, сделает
      // это сразу, так что игра остаётся играбельной без картинок
      self.scene.start(SG.CFG.comic.enabled ? 'Comic' : 'Game');
    };
    var key = function () { go(null); };
    this.input.on('pointerdown', go);
    this.input.keyboard.on('keydown-SPACE', key);
    this.input.keyboard.on('keydown-ENTER', key);
  },

  /* ---- постер ---------------------------------------------------------- */

  poster: function () {
    var W = SG.VIEW.W, H = SG.VIEW.H;
    var src = this.textures.get('title').getSourceImage();
    var k = Math.min(W / src.width, H / src.height);

    this.fw = src.width * k;
    this.fh = src.height * k;

    // Картинка с огоньками живёт в контейнере и дышит целиком; текст лежит
    // отдельно и не шевелится — иначе читать неудобно.
    var box = this.add.container(W / 2, H / 2);
    box.add(this.add.image(0, 0, 'title').setScale(k));

    var fire = this.local(0.818, 0.902);
    var glow = this.add.circle(fire.x, fire.y, this.fh * 0.055, 0xffa32a, 0.32)
      .setBlendMode(Phaser.BlendModes.ADD);
    box.add(glow);
    this.tweens.add({ targets: glow, alpha: 0.1, scale: 0.72, duration: 190,
      yoyo: true, repeat: -1, ease: 'Sine.inOut' });

    for (var i = 0; i < 5; i++) {                 // искры от огня
      var s = this.add.circle(fire.x, fire.y, this.fh * 0.005, 0xffd166, 0.9);
      box.add(s);
      this.tweens.add({
        targets: s, y: fire.y - this.fh * (0.10 + i * 0.02),
        x: fire.x - this.fh * (0.02 + i * 0.012), alpha: 0,
        duration: 1100 + i * 260, delay: i * 220, repeat: -1, ease: 'Sine.out'
      });
    }

    // Дыхание: от чуть уменьшенного к точно вписанному — так постер
    // оживает, но за край всё равно не выходит и ничего не срезает.
    box.setScale(0.965);
    this.tweens.add({ targets: box, scale: 1, duration: 9000, yoyo: true,
      repeat: -1, ease: 'Sine.inOut' });
  },

  /* доля кадра → координата внутри контейнера постера */
  local: function (fx, fy) {
    return { x: (fx - 0.5) * this.fw, y: (fy - 0.5) * this.fh };
  },

  /* доля кадра → координата на экране */
  onScreen: function (fx, fy) {
    var p = this.local(fx, fy);
    return { x: SG.VIEW.W / 2 + p.x, y: SG.VIEW.H / 2 + p.y };
  },

  /* ---- надписи поверх --------------------------------------------------- */

  /* Всё садится на асфальт в середине низа: слева кружка, справа дракон,
   * закрывать их нельзя. Доли кадра, а не экрана, — чтобы на широком
   * телефоне текст не уехал с асфальта на чёрные поля. */
  overlay: function () {
    var W = SG.VIEW.W, H = SG.VIEW.H;
    var cx = W / 2;
    var rows = this.fh
      ? { hint: this.onScreen(0.5, 0.806).y, sub: this.onScreen(0.5, 0.851).y,
          tap: this.onScreen(0.5, 0.902).y, best: this.onScreen(0.5, 0.957).y }
      : { hint: H - 62, sub: H - 46, tap: 188, best: 136 };

    SG.txt(this, cx - 12, rows.hint, '◀ ЛЕВАЯ — ПРЫЖОК', 13, '#8de0ff',
      { originX: 1, strokeThickness: 4 });
    SG.txt(this, cx + 12, rows.hint, 'ПРАВАЯ — АККОРД ▶', 13, '#ffb3a6',
      { originX: 0, strokeThickness: 4 });
    SG.txt(this, cx, rows.sub, 'прыжок можно двойной · аккорд бьёт врагов',
      11, '#d8d2e8', { light: true, strokeThickness: 4 });

    if (SG.state.best > 0) {
      SG.txt(this, cx, rows.best, 'ЛУЧШИЙ СЧЁТ: ' + SG.state.best, 12, '#f2e9d8',
        { strokeThickness: 4 });
    }

    this.startHint = SG.txt(this, cx, rows.tap, 'ТАП — ПОЕХАЛИ', 20, '#f5c542');
    this.tweens.add({ targets: this.startHint, alpha: 0.25, duration: 620,
      yoyo: true, repeat: -1 });
  },

  makeMuteButton: function () {
    var W = SG.VIEW.W, self = this;
    var label = function () { return SG.Audio.isMuted() ? '♪ ВЫКЛ' : '♪ ВКЛ'; };

    // под кнопкой плашка: в углу постера небо и заголовок, без подложки
    // надпись на них теряется
    var plate = this.add.rectangle(W - 8, 8, 74, 22, 0x171223, 0.62)
      .setOrigin(1, 0).setStrokeStyle(1, 0xf5c542, 0.35);
    var btn = SG.txt(this, W - 45, 19, label(), 13, '#f2e9d8',
      { strokeThickness: 0 });

    this.muteBtn = plate;
    plate.setInteractive({ useHandCursor: true });
    plate.on('pointerdown', function (p, lx, ly, ev) {
      if (ev) ev.stopPropagation();
      SG.Audio.init();
      SG.Audio.toggleMute();
      btn.setText(label());
    });
  },

  hitMute: function (p) {
    var x = p.worldX === undefined ? p.x : p.worldX;
    var y = p.worldY === undefined ? p.y : p.worldY;
    return Phaser.Geom.Rectangle.Contains(this.muteBtn.getBounds(), x, y);
  },

  /* ---- запасная заставка ------------------------------------------------ */

  retroBg: function () {
    var W = SG.VIEW.W, H = SG.VIEW.H, G = SG.VIEW.GROUND;
    var C = SG.CFG;

    this.add.image(0, 0, 'sky1').setOrigin(0).setDisplaySize(W, H);
    this.far = this.add.tileSprite(0, G - 220, W, 220, 'bg1_far').setOrigin(0);
    this.near = this.add.tileSprite(0, G - 220, W, 220, 'bg1_near').setOrigin(0).setAlpha(0.9);
    this.gnd = this.add.tileSprite(0, G, W, H - G, 'ground1').setOrigin(0);
    this.add.rectangle(0, 0, W, H, 0x171223, 0.35).setOrigin(0);

    this.hero = SG.Art.fit(
      this.add.sprite(W * 0.5, G + 4, 'hero_run0').setOrigin(0.5, 1), 'hero_run0');
    this.t = 0;

    SG.txt(this, W / 2, 52, C.hero.toUpperCase(), 42, '#f5c542');
    SG.txt(this, W / 2, 88, 'СПЕШИТ ДОМОЙ', 22, '#f2e9d8');
  },

  update: function (time, delta) {
    if (!this.far) return;
    var d = delta / 1000;
    this.t += d;
    this.far.tilePositionX += 18 * d;
    this.near.tilePositionX += 46 * d;
    this.gnd.tilePositionX += 150 * d;
    this.hero.setTexture('hero_run' + (Math.floor(this.t * 12) % 4));
  }
});
