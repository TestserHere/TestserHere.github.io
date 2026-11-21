/* Keyboard shortcuts shared by the games and apps.

   V3Keys.add([
     { keys: [' '], label: 'Space', does: 'Show or hide the word', press: '#word-card' },
     { keys: ['1', '2', '3', '4'], label: '1 to 4', does: 'Choose an answer', press: (key) => '#answers > button:nth-child(' + key + ')' },
     { keys: ['/'], label: '/', does: 'Search', focus: '#name' },
     { keys: ['b'], label: 'B', does: 'Go back', run: () => goBack() },
   ]);

   A shortcut presses the first matching button that is visible and enabled, so the same key can mean
   "Next" on one screen and "Play again" on another. Shortcuts never fire while typing in a box
   (except Escape, which leaves the box). Press ? to see them all.

   V3Keys.howTo({ id: 'board', title: 'Board Games', steps: ['Pick a game…', '…'] });
   adds a ? button to the page header. It opens "How to play" (plus the shortcuts on devices with a keyboard),
   and opens by itself the first time someone visits. */

window.V3Keys = (function () {
  'use strict';

  const shortcuts = [];
  let dialog = null;
  let guide = null; // how to play, for games

  const SEEN_PREFIX = 'v3-howto-';
  const seen = (id) => { try { return localStorage.getItem(SEEN_PREFIX + id) === '1'; } catch (_) { return true; } };
  const markSeen = (id) => { try { localStorage.setItem(SEEN_PREFIX + id, '1'); } catch (_) { /* private mode */ } };

  const NOT_TEXT = /^(range|checkbox|radio|button|submit|reset|color|file)$/;
  const typing = (target) => !!target && ((target.tagName === 'INPUT' && !NOT_TEXT.test(target.type))
    || /^(TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable);

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
    if ((event.key === 'Enter' || event.key === ' ') && event.target && (/^(BUTTON|A|SUMMARY)$/.test(event.target.tagName) || /^(checkbox|radio)$/.test(event.target.type))) return;
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
      + '.keys-help{max-height:calc(100dvh - 32px);overflow:auto}'
      + '.keys-help h3{margin:4px 0 10px;font-size:16px}'
      + '.keys-help .howto{margin:0 0 16px;padding:0 0 0 1.3em;display:flex;flex-direction:column;gap:8px;line-height:1.45}'
      + '.keys-help .howto-tip{margin:-6px 0 16px;color:var(--muted,#86868b);font-size:15px;line-height:1.45}'
      + '.app-head{position:relative}'
      + '.help-button{position:absolute;top:0;right:0;width:36px;height:36px;padding:0;border:0;border-radius:50%;'
      + 'background:var(--fill,#e8e8ed);color:var(--text,#1d1d1f);font:700 18px/36px inherit;text-align:center;cursor:pointer}'
      + '.help-button:focus-visible{outline:3px solid var(--blue,#0071e3);outline-offset:2px}'
      + '@media (hover:none),(pointer:coarse){.keys-hint,.keys-only{display:none}}';
    document.head.appendChild(style);
  }

  function toggleHelp(first) {
    first = first === true;
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
    const parts = [];
    const heading = (tag, text, id) => {
      const h = document.createElement(tag);
      h.textContent = text;
      if (id) h.id = id;
      return h;
    };
    if (guide) {
      parts.push(heading('h2', 'How to play' + (guide.title ? ': ' + guide.title : ''), 'keys-help-title'));
      const steps = document.createElement('ol');
      steps.className = 'howto';
      guide.steps.forEach((step) => steps.appendChild(heading('li', step)));
      parts.push(steps);
      if (guide.tip) {
        const tip = heading('p', guide.tip);
        tip.className = 'howto-tip';
        parts.push(tip);
      }
    }
    const list = document.createElement('dl');
    shortcuts.concat([{ label: '?', does: guide ? 'Show or hide this help' : 'Show or hide this list' }]).forEach((shortcut) => {
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
    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = guide && first ? 'Let’s play' : 'Close';
    close.addEventListener('click', () => dialog.close());
    if (shortcuts.length) {
      // On touch screens there's no keyboard, so the shortcuts are hidden there.
      const keys = document.createElement('div');
      if (guide) keys.className = 'keys-only';
      keys.append(heading(guide ? 'h3' : 'h2', 'Keyboard shortcuts', guide ? '' : 'keys-help-title'), list);
      parts.push(keys);
    }
    dialog.replaceChildren(...parts, close);
    if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
    close.focus();
  }

  /* Adds "Press ? for keyboard shortcuts" to the page (hidden on touch screens). */
  function addHint(parent) {
    const hint = document.createElement('p');
    hint.className = 'keys-hint';
    hint.textContent = guide ? 'Press ? for how to play and keyboard shortcuts' : 'Press ? for keyboard shortcuts';
    (parent || document.querySelector('main') || document.body).appendChild(hint);
    return hint;
  }

  let listening = false;
  let hintNode = null;
  function listen() {
    if (listening) return;
    addStyle();
    document.addEventListener('keydown', onKey);
    listening = true;
  }

  function add(list, options) {
    shortcuts.push(...list);
    if (!hintNode && (!options || options.hint !== false)) {
      listen();
      hintNode = addHint(options && options.hintIn);
    }
    listen();
  }

  /* How to play: a ? button in the header, shown by itself on the first visit. */
  function howTo(info) {
    guide = info;
    listen();
    if (hintNode) hintNode.textContent = 'Press ? for how to play and keyboard shortcuts';
    const head = document.querySelector('.app-head') || document.querySelector('header');
    if (head && !head.querySelector('.help-button')) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'help-button';
      button.textContent = '?';
      button.setAttribute('aria-label', 'How to play');
      button.title = 'How to play';
      button.addEventListener('click', () => toggleHelp());
      head.appendChild(button);
    }
    if (!seen(info.id)) {
      markSeen(info.id);
      setTimeout(() => { if (!dialog || !dialog.open) toggleHelp(true); }, 150);
    }
  }

  return { add, howTo, showHelp: () => toggleHelp() };
})();
