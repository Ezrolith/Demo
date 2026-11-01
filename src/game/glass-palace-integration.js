/* Level entry and result decoration. Existing save formats remain unchanged. */
(function () {
  'use strict';
  const DM = window.DM;
  const GP = DM.GlassPalace;
  const E = DM.Engine;

  GP.open = () => {
    DM.Input.clearAll();
    E.set(new DM.Scenes.GlassPalace());
  };

  GP.playMoment = (value, resume = false) => {
    const moment = GP.find(typeof value === 'string' ? value : value.id);
    if (!moment || !moment.unlocked) return false;
    DM.Input.clearAll();
    if (moment.chapter.afterMidnight) {
      DM.AfterMidnight.start(moment.chapter.amId, { hero: moment.hero, resume });
    } else if (moment.chapter.bonus) {
      DM.Bonus.start(moment.chapterId, resume);
    } else {
      const checkpoint = resume && moment.checkpoint;
      E.fadeTo(() => {
        if (checkpoint) {
          E.set(new DM.Scenes.Play(), {
            chapter: moment.chapterId,
            stage: checkpoint.stage,
            carry: checkpoint.carry || null,
          });
        } else E.set(new DM.Scenes.Interlude(moment.chapterId));
      });
    }
    return true;
  };

  // Wrap this one completion screen, never the global render/gameplay path.
  GP.decorateCompletion = (screen, play) => {
    const result = play.glassPalaceResult;
    if (!result || !screen || typeof screen.render !== 'function') return screen;
    screen.glassPalaceSummary = result;
    const render = screen.render;
    screen.render = function (g) {
      render.call(this, g);
      DM.Gfx.panel(g, DM.W - 296, 12, 278, 38, { accent: '#b7dce6' });
      DM.Gfx.text(g, result.earned + ' / 3 MOMENTS', DM.W - 35, 37, {
        size: 15,
        align: 'right',
        spacing: 2,
        color: '#d5eef0',
      });
      if (!GP.available) {
        DM.Gfx.text(g, 'PALACE PROGRESS IS SESSION ONLY', 26, 37, {
          size: 13,
          color: '#e7bd83',
        });
      }
    };
    GP.addCompletionDetails(screen, play, result);
    return screen;
  };
})();
