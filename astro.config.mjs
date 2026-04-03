import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import vercel from '@astrojs/vercel';

import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  output: 'server',
  adapter: vercel(),
  integrations: [react()],

  // Trust X-Forwarded-Host on Vercel so request URL origin matches the browser Origin
  // header; otherwise Astro 5 blocks DELETE/POST without form Content-Type (403).
  security: {
    allowedDomains: [{ hostname: '**.vercel.app', protocol: 'https' }, { hostname: '**.trevfox.dev', protocol: 'https' }],
  },

  vite: {
    plugins: [tailwindcss()],
  },
});