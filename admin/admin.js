/* ══════════════════════════════════════════
   admin.js — the app itself
══════════════════════════════════════════ */
const { h, field, textareaField, colorField, selectField, toggleRow, toolbar, listCard, moveArr, imageField } = UI;

let state = null;          // the loaded content.json
let activePage = { slug: '', path: 'index.html', contentFile: 'content.json' };
let activeTab = 'settings';
const app = document.getElementById('app');

function toast(msg, kind = 'ok') {
  const t = h('div', { class: 'toast-item' }, msg);
  document.getElementById('toast').appendChild(t);
  setTimeout(() => t.remove(), 4000);
}

window.__uploadImage = async function (file, hint) {
  try {
    toast('Uploading ' + file.name + '…', 'busy');
    const b64 = await GH.fileToBase64(file);
    const safeName = Date.now() + '-' + file.name.replace(/[^a-zA-Z0-9._-]/g, '');
    const path = `images/${hint || 'uploads'}/${safeName}`.replace(/\/+/g, '/');
    await GH.putFile(path, { base64: true, data: b64 }, `Upload image ${safeName} via admin panel`);
    toast('Image uploaded ✓');
    return path;
  } catch (e) {
    toast('Upload failed: ' + e.message, 'err');
    return null;
  }
};

/* ───────────────────────── CONNECT SCREEN ───────────────────────── */
function renderConnectScreen() {
  app.innerHTML = '';
  const cfg = GH.getConfig() || { owner: '', repo: '', branch: 'main', token: '' };
  const wrap = h('div', { class: 'login-screen' },
    h('h1', {}, '🔧 Site Admin'),
    h('p', { class: 'muted' }, 'Connect to your GitHub repo to load and edit your site. Your access token stays in this browser only — it is never sent anywhere except api.github.com.'),
    h('div', { class: 'card' },
      field('GitHub username', cfg.owner, v => cfg.owner = v, { hint: 'e.g. aman5z' }),
      field('Repository name', cfg.repo, v => cfg.repo = v, { hint: 'e.g. aman5z.github.io' }),
      field('Branch', cfg.branch || 'main', v => cfg.branch = v),
      field('Personal Access Token', cfg.token, v => cfg.token = v, { type: 'password', hint: 'github.com → Settings → Developer settings → Fine-grained tokens → give it Contents: Read & Write on this one repo' }),
      h('button', {
        class: 'btn btn-primary', style: 'margin-top:16px;width:100%;',
        onclick: async (e) => {
          e.target.textContent = 'Connecting…';
          try {
            GH.setConfig(cfg);
            await GH.testConnection();
            await loadContent();
            toast('Connected ✓');
            renderMain();
          } catch (err) {
            toast(err.message, 'err');
            e.target.textContent = 'Connect';
          }
        }
      }, 'Connect'),
    ),
    h('p', { class: 'hint' }, 'First time here? Make sure content.json, index.html, render.js and behavior.js have been uploaded to your repo first — this panel edits content.json, it doesn\'t create the site template.'),
  );
  app.appendChild(wrap);
}

async function loadContent(path) {
  const file = await GH.getFile(path || 'content.json');
  if (!file) throw new Error('content.json not found in repo root. Upload it first.');
  state = JSON.parse(file.text);
  state.pages = state.pages || [{ slug: '', path: 'index.html', title: 'Home', contentFile: 'content.json' }];
}

/* ───────────────────────── MAIN SHELL ───────────────────────── */
const TABS = [
  ['settings', 'Site & Theme'], ['social', 'Top Icons'], ['hero', 'Hero'], ['stats', 'Stats'],
  ['about', 'About / Skills'], ['experience', 'Experience'], ['projects', 'Projects'],
  ['philosophy', 'Philosophy'], ['contact', 'Contact & Footer'], ['layout', 'Section Order'], ['pages', 'Pages'],
];

function renderMain() {
  app.innerHTML = '';
  const cfg = GH.getConfig();
  const topbar = h('div', { class: 'topbar' },
    h('div', {}, h('strong', {}, cfg.owner + '/' + cfg.repo), h('span', { class: 'muted', style: 'margin-left:8px;' }, activePage.path)),
    h('div', { class: 'row' },
      h('span', { id: 'save-status', class: 'status ok' }, 'Loaded'),
      h('button', { class: 'btn', onclick: () => { GH.clearConfig(); location.reload(); } }, 'Disconnect'),
      h('button', { class: 'btn btn-primary', onclick: saveAll }, '💾 Save Changes'),
    )
  );
  app.appendChild(topbar);

  const tabsEl = h('div', { class: 'tabs' });
  TABS.forEach(([key, label]) => {
    tabsEl.appendChild(h('button', {
      class: 'tab' + (activeTab === key ? ' active' : ''),
      onclick: () => { activeTab = key; renderMain(); }
    }, label));
  });
  app.appendChild(tabsEl);

  const wrap = h('div', { class: 'wrap' });
  const panel = h('div', {});
  wrap.appendChild(panel);
  app.appendChild(wrap);
  RENDERERS[activeTab](panel);
}

async function saveAll() {
  const statusEl = document.getElementById('save-status');
  statusEl.textContent = 'Saving…'; statusEl.className = 'status busy';
  try {
    await GH.saveFile(activePage.contentFile, JSON.stringify(state, null, 2), 'Update content via admin panel');
    statusEl.textContent = 'Saved ✓'; statusEl.className = 'status ok';
    toast('Saved — live in ~30–60s');
  } catch (e) {
    statusEl.textContent = 'Save failed'; statusEl.className = 'status err';
    toast(e.message, 'err');
  }
}

/* ───────────────────────── TAB RENDERERS ───────────────────────── */
const RENDERERS = {};

RENDERERS.settings = (panel) => {
  const rerender = () => RENDERERS.settings(panel);
  panel.innerHTML = '';
  panel.appendChild(h('div', { class: 'card' },
    h('h3', {}, 'Page info'),
    field('Page title (browser tab)', state.meta.title, v => state.meta.title = v),
    textareaField('Description (SEO)', state.meta.description, v => state.meta.description = v),
    field('Keywords (comma separated)', state.meta.keywords, v => state.meta.keywords = v),
  ));

  panel.appendChild(h('div', { class: 'card' },
    h('h3', {}, 'Default theme'),
    selectField('Theme shown on first visit', state.theme.defaultMode, [{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }], v => state.theme.defaultMode = v),
  ));

  ['dark', 'light'].forEach(mode => {
    const vars = state.theme[mode];
    const primaryKeys = ['bg', 'surface', 'surface2', 'border', 'accent', 'accent2', 'accent3', 'text', 'text2', 'muted', 'heading'];
    const card = h('div', { class: 'card' }, h('h3', {}, mode === 'dark' ? '🌙 Dark theme colors' : '☀️ Light theme colors'));
    const grid = h('div', { class: 'grid2' });
    primaryKeys.forEach(k => { if (k in vars) grid.appendChild(colorField(k, vars[k], v => vars[k] = v)); });
    card.appendChild(grid);
    card.appendChild(h('label', { style: 'margin-top:14px;' }, 'Fonts'));
    card.appendChild(h('div', { class: 'grid2' },
      field('Body font (CSS font-family)', vars['font-body'], v => vars['font-body'] = v),
      field('Mono/heading font (CSS font-family)', vars['font-mono'], v => vars['font-mono'] = v),
    ));
    const details = h('details', { style: 'margin-top:14px;' }, h('summary', { style: 'cursor:pointer;color:var(--muted);font-size:12px;' }, `Advanced — all ${Object.keys(vars).length} variables`));
    const advGrid = h('div', { class: 'grid2', style: 'margin-top:10px;' });
    Object.keys(vars).forEach(k => advGrid.appendChild(field(k, vars[k], v => vars[k] = v)));
    details.appendChild(advGrid);
    card.appendChild(details);
    panel.appendChild(card);
  });
};

RENDERERS.social = (panel) => {
  const rerender = () => RENDERERS.social(panel);
  panel.innerHTML = '';
  panel.appendChild(h('p', { class: 'muted' }, 'These are the circular icon shortcuts in the top-right corner of your site.'));
  state.socialIcons.forEach((icon, i) => {
    panel.appendChild(listCard([
      field('Label (accessibility text)', icon.label, v => icon.label = v),
      field('Link URL', icon.href, v => icon.href = v),
      icon.icon.kind === 'image' ? field('Icon image URL', icon.icon.src, v => icon.icon.src = v) : h('div', { class: 'hint' }, 'Uses a built-in vector icon.'),
      toggleRow('Visible', !icon.hidden, v => icon.hidden = !v),
    ], {
      onUp: i > 0 ? () => { moveArr(state.socialIcons, i, -1); rerender(); } : null,
      onDown: i < state.socialIcons.length - 1 ? () => { moveArr(state.socialIcons, i, 1); rerender(); } : null,
      onRemove: () => { state.socialIcons.splice(i, 1); rerender(); },
    }));
  });
  panel.appendChild(h('button', {
    class: 'btn', onclick: () => {
      state.socialIcons.push({ id: 'icon-' + Date.now(), href: 'https://', label: 'New link', icon: { kind: 'image', src: '' }, hidden: false });
      rerender();
    }
  }, '+ Add icon shortcut'));
};

RENDERERS.hero = (panel) => {
  const rerender = () => RENDERERS.hero(panel);
  panel.innerHTML = '';
  const hero = state.hero;
  panel.appendChild(h('div', { class: 'card' },
    h('h3', {}, 'Hero section'),
    imageField('Profile photo', hero.photo, v => hero.photo = v, 'profile', rerender),
    field('Photo alt text', hero.photoAlt, v => hero.photoAlt = v),
    field('Small label above name', hero.label, v => hero.label = v),
    field('Your name (big heading)', hero.name, v => hero.name = v),
    textareaField('Subtitle line (HTML)', hero.subtitleHtml, v => hero.subtitleHtml = v),
    textareaField('Tagline paragraph (HTML)', hero.taglineHtml, v => hero.taglineHtml = v),
  ));
  panel.appendChild(h('div', { class: 'card' },
    h('h3', {}, 'Badges'),
    ...hero.badges.map((b, i) => h('div', { class: 'row' },
      (() => { const inp = field(null, b, v => hero.badges[i] = v); inp.style.flex = '1'; return inp; })(),
      h('button', { class: 'icon-btn', onclick: () => { hero.badges.splice(i, 1); rerender(); } }, '✕')
    )),
    h('button', { class: 'btn btn-sm', style: 'margin-top:8px;', onclick: () => { hero.badges.push('🔥 New Badge'); rerender(); } }, '+ Add badge'),
  ));
  panel.appendChild(h('div', { class: 'card' },
    h('h3', {}, 'Buttons'),
    ...hero.buttons.map((btn, i) => listCard([
      field('Label', btn.label, v => btn.label = v),
      field('Link (URL or #section-id)', btn.href, v => btn.href = v),
      selectField('Style', btn.style, [{ value: 'btn-a', label: 'Solid (primary)' }, { value: 'btn-b', label: 'Outline (secondary)' }], v => btn.style = v),
    ], { onRemove: () => { hero.buttons.splice(i, 1); rerender(); } })),
    h('button', { class: 'btn btn-sm', onclick: () => { hero.buttons.push({ label: 'New Button', href: '#', style: 'btn-b' }); rerender(); } }, '+ Add button'),
  ));
};

RENDERERS.stats = (panel) => {
  const rerender = () => RENDERERS.stats(panel);
  panel.innerHTML = '';
  state.stats.forEach((s, i) => {
    panel.appendChild(listCard([
      field('Number (e.g. 4+, 95%)', s.number, v => s.number = v),
      field('Label', s.label, v => s.label = v),
      textareaField('Tooltip on hover (optional, use \\n for line breaks)', s.tooltip, v => s.tooltip = v),
    ], {
      onUp: i > 0 ? () => { moveArr(state.stats, i, -1); rerender(); } : null,
      onDown: i < state.stats.length - 1 ? () => { moveArr(state.stats, i, 1); rerender(); } : null,
      onRemove: () => { state.stats.splice(i, 1); rerender(); },
    }));
  });
  panel.appendChild(h('button', { class: 'btn', onclick: () => { state.stats.push({ number: '0', label: 'New Stat', tooltip: '' }); rerender(); } }, '+ Add stat'));
};

RENDERERS.about = (panel) => {
  const rerender = () => RENDERERS.about(panel);
  panel.innerHTML = '';
  const { about, expertise, skills } = state;

  panel.appendChild(h('div', { class: 'card' },
    h('h3', {}, about.heading + ' (About)'),
    field('Heading', about.heading, v => about.heading = v),
    ...about.paragraphsHtml.map((p, i) => h('div', { class: 'row', style: 'align-items:flex-start;' },
      (() => { const t = textareaField(null, p, v => about.paragraphsHtml[i] = v); t.style.flex = '1'; return t; })(),
      h('button', { class: 'icon-btn', onclick: () => { about.paragraphsHtml.splice(i, 1); rerender(); } }, '✕')
    )),
    h('button', { class: 'btn btn-sm', onclick: () => { about.paragraphsHtml.push('New paragraph.'); rerender(); } }, '+ Add paragraph'),
  ));

  const expCard = h('div', { class: 'card' }, h('h3', {}, expertise.heading));
  expCard.appendChild(field('Heading', expertise.heading, v => expertise.heading = v));
  expertise.cards.forEach((c, i) => {
    expCard.appendChild(listCard([
      field('Title (emoji + text)', c.title, v => c.title = v),
      ...c.items.map((it, j) => h('div', { class: 'row' },
        (() => { const inp = field(null, it, v => c.items[j] = v); inp.style.flex = '1'; return inp; })(),
        h('button', { class: 'icon-btn', onclick: () => { c.items.splice(j, 1); rerender(); } }, '✕')
      )),
      h('button', { class: 'btn btn-sm', onclick: () => { c.items.push('New point'); rerender(); } }, '+ Add bullet'),
    ], { onRemove: () => { expertise.cards.splice(i, 1); rerender(); } }));
  });
  expCard.appendChild(h('button', { class: 'btn', onclick: () => { expertise.cards.push({ title: '🆕 New Category', items: [] }); rerender(); } }, '+ Add expertise card'));
  panel.appendChild(expCard);

  const skillsCard = h('div', { class: 'card' }, h('h3', {}, skills.heading));
  skillsCard.appendChild(field('Heading', skills.heading, v => skills.heading = v));
  skills.groups.forEach((g, i) => {
    skillsCard.appendChild(listCard([
      field('Group title', g.title, v => g.title = v),
      field('Tags (comma separated)', g.tags.join(', '), v => g.tags = v.split(',').map(s => s.trim()).filter(Boolean)),
    ], { onRemove: () => { skills.groups.splice(i, 1); rerender(); } }));
  });
  skillsCard.appendChild(h('button', { class: 'btn', onclick: () => { skills.groups.push({ title: 'New Group', tags: [] }); rerender(); } }, '+ Add skills group'));
  panel.appendChild(skillsCard);
};

RENDERERS.experience = (panel) => {
  const rerender = () => RENDERERS.experience(panel);
  panel.innerHTML = '';
  const { experience, certifications, whyWorkWithMe } = state;

  const expCard = h('div', { class: 'card' }, h('h3', {}, experience.heading + ' (Timeline)'));
  experience.items.forEach((it, i) => {
    expCard.appendChild(listCard([
      field('Job title', it.title, v => it.title = v),
      field('Company · dates', it.meta, v => it.meta = v),
      textareaField('Description', it.descriptionHtml, v => it.descriptionHtml = v),
    ], {
      onUp: i > 0 ? () => { moveArr(experience.items, i, -1); rerender(); } : null,
      onDown: i < experience.items.length - 1 ? () => { moveArr(experience.items, i, 1); rerender(); } : null,
      onRemove: () => { experience.items.splice(i, 1); rerender(); },
    }));
  });
  expCard.appendChild(h('button', { class: 'btn', onclick: () => { experience.items.push({ title: 'New Role', meta: 'Company · dates', descriptionHtml: '' }); rerender(); } }, '+ Add experience'));
  panel.appendChild(expCard);

  const certCard = h('div', { class: 'card' }, h('h3', {}, certifications.heading));
  certifications.items.forEach((c, i) => {
    certCard.appendChild(h('div', { class: 'row' },
      (() => { const inp = field(null, c.name, v => c.name = v); inp.style.flex = '2'; return inp; })(),
      (() => { const inp = field(null, c.issuer, v => c.issuer = v); inp.style.flex = '1'; return inp; })(),
      h('button', { class: 'icon-btn', onclick: () => { certifications.items.splice(i, 1); rerender(); } }, '✕')
    ));
  });
  certCard.appendChild(h('button', { class: 'btn btn-sm', style: 'margin-top:8px;', onclick: () => { certifications.items.push({ name: 'New Cert', issuer: 'Issuer · Year' }); rerender(); } }, '+ Add certification'));
  panel.appendChild(certCard);

  const whyCard = h('div', { class: 'card' }, h('h3', {}, whyWorkWithMe.heading));
  whyWorkWithMe.cards.forEach((c, i) => {
    whyCard.appendChild(listCard([
      field('Title (emoji + text)', c.title, v => c.title = v),
      textareaField('Text', c.textHtml, v => c.textHtml = v),
    ], { onRemove: () => { whyWorkWithMe.cards.splice(i, 1); rerender(); } }));
  });
  whyCard.appendChild(h('button', { class: 'btn', onclick: () => { whyWorkWithMe.cards.push({ title: '🆕 New Reason', textHtml: '' }); rerender(); } }, '+ Add card'));
  panel.appendChild(whyCard);
};

RENDERERS.philosophy = (panel) => {
  panel.innerHTML = '';
  const p = state.philosophy;
  panel.appendChild(h('div', { class: 'card' },
    h('h3', {}, 'Philosophy / closing statement'),
    field('Heading', p.heading, v => p.heading = v),
    textareaField('Quote', p.quoteHtml, v => p.quoteHtml = v),
    ...p.paragraphsHtml.map((para, i) => textareaField('Paragraph ' + (i + 1), para, v => p.paragraphsHtml[i] = v)),
  ));
};

RENDERERS.contact = (panel) => {
  const rerender = () => RENDERERS.contact(panel);
  panel.innerHTML = '';
  const c = state.contact;
  panel.appendChild(h('div', { class: 'card' },
    h('h3', {}, 'Contact section'),
    field('Heading', c.heading, v => c.heading = v),
    textareaField('Text', c.textHtml, v => c.textHtml = v),
    textareaField('Tagline (bottom, italic)', c.taglineHtml, v => c.taglineHtml = v),
  ));
  const btnCard = h('div', { class: 'card' }, h('h3', {}, 'Contact buttons'));
  c.buttons.forEach((b, i) => {
    btnCard.appendChild(listCard([
      field('Label', b.label, v => b.label = v),
      field('Link (URL, mailto:, or file path)', b.href, v => b.href = v),
      selectField('Style', b.style, [{ value: 'btn-a', label: 'Solid' }, { value: 'btn-b', label: 'Outline' }], v => b.style = v),
    ], { onRemove: () => { c.buttons.splice(i, 1); rerender(); } }));
  });
  btnCard.appendChild(h('button', { class: 'btn', onclick: () => { c.buttons.push({ label: 'New Button', href: '#', style: 'btn-b' }); rerender(); } }, '+ Add button'));
  panel.appendChild(btnCard);

  panel.appendChild(h('div', { class: 'card' },
    h('h3', {}, 'Footer'),
    field('Footer left text', state.footer.left, v => state.footer.left = v),
    field('Copyright suffix (after year)', state.footer.copyrightSuffix, v => state.footer.copyrightSuffix = v),
  ));
};

RENDERERS.layout = (panel) => {
  const rerender = () => RENDERERS.layout(panel);
  panel.innerHTML = '';
  const labels = { hero: 'Hero', stats: 'Stats bar', about: 'About / Expertise / Skills', experience: 'Experience / Certs / Why', projects: 'Projects', philosophy: 'Philosophy', contact: 'Contact' };
  panel.appendChild(h('p', { class: 'muted' }, 'Turn sections on/off and reorder them (order below = order on the page).'));
  const order = state.layout.order.filter(k => labels[k]);
  order.forEach((key, i) => {
    const row = toggleRow(labels[key], !state.layout.hidden.includes(key), (on) => {
      state.layout.hidden = state.layout.hidden.filter(k => k !== key);
      if (!on) state.layout.hidden.push(key);
    }, h('div', { class: 'row', style: 'margin-right:10px;' },
      i > 0 ? h('button', { class: 'icon-btn', onclick: () => { moveArr(order, i, -1); state.layout.order = order; rerender(); } }, '↑') : null,
      i < order.length - 1 ? h('button', { class: 'icon-btn', onclick: () => { moveArr(order, i, 1); state.layout.order = order; rerender(); } }, '↓') : null,
    ));
    panel.appendChild(row);
  });

  panel.appendChild(h('h3', { style: 'margin-top:24px;' }, 'Project categories'));
  state.categories.forEach((cat, i) => {
    panel.appendChild(toggleRow(cat.title, !cat.hidden, v => cat.hidden = !v, h('div', { class: 'row', style: 'margin-right:10px;' },
      i > 0 ? h('button', { class: 'icon-btn', onclick: () => { moveArr(state.categories, i, -1); rerender(); } }, '↑') : null,
      i < state.categories.length - 1 ? h('button', { class: 'icon-btn', onclick: () => { moveArr(state.categories, i, 1); rerender(); } }, '↓') : null,
    )));
  });
};

RENDERERS.projects = (panel) => {
  const rerender = () => RENDERERS.projects(panel);
  panel.innerHTML = '';
  state.categories.forEach((cat) => {
    const catCard = h('div', { class: 'card' });
    catCard.appendChild(h('h3', {}, cat.title));
    catCard.appendChild(field('Category title', cat.title, v => cat.title = v));
    catCard.appendChild(field('Nav pill label', cat.navLabel, v => cat.navLabel = v));
    catCard.appendChild(textareaField('Category description', cat.descriptionHtml, v => cat.descriptionHtml = v));

    cat.projects.forEach((proj, pi) => {
      const rerenderProject = () => rerender();
      const projWrap = h('div', { class: 'card-inner' });
      projWrap.appendChild(h('div', { class: 'item-toolbar' },
        h('button', { class: 'icon-btn', onclick: () => { moveArr(cat.projects, pi, -1); rerender(); } }, '↑'),
        h('button', { class: 'icon-btn', onclick: () => { moveArr(cat.projects, pi, 1); rerender(); } }, '↓'),
        h('button', { class: 'icon-btn', onclick: () => { cat.projects.splice(pi, 1); rerender(); } }, '✕'),
      ));
      projWrap.appendChild(field('Project title', proj.title, v => proj.title = v));
      projWrap.appendChild(textareaField('Subtitle', proj.subtitleHtml, v => proj.subtitleHtml = v));
      projWrap.appendChild(toggleRow('Visible', !proj.hidden, v => proj.hidden = !v));

      projWrap.appendChild(h('label', { style: 'margin-top:14px;' }, 'Links (Live Demo, GitHub, etc.)'));
      (proj.links || []).forEach((l, li) => {
        projWrap.appendChild(h('div', { class: 'row' },
          (() => { const inp = field(null, l.label, v => l.label = v); inp.style.flex = '1'; return inp; })(),
          (() => { const inp = field(null, l.href, v => l.href = v); inp.style.flex = '2'; return inp; })(),
          h('button', { class: 'icon-btn', onclick: () => { proj.links.splice(li, 1); rerender(); } }, '✕')
        ));
      });
      projWrap.appendChild(h('button', { class: 'btn btn-sm', onclick: () => { proj.links = proj.links || []; proj.links.push({ label: 'Live Demo', href: '#' }); rerender(); } }, '+ Add link'));

      const blocksLabel = h('label', { style: 'margin-top:16px;' }, 'Content blocks');
      projWrap.appendChild(blocksLabel);
      const blocksContainer = h('div', {});
      projWrap.appendChild(blocksContainer);
      renderProjectBlocks(proj, blocksContainer, rerenderProject);

      catCard.appendChild(projWrap);
    });

    catCard.appendChild(h('button', {
      class: 'btn', onclick: () => {
        cat.projects.push({ title: 'New Project', subtitleHtml: '', links: [], blocks: [{ type: 'paragraph', html: 'Describe this project…' }], hidden: false });
        rerender();
      }
    }, '+ Add project to ' + cat.title));
    panel.appendChild(catCard);
  });
};

RENDERERS.pages = (panel) => {
  panel.innerHTML = '';
  panel.appendChild(h('p', { class: 'muted' }, 'Each page is its own folder in your repo with its own content.json, using the same design. Adding "page1" creates aman5z.in/page1.'));
  state.pages.forEach((p) => {
    panel.appendChild(listCard([
      h('div', {}, h('strong', {}, p.title || '(untitled)'), h('div', { class: 'hint' }, p.slug ? `aman5z.in/${p.slug}` : 'aman5z.in (home)')),
      p.slug ? h('button', { class: 'btn btn-sm', onclick: () => switchPage(p) }, 'Edit this page →') : h('span', { class: 'hint' }, 'Currently editing'),
    ]));
  });

  const newSlug = field('New page URL slug (e.g. "resume" → aman5z.in/resume)', '', () => {});
  panel.appendChild(h('div', { class: 'card' },
    h('h3', {}, 'Add a new page'),
    newSlug,
    h('button', {
      class: 'btn btn-primary', style: 'margin-top:10px;',
      onclick: async (e) => {
        const slug = newSlug.querySelector('input').value.trim().replace(/^\/|\/$/g, '');
        if (!slug) { toast('Enter a slug first', 'err'); return; }
        e.target.textContent = 'Creating…';
        try {
          await createPage(slug);
          toast('Page created ✓ — remember to Save Changes');
          renderMain();
        } catch (err) {
          toast(err.message, 'err');
          e.target.textContent = 'Create page';
        }
      }
    }, 'Create page'),
  ));
};

async function createPage(slug) {
  const [indexHtml, renderJs, behaviorJs] = await Promise.all([
    GH.getFile('index.html'), GH.getFile('render.js'), GH.getFile('behavior.js'),
  ]);
  await GH.putFile(`${slug}/index.html`, indexHtml.text, `Create page: ${slug}`);
  await GH.putFile(`${slug}/render.js`, renderJs.text, `Create page: ${slug}`);
  await GH.putFile(`${slug}/behavior.js`, behaviorJs.text, `Create page: ${slug}`);
  const newContent = JSON.parse(JSON.stringify(state));
  newContent.categories = []; // start new pages blank on projects; keep hero/about etc as starting point
  await GH.putFile(`${slug}/content.json`, JSON.stringify(newContent, null, 2), `Create page: ${slug}`);
  state.pages.push({ slug, path: `${slug}/index.html`, title: slug, contentFile: `${slug}/content.json` });
}

async function switchPage(p) {
  activePage = p;
  await loadContent(p.contentFile);
  activeTab = 'settings';
  renderMain();
}

/* ───────────────────────── BOOT ───────────────────────── */
(async function boot() {
  const cfg = GH.getConfig();
  if (!cfg || !cfg.token) { renderConnectScreen(); return; }
  try {
    await loadContent();
    renderMain();
  } catch (e) {
    toast(e.message, 'err');
    renderConnectScreen();
  }
})();
