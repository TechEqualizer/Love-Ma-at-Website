# Love Ma'at — Dr. Love Ma'at

Personal brand site for **Dr. Love Ma'at** — celebrity intimacy coach, speaker,
author, producer and media personality.

> Real intimacy starts when you stop pretending.

Static HTML/CSS/JS. No build step, no dependencies, no framework. Open
`index.html` or serve the folder and it runs.

---

## Run locally

```bash
python -m http.server 5173
```

Then open <http://localhost:5173>. Any static server works — the site is just files.

---

## Structure

```
index.html              the whole page
assets/
  css/styles.css        design system + layout
  js/main.js            nav, scroll reveal, mobile menu, signup validation
  img/                  web-optimised, shipped assets
brand/                  original source files (masters, not served)
.claude/launch.json     local dev-server config
```

### Brand assets

`brand/` holds the originals. Everything in `assets/img/` was derived from them:

| Shipped file | Derived from | How |
|---|---|---|
| `maat-portrait.webp` | `portrait-transparent-original.png` | client-supplied transparent PNG, trimmed to bbox and encoded |
| `the-room.webp` | `the-room-original.png` | workshop group photo, encoded |
| `logo-mark.png` / `logo-word.png` / `logo-full.png` | `logo-original.jpg` | white background keyed out and un-matted to transparency |
| `silhouette-path.txt` | `maat-portrait.webp` | her outline traced from the alpha channel, simplified to ~75 points, bottom crop line removed so it strokes as an open path |

`brand/` also holds `portrait-on-black.png` and `portrait-original.jpeg`, two earlier
versions of the same shot. **Always ask the client for a transparent PNG rather than
keying one** — un-matting an over-black composite leaves a dark rim that is fiddly to
remove and never as clean as a proper cutout.

---

## Design

The layout concept is modelled on the supplied inspiration (`brand/inspiration.png`):
white ground, a tinted rounded hero panel with a ghosted wordmark and a cutout
portrait bleeding off the bottom edge, one accent-coloured phrase inside each
heading, and a checklist + framed photo + icon-trio row.

The palette is sampled directly from the supplied logo rather than guessed:

| Token | Value | Role |
|---|---|---|
| `--azure` → `--rose` | `#6DA5FE` `#8A97FE` `#B086FE` `#E179DC` `#FE70C0` | brand gradient, sampled left→right off the wordmark |
| `--accent` | `#D4399A` | the emphasised phrase in headings, links, eyebrows |
| `--panel` | pink→violet→periwinkle wash | hero panel and The Circle block |
| `--ink` | `#160F1D` | headings |
| `--body` | `#5F5670` | body copy |

Type is **Plus Jakarta Sans** (400–800).

### Behaviour worth knowing

- **The hero always fits above the fold.** The panel is `100svh` and every
  vertical value is capped against viewport *height* as well as width. On
  screens under 1000px the portrait becomes a bottom-anchored backdrop behind
  the copy — stacked underneath, it pushed the headline off-screen.
- **The nav is transparent over the hero** and resolves to white glass once you
  scroll past ~70% of the first screen.
- **Scroll reveals fail safe.** The hidden-until-revealed styles are gated on a
  `.js` class, and the reveal pass is geometry-based rather than
  `IntersectionObserver`, with one-shot triggers bypassing `requestAnimationFrame`.
  Both are deliberate: rAF and IO are throttled to a standstill in background or
  occluded tabs, and either dependency alone left the page blank.

---

## Before this goes live

These are the real blockers, not nice-to-haves:

- [ ] **Replace the three placeholder testimonials.** They render with a visible
      "Placeholder" chip and a dashed border on purpose, so they can't be
      mistaken for real endorsements. Needs real, permissioned client quotes.
      Search `TODO(client)` in `index.html`.
- [ ] **Set real event dates and locations,** or delete the rows that aren't
      running. Names came from the current site's 2024 listings and all say "TBA".
- [ ] **Wire the newsletter form.** `assets/js/main.js` validates the email and
      shows a confirmation but stores nothing. Point it at Mailchimp / ConvertKit
      / Beehiiv.
- [ ] **Confirm the contact email.** `hello@lovemaat.com` is a placeholder — the
      current site only publishes a phone number, (947) 426-0364, which is live
      in the markup.
- [ ] Add real Privacy Policy and Terms pages (footer links are `#`).
- [ ] Add social links once handles are confirmed.

## Content sources

Copy is Dr. Love Ma'at's own wording from <https://lovemaat.com>, kept verbatim
where possible — the bio, "Real intimacy starts when you stop pretending",
"Embrace Your Sacred Self and Others", the GLOAT / Love Architect framing, and
the three programs (Love Boot Camp 365, Mysteries of Sex, When Love Calls).
The trust row lists only her actual stated credentials; no press logos or
client counts were invented.

---

## Deploy

Static, so anything works. GitHub Pages: push to `main`, then Settings → Pages →
deploy from `main` / root. Netlify or Vercel: point at the repo, no build
command, publish directory `.`.
