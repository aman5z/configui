/* ══════════════════════════════════════════
   blocks-editor.js — generic form builders + the
   per-project "block" editor (paragraphs, galleries,
   parts lists, tables, etc. inside a project card)
══════════════════════════════════════════ */
const UI = (() => {
  function h(tag, attrs = {}, ...children) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null) continue;
      if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else if (k === 'class') n.className = v;
      else n.setAttribute(k, v);
    }
    children.flat().forEach(c => {
      if (c === undefined || c === null) return;
      n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return n;
  }

  function field(label, value, onChange, opts = {}) {
    const wrap = h('div');
    if (label) wrap.appendChild(h('label', {}, label));
    const input = h('input', { type: opts.type || 'text', value: value || '' });
    input.addEventListener('input', () => onChange(input.value));
    wrap.appendChild(input);
    if (opts.hint) wrap.appendChild(h('div', { class: 'hint' }, opts.hint));
    return wrap;
  }

  function textareaField(label, value, onChange, opts = {}) {
    const wrap = h('div');
    if (label) wrap.appendChild(h('label', {}, label));
    const ta = h('textarea', {});
    ta.value = value || '';
    ta.addEventListener('input', () => onChange(ta.value));
    wrap.appendChild(ta);
    if (opts.hint) wrap.appendChild(h('div', { class: 'hint' }, opts.hint));
    return wrap;
  }

  function colorField(label, value, onChange) {
    const wrap = h('div');
    if (label) wrap.appendChild(h('label', {}, label));
    const row = h('div', { class: 'colorrow' });
    const isColor = /^#[0-9a-fA-F]{3,8}$/.test((value || '').trim());
    const swatch = h('input', { type: 'color', class: 'swatch', value: isColor ? value : '#000000' });
    const text = h('input', { type: 'text', value: value || '' });
    swatch.addEventListener('input', () => { text.value = swatch.value; onChange(swatch.value); });
    text.addEventListener('input', () => { onChange(text.value); if (/^#[0-9a-fA-F]{3,8}$/.test(text.value)) swatch.value = text.value; });
    row.appendChild(swatch); row.appendChild(text);
    wrap.appendChild(row);
    return wrap;
  }

  function selectField(label, value, options, onChange) {
    const wrap = h('div');
    if (label) wrap.appendChild(h('label', {}, label));
    const sel = h('select', {});
    options.forEach(opt => {
      const o = h('option', { value: opt.value }, opt.label);
      if (opt.value === value) o.setAttribute('selected', 'selected');
      sel.appendChild(o);
    });
    sel.addEventListener('change', () => onChange(sel.value));
    wrap.appendChild(sel);
    return wrap;
  }

  function toggleRow(label, checked, onChange, extraRight) {
    const row = h('div', { class: 'section-toggle' });
    row.appendChild(h('span', {}, label));
    const right = h('div', { class: 'row' });
    if (extraRight) right.appendChild(extraRight);
    const sw = h('label', { class: 'switch' },
      (() => { const i = h('input', { type: 'checkbox' }); i.checked = checked; i.addEventListener('change', () => onChange(i.checked)); return i; })(),
      h('span', { class: 'slider' })
    );
    right.appendChild(sw);
    row.appendChild(right);
    return row;
  }

  function toolbar({ onUp, onDown, onRemove }) {
    const bar = h('div', { class: 'item-toolbar' });
    if (onUp) bar.appendChild(h('button', { class: 'icon-btn', title: 'Move up', onclick: onUp }, '↑'));
    if (onDown) bar.appendChild(h('button', { class: 'icon-btn', title: 'Move down', onclick: onDown }, '↓'));
    if (onRemove) bar.appendChild(h('button', { class: 'icon-btn', title: 'Remove', onclick: onRemove }, '✕'));
    return bar;
  }

  function listCard(inner, toolbarOpts) {
    const card = h('div', { class: 'card-inner' });
    if (toolbarOpts) card.appendChild(toolbar(toolbarOpts));
    inner.forEach(el => card.appendChild(el));
    return card;
  }

  function moveArr(arr, i, dir) {
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  // ── Image field with upload-to-GitHub support ──
  function imageField(label, value, onChange, pathHint, rerender) {
    const wrap = h('div');
    if (label) wrap.appendChild(h('label', {}, label));
    if (value) wrap.appendChild(h('img', { class: 'thumb', src: value, style: 'max-width:160px;height:auto;' }));
    const input = h('input', { type: 'text', value: value || '', placeholder: 'Image URL or path' });
    input.addEventListener('input', () => onChange(input.value));
    wrap.appendChild(input);
    const fileInput = h('input', { type: 'file', accept: 'image/*' });
    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const path = await window.__uploadImage(file, pathHint);
      if (path) { onChange(path); rerender(); }
    });
    wrap.appendChild(h('div', { class: 'row', style: 'margin-top:6px;' }, fileInput));
    return wrap;
  }

  return { h, field, textareaField, colorField, selectField, toggleRow, toolbar, listCard, moveArr, imageField };
})();

/* Block type editors — each returns a form (array of DOM nodes) for editing that block,
   given the block object and a rerender() callback for structural changes (like add/remove sub-items). */
const BlockEditors = {
  paragraph: (b, rerender) => [UI.textareaField('Paragraph (HTML allowed)', b.html, v => b.html = v)],

  subheading: (b) => [UI.field('Sub-heading text', b.text, v => b.text = v)],

  divider: () => [UI.h('div', { class: 'muted' }, '— visual divider line —')],

  techstack: (b, rerender) => {
    const out = [UI.h('label', {}, 'Tech tags')];
    const tagsWrap = UI.h('div', { class: 'row' });
    b.tags.forEach((tag, i) => {
      const row = UI.h('div', { class: 'row', style: 'gap:4px;' },
        (() => { const inp = UI.h('input', { type: 'text', value: tag, style: 'width:120px;' }); inp.addEventListener('input', () => b.tags[i] = inp.value); return inp; })(),
        UI.h('button', { class: 'icon-btn', onclick: () => { b.tags.splice(i, 1); rerender(); } }, '✕')
      );
      tagsWrap.appendChild(row);
    });
    out.push(tagsWrap);
    out.push(UI.h('button', { class: 'btn btn-sm', style: 'margin-top:6px;', onclick: () => { b.tags.push('New Tag'); rerender(); } }, '+ Add tag'));
    return out;
  },

  featurelist: (b, rerender) => {
    const out = [UI.h('label', {}, 'Feature list items')];
    b.items.forEach((item, i) => {
      out.push(UI.h('div', { class: 'row' },
        (() => { const inp = UI.h('input', { type: 'text', value: item }); inp.style.flex = '1'; inp.addEventListener('input', () => b.items[i] = inp.value); return inp; })(),
        UI.h('button', { class: 'icon-btn', onclick: () => { b.items.splice(i, 1); rerender(); } }, '✕')
      ));
    });
    out.push(UI.h('button', { class: 'btn btn-sm', onclick: () => { b.items.push('New feature'); rerender(); } }, '+ Add item'));
    return out;
  },

  subitems: (b, rerender) => {
    const out = [];
    b.items.forEach((item, i) => {
      out.push(UI.listCard([
        UI.field('Title', item.title, v => item.title = v),
        UI.textareaField('Text', item.textHtml, v => item.textHtml = v),
      ], { onUp: i > 0 ? () => { UI.moveArr(b.items, i, -1); rerender(); } : null, onDown: i < b.items.length - 1 ? () => { UI.moveArr(b.items, i, 1); rerender(); } : null, onRemove: () => { b.items.splice(i, 1); rerender(); } }));
    });
    out.push(UI.h('button', { class: 'btn btn-sm', onclick: () => { b.items.push({ title: 'New item', textHtml: '' }); rerender(); } }, '+ Add sub-item'));
    return out;
  },

  partslist: (b, rerender) => {
    const out = [];
    b.items.forEach((item, i) => {
      out.push(UI.listCard([
        UI.field('Part name', item.name, v => item.name = v),
        UI.field('Description', item.desc, v => item.desc = v),
      ], { onUp: i > 0 ? () => { UI.moveArr(b.items, i, -1); rerender(); } : null, onDown: i < b.items.length - 1 ? () => { UI.moveArr(b.items, i, 1); rerender(); } : null, onRemove: () => { b.items.splice(i, 1); rerender(); } }));
    });
    out.push(UI.h('button', { class: 'btn btn-sm', onclick: () => { b.items.push({ name: 'New part', desc: '' }); rerender(); } }, '+ Add part'));
    return out;
  },

  conntable: (b, rerender) => {
    const out = [];
    b.rows.forEach((row, i) => {
      out.push(UI.h('div', { class: 'row' },
        (() => { const inp = UI.h('input', { type: 'text', value: row.key, style: 'width:100px;' }); inp.addEventListener('input', () => row.key = inp.value); return inp; })(),
        (() => { const inp = UI.h('input', { type: 'text', value: row.value }); inp.style.flex = '1'; inp.addEventListener('input', () => row.value = inp.value); return inp; })(),
        UI.h('button', { class: 'icon-btn', onclick: () => { b.rows.splice(i, 1); rerender(); } }, '✕')
      ));
    });
    out.push(UI.h('button', { class: 'btn btn-sm', onclick: () => { b.rows.push({ key: 'Pin', value: 'Connection' }); rerender(); } }, '+ Add row'));
    return out;
  },

  scenariolist: (b, rerender) => {
    const out = [];
    b.items.forEach((item, i) => {
      out.push(UI.listCard([
        UI.field('Command / trigger', item.cmd, v => item.cmd = v),
        UI.textareaField('Description', item.descHtml, v => item.descHtml = v),
      ], { onRemove: () => { b.items.splice(i, 1); rerender(); } }));
    });
    out.push(UI.h('button', { class: 'btn btn-sm', onclick: () => { b.items.push({ cmd: 'Trigger', descHtml: '' }); rerender(); } }, '+ Add scenario'));
    return out;
  },

  networktable: (b, rerender) => {
    const out = [UI.h('label', {}, 'Column headers (comma separated)')];
    const headerInput = UI.h('input', { type: 'text', value: b.headers.join(', ') });
    headerInput.addEventListener('input', () => b.headers = headerInput.value.split(',').map(s => s.trim()));
    out.push(headerInput);
    out.push(UI.h('label', { style: 'margin-top:10px;' }, 'Rows'));
    b.rows.forEach((row, i) => {
      const rowWrap = UI.h('div', { class: 'row' });
      row.forEach((cell, ci) => {
        const inp = UI.h('input', { type: 'text', value: cell });
        inp.style.flex = '1';
        inp.addEventListener('input', () => row[ci] = inp.value);
        rowWrap.appendChild(inp);
      });
      rowWrap.appendChild(UI.h('button', { class: 'icon-btn', onclick: () => { b.rows.splice(i, 1); rerender(); } }, '✕'));
      out.push(rowWrap);
    });
    out.push(UI.h('button', { class: 'btn btn-sm', onclick: () => { b.rows.push(b.headers.map(() => '')); rerender(); } }, '+ Add row'));
    return out;
  },

  gallery: (b, rerender) => {
    const out = [UI.h('label', {}, 'Images & video embeds')];
    const grid = UI.h('div', { class: 'imggrid' });
    b.items.forEach((item, i) => {
      const cell = UI.h('div', { class: 'imgcell' });
      if (item.kind === 'img') cell.appendChild(UI.h('img', { class: 'thumb', src: item.src }));
      else cell.appendChild(UI.h('div', { class: 'thumb', style: 'display:flex;align-items:center;justify-content:center;background:#000;color:#666;font-size:11px;' }, 'video embed'));
      cell.appendChild(UI.h('button', { class: 'icon-btn', onclick: () => { b.items.splice(i, 1); rerender(); } }, '✕'));
      grid.appendChild(cell);
    });
    out.push(grid);
    const fileInput = UI.h('input', { type: 'file', accept: 'image/*', multiple: true });
    fileInput.addEventListener('change', async (e) => {
      for (const file of e.target.files) {
        const path = await window.__uploadImage(file, 'gallery');
        if (path) b.items.push({ kind: 'img', src: path, alt: '' });
      }
      rerender();
    });
    out.push(UI.h('div', { class: 'row', style: 'margin-top:8px;' }, fileInput));
    out.push(UI.h('div', { class: 'hint' }, 'Or paste a YouTube embed URL below and click Add video'));
    const ytInput = UI.h('input', { type: 'text', placeholder: 'https://www.youtube.com/embed/...' });
    out.push(UI.h('div', { class: 'row', style: 'margin-top:6px;' },
      ytInput,
      UI.h('button', { class: 'btn btn-sm', onclick: () => { if (ytInput.value) { b.items.push({ kind: 'iframe', src: ytInput.value, title: '' }); rerender(); } } }, '+ Add video')
    ));
    return out;
  },

  cardlinks: (b, rerender) => {
    const out = [];
    b.links.forEach((l, i) => {
      out.push(UI.h('div', { class: 'row' },
        (() => { const inp = UI.h('input', { type: 'text', value: l.label, style: 'width:120px;' }); inp.addEventListener('input', () => l.label = inp.value); return inp; })(),
        (() => { const inp = UI.h('input', { type: 'text', value: l.href }); inp.style.flex = '1'; inp.addEventListener('input', () => l.href = inp.value); return inp; })(),
        UI.h('button', { class: 'icon-btn', onclick: () => { b.links.splice(i, 1); rerender(); } }, '✕')
      ));
    });
    out.push(UI.h('button', { class: 'btn btn-sm', onclick: () => { b.links.push({ label: 'Link', href: '#' }); rerender(); } }, '+ Add link'));
    return out;
  },
};

const BLOCK_LABELS = {
  paragraph: 'Paragraph', subheading: 'Sub-heading', divider: 'Divider', techstack: 'Tech tags',
  featurelist: 'Feature list', subitems: 'Sub-items grid', partslist: 'Parts list', conntable: 'Connection table',
  scenariolist: 'Scenario list', networktable: 'Data table', gallery: 'Image/video gallery', cardlinks: 'Extra links',
};

const NEW_BLOCK_DEFAULTS = {
  paragraph: () => ({ type: 'paragraph', html: 'New paragraph text.' }),
  techstack: () => ({ type: 'techstack', tags: [] }),
  featurelist: () => ({ type: 'featurelist', items: [] }),
  subitems: () => ({ type: 'subitems', items: [] }),
  gallery: () => ({ type: 'gallery', items: [] }),
  divider: () => ({ type: 'divider' }),
  subheading: () => ({ type: 'subheading', text: 'Section' }),
};

function renderProjectBlocks(project, container, rerenderProject) {
  container.innerHTML = '';
  project.blocks.forEach((b, i) => {
    const editorFn = BlockEditors[b.type];
    const body = editorFn ? editorFn(b, rerenderProject) : [UI.h('div', { class: 'muted' }, 'Unsupported block type: ' + b.type)];
    const label = UI.h('div', { style: 'font-size:11px;color:var(--accent);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;' }, BLOCK_LABELS[b.type] || b.type);
    const card = UI.listCard([label, ...body], {
      onUp: i > 0 ? () => { UI.moveArr(project.blocks, i, -1); rerenderProject(); } : null,
      onDown: i < project.blocks.length - 1 ? () => { UI.moveArr(project.blocks, i, 1); rerenderProject(); } : null,
      onRemove: () => { project.blocks.splice(i, 1); rerenderProject(); },
    });
    container.appendChild(card);
  });
  const addRow = UI.h('div', { class: 'row', style: 'margin-top:10px;' });
  const sel = UI.h('select', {});
  Object.keys(NEW_BLOCK_DEFAULTS).forEach(k => sel.appendChild(UI.h('option', { value: k }, BLOCK_LABELS[k])));
  addRow.appendChild(sel);
  addRow.appendChild(UI.h('button', { class: 'btn btn-sm', onclick: () => { project.blocks.push(NEW_BLOCK_DEFAULTS[sel.value]()); rerenderProject(); } }, '+ Add block'));
  container.appendChild(addRow);
}
