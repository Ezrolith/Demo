/* Portable palace progress. Existing campaign, bonus and case slots are never written. */
(function () {
  'use strict';
  const DM = window.DM;
  const GP = DM.GlassPalace;
  const FORMAT = 'dr-manhattan.glass-palace.backup';
  const LIMIT = 256 * 1024;
  const object = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
  const bytes = (text) => new TextEncoder().encode(text).length;
  const only = (value, keys) => object(value) && Object.keys(value).every((key) => keys.includes(key));

  function summary(data) {
    const countFragments = Object.values(data.challenges).reduce(
      (count, values) => count + Object.values(values).filter((value) => value === true).length,
      0,
    );
    const countEpilogues = Object.values(data.epilogueSeen).filter((value) => value === true).length;
    return { data, countFragments, countEpilogues, visits: data.visits };
  }

  function validated(raw) {
    const fields = ['version', 'challenges', 'epilogueSeen', 'visits', 'tracking'];
    if (raw?.version === 2) fields.push('rulesVersion', 'awardVersions', 'runs');
    if (!only(raw, fields) || ![1, 2].includes(raw.version))
      throw new Error('Choose compatible Glass Palace progress.');
    if (raw.rulesVersion !== undefined && ![1, 2].includes(raw.rulesVersion))
      throw new Error('The backup uses incompatible palace challenge rules.');
    if (!object(raw.challenges) || !object(raw.epilogueSeen))
      throw new Error('The palace progress records are invalid.');
    if (!Number.isInteger(raw.visits) || raw.visits < 0 || raw.visits > 1e9)
      throw new Error('The palace visit count is invalid.');
    const ids = GP.moments().map((moment) => moment.id);
    if (raw.tracking !== undefined && raw.tracking !== null) {
      if (!only(raw.tracking, ['momentId', 'challengeId']) || !ids.includes(raw.tracking.momentId) ||
        !['mercy', 'swift', 'detail'].includes(raw.tracking.challengeId))
        throw new Error('The backup contains an invalid tracked challenge.');
    }
    for (const [id, values] of Object.entries(raw.challenges)) {
      if (!ids.includes(id) || !only(values, ['mercy', 'swift', 'detail']))
        throw new Error('The backup contains an unavailable moment or challenge.');
      if (Object.values(values).some((value) => value !== true))
        throw new Error('The backup contains an invalid challenge record.');
    }
    if (!only(raw.epilogueSeen, ['return', 'observe', 'depart']))
      throw new Error('The backup contains an unavailable reflection.');
    if (Object.values(raw.epilogueSeen).some((value) => value !== true))
      throw new Error('The backup contains an invalid reflection record.');
    if (raw.awardVersions !== undefined) {
      if (!object(raw.awardVersions)) throw new Error('The award rule records are invalid.');
      for (const [id, versions] of Object.entries(raw.awardVersions)) {
        if (!ids.includes(id) || !only(versions, ['mercy', 'swift', 'detail']))
          throw new Error('The backup contains an unavailable award rule.');
        for (const [slot, version] of Object.entries(versions)) {
          if (![1, 2].includes(version) || raw.challenges[id]?.[slot] !== true)
            throw new Error('The backup contains an invalid award rule record.');
        }
      }
    }
    if (raw.runs !== undefined) {
      if (!object(raw.runs)) throw new Error('The palace run checkpoints are invalid.');
      for (const [key, value] of Object.entries(raw.runs)) {
        if (!GP.cleanRunCheckpoint?.(value, key)) throw new Error('The backup contains an invalid run checkpoint.');
      }
    }
    return GP.sanitize(raw);
  }

  const Backup = (GP.Backup = {
    encode() {
      const data = GP.sanitize(GP.load());
      const text = JSON.stringify({ format: FORMAT, version: 1, data }, null, 2);
      if (bytes(text) > LIMIT) throw new Error('The palace backup is too large.');
      return text;
    },
    decode(text) {
      if (typeof text !== 'string' || bytes(text) > LIMIT)
        throw new Error('Choose a palace backup smaller than 256 KiB.');
      let packet;
      try {
        packet = JSON.parse(text, (key, value) => {
          if (['__proto__', 'constructor', 'prototype'].includes(key))
            throw new Error('Unsafe backup field.');
          return value;
        });
      } catch (_) {
        throw new Error('The palace backup could not be read.');
      }
      if (!only(packet, ['format', 'version', 'data']) || packet.format !== FORMAT || packet.version !== 1)
        throw new Error('Choose a compatible Glass Palace backup.');
      return summary(validated(packet.data));
    },
    restore(text) {
      const result = Backup.decode(text);
      if (GP.readOnly) throw new Error('The existing palace save is protected. Use a compatible game copy.');
      let existing;
      try {
        existing = localStorage.getItem(GP.key);
      } catch (_) {
        throw new Error('Saving is blocked. Keep your backup and enable browser storage.');
      }
      if (existing) {
        try {
          GP.sanitize(JSON.parse(existing));
        } catch (_) {
          throw new Error('The existing palace save is protected. Keep it before using a compatible game copy.');
        }
      }
      try {
        localStorage.setItem(GP.key, JSON.stringify(result.data));
      } catch (_) {
        throw new Error('Saving is blocked. Keep your backup and enable browser storage.');
      }
      GP.data = result.data;
      GP.available = true;
      GP.readOnly = false;
      GP.warning = '';
      return result;
    },
  });

  class BackupScreen {
    constructor(hub) {
      this.hub = hub;
      this.opaque = false;
      this.cursor = 'pointer';
      this.closed = false;
      this.selection = 0;
    }
    enter() {
      DM.Input.clearAll();
      this.closed = false;
      const root = document.createElement('div');
      this.root = root;
      root.id = 'glass-palace-backup';
      root.setAttribute('role', 'dialog');
      root.setAttribute('aria-modal', 'true');
      root.setAttribute('aria-labelledby', 'glass-palace-backup-title');
      root.style.cssText =
        'position:fixed;inset:0;z-index:10;display:grid;place-items:center;background:' +
        '#030810ef;color:#e8dfca;font:16px/1.6 system-ui;overflow:auto';
      const card = document.createElement('section');
      card.style.cssText =
        'width:min(86vw,620px);box-sizing:border-box;padding:28px;background:#101f2c;border:1px solid #a38a5c';
      const title = document.createElement('h2');
      title.id = 'glass-palace-backup-title';
      title.textContent = 'GLASS PALACE BACKUP';
      const note = document.createElement('p');
      note.textContent =
        'Export before restoring. Restore replaces palace fragments, reflection history, ' +
        'tracked challenge, run evidence and visits only. ' +
        'Campaign, bonus and After Midnight progress and settings stay unchanged.';
      const status = document.createElement('p');
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      status.style.minHeight = '55px';
      const button = (text, action) => {
        const element = document.createElement('button');
        element.type = 'button';
        element.textContent = text;
        element.style.cssText =
          'display:block;width:100%;padding:13px;margin:12px 0;background:#203d50;' +
          'border:1px solid #8196a2;color:#f1e4c8;font:600 15px system-ui;cursor:pointer';
        element.onclick = action;
        return element;
      };
      const exportButton = button('EXPORT PALACE PROGRESS', () => {
        try {
          const url = URL.createObjectURL(new Blob([Backup.encode()], { type: 'application/json' }));
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = 'glass-palace-progress.json';
          anchor.click();
          setTimeout(() => URL.revokeObjectURL(url), 30000);
          status.textContent = 'Keep the downloaded JSON file with your game. Session progress is included.';
        } catch (error) {
          status.textContent = error.message;
        }
      });
      const label = document.createElement('label');
      label.textContent = 'Choose a Glass Palace backup to preview: ';
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      label.append(input);
      let pending = null;
      const restore = button('RESTORE THIS PALACE PROGRESS', () => {
        if (!pending || this.closed) return;
        try {
          const result = Backup.restore(pending);
          status.textContent =
            'Restored ' + result.countFragments + ' fragment(s) and ' + result.countEpilogues + ' reflection(s).';
          pending = null;
          restore.disabled = true;
          back.focus();
        } catch (error) {
          status.textContent = error.message;
        }
      });
      restore.disabled = true;
      input.onchange = async () => {
        const request = ++this.selection;
        pending = null;
        restore.disabled = true;
        const file = input.files[0];
        if (!file) {
          status.textContent = 'No backup is selected.';
          return;
        }
        try {
          if (file.size > LIMIT) throw new Error('Choose a palace backup smaller than 256 KiB.');
          const text = await file.text();
          if (this.closed || !root.isConnected || request !== this.selection) return;
          const result = Backup.decode(text);
          pending = text;
          restore.disabled = false;
          status.textContent =
            result.countFragments + ' fragment(s) and ' + result.countEpilogues +
            ' reflection(s) ready. Press Restore to replace palace progress only.';
        } catch (error) {
          if (!this.closed && root.isConnected && request === this.selection)
            status.textContent = error.message;
        }
      };
      const close = () => {
        if (this.closed) return;
        DM.Input.clearAll();
        DM.Engine.pop();
        DM.Engine.canvas.focus({ preventScroll: true });
      };
      const back = button('BACK TO THE PALACE', close);
      this.keydown = (event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          close();
        } else if (event.key === 'Tab') {
          const focusable = [...card.querySelectorAll('button,input')].filter((node) => !node.disabled);
          const index = focusable.indexOf(document.activeElement);
          if (event.shiftKey && index <= 0) {
            event.preventDefault();
            focusable.at(-1).focus();
          } else if (!event.shiftKey && (index < 0 || index === focusable.length - 1)) {
            event.preventDefault();
            focusable[0].focus();
          }
          event.stopPropagation();
        } else event.stopPropagation();
      };
      document.addEventListener('keydown', this.keydown, true);
      card.append(title, note, exportButton, label, restore, status, back);
      root.append(card);
      document.body.append(root);
      exportButton.focus();
    }
    exit() {
      this.closed = true;
      this.selection++;
      document.removeEventListener('keydown', this.keydown, true);
      this.root?.remove();
    }
    update() {}
    render() {}
  }

  GP.BackupScreen = BackupScreen;
})();
