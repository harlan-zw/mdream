import { describe, expect, it } from 'vitest'
import { htmlToMarkdown } from '../../../src/index.ts'
import { extractionPlugin } from '../../../src/plugins/extraction.ts'
import type { ExtractedElement } from '../../../src/plugins/extraction.ts'

describe('script extraction using extractionPlugin', () => {
  it('should extract Nuxt JSON data script using extractionPlugin', () => {
    const html = `<script type="application/json" data-nuxt-data="nuxt-app" data-ssr="true" id="__NUXT_DATA__"
        data-src="/docs/og-image/api/components/_payload.json?aeeb7ad0-7b04-4a56-a9bb-b48fe06efc6c">[
  {
    "state": 1,
    "once": 18,
    "_errors": 19,
    "serverRendered": 5,
    "path": 21,
    "prerenderedAt": 22
  },
  [
    "Reactive",
    2
  ],
  {
    "$scolor-mode": 3,
    "$snuxt-seo-utils:routeRules": 7,
    "$stoasts": 8,
    "$ssite-config": 9
  },
  {
    "preference": 4,
    "value": 4,
    "unknown": 5,
    "forced": 6
  },
  "system",
  true,
  false,
  {
    "head": -1,
    "seoMeta": -1
  },
  [],
  {
    "_priority": 10,
    "description": 13,
    "env": 14,
    "name": 15,
    "tagline": 16,
    "url": 17
  },
  {
    "name": 11,
    "env": 12,
    "url": 11,
    "description": 11,
    "tagline": 11
  },
  -3,
  -15,
  "Nuxt SEO is a collection of hand-crafted Nuxt Modules to help you rank higher in search engines.",
  "production",
  "Nuxt SEO",
  "All the boring SEO stuff for Nuxt done.",
  "https://nuxtseo.com",
  [
    "Set"
  ],
  [
    "ShallowReactive",
    20
  ],
  {
    "stats": -1,
    "search-og-image": -1,
    "navigation-og-image": -1,
    "docs-/docs/og-image/api/components": -1,
    "docs-/docs/og-image/api/components-surround": -1,
    "docs-/docs/og-image/api/components-last-commit": -1
  },
  "/docs/og-image/api/components",
  1747646786733
]</script>
<p>Some content after the script</p>`

    const extractedJsonScripts: ExtractedElement[] = []
    
    const plugin = extractionPlugin({
      'script[type="application/json"]': (element) => extractedJsonScripts.push(element),
    })

    const result = htmlToMarkdown(html, {
      plugins: [plugin]
    })

    // Should extract the JSON script
    expect(extractedJsonScripts).toHaveLength(1)
    expect(extractedJsonScripts[0].name).toBe('script')
    expect(extractedJsonScripts[0].attributes.type).toBe('application/json')
    expect(extractedJsonScripts[0].attributes.id).toBe('__NUXT_DATA__')
    
    // The textContent should contain the JSON data
    expect(extractedJsonScripts[0].textContent.length).toBeGreaterThan(500)
    
    // Verify the JSON can be parsed
    expect(() => JSON.parse(extractedJsonScripts[0].textContent)).not.toThrow()
    
    const parsedData = JSON.parse(extractedJsonScripts[0].textContent)
    expect(Array.isArray(parsedData)).toBe(true)
    expect(parsedData.length).toBeGreaterThan(20)
    
    // Check that specific content exists in the JSON
    const jsonString = JSON.stringify(parsedData)
    expect(jsonString).toContain('Nuxt SEO')
    expect(jsonString).toContain('https://nuxtseo.com')
    expect(jsonString).toContain('system')
    
    // The markdown output should only contain the paragraph
    expect(result.trim()).toBe('Some content after the script')
  })

  it('should extract JavaScript code using extractionPlugin', () => {
    const html = `<script>
      function initApp() {
        const config = {
          apiUrl: "https://api.example.com",
          version: "1.0.0"
        };
        console.log('App initialized with config:', config);
      }
      initApp();
    </script>
    <p>Page content</p>`

    const extractedScripts: ExtractedElement[] = []
    
    const plugin = extractionPlugin({
      'script': (element) => extractedScripts.push(element),
    })

    const result = htmlToMarkdown(html, {
      plugins: [plugin]
    })

    expect(extractedScripts).toHaveLength(1)
    expect(extractedScripts[0].name).toBe('script')
    expect(extractedScripts[0].textContent).toContain('function initApp()')
    expect(extractedScripts[0].textContent).toContain('apiUrl: "https://api.example.com"')
    expect(extractedScripts[0].textContent).toContain('console.log')
    expect(extractedScripts[0].textContent).toContain('initApp();')
    
    expect(result.trim()).toBe('Page content')
  })

  it('should handle complex quote scenarios in scripts', () => {
    const html = `<script type="application/json">
      {
        "message": "He said \\"Hello world\\" to everyone",
        "template": "<div class=\\"test\\">Content with 'quotes' and \\"escaped quotes\\"</div>",
        "data": {
          "quotes": "Mix of 'single' and \\"double\\" quotes",
          "backticks": "Template \`strings\` with \${variables}",
          "url": "https://example.com/path?param='value'&other=\\"test\\""
        }
      }
    </script>
    <p>Content</p>`

    const extractedScripts: ExtractedElement[] = []
    
    const plugin = extractionPlugin({
      'script[type="application/json"]': (element) => extractedScripts.push(element),
    })

    const result = htmlToMarkdown(html, {
      plugins: [plugin]
    })

    expect(extractedScripts).toHaveLength(1)
    
    // Verify the JSON content is properly extracted and can be parsed
    expect(() => JSON.parse(extractedScripts[0].textContent)).not.toThrow()
    
    const parsedData = JSON.parse(extractedScripts[0].textContent)
    expect(parsedData.message).toBe('He said "Hello world" to everyone')
    expect(parsedData.template).toBe('<div class="test">Content with \'quotes\' and "escaped quotes"</div>')
    expect(parsedData.data.quotes).toBe('Mix of \'single\' and "double" quotes')
    expect(parsedData.data.backticks).toBe('Template `strings` with ${variables}')
    expect(parsedData.data.url).toBe('https://example.com/path?param=\'value\'&other="test"')
    
    expect(result.trim()).toBe('Content')
  })

  it('should extract specific script types using attribute selectors', () => {
    const html = `<script type="application/ld+json">
      {"@type": "WebPage", "name": "Example"}
    </script>
    <script type="application/json" id="data">
      {"config": "value", "quotes": "Mix of single and double quotes"}
    </script>
    <p>Content</p>`

    const jsonLdScripts: ExtractedElement[] = []
    const jsonScripts: ExtractedElement[] = []
    
    const plugin = extractionPlugin({
      'script[type="application/ld+json"]': (element) => jsonLdScripts.push(element),
      'script[type="application/json"]': (element) => jsonScripts.push(element),
    })

    const result = htmlToMarkdown(html, {
      plugins: [plugin]
    })

    // Should categorize them correctly
    expect(jsonLdScripts).toHaveLength(1)
    expect(jsonScripts).toHaveLength(1)
    
    // Verify content extraction works with complex quotes
    expect(jsonLdScripts[0].textContent).toContain('"@type": "WebPage"')
    expect(jsonScripts[0].textContent).toContain('"config": "value"')
    expect(jsonScripts[0].textContent).toContain('Mix of single and double quotes')
    expect(jsonScripts[0].attributes.id).toBe('data')
    
    // Both should parse as valid JSON
    expect(() => JSON.parse(jsonLdScripts[0].textContent)).not.toThrow()
    expect(() => JSON.parse(jsonScripts[0].textContent)).not.toThrow()
    
    expect(result.trim()).toBe('Content')
  })
})