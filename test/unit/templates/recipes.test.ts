import { describe, expect, it } from 'vitest'
import { syncHtmlToMarkdown } from '../../../src'

describe('recipes', () => {
  it('tables', () => {
    const html = `<h2 class="mm-recipes-nutrition-facts-summary__heading text-headline-300" colspan="2">Nutrition Facts <span class="mm-recipes-nutrition-facts-summary__heading-aside text-body-100">(per serving)</h2>
<table class="mm-recipes-nutrition-facts-summary__table">
<tbody class="mm-recipes-nutrition-facts-summary__table-body">
<tr class="mm-recipes-nutrition-facts-summary__table-row">
<td class="mm-recipes-nutrition-facts-summary__table-cell text-body-100-prominent">366</td>
<td class="mm-recipes-nutrition-facts-summary__table-cell text-body-100">Calories</td>
</tr>
<tr class="mm-recipes-nutrition-facts-summary__table-row">
<td class="mm-recipes-nutrition-facts-summary__table-cell text-body-100-prominent">7g </td>
<td class="mm-recipes-nutrition-facts-summary__table-cell text-body-100">Fat</td>
</tr>
<tr class="mm-recipes-nutrition-facts-summary__table-row">
<td class="mm-recipes-nutrition-facts-summary__table-cell text-body-100-prominent">68g </td>
<td class="mm-recipes-nutrition-facts-summary__table-cell text-body-100">Carbs</td>
</tr>
<tr class="mm-recipes-nutrition-facts-summary__table-row">
<td class="mm-recipes-nutrition-facts-summary__table-cell text-body-100-prominent">9g </td>
<td class="mm-recipes-nutrition-facts-summary__table-cell text-body-100">Protein</td>
</tr>
</tbody>
</table>
</div>`
    const markdown = syncHtmlToMarkdown(html)
    expect(markdown).toMatchInlineSnapshot(`
      "## Nutrition Facts (per serving)

      | 366 | Calories |
      | --- | --- |
      | 7g | Fat |
      | 68g | Carbs |
      | 9g | Protein |"
    `)
  })
  it.skip('malformed', () => {
    const html = `<div class="mntl-header__menu-button-container">
      <button class="mntl-header__menu-button" aria-label="Main menu for Allrecipes">
        <div class="mntl-header__menu-button-inner">
          <svg class="icon icon-menu mntl-header__menu-icon"
          >
            <use xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="#icon-menu" href="#icon-menu"></use>
          </svg>
          <svg class="icon icon-close mntl-header__close-icon"
          >
            <use xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="#icon-close" href="#icon-close"></use>
          </svg>
          <div>
          foo
      </button>
    </div>`
    const markdown = syncHtmlToMarkdown(html)
    expect(markdown).toMatchInlineSnapshot(`""`)
  })
})
