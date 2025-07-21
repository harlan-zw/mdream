<script setup lang="ts">
import type { TocLink } from '@nuxt/content'
import type { PropType } from 'vue'

defineOptions({
  inheritAttrs: false,
})

defineProps({
  links: {
    type: Array as PropType<TocLink[]>,
    default: () => [],
  },
  class: {
    type: [String, Object, Array] as PropType<any>,
    default: undefined,
  },
  ui: {
    type: Object as PropType<Partial<typeof config>>,
    default: () => ({}),
  },
})

const emit = defineEmits(['move'])

const config = {
  wrapper: 'space-y-1',
  base: 'inline-block text-base truncate max-w-full',
  active: 'text-(--ui-primary)',
  inactive: 'text-(--ui-text-muted) transition dark:text-neutral-300 hover:text-neutral-700 dark:hover:text-neutral-200',
  depth: 'ml-3',
}

const router = useRouter()

function scrollToHeading(id: string) {
  const encodedId = encodeURIComponent(id)
  router.push(`#${encodedId}`)
  emit('move', id)
}
</script>

<template>
  <ul v-if="links?.length" :class="config.wrapper">
    <li v-for="link in links" :key="link.text" :class="[config.wrapper, link.depth === 3 && config.depth]">
      <a
        :href="`#${link.id}`"
        :class="[config.base, config.inactive]"
        class="text-sm"
        @click.prevent="scrollToHeading(link.id)"
      >
        {{ link.text }}
      </a>
    </li>
  </ul>
</template>
