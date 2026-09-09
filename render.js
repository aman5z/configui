/* render.js — loads /content.json and builds the page from it.
   Edit content via /admin — never edit index.html directly for content changes. */

const SVG_ICONS = {
  linkedin: `<svg height="20" viewBox="0 0 24 24" width="20" fill="var(--toggle-c)"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>`,
  github: `<svg height="20" viewBox="0 0 16 16" width="20" fill="var(--toggle-c)"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>`,
  youtube: `<svg height="20" viewBox="0 0 24 24" width="20" fill="var(--toggle-c)"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>`
};

async function fetchJson(path) {
  const res = await fetch(`${path}?_=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${path} failed to load: ${res.status}`);
  return res.json();
}

async function loadContent() {
  const pageKey = document.body.dataset.page || 'content';
  const base = await fetchJson('/content.json');
  if (pageKey === 'content') return base;
  const extra = await fetchJson(`/${pageKey}.json`);
  return {
    meta: { ...base.meta, ...extra.meta },
    theme: base.theme,
    navLinks: base.navLinks,
    sections: extra.sections,
    footer: extra.footer || base.footer
  };
}

function applyMeta(meta) {
  document.title = meta.title || document.title;
  const setAttr = (sel, attr, val) => { const el = document.querySelector(sel); if (el && val) el.setAttribute(attr, val); };
  setAttr('link[rel="icon"]', 'href', meta.favicon);
  setAttr('meta[name="description"]', 'content', meta.description);
  setAttr('meta[property="og:image"]', 'content', meta.ogImage);
  setAttr('meta[name="twitter:image"]', 'content', meta.ogImage);
  setAttr('link[rel="canonical"]', 'href', meta.canonical);
}

function applyTheme(theme) {
  const saved = localStorage.getItem('portfolio-theme') || theme.default || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  const root = document.documentElement.style;
  if (theme.accent) root.setProperty('--accent', theme.accent);
  if (theme.accent2) root.setProperty('--accent2', theme.accent2);
  if (theme.fontBody) root.setProperty('--font-body', `'${theme.fontBody}', sans-serif`);
  if (theme.fontMono) root.setProperty('--font-mono', `'${theme.fontMono}', monospace`);
}

function renderNavLinks(navLinks) {
  const wrap = document.getElementById('nav-links');
  wrap.innerHTML = '';
  // spaced 52px apart, rightmost = last in array
  navLinks.forEach((link, i) => {
    const a = document.createElement('a');
    a.className = 'social-btn';
    a.id = link.id + '-btn';
    a.href = link.href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.setAttribute('aria-label', link.label);
    a.style.right = (216 + (navLinks.length - 1 - i) * 52) + 'px';
    if (link.icon && link.icon.startsWith('svg:')) {
      a.innerHTML = SVG_ICONS[link.icon.slice(4)] || '';
    } else if (link.icon) {
      a.innerHTML = `<img src="${link.icon}" alt="" style="width:20px;height:20px;border-radius:4px;object-fit:contain;">`;
    }
    wrap.appendChild(a);
  });
}

function renderSections(sections) {
  const main = document.getElementById('main-content');
  main.innerHTML = '';
  sections
    .filter(s => s.visible)
    .sort((a, b) => a.order - b.order)
    .forEach(s => {
      if (s.type === 'hero') {
        main.insertAdjacentHTML('beforeend', `<div class="hero"><div class="hero-inner">${s.bodyHtml}</div></div>`);
      } else {
        const wrap = document.createElement('div');
        wrap.dataset.sectionId = s.id;
        wrap.innerHTML = s.bodyHtml;
        main.appendChild(wrap);
      }
    });
}

function initInteractions() {
  const html = document.documentElement;
  const themeToggle = document.getElementById('theme-toggle');
  const toggleIcon = document.getElementById('toggle-icon');
  const toggleLabel = document.getElementById('toggle-label');
  const themeColorMeta = document.getElementById('theme-color-meta');

  function setTheme(t) {
    html.setAttribute('data-theme', t);
    localStorage.setItem('portfolio-theme', t);
    themeColorMeta.setAttribute('content', t === 'dark' ? '#0c0e12' : '#f8f9fa');
    toggleIcon.textContent = t === 'dark' ? '☀️' : '🌙';
    toggleLabel.textContent = t === 'dark' ? 'Light Mode' : 'Dark Mode';
  }
  themeToggle.addEventListener('click', () => setTheme(html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'));
  setTheme(html.getAttribute('data-theme') || 'dark');
  const fy = document.getElementById('footer-year');
  if (fy) fy.textContent = new Date().getFullYear();

  // Lightbox
  const lb = document.getElementById('lb');
  const lbClose = document.getElementById('lb-close');
  const lbImg = document.getElementById('lb-img');
  let lastTrigger = null;
  function openLightbox(img) { lastTrigger = img; lbImg.src = img.src; lbImg.alt = img.alt; lb.classList.add('open'); lbClose.focus(); }
  function closeLightbox() { lb.classList.remove('open'); if (lastTrigger) lastTrigger.focus(); }
  document.querySelectorAll('.gallery img').forEach(img => {
    img.setAttribute('tabindex', '0');
    img.setAttribute('role', 'button');
    img.addEventListener('click', () => openLightbox(img));
    img.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLightbox(img); } });
  });
  lbClose.addEventListener('click', closeLightbox);
  lb.addEventListener('click', e => { if (e.target === lb) closeLightbox(); });
  document.addEventListener('keydown', e => { if (lb.classList.contains('open') && e.key === 'Escape') closeLightbox(); });

  // Smooth scroll
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const target = document.querySelector(a.getAttribute('href'));
      if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    });
  });

  // Hide/show nav-link buttons on scroll
  const socialBtns = document.querySelectorAll('#nav-links .social-btn');
  window.addEventListener('scroll', () => {
    const hide = window.scrollY > 80;
    socialBtns.forEach(btn => btn.classList.toggle('social-hidden', hide));
  });

  // Collapse / expand project cards
  document.querySelectorAll('.project-card').forEach(card => {
    const firstEl = card.querySelector('.card-body > p, .card-body > ul');
    if (firstEl) {
      const preview = document.createElement('div');
      preview.className = 'card-preview';
      preview.textContent = firstEl.tagName === 'P' ? firstEl.textContent
        : Array.from(firstEl.querySelectorAll('li')).map(li => '• ' + li.textContent).join('  ');
      card.querySelector('.card-header').insertAdjacentElement('afterend', preview);
    }
    const chevron = document.createElement('div');
    chevron.className = 'card-chevron';
    chevron.innerHTML = '<span class="chev-lbl"></span><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 4.5L7 9.5L12 4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    const body = card.querySelector('.card-body');
    if (body) body.insertAdjacentElement('beforebegin', chevron); else card.appendChild(chevron);
    function sync() {
      const collapsed = card.classList.contains('collapsed');
      chevron.querySelector('.chev-lbl').textContent = collapsed ? 'expand' : 'collapse';
      card.setAttribute('aria-expanded', String(!collapsed));
    }
    card.classList.add('collapsed');
    sync();
    card.addEventListener('click', e => {
      if (e.target.closest('a') || e.target.closest('iframe')) return;
      card.classList.toggle('collapsed');
      sync();
    });
  });
}

(async function init() {
  try {
    const content = await loadContent();
    applyMeta(content.meta);
    applyTheme(content.theme);
    renderNavLinks(content.navLinks);
    renderSections(content.sections);
    const footerText = document.getElementById('footer-text');
    if (footerText) footerText.textContent = content.footer.text;
    initInteractions();
  } catch (err) {
    console.error(err);
    document.getElementById('main-content').innerHTML =
      '<div style="padding:60px;text-align:center;color:#888;">Content failed to load. Check content.json.</div>';
  }
})();
