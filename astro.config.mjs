import { defineConfig } from 'astro/config';
import modulePreload from './scripts/module-preload.mjs';

// Preloaded fonts avoid a visible face swap; CSS allows fallback after three seconds.
const blockFontDisplay = {
  name: 'block-font-display',
  transform(code, id) {
    if (id.includes('@fontsource') && /\.css($|\?)/.test(id))
      return code.replaceAll('font-display: swap;', 'font-display: block;');
  },
};

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
  integrations: [modulePreload()],
  vite: { plugins: [blockFontDisplay] },
});
