<script setup lang="ts">
import { useContentSearch } from '#ui-pro/composables/useContentSearch'

const { open: openSearch } = useContentSearch()

onKeyStroke('Divide', () => {
  openSearch.value = true
})
</script>

<template>
  <UHeader :ui="{ root: 'border-none bg-transparent pt-2 mb-3 px-5 h-auto', container: 'max-w-[600px] lg:bg-gray-600/3 lg:border border-[var(--ui-border)] lg:dark:bg-gray-900/10 mx-auto py-0 px-0 lg:px-5 sm:px-0 rounded-lg' }">
    <template #left>
      <NuxtLink
        to="/"
        title="Home" aria-label="Title"
        class="flex mr-4 items-end gap-1.5 font-bold text-base text-(--ui-text-highlighted) font-title"
      >
        <Logo />
      </NuxtLink>
      <div class="hidden lg:flex items-center gap-2">
        <!--        <UNavigationMenu highlight :items="menu.slice(0, 4)" class="justify-center" /> -->
      </div>
    </template>

    <template #body />

    <template #right>
      <div class="flex items-center justify-end lg:-mr-1.5 gap-3">
        <div class="hidden lg:block" />
        <div class="flex items-center lg:gap-1.5">
          <ColorModeButton />

          <UButton
            aria-label="Unhead on GitHub"
            to="https://github.com/unjs/unhead"
            target="_blank"
            color="neutral"
            variant="ghost"
            class="hidden lg:inline-flex transition opacity-85"
            icon="i-carbon-logo-github"
          />
        </div>
      </div>
    </template>
  </UHeader>
</template>
