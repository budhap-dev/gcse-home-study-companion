import { vi } from 'vitest'

/**
 * Topic status decays after six weeks without a revisit, measured from today. Tests build
 * progress with fixed dates in September 2026, so on a real clock they would start failing
 * in November as those dates aged past six weeks. Every test runs on the same day instead;
 * a test that is about time passes its own `now`.
 */
vi.setSystemTime(new Date('2026-09-26T12:00:00Z'))
