import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { RELEASE } from './src/config/release.js'

const releaseMetadata = () => ({
  name: 'play-money-admin-release-metadata',
  configureServer(server) {
    server.middlewares.use('/release.json', (_req, res) => {
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.setHeader('Cache-Control', 'no-store')
      res.end(JSON.stringify(RELEASE))
    })
  },
  generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: 'release.json',
      source: JSON.stringify(RELEASE, null, 2),
    })
  },
})

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    releaseMetadata(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'app-icon.png', 'logo192.png.png', 'logo512.png.png'],
      manifest: {
        id: '/',
        name: 'Play Money Admin',
        short_name: 'Play Money',
        description: 'Gestione cassa, agenti, locali e automezzi',
        theme_color: '#A87318',
        background_color: '#080704',
        display: 'standalone',
        display_override: ['window-controls-overlay', 'standalone', 'minimal-ui'],
        orientation: 'any',
        scope: '/',
        start_url: '/',
        categories: ['business', 'finance', 'productivity'],
        icons: [
          {
            src: '/logo192.png.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/logo512.png.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico,woff2}'],
      },
    }),
  ],
})
