import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

let server

function startServer() {
  return new Promise((resolve, reject) => {
    server = spawn(process.execPath, ['server.js'], {
      cwd: resolve(import.meta.dirname, '..', '..'),
      stdio: 'pipe',
      env: { ...process.env, NODE_ENV: 'development' },
    })

    let output = ''

    server.stdout.on('data', (data) => {
      output += data.toString()
      if (output.includes('Server started at'))
        resolve()
    })

    server.stderr.on('data', (data) => {
      const msg = data.toString()
      if (msg.includes('EADDRINUSE'))
        reject(new Error('Port 5173 is already in use'))
    })

    setTimeout(() => reject(new Error(`Server start timeout. Output: ${output}`)), 10000)
  })
}

function makeRequest(path) {
  return fetch(`http://localhost:5173${path}`).then(async res => ({
    status: res.status,
    headers: Object.fromEntries(res.headers.entries()),
    text: await res.text(),
  }))
}

describe('vue SSR markdown conversion', () => {
  beforeAll(async () => {
    await startServer()
    // Wait for Vite to be ready
    await new Promise(resolve => setTimeout(resolve, 2000))
  }, 15000)

  afterAll(() => {
    server?.kill('SIGTERM')
  })

  it('home page', async () => {
    const html = await makeRequest('/')
    expect(html.status).toBe(200)
    expect(html.headers['content-type']).toContain('text/html')
    expect(html.text).toContain('Vite + Vue')

    const md = await makeRequest('/.md')
    expect(md.status).toBe(200)
    expect(md.headers['content-type']).toContain('text/markdown')
    expect(md.text).toContain('Vite + Vue')
    expect(md.text).not.toContain('<div')
    expect(md.text).toContain('[Home](/) [About](/about) [Contact](/contact)')
    expect(md.text).toContain('Edit `components/HelloWorld.vue`')
  })

  it('about page', async () => {
    const html = await makeRequest('/about')
    expect(html.status).toBe(200)
    expect(html.text).toContain('About Us')

    const md = await makeRequest('/about.md')
    expect(md.status).toBe(200)
    expect(md.headers['content-type']).toContain('text/markdown')
    expect(md.text).toContain('# About Us')
    expect(md.text).toContain('## Our Mission')
    expect(md.text).toContain('John Doe')
    expect(md.text).not.toContain('<div')
  })

  it('contact page', async () => {
    const html = await makeRequest('/contact')
    expect(html.status).toBe(200)
    expect(html.text).toContain('Contact Us')

    const md = await makeRequest('/contact.md')
    expect(md.status).toBe(200)
    expect(md.headers['content-type']).toContain('text/markdown')
    expect(md.text).toContain('# Contact Us')
    expect(md.text).toContain('## Get in Touch')
    expect(md.text).toContain('hello@company.com')
    expect(md.text).not.toContain('<div')
    expect(md.text).not.toContain('<form')
  })

  it('runtime generation across pages', async () => {
    for (const path of ['/', '/about', '/contact']) {
      const res = await makeRequest(`${path}.md`)
      expect(res.status).toBe(200)
      expect(res.headers['content-type']).toContain('text/markdown')
      expect(res.text).not.toContain('<div')
    }

    // index.md maps to /
    const index = await makeRequest('/index.md')
    expect(index.status).toBe(200)
    expect(index.text).toContain('Vite + Vue')
  })

  it('caching - second request not slower', async () => {
    const start1 = Date.now()
    const r1 = await makeRequest('/.md')
    const d1 = Date.now() - start1

    const start2 = Date.now()
    const r2 = await makeRequest('/.md')
    const d2 = Date.now() - start2

    expect(r2.text).toBe(r1.text)
    expect(d2).toBeLessThanOrEqual(d1 + 10)
  })

  it('unknown route falls back to home', async () => {
    const res = await makeRequest('/nonexistent.md')
    expect(res.status).toBe(200)
    expect(res.text).toContain('Vite + Vue')
  })
})
