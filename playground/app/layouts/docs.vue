<script lang="ts" setup>
import { motion } from 'motion-v'
import { useCurrentDocPage } from '~/composables/data'

const route = useRoute()

const page = ref()
const { page: docPage } = await useCurrentDocPage()
page.value = docPage.value
watch(() => route.path, async () => {
  const { page: docPage } = await useCurrentDocPage()
  page.value = docPage.value
})
</script>

<template>
  <UMain class="relative mb-20 px-5">
    <svg viewBox="0 0 1440 181" fill="none" xmlns="http://www.w3.org/2000/svg" class="text-yellow-500/30 left-0 pointer-events-none absolute max-w-full -top-px transition-all flex-shrink-0 duration-[400ms] opacity-20 z-20"><mask id="path-1-inside-1_414_5526" fill="white"><path d="M0 0H1440V181H0V0Z" /></mask><path d="M0 0H1440V181H0V0Z" fill="url(#paint0_linear_414_5526)" fill-opacity="0.22" /><path d="M0 2H1440V-2H0V2Z" fill="url(#paint1_linear_414_5526)" mask="url(#path-1-inside-1_414_5526)" /><defs><linearGradient id="paint0_linear_414_5526" x1="720" y1="0" x2="720" y2="181" gradientUnits="userSpaceOnUse"><stop stop-color="currentColor" /><stop offset="1" stop-color="currentColor" stop-opacity="0" /></linearGradient><linearGradient id="paint1_linear_414_5526" x1="0" y1="90.5" x2="1440" y2="90.5" gradientUnits="userSpaceOnUse"><stop stop-color="currentColor" stop-opacity="0" /><stop offset="0.395" stop-color="currentColor" /><stop offset="1" stop-color="currentColor" stop-opacity="0" /></linearGradient></defs></svg>
    <div class="max-w-[1400px] mx-auto lg:pt-5">
      <UPage :ui="{ left: 'lg:col-span-3', right: 'lg:col-span-2 hidden lg:block', center: 'lg:col-span-5' }">
        <template #right>
          <div>
            <div class="pl-10">
              <div class="mt-5 flex items-center gap-2  text-[var(--ui-text-accented)]">
                <UIcon name="i-tabler-align-left-2" class="size-4 " />
                <div class="text-xs  font-medium">
                  On this page
                </div>
              </div>
              <div class="my-5">
                <TableOfContents v-if="page?.body?.toc?.links?.length > 1" :links="page.body?.toc?.links" />
              </div>
              <Ads />
            </div>
          </div>
        </template>
        <template #left>
          <UPageAside class="max-w-[260px] pt-5 px-5">
            <DocsSidebarHeader />
          </UPageAside>
        </template>
        <AnimatePresence mode="wait">
          <motion.div
            :key="route.path"
            :initial="{ opacity: 0, y: 16, filter: 'blur(0.2rem)' }"
            :animate="{ opacity: 1, y: 0, filter: 'blur(0)' }"
            :exit="{ opacity: 0, y: 16, filter: 'blur(0.2rem)' }"
            :transition="{
              duration: 0.2,
            }"
          >
            <slot />
          </motion.div>
        </AnimatePresence>
      </UPage>
    </div>
  </UMain>
</template>
