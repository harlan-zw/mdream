import assert from 'node:assert/strict'
// The release check runs before dependencies are installed.
// eslint-disable-next-line test/no-import-node-test
import { test } from 'node:test'
import { resolveRelease } from '../release-channel.mjs'

test('maintenance releases cannot replace stable or beta tags', () => {
  const result = resolveRelease('v1.7.4', '1.7.4')
  assert.equal(result.npmTag, '1.x')
  assert.equal(result.branch, '1.x')
  assert.equal(result.latest, false)
  assert.equal(result.prerelease, false)
})

test('v2 beta releases cannot replace stable tags', () => {
  const result = resolveRelease('v2.0.0-beta.0', '2.0.0-beta.0')
  assert.equal(result.npmTag, 'beta')
  assert.equal(result.branch, 'main')
  assert.equal(result.latest, false)
  assert.equal(result.prerelease, true)
})

test('stable v2 releases become latest', () => {
  const result = resolveRelease('v2.0.0', '2.0.0')
  assert.equal(result.npmTag, 'latest')
  assert.equal(result.latest, true)
  assert.equal(result.prerelease, false)
})

test('rejects tags that would publish the wrong version or channel', () => {
  for (const tag of ['main', 'latest', 'v01.2.3', 'v3.0.0', 'v1.8.0-beta.0', 'v2.0.0-rc.0', 'v2.0.0-beta.01', 'v2.0.0\n'])
    assert.throws(() => resolveRelease(tag, tag.slice(1)), /release tag/)
  assert.throws(() => resolveRelease('v1.7.4', '2.0.0-beta.0'), /does not match/)
})
