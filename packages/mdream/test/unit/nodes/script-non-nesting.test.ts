import { htmlToMarkdown } from '@mdream/js'
import { describe, expect, it } from 'vitest'

describe('script non-nesting tag handling', () => {
  describe('less-than operator inside script tags', () => {
    it('should not break on < followed by space in script', () => {
      const html = '<head><script>var x = 1 < 2;</script></head><body><p>Hello</p></body>'
      const result = htmlToMarkdown(html)
      expect(result).toContain('Hello')
    })

    it('should not break on for loop comparison in script', () => {
      const html = '<head><script>for(var i=0; i < arr.length; i++){}</script></head><body><p>Content</p></body>'
      const result = htmlToMarkdown(html)
      expect(result).toContain('Content')
    })

    it('should not break on < followed by identifier in script', () => {
      const html = '<head><script>if (a < b) { c(); }</script></head><body><p>Visible</p></body>'
      const result = htmlToMarkdown(html)
      expect(result).toContain('Visible')
    })

    it('should handle multiple < operators in a single script', () => {
      const html = '<head><script>var x = 1 < 2; var y = 3 < 4; var z = a < b;</script></head><body><p>After</p></body>'
      const result = htmlToMarkdown(html)
      expect(result).toContain('After')
    })
  })

  describe('closing tags inside script content', () => {
    it('should not break on </div> inside script outside quotes', () => {
      const html = '<head><script>document.write("</div>");</script></head><body><p>Hello</p></body>'
      const result = htmlToMarkdown(html)
      expect(result).toContain('Hello')
    })

    it('should not break on </span> inside script', () => {
      const html = '<head><script>var x = "</span>";</script></head><body><p>Content</p></body>'
      const result = htmlToMarkdown(html)
      expect(result).toContain('Content')
    })
  })

  describe('shopify-like script patterns', () => {
    it('should handle script with escaped URLs and for loop', () => {
      const html = `<head><script>(function() {
  var urls = ["https:\\/\\/example.com\\/x.js"];
  for (var i = 0; i < urls.length; i++) {
    var s = document.createElement('script');
    s.src = urls[i];
    var x = document.getElementsByTagName('script')[0];
    x.parentNode.insertBefore(s, x);
  }
})();</script></head><body><p>Shopify Content</p></body>`
      const result = htmlToMarkdown(html)
      expect(result).toContain('Shopify Content')
    })

    it('should handle multiple inline scripts in head', () => {
      const html = `<head>
<script>var x = 1 < 2;</script>
<script>var y = a < b;</script>
<script>for(var i=0;i<10;i++){}</script>
</head><body><h1>Title</h1><p>Body text</p></body>`
      const result = htmlToMarkdown(html)
      expect(result).toContain('Title')
      expect(result).toContain('Body text')
    })

    it('should handle analytics script with createElement and DOM methods', () => {
      const html = `<head><script class="analytics">
  (function () {
    var first = document.getElementsByTagName('script')[0];
    var script = document.createElement('script');
    script.type = 'text/javascript';
    for (var i = 0; i < trekkie.methods.length; i++) {
      var key = trekkie.methods[i];
    }
  })();</script></head><body><p>Analytics page</p></body>`
      const result = htmlToMarkdown(html)
      expect(result).toContain('Analytics page')
    })
  })

  describe('body script tags', () => {
    it('should handle script with < in body (not just head)', () => {
      const html = '<body><p>Before</p><script>var x = 1 < 2;</script><p>After</p></body>'
      const result = htmlToMarkdown(html)
      expect(result).toContain('Before')
      expect(result).toContain('After')
    })
  })
})
