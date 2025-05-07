import { describe, expect, it } from 'vitest'
import { syncHtmlToMarkdown } from '../../../src'

describe('nav', () => {
  it('github', () => {
    const html = `<nav aria-label="Product sidebar" class="NavList__NavBox-sc-1c8ygf7-0">
                <ul class="List__ListBox-sc-1x7olzq-0 gAwGiF">
                  <li aria-labelledby=":R3b6n6:" class="Box-sc-g0xbh4-0 bvBlwX">
                    <button tabindex="0" aria-labelledby=":R3b6n6:--label " id=":R3b6n6:" aria-expanded="false"
                            aria-controls=":R3b6n6H1:" class="Item__LiBox-sc-yeql7o-0 islioC">
                      <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX">
                        <div class="Box-sc-g0xbh4-0 cAMcRf"><span id=":R3b6n6:--label" class="Box-sc-g0xbh4-0 hczSex">Start your journey</span><span
                          class="Box-sc-g0xbh4-0 dtMwwS"><svg sx="[object Object]" aria-hidden="true" focusable="false"
                                                              class="octicon octicon-chevron-down Octicon-sc-9kayk9-0 bAQrwU"
                                                              viewBox="0 0 16 16" width="16" height="16"
                                                              fill="currentColor" display="inline-block"
                                                              overflow="visible" style="vertical-align:text-bottom"><path
                          d="M12.78 5.22a.749.749 0 0 1 0 1.06l-4.25 4.25a.749.749 0 0 1-1.06 0L3.22 6.28a.749.749 0 1 1 1.06-1.06L8 8.939l3.72-3.719a.749.749 0 0 1 1.06 0Z"></path></svg></span>
                        </div>
                      </div>
                    </button>
                    <div>
                      <ul id=":R3b6n6H1:" aria-labelledby=":R3b6n6:" class="Box-sc-g0xbh4-0 fyTuJZ">
                        <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                      aria-labelledby=":R1l3b6n6:--label "
                                                                      id=":R1l3b6n6:" aria-current="false"
                                                                      class="Link__StyledLink-sc-14289xe-0 icZieg"
                                                                      href="/en/get-started/start-your-journey/about-github-and-git">
                          <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX"><span
                            id=":R1l3b6n6:--label" class="Box-sc-g0xbh4-0 hczSex">About GitHub and Git</span></div>
                        </a></li>
                        <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                      aria-labelledby=":R2l3b6n6:--label "
                                                                      id=":R2l3b6n6:" aria-current="false"
                                                                      class="Link__StyledLink-sc-14289xe-0 icZieg"
                                                                      href="/en/get-started/start-your-journey/creating-an-account-on-github">
                          <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX"><span
                            id=":R2l3b6n6:--label" class="Box-sc-g0xbh4-0 hczSex">Create an account</span></div>
                        </a></li>
                        <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                      aria-labelledby=":R3l3b6n6:--label "
                                                                      id=":R3l3b6n6:" aria-current="false"
                                                                      class="Link__StyledLink-sc-14289xe-0 icZieg"
                                                                      href="/en/get-started/start-your-journey/hello-world">
                          <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX"><span
                            id=":R3l3b6n6:--label" class="Box-sc-g0xbh4-0 hczSex">Hello World</span></div>
                        </a></li>
                        <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                      aria-labelledby=":R4l3b6n6:--label "
                                                                      id=":R4l3b6n6:" aria-current="false"
                                                                      class="Link__StyledLink-sc-14289xe-0 icZieg"
                                                                      href="/en/get-started/start-your-journey/setting-up-your-profile">
                          <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX"><span
                            id=":R4l3b6n6:--label" class="Box-sc-g0xbh4-0 hczSex">Set up your profile</span></div>
                        </a></li>
                        <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                      aria-labelledby=":R5l3b6n6:--label "
                                                                      id=":R5l3b6n6:" aria-current="false"
                                                                      class="Link__StyledLink-sc-14289xe-0 icZieg"
                                                                      href="/en/get-started/start-your-journey/finding-inspiration-on-github">
                          <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX"><span
                            id=":R5l3b6n6:--label" class="Box-sc-g0xbh4-0 hczSex">Find inspiration</span></div>
                        </a></li>
                        <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                      aria-labelledby=":R6l3b6n6:--label "
                                                                      id=":R6l3b6n6:" aria-current="false"
                                                                      class="Link__StyledLink-sc-14289xe-0 icZieg"
                                                                      href="/en/get-started/start-your-journey/downloading-files-from-github">
                          <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX"><span
                            id=":R6l3b6n6:--label" class="Box-sc-g0xbh4-0 hczSex">Download files</span></div>
                        </a></li>
                        <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                      aria-labelledby=":R7l3b6n6:--label "
                                                                      id=":R7l3b6n6:" aria-current="false"
                                                                      class="Link__StyledLink-sc-14289xe-0 icZieg"
                                                                      href="/en/get-started/start-your-journey/uploading-a-project-to-github">
                          <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX"><span
                            id=":R7l3b6n6:--label" class="Box-sc-g0xbh4-0 hczSex">Upload a project</span></div>
                        </a></li>
                        <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                      aria-labelledby=":R8l3b6n6:--label "
                                                                      id=":R8l3b6n6:" aria-current="false"
                                                                      class="Link__StyledLink-sc-14289xe-0 icZieg"
                                                                      href="/en/get-started/start-your-journey/git-and-github-learning-resources">
                          <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX"><span
                            id=":R8l3b6n6:--label" class="Box-sc-g0xbh4-0 hczSex">Learning resources</span></div>
                        </a></li>
                      </ul>
                    </div>
                  </li>
                  <li aria-labelledby=":R5b6n6:" class="Box-sc-g0xbh4-0 bvBlwX">
                    <button tabindex="0" aria-labelledby=":R5b6n6:--label " id=":R5b6n6:" aria-expanded="false"
                            aria-controls=":R5b6n6H1:" class="Item__LiBox-sc-yeql7o-0 islioC">
                      <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX">
                        <div class="Box-sc-g0xbh4-0 cAMcRf"><span id=":R5b6n6:--label" class="Box-sc-g0xbh4-0 hczSex">Onboarding</span><span
                          class="Box-sc-g0xbh4-0 dtMwwS"><svg sx="[object Object]" aria-hidden="true" focusable="false"
                                                              class="octicon octicon-chevron-down Octicon-sc-9kayk9-0 bAQrwU"
                                                              viewBox="0 0 16 16" width="16" height="16"
                                                              fill="currentColor" display="inline-block"
                                                              overflow="visible" style="vertical-align:text-bottom"><path
                          d="M12.78 5.22a.749.749 0 0 1 0 1.06l-4.25 4.25a.749.749 0 0 1-1.06 0L3.22 6.28a.749.749 0 1 1 1.06-1.06L8 8.939l3.72-3.719a.749.749 0 0 1 1.06 0Z"></path></svg></span>
                        </div>
                      </div>
                    </button>
                    <div>
                      <ul id=":R5b6n6H1:" aria-labelledby=":R5b6n6:" class="Box-sc-g0xbh4-0 fyTuJZ">
                        <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                      aria-labelledby=":R1l5b6n6:--label "
                                                                      id=":R1l5b6n6:" aria-current="false"
                                                                      class="Link__StyledLink-sc-14289xe-0 icZieg"
                                                                      href="/en/get-started/onboarding/getting-started-with-your-github-account">
                          <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX"><span
                            id=":R1l5b6n6:--label" class="Box-sc-g0xbh4-0 hczSex">Getting started with your GitHub account</span>
                          </div>
                        </a></li>
                        <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                      aria-labelledby=":R2l5b6n6:--label "
                                                                      id=":R2l5b6n6:" aria-current="false"
                                                                      class="Link__StyledLink-sc-14289xe-0 icZieg"
                                                                      href="/en/get-started/onboarding/getting-started-with-github-team">
                          <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX"><span
                            id=":R2l5b6n6:--label"
                            class="Box-sc-g0xbh4-0 hczSex">Getting started with GitHub Team</span></div>
                        </a></li>
                        <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                      aria-labelledby=":R3l5b6n6:--label "
                                                                      id=":R3l5b6n6:" aria-current="false"
                                                                      class="Link__StyledLink-sc-14289xe-0 icZieg"
                                                                      href="/en/get-started/onboarding/getting-started-with-the-github-enterprise-cloud-trial">
                          <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX"><span
                            id=":R3l5b6n6:--label" class="Box-sc-g0xbh4-0 hczSex">Getting started with the GitHub Enterprise Cloud trial</span>
                          </div>
                        </a></li>
                        <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                      aria-labelledby=":R4l5b6n6:--label "
                                                                      id=":R4l5b6n6:" aria-current="false"
                                                                      class="Link__StyledLink-sc-14289xe-0 icZieg"
                                                                      href="/en/get-started/onboarding/getting-started-with-github-enterprise-cloud">
                          <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX"><span
                            id=":R4l5b6n6:--label" class="Box-sc-g0xbh4-0 hczSex">Getting started with GitHub Enterprise Cloud</span>
                          </div>
                        </a></li>
                      </ul>
                    </div>
                  </li>
                  <li aria-labelledby=":R7b6n6:" class="Box-sc-g0xbh4-0 bvBlwX">
                    <button tabindex="0" aria-labelledby=":R7b6n6:--label " id=":R7b6n6:" aria-expanded="false"
                            aria-controls=":R7b6n6H1:" class="Item__LiBox-sc-yeql7o-0 islioC">
                      <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX">
                        <div class="Box-sc-g0xbh4-0 cAMcRf"><span id=":R7b6n6:--label" class="Box-sc-g0xbh4-0 hczSex">Using GitHub</span><span
                          class="Box-sc-g0xbh4-0 dtMwwS"><svg sx="[object Object]" aria-hidden="true" focusable="false"
                                                              class="octicon octicon-chevron-down Octicon-sc-9kayk9-0 bAQrwU"
                                                              viewBox="0 0 16 16" width="16" height="16"
                                                              fill="currentColor" display="inline-block"
                                                              overflow="visible" style="vertical-align:text-bottom"><path
                          d="M12.78 5.22a.749.749 0 0 1 0 1.06l-4.25 4.25a.749.749 0 0 1-1.06 0L3.22 6.28a.749.749 0 1 1 1.06-1.06L8 8.939l3.72-3.719a.749.749 0 0 1 1.06 0Z"></path></svg></span>
                        </div>
                      </div>
                    </button>
                    <div>
                      <ul id=":R7b6n6H1:" aria-labelledby=":R7b6n6:" class="Box-sc-g0xbh4-0 fyTuJZ">
                        <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                      aria-labelledby=":R1l7b6n6:--label "
                                                                      id=":R1l7b6n6:" aria-current="false"
                                                                      class="Link__StyledLink-sc-14289xe-0 icZieg"
                                                                      href="/en/get-started/using-github/github-flow">
                          <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX"><span
                            id=":R1l7b6n6:--label" class="Box-sc-g0xbh4-0 hczSex">GitHub flow</span></div>
                        </a></li>
                        <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                      aria-labelledby=":R2l7b6n6:--label "
                                                                      id=":R2l7b6n6:" aria-current="false"
                                                                      class="Link__StyledLink-sc-14289xe-0 icZieg"
                                                                      href="/en/get-started/using-github/connecting-to-github">
                          <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX"><span
                            id=":R2l7b6n6:--label" class="Box-sc-g0xbh4-0 hczSex">Connecting to GitHub</span></div>
                        </a></li>
                        <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                      aria-labelledby=":R3l7b6n6:--label "
                                                                      id=":R3l7b6n6:" aria-current="false"
                                                                      class="Link__StyledLink-sc-14289xe-0 icZieg"
                                                                      href="/en/get-started/using-github/communicating-on-github">
                          <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX"><span
                            id=":R3l7b6n6:--label" class="Box-sc-g0xbh4-0 hczSex">Communicating on GitHub</span></div>
                        </a></li>
                        <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                      aria-labelledby=":R4l7b6n6:--label "
                                                                      id=":R4l7b6n6:" aria-current="false"
                                                                      class="Link__StyledLink-sc-14289xe-0 icZieg"
                                                                      href="/en/get-started/using-github/exploring-early-access-releases-with-feature-preview">
                          <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX"><span
                            id=":R4l7b6n6:--label" class="Box-sc-g0xbh4-0 hczSex">Feature preview</span></div>
                        </a></li>
                        <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                      aria-labelledby=":R5l7b6n6:--label "
                                                                      id=":R5l7b6n6:" aria-current="false"
                                                                      class="Link__StyledLink-sc-14289xe-0 icZieg"
                                                                      href="/en/get-started/using-github/supported-browsers">
                          <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX"><span
                            id=":R5l7b6n6:--label" class="Box-sc-g0xbh4-0 hczSex">Supported browsers</span></div>
                        </a></li>
                        <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                      aria-labelledby=":R6l7b6n6:--label "
                                                                      id=":R6l7b6n6:" aria-current="false"
                                                                      class="Link__StyledLink-sc-14289xe-0 icZieg"
                                                                      href="/en/get-started/using-github/github-mobile">
                          <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX"><span
                            id=":R6l7b6n6:--label" class="Box-sc-g0xbh4-0 hczSex">GitHub Mobile</span></div>
                        </a></li>
                        <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                      aria-labelledby=":R7l7b6n6:--label "
                                                                      id=":R7l7b6n6:" aria-current="false"
                                                                      class="Link__StyledLink-sc-14289xe-0 icZieg"
                                                                      href="/en/get-started/using-github/allowing-access-to-githubs-services-from-a-restricted-network">
                          <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX"><span
                            id=":R7l7b6n6:--label" class="Box-sc-g0xbh4-0 hczSex">Allow network access</span></div>
                        </a></li>
                        <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                      aria-labelledby=":R8l7b6n6:--label "
                                                                      id=":R8l7b6n6:" aria-current="false"
                                                                      class="Link__StyledLink-sc-14289xe-0 icZieg"
                                                                      href="/en/get-started/using-github/troubleshooting-connectivity-problems">
                          <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX"><span
                            id=":R8l7b6n6:--label" class="Box-sc-g0xbh4-0 hczSex">Connectivity problems</span></div>
                        </a></li>
                      </ul>
                    </div>
                  </li>
                  <li aria-labelledby=":R9b6n6:" class="Box-sc-g0xbh4-0 bvBlwX">
                    <button tabindex="0" aria-labelledby=":R9b6n6:--label " id=":R9b6n6:" aria-expanded="false"
                            aria-controls=":R9b6n6H1:" class="Item__LiBox-sc-yeql7o-0 islioC">
                      <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX">
                        <div class="Box-sc-g0xbh4-0 cAMcRf"><span id=":R9b6n6:--label" class="Box-sc-g0xbh4-0 hczSex">Learning about GitHub</span><span
                          class="Box-sc-g0xbh4-0 dtMwwS"><svg sx="[object Object]" aria-hidden="true" focusable="false"
                                                              class="octicon octicon-chevron-down Octicon-sc-9kayk9-0 bAQrwU"
                                                              viewBox="0 0 16 16" width="16" height="16"
                                                              fill="currentColor" display="inline-block"
                                                              overflow="visible" style="vertical-align:text-bottom"><path
                          d="M12.78 5.22a.749.749 0 0 1 0 1.06l-4.25 4.25a.749.749 0 0 1-1.06 0L3.22 6.28a.749.749 0 1 1 1.06-1.06L8 8.939l3.72-3.719a.749.749 0 0 1 1.06 0Z"></path></svg></span>
                        </div>
                      </div>
                    </button>
                    <div>
                      <ul id=":R9b6n6H1:" aria-labelledby=":R9b6n6:" class="Box-sc-g0xbh4-0 fyTuJZ">
                        <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                      aria-labelledby=":R1l9b6n6:--label "
                                                                      id=":R1l9b6n6:" aria-current="false"
                                                                      class="Link__StyledLink-sc-14289xe-0 icZieg"
                                                                      href="/en/get-started/learning-about-github/githubs-plans">
                          <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX"><span
                            id=":R1l9b6n6:--label" class="Box-sc-g0xbh4-0 hczSex">GitHub’s plans</span></div>
                        </a></li>
                        <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                      aria-labelledby=":R2l9b6n6:--label "
                                                                      id=":R2l9b6n6:" aria-current="false"
                                                                      class="Link__StyledLink-sc-14289xe-0 icZieg"
                                                                      href="/en/get-started/learning-about-github/github-language-support">
                          <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX"><span
                            id=":R2l9b6n6:--label" class="Box-sc-g0xbh4-0 hczSex">GitHub language support</span></div>
                        </a></li>
                        <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                      aria-labelledby=":R3l9b6n6:--label "
                                                                      id=":R3l9b6n6:" aria-current="false"
                                                                      class="Link__StyledLink-sc-14289xe-0 icZieg"
                                                                      href="/en/get-started/learning-about-github/types-of-github-accounts">
                          <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX"><span
                            id=":R3l9b6n6:--label" class="Box-sc-g0xbh4-0 hczSex">Types of GitHub accounts</span></div>
                        </a></li>
                        <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                      aria-labelledby=":R4l9b6n6:--label "
                                                                      id=":R4l9b6n6:" aria-current="false"
                                                                      class="Link__StyledLink-sc-14289xe-0 icZieg"
                                                                      href="/en/get-started/learning-about-github/access-permissions-on-github">
                          <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX"><span
                            id=":R4l9b6n6:--label" class="Box-sc-g0xbh4-0 hczSex">Access permissions</span></div>
                        </a></li>
                        <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                      aria-labelledby=":R5l9b6n6:--label "
                                                                      id=":R5l9b6n6:" aria-current="false"
                                                                      class="Link__StyledLink-sc-14289xe-0 icZieg"
                                                                      href="/en/get-started/learning-about-github/about-github-advanced-security">
                          <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX"><span
                            id=":R5l9b6n6:--label" class="Box-sc-g0xbh4-0 hczSex">GitHub Advanced Security</span></div>
                        </a></li>
                        <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                      aria-labelledby=":R6l9b6n6:--label "
                                                                      id=":R6l9b6n6:" aria-current="false"
                                                                      class="Link__StyledLink-sc-14289xe-0 icZieg"
                                                                      href="/en/get-started/learning-about-github/faq-about-changes-to-githubs-plans">
                          <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX"><span
                            id=":R6l9b6n6:--label" class="Box-sc-g0xbh4-0 hczSex">Changes to GitHub plans</span></div>
                        </a></li>
                        <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                      aria-labelledby=":R7l9b6n6:--label "
                                                                      id=":R7l9b6n6:" aria-current="false"
                                                                      class="Link__StyledLink-sc-14289xe-0 icZieg"
                                                                      href="/en/get-started/learning-about-github/github-glossary">
                          <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX"><span
                            id=":R7l9b6n6:--label" class="Box-sc-g0xbh4-0 hczSex">GitHub glossary</span></div>
                        </a></li>
                      </ul>
                    </div>
                  </li>
                  <li aria-labelledby=":Rbb6n6:" class="Box-sc-g0xbh4-0 bvBlwX">
                    <button tabindex="0" aria-labelledby=":Rbb6n6:--label " id=":Rbb6n6:" aria-expanded="false"
                            aria-controls=":Rbb6n6H1:" class="Item__LiBox-sc-yeql7o-0 islioC">
                      <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX">
                        <div class="Box-sc-g0xbh4-0 cAMcRf"><span id=":Rbb6n6:--label" class="Box-sc-g0xbh4-0 hczSex">Learn to code</span><span
                          class="Box-sc-g0xbh4-0 dtMwwS"><svg sx="[object Object]" aria-hidden="true" focusable="false"
                                                              class="octicon octicon-chevron-down Octicon-sc-9kayk9-0 bAQrwU"
                                                              viewBox="0 0 16 16" width="16" height="16"
                                                              fill="currentColor" display="inline-block"
                                                              overflow="visible" style="vertical-align:text-bottom"><path
                          d="M12.78 5.22a.749.749 0 0 1 0 1.06l-4.25 4.25a.749.749 0 0 1-1.06 0L3.22 6.28a.749.749 0 1 1 1.06-1.06L8 8.939l3.72-3.719a.749.749 0 0 1 1.06 0Z"></path></svg></span>
                        </div>
                      </div>
                    </button>
                    <div>
                      <ul id=":Rbb6n6H1:" aria-labelledby=":Rbb6n6:" class="Box-sc-g0xbh4-0 fyTuJZ">
                        <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                      aria-labelledby=":R1lbb6n6:--label "
                                                                      id=":R1lbb6n6:" aria-current="false"
                                                                      class="Link__StyledLink-sc-14289xe-0 icZieg"
                                                                      href="/en/get-started/learning-to-code/getting-started-with-git">
                          <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX"><span
                            id=":R1lbb6n6:--label" class="Box-sc-g0xbh4-0 hczSex">Get started with Git</span></div>
                        </a></li>
                        <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                      aria-labelledby=":R2lbb6n6:--label "
                                                                      id=":R2lbb6n6:" aria-current="false"
                                                                      class="Link__StyledLink-sc-14289xe-0 icZieg"
                                                                      href="/en/get-started/learning-to-code/finding-and-understanding-example-code">
                          <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX"><span
                            id=":R2lbb6n6:--label" class="Box-sc-g0xbh4-0 hczSex">Finding example code</span></div>
                        </a></li>
                        <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                      aria-labelledby=":R3lbb6n6:--label "
                                                                      id=":R3lbb6n6:" aria-current="false"
                                                                      class="Link__StyledLink-sc-14289xe-0 icZieg"
                                                                      href="/en/get-started/learning-to-code/reusing-other-peoples-code-in-your-projects">
                          <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX"><span
                            id=":R3lbb6n6:--label" class="Box-sc-g0xbh4-0 hczSex">Reuse people&#x27;s code</span></div>
                        </a></li>
                        <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                      aria-labelledby=":R4lbb6n6:--label "
                                                                      id=":R4lbb6n6:" aria-current="false"
                                                                      class="Link__StyledLink-sc-14289xe-0 icZieg"
                                                                      href="/en/get-started/learning-to-code/setting-up-copilot-for-learning-to-code">
                          <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX"><span
                            id=":R4lbb6n6:--label" class="Box-sc-g0xbh4-0 hczSex">Set up Copilot for learning</span>
                          </div>
                        </a></li>
                        <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                      aria-labelledby=":R5lbb6n6:--label "
                                                                      id=":R5lbb6n6:" aria-current="false"
                                                                      class="Link__StyledLink-sc-14289xe-0 icZieg"
                                                                      href="/en/get-started/learning-to-code/learning-to-debug-with-github-copilot">
                          <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX"><span
                            id=":R5lbb6n6:--label" class="Box-sc-g0xbh4-0 hczSex">Debug with Copilot</span></div>
                        </a></li>
                        <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                      aria-labelledby=":R6lbb6n6:--label "
                                                                      id=":R6lbb6n6:" aria-current="false"
                                                                      class="Link__StyledLink-sc-14289xe-0 icZieg"
                                                                      href="/en/get-started/learning-to-code/storing-your-secrets-safely">
                          <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX"><span
                            id=":R6lbb6n6:--label" class="Box-sc-g0xbh4-0 hczSex">Storing secrets safely</span></div>
                        </a></li>
                      </ul>
                    </div>
                  </li>
                  <li aria-labelledby=":Rdb6n6:" class="Box-sc-g0xbh4-0 bvBlwX">
                    <button tabindex="0" aria-labelledby=":Rdb6n6:--label " id=":Rdb6n6:" aria-expanded="false"
                            aria-controls=":Rdb6n6H1:" class="Item__LiBox-sc-yeql7o-0 islioC">
                      <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX">
                        <div class="Box-sc-g0xbh4-0 cAMcRf"><span id=":Rdb6n6:--label" class="Box-sc-g0xbh4-0 hczSex">Accessibility</span><span
                          class="Box-sc-g0xbh4-0 dtMwwS"><svg sx="[object Object]" aria-hidden="true" focusable="false"
                                                              class="octicon octicon-chevron-down Octicon-sc-9kayk9-0 bAQrwU"
                                                              viewBox="0 0 16 16" width="16" height="16"
                                                              fill="currentColor" display="inline-block"
                                                              overflow="visible" style="vertical-align:text-bottom"><path
                          d="M12.78 5.22a.749.749 0 0 1 0 1.06l-4.25 4.25a.749.749 0 0 1-1.06 0L3.22 6.28a.749.749 0 1 1 1.06-1.06L8 8.939l3.72-3.719a.749.749 0 0 1 1.06 0Z"></path></svg></span>
                        </div>
                      </div>
                    </button>
                    <div>
                      <ul id=":Rdb6n6H1:" aria-labelledby=":Rdb6n6:" class="Box-sc-g0xbh4-0 fyTuJZ">
                        <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                      aria-labelledby=":R1ldb6n6:--label "
                                                                      id=":R1ldb6n6:" aria-current="false"
                                                                      class="Link__StyledLink-sc-14289xe-0 icZieg"
                                                                      href="/en/get-started/accessibility/managing-your-theme-settings">
                          <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX"><span
                            id=":R1ldb6n6:--label" class="Box-sc-g0xbh4-0 hczSex">Manage theme settings</span></div>
                        </a></li>
                        <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                      aria-labelledby=":R2ldb6n6:--label "
                                                                      id=":R2ldb6n6:" aria-current="false"
                                                                      class="Link__StyledLink-sc-14289xe-0 icZieg"
                                                                      href="/en/get-started/accessibility/keyboard-shortcuts">
                          <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX"><span
                            id=":R2ldb6n6:--label" class="Box-sc-g0xbh4-0 hczSex">Keyboard shortcuts</span></div>
                        </a></li>
                        <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                      aria-labelledby=":R3ldb6n6:--label "
                                                                      id=":R3ldb6n6:" aria-current="false"
                                                                      class="Link__StyledLink-sc-14289xe-0 icZieg"
                                                                      href="/en/get-started/accessibility/github-command-palette">
                          <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX"><span
                            id=":R3ldb6n6:--label" class="Box-sc-g0xbh4-0 hczSex">GitHub Command Palette</span></div>
                        </a></li>
                      </ul>
                    </div>
                  </li>
                  <li aria-labelledby=":Rfb6n6:" class="Box-sc-g0xbh4-0 bvBlwX">
                    <button tabindex="0" aria-labelledby=":Rfb6n6:--label " id=":Rfb6n6:" aria-expanded="true"
                            aria-controls=":Rfb6n6H1:" class="Item__LiBox-sc-yeql7o-0 islioC">
                      <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX">
                        <div class="Box-sc-g0xbh4-0 cAMcRf"><span id=":Rfb6n6:--label" class="Box-sc-g0xbh4-0 hczSex">Writing on GitHub</span><span
                          class="Box-sc-g0xbh4-0 dtMwwS"><svg sx="[object Object]" aria-hidden="true" focusable="false"
                                                              class="octicon octicon-chevron-down Octicon-sc-9kayk9-0 dIqbBZ"
                                                              viewBox="0 0 16 16" width="16" height="16"
                                                              fill="currentColor" display="inline-block"
                                                              overflow="visible" style="vertical-align:text-bottom"><path
                          d="M12.78 5.22a.749.749 0 0 1 0 1.06l-4.25 4.25a.749.749 0 0 1-1.06 0L3.22 6.28a.749.749 0 1 1 1.06-1.06L8 8.939l3.72-3.719a.749.749 0 0 1 1.06 0Z"></path></svg></span>
                        </div>
                      </div>
                    </button>
                    <div>
                      <ul id=":Rfb6n6H1:" aria-labelledby=":Rfb6n6:" class="Box-sc-g0xbh4-0 eugMGS">
                        <li aria-labelledby=":R1lfb6n6:" class="Box-sc-g0xbh4-0 bvBlwX">
                          <button tabindex="0" aria-labelledby=":R1lfb6n6:--label " id=":R1lfb6n6:" aria-expanded="true"
                                  aria-controls=":R1lfb6n6H1:" class="Item__LiBox-sc-yeql7o-0 dLSHEs">
                            <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX">
                              <div class="Box-sc-g0xbh4-0 cAMcRf"><span id=":R1lfb6n6:--label"
                                                                        class="Box-sc-g0xbh4-0 hczSex">Start writing on GitHub</span><span
                                class="Box-sc-g0xbh4-0 dtMwwS"><svg sx="[object Object]" aria-hidden="true"
                                                                    focusable="false"
                                                                    class="octicon octicon-chevron-down Octicon-sc-9kayk9-0 dIqbBZ"
                                                                    viewBox="0 0 16 16" width="16" height="16"
                                                                    fill="currentColor" display="inline-block"
                                                                    overflow="visible"
                                                                    style="vertical-align:text-bottom"><path
                                d="M12.78 5.22a.749.749 0 0 1 0 1.06l-4.25 4.25a.749.749 0 0 1-1.06 0L3.22 6.28a.749.749 0 1 1 1.06-1.06L8 8.939l3.72-3.719a.749.749 0 0 1 1.06 0Z"></path></svg></span>
                              </div>
                            </div>
                          </button>
                          <div>
                            <ul id=":R1lfb6n6H1:" aria-labelledby=":R1lfb6n6:" class="Box-sc-g0xbh4-0 eugMGS">
                              <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                            aria-labelledby=":Rd9lfb6n6:--label "
                                                                            id=":Rd9lfb6n6:" aria-current="false"
                                                                            class="Link__StyledLink-sc-14289xe-0 ddXiKh"
                                                                            href="/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/quickstart-for-writing-on-github">
                                <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX">
                                  <span id=":Rd9lfb6n6:--label" class="Box-sc-g0xbh4-0 hczSex">Quickstart</span></div>
                              </a></li>
                              <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                            aria-labelledby=":Rl9lfb6n6:--label "
                                                                            id=":Rl9lfb6n6:" aria-current="false"
                                                                            class="Link__StyledLink-sc-14289xe-0 ddXiKh"
                                                                            href="/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/about-writing-and-formatting-on-github">
                                <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX">
                                  <span id=":Rl9lfb6n6:--label" class="Box-sc-g0xbh4-0 hczSex">About writing &amp; formatting</span>
                                </div>
                              </a></li>
                              <li class="Item__LiBox-sc-yeql7o-0 Ma-Dhb"><a sx="[object Object]" tabindex="0"
                                                                            aria-labelledby=":Rt9lfb6n6:--label "
                                                                            id=":Rt9lfb6n6:" aria-current="page"
                                                                            class="Link__StyledLink-sc-14289xe-0 ddXiKh"
                                                                            href="/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax">
                                <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX">
                                  <span id=":Rt9lfb6n6:--label"
                                        class="Box-sc-g0xbh4-0 hkYzPb">Basic formatting syntax</span></div>
                              </a></li>
                            </ul>
                          </div>
                        </li>
                        <li aria-labelledby=":R2lfb6n6:" class="Box-sc-g0xbh4-0 bvBlwX">
                          <button tabindex="0" aria-labelledby=":R2lfb6n6:--label " id=":R2lfb6n6:"
                                  aria-expanded="false" aria-controls=":R2lfb6n6H1:"
                                  class="Item__LiBox-sc-yeql7o-0 dLSHEs">
                            <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX">
                              <div class="Box-sc-g0xbh4-0 cAMcRf"><span id=":R2lfb6n6:--label"
                                                                        class="Box-sc-g0xbh4-0 hczSex">Work with advanced formatting</span><span
                                class="Box-sc-g0xbh4-0 dtMwwS"><svg sx="[object Object]" aria-hidden="true"
                                                                    focusable="false"
                                                                    class="octicon octicon-chevron-down Octicon-sc-9kayk9-0 bAQrwU"
                                                                    viewBox="0 0 16 16" width="16" height="16"
                                                                    fill="currentColor" display="inline-block"
                                                                    overflow="visible"
                                                                    style="vertical-align:text-bottom"><path
                                d="M12.78 5.22a.749.749 0 0 1 0 1.06l-4.25 4.25a.749.749 0 0 1-1.06 0L3.22 6.28a.749.749 0 1 1 1.06-1.06L8 8.939l3.72-3.719a.749.749 0 0 1 1.06 0Z"></path></svg></span>
                              </div>
                            </div>
                          </button>
                          <div>
                            <ul id=":R2lfb6n6H1:" aria-labelledby=":R2lfb6n6:" class="Box-sc-g0xbh4-0 fyTuJZ">
                              <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                            aria-labelledby=":Rdalfb6n6:--label "
                                                                            id=":Rdalfb6n6:" aria-current="false"
                                                                            class="Link__StyledLink-sc-14289xe-0 ddXiKh"
                                                                            href="/en/get-started/writing-on-github/working-with-advanced-formatting/organizing-information-with-tables">
                                <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX">
                                  <span id=":Rdalfb6n6:--label" class="Box-sc-g0xbh4-0 hczSex">Organized data with tables</span>
                                </div>
                              </a></li>
                              <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                            aria-labelledby=":Rlalfb6n6:--label "
                                                                            id=":Rlalfb6n6:" aria-current="false"
                                                                            class="Link__StyledLink-sc-14289xe-0 ddXiKh"
                                                                            href="/en/get-started/writing-on-github/working-with-advanced-formatting/organizing-information-with-collapsed-sections">
                                <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX">
                                  <span id=":Rlalfb6n6:--label" class="Box-sc-g0xbh4-0 hczSex">Collapsed sections</span>
                                </div>
                              </a></li>
                              <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                            aria-labelledby=":Rtalfb6n6:--label "
                                                                            id=":Rtalfb6n6:" aria-current="false"
                                                                            class="Link__StyledLink-sc-14289xe-0 ddXiKh"
                                                                            href="/en/get-started/writing-on-github/working-with-advanced-formatting/creating-and-highlighting-code-blocks">
                                <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX">
                                  <span id=":Rtalfb6n6:--label" class="Box-sc-g0xbh4-0 hczSex">Create code blocks</span>
                                </div>
                              </a></li>
                              <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                            aria-labelledby=":R15alfb6n6:--label "
                                                                            id=":R15alfb6n6:" aria-current="false"
                                                                            class="Link__StyledLink-sc-14289xe-0 ddXiKh"
                                                                            href="/en/get-started/writing-on-github/working-with-advanced-formatting/creating-diagrams">
                                <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX">
                                  <span id=":R15alfb6n6:--label" class="Box-sc-g0xbh4-0 hczSex">Create diagrams</span>
                                </div>
                              </a></li>
                              <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                            aria-labelledby=":R1dalfb6n6:--label "
                                                                            id=":R1dalfb6n6:" aria-current="false"
                                                                            class="Link__StyledLink-sc-14289xe-0 ddXiKh"
                                                                            href="/en/get-started/writing-on-github/working-with-advanced-formatting/writing-mathematical-expressions">
                                <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX">
                                  <span id=":R1dalfb6n6:--label"
                                        class="Box-sc-g0xbh4-0 hczSex">Mathematical expressions</span></div>
                              </a></li>
                              <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                            aria-labelledby=":R1lalfb6n6:--label "
                                                                            id=":R1lalfb6n6:" aria-current="false"
                                                                            class="Link__StyledLink-sc-14289xe-0 ddXiKh"
                                                                            href="/en/get-started/writing-on-github/working-with-advanced-formatting/autolinked-references-and-urls">
                                <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX">
                                  <span id=":R1lalfb6n6:--label"
                                        class="Box-sc-g0xbh4-0 hczSex">Auto linked references</span></div>
                              </a></li>
                              <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                            aria-labelledby=":R1talfb6n6:--label "
                                                                            id=":R1talfb6n6:" aria-current="false"
                                                                            class="Link__StyledLink-sc-14289xe-0 ddXiKh"
                                                                            href="/en/get-started/writing-on-github/working-with-advanced-formatting/attaching-files">
                                <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX">
                                  <span id=":R1talfb6n6:--label" class="Box-sc-g0xbh4-0 hczSex">Attaching files</span>
                                </div>
                              </a></li>
                              <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                            aria-labelledby=":R25alfb6n6:--label "
                                                                            id=":R25alfb6n6:" aria-current="false"
                                                                            class="Link__StyledLink-sc-14289xe-0 ddXiKh"
                                                                            href="/en/get-started/writing-on-github/working-with-advanced-formatting/about-task-lists">
                                <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX">
                                  <span id=":R25alfb6n6:--label" class="Box-sc-g0xbh4-0 hczSex">About task lists</span>
                                </div>
                              </a></li>
                              <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                            aria-labelledby=":R2dalfb6n6:--label "
                                                                            id=":R2dalfb6n6:" aria-current="false"
                                                                            class="Link__StyledLink-sc-14289xe-0 ddXiKh"
                                                                            href="/en/get-started/writing-on-github/working-with-advanced-formatting/creating-a-permanent-link-to-a-code-snippet">
                                <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX">
                                  <span id=":R2dalfb6n6:--label"
                                        class="Box-sc-g0xbh4-0 hczSex">Permanent links to code</span></div>
                              </a></li>
                              <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                            aria-labelledby=":R2lalfb6n6:--label "
                                                                            id=":R2lalfb6n6:" aria-current="false"
                                                                            class="Link__StyledLink-sc-14289xe-0 ddXiKh"
                                                                            href="/en/get-started/writing-on-github/working-with-advanced-formatting/using-keywords-in-issues-and-pull-requests">
                                <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX">
                                  <span id=":R2lalfb6n6:--label" class="Box-sc-g0xbh4-0 hczSex">Using keywords in issues and pull requests</span>
                                </div>
                              </a></li>
                            </ul>
                          </div>
                        </li>
                        <li aria-labelledby=":R3lfb6n6:" class="Box-sc-g0xbh4-0 bvBlwX">
                          <button tabindex="0" aria-labelledby=":R3lfb6n6:--label " id=":R3lfb6n6:"
                                  aria-expanded="false" aria-controls=":R3lfb6n6H1:"
                                  class="Item__LiBox-sc-yeql7o-0 dLSHEs">
                            <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX">
                              <div class="Box-sc-g0xbh4-0 cAMcRf"><span id=":R3lfb6n6:--label"
                                                                        class="Box-sc-g0xbh4-0 hczSex">Work with saved replies</span><span
                                class="Box-sc-g0xbh4-0 dtMwwS"><svg sx="[object Object]" aria-hidden="true"
                                                                    focusable="false"
                                                                    class="octicon octicon-chevron-down Octicon-sc-9kayk9-0 bAQrwU"
                                                                    viewBox="0 0 16 16" width="16" height="16"
                                                                    fill="currentColor" display="inline-block"
                                                                    overflow="visible"
                                                                    style="vertical-align:text-bottom"><path
                                d="M12.78 5.22a.749.749 0 0 1 0 1.06l-4.25 4.25a.749.749 0 0 1-1.06 0L3.22 6.28a.749.749 0 1 1 1.06-1.06L8 8.939l3.72-3.719a.749.749 0 0 1 1.06 0Z"></path></svg></span>
                              </div>
                            </div>
                          </button>
                          <div>
                            <ul id=":R3lfb6n6H1:" aria-labelledby=":R3lfb6n6:" class="Box-sc-g0xbh4-0 fyTuJZ">
                              <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                            aria-labelledby=":Rdblfb6n6:--label "
                                                                            id=":Rdblfb6n6:" aria-current="false"
                                                                            class="Link__StyledLink-sc-14289xe-0 ddXiKh"
                                                                            href="/en/get-started/writing-on-github/working-with-saved-replies/about-saved-replies">
                                <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX">
                                  <span id=":Rdblfb6n6:--label"
                                        class="Box-sc-g0xbh4-0 hczSex">About saved replies</span></div>
                              </a></li>
                              <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                            aria-labelledby=":Rlblfb6n6:--label "
                                                                            id=":Rlblfb6n6:" aria-current="false"
                                                                            class="Link__StyledLink-sc-14289xe-0 ddXiKh"
                                                                            href="/en/get-started/writing-on-github/working-with-saved-replies/creating-a-saved-reply">
                                <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX">
                                  <span id=":Rlblfb6n6:--label"
                                        class="Box-sc-g0xbh4-0 hczSex">Creating a saved reply</span></div>
                              </a></li>
                              <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                            aria-labelledby=":Rtblfb6n6:--label "
                                                                            id=":Rtblfb6n6:" aria-current="false"
                                                                            class="Link__StyledLink-sc-14289xe-0 ddXiKh"
                                                                            href="/en/get-started/writing-on-github/working-with-saved-replies/editing-a-saved-reply">
                                <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX">
                                  <span id=":Rtblfb6n6:--label"
                                        class="Box-sc-g0xbh4-0 hczSex">Editing a saved reply</span></div>
                              </a></li>
                              <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                            aria-labelledby=":R15blfb6n6:--label "
                                                                            id=":R15blfb6n6:" aria-current="false"
                                                                            class="Link__StyledLink-sc-14289xe-0 ddXiKh"
                                                                            href="/en/get-started/writing-on-github/working-with-saved-replies/deleting-a-saved-reply">
                                <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX">
                                  <span id=":R15blfb6n6:--label"
                                        class="Box-sc-g0xbh4-0 hczSex">Deleting a saved reply</span></div>
                              </a></li>
                              <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                            aria-labelledby=":R1dblfb6n6:--label "
                                                                            id=":R1dblfb6n6:" aria-current="false"
                                                                            class="Link__StyledLink-sc-14289xe-0 ddXiKh"
                                                                            href="/en/get-started/writing-on-github/working-with-saved-replies/using-saved-replies">
                                <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX">
                                  <span id=":R1dblfb6n6:--label"
                                        class="Box-sc-g0xbh4-0 hczSex">Using saved replies</span></div>
                              </a></li>
                            </ul>
                          </div>
                        </li>
                        <li aria-labelledby=":R4lfb6n6:" class="Box-sc-g0xbh4-0 bvBlwX">
                          <button tabindex="0" aria-labelledby=":R4lfb6n6:--label " id=":R4lfb6n6:"
                                  aria-expanded="false" aria-controls=":R4lfb6n6H1:"
                                  class="Item__LiBox-sc-yeql7o-0 dLSHEs">
                            <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX">
                              <div class="Box-sc-g0xbh4-0 cAMcRf"><span id=":R4lfb6n6:--label"
                                                                        class="Box-sc-g0xbh4-0 hczSex">Share content with gists</span><span
                                class="Box-sc-g0xbh4-0 dtMwwS"><svg sx="[object Object]" aria-hidden="true"
                                                                    focusable="false"
                                                                    class="octicon octicon-chevron-down Octicon-sc-9kayk9-0 bAQrwU"
                                                                    viewBox="0 0 16 16" width="16" height="16"
                                                                    fill="currentColor" display="inline-block"
                                                                    overflow="visible"
                                                                    style="vertical-align:text-bottom"><path
                                d="M12.78 5.22a.749.749 0 0 1 0 1.06l-4.25 4.25a.749.749 0 0 1-1.06 0L3.22 6.28a.749.749 0 1 1 1.06-1.06L8 8.939l3.72-3.719a.749.749 0 0 1 1.06 0Z"></path></svg></span>
                              </div>
                            </div>
                          </button>
                          <div>
                            <ul id=":R4lfb6n6H1:" aria-labelledby=":R4lfb6n6:" class="Box-sc-g0xbh4-0 fyTuJZ">
                              <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                            aria-labelledby=":Rdclfb6n6:--label "
                                                                            id=":Rdclfb6n6:" aria-current="false"
                                                                            class="Link__StyledLink-sc-14289xe-0 ddXiKh"
                                                                            href="/en/get-started/writing-on-github/editing-and-sharing-content-with-gists/creating-gists">
                                <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX">
                                  <span id=":Rdclfb6n6:--label" class="Box-sc-g0xbh4-0 hczSex">Creating gists</span>
                                </div>
                              </a></li>
                              <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                            aria-labelledby=":Rlclfb6n6:--label "
                                                                            id=":Rlclfb6n6:" aria-current="false"
                                                                            class="Link__StyledLink-sc-14289xe-0 ddXiKh"
                                                                            href="/en/get-started/writing-on-github/editing-and-sharing-content-with-gists/forking-and-cloning-gists">
                                <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX">
                                  <span id=":Rlclfb6n6:--label"
                                        class="Box-sc-g0xbh4-0 hczSex">Forking and cloning gists</span></div>
                              </a></li>
                              <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                            aria-labelledby=":Rtclfb6n6:--label "
                                                                            id=":Rtclfb6n6:" aria-current="false"
                                                                            class="Link__StyledLink-sc-14289xe-0 ddXiKh"
                                                                            href="/en/get-started/writing-on-github/editing-and-sharing-content-with-gists/saving-gists-with-stars">
                                <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX">
                                  <span id=":Rtclfb6n6:--label"
                                        class="Box-sc-g0xbh4-0 hczSex">Saving gists with stars</span></div>
                              </a></li>
                              <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                            aria-labelledby=":R15clfb6n6:--label "
                                                                            id=":R15clfb6n6:" aria-current="false"
                                                                            class="Link__StyledLink-sc-14289xe-0 ddXiKh"
                                                                            href="/en/get-started/writing-on-github/editing-and-sharing-content-with-gists/moderating-gist-comments">
                                <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX">
                                  <span id=":R15clfb6n6:--label"
                                        class="Box-sc-g0xbh4-0 hczSex">Moderating gist comments</span></div>
                              </a></li>
                            </ul>
                          </div>
                        </li>
                      </ul>
                    </div>
                  </li>
                  <li aria-labelledby=":Rhb6n6:" class="Box-sc-g0xbh4-0 bvBlwX">
                    <button tabindex="0" aria-labelledby=":Rhb6n6:--label " id=":Rhb6n6:" aria-expanded="false"
                            aria-controls=":Rhb6n6H1:" class="Item__LiBox-sc-yeql7o-0 islioC">
                      <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX">
                        <div class="Box-sc-g0xbh4-0 cAMcRf"><span id=":Rhb6n6:--label" class="Box-sc-g0xbh4-0 hczSex">Explore projects</span><span
                          class="Box-sc-g0xbh4-0 dtMwwS"><svg sx="[object Object]" aria-hidden="true" focusable="false"
                                                              class="octicon octicon-chevron-down Octicon-sc-9kayk9-0 bAQrwU"
                                                              viewBox="0 0 16 16" width="16" height="16"
                                                              fill="currentColor" display="inline-block"
                                                              overflow="visible" style="vertical-align:text-bottom"><path
                          d="M12.78 5.22a.749.749 0 0 1 0 1.06l-4.25 4.25a.749.749 0 0 1-1.06 0L3.22 6.28a.749.749 0 1 1 1.06-1.06L8 8.939l3.72-3.719a.749.749 0 0 1 1.06 0Z"></path></svg></span>
                        </div>
                      </div>
                    </button>
                    <div>
                      <ul id=":Rhb6n6H1:" aria-labelledby=":Rhb6n6:" class="Box-sc-g0xbh4-0 fyTuJZ">
                        <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                      aria-labelledby=":R1lhb6n6:--label "
                                                                      id=":R1lhb6n6:" aria-current="false"
                                                                      class="Link__StyledLink-sc-14289xe-0 icZieg"
                                                                      href="/en/get-started/exploring-projects-on-github/finding-ways-to-contribute-to-open-source-on-github">
                          <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX"><span
                            id=":R1lhb6n6:--label" class="Box-sc-g0xbh4-0 hczSex">Contribute to open source</span></div>
                        </a></li>
                        <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                      aria-labelledby=":R2lhb6n6:--label "
                                                                      id=":R2lhb6n6:" aria-current="false"
                                                                      class="Link__StyledLink-sc-14289xe-0 icZieg"
                                                                      href="/en/get-started/exploring-projects-on-github/using-github-copilot-to-explore-projects">
                          <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX"><span
                            id=":R2lhb6n6:--label" class="Box-sc-g0xbh4-0 hczSex">Use Copilot to explore projects</span>
                          </div>
                        </a></li>
                        <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                      aria-labelledby=":R3lhb6n6:--label "
                                                                      id=":R3lhb6n6:" aria-current="false"
                                                                      class="Link__StyledLink-sc-14289xe-0 icZieg"
                                                                      href="/en/get-started/exploring-projects-on-github/contributing-to-a-project">
                          <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX"><span
                            id=":R3lhb6n6:--label" class="Box-sc-g0xbh4-0 hczSex">Contribute to a project</span></div>
                        </a></li>
                        <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                      aria-labelledby=":R4lhb6n6:--label "
                                                                      id=":R4lhb6n6:" aria-current="false"
                                                                      class="Link__StyledLink-sc-14289xe-0 icZieg"
                                                                      href="/en/get-started/exploring-projects-on-github/saving-repositories-with-stars">
                          <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX"><span
                            id=":R4lhb6n6:--label" class="Box-sc-g0xbh4-0 hczSex">Save repositories with stars</span>
                          </div>
                        </a></li>
                        <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                      aria-labelledby=":R5lhb6n6:--label "
                                                                      id=":R5lhb6n6:" aria-current="false"
                                                                      class="Link__StyledLink-sc-14289xe-0 icZieg"
                                                                      href="/en/get-started/exploring-projects-on-github/following-people">
                          <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX"><span
                            id=":R5lhb6n6:--label" class="Box-sc-g0xbh4-0 hczSex">Following people</span></div>
                        </a></li>
                        <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                      aria-labelledby=":R6lhb6n6:--label "
                                                                      id=":R6lhb6n6:" aria-current="false"
                                                                      class="Link__StyledLink-sc-14289xe-0 icZieg"
                                                                      href="/en/get-started/exploring-projects-on-github/following-organizations">
                          <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX"><span
                            id=":R6lhb6n6:--label" class="Box-sc-g0xbh4-0 hczSex">Following organizations</span></div>
                        </a></li>
                      </ul>
                    </div>
                  </li>
                  <li aria-labelledby=":Rjb6n6:" class="Box-sc-g0xbh4-0 bvBlwX">
                    <button tabindex="0" aria-labelledby=":Rjb6n6:--label " id=":Rjb6n6:" aria-expanded="false"
                            aria-controls=":Rjb6n6H1:" class="Item__LiBox-sc-yeql7o-0 islioC">
                      <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX">
                        <div class="Box-sc-g0xbh4-0 cAMcRf"><span id=":Rjb6n6:--label" class="Box-sc-g0xbh4-0 hczSex">Git basics</span><span
                          class="Box-sc-g0xbh4-0 dtMwwS"><svg sx="[object Object]" aria-hidden="true" focusable="false"
                                                              class="octicon octicon-chevron-down Octicon-sc-9kayk9-0 bAQrwU"
                                                              viewBox="0 0 16 16" width="16" height="16"
                                                              fill="currentColor" display="inline-block"
                                                              overflow="visible" style="vertical-align:text-bottom"><path
                          d="M12.78 5.22a.749.749 0 0 1 0 1.06l-4.25 4.25a.749.749 0 0 1-1.06 0L3.22 6.28a.749.749 0 1 1 1.06-1.06L8 8.939l3.72-3.719a.749.749 0 0 1 1.06 0Z"></path></svg></span>
                        </div>
                      </div>
                    </button>
                    <div>
                      <ul id=":Rjb6n6H1:" aria-labelledby=":Rjb6n6:" class="Box-sc-g0xbh4-0 fyTuJZ">
                        <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                      aria-labelledby=":R1ljb6n6:--label "
                                                                      id=":R1ljb6n6:" aria-current="false"
                                                                      class="Link__StyledLink-sc-14289xe-0 icZieg"
                                                                      href="/en/get-started/git-basics/set-up-git">
                          <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX"><span
                            id=":R1ljb6n6:--label" class="Box-sc-g0xbh4-0 hczSex">Set up Git</span></div>
                        </a></li>
                        <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                      aria-labelledby=":R2ljb6n6:--label "
                                                                      id=":R2ljb6n6:" aria-current="false"
                                                                      class="Link__StyledLink-sc-14289xe-0 icZieg"
                                                                      href="/en/get-started/git-basics/setting-your-username-in-git">
                          <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX"><span
                            id=":R2ljb6n6:--label" class="Box-sc-g0xbh4-0 hczSex">Set your username</span></div>
                        </a></li>
                        <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                      aria-labelledby=":R3ljb6n6:--label "
                                                                      id=":R3ljb6n6:" aria-current="false"
                                                                      class="Link__StyledLink-sc-14289xe-0 icZieg"
                                                                      href="/en/get-started/git-basics/caching-your-github-credentials-in-git">
                          <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX"><span
                            id=":R3ljb6n6:--label" class="Box-sc-g0xbh4-0 hczSex">Caching credentials</span></div>
                        </a></li>
                        <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                      aria-labelledby=":R4ljb6n6:--label "
                                                                      id=":R4ljb6n6:" aria-current="false"
                                                                      class="Link__StyledLink-sc-14289xe-0 icZieg"
                                                                      href="/en/get-started/git-basics/why-is-git-always-asking-for-my-password">
                          <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX"><span
                            id=":R4ljb6n6:--label" class="Box-sc-g0xbh4-0 hczSex">Git passwords</span></div>
                        </a></li>
                        <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                      aria-labelledby=":R5ljb6n6:--label "
                                                                      id=":R5ljb6n6:" aria-current="false"
                                                                      class="Link__StyledLink-sc-14289xe-0 icZieg"
                                                                      href="/en/get-started/git-basics/updating-credentials-from-the-macos-keychain">
                          <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX"><span
                            id=":R5ljb6n6:--label" class="Box-sc-g0xbh4-0 hczSex">macOS Keychain credentials</span>
                          </div>
                        </a></li>
                        <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                      aria-labelledby=":R6ljb6n6:--label "
                                                                      id=":R6ljb6n6:" aria-current="false"
                                                                      class="Link__StyledLink-sc-14289xe-0 icZieg"
                                                                      href="/en/get-started/git-basics/git-workflows">
                          <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX"><span
                            id=":R6ljb6n6:--label" class="Box-sc-g0xbh4-0 hczSex">Git workflows</span></div>
                        </a></li>
                        <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                      aria-labelledby=":R7ljb6n6:--label "
                                                                      id=":R7ljb6n6:" aria-current="false"
                                                                      class="Link__StyledLink-sc-14289xe-0 icZieg"
                                                                      href="/en/get-started/git-basics/about-remote-repositories">
                          <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX"><span
                            id=":R7ljb6n6:--label" class="Box-sc-g0xbh4-0 hczSex">About remote repositories</span></div>
                        </a></li>
                        <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                      aria-labelledby=":R8ljb6n6:--label "
                                                                      id=":R8ljb6n6:" aria-current="false"
                                                                      class="Link__StyledLink-sc-14289xe-0 icZieg"
                                                                      href="/en/get-started/git-basics/managing-remote-repositories">
                          <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX"><span
                            id=":R8ljb6n6:--label" class="Box-sc-g0xbh4-0 hczSex">Manage remote repositories</span>
                          </div>
                        </a></li>
                        <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                      aria-labelledby=":R9ljb6n6:--label "
                                                                      id=":R9ljb6n6:" aria-current="false"
                                                                      class="Link__StyledLink-sc-14289xe-0 icZieg"
                                                                      href="/en/get-started/git-basics/associating-text-editors-with-git">
                          <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX"><span
                            id=":R9ljb6n6:--label" class="Box-sc-g0xbh4-0 hczSex">Associate text editors</span></div>
                        </a></li>
                        <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                      aria-labelledby=":Raljb6n6:--label "
                                                                      id=":Raljb6n6:" aria-current="false"
                                                                      class="Link__StyledLink-sc-14289xe-0 icZieg"
                                                                      href="/en/get-started/git-basics/configuring-git-to-handle-line-endings">
                          <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX"><span
                            id=":Raljb6n6:--label" class="Box-sc-g0xbh4-0 hczSex">Handle line endings</span></div>
                        </a></li>
                        <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                      aria-labelledby=":Rbljb6n6:--label "
                                                                      id=":Rbljb6n6:" aria-current="false"
                                                                      class="Link__StyledLink-sc-14289xe-0 icZieg"
                                                                      href="/en/get-started/git-basics/ignoring-files">
                          <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX"><span
                            id=":Rbljb6n6:--label" class="Box-sc-g0xbh4-0 hczSex">Ignoring files</span></div>
                        </a></li>
                        <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                      aria-labelledby=":Rcljb6n6:--label "
                                                                      id=":Rcljb6n6:" aria-current="false"
                                                                      class="Link__StyledLink-sc-14289xe-0 icZieg"
                                                                      href="/en/get-started/git-basics/git-cheatsheet">
                          <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX"><span
                            id=":Rcljb6n6:--label" class="Box-sc-g0xbh4-0 hczSex">Git cheatsheet</span></div>
                        </a></li>
                      </ul>
                    </div>
                  </li>
                  <li aria-labelledby=":Rlb6n6:" class="Box-sc-g0xbh4-0 bvBlwX">
                    <button tabindex="0" aria-labelledby=":Rlb6n6:--label " id=":Rlb6n6:" aria-expanded="false"
                            aria-controls=":Rlb6n6H1:" class="Item__LiBox-sc-yeql7o-0 islioC">
                      <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX">
                        <div class="Box-sc-g0xbh4-0 cAMcRf"><span id=":Rlb6n6:--label" class="Box-sc-g0xbh4-0 hczSex">Using Git</span><span
                          class="Box-sc-g0xbh4-0 dtMwwS"><svg sx="[object Object]" aria-hidden="true" focusable="false"
                                                              class="octicon octicon-chevron-down Octicon-sc-9kayk9-0 bAQrwU"
                                                              viewBox="0 0 16 16" width="16" height="16"
                                                              fill="currentColor" display="inline-block"
                                                              overflow="visible" style="vertical-align:text-bottom"><path
                          d="M12.78 5.22a.749.749 0 0 1 0 1.06l-4.25 4.25a.749.749 0 0 1-1.06 0L3.22 6.28a.749.749 0 1 1 1.06-1.06L8 8.939l3.72-3.719a.749.749 0 0 1 1.06 0Z"></path></svg></span>
                        </div>
                      </div>
                    </button>
                    <div>
                      <ul id=":Rlb6n6H1:" aria-labelledby=":Rlb6n6:" class="Box-sc-g0xbh4-0 fyTuJZ">
                        <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                      aria-labelledby=":R1llb6n6:--label "
                                                                      id=":R1llb6n6:" aria-current="false"
                                                                      class="Link__StyledLink-sc-14289xe-0 icZieg"
                                                                      href="/en/get-started/using-git/about-git">
                          <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX"><span
                            id=":R1llb6n6:--label" class="Box-sc-g0xbh4-0 hczSex">About Git</span></div>
                        </a></li>
                        <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                      aria-labelledby=":R2llb6n6:--label "
                                                                      id=":R2llb6n6:" aria-current="false"
                                                                      class="Link__StyledLink-sc-14289xe-0 icZieg"
                                                                      href="/en/get-started/using-git/pushing-commits-to-a-remote-repository">
                          <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX"><span
                            id=":R2llb6n6:--label" class="Box-sc-g0xbh4-0 hczSex">Push commits to a remote</span></div>
                        </a></li>
                        <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                      aria-labelledby=":R3llb6n6:--label "
                                                                      id=":R3llb6n6:" aria-current="false"
                                                                      class="Link__StyledLink-sc-14289xe-0 icZieg"
                                                                      href="/en/get-started/using-git/getting-changes-from-a-remote-repository">
                          <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX"><span
                            id=":R3llb6n6:--label" class="Box-sc-g0xbh4-0 hczSex">Get changes from a remote</span></div>
                        </a></li>
                        <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                      aria-labelledby=":R4llb6n6:--label "
                                                                      id=":R4llb6n6:" aria-current="false"
                                                                      class="Link__StyledLink-sc-14289xe-0 icZieg"
                                                                      href="/en/get-started/using-git/dealing-with-non-fast-forward-errors">
                          <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX"><span
                            id=":R4llb6n6:--label" class="Box-sc-g0xbh4-0 hczSex">Non-fast-forward error</span></div>
                        </a></li>
                        <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                      aria-labelledby=":R5llb6n6:--label "
                                                                      id=":R5llb6n6:" aria-current="false"
                                                                      class="Link__StyledLink-sc-14289xe-0 icZieg"
                                                                      href="/en/get-started/using-git/splitting-a-subfolder-out-into-a-new-repository">
                          <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX"><span
                            id=":R5llb6n6:--label" class="Box-sc-g0xbh4-0 hczSex">Splitting a subfolder</span></div>
                        </a></li>
                        <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                      aria-labelledby=":R6llb6n6:--label "
                                                                      id=":R6llb6n6:" aria-current="false"
                                                                      class="Link__StyledLink-sc-14289xe-0 icZieg"
                                                                      href="/en/get-started/using-git/about-git-subtree-merges">
                          <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX"><span
                            id=":R6llb6n6:--label" class="Box-sc-g0xbh4-0 hczSex">About Git subtree merges</span></div>
                        </a></li>
                        <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                      aria-labelledby=":R7llb6n6:--label "
                                                                      id=":R7llb6n6:" aria-current="false"
                                                                      class="Link__StyledLink-sc-14289xe-0 icZieg"
                                                                      href="/en/get-started/using-git/about-git-rebase">
                          <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX"><span
                            id=":R7llb6n6:--label" class="Box-sc-g0xbh4-0 hczSex">About Git rebase</span></div>
                        </a></li>
                        <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                      aria-labelledby=":R8llb6n6:--label "
                                                                      id=":R8llb6n6:" aria-current="false"
                                                                      class="Link__StyledLink-sc-14289xe-0 icZieg"
                                                                      href="/en/get-started/using-git/using-git-rebase-on-the-command-line">
                          <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX"><span
                            id=":R8llb6n6:--label" class="Box-sc-g0xbh4-0 hczSex">Git rebase</span></div>
                        </a></li>
                        <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                      aria-labelledby=":R9llb6n6:--label "
                                                                      id=":R9llb6n6:" aria-current="false"
                                                                      class="Link__StyledLink-sc-14289xe-0 icZieg"
                                                                      href="/en/get-started/using-git/resolving-merge-conflicts-after-a-git-rebase">
                          <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX"><span
                            id=":R9llb6n6:--label" class="Box-sc-g0xbh4-0 hczSex">Resolve conflicts after rebase</span>
                          </div>
                        </a></li>
                        <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                      aria-labelledby=":Rallb6n6:--label "
                                                                      id=":Rallb6n6:" aria-current="false"
                                                                      class="Link__StyledLink-sc-14289xe-0 icZieg"
                                                                      href="/en/get-started/using-git/dealing-with-special-characters-in-branch-and-tag-names">
                          <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX"><span
                            id=":Rallb6n6:--label" class="Box-sc-g0xbh4-0 hczSex">Special characters in names</span>
                          </div>
                        </a></li>
                        <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                      aria-labelledby=":Rbllb6n6:--label "
                                                                      id=":Rbllb6n6:" aria-current="false"
                                                                      class="Link__StyledLink-sc-14289xe-0 icZieg"
                                                                      href="/en/get-started/using-git/troubleshooting-the-2-gb-push-limit">
                          <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX"><span
                            id=":Rbllb6n6:--label" class="Box-sc-g0xbh4-0 hczSex">Maximum push limit</span></div>
                        </a></li>
                      </ul>
                    </div>
                  </li>
                  <li aria-labelledby=":Rnb6n6:" class="Box-sc-g0xbh4-0 bvBlwX">
                    <button tabindex="0" aria-labelledby=":Rnb6n6:--label " id=":Rnb6n6:" aria-expanded="false"
                            aria-controls=":Rnb6n6H1:" class="Item__LiBox-sc-yeql7o-0 islioC">
                      <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX">
                        <div class="Box-sc-g0xbh4-0 cAMcRf"><span id=":Rnb6n6:--label" class="Box-sc-g0xbh4-0 hczSex">Exploring integrations</span><span
                          class="Box-sc-g0xbh4-0 dtMwwS"><svg sx="[object Object]" aria-hidden="true" focusable="false"
                                                              class="octicon octicon-chevron-down Octicon-sc-9kayk9-0 bAQrwU"
                                                              viewBox="0 0 16 16" width="16" height="16"
                                                              fill="currentColor" display="inline-block"
                                                              overflow="visible" style="vertical-align:text-bottom"><path
                          d="M12.78 5.22a.749.749 0 0 1 0 1.06l-4.25 4.25a.749.749 0 0 1-1.06 0L3.22 6.28a.749.749 0 1 1 1.06-1.06L8 8.939l3.72-3.719a.749.749 0 0 1 1.06 0Z"></path></svg></span>
                        </div>
                      </div>
                    </button>
                    <div>
                      <ul id=":Rnb6n6H1:" aria-labelledby=":Rnb6n6:" class="Box-sc-g0xbh4-0 fyTuJZ">
                        <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                      aria-labelledby=":R1lnb6n6:--label "
                                                                      id=":R1lnb6n6:" aria-current="false"
                                                                      class="Link__StyledLink-sc-14289xe-0 icZieg"
                                                                      href="/en/get-started/exploring-integrations/about-using-integrations">
                          <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX"><span
                            id=":R1lnb6n6:--label" class="Box-sc-g0xbh4-0 hczSex">About using integrations</span></div>
                        </a></li>
                        <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                      aria-labelledby=":R2lnb6n6:--label "
                                                                      id=":R2lnb6n6:" aria-current="false"
                                                                      class="Link__StyledLink-sc-14289xe-0 icZieg"
                                                                      href="/en/get-started/exploring-integrations/about-building-integrations">
                          <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX"><span
                            id=":R2lnb6n6:--label" class="Box-sc-g0xbh4-0 hczSex">About building integrations</span>
                          </div>
                        </a></li>
                        <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                      aria-labelledby=":R3lnb6n6:--label "
                                                                      id=":R3lnb6n6:" aria-current="false"
                                                                      class="Link__StyledLink-sc-14289xe-0 icZieg"
                                                                      href="/en/get-started/exploring-integrations/featured-github-integrations">
                          <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX"><span
                            id=":R3lnb6n6:--label" class="Box-sc-g0xbh4-0 hczSex">Featured integrations</span></div>
                        </a></li>
                        <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                      aria-labelledby=":R4lnb6n6:--label "
                                                                      id=":R4lnb6n6:" aria-current="false"
                                                                      class="Link__StyledLink-sc-14289xe-0 icZieg"
                                                                      href="/en/get-started/exploring-integrations/github-developer-program">
                          <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX"><span
                            id=":R4lnb6n6:--label" class="Box-sc-g0xbh4-0 hczSex">GitHub Developer Program</span></div>
                        </a></li>
                      </ul>
                    </div>
                  </li>
                  <li aria-labelledby=":Rpb6n6:" class="Box-sc-g0xbh4-0 bvBlwX">
                    <button tabindex="0" aria-labelledby=":Rpb6n6:--label " id=":Rpb6n6:" aria-expanded="false"
                            aria-controls=":Rpb6n6H1:" class="Item__LiBox-sc-yeql7o-0 islioC">
                      <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX">
                        <div class="Box-sc-g0xbh4-0 cAMcRf"><span id=":Rpb6n6:--label" class="Box-sc-g0xbh4-0 hczSex">Archive account and public repos</span><span
                          class="Box-sc-g0xbh4-0 dtMwwS"><svg sx="[object Object]" aria-hidden="true" focusable="false"
                                                              class="octicon octicon-chevron-down Octicon-sc-9kayk9-0 bAQrwU"
                                                              viewBox="0 0 16 16" width="16" height="16"
                                                              fill="currentColor" display="inline-block"
                                                              overflow="visible" style="vertical-align:text-bottom"><path
                          d="M12.78 5.22a.749.749 0 0 1 0 1.06l-4.25 4.25a.749.749 0 0 1-1.06 0L3.22 6.28a.749.749 0 1 1 1.06-1.06L8 8.939l3.72-3.719a.749.749 0 0 1 1.06 0Z"></path></svg></span>
                        </div>
                      </div>
                    </button>
                    <div>
                      <ul id=":Rpb6n6H1:" aria-labelledby=":Rpb6n6:" class="Box-sc-g0xbh4-0 fyTuJZ">
                        <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                      aria-labelledby=":R1lpb6n6:--label "
                                                                      id=":R1lpb6n6:" aria-current="false"
                                                                      class="Link__StyledLink-sc-14289xe-0 icZieg"
                                                                      href="/en/get-started/archiving-your-github-personal-account-and-public-repositories/requesting-an-archive-of-your-personal-accounts-data">
                          <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX"><span
                            id=":R1lpb6n6:--label" class="Box-sc-g0xbh4-0 hczSex">Request account archive</span></div>
                        </a></li>
                        <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                      aria-labelledby=":R2lpb6n6:--label "
                                                                      id=":R2lpb6n6:" aria-current="false"
                                                                      class="Link__StyledLink-sc-14289xe-0 icZieg"
                                                                      href="/en/get-started/archiving-your-github-personal-account-and-public-repositories/opting-into-or-out-of-the-github-archive-program-for-your-public-repository">
                          <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX"><span
                            id=":R2lpb6n6:--label" class="Box-sc-g0xbh4-0 hczSex">GitHub Archive program</span></div>
                        </a></li>
                      </ul>
                    </div>
                  </li>
                  <li aria-labelledby=":Rrb6n6:" class="Box-sc-g0xbh4-0 bvBlwX">
                    <button tabindex="0" aria-labelledby=":Rrb6n6:--label " id=":Rrb6n6:" aria-expanded="false"
                            aria-controls=":Rrb6n6H1:" class="Item__LiBox-sc-yeql7o-0 islioC">
                      <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX">
                        <div class="Box-sc-g0xbh4-0 cAMcRf"><span id=":Rrb6n6:--label" class="Box-sc-g0xbh4-0 hczSex">Using GitHub Docs</span><span
                          class="Box-sc-g0xbh4-0 dtMwwS"><svg sx="[object Object]" aria-hidden="true" focusable="false"
                                                              class="octicon octicon-chevron-down Octicon-sc-9kayk9-0 bAQrwU"
                                                              viewBox="0 0 16 16" width="16" height="16"
                                                              fill="currentColor" display="inline-block"
                                                              overflow="visible" style="vertical-align:text-bottom"><path
                          d="M12.78 5.22a.749.749 0 0 1 0 1.06l-4.25 4.25a.749.749 0 0 1-1.06 0L3.22 6.28a.749.749 0 1 1 1.06-1.06L8 8.939l3.72-3.719a.749.749 0 0 1 1.06 0Z"></path></svg></span>
                        </div>
                      </div>
                    </button>
                    <div>
                      <ul id=":Rrb6n6H1:" aria-labelledby=":Rrb6n6:" class="Box-sc-g0xbh4-0 fyTuJZ">
                        <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                      aria-labelledby=":R1lrb6n6:--label "
                                                                      id=":R1lrb6n6:" aria-current="false"
                                                                      class="Link__StyledLink-sc-14289xe-0 icZieg"
                                                                      href="/en/get-started/using-github-docs/about-versions-of-github-docs">
                          <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX"><span
                            id=":R1lrb6n6:--label" class="Box-sc-g0xbh4-0 hczSex">Docs versions</span></div>
                        </a></li>
                        <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                      aria-labelledby=":R2lrb6n6:--label "
                                                                      id=":R2lrb6n6:" aria-current="false"
                                                                      class="Link__StyledLink-sc-14289xe-0 icZieg"
                                                                      href="/en/get-started/using-github-docs/using-hover-cards-on-github-docs">
                          <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX"><span
                            id=":R2lrb6n6:--label" class="Box-sc-g0xbh4-0 hczSex">Hover cards</span></div>
                        </a></li>
                      </ul>
                    </div>
                  </li>
                  <li aria-labelledby=":Rtb6n6:" class="Box-sc-g0xbh4-0 bvBlwX">
                    <button tabindex="0" aria-labelledby=":Rtb6n6:--label " id=":Rtb6n6:" aria-expanded="false"
                            aria-controls=":Rtb6n6H1:" class="Item__LiBox-sc-yeql7o-0 islioC">
                      <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX">
                        <div class="Box-sc-g0xbh4-0 cAMcRf"><span id=":Rtb6n6:--label" class="Box-sc-g0xbh4-0 hczSex">GitHub Certifications</span><span
                          class="Box-sc-g0xbh4-0 dtMwwS"><svg sx="[object Object]" aria-hidden="true" focusable="false"
                                                              class="octicon octicon-chevron-down Octicon-sc-9kayk9-0 bAQrwU"
                                                              viewBox="0 0 16 16" width="16" height="16"
                                                              fill="currentColor" display="inline-block"
                                                              overflow="visible" style="vertical-align:text-bottom"><path
                          d="M12.78 5.22a.749.749 0 0 1 0 1.06l-4.25 4.25a.749.749 0 0 1-1.06 0L3.22 6.28a.749.749 0 1 1 1.06-1.06L8 8.939l3.72-3.719a.749.749 0 0 1 1.06 0Z"></path></svg></span>
                        </div>
                      </div>
                    </button>
                    <div>
                      <ul id=":Rtb6n6H1:" aria-labelledby=":Rtb6n6:" class="Box-sc-g0xbh4-0 fyTuJZ">
                        <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                      aria-labelledby=":R1ltb6n6:--label "
                                                                      id=":R1ltb6n6:" aria-current="false"
                                                                      class="Link__StyledLink-sc-14289xe-0 icZieg"
                                                                      href="/en/get-started/showcase-your-expertise-with-github-certifications/about-github-certifications">
                          <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX"><span
                            id=":R1ltb6n6:--label" class="Box-sc-g0xbh4-0 hczSex">About GitHub Certifications</span>
                          </div>
                        </a></li>
                        <li class="Item__LiBox-sc-yeql7o-0 fULXDV"><a sx="[object Object]" tabindex="0"
                                                                      aria-labelledby=":R2ltb6n6:--label "
                                                                      id=":R2ltb6n6:" aria-current="false"
                                                                      class="Link__StyledLink-sc-14289xe-0 icZieg"
                                                                      href="/en/get-started/showcase-your-expertise-with-github-certifications/registering-for-a-github-certifications-exam">
                          <div data-component="ActionList.Item--DividerContainer" class="Box-sc-g0xbh4-0 fFwzwX"><span
                            id=":R2ltb6n6:--label" class="Box-sc-g0xbh4-0 hczSex">Registering for an exam</span></div>
                        </a></li>
                      </ul>
                    </div>
                  </li>
                </ul>
              </nav>`
    const now = performance.now()
    const markdown = syncHtmlToMarkdown(html)
    const end = performance.now()
    console.log('Time taken to convert HTML to Markdown:', end - now, 'ms')
    expect(markdown).toMatchInlineSnapshot(`
      "- Start your journey
        - [About GitHub and Git](/en/get-started/start-your-journey/about-github-and-git)
        - [Create an account](/en/get-started/start-your-journey/creating-an-account-on-github)
        - [Hello World](/en/get-started/start-your-journey/hello-world)
        - [Set up your profile](/en/get-started/start-your-journey/setting-up-your-profile)
        - [Find inspiration](/en/get-started/start-your-journey/finding-inspiration-on-github)
        - [Download files](/en/get-started/start-your-journey/downloading-files-from-github)
        - [Upload a project](/en/get-started/start-your-journey/uploading-a-project-to-github)
        - [Learning resources](/en/get-started/start-your-journey/git-and-github-learning-resources)
      - Onboarding
        - [Getting started with your GitHub account](/en/get-started/onboarding/getting-started-with-your-github-account)
        - [Getting started with GitHub Team](/en/get-started/onboarding/getting-started-with-github-team)
        - [Getting started with the GitHub Enterprise Cloud trial](/en/get-started/onboarding/getting-started-with-the-github-enterprise-cloud-trial)
        - [Getting started with GitHub Enterprise Cloud](/en/get-started/onboarding/getting-started-with-github-enterprise-cloud)
      - Using GitHub
        - [GitHub flow](/en/get-started/using-github/github-flow)
        - [Connecting to GitHub](/en/get-started/using-github/connecting-to-github)
        - [Communicating on GitHub](/en/get-started/using-github/communicating-on-github)
        - [Feature preview](/en/get-started/using-github/exploring-early-access-releases-with-feature-preview)
        - [Supported browsers](/en/get-started/using-github/supported-browsers)
        - [GitHub Mobile](/en/get-started/using-github/github-mobile)
        - [Allow network access](/en/get-started/using-github/allowing-access-to-githubs-services-from-a-restricted-network)
        - [Connectivity problems](/en/get-started/using-github/troubleshooting-connectivity-problems)
      - Learning about GitHub
        - [GitHub’s plans](/en/get-started/learning-about-github/githubs-plans)
        - [GitHub language support](/en/get-started/learning-about-github/github-language-support)
        - [Types of GitHub accounts](/en/get-started/learning-about-github/types-of-github-accounts)
        - [Access permissions](/en/get-started/learning-about-github/access-permissions-on-github)
        - [GitHub Advanced Security](/en/get-started/learning-about-github/about-github-advanced-security)
        - [Changes to GitHub plans](/en/get-started/learning-about-github/faq-about-changes-to-githubs-plans)
        - [GitHub glossary](/en/get-started/learning-about-github/github-glossary)
      - Learn to code
        - [Get started with Git](/en/get-started/learning-to-code/getting-started-with-git)
        - [Finding example code](/en/get-started/learning-to-code/finding-and-understanding-example-code)
        - [Reuse people's code](/en/get-started/learning-to-code/reusing-other-peoples-code-in-your-projects)
        - [Set up Copilot for learning](/en/get-started/learning-to-code/setting-up-copilot-for-learning-to-code)
        - [Debug with Copilot](/en/get-started/learning-to-code/learning-to-debug-with-github-copilot)
        - [Storing secrets safely](/en/get-started/learning-to-code/storing-your-secrets-safely)
      - Accessibility
        - [Manage theme settings](/en/get-started/accessibility/managing-your-theme-settings)
        - [Keyboard shortcuts](/en/get-started/accessibility/keyboard-shortcuts)
        - [GitHub Command Palette](/en/get-started/accessibility/github-command-palette)
      - Writing on GitHub
        - Start writing on GitHub
          - [Quickstart](/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/quickstart-for-writing-on-github)
          - [About writing & formatting](/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/about-writing-and-formatting-on-github)
          - [Basic formatting syntax](/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax)
        - Work with advanced formatting
          - [Organized data with tables](/en/get-started/writing-on-github/working-with-advanced-formatting/organizing-information-with-tables)
          - [Collapsed sections](/en/get-started/writing-on-github/working-with-advanced-formatting/organizing-information-with-collapsed-sections)
          - [Create code blocks](/en/get-started/writing-on-github/working-with-advanced-formatting/creating-and-highlighting-code-blocks)
          - [Create diagrams](/en/get-started/writing-on-github/working-with-advanced-formatting/creating-diagrams)
          - [Mathematical expressions](/en/get-started/writing-on-github/working-with-advanced-formatting/writing-mathematical-expressions)
          - [Auto linked references](/en/get-started/writing-on-github/working-with-advanced-formatting/autolinked-references-and-urls)
          - [Attaching files](/en/get-started/writing-on-github/working-with-advanced-formatting/attaching-files)
          - [About task lists](/en/get-started/writing-on-github/working-with-advanced-formatting/about-task-lists)
          - [Permanent links to code](/en/get-started/writing-on-github/working-with-advanced-formatting/creating-a-permanent-link-to-a-code-snippet)
          - [Using keywords in issues and pull requests](/en/get-started/writing-on-github/working-with-advanced-formatting/using-keywords-in-issues-and-pull-requests)
        - Work with saved replies
          - [About saved replies](/en/get-started/writing-on-github/working-with-saved-replies/about-saved-replies)
          - [Creating a saved reply](/en/get-started/writing-on-github/working-with-saved-replies/creating-a-saved-reply)
          - [Editing a saved reply](/en/get-started/writing-on-github/working-with-saved-replies/editing-a-saved-reply)
          - [Deleting a saved reply](/en/get-started/writing-on-github/working-with-saved-replies/deleting-a-saved-reply)
          - [Using saved replies](/en/get-started/writing-on-github/working-with-saved-replies/using-saved-replies)
        - Share content with gists
          - [Creating gists](/en/get-started/writing-on-github/editing-and-sharing-content-with-gists/creating-gists)
          - [Forking and cloning gists](/en/get-started/writing-on-github/editing-and-sharing-content-with-gists/forking-and-cloning-gists)
          - [Saving gists with stars](/en/get-started/writing-on-github/editing-and-sharing-content-with-gists/saving-gists-with-stars)
          - [Moderating gist comments](/en/get-started/writing-on-github/editing-and-sharing-content-with-gists/moderating-gist-comments)
      - Explore projects
        - [Contribute to open source](/en/get-started/exploring-projects-on-github/finding-ways-to-contribute-to-open-source-on-github)
        - [Use Copilot to explore projects](/en/get-started/exploring-projects-on-github/using-github-copilot-to-explore-projects)
        - [Contribute to a project](/en/get-started/exploring-projects-on-github/contributing-to-a-project)
        - [Save repositories with stars](/en/get-started/exploring-projects-on-github/saving-repositories-with-stars)
        - [Following people](/en/get-started/exploring-projects-on-github/following-people)
        - [Following organizations](/en/get-started/exploring-projects-on-github/following-organizations)
      - Git basics
        - [Set up Git](/en/get-started/git-basics/set-up-git)
        - [Set your username](/en/get-started/git-basics/setting-your-username-in-git)
        - [Caching credentials](/en/get-started/git-basics/caching-your-github-credentials-in-git)
        - [Git passwords](/en/get-started/git-basics/why-is-git-always-asking-for-my-password)
        - [macOS Keychain credentials](/en/get-started/git-basics/updating-credentials-from-the-macos-keychain)
        - [Git workflows](/en/get-started/git-basics/git-workflows)
        - [About remote repositories](/en/get-started/git-basics/about-remote-repositories)
        - [Manage remote repositories](/en/get-started/git-basics/managing-remote-repositories)
        - [Associate text editors](/en/get-started/git-basics/associating-text-editors-with-git)
        - [Handle line endings](/en/get-started/git-basics/configuring-git-to-handle-line-endings)
        - [Ignoring files](/en/get-started/git-basics/ignoring-files)
        - [Git cheatsheet](/en/get-started/git-basics/git-cheatsheet)
      - Using Git
        - [About Git](/en/get-started/using-git/about-git)
        - [Push commits to a remote](/en/get-started/using-git/pushing-commits-to-a-remote-repository)
        - [Get changes from a remote](/en/get-started/using-git/getting-changes-from-a-remote-repository)
        - [Non-fast-forward error](/en/get-started/using-git/dealing-with-non-fast-forward-errors)
        - [Splitting a subfolder](/en/get-started/using-git/splitting-a-subfolder-out-into-a-new-repository)
        - [About Git subtree merges](/en/get-started/using-git/about-git-subtree-merges)
        - [About Git rebase](/en/get-started/using-git/about-git-rebase)
        - [Git rebase](/en/get-started/using-git/using-git-rebase-on-the-command-line)
        - [Resolve conflicts after rebase](/en/get-started/using-git/resolving-merge-conflicts-after-a-git-rebase)
        - [Special characters in names](/en/get-started/using-git/dealing-with-special-characters-in-branch-and-tag-names)
        - [Maximum push limit](/en/get-started/using-git/troubleshooting-the-2-gb-push-limit)
      - Exploring integrations
        - [About using integrations](/en/get-started/exploring-integrations/about-using-integrations)
        - [About building integrations](/en/get-started/exploring-integrations/about-building-integrations)
        - [Featured integrations](/en/get-started/exploring-integrations/featured-github-integrations)
        - [GitHub Developer Program](/en/get-started/exploring-integrations/github-developer-program)
      - Archive account and public repos
        - [Request account archive](/en/get-started/archiving-your-github-personal-account-and-public-repositories/requesting-an-archive-of-your-personal-accounts-data)
        - [GitHub Archive program](/en/get-started/archiving-your-github-personal-account-and-public-repositories/opting-into-or-out-of-the-github-archive-program-for-your-public-repository)
      - Using GitHub Docs
        - [Docs versions](/en/get-started/using-github-docs/about-versions-of-github-docs)
        - [Hover cards](/en/get-started/using-github-docs/using-hover-cards-on-github-docs)
      - GitHub Certifications
        - [About GitHub Certifications](/en/get-started/showcase-your-expertise-with-github-certifications/about-github-certifications)
        - [Registering for an exam](/en/get-started/showcase-your-expertise-with-github-certifications/registering-for-a-github-certifications-exam)"
    `)
  })
})
