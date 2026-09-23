// Fails a pull request that changes the app or its content without raising
// the version in apps/web/package.json above the one on the base branch.
// Usage: node check-version-bump.mjs <base-ref>
import { execFileSync } from 'node:child_process'

const base = process.argv[2]
if (!base) throw new Error('usage: check-version-bump.mjs <base-ref>')

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' })

// Files that do not reach the deployed app, so changing only these needs no bump.
const exempt = [/^docs\//, /^\.github\//, /\.md$/]
const changed = git('diff', '--name-only', `${base}...HEAD`).split('\n').filter(Boolean)
const shipped = changed.filter((f) => !exempt.some((re) => re.test(f)))
if (shipped.length === 0) {
  console.log('No shipped files changed; no version bump needed.')
  process.exit(0)
}

const version = (ref) => JSON.parse(git('show', `${ref}:apps/web/package.json`)).version
const parse = (v) => v.split('.').map(Number)
const before = version(base)
const after = version('HEAD')
const [a, b] = [parse(before), parse(after)]
const raised = b[0] !== a[0] ? b[0] > a[0] : b[1] !== a[1] ? b[1] > a[1] : b[2] > a[2]

if (!raised) {
  console.error(
    `apps/web/package.json is ${after}, not above ${before} on the base branch, ` +
      `but this PR changes ${shipped.length} shipped file(s), for example ${shipped[0]}.\n` +
      'Bump the version as README.md "Versioning" describes: patch for fixes, ' +
      'minor for new topics or features, major when a subject is complete.',
  )
  process.exit(1)
}
console.log(`Version ${before} -> ${after}.`)
