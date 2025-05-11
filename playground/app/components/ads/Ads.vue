<script lang="ts" setup>
const route = useRoute()
const key = ref(route.path)

function attachRouteWatcher() {
  watch(() => route.path, (newPath) => {
    key.value = newPath
  })
}
</script>

<template>
  <div>
    <ClientOnly>
      <ScriptCarbonAds
        :key="key"
        format="cover"
        serve="CW7DTKJI"
        placement="unheadunjsio"
        trigger="onNuxtReady"
        @ready="attachRouteWatcher"
      >
        <AdsFallback />
      </ScriptCarbonAds>
    </ClientOnly>
  </div>
</template>

<style>
.dark #carbon-responsive {
  --carbon-padding: 1em;
  --carbon-max-char: 20ch;
  --carbon-bg-primary: var(--ui-bg);
  --carbon-bg-secondary: var(--ui-bg-muted);
  --carbon-text-color: var(--ui-text);
}

#carbon-responsive .carbon-responsive-wrap {
  border-radius: var(--ui-radius);
}
</style>
