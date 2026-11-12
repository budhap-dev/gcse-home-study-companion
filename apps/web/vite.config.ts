/// <reference types="vitest/config" />
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { chunkFor, contentPlugin } from './contentPlugin.ts'
import { serviceWorkerPlugin } from './swPlugin.ts'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }
const sha = (process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? (() => { try { return execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() } catch { return '' } })()).slice(0, 7)

export default defineConfig({
  plugins: [react(), tailwindcss(), contentPlugin(), serviceWorkerPlugin(() => `${pkg.version}+${sha || 'local'}`)],
  build: { rollupOptions: { output: { manualChunks: chunkFor } } },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_COMMIT__: JSON.stringify(sha || 'local'),
    __APP_BUILT__: JSON.stringify(new Date().toISOString().slice(0, 10)),
  },
  // Whole-pack tests read every string in the content, which grows; the CI runner is about
  // twice as slow as a laptop (richtext's pack scan took 5.1 s there against vitest's 5 s).
  test: { setupFiles: ['./src/test-clock.ts'], testTimeout: 30_000 },
})
