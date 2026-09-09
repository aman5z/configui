/* admin.js — talks directly to the GitHub Contents API using a PAT stored in
   this browser's localStorage only. Nothing is sent anywhere else. */

const LS_KEY = 'portfolio-admin-auth';

// ---------- Auth ----------
function doLogin() {
  const pw = document.getElementById('pw-input').value.trim();
  const pat = document.getElementById('pat-input').value.trim();
  const repo = document.getElementById('repo-input').value.trim();
  const branch = document.getElementById('branch-input').value.trim() || 'main';
  const err = document.getElementById('login-error');
  err.textContent = '';

  if (!pw) { err.textContent = 'Set a local password.'; return; }
  const saved = localStorage.getItem(LS_KEY);
  if (saved) {
    const parsed = JSON.parse(saved);
    if (parsed.pw !== pw) { err.textContent = 'Wrong password.'; return; }
    startApp(parsed);
    return;
  }
  if (!pat || !repo) { err.textContent = 'GitHub token and repo are required the first time.'; return; }
  const auth = { pw, pat, repo, branch };
  localStorage.setItem(LS_KEY, JSON.stringify(auth));
  startApp(auth);
}

function doLogout() {
  document.getElementById('app').style.display = 'none';
  document.getElementById('login').style.display = 'block';
}

let AUTH = null;
let STATE = { currentPageKey: 'content', data: null, sha: null, dirty: false, mainPagesRegistry: [] };

async function startApp(auth) {
  AUTH = auth;
  document.getElementById('login').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  wireTabs();
  await loadPage('content');
}

// ---------- GitHub API ----------
const API = 'https://api.github.com';
function b64encode(str) { return btoa(unescape(encodeURIComponent(str))); }
function b64decode(str) { return decodeURIComponent(escape(atob(str))); }

async function ghGet(path) {
  const res = await fetch(`${API}/repos/${AUTH.repo}/contents/${path}?ref=${AUTH.branch}`, {
    headers: { Authorization: `Bearer ${AUTH.pat}`, Accept: 'application/vnd.github+json' }
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub GET ${path} failed: ${res.status}`);
  const json = await res.json();
  return { content: b64decode(json.content.replace(/\n/g, '')), sha: json.sha };
}

async function ghPut(path, contentStr, sha, message) {
  const body = { message, content: b64encode(contentStr), branch: AUTH.branch };
  if (sha) body.sha = sha;
  const res = await fetch(`${API}/repos/${AUTH.repo}/contents/${path}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${AUTH.pat}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) { const t = await res.text(); throw new Error(`GitHub PUT ${path} failed: ${res.status} ${t}`); }
  return res.json();
}

async function ghPutBinary(path, base64Data, message) {
  const body = { message, content: base64Data, branch: AUTH.branch };
  const res = await fetch(`${API}/repos/${AUTH.repo}/contents/${path}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${AUTH.pat}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) { const t = await res.text(); throw new Error(`GitHub PUT ${path} failed: ${res.status} ${t}`); }
  return res.json();
}

// ---------- Status / toast ----------
function setStatus(text, cls) {
  const s = document.getElementById('status');
  s.textContent = text;
  s.className = cls || '';
}
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.display = 'block';
  setTimeout(() => t.style.display = 'none', 3500);
}
function markDirty() { STATE.dirty = true; setStatus('Unsaved changes', 'dirty'); }

// ---------- Tabs ----------
function wireTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('panel-' + tab.dataset.tab).classList.add('active');
    });
  });
  document.getElementById('page-switcher').addEventListener('change', e => loadPage(e.target.value));
}

// ---------- Load / Save page ----------
const PAGE_TEMPLATE = (pageKey) => `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
<meta charset="UTF-8">
<link rel="icon" type="image/png" href="https://aman5z.github.io/favcon.png">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="theme-color" content="#0c0e12" id="theme-color-meta">
<title>Loading…</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=DM+Sans:wght@300;400;500;600&family=Poppins:wght@400;500;600;700&display=swap">
<link rel="stylesheet" href="/assets/style.css">
</head>
<body data-page="${pageKey}">
<a href="#main-content" class="skip-link">Skip to main content</a>
<div id="nav-links"></div>
<button id="theme-toggle" aria-label="Toggle light/dark theme"><span class="toggle-icon" id="toggle-icon">☀️</span><span id="toggle-label">Light Mode</span></button>
<main id="main-content"></main>
<footer><span id="footer-text"></span><span>Copyright &#169; <span id="footer-year"></span> @aman5z.in</span></footer>
<div id="lb" role="dialog" aria-modal="true" aria-label="Image preview"><button id="lb-close" aria-label="Close image lightbox">✕</button><img id="lb-img" src="" alt="Image preview"></div>
<script src="/assets/render.js"></script>
</body>
</html>`;

async function loadPage(key) {
  if (STATE.dirty && !confirm('You have unsaved changes on the current page. Discard them?')) return;
  setStatus('Loading…');
  const path = key === 'content' ? 'content.json' : `${key}.json`;
  const file = await ghGet(path);
  if (!file) { toast('Could not load ' + path); return; }
  STATE.currentPageKey = key;
  STATE.data = JSON.parse(file.content);
  STATE.sha = file.sha;
  STATE.dirty = false;

  if (key === 'content') {
    STATE.mainPagesRegistry = STATE.data.pages || [];
    if (!STATE.data.pages) STATE.data.pages = [];
  }
  refreshPageSwitcher();
  renderSectionsPanel();
  renderGlobalPanel();
  renderNavPanel();
  renderPagesPanel();
  setStatus('Loaded ' + path);
  document.querySelectorAll('#panel-global input, #panel-global select, #panel-nav').forEach(el => {
    el.closest('.card, #panel-nav') && (el.closest('.card, #panel-nav').style.opacity = (key === 'content') ? '1' : '.4');
  });
  document.getElementById('panel-global').style.pointerEvents = key === 'content' ? 'auto' : 'none';
  document.getElementById('panel-nav').style.pointerEvents = key === 'content' ? 'auto' : 'none';
}

function refreshPageSwitcher() {
  const sel = document.getElementById('page-switcher');
  const mainReg = STATE.currentPageKey === 'content' ? STATE.data.pages : STATE.mainPagesRegistry;
  sel.innerHTML = `<option value="content">Home (index)</option>` +
    (mainReg || []).map(p => `<option value="${p.slug}">${p.title}</option>`).join('');
  sel.value = STATE.currentPageKey;
}

async function saveCurrent() {
  setStatus('Saving…', 'saving');
  try {
    const path = STATE.currentPageKey === 'content' ? 'content.json' : `${STATE.currentPageKey}.json`;
    const result = await ghPut(path, JSON.stringify(STATE.data, null, 2), STATE.sha, `Update ${path} via admin panel`);
    STATE.sha = result.content.sha;
    STATE.dirty = false;
    setStatus('Saved & live ✓');
    toast('Published to GitHub. Live in ~30–60s.');
  } catch (e) {
    console.error(e);
    setStatus('Save failed', 'error');
    toast('Save failed: ' + e.message);
  }
}

// ---------- Sections panel ----------
function renderSectionsPanel() {
  const list = document.getElementById('sections-list');
  list.innerHTML = '';
  const sections = [...STATE.data.sections].sort((a, b) => a.order - b.order);
  sections.forEach((s, idx) => {
    const item = document.createElement('div');
    item.className = 'section-item' + (s.visible ? '' : ' hidden-section');
    item.innerHTML = `
      <button class="icon-btn" title="Move up" onclick="moveSection('${s.id}',-1)">▲</button>
      <button class="icon-btn" title="Move down" onclick="moveSection('${s.id}',1)">▼</button>
      <span class="grow" style="cursor:pointer;" onclick="toggleEditor('${s.id}')">${escapeHtml(s.title)} <span class="pill">${s.type}</span></span>
      <label class="row" style="gap:4px;font-size:11px;"><input type="checkbox" ${s.visible ? 'checked' : ''} onchange="toggleVisible('${s.id}', this.checked)"> visible</label>
      <button class="icon-btn btn-danger" title="Delete section" onclick="deleteSection('${s.id}')">🗑</button>
    `;
    const editor = document.createElement('div');
    editor.className = 'editor-fields';
    editor.id = 'editor-' + s.id;
    editor.innerHTML = sectionEditorHtml(s);
    const wrap = document.createElement('div');
    wrap.appendChild(item);
    wrap.appendChild(editor);
    list.appendChild(wrap);
  });
}

function sectionEditorHtml(s) {
  return `
    <label>Section title (internal label)</label>
    <input type="text" value="${escapeAttr(s.title)}" onchange="updateSectionField('${s.id}','title',this.value)">
    <label>HTML content</label>
    <textarea rows="10" onchange="updateSectionField('${s.id}','bodyHtml',this.value)">${escapeHtml(s.bodyHtml)}</textarea>
    <div class="row" style="margin-top:10px;">
      <button class="btn-secondary btn-sm" onclick="scanImages('${s.id}')">🖼 Manage Images</button>
      <button class="btn-secondary btn-sm" onclick="scanLinks('${s.id}')">🔗 Manage Links</button>
    </div>
    <div id="images-${s.id}"></div>
    <div id="links-${s.id}"></div>
  `;
}

function toggleEditor(id) {
  document.getElementById('editor-' + id).classList.toggle('open');
}
function findSection(id) { return STATE.data.sections.find(s => s.id === id); }

function toggleVisible(id, val) { findSection(id).visible = val; markDirty(); renderSectionsPanel(); }

function moveSection(id, dir) {
  const sections = STATE.data.sections.slice().sort((a, b) => a.order - b.order);
  const idx = sections.findIndex(s => s.id === id);
  const swapIdx = idx + dir;
  if (swapIdx < 0 || swapIdx >= sections.length) return;
  const tmp = sections[idx].order;
  sections[idx].order = sections[swapIdx].order;
  sections[swapIdx].order = tmp;
  markDirty();
  renderSectionsPanel();
}

function deleteSection(id) {
  if (!confirm('Delete this section? This cannot be undone until you re-add it.')) return;
  STATE.data.sections = STATE.data.sections.filter(s => s.id !== id);
  markDirty();
  renderSectionsPanel();
}

function addSection() {
  const title = prompt('New section internal title:', 'New Section');
  if (!title) return;
  const id = 'sec-' + Date.now();
  const maxOrder = Math.max(0, ...STATE.data.sections.map(s => s.order));
  STATE.data.sections.push({ id, title, visible: true, order: maxOrder + 1, type: 'html', bodyHtml: '<div class="bio-section"><p>New section content — edit this HTML.</p></div>' });
  markDirty();
  renderSectionsPanel();
}

function updateSectionField(id, field, value) {
  findSection(id)[field] = value;
  markDirty();
  if (field === 'title') renderSectionsPanel();
}

// ---------- Images within a section ----------
function scanImages(sectionId) {
  const s = findSection(sectionId);
  const container = document.createElement('div');
  container.innerHTML = s.bodyHtml;
  const imgs = Array.from(container.querySelectorAll('img'));
  const wrap = document.getElementById('images-' + sectionId);
  if (imgs.length === 0) {
    wrap.innerHTML = `<p class="muted">No images found in this section.</p>
      <label>Add image (upload)</label>
      <input type="file" accept="image/*" onchange="addImage('${sectionId}', this.files[0])">`;
    return;
  }
  wrap.innerHTML = imgs.map((img, i) => `
    <div class="img-thumb">
      <img src="${img.src}" alt="">
      <input type="text" value="${escapeAttr(img.alt)}" placeholder="alt text" onchange="updateImageAlt('${sectionId}', ${i}, this.value)" style="font-size:11px;padding:4px;">
      <div class="row" style="gap:4px;">
        <button class="icon-btn" title="Move left" onclick="moveImage('${sectionId}',${i},-1)">◀</button>
        <button class="icon-btn" title="Move right" onclick="moveImage('${sectionId}',${i},1)">▶</button>
        <label class="icon-btn" style="cursor:pointer;" title="Replace">⤴<input type="file" accept="image/*" style="display:none" onchange="replaceImage('${sectionId}',${i},this.files[0])"></label>
        <button class="icon-btn btn-danger" title="Delete" onclick="deleteImage('${sectionId}',${i})">🗑</button>
      </div>
    </div>`).join('') +
    `<div style="margin-top:10px;"><label>Add another image</label><input type="file" accept="image/*" onchange="addImage('${sectionId}', this.files[0])"></div>`;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result.split(',')[1]);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

async function uploadImageFile(file) {
  const b64 = await fileToBase64(file);
  const safeName = Date.now() + '-' + file.name.replace(/[^a-zA-Z0-9._-]/g, '');
  const path = `assets/uploads/${safeName}`;
  await ghPutBinary(path, b64, `Upload image ${safeName} via admin panel`);
  return `/${path}`;
}

async function addImage(sectionId, file) {
  if (!file) return;
  setStatus('Uploading image…', 'saving');
  try {
    const url = await uploadImageFile(file);
    const s = findSection(sectionId);
    const container = document.createElement('div');
    container.innerHTML = s.bodyHtml;
    const gallery = container.querySelector('.gallery') || container;
    const img = document.createElement('img');
    img.setAttribute('loading', 'lazy');
    img.setAttribute('src', url);
    img.setAttribute('alt', '');
    gallery.appendChild(img);
    s.bodyHtml = container.innerHTML;
    markDirty();
    renderSectionsPanel();
    document.getElementById('editor-' + sectionId).classList.add('open');
    scanImages(sectionId);
    setStatus('Image uploaded ✓');
  } catch (e) { toast('Upload failed: ' + e.message); setStatus('Upload failed', 'error'); }
}

async function replaceImage(sectionId, idx, file) {
  if (!file) return;
  setStatus('Uploading replacement…', 'saving');
  try {
    const url = await uploadImageFile(file);
    const s = findSection(sectionId);
    const container = document.createElement('div');
    container.innerHTML = s.bodyHtml;
    const imgs = container.querySelectorAll('img');
    imgs[idx].setAttribute('src', url);
    s.bodyHtml = container.innerHTML;
    markDirty();
    scanImages(sectionId);
    setStatus('Replaced ✓');
  } catch (e) { toast('Upload failed: ' + e.message); }
}

function deleteImage(sectionId, idx) {
  const s = findSection(sectionId);
  const container = document.createElement('div');
  container.innerHTML = s.bodyHtml;
  const imgs = container.querySelectorAll('img');
  imgs[idx].remove();
  s.bodyHtml = container.innerHTML;
  markDirty();
  scanImages(sectionId);
}

function moveImage(sectionId, idx, dir) {
  const s = findSection(sectionId);
  const container = document.createElement('div');
  container.innerHTML = s.bodyHtml;
  const imgs = Array.from(container.querySelectorAll('img'));
  const target = idx + dir;
  if (target < 0 || target >= imgs.length) return;
  const a = imgs[idx], b = imgs[target];
  const parent = a.parentNode;
  if (dir > 0) parent.insertBefore(b, a); else parent.insertBefore(a, b);
  s.bodyHtml = container.innerHTML;
  markDirty();
  scanImages(sectionId);
}

function updateImageAlt(sectionId, idx, val) {
  const s = findSection(sectionId);
  const container = document.createElement('div');
  container.innerHTML = s.bodyHtml;
  container.querySelectorAll('img')[idx].setAttribute('alt', val);
  s.bodyHtml = container.innerHTML;
  markDirty();
}

// ---------- Links within a section ----------
function scanLinks(sectionId) {
  const s = findSection(sectionId);
  const container = document.createElement('div');
  container.innerHTML = s.bodyHtml;
  const links = Array.from(container.querySelectorAll('a'));
  const wrap = document.getElementById('links-' + sectionId);
  if (links.length === 0) { wrap.innerHTML = `<p class="muted">No links found in this section.</p>`; return; }
  wrap.innerHTML = links.map((a, i) => `
    <div class="link-row">
      <input type="text" value="${escapeAttr(a.textContent)}" placeholder="link text" onchange="updateLink('${sectionId}',${i},'text',this.value)">
      <input type="text" value="${escapeAttr(a.getAttribute('href') || '')}" placeholder="href" onchange="updateLink('${sectionId}',${i},'href',this.value)">
    </div>`).join('');
}

function updateLink(sectionId, idx, field, val) {
  const s = findSection(sectionId);
  const container = document.createElement('div');
  container.innerHTML = s.bodyHtml;
  const a = container.querySelectorAll('a')[idx];
  if (field === 'href') a.setAttribute('href', val); else a.textContent = val;
  s.bodyHtml = container.innerHTML;
  markDirty();
}

// ---------- Global panel ----------
function renderGlobalPanel() {
  const d = STATE.data;
  if (STATE.currentPageKey !== 'content') return;
  document.getElementById('g-theme-default').value = d.theme.default;
  document.getElementById('g-accent').value = d.theme.accent;
  document.getElementById('g-accent-text').value = d.theme.accent;
  document.getElementById('g-accent2').value = d.theme.accent2;
  document.getElementById('g-accent2-text').value = d.theme.accent2;
  document.getElementById('g-font-body').value = d.theme.fontBody;
  document.getElementById('g-font-mono').value = d.theme.fontMono;
  document.getElementById('g-title').value = d.meta.title;
  document.getElementById('g-desc').value = d.meta.description;
  document.getElementById('g-favicon').value = d.meta.favicon;
  document.getElementById('g-canonical').value = d.meta.canonical;
  document.getElementById('g-footer').value = d.footer.text;
  document.getElementById('g-accent').oninput = e => document.getElementById('g-accent-text').value = e.target.value;
  document.getElementById('g-accent2').oninput = e => document.getElementById('g-accent2-text').value = e.target.value;
}

function applyGlobalFields() {
  const d = STATE.data;
  d.theme.default = document.getElementById('g-theme-default').value;
  d.theme.accent = document.getElementById('g-accent-text').value;
  d.theme.accent2 = document.getElementById('g-accent2-text').value;
  d.theme.fontBody = document.getElementById('g-font-body').value;
  d.theme.fontMono = document.getElementById('g-font-mono').value;
  d.meta.title = document.getElementById('g-title').value;
  d.meta.description = document.getElementById('g-desc').value;
  d.meta.favicon = document.getElementById('g-favicon').value;
  d.meta.ogImage = document.getElementById('g-favicon').value;
  d.meta.canonical = document.getElementById('g-canonical').value;
  d.footer.text = document.getElementById('g-footer').value;
  markDirty();
  toast('Applied to draft — click Save & Publish to go live.');
}

// ---------- Nav links panel ----------
function renderNavPanel() {
  const wrap = document.getElementById('nav-list');
  if (STATE.currentPageKey !== 'content') { wrap.innerHTML = '<p class="muted">Switch to Home to edit top links.</p>'; return; }
  const links = STATE.data.navLinks;
  wrap.innerHTML = links.map((l, i) => `
    <div class="card">
      <div class="row">
        <input type="text" class="grow" value="${escapeAttr(l.label)}" placeholder="Label" onchange="updateNavLink(${i},'label',this.value)">
        <button class="icon-btn btn-danger" onclick="deleteNavLink(${i})">🗑</button>
      </div>
      <label>URL</label>
      <input type="text" value="${escapeAttr(l.href)}" onchange="updateNavLink(${i},'href',this.value)">
      <label>Icon</label>
      <select onchange="updateNavLink(${i},'icon',this.value)">
        <option value="svg:linkedin" ${l.icon === 'svg:linkedin' ? 'selected' : ''}>LinkedIn (built-in)</option>
        <option value="svg:github" ${l.icon === 'svg:github' ? 'selected' : ''}>GitHub (built-in)</option>
        <option value="svg:youtube" ${l.icon === 'svg:youtube' ? 'selected' : ''}>YouTube (built-in)</option>
        <option value="custom" ${!l.icon.startsWith('svg:') ? 'selected' : ''}>Custom image URL</option>
      </select>
      ${!l.icon.startsWith('svg:') ? `<input type="text" value="${escapeAttr(l.icon)}" placeholder="https://.../icon.png" onchange="updateNavLink(${i},'icon',this.value)">` : ''}
    </div>`).join('');
}

function updateNavLink(i, field, val) { STATE.data.navLinks[i][field] = val; markDirty(); renderNavPanel(); }
function deleteNavLink(i) { STATE.data.navLinks.splice(i, 1); markDirty(); renderNavPanel(); }
function addNavLink() {
  STATE.data.navLinks.push({ id: 'link-' + Date.now(), label: 'New Link', href: 'https://', icon: 'custom' });
  markDirty();
  renderNavPanel();
}

// ---------- Pages panel ----------
function renderPagesPanel() {
  const wrap = document.getElementById('pages-list');
  const pages = STATE.currentPageKey === 'content' ? STATE.data.pages : STATE.mainPagesRegistry;
  if (!pages || pages.length === 0) { wrap.innerHTML = '<p class="muted">No extra pages yet.</p>'; return; }
  wrap.innerHTML = pages.map(p => `
    <div class="card card-row">
      <div><strong>${escapeHtml(p.title)}</strong><div class="muted">aman5z.in/${p.slug}</div></div>
      <div class="row">
        <button class="btn-secondary btn-sm" onclick="loadPage('${p.slug}')">Edit</button>
        <button class="btn-danger btn-sm" onclick="deletePage('${p.slug}')">Delete</button>
      </div>
    </div>`).join('');
}

async function createPage() {
  const slug = document.getElementById('new-page-slug').value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
  const title = document.getElementById('new-page-title').value.trim() || slug;
  if (!slug) { toast('Enter a slug.'); return; }
  if (STATE.currentPageKey !== 'content') { toast('Switch to Home first to manage pages.'); return; }
  if (STATE.data.pages.find(p => p.slug === slug)) { toast('That slug already exists.'); return; }

  setStatus('Creating page…', 'saving');
  try {
    const newPageData = {
      meta: { title: `${title} — Aman Faizal` },
      sections: [{ id: 'sec-' + Date.now(), title: title, visible: true, order: 0, type: 'html',
        bodyHtml: `<div class="bio-section"><h2>${escapeHtml(title)}</h2><p>Edit this content from the admin panel.</p></div>` }],
      footer: { text: STATE.data.footer.text }
    };
    await ghPut(`${slug}.json`, JSON.stringify(newPageData, null, 2), null, `Create page ${slug} via admin panel`);
    await ghPut(`${slug}/index.html`, PAGE_TEMPLATE(slug), null, `Create page shell ${slug} via admin panel`);
    STATE.data.pages.push({ slug, title });
    await saveCurrent();
    document.getElementById('new-page-slug').value = '';
    document.getElementById('new-page-title').value = '';
    renderPagesPanel();
    refreshPageSwitcher();
    toast(`Page created: aman5z.in/${slug}`);
  } catch (e) { toast('Failed to create page: ' + e.message); setStatus('Error', 'error'); }
}

async function deletePage(slug) {
  if (!confirm(`Delete page "${slug}"? The files stay in GitHub history but the page is unlinked.`)) return;
  STATE.data.pages = STATE.data.pages.filter(p => p.slug !== slug);
  markDirty();
  renderPagesPanel();
  toast('Removed from registry — click Save & Publish to confirm.');
}

// ---------- utils ----------
function escapeHtml(str) { return (str || '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }
function escapeAttr(str) { return (str || '').replace(/"/g, '&quot;'); }
