/* Bonus-only backups. No campaign/settings writes and no engine/input replacements. */
(function () {
  'use strict';
  const DM = window.DM;
  const KEY = 'dr-manhattan.bonus.v1';
  const FORMAT = 'dr-manhattan-bonus-backup';
  const LIMIT = 256 * 1024;
  const copy = value => JSON.parse(JSON.stringify(value));
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

  function stats(source) {
    const out = {};
    for (const key of ['time', 'spared', 'disintegrated', 'memories']) {
      const value = source && own(source, key) ? source[key] : 0;
      if (!Number.isFinite(value) || value < 0 || value > 1e9) throw new Error('Invalid progress totals.');
      out[key] = value;
    }
    return out;
  }

  function flags(source, chapter) {
    const out = {};
    for (const key of chapter.persistFlags || []) {
      if (!source || !own(source, key)) continue;
      const value = source[key];
      const valid = typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 1e9) ||
        (typeof value === 'string' && value.length <= 512);
      if (!valid) throw new Error('Invalid adventure state.');
      out[key] = value;
    }
    return out;
  }

  function validate(text) {
    if (typeof text !== 'string' || text.length > LIMIT) throw new Error('The backup is too large.');
    let packet;
    try {
      packet = JSON.parse(text, (key, value) => {
        if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('Unsafe backup field.');
        return value;
      });
    } catch (_) {
      throw new Error('This is not a valid bonus backup.');
    }
    if (!object(packet) || packet.format !== FORMAT || packet.version !== 1 || !object(packet.bonus) ||
      packet.bonus.version !== 1) throw new Error('This backup belongs to a different game or version.');
    const source = packet.bonus;
    if (!object(source.checkpoints) || !object(source.completed)) throw new Error('The backup is missing its records.');
    const out = { version: 1, checkpoints: {}, completed: {}, deaths: 0 };
    for (const group of ['checkpoints', 'completed']) {
      for (const id of Object.keys(source[group])) {
        const chapter = DM.Bonus.list.find(ch => ch.id === id);
        if (!chapter) throw new Error('This backup contains an adventure not present in this version.');
        const record = source[group][id];
        if (!object(record)) throw new Error('Invalid adventure record.');
        if (group === 'checkpoints') {
          if (!Number.isInteger(record.stage) || record.stage < 0 || record.stage >= chapter.stages.length) {
            throw new Error('Invalid checkpoint.');
          }
          if (record.carry != null && !object(record.carry)) throw new Error('Invalid checkpoint data.');
          out.checkpoints[id] = { stage: record.stage, carry: record.carry == null ? null : {
            stats: stats(record.carry.stats), flags: flags(record.carry.flags, chapter), found: [],
          } };
        } else {
          out.completed[id] = { stats: stats(record.stats), flags: flags(record.flags, chapter) };
        }
      }
    }
    if (!Number.isFinite(source.deaths) || source.deaths < 0 || source.deaths > 1e9) {
      throw new Error('Invalid retry count.');
    }
    out.deaths = Math.floor(source.deaths);
    return out;
  }

  const Backup = {
    encode() {
      const packet = { format: FORMAT, version: 1, savedAt: new Date().toISOString(), bonus: DM.Bonus.load() };
      // Export the same validated shape that can be restored, not arbitrary objects.
      packet.bonus = validate(JSON.stringify(packet));
      return JSON.stringify(packet, null, 2);
    },
    validate,
    restore(text) {
      const incoming = validate(text);
      const next = copy(DM.Bonus.load());
      const ids = Object.keys({ ...incoming.checkpoints, ...incoming.completed });
      for (const id of ids) {
        delete next.checkpoints[id];
        delete next.completed[id];
      }
      for (const group of ['checkpoints', 'completed']) {
        for (const id of Object.keys(incoming[group])) next[group][id] = incoming[group][id];
      }
      next.deaths = Math.max(next.deaths || 0, incoming.deaths);
      // Commit storage first. A blocked browser must not pretend the restore persisted.
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch (_) {
        throw new Error('Your browser blocked saving. Keep the backup and enable site storage before restoring.');
      }
      DM.Bonus.data = next;
      DM.Bonus.available = true;
      return Object.keys({ ...incoming.checkpoints, ...incoming.completed }).length;
    },
    open() {
      DM.Input.clearAll();
      DM.Engine.push(new BackupScreen());
    },
  };

  class BackupScreen {
    constructor() {
      this.cursor = 'pointer';
      this.t = 0;
    }
    enter() {
      const root = document.createElement('div');
      root.id = 'bonus-backup';
      root.setAttribute('role', 'dialog');
      root.setAttribute('aria-modal', 'true');
      root.setAttribute('aria-labelledby', 'bonus-backup-title');
      root.style.cssText = 'position:fixed;inset:0;z-index:5;display:grid;place-items:center;background:#04080eea;' +
        'font:16px/1.6 system-ui,sans-serif;color:#e5e0d2;overflow:auto;cursor:auto';
      const card = document.createElement('section');
      card.style.cssText = 'box-sizing:border-box;width:min(92vw,660px);padding:28px;border:1px solid #677988;' +
        'background:#0a1420;box-shadow:0 0 60px #0008';
      const title = document.createElement('h2');
      title.id = 'bonus-backup-title';
      title.textContent = 'BONUS SAVE BACKUP';
      title.style.cssText = 'margin:0 0 14px;color:#e3ba68;font-size:24px;letter-spacing:3px';
      const info = document.createElement('p');
      info.textContent = 'Carry bonus progress into another downloaded copy or browser. This never changes your campaign or settings.';
      const note = document.createElement('p');
      note.textContent = 'Restore replaces only the bonus records listed in the backup. Export your current progress first.';
      const status = document.createElement('p');
      status.id = 'bonus-backup-status';
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      status.style.cssText = 'min-height:52px;color:#9bd5e1';
      const button = (label, action) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = label;
        b.style.cssText = 'display:block;box-sizing:border-box;width:100%;margin:12px 0;padding:12px;' +
          'border:1px solid #738c9e;background:#11283a;color:#f1e8d1;font:600 15px system-ui;cursor:pointer';
        b.addEventListener('click', action);
        return b;
      };
      const exportButton = button('EXPORT BONUS BACKUP', () => {
        try {
          const blob = new Blob([Backup.encode()], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = 'dr-manhattan-bonus-backup.json';
          root.appendChild(link);
          link.click();
          link.remove();
          setTimeout(() => URL.revokeObjectURL(url), 30000);
          status.textContent = 'Backup prepared. Keep the downloaded JSON file with your game.';
        } catch (error) {
          status.textContent = error.message;
        }
      });
      const label = document.createElement('label');
      label.textContent = 'Choose a bonus backup to inspect: ';
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.id = 'bonus-backup-file';
      input.style.cssText = 'display:block;max-width:100%;margin-top:8px;color:#b9d6e0;font:14px system-ui';
      label.appendChild(input);
      let pending = null;
      let selection = 0;
      const restoreButton = button('RESTORE THIS BACKUP', () => {
        if (!pending) return;
        try {
          const count = Backup.restore(pending);
          status.textContent = `Restored ${count} bonus adventure record(s). Campaign and settings unchanged.`;
          pending = null;
          restoreButton.disabled = true;
        } catch (error) {
          status.textContent = error.message;
        }
      });
      restoreButton.disabled = true;
      input.addEventListener('change', async () => {
        const request = ++selection;
        pending = null;
        restoreButton.disabled = true;
        const file = input.files[0];
        if (!file) return;
        try {
          if (file.size > LIMIT) throw new Error('The backup is too large.');
          const text = await file.text();
          if (!root.isConnected || request !== selection) return;
          const record = validate(text);
          const ids = Object.keys({ ...record.checkpoints, ...record.completed });
          if (!ids.length) throw new Error('This backup has no adventure progress to restore.');
          status.textContent = 'Ready to restore: ' + ids.map(id => DM.Bonus.list.find(ch => ch.id === id).title).join(', ') + '.';
          pending = text;
          restoreButton.disabled = false;
        } catch (error) {
          if (!root.isConnected || request !== selection) return;
          status.textContent = error.message;
        }
      });
      const close = () => {
        DM.Input.clearAll();
        if (DM.Engine.top() === this) DM.Engine.pop();
        const menu = DM.Engine.top();
        if (menu instanceof DM.Scenes.BonusMenu) menu.select(menu.selected);
        DM.Engine.canvas.focus({ preventScroll: true });
      };
      const back = button('BACK TO BONUS LEVELS', close);
      card.append(title, info, exportButton, label, note, restoreButton, status, back);
      root.appendChild(card);
      document.body.appendChild(root);
      this.root = root;
      // The game listens on window; capture stops dialog navigation leaking into it.
      this.keys = event => {
        if (!root.isConnected) return;
        event.stopImmediatePropagation();
        if (event.type !== 'keydown') return;
        if (event.key === 'Escape') {
          event.preventDefault();
          close();
        } else if (event.key === 'Tab') {
          const controls = [...root.querySelectorAll('button:not(:disabled),input')];
          const first = controls[0], last = controls[controls.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }
      };
      window.addEventListener('keydown', this.keys, true);
      window.addEventListener('keyup', this.keys, true);
      exportButton.focus();
    }
    exit() {
      window.removeEventListener('keydown', this.keys, true);
      window.removeEventListener('keyup', this.keys, true);
      this.root.remove();
      DM.Input.clearAll();
    }
    update(dt) {
      this.t += dt;
    }
    render(ctx) {
      DM.Bonus.city(ctx, this.t);
    }
  }

  DM.BonusBackup = Backup;
})();
