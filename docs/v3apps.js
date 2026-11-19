/* Shared pieces for the finder and discovery apps: icons, a search box with suggestions,
   result lists, saved lists and a varied picker. Needs v3tools.js first. */

window.V3Apps = (function () {
  'use strict';

  const { read, write, el } = window.V3Tools;

  const SVG = 'http://www.w3.org/2000/svg';
  const ICONS = {
    play: 'M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z',
    pause: 'M7 5h3.5v14H7zM13.5 5H17v14h-3.5z',
    heart: 'M12 20.3l-1.3-1.2C6 14.9 3 12.2 3 8.8 3 6.1 5.1 4 7.8 4c1.5 0 3 .7 4.2 1.9C13.2 4.7 14.7 4 16.2 4 18.9 4 21 6.1 21 8.8c0 3.4-3 6.1-7.7 10.3z',
    bookmark: 'M6.5 3.5h11a1 1 0 0 1 1 1v16l-6.5-4.2-6.5 4.2v-16a1 1 0 0 1 1-1z',
    book: 'M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5zM4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5',
    radio: 'M4 9h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zM6 9l11-5M15.5 14.5a2 2 0 1 0 0 .01M6.5 13h4M6.5 16h4',
  };

  function icon(name) {
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(SVG, 'path');
    path.setAttribute('d', ICONS[name]);
    svg.appendChild(path);
    return svg;
  }

  function norm(text) {
    return String(text || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/\(.*?\)|\[.*?\]/g, ' ')
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim();
  }

  function listNames(names) {
    const list = [...names];
    if (list.length <= 1) return list.join('');
    return list.slice(0, -1).join(', ') + ' and ' + list[list.length - 1];
  }

  const cssUrl = (url) => 'url("' + String(url).replace(/["\\\n]/g, encodeURIComponent) + '")';

  /* Shows a status line; busy adds a spinner, problem makes it stand out. */
  function setStatus(node, text, kind) {
    node.textContent = text;
    node.classList.toggle('is-busy', kind === 'busy');
    node.classList.toggle('is-problem', kind === 'problem');
  }

  /* Picks a varied list: high scores first, a little shuffled, a few per group (like an author). */
  function choose(items, options) {
    const { exclude = new Set(), count = 20, perGroup = 2, keyOf = (item) => item.id, groupOf = () => '' } = options || {};
    const ranked = items
      .filter((item) => !exclude.has(keyOf(item)))
      .map((item) => ({ item, rank: (item.score || 1) * (0.7 + Math.random() * 0.6) }))
      .sort((a, b) => b.rank - a.rank);
    const used = new Map();
    const picked = [];
    for (const { item } of ranked) {
      const group = groupOf(item);
      const n = used.get(group) || 0;
      if (group && n >= perGroup) continue;
      used.set(group, n + 1);
      picked.push(item);
      if (picked.length >= count) break;
    }
    return picked;
  }

  /* A list kept in the browser, newest first. */
  function savedList(key, limit = 300) {
    let items = read(key, []);
    if (!Array.isArray(items)) items = [];
    const listeners = [];
    return {
      all: () => items.slice(),
      has: (id) => items.some((item) => item.id === id),
      toggle(item) {
        if (items.some((other) => other.id === item.id)) items = items.filter((other) => other.id !== item.id);
        else items = [item].concat(items).slice(0, limit);
        write(key, items);
        listeners.forEach((fn) => fn());
      },
      onChange: (fn) => listeners.push(fn),
    };
  }

  /* A search box that suggests things as you type.
     options: { input, list, search(query) -> items, describe(item) -> { title, sub, art }, onPick(item), minLength } */
  function combobox(options) {
    const { input, list, search, describe, onPick, minLength = 2 } = options;
    let timer = 0;
    let token = 0;
    let found = [];
    let active = -1;

    function close() {
      list.hidden = true;
      list.replaceChildren();
      found = [];
      active = -1;
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
    }

    function highlight(index) {
      active = index;
      Array.from(list.querySelectorAll('[role="option"]')).forEach((item, i) => item.setAttribute('aria-selected', String(i === index)));
      if (index >= 0) input.setAttribute('aria-activedescendant', list.id + '-' + index);
      else input.removeAttribute('aria-activedescendant');
    }

    function pick(item) {
      close();
      input.value = '';
      onPick(item);
    }

    function show(items, message) {
      list.replaceChildren();
      found = items;
      if (message) {
        const note = el('li', 'suggestion-note', message);
        note.setAttribute('role', 'presentation');
        list.appendChild(note);
      }
      items.forEach((item, index) => {
        const { title, sub, art } = describe(item);
        const row = el('li', 'suggestion');
        row.id = list.id + '-' + index;
        row.setAttribute('role', 'option');
        const thumb = el('span', 'seed-art');
        if (art) thumb.style.backgroundImage = cssUrl(art);
        const text = el('span', 'seed-text');
        text.append(el('strong', '', title), el('span', '', sub || ''));
        row.append(thumb, text);
        row.addEventListener('mousedown', (event) => event.preventDefault());
        row.addEventListener('click', () => pick(item));
        list.appendChild(row);
      });
      list.hidden = false;
      input.setAttribute('aria-expanded', 'true');
      highlight(-1);
    }

    input.addEventListener('input', () => {
      clearTimeout(timer);
      const query = input.value.trim();
      if (query.length < minLength) { close(); return; }
      timer = setTimeout(async () => {
        const mine = ++token;
        show([], 'Searching…');
        try {
          const items = await search(query);
          if (mine !== token) return;
          show(items, items.length ? '' : 'Nothing found. Try different words.');
        } catch (_) {
          if (mine === token) show([], "Search isn't working right now. Try again soon.");
        }
      }, 300);
    });

    input.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') { close(); return; }
      if (list.hidden || !found.length) return;
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const step = event.key === 'ArrowDown' ? 1 : -1;
        highlight((active + step + found.length) % found.length);
      } else if (event.key === 'Enter') {
        event.preventDefault();
        pick(found[Math.max(0, active)]);
      }
    });
    input.addEventListener('blur', () => setTimeout(close, 150));
    return { close };
  }

  /* Seeds: the 1 to 3 things you picked, shown as removable rows. */
  function renderSeeds(listNode, seeds, describe, onRemove) {
    listNode.replaceChildren();
    seeds.forEach((seed, index) => {
      const { title, sub, art } = describe(seed);
      const row = el('li', 'seed');
      const thumb = el('span', 'seed-art');
      if (art) thumb.style.backgroundImage = cssUrl(art);
      const text = el('span', 'seed-text');
      text.append(el('strong', '', title), el('span', '', sub || ''));
      const remove = el('button', 'seed-remove', '×');
      remove.type = 'button';
      remove.setAttribute('aria-label', 'Remove ' + title);
      remove.addEventListener('click', () => onRemove(index));
      row.append(thumb, text, remove);
      listNode.appendChild(row);
    });
    listNode.hidden = !seeds.length;
  }

  /* A row in a result list: picture, text lines, links and a save button.
     item view: { art, artShape, title, sub, why, links: [{ text, href } | { text, onClick }], save: { label, icon, pressed, onToggle }, artButton } */
  function itemRow(view) {
    const row = el('li', 'item');
    let art;
    if (view.artButton) {
      art = el('button', 'item-art is-button');
      art.type = 'button';
      art.setAttribute('aria-label', view.artButton.label);
      art.appendChild(icon(view.artButton.icon));
      art.addEventListener('click', view.artButton.onClick);
    } else {
      art = el('span', 'item-art');
      if (!view.art && view.placeholder) art.appendChild(icon(view.placeholder));
    }
    if (view.art) art.style.backgroundImage = cssUrl(view.art);
    if (view.artShape) art.classList.add('is-' + view.artShape);

    const meta = el('div', 'item-meta');
    meta.appendChild(el('strong', 'item-title', view.title));
    if (view.sub) meta.appendChild(el('span', 'item-sub', view.sub));
    if (view.why) meta.appendChild(el('span', 'item-why', view.why));
    if (view.links && view.links.length) {
      const links = el('div', 'item-links');
      view.links.forEach((link) => {
        let node;
        if (link.href) {
          node = el('a', '', link.text);
          node.href = link.href;
          node.target = '_blank';
          node.rel = 'noopener';
        } else {
          node = el('button', 'link-button', link.text);
          node.type = 'button';
          node.addEventListener('click', link.onClick);
        }
        links.appendChild(node);
      });
      meta.appendChild(links);
    }
    row.append(art, meta);

    if (view.save) {
      const save = el('button', 'item-save');
      save.type = 'button';
      save.setAttribute('aria-label', view.save.label);
      save.setAttribute('aria-pressed', String(!!view.save.pressed));
      save.appendChild(icon(view.save.icon || 'heart'));
      save.addEventListener('click', () => {
        view.save.onToggle();
        save.setAttribute('aria-pressed', String(view.save.isPressed ? view.save.isPressed() : save.getAttribute('aria-pressed') !== 'true'));
      });
      row.appendChild(save);
    }
    return row;
  }

  return { icon, norm, listNames, cssUrl, setStatus, choose, savedList, combobox, renderSeeds, itemRow };
})();
