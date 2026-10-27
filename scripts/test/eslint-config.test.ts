import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

describe('repository lint policy', () => {
  const eslint = new ESLint()

  it('accepts existing release tooling formatting after dependency updates', async () => {
    const results = await eslint.lintFiles([
      'scripts/pack-previews.mjs',
      'scripts/release-channel.mjs',
      'scripts/stage-napi-artifacts.mjs',
      'scripts/sync-cargo-version.mjs',
      'scripts/test/release-channel.test.mjs',
      'scripts/verify-npm-artifacts.mjs',
      'vitest.config.ts',
    ])

    expect(results.flatMap(result => result.messages)).toEqual([])
  })

  it('still rejects undefined variables', async () => {
    const results = await eslint.lintText('missingReleaseFunction()\n', {
      filePath: 'scripts/release-probe.mjs',
    })

    expect(results.flatMap(result => result.messages)).toContainEqual(expect.objectContaining({
      ruleId: 'no-undef',
      severity: 2,
    }))
  })
})
