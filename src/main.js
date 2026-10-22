/* Boot: load save + settings, wait briefly for web fonts, start on the title screen. */
(function () {
  'use strict';
  const DM = window.DM;
  let booted = false;

  function boot() {
    if (booted) return;
    booted = true;
    const canvas = document.getElementById('game');
    DM.Save.load();
    DM.Audio.setVolumes({ music: DM.Save.settings.music, sfx: DM.Save.settings.sfx });
    DM.Input.init(canvas);
    DM.Engine.init(canvas);
    DM.Engine.set(new DM.Scenes.Title());
    const loading = document.getElementById('boot');
    if (loading) loading.remove();
    if (canvas.focus) canvas.focus({ preventScroll: true });

    // Hooks for debugging and automated tests (see tests/smoke.mjs).
    DM.dev = {
      start(chapter, stage = 0) {
        DM.Engine.set(new DM.Scenes.Play(), { chapter, stage });
      },
      play() {
        return DM.Engine.stack.find((s) => s instanceof DM.Scenes.Play) || null;
      },
      skip() {
        const p = this.play();
        if (p) p.ctx.skipStage();
      },
      state() {
        const p = this.play();
        const top = DM.Engine.top();
        return {
          scene: top && top.constructor.name,
          stack: DM.Engine.stack.map((s) => s.constructor.name),
          error: DM.Engine.error ? String(DM.Engine.error.stack || DM.Engine.error) : null,
          chapter: p && p.chapter.id,
          stage: p && p.ctx.stageIndex,
          stageId: p && p.chapter.stages[p.ctx.stageIndex] && p.chapter.stages[p.ctx.stageIndex].id,
          form: p && p.player.form,
          powers: p ? Object.keys(p.player.powers) : [],
          entities: p ? p.world.entities.length : 0,
          dialog: p ? p.dialog.active : false,
        };
      },
    };
  }

  const fonts = ['700 20px Oswald', '400 20px Oswald', '20px "Special Elite"', '20px "Patrick Hand"'];
  const ready = document.fonts && document.fonts.load ? Promise.all(fonts.map((f) => document.fonts.load(f).catch(() => null))) : Promise.resolve();
  Promise.race([ready, new Promise((r) => setTimeout(r, 2500))]).then(boot, boot);
})();
