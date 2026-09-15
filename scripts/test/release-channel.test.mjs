import assert from 'node:assert/strict'
// The release check runs before dependencies are installed.
// eslint-disable-next-line test/no-import-node-test
import { test } from 'node:test'
import { resolveRelease } from '../release-channel.mjs'

test('v1 releases stay latest until a stable v2 tag exists', () => {
  for (const tags of [[], ['v1.7.3'], ['v2.0.0-beta.0', 'v2.0.0-beta.1']]) {
    const result = resolveRelease('v1.7.4', '1.7.4', tags)
    assert.equal(result.npmTag, 'latest')
    assert.equal(result.branch, '1.x')
    assert.equal(result.latest, true)
    assert.equal(result.prerelease, false)
  }
})

test('v1 releases become maintenance once a stable v2 tag exists', () => {
  for (const tags of [['v2.0.0'], ['v2.0.0-beta.0', 'v2.0.0', 'v2.1.3']]) {
    const result = resolveRelease('v1.7.4', '1.7.4', tags)
    assert.equal(result.npmTag, 'latest-1')
    assert.equal(result.branch, '1.x')
    assert.equal(result.latest, false)
    assert.equal(result.prerelease, false)
  }
})

test('v2 beta releases stay on beta whatever tags exist', () => {
  for (const tags of [[], ['v2.0.0']]) {
    const result = resolveRelease('v2.0.0-beta.0', '2.0.0-beta.0', tags)
    assert.equal(result.npmTag, 'beta')
    assert.equal(result.branch, 'main')
    assert.equal(result.latest, false)
    assert.equal(result.prerelease, true)
  }
})

test('stable v2 releases become latest', () => {
  const result = resolveRelease('v2.0.0', '2.0.0', ['v2.0.0'])
  assert.equal(result.npmTag, 'latest')
  assert.equal(result.latest, true)
  assert.equal(result.prerelease, false)
})

test('rejects tags that would publish the wrong version or channel', () => {
  for (const tag of ['main', 'latest', 'v01.2.3', 'v3.0.0', 'v1.8.0-beta.0', 'v2.0.0-rc.0', 'v2.0.0-beta.01', 'v2.0.0\n'])
    assert.throws(() => resolveRelease(tag, tag.slice(1)), /release tag/)
  assert.throws(() => resolveRelease('v1.7.4', '2.0.0-beta.0'), /does not match/)
})
