/* The Glass Palace reads the three existing progress slots and owns only its
 * own challenge/epilogue slot. It never migrates, loads or writes another save.
 * The ledger follows the retention rules of those slots: campaign totals,
 * latest bonus completions, and latest After Midnight record in each run slot.
 */
(function () {
  'use strict';
  const DM = window.DM;
  const GP = (DM.GlassPalace = DM.GlassPalace || {});
  const KEY = 'dr-manhattan.glass-palace.v1';
  const SOURCE_KEYS = {
    campaign: 'dr-manhattan.save',
    bonus: 'dr-manhattan.bonus.v1',
    afterMidnight: 'dr-manhattan.after-midnight.v1',
  };
  const CAMPAIGN_IDS = ['prologue', 'reassembly', 'superman', 'deterrent', 'mars', 'karnak'];
  const BONUS_IDS = ['last_broadcast', 'ninth_minute', 'long_summer'];
  const CASE_IDS = ['dead_air', 'undertow', 'glass_archive'];
  const object = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
  const number = (value, fallback = 0) =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1e9
      ? value
      : fallback;
  const fresh = () => ({ version: 1, challenges: {}, epilogueSeen: {}, visits: 0 });
  const observed = new WeakSet();
  const stats = (source) => ({
    spared: number(source?.spared),
    unmade: number(source?.disintegrated ?? source?.unmade),
    memories: number(source?.memories),
    time: number(source?.time),
  });
  const campaignNumber = (value, fallback = 0) =>
    number(typeof value === 'string' && value.trim() !== '' ? Number(value) : value, fallback);
  GP.key = KEY;
  GP.sourceKeys = { ...SOURCE_KEYS };
  GP.data = null;
  GP.available = true;
  GP.readOnly = false;
  GP.warning = '';
  GP.timeTargets = {
    prologue: 480,
    reassembly: 240,
    superman: 480,
    deterrent: 540,
    mars: 600,
    karnak: 600,
    last_broadcast: 600,
    ninth_minute: 720,
    long_summer: 720,
    am_dead_air: 480,
    am_undertow: 600,
    am_glass_archive: 480,
  };

  function registry() {
    const campaign = (DM.Chapters?.list || [])
      .filter((chapter) => CAMPAIGN_IDS.includes(chapter.id))
      .map((chapter) => ({ chapter, group: 'campaign' }));
    const bonus = (DM.Bonus?.list || [])
      .filter((chapter) => BONUS_IDS.includes(chapter.id))
      .map((chapter) => ({ chapter, group: 'bonus' }));
    const cases = (DM.AfterMidnight?.cases || [])
      .filter((chapter) => chapter.kind === 'story' && CASE_IDS.includes(chapter.amId))
      .map((chapter) => ({ chapter, group: 'afterMidnight' }));
    return [...campaign, ...bonus, ...cases];
  }

  function rawSource(group) {
    try {
      const text = localStorage.getItem(SOURCE_KEYS[group]);
      if (!text || text.length > 1024 * 1024) return null;
      const data = JSON.parse(text);
      const versions = group === 'campaign' ? [1, 2] : [1];
      return object(data) && versions.includes(data.version) ? data : null;
    } catch (_) {
      return null;
    }
  }

  // A blocked automatic write may leave newer session progress in memory.
  // Otherwise the actual slots are authoritative, including external restores.
  GP.sources = () => {
    const owners = {
      campaign: DM.Save,
      bonus: DM.Bonus,
      afterMidnight: DM.AfterMidnight,
    };
    const out = {};
    for (const group of Object.keys(SOURCE_KEYS)) {
      const owner = owners[group];
      const memory = object(owner?.data) ? owner.data : null;
      out[group] = owner?.available === false && memory ? memory : rawSource(group) || memory || {};
    }
    return out;
  };
  GP.sourceSnapshot = GP.sources;

  function validCheckpoint(value, chapter, campaign = false) {
    if (!object(value)) return null;
    const stage = campaign ? campaignNumber(value.stage, NaN) : value.stage;
    if (!Number.isInteger(stage) || stage < 0 || stage >= chapter.stages.length) return null;
    return campaign ? { ...value, stage } : value;
  }

  function validAMRecord(key, value) {
    if (!object(value) || !object(value.run)) return false;
    const chapter = DM.AfterMidnight?.cases.find((entry) => entry.amId === value.caseId);
    if (!chapter || !DM.AfterMidnight.heroes.some((hero) => hero.id === value.run.hero))
      return false;
    const theme = chapter.kind === 'story' ? chapter.theme : value.run.theme;
    if (!['rooftops', 'harbour', 'museum'].includes(theme)) return false;
    return value.run.theme === theme && key === DM.AfterMidnight.slot(chapter.amId, value.run);
  }

  function moment(entry, source, index) {
    const chapter = entry.chapter;
    const id = chapter.id;
    let saved = source[entry.group];
    if (entry.group === 'campaign') {
      // Match normal Resume coercion without loading or rewriting the source slot.
      try {
        saved = DM.Save.sanitize(JSON.parse(JSON.stringify(saved)));
      } catch (_) {
        saved = { completed: {}, checkpoints: {}, checkpoint: null };
      }
    }
    let checkpoint = null;
    let record = null;
    let completed = false;
    let hero = null;
    let heroLabel = null;
    if (entry.group === 'campaign') {
      checkpoint = validCheckpoint(saved.checkpoints?.[id], chapter, true);
      if (!checkpoint && saved.checkpoint?.chapter === id) {
        checkpoint = validCheckpoint(saved.checkpoint, chapter, true);
      }
      record = object(saved.completed?.[id]) ? saved.completed[id] : null;
      completed = !!record;
    } else if (entry.group === 'bonus') {
      checkpoint = validCheckpoint(saved.checkpoints?.[id], chapter);
      record = object(saved.completed?.[id]) ? saved.completed[id] : null;
      completed = !!record;
    } else {
      const selected = DM.AfterMidnight.heroes.some((value) => value.id === saved.selection?.hero)
        ? saved.selection.hero
        : 'niteowl';
      const matching = (group) =>
        Object.entries(object(saved[group]) ? saved[group] : {})
          .filter(([key, value]) => validAMRecord(key, value) && value.caseId === chapter.amId)
          .map(([, value]) => value);
      const checkpoints = matching('checkpoints').filter((value) =>
        validCheckpoint(value, chapter),
      );
      const records = matching('records');
      checkpoint = checkpoints.find((value) => value.run?.hero === selected) || null;
      record = records.find((value) => value.run?.hero === selected) || null;
      completed = records.some((value) => value.completed === true || value.everCompleted === true);
      hero = selected;
      heroLabel = DM.AfterMidnight.heroes.find((value) => value.id === selected).name;
    }
    return {
      id,
      chapterId: id,
      title: chapter.title,
      group: entry.group,
      source: entry.group,
      chapter,
      index,
      unlocked:
        entry.group !== 'campaign' ||
        chapter.index <= Math.floor(campaignNumber(source.campaign.reached)),
      checkpoint,
      record,
      completed,
      hero,
      heroLabel,
      theme: checkpoint?.run?.theme || chapter.theme || null,
    };
  }
  GP.moments = () => {
    const source = GP.sources();
    return registry().map((entry, index) => moment(entry, source, index));
  };
  GP.find = (id) =>
    GP.moments().find((entry) => entry.id === id || entry.chapter.amId === id) || null;

  GP.ledger = () => {
    const source = GP.sources();
    const campaign = stats(source.campaign.totals);
    for (const key of ['spared', 'memories'])
      campaign[key] = campaignNumber(source.campaign.totals?.[key]);
    campaign.unmade = campaignNumber(source.campaign.totals?.disintegrated);
    campaign.time = CAMPAIGN_IDS.reduce(
      (sum, id) => sum + campaignNumber(source.campaign.completed?.[id]?.time),
      0,
    );
    const bonus = { spared: 0, unmade: 0, memories: 0, time: 0 };
    const afterMidnight = { spared: 0, unmade: 0, memories: 0, time: 0 };
    const add = (to, from) => {
      const clean = stats(from);
      for (const key of Object.keys(to)) to[key] += clean[key];
    };
    for (const id of BONUS_IDS) {
      const record = source.bonus.completed?.[id];
      if (object(record)) add(bonus, record.stats);
    }
    const records = object(source.afterMidnight.records) ? source.afterMidnight.records : {};
    for (const [key, record] of Object.entries(records)) {
      if (validAMRecord(key, record)) add(afterMidnight, record.stats);
    }
    const total = { spared: 0, unmade: 0, memories: 0, time: 0 };
    for (const part of [campaign, bonus, afterMidnight]) {
      for (const key of Object.keys(total)) total[key] += part[key];
    }
    return {
      ...total,
      disintegrated: total.unmade,
      sources: { campaign, bonus, afterMidnight },
      note:
        'Campaign totals; latest retained bonus completions and After Midnight records. ' +
        'Replays follow each save slot’s rules.',
    };
  };

  GP.reflectionTier = (ledger = GP.ledger()) => {
    let id = 'balance';
    if (ledger.spared + ledger.unmade === 0) id = 'unwritten';
    else if (ledger.unmade > Math.max(4, ledger.spared * 1.5)) id = 'detached';
    else if (ledger.spared > 0 && ledger.spared >= ledger.unmade * 3) id = 'mercy';
    const tiers = {
      unwritten: [
        'UNWRITTEN GLASS',
        'The glass holds no weight yet. A choice is still a choice before it has a witness.',
      ],
      mercy: [
        'A HAND LEFT OPEN',
        'I remember the force I did not use. Those absences have become places where people can stand.',
      ],
      balance: [
        'TWO REFLECTIONS',
        'Some moments open a hand. Others close it. The glass refuses to pretend they are the same gesture.',
      ],
      detached: [
        'DISTANT WINDOWS',
        'I have made distance look like an answer. From here I can still see the ' +
          'spaces where people should be.',
      ],
    };
    const [title, text] = tiers[id];
    return { id, index: Object.keys(tiers).indexOf(id), title, text };
  };
  GP.reflection = (ledger) => GP.reflectionTier(ledger).text;
  GP.epilogueVariant = () => {
    const tier = GP.reflectionTier().id;
    return tier === 'mercy' ? 'return' : tier === 'detached' ? 'depart' : 'observe';
  };

  const details = {
    prologue: {
      label: 'A watch repaired',
      description: 'Repair the watch and complete the chamber calibration.',
      test: (state) => state.flags.repaired === true && state.flags.calibrated === true,
    },
    reassembly: {
      label: 'A form remembered',
      description: 'Finish with your human form fully reassembled.',
      test: (state) => state.flags.reassembled === true && state.player.form === 'manhattan',
    },
    superman: {
      label: 'Four lives kept',
      description: 'Spare at least four people during the chapter.',
      test: (state) => state.stats.spared >= 4,
    },
    deterrent: {
      label: 'A steady outline',
      description: 'Finish with at least three quarters of your coherence.',
      test: (state) =>
        state.player.maxCoherence > 0 && state.player.coherence >= state.player.maxCoherence * 0.75,
    },
    mars: {
      label: 'Every remembered year',
      description: 'Recover all six memories.',
      test: (state) => state.stats.memories >= 6,
    },
    karnak: {
      label: 'Silence in the storm',
      description: 'Shut down every tachyon emitter.',
      test: (state) =>
        Array.isArray(state.refs.emitters) &&
        state.refs.emitters.length >= 4 &&
        state.refs.emitters.every((entity) => entity.dead || entity.neutralized),
    },
    last_broadcast: {
      label: 'Names and voices',
      description: 'Recover every evidence record and rescue all three engineers.',
      test: (state) => state.flags.evidence === 7 && state.flags.engineers === 7,
    },
    ninth_minute: {
      label: 'Six beyond the second',
      description: 'Bring all six passengers to safety.',
      test: (state) => number(state.flags.passengers) >= 6,
    },
    long_summer: {
      label: 'A cooler street',
      description: 'Rescue all six residents and finish with City Heat below 30.',
      test: (state) => number(state.flags.rescued) >= 6 && number(state.flags.heat, Infinity) < 30,
    },
    am_dead_air: {
      label: 'Every intercepted trace',
      description: 'Recover all three traces and download the buyer list.',
      test: (state) => state.flags.clues === 7 && state.flags.downloaded === true,
    },
    am_undertow: {
      label: 'Four names aboard',
      description: 'Bring all four workers aboard and cast off.',
      test: (state) => number(state.flags.rescued) >= 4 && state.flags.departed === true,
    },
    am_glass_archive: {
      label: 'The archive returned',
      description: 'Recover the ledger, capture the Surveyor and return the archive.',
      test: (state) =>
        state.flags.ledger === true &&
        state.flags.surveyorCaptured === true &&
        state.flags.archiveReturned === true,
    },
  };

  GP.challengeDefs = (id) => {
    const chapter = registry().find(
      (entry) => entry.chapter.id === id || entry.chapter.amId === id,
    )?.chapter;
    if (!chapter) return [];
    const target = number(GP.timeTargets[chapter.id], 600);
    const detail = details[chapter.id];
    return [
      {
        id: 'mercy',
        type: 'unmade',
        label: 'No one unmade',
        description: 'Finish without unmaking a person.',
        test: (state) => state.stats.unmade === 0,
      },
      {
        id: 'swift',
        type: 'time',
        label: 'Before the hand moves',
        description: 'Finish in under ' + Math.round(target / 60) + ' minutes.',
        targetSeconds: target,
        test: (state) => state.stats.time > 0 && state.stats.time < target,
      },
      { id: 'detail', type: 'level', ...detail },
    ].map((definition) => ({ ...definition, name: definition.label }));
  };

  GP.sanitize = (raw) => {
    if (!object(raw) || raw.version !== 1)
      throw new Error('Choose a compatible Glass Palace save.');
    const out = fresh();
    for (const entry of registry()) {
      const id = entry.chapter.id;
      const values = raw.challenges?.[id];
      if (!object(values)) continue;
      const kept = {};
      for (const key of ['mercy', 'swift', 'detail']) if (values[key] === true) kept[key] = true;
      if (Object.keys(kept).length) out.challenges[id] = kept;
    }
    for (const id of ['return', 'observe', 'depart']) {
      if (raw.epilogueSeen?.[id] === true) out.epilogueSeen[id] = true;
    }
    out.visits = Math.floor(number(raw.visits));
    return out;
  };
  GP.load = () => {
    if (GP.data) return GP.data;
    GP.data = fresh();
    try {
      const text = localStorage.getItem(KEY);
      if (!text) return GP.data;
      if (text.length > 256 * 1024) throw new Error('The saved palace is too large.');
      const raw = JSON.parse(text);
      if (raw?.version > 1) {
        GP.readOnly = true;
        GP.available = false;
        GP.warning = 'A newer palace save is protected. This visit is session only.';
      } else GP.data = GP.sanitize(raw);
    } catch (_) {
      GP.readOnly = true;
      GP.available = false;
      GP.warning =
        'The saved palace could not be read. It is preserved; this visit is session only.';
    }
    return GP.data;
  };
  GP.write = () => {
    GP.load();
    if (GP.readOnly) return false;
    try {
      localStorage.setItem(KEY, JSON.stringify(GP.sanitize(GP.data)));
      GP.available = true;
      GP.warning = '';
      return true;
    } catch (_) {
      GP.available = false;
      GP.warning = 'Palace progress is session only because browser storage is unavailable.';
      return false;
    }
  };
  GP.fragmentCount = () => {
    const saved = GP.load().challenges;
    return registry().reduce((sum, entry) => {
      const values = saved[entry.chapter.id] || {};
      return sum + ['mercy', 'swift', 'detail'].filter((id) => values[id] === true).length;
    }, 0);
  };
  GP.maxFragments = () => registry().length * 3;
  GP.status = (id) => {
    const item = GP.find(id);
    if (!item) return null;
    const values = GP.load().challenges[item.id] || {};
    const challenges = GP.challengeDefs(item.id).map((definition) => ({
      ...definition,
      complete: values[definition.id] === true,
      earned: values[definition.id] === true,
    }));
    return {
      id: item.id,
      unlocked: item.unlocked,
      completed: item.completed,
      earned: challenges.filter((value) => value.complete).length,
      total: challenges.length,
      challenges,
      fragments: GP.fragmentCount(),
    };
  };
  GP.observeCompletion = (play) => {
    const chapter = play?.chapter;
    const ctx = play?.ctx;
    const item = chapter && GP.find(chapter.id);
    if (!item || item.chapter !== chapter || !ctx?.stats || play.failed || play.player?.down)
      return null;
    if (ctx.chapter !== chapter || ctx.scene !== play) return null;
    if (!play.player || (chapter.afterMidnight && chapter.kind !== 'story')) return null;
    if (observed.has(ctx)) return { momentId: item.id, ...GP.status(item.id), newlyEarned: [] };
    observed.add(ctx);
    const state = {
      stats: stats(ctx.stats),
      flags: { ...(ctx.persistedFlags?.() || {}), ...(ctx.flags || {}) },
      refs: ctx.refs || {},
      player: play.player,
    };
    const data = GP.load();
    const previous = data.challenges[item.id] || {};
    const next = { ...previous };
    const newlyEarned = [];
    const passed = [];
    for (const definition of GP.challengeDefs(item.id)) {
      if (!definition.test(state)) continue;
      passed.push(definition.id);
      if (!previous[definition.id]) newlyEarned.push(definition.id);
      next[definition.id] = true;
    }
    data.challenges[item.id] = next;
    if (newlyEarned.length) GP.write();
    return {
      momentId: item.id,
      ...GP.status(item.id),
      passed,
      newlyEarned,
      maxFragments: GP.maxFragments(),
    };
  };
  GP.epilogueReady = () => {
    const source = GP.sources();
    return (
      CAMPAIGN_IDS.every((id) => DM.Chapters?.get(id) && object(source.campaign.completed?.[id])) &&
      BONUS_IDS.every(
        (id) =>
          DM.Bonus?.list.some((chapter) => chapter.id === id) &&
          object(source.bonus.completed?.[id]),
      )
    );
  };
  GP.markEpilogueSeen = (variant = GP.epilogueVariant()) => {
    if (!GP.epilogueReady() || !['return', 'observe', 'depart'].includes(variant)) return false;
    GP.load().epilogueSeen[variant] = true;
    return GP.write();
  };
  GP.visit = () => {
    GP.load().visits++;
    return GP.write();
  };
})();
