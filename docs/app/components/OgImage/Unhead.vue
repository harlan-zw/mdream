<script setup lang="ts">
/**
 * @credits Nuxt SEO <https://nuxtseo.com/>
 */

// convert to typescript props
defineProps<{
  title?: string
  description?: string
  frameworkIcon?: string
}>()

const noiseBg = {
  backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`,
  backgroundSize: `100px 100px`,
}
</script>

<template>
  <div
    class="w-full h-full flex justify-between relative p-[60px] bg-zinc-900 text-zinc-50/90"
  >
    <div :style="noiseBg" class="content-[''] absolute top-0 left-0 w-[1200px] h-[600px] opacity-[0.08] pointer-events-none" />
    <svg viewBox="0 0 1440 181" fill="none" xmlns="http://www.w3.org/2000/svg" class="text-yellow-500/20 pointer-events-none top-0 absolute w-[1200px] transition-all flex-shrink-0opacity-20"><mask id="path-1-inside-1_414_5526" fill="white"><path d="M0 0H1440V181H0V0Z" /></mask><path d="M0 0H1440V181H0V0Z" fill="url(#paint0_linear_414_5526)" fill-opacity="0.22" /><path d="M0 2H1440V-2H0V2Z" fill="url(#paint1_linear_414_5526)" mask="url(#path-1-inside-1_414_5526)" /><defs><linearGradient id="paint0_linear_414_5526" x1="720" y1="0" x2="720" y2="181" gradientUnits="userSpaceOnUse"><stop stop-color="currentColor" /><stop offset="1" stop-color="currentColor" stop-opacity="0" /></linearGradient><linearGradient id="paint1_linear_414_5526" x1="0" y1="90.5" x2="1440" y2="90.5" gradientUnits="userSpaceOnUse"><stop stop-color="currentColor" stop-opacity="0" /><stop offset="0.395" stop-color="currentColor" /><stop offset="1" stop-color="currentColor" stop-opacity="0" /></linearGradient></defs></svg>
    <div class="h-full w-full justify-between relative">
      <div class="flex flex-row justify-between items-start">
        <div class="flex flex-col w-full max-w-[65%]">
          <h1 class="m-0 font-bold mb-[30px] text-[75px]">
            {{ title }}
          </h1>
          <p
            v-if="description" class="text-[35px] text-zinc-300"
          >
            {{ description }}
          </p>
        </div>
        <div v-if="frameworkIcon">
          <UIcon mode="svg" :name="frameworkIcon" dynamic class="w-25 h-25 absolute right-1 top-1" />
        </div>
      </div>
      <div class="flex flex-row justify-end items-center text-left w-full">
        <LogoStatic width="60" height="60" />
        <p style="font-size: 35px;" class="font-bold">
          Unhead
        </p>
      </div>
    </div>
  </div>
</template>
