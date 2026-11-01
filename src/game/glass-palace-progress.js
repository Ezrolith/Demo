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
  const fresh = () => ({
    version: 2, rulesVersion: 2, challenges: {}, awardVersions: {},
    epilogueSeen: {}, visits: 0, tracking: null, runs: {},
  });
  const observed = new WeakSet();
  const completionResults = new WeakMap();
  const stats = (source) => ({
    spared: number(source?.spared),
    unmade: number(source?.disintegrated ?? source?.unmade),
    memories: number(source?.memories),
    time: number(source?.time),
  });
  const campaignNumber = (value, fallback = 0) =>
    number(typeof value === 'string' && value.trim() !== '' ? Number(value) : value, fallback);
  GP.rulesVersion = 2;
  GP.key = KEY;
  GP.sourceKeys = { ...SOURCE_KEYS };
  GP.data = null;
  GP.available = true;
  GP.readOnly = false;
  GP.warning = '';
  GP.timeTargets = {
    prologue: 480,
    reassembly: 360,
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

  GP.challengeDefs = (id) => {
    const chapter = registry().find(
      (entry) => entry.chapter.id === id || entry.chapter.amId === id,
    )?.chapter;
    if (!chapter) return [];
    const target = number(GP.timeTargets[chapter.id], 600);
    return DM.PalaceChallengeRulesV2?.forMoment(chapter.id, target) || [];
  };

  function cleanTracking(value) {
    if (!object(value) || Object.keys(value).length !== 2) return null;
    if (!Object.keys(value).every((key) => ['momentId', 'challengeId'].includes(key))) return null;
    const chapter = registry().find((entry) => entry.chapter.id === value.momentId)?.chapter;
    if (!chapter || !['mercy', 'swift', 'detail'].includes(value.challengeId)) return null;
    return { momentId: chapter.id, challengeId: value.challengeId };
  }

  GP.challengeSnapshot = (play) => {
    const chapter = play?.chapter;
    const ctx = play?.ctx;
    const canonical = registry().find((entry) => entry.chapter === chapter);
    if (!canonical || !ctx?.stats || !play.player || ctx.chapter !== chapter || ctx.scene !== play) return null;
    if (chapter.afterMidnight && chapter.kind !== 'story') return null;
    return {
      chapter,
      stats: stats(ctx.stats),
      flags: { ...(ctx.persistedFlags?.() || {}), ...(ctx.flags || {}) },
      refs: ctx.refs || {},
      player: play.player,
      failed: !!(play.failed || play.player.down),
      run: GP.runEvidence?.(play) || null,
    };
  };

  function liveRow(chapter, state, definition, earned, awardVersion = 0) {
    const metNow = !!definition.test(state);
    const display = definition.live(state);
    const legacy = !!earned && awardVersion < GP.rulesVersion;
    const row = {
      ...display,
      momentId: chapter.id,
      challengeId: definition.id,
      label: definition.label,
      description: definition.description,
      earned: !!earned,
      awardVersion,
      legacy,
      metNow,
    };
    if (state.failed) {
      row.state = 'missed';
      row.reason = 'This attempt ended before the challenge could be completed.';
    }
    if (earned) {
      row.reason = legacy ? 'This fragment is retained from earlier challenge rules. ' +
        'The displayed condition describes the new rules; it cannot add another fragment.'
        : 'This fragment was recovered in an earlier run. Live progress describes this attempt; ' +
          'it cannot add another fragment.';
      if (state.failed) row.reason += ' This attempt ended before completion.';
    }
    return row;
  }

  GP.liveChallenge = (play, challengeId) => {
    const state = GP.challengeSnapshot(play);
    if (!state) return null;
    const definition = GP.challengeDefs(state.chapter.id).find((entry) => entry.id === challengeId);
    if (!definition) return null;
    const earned = GP.data?.challenges?.[state.chapter.id]?.[definition.id] === true;
    const awardVersion = GP.data?.awardVersions?.[state.chapter.id]?.[definition.id] || (earned ? 1 : 0);
    return liveRow(state.chapter, state, definition, earned, awardVersion);
  };

  GP.sanitize = (raw) => {
    if (!object(raw) || ![1, 2].includes(raw.version) ||
      (raw.rulesVersion !== undefined && ![1, 2].includes(raw.rulesVersion)))
      throw new Error('Choose a compatible Glass Palace save.');
    const out = fresh();
    for (const entry of registry()) {
      const id = entry.chapter.id;
      const values = raw.challenges?.[id];
      if (!object(values)) continue;
      const kept = {};
      for (const key of ['mercy', 'swift', 'detail']) if (values[key] === true) kept[key] = true;
      if (Object.keys(kept).length) {
        out.challenges[id] = kept;
        out.awardVersions[id] = {};
        for (const key of Object.keys(kept)) {
          out.awardVersions[id][key] = raw.version === 2 && raw.awardVersions?.[id]?.[key] === 2 ? 2 : 1;
        }
      }
    }
    for (const id of ['return', 'observe', 'depart']) {
      if (raw.epilogueSeen?.[id] === true) out.epilogueSeen[id] = true;
    }
    out.visits = Math.floor(number(raw.visits));
    out.tracking = cleanTracking(raw.tracking);
    if (raw.version === 2 && object(raw.runs) && GP.cleanRunCheckpoint) {
      for (const [key, value] of Object.entries(raw.runs)) {
        const clean = GP.cleanRunCheckpoint(value, key);
        if (clean) out.runs[key] = clean;
      }
    }
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
      if (raw?.version > 2 || raw?.rulesVersion > 2) {
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
  GP.tracking = () => cleanTracking(GP.load().tracking);
  GP.pinChallenge = (momentId, challengeId) => {
    const moment = GP.find(momentId);
    if (!moment?.unlocked || !GP.challengeDefs(moment.id).some((definition) => definition.id === challengeId)) return false;
    const pin = { momentId: moment.id, challengeId };
    const data = GP.load();
    if (data.tracking?.momentId === pin.momentId && data.tracking?.challengeId === pin.challengeId) return true;
    data.tracking = pin;
    GP.write();
    return true;
  };
  GP.clearTracking = () => {
    const data = GP.load();
    if (!data.tracking) return true;
    data.tracking = null;
    GP.write();
    return true;
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
    const data = GP.load();
    const values = data.challenges[item.id] || {};
    const versions = data.awardVersions?.[item.id] || {};
    const challenges = GP.challengeDefs(item.id).map((definition) => ({
      ...definition,
      complete: values[definition.id] === true,
      earned: values[definition.id] === true,
      awardVersion: values[definition.id] === true ? versions[definition.id] || 1 : 0,
      legacy: values[definition.id] === true && (versions[definition.id] || 1) < GP.rulesVersion,
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
    if (observed.has(ctx)) {
      const previousResult = completionResults.get(ctx);
      return { ...previousResult, momentId: item.id, ...GP.status(item.id), newlyEarned: [] };
    }
    observed.add(ctx);
    const state = GP.challengeSnapshot(play);
    const data = GP.load();
    const previous = data.challenges[item.id] || {};
    if (!object(data.awardVersions)) data.awardVersions = {};
    const versions = { ...(data.awardVersions[item.id] || {}) };
    for (const key of Object.keys(previous)) if (previous[key] && !versions[key]) versions[key] = 1;
    const next = { ...previous };
    const newlyEarned = [];
    const passed = [];
    const breakdown = [];
    for (const definition of GP.challengeDefs(item.id)) {
      const row = liveRow(chapter, state, definition, previous[definition.id], versions[definition.id] || 0);
      const outcome = previous[definition.id] ? 'already' : row.metNow ? 'new' : 'missed';
      breakdown.push(Object.freeze({
        id: definition.id,
        label: definition.label,
        description: definition.description,
        outcome,
        passed: row.metNow,
        progress: row.progress,
        awardVersion: previous[definition.id] ? versions[definition.id] || 1 : row.metNow ? 2 : 0,
        legacy: !!previous[definition.id] && (versions[definition.id] || 1) < GP.rulesVersion,
        reason: previous[definition.id] ? (versions[definition.id] || 1) < GP.rulesVersion
          ? 'Fragment retained from earlier rules. New condition ' + (row.metNow ? 'met' : 'not met') + ' this run.'
          : 'Recovered in an earlier run. Current condition ' + (row.metNow ? 'met' : 'not met') + '.'
          : row.metNow ? 'Requirement met at completion under rules version 2.'
            : 'Requirement not met at completion: ' + row.progress + '. ' + row.reason,
      }));
      if (row.metNow) {
        passed.push(definition.id);
        if (!previous[definition.id]) {
          newlyEarned.push(definition.id);
          versions[definition.id] = GP.rulesVersion;
        }
        next[definition.id] = true;
      }
    }
    data.challenges[item.id] = next;
    data.awardVersions[item.id] = versions;
    if (newlyEarned.length) GP.write();
    const result = {
      momentId: item.id,
      ...GP.status(item.id),
      passed,
      newlyEarned,
      maxFragments: GP.maxFragments(),
      breakdown: Object.freeze(breakdown),
    };
    completionResults.set(ctx, result);
    return result;
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
