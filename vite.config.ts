import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'

const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf-8'),
) as { version: string }

// `npm run build:analyze` only — writes dist/stats.html, doesn't affect
// normal builds (Phase 13 §3). Checked via npm_lifecycle_event rather than
// defineConfig's function/mode form so vite.config's export stays a plain
// object — vitest.config.ts's mergeConfig(viteConfig, ...) needs a resolved
// config, not a config-returning function.
const analyzing = process.env.npm_lifecycle_event === 'build:analyze'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), analyzing && visualizer({ filename: 'dist/stats.html', gzipSize: true, brotliSize: true })],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // Tone.js is only needed once the user presses "Initialize
            // Audio", not at first paint — its own chunk keeps it out of
            // the critical-path bundle (Phase 13 §2).
            if (id.includes('/tone/')) return 'tone'
            if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/react-router')) return 'vendor'
          }
          return undefined
        },
      },
    },
  },
})
