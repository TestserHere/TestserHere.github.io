/* Keyboard shortcuts shared by the games and apps.

   V3Keys.add([
     { keys: [' '], label: 'Space', does: 'Show or hide the word', press: '#word-card' },
     { keys: ['1', '2', '3', '4'], label: '1 to 4', does: 'Choose an answer', press: (key) => '#answers > button:nth-child(' + key + ')' },
     { keys: ['/'], label: '/', does: 'Search', focus: '#name' },
     { keys: ['b'], label: 'B', does: 'Go back', run: () => goBack() },
   ]);

   A shortcut presses the first matching button that is visible and enabled, so the same key can mean
   "Next" on one screen and "Play again" on another. Shortcuts never fire while typing in a box
   (except Escape, which leaves the box). Press ? to see them all. */

window.V3Keys = (function () {
  'use strict';

  const shortcuts = [];
  let dialog = null;

  const typing = (target) => !!target && (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable);

  function visible(node) {
    if (!node || node.disabled || node.closest('[hidden]')) return false;
    const box = node.getBoundingClientRect();
    return box.width > 0 && box.height > 0 && getComputedStyle(node).visibility !== 'hidden';
  }

  function first(selector) {
    return Array.from(document.querySelectorAll(selector)).find(visible) || null;
  }

  function matches(shortcut, event) {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    return shortcut.keys.some((k) => (k.length === 1 ? k.toLowerCase() : k) === key);
  }

  function trigger(shortcut, event) {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (shortcut.run) return shortcut.run(key, event) !== false;
    const pick = (value) => (typeof value === 'function' ? value(key) : value);
    if (shortcut.focus) {
      const field = first(pick(shortcut.focus));
      if (!field) return false;
      field.focus();
      if (field.select) field.select();
      return true;
    }
    const selectors = [].concat(pick(shortcut.press));
    for (const selector of selectors) {
      const button = first(selector);
      if (button) {
        button.click();
        return true;
      }
    }
    return false;
  }

  function onKey(event) {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === '?' && !typing(event.target)) {
      event.preventDefault();
      toggleHelp();
      return;
    }
    if (dialog && dialog.open) return; // the help (or another dialog) handles its own keys
    if (document.querySelector('dialog[open]')) return;
    if (typing(event.target)) {
      if (event.key === 'Escape') event.target.blur();
      return;
    }
    // Enter and Space already press a focused button: leave those alone.
    if ((event.key === 'Enter' || event.key === ' ') && event.target && /^(BUTTON|A|SUMMARY)$/.test(event.target.tagName)) return;
    for (const shortcut of shortcuts) {
      if (shortcut.when && !shortcut.when()) continue;
      if (matches(shortcut, event) && trigger(shortcut, event)) {
        event.preventDefault();
        return;
      }
    }
  }

  let styled = false;
  function addStyle() {
    if (styled) return;
    styled = true;
    const style = document.createElement('style');
    style.textContent = '.keys-help{width:min(420px,calc(100vw - 32px));padding:20px 22px;border:0;border-radius:18px;'
      + 'background:var(--card,#fff);color:var(--text,#1d1d1f);box-shadow:0 20px 60px rgba(0,0,0,.35);font:inherit}'
      + '.keys-help::backdrop{background:rgba(0,0,0,.45)}.keys-help h2{margin:0 0 12px;font-size:20px}'
      + '.keys-help dl{display:grid;grid-template-columns:auto 1fr;gap:8px 14px;margin:0 0 16px;align-items:center}'
      + '.keys-help dt{justify-self:start}.keys-help dd{margin:0}'
      + '.keys-help kbd{display:inline-block;min-width:1.6em;padding:2px 8px;border-radius:6px;background:var(--fill,#e8e8ed);'
      + 'font:600 14px/1.5 inherit;text-align:center;white-space:nowrap}'
      + '.keys-help button{width:100%;padding:11px;border:0;border-radius:12px;background:var(--blue,#0071e3);color:#fff;font:600 16px inherit}'
      + '.keys-hint{margin:24px 0 8px;color:var(--muted,#86868b);font-size:13px;text-align:center}'
      + '@media (hover:none),(pointer:coarse){.keys-hint{display:none}}';
    document.head.appendChild(style);
  }

  function toggleHelp() {
    addStyle();
    if (!dialog) {
      dialog = document.createElement('dialog');
      dialog.className = 'keys-help';
      dialog.setAttribute('aria-labelledby', 'keys-help-title');
      document.body.appendChild(dialog);
      dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
    }
    if (dialog.open) {
      dialog.close();
      return;
    }
    const list = document.createElement('dl');
    shortcuts.concat([{ label: '?', does: 'Show or hide this list' }]).forEach((shortcut) => {
      const term = document.createElement('dt');
      String(shortcut.label).split(' or ').forEach((part, index) => {
        if (index) term.append(' or ');
        const kbd = document.createElement('kbd');
        kbd.textContent = part;
        term.appendChild(kbd);
      });
      const what = document.createElement('dd');
      what.textContent = shortcut.does;
      list.append(term, what);
    });
    const title = document.createElement('h2');
    title.id = 'keys-help-title';
    title.textContent = 'Keyboard shortcuts';
    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = 'Close';
    close.addEventListener('click', () => dialog.close());
    dialog.replaceChildren(title, list, close);
    if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
    close.focus();
  }

  /* Adds "Press ? for keyboard shortcuts" to the page (hidden on touch screens). */
  function addHint(parent) {
    const hint = document.createElement('p');
    hint.className = 'keys-hint';
    hint.textContent = 'Press ? for keyboard shortcuts';
    (parent || document.querySelector('main') || document.body).appendChild(hint);
    return hint;
  }

  let listening = false;
  function add(list, options) {
    shortcuts.push(...list);
    if (!listening) {
      addStyle();
      document.addEventListener('keydown', onKey);
      listening = true;
      if (!options || options.hint !== false) addHint(options && options.hintIn);
    }
  }

  return { add, showHelp: toggleHelp };
})();
