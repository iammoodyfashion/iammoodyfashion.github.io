# IAmMoody: new site + content review tools

The new iammoody.com marketing site, served by Node (and buildable to plain static files), plus two review pages for going through everything pulled from the old WordPress site.

No dependencies to install. Requires Node 18+.

```bash
cd site
node server.js          # http://localhost:3000
```

| URL | What it is |
|---|---|
| `/` | The new site |
| `/review` | Review tools: overview |
| `/review/posts` | Table of all 646 old blog posts |
| `/review/media` | Table of all 1,091 media files |

The server only listens on `localhost` (the review tools can write files and have no login). To change the port: `PORT=8080 node server.js`.

## The new site (public pages)

Structure follows `PROPOSED_SITE_STRUCTURE.md`, with your decisions applied: fashion leads, no shop, no old blog posts, no model pages. There is no News section.

```
/                                   Home
/services                           Fashion shows · Custom events · Brand activations
/services/fashion-show-production   Flagship page
/events                             Upcoming + past events by year, filterable
/events/holiday-charity-party       Signature series (3): Holiday Charity Party,
/events/all-black-attire-party        All Black Attire Party, Dandies Project
/events/dandies-project
/events/<slug>                      49 individual events, mined from the old calendar
/work                               Case-study grid, clients, testimonials
/work/<slug>                        6 case studies
/about                              Richard Moody, milestones, community, team
/contact                            Email form + FAQ
/privacy                            Privacy policy
```

### Where things live

| Path | Contents |
|---|---|
| `pages/*.html` | Hand-edited page content (the 8 static pages). Header/footer come from `layout.html`. |
| `data/curated.json` | **Most of the copy**: services, signature series, case studies, clients, FAQ, milestones, stats, and which photos each page uses. Edit this to change series/case-study pages. |
| `lib/render.js` | Turns pages + data into HTML (series, case study and event pages are generated from data). |
| `lib/data.js` | Loads events from the export and cleans old WordPress HTML. |
| `public/css/site.css`, `public/js/site.js` | Styles and small enhancements. Design tokens are at the top of the CSS. |
| `public/img/` | Derived images (currently one cropped photo). |

Photos are referenced by their path inside `iammoody-export/media/` (e.g. `2024/12/elp-5734.jpg`) and served from there. Run `npm run check` to confirm every curated image exists.

### Content still to add
No placeholder markers appear on the site. These are simply absent until you have them:
- **Testimonials**: add `{ "quote", "name", "role" }` entries to `testimonials` in `data/curated.json` and a "What clients say" section appears on the home and Work pages automatically.
- **Phone number / mailing address**: not shown anywhere yet. Add to the footer in `layout.html` and the sidebar in `pages/contact.html`.
- **Client names**: the list comes from the old site; confirm each client agrees to be named.
- **"How it works" steps** (Fashion Show Production page): a suggested outline in `data/curated.json` (`process`); reword to match how Richard actually works.

### Static build (a plain directory of HTML pages)
```bash
npm run build           # writes dist/ : 66 HTML pages + css/js + the optimized photos those pages use (~14 MB)
```
`dist/` is plain HTML/CSS/JS and can be served by any static host. **For GitHub Pages, see [`DEPLOY.md`](DEPLOY.md)** (build settings `SITE_URL`, `BASE_PATH`, `CNAME`, what to commit, and the publish workflow). `npm run preview` serves `dist/` the way Pages will. It needs no server: the review tools are not included, and the contact form needs no backend (see below).

### Photos are optimized automatically
The build converts every photo the pages use to **WebP** at up to three widths (640, 1280 and 1920 px; never enlarged) and gives each `<img>` a `srcset`, so phones download the small file and large screens the big one. Color profiles are converted to sRGB and phone-rotated photos are stood upright. Your originals in `iammoody-export/media/` are never touched. Result: the 30 MB of originals become about 13 MB, and a page's images drop by roughly 85% (home page on desktop: 1.1 MB to 0.13 MB).

- **Needs Python 3 with Pillow** (`pip install pillow`) on the computer that runs the build. If it is missing, the build says so loudly and publishes the heavy originals instead.
- Results are cached in `.cache/` (git-ignored), so rebuilds take a second. Delete `.cache/` to force a redo.
- To use a different photo, change its path in `data/curated.json` and rebuild; nothing else is needed.
- `OPTIMIZE_IMAGES=0 npm run build` skips optimization (not recommended).
- The editing preview (`node server.js`, http://localhost:3000) serves your original photos as-is. The optimization only appears in `dist/`; see exactly what visitors get with `npm run build && npm run preview` (http://localhost:4000).

### Contact: how it works
There is no form backend. The address **richard@iammoody.com** is set once in `data/curated.json` (`site.email`) and used everywhere (footer, contact page, events page, FAQ).

The contact form collects the details, then **opens the visitor's email app** (a `mailto:` link) with a ready-to-send message addressed to Richard. Nothing is sent until the visitor presses Send in their own email app. If no email app opens (common on shared computers or with webmail-only users), the page shows **Try again** and **Copy your message** buttons plus the plain address. Very long messages are shortened in the link to stay under email-app limits; the copy button always has the full text. With JavaScript disabled, the form falls back to a basic `mailto:` submission.

Trade-off: the address is visible in the page HTML, so it can be picked up by spam scrapers. There is also no record of inquiries on your side other than your own inbox.

The optional `../backend/` project (JSON storage + email notifier) is **not used** by the site right now. It is kept for later.

## Review tools

Both tables load instantly, filter and sort in the browser, and **save every decision automatically** to `data/decisions.json`. Nothing in the export is changed or deleted.

**Old blog posts**: filter by year, category, length, images; search titles, excerpts and tags. Click a title to open a preview panel showing the full post as exported. Mark each post **Archive** or **Mine for content**, add a note.

**Media**: shows a thumbnail, dimensions, file size, whether it downloaded (149 files return 404 on the old site and were not recovered), and **how many posts/pages/events use it** (click to list them). Mark **Use** or **Discard** and note where it could go (hero, gallery, logo…). "Used in" counts include SEO metadata, so the site logo shows as used everywhere.

Shortcuts in the preview panel: `←` `→` move between items, `A` / `M` (posts) or `U` / `D` (media) set the decision, `Esc` closes. **Bulk actions**: filter the table, then set every filtered row at once. **Export CSV** downloads the filtered rows with decisions and notes.

If a media file isn't on disk, the server redirects to the old live site so previews still work. Turn that off with `MEDIA_FALLBACK=off`.

## Facts to confirm before launch

These appear on the site because they came from the old site's own text, and some conflict there:

- **"30+ years producing events"**: the old site says 25, 28, 30 and (for promotions) 14 in different places.
- **Holiday Party numbering**: the 2021 recap post says 30th and 2024 is billed 33rd (2020 was a drive-thru, unnumbered). The old Holiday Party page calls 2021 the "31st", which looks wrong.
- **All Black Attire "9th annual"**: the 2026 article says Richard has produced it "since 2017", but 9th in 2026 implies a first edition in 2018 (4th was 2021).
- **4-H Style Revue**: "33 years" and "700+ participants" are as of a September 2022 profile.
- **Named clients and partners**: taken from the old Clients page and posts; confirm each agrees to be listed.
- **Privacy policy** (`pages/privacy.html`): the owner confirmed on 2026-09-18 that its statements are accurate (GitHub Pages hosting, no cookies or analytics, Google Fonts disclosure, sharing with vendors only as needed for an event, photos removed on request). It is a plain-language draft, not legal advice. **Update it if any of that changes**, for example when adding analytics, a newsletter or a form backend, or moving hosts.
- **Photo credits**: some galleries use photos with visible watermarks (John Bolton, 2021). Confirm usage rights.

## Data sources

Everything comes from `../iammoody-export/` (`raw/*.json`, `posts/`, `events/`, `media/`). The site reads it live and never writes to it.
