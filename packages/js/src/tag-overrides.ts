import type { TagHandler, TagOverride } from './types'
import { TagIdMap } from './const'

export function buildTagOverrideHandlers(
  overrides: Record<string, TagOverride | string>,
  tagHandlers: Record<number, TagHandler>,
): Map<string, TagHandler> {
  const result = new Map<string, TagHandler>()

  for (const tagName in overrides) {
    const override = overrides[tagName]
    if (!override)
      continue

    if (typeof override === 'string') {
      const targetId = TagIdMap[override as keyof typeof TagIdMap]
      if (targetId !== undefined)
        result.set(tagName, { ...tagHandlers[targetId], aliasTagId: targetId })
      continue
    }

    const baseId = TagIdMap[tagName as keyof typeof TagIdMap]
    const baseHandler = baseId === undefined ? undefined : tagHandlers[baseId]
    const handler: TagHandler = baseHandler ? { ...baseHandler } : {}

    if (override.enter !== undefined) {
      const output = override.enter
      handler.enter = () => output
      handler.literalEnter = true
    }
    if (override.exit !== undefined) {
      const output = override.exit
      handler.exit = () => output
      handler.literalExit = true
    }
    if (override.spacing !== undefined)
      handler.spacing = override.spacing
    if (override.isInline !== undefined)
      handler.isInline = override.isInline
    if (override.isSelfClosing !== undefined)
      handler.isSelfClosing = override.isSelfClosing
    if (override.collapsesInnerWhiteSpace !== undefined)
      handler.collapsesInnerWhiteSpace = override.collapsesInnerWhiteSpace

    result.set(tagName, handler)
  }

  return result
}
