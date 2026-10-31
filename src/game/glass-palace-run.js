/* Rules-v2 observations. Gameplay writes its original saves normally; this
 * module keeps optional evidence and checkpoint provenance in the palace slot. */
(function () {
  'use strict';
  const DM = window.DM;
  const GP = DM.GlassPalace;
  const E = DM.Engine;
  const IDS = [
    'prologue', 'reassembly', 'superman', 'deterrent', 'mars', 'karnak',
    'last_broadcast', 'ninth_minute', 'long_summer', 'am_dead_air', 'am_undertow', 'am_glass_archive',
  ];
  const COUNTERS = [
    'researchMask', 'vortexAtomsLost', 'passiveAtoms', 'unmade', 'behemothDisintegrations',
    'behemothCoherence', 'behemothMaxCoherence', 'marsDamage', 'emittersDamage',
    'veidtDisintegrations', 'damageTaken', 'fieldNotesMask',
  ];
  const FLAGS = [
    'eligible', 'photoSeen', 'badgeSeen', 'behemothSeen', 'behemothDefeated', 'marsSeen',
    'emittersSeen', 'emittersComplete', 'veidtSeen', 'veidtDefeated',
  ];
  const plain = value => !!value && typeof value === 'object' && !Array.isArray(value);
  const clone = value => JSON.parse(JSON.stringify(value));
  const heroId = play => play.player?.profile?.id || 'manhattan';
  const runKey = play => play.chapter.id + ':' + heroId(play);
  const signature = (carry, chapter) => {
    if (!carry) return 'null';
    const source = chapter.afterMidnight ? DM.AfterMidnight.cleanCarry(carry, chapter) : carry;
    if (!source) return 'null';
    const stats = {};
    for (const name of ['time', 'spared', 'disintegrated', 'memories']) {
      const value = chapter.bonus || chapter.afterMidnight ? source.stats?.[name] : Number(source.stats?.[name]);
      stats[name] = Number.isFinite(value) ? Math.max(0, value) : 0;
    }
    const allowed = chapter.bonus || chapter.afterMidnight ? chapter.persistFlags || [] : Object.keys(source.flags || {});
    const flags = {};
    for (const name of [...allowed].sort()) {
      const value = source.flags?.[name];
      if (typeof value === 'boolean' || typeof value === 'string' || typeof value === 'number' && Number.isFinite(value)) {
        flags[name] = value;
      }
    }
    const found = chapter.bonus || chapter.afterMidnight ? [] : (source.found || []).filter(Number.isFinite);
    return JSON.stringify({ stats, found, flags });
  };
  let serial = 0;
  let active = null;

  function cleanRun(value, chapterId) {
    if (!plain(value) || value.rulesVersion !== 2 || value.chapterId !== chapterId) return null;
    if (typeof value.runId !== 'string' || value.runId.length > 96 || !value.runId) return null;
    const out = { rulesVersion: 2, chapterId, runId: value.runId };
    for (const name of COUNTERS) {
      const number = value[name];
      if (typeof number !== 'number' || !Number.isFinite(number) || number < 0 || number > 1e9) return null;
      out[name] = number;
    }
    for (const name of FLAGS) {
      if (typeof value[name] !== 'boolean') return null;
      out[name] = value[name];
    }
    return out;
  }

  GP.cleanRunCheckpoint = (value, key) => {
    if (!plain(value) || value.rulesVersion !== 2 || !IDS.includes(value.chapterId)) return null;
    const chapter = DM.Chapters.get(value.chapterId);
    if (!chapter || !Number.isInteger(value.stage) || value.stage < 0 || value.stage >= chapter.stages.length) return null;
    const hero = value.heroId;
    const validHero = chapter.afterMidnight
      ? DM.AfterMidnight.heroes.some(entry => entry.id === hero) : hero === 'manhattan';
    if (!validHero || key !== value.chapterId + ':' + hero) return null;
    if (typeof value.signature !== 'string' || value.signature.length > 65536) return null;
    const run = cleanRun(value.run, value.chapterId);
    if (!run) return null;
    return {
      rulesVersion: 2, chapterId: value.chapterId, heroId: hero,
      stage: value.stage, signature: value.signature, run,
    };
  };

  function canonical(play) {
    return !!play && IDS.includes(play.chapter?.id) && DM.Chapters.get(play.chapter.id) === play.chapter &&
      play.ctx?.scene === play && play.ctx.chapter === play.chapter && !!play.player;
  }
  GP.runEvidence = play => canonical(play) ? play.glassPalaceRun || null : null;

  GP.beginRuleRun = (play, options = {}) => {
    if (!canonical(play)) {
      play.glassPalaceRun = null;
      return null;
    }
    const data = GP.load();
    const old = options.retry && cleanRun(play.memo?.palaceRuleRun, play.chapter.id);
    const checkpoint = GP.cleanRunCheckpoint(data.runs?.[runKey(play)], runKey(play));
    const match = checkpoint && checkpoint.stage === options.stage &&
      checkpoint.signature === signature(options.carry, play.chapter);
    const run = old || (options.carry && match ? clone(checkpoint.run) : null) || {
      rulesVersion: 2, chapterId: play.chapter.id, runId: 'v2-' + Date.now().toString(36) + '-' + (++serial),
      ...Object.fromEntries(COUNTERS.map(name => [name, 0])),
      ...Object.fromEntries(FLAGS.map(name => [name, false])),
      eligible: options.stage === 0 && !options.carry,
    };
    play.glassPalaceRun = run;
    play.memo.palaceRuleRun = run;
    active = play;
    if (options.stage === 0 && !options.retry) GP.saveRunCheckpoint(play, 0, options.carry);
    return run;
  };

  GP.saveRunCheckpoint = (play, stage, carry) => {
    const run = GP.runEvidence(play);
    if (!run) return false;
    const entry = {
      rulesVersion: 2, chapterId: play.chapter.id, heroId: heroId(play),
      stage, signature: signature(carry, play.chapter), run: clone(run),
    };
    const clean = GP.cleanRunCheckpoint(entry, runKey(play));
    if (!clean) return false;
    const data = GP.load();
    data.runs = data.runs || {};
    data.runs[runKey(play)] = clean;
    return GP.write();
  };
  function persist(play) {
    const saved = GP.data?.runs?.[runKey(play)];
    if (!saved || !GP.runEvidence(play)) return;
    saved.run = clone(play.glassPalaceRun);
    GP.write();
  }
  GP.endRuleRun = play => {
    if (active !== play) return;
    if (play.ctx?.done && GP.data?.runs) {
      delete GP.data.runs[runKey(play)];
      GP.write();
    } else persist(play);
    active = null;
  };

  GP.fieldNoteDefinitions = [
    { chapterId: 'am_dead_air', id: 'roof-maintenance', bit: 1, x: 320, y: 260,
      label: 'Read tower maintenance note', text: 'A replaced relay. The old receiver was never disconnected.' },
    { chapterId: 'am_dead_air', id: 'dispatch-handover', bit: 2, x: 1510, y: 1010,
      label: 'Read dispatch handover note', text: 'The night shift logged every call. Someone copied the log twice.' },
    { chapterId: 'am_undertow', id: 'pier-lease', bit: 1, x: 310, y: 230,
      label: 'Read the pier lease', text: 'The lease names a shipping office. Its forwarding address belongs to a gallery.' },
    { chapterId: 'am_undertow', id: 'cargo-tally', bit: 2, x: 1510, y: 980,
      label: 'Read the cargo tally', text: 'Four names were crossed out and replaced with crate numbers.' },
    { chapterId: 'am_glass_archive', id: 'loan-register', bit: 1, x: 310, y: 260,
      label: 'Read the loan register', text: 'The lenders signed initials. The people in the recordings signed nothing.' },
    { chapterId: 'am_glass_archive', id: 'private-index', bit: 2, x: 1530, y: 1010,
      label: 'Read the private index', text: 'The catalogue sorts lives by price. The margin contains a list of unanswered calls.' },
  ];

  class FieldNote extends DM.Entity {
    constructor(play, definition, point) {
      super({ x: point.x, y: point.y, r: 12, body: false, solid: false, static: true, disintegratable: false });
      this.glassPalaceNoteId = definition.id;
      this.definition = definition;
      this.interact = {
        label: definition.label, range: 62,
        onInteract: () => {
          GP.ruleEvent(play, 'field-note', { id: definition.id, bit: definition.bit });
          play.dialog.open([[play.player.profile?.look || 'jon', definition.text, { name: 'FIELD NOTE' }]]);
        },
      };
    }
    render(g, world) {
      const selected = world.player?.interactTarget === this;
      g.save();
      g.translate(this.x, this.y);
      g.fillStyle = selected ? '#eee4c7' : '#c3b99c';
      g.fillRect(-10, -13, 20, 26);
      g.strokeStyle = '#293c47';
      g.lineWidth = 1.5;
      g.strokeRect(-10, -13, 20, 26);
      for (let n = 0; n < 3; n++) DM.Gfx.line(g, -6, -6 + n * 6, 6, -6 + n * 6);
      g.restore();
      if (!world.lit) this.renderEmissive(g, world);
    }
    renderEmissive(g, world) {
      const player = world.player;
      if (!player || DM.U.dist(this.x, this.y, player.x, player.y) > 260) return;
      DM.Gfx.glow(g, this.x, this.y, 25, '#e1c68c', 0.2);
      DM.Gfx.text(g, 'FIELD NOTE', this.x, this.y - 23, {
        size: 13, align: 'center', color: '#e8d7ae', spacing: 1,
      });
    }
  }
  GP.FieldNote = FieldNote;

  function findNoteFloor(world, definition) {
    const candidates = [];
    for (let dy = -240; dy <= 240; dy += 40) {
      for (let dx = -240; dx <= 240; dx += 40) {
        const point = { x: definition.x + dx, y: definition.y + dy };
        const bounds = world.amPlayableBounds;
        if (bounds && (point.x < bounds.x + 34 || point.x > bounds.x + bounds.w - 34 ||
          point.y < bounds.y + 34 || point.y > bounds.y + bounds.h - 34)) continue;
        if (!world.isFree(point.x, point.y, 18)) continue;
        if (world.entities.some(entity => {
          const distance = DM.U.dist(point.x, point.y, entity.x, entity.y);
          return entity.interact && distance < 160 || entity.solid && entity.body !== false && distance < entity.r + 26;
        })) continue;
        candidates.push(point);
      }
    }
    candidates.sort((a, b) => DM.U.dist(a.x, a.y, definition.x, definition.y) -
      DM.U.dist(b.x, b.y, definition.x, definition.y));
    return candidates[0] || null;
  }

  GP.observeRuleWorld = play => {
    const run = GP.runEvidence(play);
    if (!run) return;
    const world = play.world;
    if (play.chapter.id === 'mars' && world.mapId === 'mars') run.marsSeen = true;
    if (play.chapter.id === 'karnak' && play.ctx.refs.emitters?.length >= 4 &&
      play.ctx.refs.emitters.some(entity => !entity.dead && !entity.neutralized)) run.emittersSeen = true;
    for (const definition of GP.fieldNoteDefinitions.filter(note => note.chapterId === play.chapter.id)) {
      if (world.entities.some(entity => entity.glassPalaceNoteId === definition.id)) continue;
      const point = findNoteFloor(world, definition);
      if (point) world.add(new FieldNote(play, definition, point));
    }
  };

  GP.observeRuleEntity = (play, entity) => {
    const run = GP.runEvidence(play);
    if (!run || entity.world !== play.world) return;
    if (play.chapter.id === 'deterrent' && entity instanceof DM.Enemies.Behemoth) run.behemothSeen = true;
    if (play.chapter.id === 'karnak' && entity instanceof DM.Enemies.Veidt) run.veidtSeen = true;
  };

  GP.ruleEvent = (play, name, data = {}) => {
    const run = GP.runEvidence(play);
    if (!run) return;
    if (name === 'damage') {
      if (!Number.isFinite(data.amount) || data.amount <= 0) return;
      run.damageTaken += data.amount;
      if (play.chapter.id === 'mars' && play.world.mapId === 'mars') {
        run.marsSeen = true;
        run.marsDamage += data.amount;
      }
      if (play.chapter.id === 'karnak' && !run.emittersComplete && play.ctx.refs.emitters?.length >= 4) {
        run.emittersSeen = true;
        run.emittersDamage += data.amount;
      }
    } else if (name === 'interaction') {
      if (play.chapter.id === 'prologue') {
        if (data.label === 'Look at the photograph') run.photoSeen = true;
        if (data.label === 'Read the chalkboard') run.researchMask |= 1;
        if (data.label === 'Listen to the radio') run.researchMask |= 2;
        if (data.label === 'Check the files') run.researchMask |= 4;
      }
      if (play.chapter.id === 'superman' && data.label === 'Look at the badge') run.badgeSeen = true;
    } else if (name === 'field-note') {
      const note = GP.fieldNoteDefinitions.find(entry => entry.chapterId === play.chapter.id && entry.id === data.id);
      if (note) run.fieldNotesMask |= note.bit;
    } else if (name === 'cast' && data.power === 'disintegrate') {
      const boss = play.world.boss;
      if (boss instanceof DM.Enemies.Behemoth && !boss.dead) {
        run.behemothSeen = true;
        run.behemothDisintegrations++;
      }
      if (boss instanceof DM.Enemies.Veidt && !boss.yielded) {
        run.veidtSeen = true;
        run.veidtDisintegrations++;
      }
    } else if (name === 'behemoth') {
      run.behemothSeen = true;
      run.behemothDefeated = true;
      run.behemothCoherence = play.player.coherence;
      run.behemothMaxCoherence = play.player.maxCoherence;
    } else if (name === 'veidt') {
      run.veidtSeen = true;
      run.veidtDefeated = true;
    } else if (name === 'emitter') {
      run.emittersSeen = true;
      const emitters = play.ctx.refs.emitters;
      if (emitters?.length >= 4 && emitters.every(entity => entity.dead || entity.neutralized)) run.emittersComplete = true;
    } else if (name === 'atom' && play.chapter.id === 'reassembly' && !DM.Input.down('telekinesis')) run.passiveAtoms++;
    else if (name === 'vortex' && play.chapter.id === 'reassembly') run.vortexAtomsLost += Math.max(0, data.lost || 0);
    else if (name === 'unmade') run.unmade++;
  };

  function current(player, world) {
    if (!active || !E.stack.includes(active) || !GP.runEvidence(active)) return null;
    if (player && active.player !== player) return null;
    if (world && active.world !== world) return null;
    return active;
  }
  DM.Events.on('player:damage-accepted', data => {
    const play = current(data.player, data.world);
    if (play) GP.ruleEvent(play, 'damage', data);
  });
  DM.Events.on('player:interact', data => {
    const play = current(data.player, data.world);
    if (play) GP.ruleEvent(play, 'interaction', data);
  });
  DM.Events.on('power:cast-start', data => {
    const play = current(data.player, data.world);
    if (play) GP.ruleEvent(play, 'cast', data);
  });
  DM.Events.on('enemy:down', data => {
    const play = current(null, data.enemy?.world);
    if (!play) return;
    if (data.human && data.lethal) GP.ruleEvent(play, 'unmade', data);
    if (data.enemy instanceof DM.Enemies.Behemoth) GP.ruleEvent(play, 'behemoth', data);
  });
  DM.Events.on('emitter:down', entity => {
    const play = current(null, entity.world);
    if (play) GP.ruleEvent(play, 'emitter', entity);
  });
  DM.Events.on('veidt:yield', entity => {
    const play = current(null, entity.world);
    if (play) GP.ruleEvent(play, 'veidt', entity);
  });
  DM.Events.on('atom:absorbed', () => {
    const play = current();
    if (play) GP.ruleEvent(play, 'atom');
  });
  DM.Events.on('vortex:hit', lost => {
    const play = current();
    if (play) GP.ruleEvent(play, 'vortex', { lost });
  });
  DM.Events.on('player:down', player => {
    const play = current(player);
    if (play) persist(play);
  });
  window.addEventListener('pagehide', () => { if (active) persist(active); });
})();
