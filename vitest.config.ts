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
      coverage: {
        provider: 'v8',
        include: ['src/lib/**/*.ts'],
        exclude: ['src/lib/**/*.test.ts'],
        // Phase 15 gate (09-improvement-plan.md §15): every src/lib/ module
        // ≥90% lines — perFile enforces this per-module, not just in
        // aggregate, so a single regressed file fails the gate even if the
        // overall average would still clear 90%.
        thresholds: { lines: 90, perFile: true },
      },
    },
  }),
)
