<script lang="ts">
import type { AppConfig } from '@nuxt/schema'
import _appConfig from '#build/app.config'
import theme from '#build/ui-pro/prose/pre'
import { tv } from '#ui-pro/utils/tv'
</script>

<script setup lang="ts">
import { useAppConfig } from '#imports'
import CodeIcon from '#ui-pro/components/prose/CodeIcon.vue'
import { useLocalePro } from '#ui-pro/composables/useLocalePro'
import { useClipboard } from '@vueuse/core'
import { ref } from 'vue'

const props = defineProps<{
  icon?: string
  code?: string
  language?: string
  filename?: string
  highlights?: number[]
  hideHeader?: boolean
  meta?: string
  class?: any
  ui?: Partial<typeof prosePre.slots>
}>()

const appConfigProsePre = _appConfig as AppConfig & { uiPro: { prose: { pre: Partial<typeof theme> } } }

const prosePre = tv({ extend: tv(theme), ...(appConfigProsePre.uiPro?.prose?.pre || {}) })

const slots = useSlots()

const ui = prosePre()

const clipboard = useClipboard()
const appConfig = useAppConfig()
const { t } = useLocalePro()

const copied = ref(false)

function copy() {
  clipboard.copy(props.code || '')

  copied.value = true

  setTimeout(() => {
    copied.value = false
  }, 2000)
}

const { selectedFramework } = useFrameworkSelector()

// look at default slot content
const processedContent = computed(() => {
  const defaultSlot = slots.default?.()
  if (!defaultSlot)
    return defaultSlot

  // Create a deep copy of the VNodes to avoid mutating the original
  return defaultSlot.map((vnode) => {
    if (!vnode.children)
      return vnode

    // Process the content recursively
    const processNode = (node) => {
      if (Array.isArray(node)) {
        // Process arrays of children
        return node.map(processNode)
      }
      else if (typeof node === 'string') {
        return node
          .replace('@unhead/dynamic-import', `@unhead/${selectedFramework.value.slug}`)
          .replace('@FRAMEWORK_NAME@', selectedFramework.value.label)
      }
      else if (typeof node === 'object') {
        node.children = processNode(node.children)
      }
      return node
    }

    // Return a cloned node with processed content
    return h(vnode.type, vnode.props, processNode(vnode.children))
  })
})
</script>

<template>
  <div :class="ui.root({ class: [props.ui?.root], filename: !!filename })">
    <div v-if="filename && !hideHeader" :class="ui.header({ class: props.ui?.header })">
      <CodeIcon :icon="icon" :filename="filename" :class="ui.icon({ class: props.ui?.icon })" />

      <span :class="ui.filename({ class: props.ui?.filename })">{{ filename }}</span>
    </div>

    <UButton
      :icon="copied ? appConfig.ui.icons.copyCheck : appConfig.ui.icons.copy"
      color="neutral"
      variant="outline"
      size="sm"
      :aria-label="t('prose.pre.copy')"
      :class="ui.copy({ class: props.ui?.copy })"
      tabindex="-1"
      @click="copy"
    />

    <pre v-bind="$attrs" :key="selectedFramework.slug" :class="ui.base({ class: [props.class, props.ui?.base] })"><component :is="{ render: () => processedContent }" /></pre>
  </div>
</template>

<style>
.shiki span.line{display:block}.shiki span.line.highlight{margin:0 -16px;padding:0 16px;@apply bg-(--ui-bg-accented)/50}
</style>
