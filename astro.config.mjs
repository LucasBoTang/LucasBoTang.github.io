import { defineConfig } from 'astro/config';

export default defineConfig({
  // The public origin, e.g. SITE_URL=https://example.org npm run build.
  // When set, every page gets a canonical URL, og:url and an absolute og:image.
  site: process.env.SITE_URL || undefined,
  output: 'static',
  trailingSlash: 'always',
  devToolbar: { enabled: false },
  // Links marked `data-astro-prefetch` fetch their page once the browser is idle, so moving
  // between pages waits for no network: the header's links, which reach every page.
  prefetch: { defaultStrategy: 'viewport' },
});
