/* ══════════════════════════════════════════
   github-api.js — thin wrapper around the GitHub Contents API.
   The Personal Access Token is stored ONLY in this browser's
   localStorage and is sent only to api.github.com.
══════════════════════════════════════════ */
const GH = (() => {
  const LS_KEY = 'admin-gh-config';

  function getConfig() {
    try { return JSON.parse(localStorage.getItem(LS_KEY)) || null; }
    catch { return null; }
  }
  function setConfig(cfg) { localStorage.setItem(LS_KEY, JSON.stringify(cfg)); }
  function clearConfig() { localStorage.removeItem(LS_KEY); }

  function api(path, opts = {}) {
    const cfg = getConfig();
    if (!cfg) throw new Error('Not connected to GitHub');
    return fetch(`https://api.github.com/repos/${cfg.owner}/${cfg.repo}${path}`, {
      ...opts,
      headers: {
        'Authorization': `Bearer ${cfg.token}`,
        'Accept': 'application/vnd.github+json',
        ...(opts.headers || {}),
      },
    });
  }

  // UTF-8 safe base64 encode/decode
  function b64EncodeUtf8(str) {
    return btoa(unescape(encodeURIComponent(str)));
  }
  function b64DecodeUtf8(str) {
    return decodeURIComponent(escape(atob(str.replace(/\n/g, ''))));
  }

  async function testConnection() {
    const res = await api('');
    if (!res.ok) throw new Error(`Cannot access repo (${res.status}). Check owner/repo/token.`);
    return res.json();
  }

  async function getFile(path, branch) {
    const cfg = getConfig();
    const q = branch ? `?ref=${branch}` : (cfg.branch ? `?ref=${cfg.branch}` : '');
    const res = await api(`/contents/${encodeURIComponent(path).replace(/%2F/g, '/')}${q}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Failed to read ${path} (${res.status})`);
    const json = await res.json();
    return { sha: json.sha, text: b64DecodeUtf8(json.content), raw: json };
  }

  // content: string (text) or {base64: true, data: "..."} for binary/images
  async function putFile(path, content, message, sha) {
    const cfg = getConfig();
    const body = {
      message,
      content: (typeof content === 'object' && content.base64) ? content.data : b64EncodeUtf8(content),
      branch: cfg.branch || undefined,
    };
    if (sha) body.sha = sha;
    const res = await api(`/contents/${encodeURIComponent(path).replace(/%2F/g, '/')}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Failed to write ${path}: ${err.message || res.status}`);
    }
    return res.json();
  }

  async function saveFile(path, content, message) {
    const existing = await getFile(path).catch(() => null);
    return putFile(path, content, message, existing ? existing.sha : undefined);
  }

  async function listDir(path) {
    const res = await api(`/contents/${path}`);
    if (res.status === 404) return [];
    if (!res.ok) throw new Error(`Failed to list ${path}`);
    return res.json();
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  return { getConfig, setConfig, clearConfig, testConnection, getFile, putFile, saveFile, listDir, fileToBase64 };
})();
