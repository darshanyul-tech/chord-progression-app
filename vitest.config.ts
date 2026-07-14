import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'happy-dom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      server: {
        // tone's ESM build uses extension-less relative imports; force it
        // through Vite's resolver instead of Node's native ESM loader.
        deps: { inline: ['tone'] },
      },
    },
  }),
)
