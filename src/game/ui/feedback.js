/*
 * Feedback: screen-space combat feedback. The Play scene calls
 * DM.Feedback.render(ctx, scene) once a frame, after the world and Temporal
 * Sight and before the vignette and HUD.
 *
 *   - Hit arcs: a red arc on a ring around Jon pointing at whatever hit him,
 *     plus a red flash at the screen edges (from player.hurtDirs / hurtFlash).
 *   - Decoherence: while the scene has failed, the colour drains out.
 *   - The tally: SPARED n · GONE n under the objective, whenever the chapter
 *     has people in it; the number that just changed pulses.
 *
 * It also plays the reassembly when a retry begins ('play:begin', retry).
 */
(function () {
  'use strict';
  const DM = window.DM;
  const U = DM.U;
  const Gfx = DM.Gfx;

  const tallies = new WeakMap(); // scene -> tally state
  let edge = null;

  // Red edges, clear centre: drawn once at low resolution, stretched to fit.
  function edgeSprite() {
    if (edge) return edge;
    edge = document.createElement('canvas');
    edge.width = 256;
    edge.height = 144;
    const g = edge.getContext('2d');
    const grad = g.createRadialGradient(128, 72, 40, 128, 72, 150);
    grad.addColorStop(0, 'rgba(255,40,30,0)');
    grad.addColorStop(0.55, 'rgba(255,40,30,0.35)');
    grad.addColorStop(1, 'rgba(255,40,30,1)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 144);
    return edge;
  }

  // A person the ledger counts (Veidt and other bosses keep their own rules).
  function countable(e, world) {
    return e.human && e.team === 'enemy' && e instanceof DM.Enemies.Enemy && e !== world.boss && !('yielded' in e);
  }

  const Feedback = {
    render(ctx, scene) {
      const w = scene.world, p = scene.player;
      if (!w || !p) return;
      if (scene.failed) this.renderDecoherence(ctx, scene);
      else this.renderHurt(ctx, w, p);
      this.renderTally(ctx, scene);
    },

    renderHurt(ctx, w, p) {
      const now = w.realTime || 0;
      if (p.hurtDirs && p.hurtDirs.length && !p.hidden) {
        const s = w.camera.toScreen(p.x, p.y);
        const R = 70 * Math.max(1, w.camera.zoom * p.scale * 0.8);
        ctx.save();
        ctx.lineCap = 'round';
        for (const h of p.hurtDirs) {
          const left = h.t - (now - h.at);
          if (left <= 0) continue;
          const a = (left / 0.7) * Math.min(1, h.amt / 12);
          if (a < 0.02) continue;
          ctx.globalAlpha = a;
          ctx.strokeStyle = 'rgba(120,0,0,0.6)';
          ctx.lineWidth = 8;
          ctx.beginPath();
          ctx.arc(s.x, s.y, R, h.angle - 0.35, h.angle + 0.35);
          ctx.stroke();
          ctx.strokeStyle = '#ff4a3a';
          ctx.lineWidth = 4;
          ctx.stroke();
          ctx.strokeStyle = '#ffd0c0';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(s.x, s.y, R, h.angle - 0.12, h.angle + 0.12);
          ctx.stroke();
        }
        ctx.restore();
      }
      // FLASHING LIGHTS: REDUCED keeps it under the full-screen flash cap and
      // lets it fade half as long again (as HUD.flash does).
      const f = p.hurtFlash;
      if (f) {
        const S = DM.SettingsSchema;
        const reduced = !!(S && S.reducedFlashing && S.reducedFlashing());
        const cap = Math.min(0.35, S && S.flashCap ? S.flashCap() * 0.6 : 0.35);
        const dur = reduced ? 0.3 : 0.2;
        const age = now - f.at;
        if (age >= 0 && age < dur) {
          ctx.save();
          ctx.globalAlpha = Math.min(cap, f.amt / 40) * (1 - age / dur);
          ctx.drawImage(edgeSprite(), 0, 0, DM.W, DM.H);
          ctx.restore();
        }
      }
    },

    // The colour drains while Jon is coming apart (failT runs 1.8 -> 0).
    renderDecoherence(ctx, scene) {
      const k = U.clamp((1.8 - (scene.failT == null ? 0 : scene.failT)) / 0.7, 0, 1) * 0.8;
      if (k <= 0) return;
      ctx.save();
      ctx.globalCompositeOperation = 'saturation';
      ctx.globalAlpha = k;
      ctx.fillStyle = '#808080';
      ctx.fillRect(0, 0, DM.W, DM.H);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = k * 0.25;
      ctx.fillStyle = '#0a1420';
      ctx.fillRect(0, 0, DM.W, DM.H);
      ctx.restore();
    },

    renderTally(ctx, scene) {
      const stats = scene.ctx && scene.ctx.stats;
      const hud = scene.hud;
      if (!stats || !hud) return;
      let st = tallies.get(scene);
      if (!st) {
        st = { spared: stats.spared, gone: stats.disintegrated, ps: 0, pg: 0, humans: false, checkT: -1, lastT: hud.t, y: 0, a: 0 };
        tallies.set(scene, st);
      }
      const dt = U.clamp(hud.t - st.lastT, 0, 0.1);
      st.lastT = hud.t;
      // Pulse whichever number went up (a retry that resets them just syncs).
      if (stats.spared !== st.spared) {
        if (stats.spared > st.spared) st.ps = 1;
        st.spared = stats.spared;
      }
      if (stats.disintegrated !== st.gone) {
        if (stats.disintegrated > st.gone) st.pg = 1;
        st.gone = stats.disintegrated;
      }
      st.ps = Math.max(0, st.ps - dt * 1.6);
      st.pg = Math.max(0, st.pg - dt * 1.6);
      if (hud.t - st.checkT > 0.5 || hud.t < st.checkT) {
        st.checkT = hud.t;
        const w = scene.world;
        st.humans = !!w && w.entities.some((e) => countable(e, w));
      }
      const show = (st.humans || st.spared + st.gone > 0) && !scene.failed && hud.cineK < 0.5 && !(scene.dialog && scene.dialog.active);
      st.a = U.damp(st.a, show ? 1 : 0, 10, dt);
      if (st.a < 0.02) return;
      const ty = hud.objective ? 108 : 50;
      st.y = st.y ? U.damp(st.y, ty, 10, dt) : ty;

      const o = { size: 13, spacing: 3, weight: 600 };
      const parts = [
        ['SPARED ', 'rgba(200,225,240,0.75)', 0],
        [String(st.spared), '#bff1ff', st.ps],
        ['   ·   GONE ', 'rgba(200,225,240,0.75)', 0],
        [String(st.gone), '#ffb27a', st.pg],
      ];
      const widths = parts.map(([txt]) => Gfx.measure(ctx, txt, o));
      const total = widths.reduce((a, b) => a + b, 0);
      ctx.save();
      ctx.globalAlpha *= st.a;
      ctx.fillStyle = 'rgba(4,8,16,0.5)';
      Gfx.rr(ctx, 20, st.y, total + 28, 26, 4);
      ctx.fill();
      let x = 34;
      const by = st.y + 18;
      parts.forEach(([txt, col, pulse], i) => {
        if (pulse > 0) {
          const sc = 1 + pulse * 0.45;
          ctx.save();
          ctx.translate(x + widths[i] / 2, by - 5);
          ctx.scale(sc, sc);
          Gfx.glow(ctx, 0, 0, 22, col === '#ffb27a' ? '#ff9a3c' : '#5fd4ff', pulse * 0.7);
          Gfx.text(ctx, txt, 0, 5, Object.assign({ color: '#ffffff', align: 'center' }, { size: o.size, spacing: o.spacing, weight: o.weight }));
          ctx.restore();
        } else Gfx.text(ctx, txt, x, by, Object.assign({ color: col }, o));
        x += widths[i];
      });
      ctx.restore();
    },
  };

  // REASSEMBLE: Jon's atoms rush back together at the checkpoint (as soon as the
  // fade-in clears, see DM.FX.Reassembly), and he gets a moment's grace before
  // anything can touch him. ('play:begin' comes from Play.begin.)
  DM.Events.on('play:begin', (e) => {
    if (!e || !e.retry || !e.scene) return;
    const w = e.scene.world, p = e.scene.player;
    if (!w || !p) return;
    p.invuln = Math.max(p.invuln || 0, 0.6);
    if (p.profile) return; // Human heroes get checkpoint grace, rather than atom reassembly.
    if (DM.FX && DM.FX.Reassembly) w.add(new DM.FX.Reassembly(p));
    else w.particles.implode(p.x, p.y, 160, 80, { life: 0.6, size: 3, color: '#bff1ff' });
  });

  DM.Feedback = Feedback;
})();
