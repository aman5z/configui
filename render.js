/* ══════════════════════════════════════════
   render.js — builds the entire page body from content.json
   Do not hand-edit page content in index.html; edit content.json
   (or use /admin) instead. This file just draws whatever the JSON says.
══════════════════════════════════════════ */
(function () {
  const el = (tag, attrs = {}, html) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k === 'html') n.innerHTML = v;
      else n.setAttribute(k, v === true ? '' : v);
    }
    if (html !== undefined) n.innerHTML = html;
    return n;
  };
  const esc = (s) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  function applyTheme(theme) {
    const style = document.createElement('style');
    const toCss = (vars) => Object.entries(vars).map(([k, v]) => `--${k}: ${v};`).join('\n');
    style.textContent = `:root{${toCss(theme.dark)}}\n[data-theme="light"]{${toCss(theme.light)}}`;
    document.head.appendChild(style);
    const saved = localStorage.getItem('portfolio-theme');
    document.documentElement.setAttribute('data-theme', saved || theme.defaultMode || 'dark');
  }

  function applyMeta(meta) {
    if (meta.title) document.title = meta.title;
    const setMeta = (sel, content) => { const m = document.querySelector(sel); if (m && content) m.setAttribute('content', content); };
    setMeta('meta[name="description"]', meta.description);
    setMeta('meta[name="keywords"]', meta.keywords);
    setMeta('meta[property="og:description"]', meta.description);
    setMeta('meta[property="og:title"]', meta.title);
    if (meta.favicon) { const l = document.querySelector('link[rel="icon"]'); if (l) l.href = meta.favicon; }
  }

  function renderSocials(icons) {
    const wrap = document.getElementById('social-icons');
    wrap.innerHTML = '';
    let rightOffset = 372;
    icons.filter(i => !i.hidden).forEach((icon) => {
      const a = el('a', { id: icon.id, class: 'social-btn', href: icon.href, target: '_blank', rel: 'noopener noreferrer', 'aria-label': icon.label });
      a.style.right = rightOffset + 'px';
      rightOffset -= 52;
      if (icon.icon.kind === 'image') {
        a.appendChild(el('img', { src: icon.icon.src, alt: '', loading: 'lazy' }));
      } else {
        a.innerHTML = icon.icon.svg;
      }
      wrap.appendChild(a);
    });
  }

  function renderHero(hero) {
    const wrap = el('div', { class: 'hero' });
    const inner = el('div', { class: 'hero-inner' });
    inner.appendChild(el('img', { class: 'hero-photo', src: hero.photo, alt: hero.photoAlt }));
    const copy = el('div', { class: 'hero-copy' });
    copy.appendChild(el('div', { class: 'hero-label' }, hero.label));
    copy.appendChild(el('h1', {}, esc(hero.name)));
    copy.appendChild(el('div', { class: 'hero-subtitle', html: hero.subtitleHtml }));
    copy.appendChild(el('p', { class: 'hero-tagline', html: hero.taglineHtml }));
    const badges = el('div', { class: 'hero-badges' });
    hero.badges.forEach(b => badges.appendChild(el('span', { class: 'hero-badge' }, esc(b))));
    copy.appendChild(badges);
    const contact = el('div', { class: 'hero-contact' });
    hero.buttons.forEach(b => {
      const a = el('a', { href: b.href, class: 'btn ' + b.style, download: b.download || undefined }, esc(b.label));
      contact.appendChild(a);
    });
    copy.appendChild(contact);
    inner.appendChild(copy);
    wrap.appendChild(inner);
    return wrap;
  }

  function renderStats(stats) {
    const wrap = el('div', { class: 'stats-section' });
    const grid = el('div', { class: 'stats-grid' });
    stats.forEach(s => {
      const attrs = { class: 'stat-card' };
      if (s.tooltip) { attrs['data-tooltip'] = s.tooltip.replace(/\\n/g, '\n'); attrs.tabindex = '0'; }
      const card = el('div', attrs);
      card.appendChild(el('span', { class: 'number' }, esc(s.number)));
      card.appendChild(el('span', { class: 'label' }, esc(s.label)));
      grid.appendChild(card);
    });
    wrap.appendChild(grid);
    return wrap;
  }

  function bioSection(heading, bodyBuilder) {
    const sec = el('div', { class: 'bio-section' });
    sec.appendChild(el('div', { class: 'section-h2' }, esc(heading)));
    bodyBuilder(sec);
    return sec;
  }

  function renderAboutExpertiseSkills(d) {
    const wrap = el('div', { class: 'bio-section-wrap' });
    if (!d.layout.hidden.includes('about')) {
      wrap.appendChild(bioSection(d.about.heading, (sec) => {
        d.about.paragraphsHtml.forEach(p => sec.appendChild(el('p', { class: 'about-text', html: p })));
      }));
    }
    if (!d.layout.hidden.includes('expertise')) {
      wrap.appendChild(bioSection(d.expertise.heading, (sec) => {
        const grid = el('div', { class: 'expertise-grid' });
        d.expertise.cards.forEach(c => {
          const card = el('div', { class: 'expertise-card' });
          card.appendChild(el('h4', {}, c.title));
          const ul = el('ul');
          c.items.forEach(i => ul.appendChild(el('li', {}, esc(i))));
          card.appendChild(ul);
          grid.appendChild(card);
        });
        sec.appendChild(grid);
      }));
    }
    if (!d.layout.hidden.includes('skills')) {
      wrap.appendChild(bioSection(d.skills.heading, (sec) => {
        d.skills.groups.forEach(g => {
          const group = el('div', { class: 'skills-group' });
          group.appendChild(el('h3', {}, esc(g.title)));
          const tags = el('div', { class: 'skills-tags' });
          g.tags.forEach(t => tags.appendChild(el('span', { class: 'skill-tag' }, esc(t))));
          group.appendChild(tags);
          sec.appendChild(group);
        });
      }));
    }
    return wrap;
  }

  function renderExperienceCertsWhy(d) {
    const wrap = el('div', { class: 'bio-section-wrap' });
    if (!d.layout.hidden.includes('experience')) {
      wrap.appendChild(bioSection(d.experience.heading, (sec) => {
        const tl = el('div', { class: 'timeline-wrap' });
        d.experience.items.forEach(it => {
          const item = el('div', { class: 'timeline-item' });
          item.appendChild(el('h4', {}, it.title));
          item.appendChild(el('div', { class: 'timeline-meta' }, esc(it.meta)));
          item.appendChild(el('p', { html: it.descriptionHtml }));
          tl.appendChild(item);
        });
        sec.appendChild(tl);
      }));
    }
    if (!d.layout.hidden.includes('certifications')) {
      wrap.appendChild(bioSection(d.certifications.heading, (sec) => {
        const grid = el('div', { class: 'cert-grid' });
        d.certifications.items.forEach(c => {
          const item = el('div', { class: 'cert-item' });
          item.appendChild(el('strong', {}, c.name));
          item.appendChild(el('span', {}, esc(c.issuer)));
          grid.appendChild(item);
        });
        sec.appendChild(grid);
      }));
    }
    if (!d.layout.hidden.includes('whyWorkWithMe')) {
      wrap.appendChild(bioSection(d.whyWorkWithMe.heading, (sec) => {
        const grid = el('div', { class: 'why-grid' });
        d.whyWorkWithMe.cards.forEach(c => {
          const card = el('div', { class: 'why-card' });
          card.appendChild(el('h4', {}, c.title));
          card.appendChild(el('p', { html: c.textHtml }));
          grid.appendChild(card);
        });
        sec.appendChild(grid);
      }));
    }
    return wrap;
  }

  function renderBlock(b) {
    switch (b.type) {
      case 'paragraph':
        return el('p', { html: b.html });
      case 'featurelist': {
        const ul = el('ul', { class: 'feature-list' });
        b.items.forEach(i => ul.appendChild(el('li', { html: i })));
        return ul;
      }
      case 'subitems': {
        const grid = el('div', { class: 'sub-items' });
        b.items.forEach(i => {
          const item = el('div', { class: 'sub-item' });
          item.appendChild(el('h4', { html: i.title }));
          item.appendChild(el('p', { html: i.textHtml }));
          grid.appendChild(item);
        });
        return grid;
      }
      case 'gallery': {
        const g = el('div', { class: 'gallery' });
        b.items.forEach(i => {
          if (i.kind === 'img') g.appendChild(el('img', { src: i.src, alt: i.alt, loading: 'lazy' }));
          else g.appendChild(el('iframe', { src: i.src, title: i.title, allowfullscreen: true, loading: 'lazy' }));
        });
        return g;
      }
      case 'techstack': {
        const t = el('div', { class: 'tech-stack' });
        b.tags.forEach(tag => t.appendChild(el('span', { class: 'tech' }, esc(tag))));
        return t;
      }
      case 'divider':
        return el('div', { class: 'card-divider' });
      case 'subheading':
        return el('div', { class: 'card-title card-title-sm' }, esc(b.text));
      case 'partslist': {
        const list = el('div', { class: 'parts-list' });
        b.items.forEach(i => {
          const item = el('div', { class: 'part-item' });
          item.appendChild(el('div', { class: 'part-dot' }));
          const right = el('div');
          right.appendChild(el('span', { class: 'part-name' }, esc(i.name)));
          right.appendChild(el('span', { class: 'part-desc' }, esc(i.desc)));
          item.appendChild(right);
          list.appendChild(item);
        });
        return list;
      }
      case 'conntable': {
        const t = el('div', { class: 'conn-table' });
        b.rows.forEach(r => {
          const row = el('div', { class: 'conn-row' });
          row.appendChild(el('span', { class: 'conn-key' }, esc(r.key)));
          row.appendChild(el('span', {}, '→ ' + esc(r.value)));
          t.appendChild(row);
        });
        return t;
      }
      case 'scenariolist': {
        const list = el('div', { class: 'scenario-list' });
        b.items.forEach(i => {
          const item = el('div', { class: 'scenario' });
          item.appendChild(el('span', { class: 'scenario-cmd' }, esc(i.cmd)));
          item.appendChild(el('span', { class: 'scenario-desc', html: i.descHtml }));
          list.appendChild(item);
        });
        return list;
      }
      case 'networktable': {
        const table = el('table', { class: 'network-table' });
        const thead = el('thead');
        const trh = el('tr');
        b.headers.forEach(h => trh.appendChild(el('th', {}, esc(h))));
        thead.appendChild(trh);
        table.appendChild(thead);
        const tbody = el('tbody');
        b.rows.forEach(r => {
          const tr = el('tr');
          r.forEach(cell => tr.appendChild(el('td', { html: cell })));
          tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        return table;
      }
      case 'cardlinks': {
        const div = el('div', { class: 'card-links' });
        b.links.forEach(l => div.appendChild(el('a', { href: l.href, target: '_blank', rel: 'noopener noreferrer', class: 'card-link' }, esc(l.label))));
        return div;
      }
      default:
        return el('div', { html: b.html || '' });
    }
  }

  function renderProjects(d) {
    if (d.layout.hidden.includes('projects')) return document.createDocumentFragment();
    const frag = document.createDocumentFragment();

    const header = el('div', { class: 'projects-header' });
    header.appendChild(el('div', { class: 'projects-label' }, esc(d.projectsHeader.label)));
    header.appendChild(el('div', { class: 'projects-title' }, esc(d.projectsHeader.title)));
    header.appendChild(el('p', { class: 'projects-desc', html: d.projectsHeader.descriptionHtml }));
    frag.appendChild(header);

    const visibleCats = d.categories.filter(c => !c.hidden);
    const nav = el('nav', { class: 'cat-nav', 'aria-label': 'Project categories' });
    visibleCats.forEach(c => nav.appendChild(el('a', { href: '#' + c.id, class: 'cat-pill ' + c.pillClass }, esc(c.navLabel))));
    frag.appendChild(nav);

    visibleCats.forEach((cat, catIdx) => {
      const sec = el('section', { class: 'proj-section', id: cat.id });
      const sh = el('div', { class: 'section-header' });
      sh.appendChild(el('span', { class: 'section-index' }, cat.index));
      const right = el('div');
      right.appendChild(el('span', { class: 'section-tag ' + cat.tagClass }, esc(cat.tagText)));
      right.appendChild(el('div', { class: 'section-title' }, esc(cat.title)));
      right.appendChild(el('p', { class: 'section-desc', html: cat.descriptionHtml }));
      sh.appendChild(right);
      sec.appendChild(sh);

      const grid = el('div', { class: 'projects-grid' });
      cat.projects.filter(p => !p.hidden).forEach(proj => {
        const card = el('div', { class: 'project-card' });
        const ch = el('div', { class: 'card-header' });
        const left = el('div');
        left.appendChild(el('div', { class: 'card-title' }, esc(proj.title)));
        if (proj.subtitleHtml) left.appendChild(el('div', { class: 'card-subtitle', html: proj.subtitleHtml }));
        if (proj.links && proj.links.length) {
          const linksDiv = el('div', { class: 'card-links' });
          proj.links.forEach(l => linksDiv.appendChild(el('a', { href: l.href, target: '_blank', rel: 'noopener noreferrer', class: 'card-link' }, esc(l.label))));
          if (proj.linkNote) linksDiv.appendChild(el('span', {}, esc(proj.linkNote)));
          left.appendChild(linksDiv);
        }
        ch.appendChild(left);
        if (proj.badge) ch.appendChild(el('div', { class: 'card-badge ' + proj.badge.class }, esc(proj.badge.text)));
        card.appendChild(ch);

        const body = el('div', { class: 'card-body' });
        proj.blocks.forEach(b => body.appendChild(renderBlock(b)));
        card.appendChild(body);
        grid.appendChild(card);
      });
      sec.appendChild(grid);
      frag.appendChild(sec);
    });
    return frag;
  }

  function renderPhilosophy(d) {
    const wrap = el('div', { class: 'philosophy-section' });
    const inner = el('div', { class: 'philosophy-inner' });
    inner.appendChild(el('h2', {}, esc(d.philosophy.heading)));
    inner.appendChild(el('p', { class: 'philosophy-quote', html: d.philosophy.quoteHtml }));
    d.philosophy.paragraphsHtml.forEach(p => inner.appendChild(el('p', { html: p })));
    wrap.appendChild(inner);
    return wrap;
  }

  function renderContact(d) {
    const wrap = el('div', { class: 'contact-section' });
    const inner = el('div', { class: 'contact-inner' });
    inner.appendChild(el('h2', {}, esc(d.contact.heading)));
    inner.appendChild(el('p', { html: d.contact.textHtml }));
    const btns = el('div', { class: 'contact-btns' });
    d.contact.buttons.forEach(b => {
      btns.appendChild(el('a', {
        href: b.href, class: 'btn ' + b.style,
        download: b.download || undefined,
        target: b.external ? '_blank' : undefined,
        rel: b.external ? 'noopener noreferrer' : undefined,
      }, esc(b.label)));
    });
    inner.appendChild(btns);
    inner.appendChild(el('p', { class: 'contact-tagline', html: d.contact.taglineHtml }));
    wrap.appendChild(inner);
    return wrap;
  }

  function renderFooter(d) {
    const f = document.querySelector('footer');
    f.innerHTML = '';
    f.appendChild(el('span', {}, esc(d.footer.left)));
    f.appendChild(el('span', { html: `Copyright &#169; <span id="footer-year"></span> ${esc(d.footer.copyrightSuffix)}` }));
  }

  const SECTION_RENDERERS = {
    hero: (d, main) => main.appendChild(renderHero(d.hero)),
    stats: (d, main) => main.appendChild(renderStats(d.stats)),
    about: (d, main) => main.appendChild(renderAboutExpertiseSkills(d)),
    experience: (d, main) => main.appendChild(renderExperienceCertsWhy(d)),
    projects: (d, main) => main.appendChild(renderProjects(d)),
    philosophy: (d, main) => main.appendChild(renderPhilosophy(d)),
    contact: (d, main) => main.appendChild(renderContact(d)),
  };
  // about/expertise/skills render together; experience/certs/why render together
  const GROUPED = { expertise: 'about', skills: 'about', certifications: 'experience', whyWorkWithMe: 'experience' };

  async function main() {
    const res = await fetch('content.json', { cache: 'no-store' });
    const d = await res.json();
    window.__siteData = d;

    applyMeta(d.meta);
    applyTheme(d.theme);
    renderSocials(d.socialIcons);

    const mainEl = document.getElementById('main-content');
    mainEl.innerHTML = '';
    const seen = new Set();
    d.layout.order.forEach(key => {
      const groupKey = GROUPED[key] || key;
      if (seen.has(groupKey)) return;
      seen.add(groupKey);
      const renderer = SECTION_RENDERERS[groupKey];
      if (renderer) renderer(d, mainEl);
    });

    renderFooter(d);
    document.dispatchEvent(new CustomEvent('site-rendered'));
  }

  main();
})();
