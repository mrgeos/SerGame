/* Точка входа: конфиг Phaser, ориентация, пауза. */
(function () {
  'use strict';

  var V = SG.VIEW;

  var game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: V.W * V.RES,
    height: V.H * V.RES,
    pixelArt: true,
    roundPixels: true,
    backgroundColor: '#12101c',
    disableContextMenu: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      expandParent: true
    },
    input: { activePointers: 3 },
    scene: [SG.BootScene, SG.MenuScene, SG.ComicScene, SG.GameScene,
            SG.GameOverScene, SG.VictoryScene]
  });

  SG.game = game;

  /* ---- ориентация ------------------------------------------------------ */

  var rotateEl = document.getElementById('rotate');
  var wasPausedByRotate = false;

  function activeScenes() {
    return game.scene.getScenes(true);
  }

  function checkOrientation() {
    var portrait = window.innerHeight > window.innerWidth;
    rotateEl.classList.toggle('on', portrait);

    if (portrait) {
      var s = activeScenes();
      if (s.length) { s.forEach(function (sc) { sc.scene.pause(); }); wasPausedByRotate = true; }
    } else if (wasPausedByRotate) {
      wasPausedByRotate = false;
      game.scene.getScenes(false).forEach(function (sc) {
        if (sc.scene.isPaused()) sc.scene.resume();
      });
    }
  }

  window.addEventListener('resize', checkOrientation);
  window.addEventListener('orientationchange', function () {
    setTimeout(checkOrientation, 220);
  });
  setTimeout(checkOrientation, 60);

  /* ---- пауза при уходе из вкладки -------------------------------------- */

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      SG.Audio.stopMusic();
      activeScenes().forEach(function (sc) { sc.scene.pause(); });
    } else {
      checkOrientation();
    }
  });

  /* ---- запрет системных жестов ----------------------------------------- */

  ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (ev) {
    document.addEventListener(ev, function (e) { e.preventDefault(); });
  });
  document.addEventListener('touchmove', function (e) {
    if (e.touches.length > 1) e.preventDefault();
  }, { passive: false });
  document.addEventListener('dblclick', function (e) { e.preventDefault(); });

  /* ---- если совсем не завелось ----------------------------------------- */

  window.addEventListener('error', function (e) {
    var f = document.getElementById('fatal');
    if (!f || f.classList.contains('on')) return;
    if (document.querySelector('#game canvas')) return;   // игра идёт, ошибка не фатальная
    f.classList.add('on');
    document.getElementById('fatal-msg').textContent = (e && e.message) || '';
  });
})();
