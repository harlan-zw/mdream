import type { ElementNode } from '../../../src/types.ts'
import { describe, expect, it } from 'vitest'
import {
  createAttributeSelector,
  createClassSelector,
  createCompoundSelector,
  createIdSelector,
  createTagSelector,
  parseSelector,
} from '../../../src/libs/query-selector.ts'

function createTestElement(name: string, attributes?: Record<string, string>): ElementNode {
  return {
    type: 1,
    name,
    attributes: attributes || {},
    children: [],
  }
}

describe('query-selector', () => {
  describe('createTagSelector', () => {
    it('matches elements by tag name', () => {
      const selector = createTagSelector('div')

      expect(selector.matches(createTestElement('div'))).toBe(true)
      expect(selector.matches(createTestElement('span'))).toBe(false)
      expect(selector.toString()).toBe('div')
    })
  })

  describe('createIdSelector', () => {
    it('matches elements by id', () => {
      const selector = createIdSelector('#main')

      expect(selector.matches(createTestElement('div', { id: 'main' }))).toBe(true)
      expect(selector.matches(createTestElement('div', { id: 'other' }))).toBe(false)
      expect(selector.matches(createTestElement('div'))).toBe(false)
      expect(selector.toString()).toBe('#main')
    })
  })

  describe('createClassSelector', () => {
    it('matches elements by class', () => {
      const selector = createClassSelector('.container')

      expect(selector.matches(createTestElement('div', { class: 'container' }))).toBe(true)
      expect(selector.matches(createTestElement('div', { class: 'other' }))).toBe(false)
      expect(selector.matches(createTestElement('div'))).toBe(false)
      expect(selector.toString()).toBe('.container')
    })

    it('matches elements with multiple classes', () => {
      const selector = createClassSelector('.active')

      expect(selector.matches(createTestElement('div', { class: 'btn active primary' }))).toBe(true)
      expect(selector.matches(createTestElement('div', { class: 'btn primary' }))).toBe(false)
    })

    it('handles extra whitespace in class attribute', () => {
      const selector = createClassSelector('.active')

      expect(selector.matches(createTestElement('div', { class: '  btn   active  ' }))).toBe(true)
    })
  })

  describe('createAttributeSelector', () => {
    it('matches elements by attribute existence', () => {
      const selector = createAttributeSelector('[data-id]')

      expect(selector.matches(createTestElement('div', { 'data-id': '123' }))).toBe(true)
      expect(selector.matches(createTestElement('div', { 'data-name': 'test' }))).toBe(false)
      expect(selector.matches(createTestElement('div'))).toBe(false)
      expect(selector.toString()).toBe('[data-id]')
    })

    it('matches elements by exact attribute value', () => {
      const selector = createAttributeSelector('[href="https://example.com"]')

      expect(selector.matches(createTestElement('a', { href: 'https://example.com' }))).toBe(true)
      expect(selector.matches(createTestElement('a', { href: 'https://other.com' }))).toBe(false)
      expect(selector.toString()).toBe('[href=https://example.com]')
    })

    it('matches elements by attribute value prefix', () => {
      const selector = createAttributeSelector('[href^="https://"]')

      expect(selector.matches(createTestElement('a', { href: 'https://example.com' }))).toBe(true)
      expect(selector.matches(createTestElement('a', { href: 'http://example.com' }))).toBe(false)
    })

    it('matches elements by attribute value suffix', () => {
      const selector = createAttributeSelector('[src$=".png"]')

      expect(selector.matches(createTestElement('img', { src: 'image.png' }))).toBe(true)
      expect(selector.matches(createTestElement('img', { src: 'image.jpg' }))).toBe(false)
    })

    it('matches elements by attribute value containing substring', () => {
      const selector = createAttributeSelector('[class*="active"]')

      expect(selector.matches(createTestElement('div', { class: 'btn-active-primary' }))).toBe(true)
      expect(selector.matches(createTestElement('div', { class: 'btn-primary' }))).toBe(false)
    })

    it('matches elements by attribute value containing word', () => {
      const selector = createAttributeSelector('[class~="active"]')

      expect(selector.matches(createTestElement('div', { class: 'btn active primary' }))).toBe(true)
      expect(selector.matches(createTestElement('div', { class: 'btn-active primary' }))).toBe(false)
    })

    it('matches elements by attribute value with hyphen prefix', () => {
      const selector = createAttributeSelector('[lang|="en"]')

      expect(selector.matches(createTestElement('div', { lang: 'en' }))).toBe(true)
      expect(selector.matches(createTestElement('div', { lang: 'en-US' }))).toBe(true)
      expect(selector.matches(createTestElement('div', { lang: 'eng' }))).toBe(false)
    })
  })

  describe('createCompoundSelector', () => {
    it('matches elements that satisfy all selectors', () => {
      const selector = createCompoundSelector([
        createTagSelector('div'),
        createClassSelector('.container'),
        createIdSelector('#main'),
      ])

      expect(selector.matches(createTestElement('div', { id: 'main', class: 'container' }))).toBe(true)
      expect(selector.matches(createTestElement('div', { id: 'main', class: 'other' }))).toBe(false)
      expect(selector.matches(createTestElement('span', { id: 'main', class: 'container' }))).toBe(false)
      expect(selector.toString()).toBe('div.container#main')
    })
  })

  describe('parseSelector', () => {
    it('throws error for empty selector', () => {
      expect(() => parseSelector('')).toThrow('Empty selector')
      expect(() => parseSelector('   ')).toThrow('Empty selector')
    })

    it('parses simple tag selectors', () => {
      const selector = parseSelector('div')
      expect(selector.matches(createTestElement('div'))).toBe(true)
      expect(selector.matches(createTestElement('span'))).toBe(false)
    })

    it('parses id selectors', () => {
      const selector = parseSelector('#main')
      expect(selector.matches(createTestElement('div', { id: 'main' }))).toBe(true)
      expect(selector.matches(createTestElement('div', { id: 'other' }))).toBe(false)
    })

    it('parses class selectors', () => {
      const selector = parseSelector('.container')
      expect(selector.matches(createTestElement('div', { class: 'container' }))).toBe(true)
      expect(selector.matches(createTestElement('div', { class: 'other' }))).toBe(false)
    })

    it('parses attribute selectors', () => {
      const selector = parseSelector('[data-id]')
      expect(selector.matches(createTestElement('div', { 'data-id': '123' }))).toBe(true)
      expect(selector.matches(createTestElement('div'))).toBe(false)
    })

    it('parses compound selectors', () => {
      const selector = parseSelector('div.container#main[data-id="123"]')
      const element = createTestElement('div', {
        'id': 'main',
        'class': 'container',
        'data-id': '123',
      })

      expect(selector.matches(element)).toBe(true)
      expect(selector.matches(createTestElement('div', { id: 'main' }))).toBe(false)
    })

    it('handles selectors with whitespace', () => {
      const selector = parseSelector('  div.container  ')
      expect(selector.matches(createTestElement('div', { class: 'container' }))).toBe(true)
    })
  })
})
