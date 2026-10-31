/* Thirty-six optional palace goals. Published matrix precedes these rules. */
(function () {
  'use strict';
  const DM = window.DM;
  const VERSION = 2;
  const finite = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1e9;
  const count = (value) => finite(value) ? Math.floor(value) : null;
  const clock = (value) => DM.U.fmtTime(Math.max(0, finite(value) ? value : 0));
  const bits = (value) => [1, 2, 4].filter((bit) => (value || 0) & bit).length;
  const runFor = (state, id) => state.run?.rulesVersion === VERSION && state.run.chapterId === id ? state.run : null;
  const full = (state, id) => runFor(state, id)?.eligible === true;
  const needsFresh = 'Start a fresh run, or resume its matching rules-v2 checkpoint, to establish this condition.';
  const targets = {
    prologue: 480, reassembly: 360, superman: 480, deterrent: 540, mars: 600, karnak: 600,
    last_broadcast: 600, ninth_minute: 720, long_summer: 720,
    am_dead_air: 480, am_undertow: 600, am_glass_archive: 480,
  };
  const speedNames = {
    prologue: 'Before the chamber seals', reassembly: 'A quickened pattern', superman: 'Before the pier sleeps',
    deterrent: 'Before the next warhead', mars: 'Before the red dust settles', karnak: 'Before the last hand turns',
    last_broadcast: 'Before the carrier signs off', ninth_minute: 'Beyond the ninth minute',
    long_summer: 'Before the street burns out', am_dead_air: 'Before the channel closes',
    am_undertow: 'Before the tide turns', am_glass_archive: 'Before the gallery goes dark',
  };

  function definition(id, label, description, predicate, describe, type = 'level') {
    return {
      id, label, name: label, description, type, rulesVersion: VERSION,
      test: (state) => !state.failed && !!predicate(state),
      live(state) {
        const metNow = !state.failed && !!predicate(state);
        return {
          metNow,
          state: metNow ? 'ready' : 'pending',
          progress: '',
          reason: metNow ? 'Condition met so far. Finish the moment to recover its fragment.' : description,
          current: null,
          target: null,
          ...describe(state, metNow),
        };
      },
    };
  }

  function cleanBudget(id, slot, label, description, field, target, coverage, unit, complete = () => true) {
    const observed = (state) => {
      const run = runFor(state, id);
      return full(state, id) && run && coverage(run) && finite(run[field]);
    };
    return definition(slot, label, description,
      (state) => observed(state) && complete(runFor(state, id)) && runFor(state, id)[field] <= target,
      (state) => {
        const run = runFor(state, id);
        const value = run && finite(run[field]) ? run[field] : null;
        const known = observed(state);
        return {
          current: value, target,
          progress: !known ? 'Fresh-run evidence required' : Math.ceil(value * 10) / 10 + ' ' + unit + ' · Limit ' + target,
          state: !known ? 'pending' : value > target ? 'missed' : 'viable',
          reason: !known ? needsFresh : value > target ? 'The run exceeded this limit. Retry retains the observed total.'
            : 'Within the limit so far. Finish without exceeding it; Retry retains the total.',
        };
      }, 'budget');
  }

  function interaction(id, slot, label, description, field, target, text) {
    return definition(slot, label, description,
      (state) => {
        const value = runFor(state, id)?.[field];
        return target === true ? value === true : finite(value) && value >= target;
      },
      (state) => {
        const value = runFor(state, id)?.[field];
        const current = target === true ? value === true ? 1 : 0 : count(value) || 0;
        return { current, target: target === true ? 1 : target, progress: current + ' / ' +
          (target === true ? 1 : target) + ' ' + text };
      });
  }

  function cleanFight(id, label, description, prefix) {
    const known = (state) => {
      const run = runFor(state, id);
      return full(state, id) && run?.[prefix + 'Seen'] === true && finite(run[prefix + 'Disintegrations']);
    };
    return definition('mercy', label, description,
      (state) => known(state) && runFor(state, id)[prefix + 'Defeated'] === true &&
        runFor(state, id)[prefix + 'Disintegrations'] === 0,
      (state) => {
        const run = runFor(state, id);
        const value = run && finite(run[prefix + 'Disintegrations']) ? run[prefix + 'Disintegrations'] : null;
        return {
          current: value, target: 0,
          progress: !known(state) ? 'Fight evidence not available' : value + ' Disintegrate casts during this fight',
          state: !known(state) ? 'pending' : value > 0 ? 'missed' : run[prefix + 'Defeated'] ? 'ready' : 'viable',
          reason: !known(state) ? needsFresh : value > 0 ? 'Disintegrate was fired during the fight. Retry retains that cast.'
            : 'Use the other powers to finish this fight. The killing cast counts too.',
        };
      }, 'restraint');
  }

  function mercy(id, label) {
    return cleanBudget(id, 'mercy', label,
      'Fresh run: finish without unmaking a person; Retry retains outcomes.', 'unmade', 0, () => true, 'people unmade');
  }

  function primary(id) {
    if (id === 'prologue') return interaction(id, 'mercy', 'Palisades Park',
      'Look at the workshop photograph before leaving Gila Flats.', 'photoSeen', true, 'photograph inspected');
    if (id === 'reassembly') return cleanBudget(id, 'mercy', 'Keep the pattern',
      'Fresh run: lose no carried atoms to vortices; Retry retains losses.', 'vortexAtomsLost', 0, () => true, 'atoms lost');
    if (id === 'superman') return mercy(id, 'A hand left open');
    if (id === 'deterrent') return cleanFight(id, 'Return fire',
      'Fresh run: defeat the Behemoth without firing Disintegrate during its fight.', 'behemoth');
    if (id === 'mars') return cleanBudget(id, 'mercy', 'Weather the red sky',
      'Fresh run: take no meteor damage on Mars; Retry retains hits.', 'marsDamage', 0,
      (run) => run.marsSeen === true, 'meteor damage');
    if (id === 'karnak') return cleanFight(id, 'Hands, not light',
      'Fresh run: defeat Veidt without firing Disintegrate during his fight.', 'veidt');
    if (id === 'last_broadcast') return mercy(id, 'Bring them home');
    if (id === 'ninth_minute') return mercy(id, 'A second chance');
    if (id === 'long_summer') return mercy(id, 'A city left standing');
    const budget = { am_dead_air: 80, am_undertow: 100, am_glass_archive: 120 }[id];
    const label = { am_dead_air: 'A clean frequency', am_undertow: 'A steady crossing', am_glass_archive: 'An unbroken line' }[id];
    return cleanBudget(id, 'mercy', label,
      'Fresh run: take at most ' + budget + ' total health damage; healing and Retry do not reset it.',
      'damageTaken', budget, () => true, 'total health damage');
  }

  function detail(id) {
    if (id === 'prologue') return definition('detail', 'Beyond the assignment',
      'Read the chalkboard, listen to the canteen radio and check the records files.',
      (state) => runFor(state, id)?.researchMask === 7,
      (state) => ({ current: bits(runFor(state, id)?.researchMask), target: 3,
        progress: bits(runFor(state, id)?.researchMask) + ' / 3 optional observations' }));
    if (id === 'reassembly') return interaction(id, 'detail', 'A gentler pull',
      'Absorb 30 atoms while Coalesce is not held, then finish the reconstruction.', 'passiveAtoms', 30, 'passively gathered atoms');
    if (id === 'superman') return interaction(id, 'detail', "Someone's badge",
      'Inspect the smiley-face badge in the pier office before finishing.', 'badgeSeen', true, 'badge inspected');
    if (id === 'deterrent') return definition('detail', 'A steady outline',
      'Have at least 75% coherence when the Behemoth falls, before the safe outro.',
      (state) => {
        const run = runFor(state, id);
        return full(state, id) && run?.behemothSeen === true && run.behemothDefeated === true &&
          finite(run.behemothCoherence) && finite(run.behemothMaxCoherence) && run.behemothMaxCoherence > 0 &&
          run.behemothCoherence >= run.behemothMaxCoherence * 0.75;
      },
      (state, metNow) => {
        const run = runFor(state, id);
        const frozen = full(state, id) && run?.behemothSeen === true && run.behemothDefeated === true &&
          finite(run.behemothCoherence) && finite(run.behemothMaxCoherence) && run.behemothMaxCoherence > 0;
        const value = frozen ? run.behemothCoherence / run.behemothMaxCoherence * 100 : null;
        return { current: value, target: 75, state: frozen ? metNow ? 'ready' : 'missed' : 'pending',
          progress: value === null ? 'Measured when the Behemoth falls' : Math.floor(value) + '% coherence at combat end',
          reason: frozen ? 'This value was frozen before the safe outro; later healing does not change it.' : needsFresh };
      });
    if (id === 'mars') return definition('detail', 'Every remembered year',
      'Recover all six optional memories in this run.', (state) => state.stats.memories >= 6,
      (state) => ({ current: state.stats.memories, target: 6, progress: Math.floor(state.stats.memories) + ' / 6 memories found' }));
    if (id === 'karnak') return cleanBudget(id, 'detail', 'A quiet approach',
      'Fresh run: take at most 40 coherence damage before the last courtyard emitter falls.',
      'emittersDamage', 40, (run) => run.emittersSeen === true, 'courtyard damage', (run) => run.emittersComplete === true);
    if (id === 'last_broadcast') return definition('detail', 'Names on the air',
      'Recover all three evidence records and choose to broadcast them.',
      (state) => state.flags.evidence === 7 && state.flags.choice === 'broadcast',
      (state) => ({ current: bits(state.flags.evidence), target: 3,
        progress: bits(state.flags.evidence) + ' / 3 records · Choice ' + (state.flags.choice || 'not yet made') }));
    if (id === 'ninth_minute') return definition('detail', 'Three lost moments',
      'Use Temporal Sight to find and hear all three optional gold echoes.', (state) => state.flags.moments === 7,
      (state) => ({ current: bits(state.flags.moments), target: 3, progress: bits(state.flags.moments) + ' / 3 lost moments heard' }));
    if (id === 'long_summer') return definition('detail', 'A cooler street',
      'Rescue all six residents and finish with City Heat below 30.',
      (state) => finite(state.flags.rescued) && state.flags.rescued >= 6 && finite(state.flags.heat) && state.flags.heat < 30,
      (state) => ({ current: finite(state.flags.rescued) ? state.flags.rescued : 0, target: 6,
        progress: (count(state.flags.rescued) || 0) + ' / 6 residents · Heat ' +
          (finite(state.flags.heat) ? Math.floor(state.flags.heat) : 'unknown') + ' (below 30)' }));
    const label = { am_dead_air: 'Off the call sheet', am_undertow: 'Not listed as cargo',
      am_glass_archive: 'The missing catalogue' }[id];
    const description = {
      am_dead_air: 'Read the optional tower-maintenance note and dispatch handover note on the roofs.',
      am_undertow: 'Read the optional pier lease and cargo tally beside the harbour stores.',
      am_glass_archive: 'Read the optional loan register and private index in the museum side galleries.',
    }[id];
    return definition('detail', label, description, (state) => runFor(state, id)?.fieldNotesMask === 3,
      (state) => ({ current: [1, 2].filter((bit) => (runFor(state, id)?.fieldNotesMask || 0) & bit).length, target: 2,
        progress: [1, 2].filter((bit) => (runFor(state, id)?.fieldNotesMask || 0) & bit).length + ' / 2 optional field notes' }));
  }

  function swift(id, target) {
    const known = (state) => full(state, id) && finite(state.stats.time);
    const rule = definition('swift', speedNames[id], 'Finish a fresh run in under ' + Math.round(target / 60) + ' minutes.',
      (state) => known(state) && state.stats.time > 0 && state.stats.time < target,
      (state) => ({ current: state.stats.time, target,
        progress: clock(state.stats.time) + ' / ' + clock(target) + ' · ' + clock(Math.max(0, target - state.stats.time)) + ' left',
        state: !known(state) ? 'pending' : state.stats.time >= target ? 'missed' : 'viable',
        reason: !known(state) ? needsFresh : state.stats.time >= target ? 'This run reached the strict time target.'
          : 'Finish below the target. Pause stops the field timer; checkpoint carry supplies resumed time.' }), 'time');
    rule.targetSeconds = target;
    return rule;
  }

  DM.PalaceChallengeRulesV2 = {
    version: VERSION,
    targets,
    forMoment(id, target = targets[id]) {
      if (!Object.hasOwn(targets, id)) return [];
      return [primary(id), swift(id, target), detail(id)];
    },
  };
})();
