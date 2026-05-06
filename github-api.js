/* ============================================================
   GitHub API client — used by admin.html and inline-edit.js
   to commit content.json / projects.json / images directly
   to a GitHub repo (which is then auto-deployed by Pages).

   ⚠️ The Personal Access Token is stored in the user's
   localStorage (browser-only, never sent anywhere except
   api.github.com). It is base64-obfuscated, NOT encrypted —
   anyone with access to the same browser can read it. Use a
   FINE-GRAINED PAT scoped to ONLY this repo with
   "Contents: Read and write" permission.
   ============================================================ */
(function () {
  'use strict';

  const STORAGE_KEY = 'khaled_gh_config_v1';
  const API_BASE = 'https://api.github.com';

  function utf8ToBase64(str) {
    // Encodes Unicode (incl. Arabic) safely to base64 for the GitHub API.
    return btoa(unescape(encodeURIComponent(str)));
  }
  function base64ToUtf8(b64) {
    return decodeURIComponent(escape(atob(b64.replace(/\s/g, ''))));
  }

  const GitHubAPI = {
    config: { owner: '', repo: '', branch: 'main', token: '', commitName: '', commitEmail: '' },

    loadConfig() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(atob(raw));
          this.config = { ...this.config, ...parsed };
        }
      } catch { /* ignore */ }
      return this.config;
    },

    saveConfig(patch) {
      this.config = { ...this.config, ...patch };
      try {
        localStorage.setItem(STORAGE_KEY, btoa(JSON.stringify(this.config)));
      } catch (e) { /* private mode */ }
      return this.config;
    },

    clearConfig() {
      this.config = { owner: '', repo: '', branch: 'main', token: '', commitName: '', commitEmail: '' };
      try { localStorage.removeItem(STORAGE_KEY); } catch {}
    },

    isConfigured() {
      const c = this.config;
      return !!(c.owner && c.repo && c.token);
    },

    headers(extra) {
      return Object.assign({
        'Authorization': 'Bearer ' + this.config.token,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      }, extra || {});
    },

    // Used by ad-hoc fetches (e.g. polling Pages build). Returns raw token.
    _tokenForFetch() { return this.config.token; },

    repoBase() {
      const c = this.config;
      return `${API_BASE}/repos/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}`;
    },

    async _fetch(url, opts) {
      const r = await fetch(url, opts);
      if (!r.ok) {
        let msg = `${r.status} ${r.statusText}`;
        try {
          const err = await r.json();
          if (err && err.message) msg = err.message;
        } catch {}
        const e = new Error(msg);
        e.status = r.status;
        throw e;
      }
      return r;
    },

    async validateAuth() {
      const r = await this._fetch(this.repoBase(), { headers: this.headers() });
      const data = await r.json();
      // Also fetch the authenticated user (so we can show "logged in as @x").
      let user = null;
      try {
        const ru = await this._fetch(`${API_BASE}/user`, { headers: this.headers() });
        user = await ru.json();
      } catch { /* token may not have user:read scope, that's OK */ }
      return { repo: data, user };
    },

    async getFile(path) {
      try {
        const url = `${this.repoBase()}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(this.config.branch || 'main')}`;
        const r = await this._fetch(url, { headers: this.headers() });
        const j = await r.json();
        return {
          sha: j.sha,
          size: j.size,
          download_url: j.download_url,
          content: j.content ? base64ToUtf8(j.content) : null,
          raw: j,
        };
      } catch (e) {
        if (e.status === 404) return null;
        throw e;
      }
    },

    async listDir(path) {
      try {
        const url = `${this.repoBase()}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(this.config.branch || 'main')}`;
        const r = await this._fetch(url, { headers: this.headers() });
        const j = await r.json();
        return Array.isArray(j) ? j : [];
      } catch (e) {
        if (e.status === 404) return [];
        throw e;
      }
    },

    /** Commit a UTF-8 string (e.g., JSON, HTML). Auto-merges on existing SHA. */
    async commitText(path, content, message) {
      return this._commit(path, utf8ToBase64(content), message);
    },

    /** Commit a binary File or Blob (e.g., image upload). */
    async commitBinary(path, fileOrBlob, message) {
      const b64 = await this._fileToBase64(fileOrBlob);
      return this._commit(path, b64, message);
    },

    async deleteFile(path, message) {
      const existing = await this.getFile(path);
      if (!existing) return null;
      const url = `${this.repoBase()}/contents/${path.split('/').map(encodeURIComponent).join('/')}`;
      const body = {
        message: message || `Delete ${path} via dashboard`,
        sha: existing.sha,
        branch: this.config.branch || 'main',
      };
      if (this.config.commitName && this.config.commitEmail) {
        body.committer = { name: this.config.commitName, email: this.config.commitEmail };
      }
      const r = await this._fetch(url, {
        method: 'DELETE',
        headers: this.headers({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(body),
      });
      return r.json();
    },

    async _commit(path, base64Content, message) {
      const url = `${this.repoBase()}/contents/${path.split('/').map(encodeURIComponent).join('/')}`;
      const existing = await this.getFile(path);
      const body = {
        message: message || `Update ${path} via dashboard`,
        content: base64Content,
        branch: this.config.branch || 'main',
      };
      if (existing && existing.sha) body.sha = existing.sha;
      if (this.config.commitName && this.config.commitEmail) {
        body.committer = { name: this.config.commitName, email: this.config.commitEmail };
        body.author = { name: this.config.commitName, email: this.config.commitEmail };
      }
      const r = await this._fetch(url, {
        method: 'PUT',
        headers: this.headers({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(body),
      });
      return r.json();
    },

    _fileToBase64(file) {
      return new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => {
          const result = String(fr.result || '');
          const idx = result.indexOf(',');
          resolve(idx >= 0 ? result.slice(idx + 1) : result);
        };
        fr.onerror = reject;
        fr.readAsDataURL(file);
      });
    },

    /** Public site URL of a committed file (raw on the deployed branch). */
    publicUrl(path) {
      const c = this.config;
      // For GitHub Pages the live file is just `/<path>` on the deployed site.
      // For previewing during dashboard use we hit the raw user-content CDN.
      return `https://raw.githubusercontent.com/${c.owner}/${c.repo}/${c.branch || 'main'}/${path}`;
    },
  };

  // Initialize on load.
  GitHubAPI.loadConfig();

  if (typeof window !== 'undefined') window.GitHubAPI = GitHubAPI;
  if (typeof module !== 'undefined' && module.exports) module.exports = GitHubAPI;
})();
