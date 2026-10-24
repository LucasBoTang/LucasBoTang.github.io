# botang-website

Personal academic site, built with Astro. The output is static HTML, CSS and JavaScript. Scripts add animations and interactions across the site; core content and navigation remain available without JavaScript.

## Run

Requires Node.js 22.22 or later.

```sh
npm ci
npm run dev       # local server
npm run format    # Prettier, plus import and CSS order
npm run verify    # format, types, content, unit tests, the build and its output
npm run test:e2e  # the built site in a browser (also runs in CI)
npm run test:visual  # screenshots against the baselines in tests/visual
npm run portrait  # redraw the home portrait's pixel picture after changing the photo
npm run preview   # serve the built site
```

Every push to `main` builds the site and deploys it to GitHub Pages at <https://botang.org/> (`.github/workflows/deploy.yml`). To build for another host, set the public URL so pages get canonical and share metadata:

```sh
SITE_URL=https://example.org npm run build
```

## Editing content

Shared content records live in `src/data/`:

- `publications.ts`: papers. IDs are used as page anchors, so don't rename them.
- `research.ts`: research themes and which papers belong to each. Themes with `featured: true` appear on the home page.
- `teaching.ts`: course roles, lab notebook links, and workshop credits.
- `software.ts`: projects, upstream contributions, and how each project's name is drawn (`wordmark`).
- `selected-work.ts`: the three highlights on the home page.
- `profile.ts`: name, bio, affiliation, people and contact links.
- `resources.ts`: shared links to papers, software, documentation and conference events.

Page-specific prose and descriptions live in `src/pages/`. The homepage's About copy lives in `src/components/home/AboutSection/AboutSection.astro`; the full About page is `src/pages/about.astro`. Update both when changing shared background facts.

The Teaching page is `src/pages/teaching.astro`. Shared page routes and the header's navigation order live in `src/data/navigation.ts`.

The CV is `public/files/Bo-Tang-CV.pdf` and the portrait is `src/assets/bo-tang.jpg`. Replace the files to update them.

## License

The code is licensed under the [Apache License 2.0](LICENSE). Personal content (the portrait, the CV, and the biography, research and publication text) is not covered by it and remains all rights reserved. See [NOTICE](NOTICE) for details.
