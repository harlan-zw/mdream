import { describe, expect, it } from 'vitest'
import { syncHtmlToMarkdown } from '../../../src/index.js'
import { filterPlugin } from '../../../src/plugins'

describe('not supported', () => {
  it('inner forms', () => {
    const html = `<div class="float-left pr-4 mb-6 mb-xl-0 col-12 col-lg-6 col-xl-3">
<form class="f5" data-testid="survey-form" aria-live="polite">
<h3 id="survey-title" class="f4 mb-3">Did you find what you needed?</h3>
<input type="text" class="d-none" name="survey-token" value="">
<div class="mb-2" role="radiogroup" aria-labelledby="survey-title">
<input class="Survey_visuallyHidden__Xh_nl Survey_customRadio__aNqUl" id="survey-yes" type="radio" name="survey-vote" aria-label="Yes" value="Y">
<label class="btn mr-1" for="survey-yes"><svg aria-hidden="true" focusable="false" class="octicon octicon-thumbsup color-fg-muted" viewBox="0 0 16 16" width="16" height="16" fill="currentColor" display="inline-block" overflow="visible" style="vertical-align:text-bottom"><path d="M8.347.631A.75.75 0 0 1 9.123.26l.238.04a3.25 3.25 0 0 1 2.591 4.098L11.494 6h.665a3.25 3.25 0 0 1 3.118 4.167l-1.135 3.859A2.751 2.751 0 0 1 11.503 16H6.586a3.75 3.75 0 0 1-2.184-.702A1.75 1.75 0 0 1 3 16H1.75A1.75 1.75 0 0 1 0 14.25v-6.5C0 6.784.784 6 1.75 6h3.417a.25.25 0 0 0 .217-.127ZM4.75 13.649l.396.33c.404.337.914.521 1.44.521h4.917a1.25 1.25 0 0 0 1.2-.897l1.135-3.859A1.75 1.75 0 0 0 12.159 7.5H10.5a.75.75 0 0 1-.721-.956l.731-2.558a1.75 1.75 0 0 0-1.127-2.14L6.69 6.611a1.75 1.75 0 0 1-1.523.889H4.75ZM3.25 7.5h-1.5a.25.25 0 0 0-.25.25v6.5c0 .138.112.25.25.25H3a.25.25 0 0 0 .25-.25Z"></path>
</svg> <!-- -->Yes
</label>
<input class="Survey_visuallyHidden__Xh_nl Survey_customRadio__aNqUl" id="survey-no" type="radio" name="survey-vote" aria-label="No" value="N"><label class="btn" for="survey-no"><svg aria-hidden="true" focusable="false" class="octicon octicon-thumbsdown color-fg-muted" viewBox="0 0 16 16" width="16" height="16" fill="currentColor" display="inline-block" overflow="visible" style="vertical-align:text-bottom"><path d="M7.653 15.369a.75.75 0 0 1-.776.371l-.238-.04a3.25 3.25 0 0 1-2.591-4.099L4.506 10h-.665A3.25 3.25 0 0 1 .723 5.833l1.135-3.859A2.75 2.75 0 0 1 4.482 0H9.43c.78.003 1.538.25 2.168.702A1.752 1.752 0 0 1 12.989 0h1.272A1.75 1.75 0 0 1 16 1.75v6.5A1.75 1.75 0 0 1 14.25 10h-3.417a.25.25 0 0 0 .217.127ZM11.25 2.351l-.396-.33a2.248 2.248 0 0 0-1.44-.521H4.496a1.25 1.25 0 0 0-1.199.897L2.162 6.256A1.75 1.75 0 0 0 3.841 8.5H5.5a.75.75 0 0 1 .721.956l-.731 2.558a1.75 1.75 0 0 0 1.127 2.14L9.31 9.389a1.75 1.75 0 0 1 1.523-.889h.417Zm1.5 6.149h1.5a.25.25 0 0 0 .25-.25v-6.5a.25.25 0 0 0-.25-.25H13a.25.25 0 0 0-.25.25Z"></path></svg> <!-- -->No</label>
</div>
<a rel="" class="f6 text-underline" target="_blank" href="/en/site-policy/privacy-policies/github-privacy-statement">Privacy policy</a>
</form>
</div>`
    const markdown = syncHtmlToMarkdown(html, {
      plugins: [
        filterPlugin({
          exclude: [
            'footer',
            'form',
          ],
        }),
      ],
    })
    expect(markdown).toMatchInlineSnapshot(`""`)
  })
  it.skip('aria hidden', () => {
    const html = `<div class="float-left pr-4 mb-6 mb-xl-0 col-12 col-lg-6 col-xl-3"><a href="/docs/guide/concepts" tabindex="-1" aria-label="Nuxt Concepts" class="focus:outline-none"><!--[--><!--[--><span class="absolute inset-0" aria-hidden="true"></span><!--]--><!--]--></a><span class="iconify i-lucide:bookmark size-4 shrink-0 align-sub me-1.5 transition-colors text-highlighted" aria-hidden="true" style="">HIDDEN</span><!----><!--[--><!--[--> Read more in <span class="font-bold">Nuxt Concepts</span>. <!--]--><!--]--></div>`
    const markdown = syncHtmlToMarkdown(html, {
      plugins: [
        filterPlugin({
          exclude: [
            'footer',
            'form',
          ],
        }),
      ],
    })
    expect(markdown).toBe('[Nuxt Concepts](/docs/guide/concepts) Read more in Nuxt Concepts.')
  })
})
