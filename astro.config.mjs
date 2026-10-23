import { defineConfig } from 'astro/config';

export default defineConfig({
  // The public origin, e.g. SITE_URL=https://example.org npm run build.
  // When set, every page gets a canonical URL, og:url and an absolute og:image.
  site: process.env.SITE_URL || undefined,
  output: 'static',
  trailingSlash: 'always',
  devToolbar: { enabled: false },
  // Links marked `data-astro-prefetch` are prefetched when they enter the viewport.
  // The header links opt in, preparing their destinations before navigation.
  prefetch: { defaultStrategy: 'viewport' },
});
