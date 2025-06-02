import { describe, expect, it } from 'vitest'
import { htmlToMarkdown } from '../../../src/index.ts'
import { createPlugin } from '../../../src/pluggable/plugin.ts'

describe('script content extraction', () => {
  it('should extract JSON content from Nuxt data script', () => {
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

    const extractedScripts: Array<{ type?: string, id?: string, content: string }> = []
    
    const scriptExtractionPlugin = createPlugin({
      onNodeEnter(element) {
        if (element.name === 'script') {
          // Mark that we want to capture the content
          element.scriptData = { type: element.attributes?.type, id: element.attributes?.id, content: '' }
        }
      },
      
      processTextNode(textNode) {
        // Check if we're inside a script tag (including excluded text nodes)
        if (textNode.parent?.name === 'script' && textNode.parent.scriptData) {
          textNode.parent.scriptData.content += textNode.value
          // Return skip: true to prevent the text from being processed further,
          // but we've already captured it for extraction
          return { content: '', skip: true }
        }
      },
      
      onNodeExit(element) {
        if (element.name === 'script' && element.scriptData) {
          extractedScripts.push({
            type: element.scriptData.type,
            id: element.scriptData.id,
            content: element.scriptData.content.trim()
          })
        }
      }
    })

    const result = htmlToMarkdown(html, {
      plugins: [scriptExtractionPlugin]
    })

    // Should extract the script content
    expect(extractedScripts).toHaveLength(1)
    expect(extractedScripts[0].type).toBe('application/json')
    expect(extractedScripts[0].id).toBe('__NUXT_DATA__')
    
    // Verify the JSON content can be parsed
    expect(() => JSON.parse(extractedScripts[0].content)).not.toThrow()
    
    const parsedData = JSON.parse(extractedScripts[0].content)
    expect(Array.isArray(parsedData)).toBe(true)
    expect(parsedData.length).toBeGreaterThan(20) // Should have many elements
    
    // Check that the JSON contains expected data structure
    expect(parsedData[0]).toHaveProperty("state")
    expect(parsedData[0]).toHaveProperty("once")
    expect(parsedData[0]).toHaveProperty("_errors")
    
    // Look for expected string values anywhere in the array
    const jsonString = JSON.stringify(parsedData)
    expect(jsonString).toContain("system")
    expect(jsonString).toContain("Nuxt SEO")
    expect(jsonString).toContain("https://nuxtseo.com")
    expect(jsonString).toContain("1747646786733")
    
    // The markdown should only contain the content after the script
    expect(result.trim()).toBe('Some content after the script')
  })

  it('should extract JavaScript code content from script', () => {
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

    const extractedScripts: Array<{ content: string }> = []
    
    const scriptExtractionPlugin = createPlugin({
      onNodeEnter(element) {
        if (element.name === 'script') {
          element.scriptData = { content: '' }
        }
      },
      
      processTextNode(textNode) {
        if (textNode.parent?.name === 'script' && textNode.parent.scriptData) {
          textNode.parent.scriptData.content += textNode.value
          return { content: '', skip: true }
        }
      },
      
      onNodeExit(element) {
        if (element.name === 'script' && element.scriptData) {
          extractedScripts.push({
            content: element.scriptData.content.trim()
          })
        }
      }
    })

    const result = htmlToMarkdown(html, {
      plugins: [scriptExtractionPlugin]
    })

    expect(extractedScripts).toHaveLength(1)
    expect(extractedScripts[0].content).toContain('function initApp()')
    expect(extractedScripts[0].content).toContain('apiUrl: "https://api.example.com"')
    expect(extractedScripts[0].content).toContain('console.log')
    expect(extractedScripts[0].content).toContain('initApp();')
    
    expect(result.trim()).toBe('Page content')
  })

  it('should handle script with quotes in complex scenarios', () => {
    const html = `<script type="application/json">
      {
        "message": "He said \\"Hello world\\" to everyone",
        "template": "<div>Some HTML content</div>",
        "data": {
          "quotes": "Mix of 'single' and \\"double\\" quotes",
          "backticks": "Template \`strings\` with \${variables}"
        }
      }
    </script>
    <p>Content</p>`

    const extractedScripts: Array<{ content: string }> = []
    
    const scriptExtractionPlugin = createPlugin({
      onNodeEnter(element) {
        if (element.name === 'script') {
          element.scriptData = { content: '' }
        }
      },
      
      processTextNode(textNode) {
        if (textNode.parent?.name === 'script' && textNode.parent.scriptData) {
          textNode.parent.scriptData.content += textNode.value
          return { content: '', skip: true }
        }
      },
      
      onNodeExit(element) {
        if (element.name === 'script' && element.scriptData) {
          extractedScripts.push({
            content: element.scriptData.content.trim()
          })
        }
      }
    })

    const result = htmlToMarkdown(html, {
      plugins: [scriptExtractionPlugin]
    })

    expect(extractedScripts).toHaveLength(1)
    
    // Verify the JSON content is properly extracted and can be parsed
    expect(() => JSON.parse(extractedScripts[0].content)).not.toThrow()
    
    const parsedData = JSON.parse(extractedScripts[0].content)
    expect(parsedData.message).toBe('He said "Hello world" to everyone')
    expect(parsedData.template).toBe('<div>Some HTML content</div>')
    expect(parsedData.data.quotes).toBe('Mix of \'single\' and "double" quotes')
    
    expect(result.trim()).toBe('Content')
  })
})