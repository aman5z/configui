# Your portfolio, now editable — setup guide

## What changed

Your site went from one hand-written `index.html` (2,100+ lines) to a small
data-driven system:

```
index.html          ← thin shell, no content in it anymore
content.json         ← ALL your text/images/links/theme live here
assets/style.css     ← your existing design, untouched
assets/render.js     ← reads content.json, builds the page in the browser
admin/index.html      ← your private editor
admin/admin.js        ← talks to GitHub on your behalf
```

`Aman_Faizal_CV.pdf` still needs to sit at the repo root exactly like before
— nothing changes there.

## One-time setup (10 minutes)

**1. Deploy these files** to the root of your `aman5z.github.io` repo,
replacing your current `index.html`. Keep your existing `Aman_Faizal_CV.pdf`,
`pic.png`, `favcon.png` where they already are.

**2. Create a GitHub Personal Access Token** (this is what lets the admin
panel commit changes on your behalf):
- GitHub → Settings → Developer settings → Personal access tokens →
  **Fine-grained tokens** → Generate new token
- Repository access: only your `aman5z.github.io` repo
- Permissions: **Contents → Read and write**
- Copy the token (starts with `github_pat_...`) — you won't see it again

**3. Open `aman5z.in/admin`** (once deployed):
- Set a local password (this just locks the panel on *your* browser — it's
  stored only in `localStorage`, never sent anywhere)
- Paste your token, confirm the repo (`aman5z/aman5z.github.io`) and branch
  (`main`)
- Click **Unlock** — from now on, revisits only ask for your password;
  the token stays saved in that browser

⚠️ The token itself lives only in your browser's local storage. Don't log
into `/admin` on a shared/public computer, and don't share the token.

## What you can do from `/admin`

- **Sections tab** — reorder (▲▼), show/hide, edit the HTML of any section,
  add new sections, delete sections
- Inside a section: **Manage Images** (upload, replace, delete, reorder) and
  **Manage Links** (edit text/URL) without touching raw HTML
- **Global / Theme tab** — default theme (dark/light), accent colors, fonts,
  page title/description/favicon, footer text
- **Top Links tab** — add/remove/edit the icons in the top-right corner
  (LinkedIn, GitHub, YouTube, Tools, or any custom link)
- **Pages tab** — create a new page (e.g. `page1` → `aman5z.in/page1`),
  edit it like the home page, or remove it

Every **Save & Publish** commits straight to GitHub; the live site updates
in 30–60 seconds (normal GitHub Pages build time).

## Honest limitations (so nothing surprises you)

- **Section granularity**: "About Me", "Expertise", and "Skills" were
  grouped together in your original HTML (`bio-section-wrap`), so they're
  one editable block, not three separate ones — same for "Experience /
  Certifications / Why Work With Me". You can still edit/reorder content
  *inside* the block's HTML.
- **Text editing is HTML-based**, not a rich-text/WYSIWYG editor — you edit
  the actual markup in a text box. This gives you full control (any tag,
  any structure) but isn't drag-and-drop text editing.
- **Colors/fonts are theme-level** (accent color, body font, mono font),
  matching how your CSS is actually structured — not a picker for every
  individual word.
- New pages reuse your site's global theme/nav/footer automatically, but
  each page's own section content is separate.

## If something goes wrong

Every save is a normal Git commit — so every change has full history and
is one click to revert from GitHub's commit log on your repo, same as any
code change.
