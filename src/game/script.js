/*
 * ChapterContext: the scripting API chapters are written against.
 *
 * Stage scripts are generator functions. Yield a "waiter" to pause until it is
 * done; yield nothing to wait one frame:
 *
 *   run: function* (ctx) {
 *     yield ctx.dialog([['janey', 'Jon! My watch...']]);
 *     ctx.objective('Repair the watch');
 *     yield ctx.until(() => ctx.flags.repaired);
 *     yield ctx.unlock('telekinesis');
 *   }
 *
 * ctx.fork(fn*) runs a side script in parallel (NPC conversations, spawners).
 * Stages marked `checkpoint: true` are where a retry restarts from; a stage's
 * `restore(ctx)` re-applies its lasting effects when a later checkpoint loads.
 */
(function () {
  'use strict';
  const DM = window.DM;
  const ONE_FRAME = { update: () => true };

  class ChapterContext {
    constructor(scene, chapter) {
      this.scene = scene;
      this.chapter = chapter;
      this.flags = {};
      this.threads = [];
      this.locked = false;
      this.checkpoint = 0;
      this.stageIndex = 0;
      this.mapName = null;
      this.camTarget = null;
      this.skipRequested = false;
      this.done = false;
      this.stats = { time: 0, disintegrated: 0, spared: 0, memories: 0 };
      this.refs = {};
      this.offs = [];
    }

    // Subscribe to a DM.Events event for the life of this attempt.
    on(name, fn) {
      this.offs.push(DM.Events.on(name, fn));
    }
    dispose() {
      for (const off of this.offs) off();
      this.offs = [];
      this.threads = [];
    }

    // While a map is being built, ctx.world (and ctx.add) target the new world.
    get world() {
      return this._building || this.scene.world;
    }
    get player() {
      return this.scene.player;
    }
    get hud() {
      return this.scene.hud;
    }

    // ---- thread runner ----------------------------------------------------
    start(fromStage) {
      this.threads = [];
      this.spawn(this.stageLoop(fromStage));
    }
    spawn(gen) {
      const th = { gen, waiter: null, done: false };
      this.threads.push(th);
      return th;
    }
    fork(fn) {
      return this.spawn(fn(this));
    }
    step(dt) {
      if (!this.done) this.stats.time += dt;
      if (this.skipRequested && this.threads[0]) this.threads[0].waiter = null;
      for (const th of this.threads.slice()) this.stepThread(th, dt);
      this.threads = this.threads.filter((t) => !t.done);
    }
    stepThread(th, dt) {
      if (th.done) return;
      if (th.waiter) {
        if (!th.waiter.update(dt)) return;
        th.waiter = null;
      }
      for (let guard = 0; guard < 500; guard++) {
        const r = th.gen.next();
        if (r.done) {
          th.done = true;
          return;
        }
        const w = r.value;
        if (!w || typeof w.update !== 'function') {
          th.waiter = ONE_FRAME;
          return;
        }
        if (!w.update(0)) {
          th.waiter = w;
          return;
        }
      }
      throw new Error('Chapter script ran 500 steps without waiting — missing a yield?');
    }

    // True while running the stage this attempt started from (a fresh start or a checkpoint retry).
    get startedHere() {
      return this.stageIndex === this.startStage;
    }

    *stageLoop(from) {
      this.startStage = from;
      const stages = this.chapter.stages;
      for (let i = 0; i < from; i++) for (const id of stages[i].grants || []) this.player.unlock(id);
      // A stage without its own `map` plays on the most recent earlier stage's map.
      const mapFor = (i) => {
        for (let k = i; k >= 0; k--) if (stages[k].map) return stages[k].map;
        return null;
      };
      for (let i = from; i < stages.length; i++) {
        const st = stages[i];
        this.stageIndex = i;
        const map = mapFor(i);
        if (map && map !== this.mapName) yield this.loadMap(map, i === from);
        if (i === from) for (let k = 0; k < from; k++) if (stages[k].restore) stages[k].restore(this);
        if (st.checkpoint) {
          this.checkpoint = i;
          DM.Save.data.checkpoint = { chapter: this.chapter.id, stage: i };
          DM.Save.write();
        }
        yield* this.runStage(st);
      }
      yield* this.finish();
    }

    *runStage(st) {
      this.skipRequested = false;
      const gen = st.run(this);
      while (true) {
        if (this.skipRequested) {
          this.cleanupSkip(st);
          return;
        }
        const r = gen.next();
        if (r.done) return;
        yield r.value;
      }
    }

    // Developer skip (] in dev mode): jump to the end state of the current stage.
    skipStage() {
      this.skipRequested = true;
    }
    cleanupSkip(st) {
      this.scene.dialog.close();
      this.hud.clearTransient();
      this.hud.setObjective(null);
      this.hud.marker = null;
      this.lock(false);
      this.camTarget = null;
      for (const id of st.grants || []) this.player.unlock(id);
      if (st.restore) st.restore(this);
      this.threads = this.threads.filter((t) => t === this.threads[0]);
    }

    *finish() {
      this.done = true;
      this.lock(true);
      this.hud.setObjective(null);
      yield this.wait(0.4);
      this.scene.completeChapter();
    }

    // ---- waiters ------------------------------------------------------------
    wait(t) {
      let e = 0;
      return { update: (dt) => (e += dt) >= t };
    }
    until(fn) {
      return { update: () => !!fn() };
    }
    dialog(lines) {
      const d = this.scene.dialog;
      d.open(lines);
      return { update: () => !d.active };
    }
    // Narration caption. Returned waiter resolves when it has faded.
    narrate(text, o = {}) {
      const c = this.hud.caption(text, o);
      return { update: () => c.gone };
    }
    banner(title, sub, o = {}) {
      const b = this.hud.banner(title, sub, o);
      return { update: () => b.gone };
    }
    unlock(id) {
      this.player.unlock(id);
      let closed = false;
      DM.Engine.push(new DM.Scenes.PowerUnlock(id, () => (closed = true)));
      return { update: () => closed };
    }
    minigame(SceneClass, opts) {
      let result = null;
      DM.Engine.push(new SceneClass(opts || {}, (r) => (result = r == null ? true : r)));
      return { update: () => result !== null };
    }
    countdown(seconds, label) {
      const c = this.hud.startCountdown(seconds, label);
      return { update: () => c.left <= 0 };
    }
    // Map builders call this to create their World, so ctx.add() lands in it.
    newWorld(opts) {
      this._building = new DM.World(opts);
      return this._building;
    }
    loadMap(name, instant) {
      const build = () => {
        let world;
        try {
          world = this.chapter.maps[name](this);
        } finally {
          this._building = null;
        }
        this.mapName = name;
        this.scene.setWorld(world);
      };
      if (instant) {
        build();
        return null;
      }
      let built = false;
      DM.Engine.fadeTo(() => {
        build();
        built = true;
      }, { out: 0.5, in: 0.6 });
      return { update: () => built };
    }

    // ---- actions ------------------------------------------------------------
    lock(on) {
      this.locked = on;
      if (on) DM.Audio.hum('tk', false);
    }
    add(e) {
      return this.world.add(e);
    }
    objective(text, progress) {
      this.hud.setObjective(text, progress);
    }
    objectiveDone() {
      this.hud.completeObjective();
    }
    hint(text, dur) {
      this.hud.hint(text, dur);
    }
    // An instruction the player needs to progress: shown even with HINTS on ESSENTIAL.
    tutorial(text, dur) {
      this.hud.hint(text, dur, { essential: true });
    }
    toast(text, color) {
      this.hud.toast(text, color);
    }
    marker(x, y, label) {
      this.hud.marker = x == null ? null : { x, y, label };
    }
    flash(color = '#ffffff', dur = 0.6, o) {
      this.hud.flash(color, dur, o);
    }
    cinematic(on) {
      this.hud.cinematic = on;
    }
    focus(x, y) {
      this.camTarget = x == null ? null : { x, y };
    }
    place(x, y, facing) {
      const p = this.player;
      p.x = x;
      p.y = y;
      p.vx = p.vy = 0;
      if (facing != null) p.facing = facing;
      this.world.camera.snap(x, y);
    }
    music(id) {
      DM.Audio.music.play(id);
    }
    setForm(form) {
      this.player.setForm(form);
      if (form === 'human') this.player.look = Object.assign({}, DM.LOOKS.jon);
    }
  }

  DM.ChapterContext = ChapterContext;
})();
