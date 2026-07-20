export default function Home() {
  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '2rem', fontFamily: 'system-ui' }}>
      <h1>mdream + Next.js</h1>
      <p>
        This example shows how to use <code>mdream</code> in a Next.js app with Turbopack.
      </p>
      <h2>API Route</h2>
      <p>
        Convert any URL to Markdown via the API route:
      </p>
      <pre style={{ background: '#f4f4f4', padding: '1rem', borderRadius: 8, overflow: 'auto' }}>
        GET /api/markdown?url=https://example.com
      </pre>
      <p>
        <a href="/api/markdown?url=https://example.com">Try it</a>
      </p>
    </main>
  )
}
