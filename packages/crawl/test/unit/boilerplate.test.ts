import { describe, expect, it } from 'vitest'
import { stripBoilerplateFromCorpus } from '../../src/boilerplate.ts'

// Long shared chrome that wraps every page (>= the default minRun of 12 tokens).
const NAV = 'Home About Blog Products Pricing Contact Login Sign-up Docs Support Careers Press Community'
const FOOTER = 'Subscribe to our newsletter and join ten thousand happy marketers for weekly growth tips and tricks'

function page(body: string): string {
  return `${NAV} ${body} ${FOOTER}`
}

describe('stripBoilerplateFromCorpus (token shingles)', () => {
  it('strips repeated nav/footer chrome shared across pages, keeps the unique body', () => {
    const pages = [
      page('Call to action article with its own distinct sentence number one right here.'),
      page('Tips article featuring a completely different and unique sentence over here now.'),
      page('Guide article with yet another wholly distinct body sentence written right here.'),
      page('Welcome to the home page intro paragraph that is unique only to home.'),
    ]

    const out = stripBoilerplateFromCorpus(pages)

    for (const o of out) {
      expect(o).not.toContain('Subscribe to our newsletter')
      expect(o).not.toContain('Products Pricing Contact')
    }
    expect(out[0]).toContain('Call to action article')
    expect(out[1]).toContain('Tips article')
    expect(out[2]).toContain('Guide article')
    expect(out[3]).toContain('Welcome to the home page')
  })

  it('catches an inner duplicated band repeated across the corpus, not just wrapping', () => {
    const BAND = 'this entire promotional banner sentence repeats word for word identically across every single page'
    const pages = [
      `Unique alpha opening line written for page one here. ${BAND} Unique alpha closing line for page one.`,
      `Different beta opening line written for page two here. ${BAND} Different beta closing line for page two.`,
      `Distinct gamma opening line written for page three here. ${BAND} Distinct gamma closing line for page three.`,
    ]

    const out = stripBoilerplateFromCorpus(pages, { threshold: 0.6 })

    for (const o of out)
      expect(o).not.toContain('promotional banner sentence repeats')
    expect(out[0]).toContain('Unique alpha opening')
    expect(out[0]).toContain('Unique alpha closing')
  })

  it('keeps short repeated phrases below minRun (does not nibble prose)', () => {
    // Only ~7 consecutive shared tokens, under the default minRun of 12.
    const pages = [
      'Intro one as we know and then unique tail one continues onward here today nicely.',
      'Intro two as we know and then unique tail two continues onward there right now today.',
      'Intro three as we know and then unique tail three continues onward somewhere else entirely.',
    ]

    const out = stripBoilerplateFromCorpus(pages)

    for (const o of out)
      expect(o).toContain('as we know')
  })

  it('does nothing when there are fewer than minDocs pages', () => {
    const pages = [page('body one is here'), page('body two is here')]
    const out = stripBoilerplateFromCorpus(pages)
    expect(out).toEqual(pages)
  })

  it('leaves a fully unique page untouched byte-for-byte', () => {
    const unique = 'This page shares no sequence of words with anything else in the whole corpus at all.'
    const pages = [unique, page('body two here now'), page('body three here now'), page('body four here now')]
    const out = stripBoilerplateFromCorpus(pages)
    expect(out[0]).toBe(unique)
  })

  it('a stricter threshold keeps chrome that is not on enough pages', () => {
    // FOOTER on 3/4 pages. threshold 0.9 -> needs ceil(0.9*4)=4 -> kept. NAV on 4/4 -> stripped.
    const pages = [
      `${NAV} alpha unique body sentence number one here ${FOOTER}`,
      `${NAV} beta unique body sentence number two here ${FOOTER}`,
      `${NAV} gamma unique body sentence number three here ${FOOTER}`,
      `${NAV} delta unique body sentence number four right here today`,
    ]
    const out = stripBoilerplateFromCorpus(pages, { threshold: 0.9 })
    expect(out[0]).not.toContain('Products Pricing Contact')
    expect(out[0]).toContain('Subscribe to our newsletter')
  })
})
