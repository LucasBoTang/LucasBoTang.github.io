# botang-website

Personal academic site, built with Astro. The output is static HTML and CSS with no client-side JavaScript.

## Run

Requires Node.js 22.22 or later.

```sh
npm ci
npm run dev       # local server
npm run verify    # format, type check, content checks, tests, build
npm run preview   # serve the built site
```

To deploy, set the public URL so pages get canonical and share metadata:

```sh
SITE_URL=https://example.org npm run build
```

## Editing content

Everything lives in `src/data/`:

- `publications.ts`: papers. IDs are used as page anchors, so don't rename them.
- `research.ts`: research themes and which papers belong to each. Themes with `featured: true` appear on the home page.
- `software.ts`: projects and upstream contributions.
- `selected-work.ts`: the three highlights on the home page.
- `profile.ts`: name, affiliation, contact links.

The CV is `public/files/Bo-Tang-CV.pdf` and the portrait is `src/assets/bo-tang.jpg`. Replace the files to update them.

## Notes

- REINS has two repositories on purpose. Home and Software link the software (`LucasBoTang/REINS`), and Research links the paper code (`pnnl/L2O-MINLP`).
- The H-PDLP code link is kept even though the repository is not public yet.
- Only confirmed review stages are shown, not planned submissions.
- `npm run verify` runs in CI. It does not check external links.
