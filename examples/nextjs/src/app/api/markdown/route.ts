import { htmlToMarkdown } from 'mdream'
import { type NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url')
  if (!url) {
    return NextResponse.json({ error: 'Missing ?url= parameter' }, { status: 400 })
  }

  let parsed: URL
  try {
    parsed = new URL(url)
  }
  catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  const res = await fetch(parsed.href)
  if (!res.ok) {
    return NextResponse.json(
      { error: `Failed to fetch: ${res.status}` },
      { status: 502 },
    )
  }

  const html = await res.text()
  const markdown = htmlToMarkdown(html, {
    origin: parsed.origin,
    minimal: true,
  })

  return new NextResponse(markdown, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  })
}
