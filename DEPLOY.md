# Publishing to GitHub Pages

The site is plain HTML in `dist/`. GitHub Pages just serves it. There is no server and nothing to run.

## 1. Pick the address (this decides one build setting)

| You want | Repository name | Build settings |
|---|---|---|
| `https://YOUR-USERNAME.github.io` | **`YOUR-USERNAME.github.io`** (exactly) | none |
| `https://www.iammoody.com` (custom domain) | any name | put the domain in a file named `CNAME` in this folder (one line: `www.iammoody.com`), point your DNS at GitHub Pages (see GitHub's "custom domain" docs), and build with `SITE_URL=https://www.iammoody.com` |
| `https://YOUR-USERNAME.github.io/some-repo/` | any name | build with `BASE_PATH=/some-repo` |

Add `SITE_URL=https://…` in every case (your real public address, no path). It switches on the sitemap, `robots.txt`, canonical links, and makes link previews on Facebook, Instagram and iMessage show your photo.

## 2. Build

The build also shrinks the photos (WebP, three sizes; about 30 MB down to about 13 MB). It needs **Python 3 with Pillow** installed once on your computer: `pip install pillow`. If Pillow is missing the build prints a warning and publishes the large originals, so watch for the line `67 photos optimized` in the output.


```bash
cd site
SITE_URL=https://www.iammoody.com npm run build        # add BASE_PATH=/some-repo for a project site
npm run preview                                        # optional: see it exactly as Pages will serve it (http://localhost:4000)
```
If you used `BASE_PATH`, give `npm run preview` the same `BASE_PATH`.

The build also writes a small forwarding page at each of the ~1,060 old WordPress addresses (listed in `../iammoody-export/sitemaps/`), so old links and search results land on the new site. Hand-picked destinations are in `data/redirects.json`; everything else follows the rules in `lib/redirects.js`. The build stops if a destination isn't a real page. After publishing, run `npm run check-redirects` to confirm every old address forwards to a page that loads (add `-- http://localhost:4000` to check a local preview instead).

## 3. What to commit

Make **this `site/` folder the repository root** and commit everything in it **including `dist/`**:

| Commit | Why |
|---|---|
| `dist/` | The built website (about 14 MB, including the optimized photos). This is what gets published. |
| `pages/`, `lib/`, `data/curated.json`, `data/redirects.json`, `public/`, `scripts/`, `layout.html`, `package.json`, docs | The source, so you can change and rebuild the site later. |
| `.github/workflows/pages.yml` | Tells GitHub to publish `dist/`. |
| `CNAME` (custom domain only) | Keeps the domain attached. |

Already excluded by `.gitignore`: `data/decisions.json` (your private review notes) and `.cache/` (regenerated photo cache). **Never** add `../iammoody-export/` (348 MB of the old site's raw data and photos) or `../backend/`; they are outside this folder, so they are not included unless you add them.

The free plan needs a **public** repository, so everything you commit is public.

## 4. Turn Pages on (once)

GitHub repository → **Settings → Pages → Build and deployment → Source: GitHub Actions**. Then, from this folder:

```bash
git branch -M main                                     # optional: rename master to main (the workflow accepts either)
git add .
git status                                             # look before you commit: dist/ should be there, data/decisions.json should not
git commit -m "Publish site"
git remote add origin git@github.com:YOUR-USERNAME/REPO.git
git push -u origin main
```
The Actions tab shows the deploy; the address appears when it finishes (about a minute).

## 5. Updating the site later

Edit pages or `data/curated.json` → `SITE_URL=… npm run build` → `git add -A && git commit -m "…" && git push`.
**Always rebuild before committing**: the workflow publishes whatever is in `dist/`, so a forgotten rebuild publishes the old site.

## Keep a backup of `../iammoody-export/`
The build reads events and photos from it, and it is not in the repository. Without it you can still edit and publish text changes only if you rebuild, so keep a copy somewhere safe (an external drive or a private cloud folder).
