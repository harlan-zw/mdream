import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { expect, it } from 'vitest'

function startServer() {
  return new Promise((resolve, reject) => {
    const server = spawn('node', ['server.js'], {
      cwd: join(process.cwd(), 'examples', 'vite-ssr-vue'),
      stdio: 'pipe',
      env: { ...process.env, NODE_ENV: 'development' },
    })

    let output = ''
    let errorOutput = ''

    server.stdout.on('data', (data) => {
      output += data.toString()
      console.log('Server output:', data.toString())
      if (output.includes('Server started at')) {
        resolve(server)
      }
    })

    server.stderr.on('data', (data) => {
      errorOutput += data.toString()
      console.log('Server error:', data.toString())
      // Don't reject on WebSocket errors, they're not critical
      if (errorOutput.includes('EADDRINUSE') && errorOutput.includes('5173')) {
        reject(new Error('Port 5173 is already in use'))
      }
    })

    setTimeout(() => {
      reject(new Error(`Server start timeout. Output: ${output}, Error: ${errorOutput}`))
    }, 10000)
  })
}

async function makeRequest(path) {
  const response = await fetch(`http://localhost:5173${path}`)
  return {
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    text: await response.text(),
  }
}

it('vue SSR markdown conversion - Home page', async () => {
  let server

  try {
    server = await startServer()

    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Test HTML response
    const htmlResponse = await makeRequest('/')
    expect(htmlResponse.status).toBe(200)
    expect(htmlResponse.headers['content-type']).toContain('text/html')
    expect(htmlResponse.text).toContain('Vite + Vue')
    expect(htmlResponse.text).toContain('<div')

    // Test markdown conversion
    const markdownResponse = await makeRequest('/.md')
    expect(markdownResponse.status).toBe(200)
    expect(markdownResponse.headers['content-type']).toContain('text/markdown')
    expect(markdownResponse.text).toContain('Vite + Vue')
    expect(markdownResponse.text).not.toContain('<div')
    expect(markdownResponse.text.length).toBeGreaterThan(0)

    // Test specific Vue content conversion
    expect(markdownResponse.text).toContain('Vite + Vue')
    expect(markdownResponse.text).toContain('[Home](/) [About](/about) [Contact](/contact)')
    expect(markdownResponse.text).toContain('Edit `components/HelloWorld.vue`')
  }
  catch (error) {
    console.error('Test failed:', error)
    throw error
  }
  finally {
    if (server) {
      server.kill('SIGTERM')
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }
}, 30000)

it('vue SSR markdown conversion - About page', async () => {
  let server

  try {
    server = await startServer()

    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Test HTML response
    const htmlResponse = await makeRequest('/about')
    expect(htmlResponse.status).toBe(200)
    expect(htmlResponse.headers['content-type']).toContain('text/html')
    expect(htmlResponse.text).toContain('About Us')
    expect(htmlResponse.text).toContain('Our Mission')
    expect(htmlResponse.text).toContain('John Doe')

    // Test markdown conversion
    const markdownResponse = await makeRequest('/about.md')
    expect(markdownResponse.status).toBe(200)
    expect(markdownResponse.headers['content-type']).toContain('text/markdown')
    expect(markdownResponse.text).toContain('# About Us')
    expect(markdownResponse.text).toContain('## Our Mission')
    expect(markdownResponse.text).toContain('John Doe')
    expect(markdownResponse.text).not.toContain('<div')
  }
  catch (error) {
    console.error('About page test failed:', error)
    throw error
  }
  finally {
    if (server) {
      server.kill('SIGTERM')
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }
}, 30000)

it('vue SSR markdown conversion - Contact page', async () => {
  let server

  try {
    server = await startServer()

    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Test HTML response
    const htmlResponse = await makeRequest('/contact')
    expect(htmlResponse.status).toBe(200)
    expect(htmlResponse.headers['content-type']).toContain('text/html')
    expect(htmlResponse.text).toContain('Contact Us')
    expect(htmlResponse.text).toContain('Get in Touch')
    expect(htmlResponse.text).toContain('hello@company.com')

    // Test markdown conversion
    const markdownResponse = await makeRequest('/contact.md')
    expect(markdownResponse.status).toBe(200)
    expect(markdownResponse.headers['content-type']).toContain('text/markdown')
    expect(markdownResponse.text).toContain('# Contact Us')
    expect(markdownResponse.text).toContain('## Get in Touch')
    expect(markdownResponse.text).toContain('hello@company.com')
    expect(markdownResponse.text).not.toContain('<div')
    expect(markdownResponse.text).not.toContain('<form')
  }
  catch (error) {
    console.error('Contact page test failed:', error)
    throw error
  }
  finally {
    if (server) {
      server.kill('SIGTERM')
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }
}, 30000)

it('vue SSR markdown conversion - Runtime generation', async () => {
  let server

  try {
    server = await startServer()

    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Test that runtime markdown generation works for multiple requests
    const paths = ['/', '/about', '/contact']

    for (const path of paths) {
      const response = await makeRequest(`${path}.md`)
      expect(response.status).toBe(200)
      expect(response.headers['content-type']).toContain('text/markdown')
      expect(response.text.length).toBeGreaterThan(0)
      expect(response.text).not.toContain('<div')
    }

    // Test that /index.md maps to / correctly
    const indexResponse = await makeRequest('/index.md')
    expect(indexResponse.status).toBe(200)
    expect(indexResponse.headers['content-type']).toContain('text/markdown')
    expect(indexResponse.text).toContain('Vite + Vue')

    // Should also be accessible via /.md
    const rootResponse = await makeRequest('/.md')
    expect(rootResponse.status).toBe(200)
    expect(rootResponse.text).toContain('Vite + Vue')
  }
  catch (error) {
    console.error('Runtime generation test failed:', error)
    throw error
  }
  finally {
    if (server) {
      server.kill('SIGTERM')
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }
}, 30000)

it('vue SSR markdown caching', async () => {
  let server

  try {
    server = await startServer()

    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 2000))

    // First request
    const start1 = Date.now()
    const response1 = await makeRequest('/.md')
    const duration1 = Date.now() - start1

    expect(response1.status).toBe(200)
    expect(response1.headers['content-type']).toContain('text/markdown')

    // Second request (should be cached)
    const start2 = Date.now()
    const response2 = await makeRequest('/.md')
    const duration2 = Date.now() - start2

    expect(response2.status).toBe(200)
    expect(response2.text).toBe(response1.text)

    // Second request should be faster due to caching (or at least not slower)
    expect(duration2).toBeLessThanOrEqual(duration1 + 10) // Allow 10ms tolerance
  }
  catch (error) {
    console.error('Caching test failed:', error)
    throw error
  }
  finally {
    if (server) {
      server.kill('SIGTERM')
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }
}, 30000)

it('vue SSR markdown error handling', async () => {
  let server

  try {
    server = await startServer()

    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Test non-existent page - Vue Router handles unknown routes by showing default route
    // This is expected behavior for SPAs with Vue Router
    const response = await makeRequest('/nonexistent.md')
    expect(response.status).toBe(200)
    expect(response.text).toContain('Vite + Vue') // Shows home page content
  }
  catch (error) {
    console.error('Error handling test failed:', error)
    throw error
  }
  finally {
    if (server) {
      server.kill('SIGTERM')
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }
}, 30000)
