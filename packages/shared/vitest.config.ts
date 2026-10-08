import { defineConfig } from 'vitest/config'

/**
 * The generator release checks build thousands of questions per test (1,000 seeds per
 * written question a generator replaces, then structural checks over hundreds more). They
 * take a few seconds locally and up to twice that on the CI runner, where the default five
 * seconds failed two of them (#378). A wrong answer fails on its content, not on time.
 */
export default defineConfig({
  test: { testTimeout: 60_000 },
})
