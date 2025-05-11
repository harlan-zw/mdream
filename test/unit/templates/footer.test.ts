import { describe, expect, it } from 'vitest'
import { syncHtmlToMarkdown } from '../../../src'
import { filterPlugin } from '../../../src/plugins'

describe('footer', () => {
  it('github', () => {
    const html = ` <footer data-container="footer">
        <section class="container-xl mt-lg-8 mt-6 px-3 px-md-6 no-print mx-auto"><h2 class="f3">Help and support</h2>
          <div class="container-xl mx-auto py-6 py-lg-6 clearfix border-top border-color-secondary">
            <div class="float-left pr-4 mb-6 mb-xl-0 col-12 col-lg-6 col-xl-3">
              <form class="f5" data-testid="survey-form" aria-live="polite">
              <h3 id="survey-title" class="f4 mb-3">Did
                you find what you needed?</h3><input type="text" class="d-none" name="survey-token" value=""/>
                <div class="mb-2" role="radiogroup" aria-labelledby="survey-title"><input
                  class="Survey_visuallyHidden__Xh_nl Survey_customRadio__aNqUl" id="survey-yes" type="radio"
                  name="survey-vote" aria-label="Yes" value="Y"/><label class="btn mr-1" for="survey-yes">
                  <svg aria-hidden="true" focusable="false" class="octicon octicon-thumbsup color-fg-muted"
                       viewBox="0 0 16 16" width="16" height="16" fill="currentColor" display="inline-block"
                       overflow="visible" style="vertical-align:text-bottom">
                    <path
                      d="M8.347.631A.75.75 0 0 1 9.123.26l.238.04a3.25 3.25 0 0 1 2.591 4.098L11.494 6h.665a3.25 3.25 0 0 1 3.118 4.167l-1.135 3.859A2.751 2.751 0 0 1 11.503 16H6.586a3.75 3.75 0 0 1-2.184-.702A1.75 1.75 0 0 1 3 16H1.75A1.75 1.75 0 0 1 0 14.25v-6.5C0 6.784.784 6 1.75 6h3.417a.25.25 0 0 0 .217-.127ZM4.75 13.649l.396.33c.404.337.914.521 1.44.521h4.917a1.25 1.25 0 0 0 1.2-.897l1.135-3.859A1.75 1.75 0 0 0 12.159 7.5H10.5a.75.75 0 0 1-.721-.956l.731-2.558a1.75 1.75 0 0 0-1.127-2.14L6.69 6.611a1.75 1.75 0 0 1-1.523.889H4.75ZM3.25 7.5h-1.5a.25.25 0 0 0-.25.25v6.5c0 .138.112.25.25.25H3a.25.25 0 0 0 .25-.25Z"></path>
                  </svg> <!-- -->Yes</label><input class="Survey_visuallyHidden__Xh_nl Survey_customRadio__aNqUl"
                                                   id="survey-no" type="radio" name="survey-vote" aria-label="No"
                                                   value="N"/><label class="btn" for="survey-no">
                  <svg aria-hidden="true" focusable="false" class="octicon octicon-thumbsdown color-fg-muted"
                       viewBox="0 0 16 16" width="16" height="16" fill="currentColor" display="inline-block"
                       overflow="visible" style="vertical-align:text-bottom">
                    <path
                      d="M7.653 15.369a.75.75 0 0 1-.776.371l-.238-.04a3.25 3.25 0 0 1-2.591-4.099L4.506 10h-.665A3.25 3.25 0 0 1 .723 5.833l1.135-3.859A2.75 2.75 0 0 1 4.482 0H9.43c.78.003 1.538.25 2.168.702A1.752 1.752 0 0 1 12.989 0h1.272A1.75 1.75 0 0 1 16 1.75v6.5A1.75 1.75 0 0 1 14.25 10h-3.417a.25.25 0 0 0-.217.127ZM11.25 2.351l-.396-.33a2.248 2.248 0 0 0-1.44-.521H4.496a1.25 1.25 0 0 0-1.199.897L2.162 6.256A1.75 1.75 0 0 0 3.841 8.5H5.5a.75.75 0 0 1 .721.956l-.731 2.558a1.75 1.75 0 0 0 1.127 2.14L9.31 9.389a1.75 1.75 0 0 1 1.523-.889h.417Zm1.5 6.149h1.5a.25.25 0 0 0 .25-.25v-6.5a.25.25 0 0 0-.25-.25H13a.25.25 0 0 0-.25.25Z"></path>
                  </svg> <!-- -->No</label></div>
                <a rel="" class="f6 text-underline" target="_blank"
                   href="/en/site-policy/privacy-policies/github-privacy-statement">Privacy policy</a>
                   </form>
            </div>
            <div class="float-left pr-4 mb-6 mb-xl-0 col-12 col-lg-6 col-xl-4 offset-xl-1">
              <div class="f5 contribution"><h3 class="f4 mb-3">Help us make these docs great!</h3>
                <p class="max-w-xs color-fg-muted mb-3">All GitHub docs are open source. See something that&#x27;s wrong
                  or unclear? Submit a pull request.</p><a class="btn"
                                                           href="https://github.com/github/docs/blob/main/content/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax.md">
                  <svg aria-hidden="true" focusable="false" class="octicon octicon-git-pull-request octicon mr-1"
                       viewBox="0 0 16 16" width="16" height="16" fill="currentColor" display="inline-block"
                       overflow="visible" style="vertical-align:text-bottom">
                    <path
                      d="M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354ZM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm8.25.75a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Z"></path>
                  </svg>
                  Make a contribution</a>
                <p class="color-fg-muted f6 mt-2"><a class="text-underline" href="/contributing" target="_blank"
                                                     rel="noopener">Learn how to contribute</a></p></div>
            </div>
            <div class="float-left pr-4 mb-6 mb-xl-0 col-12 col-lg-6 col-xl-3 offset-xl-1">
              <div><h3 class="mb-3 f4">Still need help?</h3>
                <div class="mb-2"><a id="ask-community" href="https://github.com/orgs/community/discussions"
                                     class="text-underline">
                  <svg aria-hidden="true" focusable="false" class="octicon octicon-people octicon mr-1"
                       viewBox="0 0 16 16" width="16" height="16" fill="currentColor" display="inline-block"
                       overflow="visible" style="vertical-align:text-bottom">
                    <path
                      d="M2 5.5a3.5 3.5 0 1 1 5.898 2.549 5.508 5.508 0 0 1 3.034 4.084.75.75 0 1 1-1.482.235 4 4 0 0 0-7.9 0 .75.75 0 0 1-1.482-.236A5.507 5.507 0 0 1 3.102 8.05 3.493 3.493 0 0 1 2 5.5ZM11 4a3.001 3.001 0 0 1 2.22 5.018 5.01 5.01 0 0 1 2.56 3.012.749.749 0 0 1-.885.954.752.752 0 0 1-.549-.514 3.507 3.507 0 0 0-2.522-2.372.75.75 0 0 1-.574-.73v-.352a.75.75 0 0 1 .416-.672A1.5 1.5 0 0 0 11 5.5.75.75 0 0 1 11 4Zm-5.5-.5a2 2 0 1 0-.001 3.999A2 2 0 0 0 5.5 3.5Z"></path>
                  </svg>
                  Ask the GitHub community</a></div>
                <div><a id="support" href="https://support.github.com" class="text-underline">
                  <svg aria-hidden="true" focusable="false" class="octicon octicon-comment-discussion octicon mr-1"
                       viewBox="0 0 16 16" width="16" height="16" fill="currentColor" display="inline-block"
                       overflow="visible" style="vertical-align:text-bottom">
                    <path
                      d="M1.75 1h8.5c.966 0 1.75.784 1.75 1.75v5.5A1.75 1.75 0 0 1 10.25 10H7.061l-2.574 2.573A1.458 1.458 0 0 1 2 11.543V10h-.25A1.75 1.75 0 0 1 0 8.25v-5.5C0 1.784.784 1 1.75 1ZM1.5 2.75v5.5c0 .138.112.25.25.25h1a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h3.5a.25.25 0 0 0 .25-.25v-5.5a.25.25 0 0 0-.25-.25h-8.5a.25.25 0 0 0-.25.25Zm13 2a.25.25 0 0 0-.25-.25h-.5a.75.75 0 0 1 0-1.5h.5c.966 0 1.75.784 1.75 1.75v5.5A1.75 1.75 0 0 1 14.25 12H14v1.543a1.458 1.458 0 0 1-2.487 1.03L9.22 12.28a.749.749 0 0 1 .326-1.275.749.749 0 0 1 .734.215l2.22 2.22v-2.19a.75.75 0 0 1 .75-.75h1a.25.25 0 0 0 .25-.25Z"></path>
                  </svg>
                  Contact support</a></div>
              </div>
            </div>
          </div>
        </section>
        <section class="container-xl px-3 mt-6 pb-8 px-md-6 color-fg-muted"><h2 class="f4 mb-2 col-12">Legal</h2>
          <ul class="d-flex flex-wrap list-style-none">
            <li class="mr-3">© <!-- -->2025<!-- --> GitHub, Inc.</li>
            <li class="mr-3"><a class="text-underline"
                                href="/en/site-policy/github-terms/github-terms-of-service">Terms</a></li>
            <li class="mr-3"><a class="text-underline" href="/en/site-policy/privacy-policies/github-privacy-statement">Privacy</a>
            </li>
            <li class="mr-3"><a class="text-underline" href="https://www.githubstatus.com/">Status</a></li>
            <li class="mr-3"><a class="text-underline" href="https://github.com/pricing">Pricing</a></li>
            <li class="mr-3"><a class="text-underline" href="https://services.github.com">Expert services</a></li>
            <li class="mr-3"><a class="text-underline" href="https://github.blog">Blog</a></li>
          </ul>
        </section>
        <div role="tooltip"
             class="position-fixed bottom-0 mb-4 right-0 mr-4 z-1 ScrollButton_transition200__rLxBo ScrollButton_opacity0__vjKQD">
          <button
            class="ghd-scroll-to-top tooltipped tooltipped-n tooltipped-no-delay btn circle border-1 d-flex flex-items-center flex-justify-center ScrollButton_customFocus__L3FsX"
            style="width:40px;height:40px" aria-label="Scroll to top">
            <svg aria-hidden="true" focusable="false" class="octicon octicon-chevron-up" viewBox="0 0 16 16" width="16"
                 height="16" fill="currentColor" display="inline-block" overflow="visible"
                 style="vertical-align:text-bottom">
              <path
                d="M3.22 10.53a.749.749 0 0 1 0-1.06l4.25-4.25a.749.749 0 0 1 1.06 0l4.25 4.25a.749.749 0 1 1-1.06 1.06L8 6.811 4.28 10.53a.749.749 0 0 1-1.06 0Z"></path>
            </svg>
          </button>
        </div>
      </footer>`
    const markdown = syncHtmlToMarkdown(html)
    expect(markdown).toMatchInlineSnapshot(`
      "## Help and support



      ### Did you find what you needed?



      YesNo

      [Privacy policy](/en/site-policy/privacy-policies/github-privacy-statement)

      ### Help us make these docs great!

      All GitHub docs are open source. See something that's wrong or unclear? Submit a pull request.

      [Make a contribution](https://github.com/github/docs/blob/main/content/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax.md)

      [Learn how to contribute](/contributing)

      ### Still need help?

      [Ask the GitHub community](https://github.com/orgs/community/discussions)

      [Contact support](https://support.github.com)

      ## Legal

      - © 2025 GitHub, Inc.
      - [Terms](/en/site-policy/github-terms/github-terms-of-service)
      - [Privacy](/en/site-policy/privacy-policies/github-privacy-statement)
      - [Status](https://www.githubstatus.com/)
      - [Pricing](https://github.com/pricing)
      - [Expert services](https://services.github.com)
      - [Blog](https://github.blog)"
    `)
  })
  it('nuxt', () => {
    const html = `<!DOCTYPE><html><body><h1>foo bar</h1><div><div><footer><div class="py-8 lg:py-12 border-b border-default"><!--[--><div class="w-full max-w-(--ui-container) mx-auto px-4 sm:px-6 lg:px-8"><!--[--><nav class="xl:grid xl:grid-cols-3 xl:gap-8"><!----><div class="flex flex-col lg:grid grid-flow-col auto-cols-fr gap-8 xl:col-span-2"><!--[--><!--[--><div><h3 class="text-sm font-semibold">Community</h3><ul class="mt-6 space-y-4"><!--[--><li class="relative"><!--[--><!--[--><a href="https://nuxters.nuxt.com" rel="noopener noreferrer" target="_blank" class="group text-sm flex items-center gap-1.5 focus-visible:outline-primary text-muted hover:text-default transition-colors"><!--[--><!--[--><!--[--><!----><!--]--><span class="truncate"><!--[-->Nuxters<!--]--><span class="iconify i-lucide:arrow-up-right size-3 absolute top-0 text-dimmed inline-block" aria-hidden="true" style=""></span></span><!--[--><!--]--><!--]--><!--]--></a><!--]--><!--]--></li><li class="relative"><!--[--><a href="/team" class="group text-sm flex items-center gap-1.5 focus-visible:outline-primary text-muted hover:text-default transition-colors"><!--[--><!--[--><!--[--><!----><!--]--><span class="truncate"><!--[-->Team<!--]--><!----></span><!--[--><!--]--><!--]--><!--]--></a><!--]--></li><li class="relative"><!--[--><a href="/design-kit" class="group text-sm flex items-center gap-1.5 focus-visible:outline-primary text-muted hover:text-default transition-colors"><!--[--><!--[--><!--[--><!----><!--]--><span class="truncate"><!--[-->Design Kit<!--]--><!----></span><!--[--><!--]--><!--]--><!--]--></a><!--]--></li><!--]--></ul></div><div><h3 class="text-sm font-semibold">Products</h3><ul class="mt-6 space-y-4"><!--[--><li class="relative"><!--[--><!--[--><a href="https://ui.nuxt.com/pro?utm_source=nuxt-website&amp;utm_medium=footer" rel="noopener noreferrer" target="_blank" class="group text-sm flex items-center gap-1.5 focus-visible:outline-primary text-muted hover:text-default transition-colors"><!--[--><!--[--><!--[--><!----><!--]--><span class="truncate"><!--[-->Nuxt UI Pro<!--]--><span class="iconify i-lucide:arrow-up-right size-3 absolute top-0 text-dimmed inline-block" aria-hidden="true" style=""></span></span><!--[--><!--]--><!--]--><!--]--></a><!--]--><!--]--></li><li class="relative"><!--[--><!--[--><a href="https://content.nuxt.com/studio/?utm_source=nuxt-website&amp;utm_medium=footer" rel="noopener noreferrer" target="_blank" class="group text-sm flex items-center gap-1.5 focus-visible:outline-primary text-muted hover:text-default transition-colors"><!--[--><!--[--><!--[--><!----><!--]--><span class="truncate"><!--[-->Nuxt Studio<!--]--><span class="iconify i-lucide:arrow-up-right size-3 absolute top-0 text-dimmed inline-block" aria-hidden="true" style=""></span></span><!--[--><!--]--><!--]--><!--]--></a><!--]--><!--]--></li><li class="relative"><!--[--><!--[--><a href="https://hub.nuxt.com/?utm_source=nuxt-website&amp;utm_medium=footer" rel="noopener noreferrer" target="_blank" class="group text-sm flex items-center gap-1.5 focus-visible:outline-primary text-muted hover:text-default transition-colors"><!--[--><!--[--><!--[--><!----><!--]--><span class="truncate"><!--[-->NuxtHub<!--]--><span class="iconify i-lucide:arrow-up-right size-3 absolute top-0 text-dimmed inline-block" aria-hidden="true" style=""></span></span><!--[--><!--]--><!--]--><!--]--></a><!--]--><!--]--></li><!--]--></ul></div><div><h3 class="text-sm font-semibold">Enterprise</h3><ul class="mt-6 space-y-4"><!--[--><li class="relative"><!--[--><a href="/enterprise/support" class="group text-sm flex items-center gap-1.5 focus-visible:outline-primary text-muted hover:text-default transition-colors"><!--[--><!--[--><!--[--><!----><!--]--><span class="truncate"><!--[-->Support<!--]--><!----></span><!--[--><!--]--><!--]--><!--]--></a><!--]--></li><li class="relative"><!--[--><a href="/enterprise/agencies" class="group text-sm flex items-center gap-1.5 focus-visible:outline-primary text-muted hover:text-default transition-colors"><!--[--><!--[--><!--[--><!----><!--]--><span class="truncate"><!--[-->Agencies<!--]--><!----></span><!--[--><!--]--><!--]--><!--]--></a><!--]--></li><li class="relative"><!--[--><a href="/enterprise/sponsors" class="group text-sm flex items-center gap-1.5 focus-visible:outline-primary text-muted hover:text-default transition-colors"><!--[--><!--[--><!--[--><!----><!--]--><span class="truncate"><!--[-->Sponsors<!--]--><!----></span><!--[--><!--]--><!--]--><!--]--></a><!--]--></li><!--]--></ul></div><!--]--><!--]--></div><div class="mt-10 xl:mt-0"><!--[--><form id="v-0-4"><!--[--><div class="text-sm"><div class=""><div class="flex content-center items-center justify-between"><label for="v-0-5" class="block text-default font-semibold"><!--[--><!--[-->Subscribe to our newsletter<!--]--><!--]--></label><!----></div><p id="v-0-5-description" class="text-muted"><!--[-->Stay updated on new releases and features, guides, and community updates.<!--]--></p></div><div class="relative mt-3"><!--[--><div class="relative inline-flex items-center max-w-sm w-full"><input id="v-0-5" type="email" value="" name="email" placeholder="you@domain.com" class="w-full rounded-md border-0 placeholder:text-dimmed focus:outline-none disabled:cursor-not-allowed disabled:opacity-75 transition-colors px-3 py-2 text-sm gap-2 text-highlighted bg-default ring ring-inset ring-accented focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary pe-10" required="" autocomplete="off" aria-describedby="v-0-5-description" aria-invalid="false"><!--[--><!--]--><!----><div data-lastpass-icon-root="" style="position: relative !important; height: 0px !important; width: 0px !important; float: left !important;"></div><span class="absolute inset-y-0 end-0 flex items-center pe-3"><!--[--><!--[--><!--[--><button type="submit" class="rounded-md font-medium inline-flex items-center disabled:cursor-not-allowed aria-disabled:cursor-not-allowed disabled:opacity-75 aria-disabled:opacity-75 transition-colors px-2 py-1 text-xs gap-1 text-inverted bg-inverted hover:bg-inverted/90 disabled:bg-inverted aria-disabled:bg-inverted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-inverted"><!--[--><!--[--><!----><!--]--><!--[--><span class="truncate">Subscribe</span><!--]--><!--[--><!----><!--]--><!--]--></button><!--]--><!--]--><!--]--></span></div><!--]--><!----></div></div><!--]--></form><!--]--></div></nav><!--]--></div><!--]--></div><div class="w-full max-w-(--ui-container) mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-4 lg:flex lg:items-center lg:justify-between lg:gap-x-3"><!--[--><div class="lg:flex-1 flex items-center justify-center lg:justify-end gap-x-1.5 lg:order-3"><!--[--><!--[--><!--[--><a href="https://go.nuxt.com/x" rel="noopener noreferrer" target="_blank" class="rounded-md font-medium inline-flex items-center disabled:cursor-not-allowed aria-disabled:cursor-not-allowed disabled:opacity-75 aria-disabled:opacity-75 transition-colors px-2.5 py-1.5 text-sm gap-1.5 text-default hover:bg-elevated focus:outline-none focus-visible:bg-elevated hover:disabled:bg-transparent dark:hover:disabled:bg-transparent hover:aria-disabled:bg-transparent dark:hover:aria-disabled:bg-transparent"><!--[--><!--[--><span class="iconify i-simple-icons:x shrink-0 size-5" aria-hidden="true" style=""></span><!--]--><!--[--><span class="sr-only">Nuxt on X</span><!--]--><!--[--><!----><!--]--><!--]--></a><!--]--><!--]--><!--[--><!--[--><a href="https://go.nuxt.com/bluesky" rel="noopener noreferrer" target="_blank" class="rounded-md font-medium inline-flex items-center disabled:cursor-not-allowed aria-disabled:cursor-not-allowed disabled:opacity-75 aria-disabled:opacity-75 transition-colors px-2.5 py-1.5 text-sm gap-1.5 text-default hover:bg-elevated focus:outline-none focus-visible:bg-elevated hover:disabled:bg-transparent dark:hover:disabled:bg-transparent hover:aria-disabled:bg-transparent dark:hover:aria-disabled:bg-transparent"><!--[--><!--[--><span class="iconify i-simple-icons:bluesky shrink-0 size-5" aria-hidden="true" style=""></span><!--]--><!--[--><span class="sr-only">Nuxt on BlueSky</span><!--]--><!--[--><!----><!--]--><!--]--></a><!--]--><!--]--><!--[--><!--[--><a href="https://go.nuxt.com/linkedin" rel="noopener noreferrer" target="_blank" class="rounded-md font-medium inline-flex items-center disabled:cursor-not-allowed aria-disabled:cursor-not-allowed disabled:opacity-75 aria-disabled:opacity-75 transition-colors px-2.5 py-1.5 text-sm gap-1.5 text-default hover:bg-elevated focus:outline-none focus-visible:bg-elevated hover:disabled:bg-transparent dark:hover:disabled:bg-transparent hover:aria-disabled:bg-transparent dark:hover:aria-disabled:bg-transparent"><!--[--><!--[--><span class="iconify i-simple-icons:linkedin shrink-0 size-5" aria-hidden="true" style=""></span><!--]--><!--[--><span class="sr-only">Nuxt on LinkedIn</span><!--]--><!--[--><!----><!--]--><!--]--></a><!--]--><!--]--><!--[--><!--[--><a href="https://go.nuxt.com/discord" rel="noopener noreferrer" target="_blank" class="rounded-md font-medium inline-flex items-center disabled:cursor-not-allowed aria-disabled:cursor-not-allowed disabled:opacity-75 aria-disabled:opacity-75 transition-colors px-2.5 py-1.5 text-sm gap-1.5 text-default hover:bg-elevated focus:outline-none focus-visible:bg-elevated hover:disabled:bg-transparent dark:hover:disabled:bg-transparent hover:aria-disabled:bg-transparent dark:hover:aria-disabled:bg-transparent"><!--[--><!--[--><span class="iconify i-simple-icons:discord shrink-0 size-5" aria-hidden="true" style=""></span><!--]--><!--[--><span class="sr-only">Nuxt on Discord</span><!--]--><!--[--><!----><!--]--><!--]--></a><!--]--><!--]--><!--[--><!--[--><a href="https://go.nuxt.com/github" rel="noopener noreferrer" target="_blank" class="rounded-md font-medium inline-flex items-center disabled:cursor-not-allowed aria-disabled:cursor-not-allowed disabled:opacity-75 aria-disabled:opacity-75 transition-colors px-2.5 py-1.5 text-sm gap-1.5 text-default hover:bg-elevated focus:outline-none focus-visible:bg-elevated hover:disabled:bg-transparent dark:hover:disabled:bg-transparent hover:aria-disabled:bg-transparent dark:hover:aria-disabled:bg-transparent"><!--[--><!--[--><span class="iconify i-simple-icons:github shrink-0 size-5" aria-hidden="true" style=""></span><!--]--><!--[--><span class="sr-only">Nuxt on GitHub</span><!--]--><!--[--><!----><!--]--><!--]--></a><!--]--><!--]--><!--]--></div><div class="mt-3 lg:mt-0 lg:order-2 flex items-center justify-center"><!--[--><!--]--></div><div class="flex items-center justify-center lg:justify-start lg:flex-1 gap-x-1.5 mt-3 lg:mt-0 lg:order-1"><!--[--><p class="text-muted text-sm"> Copyright © 2016-2025 Nuxt - <a href="https://go.nuxt.com/license" rel="noopener noreferrer" target="_blank" class="hover:underline"> MIT License </a></p><!--]--></div><!--]--></div><!----></footer></div><span>foo</span></span></div></body></html>`
    const markdown = syncHtmlToMarkdown(html, {
      plugins: [
        filterPlugin({
          exclude: [
            'footer',
          ],
        }),
      ],
    })
    expect(markdown).toContain('# foo bar')
    expect(markdown).toContain('foo')
  })
})
