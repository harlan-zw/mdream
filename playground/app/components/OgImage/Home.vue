<script setup lang="ts">
const noiseBg = {
  backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`,
  backgroundSize: `100px 100px`,
}

const { frameworks } = useFrameworkSelector()
</script>

<template>
  <div
    class="w-full h-full flex justify-between relative p-[60px] bg-zinc-900 text-zinc-50/90"
  >
    <div :style="noiseBg" class="content-[''] absolute top-0 left-0 w-[1200px] h-[600px] opacity-[0.08] pointer-events-none" />
    <svg viewBox="0 0 1440 181" fill="none" xmlns="http://www.w3.org/2000/svg" class="text-yellow-500/20 pointer-events-none top-0 absolute w-[1200px] transition-all flex-shrink-0opacity-20"><mask id="path-1-inside-1_414_5526" fill="white"><path d="M0 0H1440V181H0V0Z" /></mask><path d="M0 0H1440V181H0V0Z" fill="url(#paint0_linear_414_5526)" fill-opacity="0.22" /><path d="M0 2H1440V-2H0V2Z" fill="url(#paint1_linear_414_5526)" mask="url(#path-1-inside-1_414_5526)" /><defs><linearGradient id="paint0_linear_414_5526" x1="720" y1="0" x2="720" y2="181" gradientUnits="userSpaceOnUse"><stop stop-color="currentColor" /><stop offset="1" stop-color="currentColor" stop-opacity="0" /></linearGradient><linearGradient id="paint1_linear_414_5526" x1="0" y1="90.5" x2="1440" y2="90.5" gradientUnits="userSpaceOnUse"><stop stop-color="currentColor" stop-opacity="0" /><stop offset="0.395" stop-color="currentColor" /><stop offset="1" stop-color="currentColor" stop-opacity="0" /></linearGradient></defs></svg>
    <div class="h-full w-full justify-between relative">
      <div class="relative h-full flex items-center justify-center w-full">
        <div class="flex flex-row justify-center items-center text-left w-full mb-5">
          <LogoStatic width="100" height="100" />
          <p style="font-size: 60px;" class="font-bold">
            Unhead
          </p>
        </div>
        <p :style="{ fontSize: '40px' }" class="mb-15">
          The <span class="italic dark:text-neutral-200 text-neutral-800">full stack</span> <span class="font-cursive text-yellow-500">&lt;head&gt;</span> package for <span class="bg-green-500/10 dark:bg-green-400/40 px-2"> any framework</span>.
        </p>
        <div class="flex flex-wrap gap-5 items-center justify-center relative">
          <div v-for="framework in frameworks" :key="framework.slug">
            <UIcon dynamic mode="svg" :name="framework.icon" :class="framework.slug === 'nuxt' ? 'w-25 h-20 p-3' : 'w-20 h-20 p-3'" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
