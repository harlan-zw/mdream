import { cp, mkdir, mkdtemp, realpath, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { expect, it } from 'vitest'
import { createVitest } from 'vitest/node'

it.each(['directory', 'junction'] as const)('discovers workspace browser tests without dependency copies through a %s', async (kind) => {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'mdream-discovery-'))
  const browserTest = 'packages/js/test/integration/attribute-tokenization.browser.test.ts'
  const markdownTest = 'packages/mdream/test/integration/browser-markdown.browser.test.ts'
  const dependencyTest = 'node_modules/.pnpm/node_modules/vite-vue-starter/node_modules/@mdream/vite/node_modules/@mdream/js/test/integration/attribute-tokenization.browser.test.ts'
  const fixtures = [
    [browserTest, browserTest],
    [markdownTest, markdownTest],
    [browserTest, dependencyTest],
    [browserTest, '.git/attribute-tokenization.browser.test.ts'],
  ] as const

  try {
    const workspace = join(temporaryDirectory, 'workspace')
    await mkdir(workspace)
    const fixtureRoot = kind === 'junction' ? join(temporaryDirectory, 'alias') : workspace
    if (kind === 'junction')
      await symlink(workspace, fixtureRoot, 'junction')
    // Vitest returns canonical paths, including expanded Windows short paths.
    const root = await realpath(fixtureRoot)

    for (const [source, destination] of fixtures) {
      const target = join(root, destination)
      await mkdir(dirname(target), { recursive: true })
      await cp(resolve(source), target)
    }

    const vitest = await createVitest({
      root,
      config: resolve('vitest.config.ts'),
      project: ['browser', 'browser-markdown'],
      watch: false,
    })
    try {
      const specifications = await vitest.globTestSpecifications()
      expect(specifications.map(specification => relative(root, specification.moduleId).split(sep).join('/')).sort()).toEqual([
        browserTest,
        markdownTest,
      ].sort())
    }
    finally {
      await vitest.close()
    }
  }
  finally {
    await rm(temporaryDirectory, { recursive: true, force: true })
  }
})
