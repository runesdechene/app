import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://carte.runesdechene.com',
  base: '/',
  output: 'static',
  integrations: [
    sitemap({
      filter: (page) => page.includes('/lieu/'),
    }),
  ],
  build: {
    format: 'directory',
  },
});
