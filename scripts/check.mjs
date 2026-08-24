// Syntax sanity check for the published bundle. Run: node scripts/check.mjs
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
let failed = false
for (const file of ['client.js', 'index.js']) {
  const r = spawnSync(process.execPath, ['--check', join(root, file)], { stdio: 'inherit' })
  if (r.status !== 0) failed = true
}
if (failed) process.exit(1)
console.log('syntax check passed')
