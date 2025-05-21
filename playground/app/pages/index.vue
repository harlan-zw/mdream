<script setup lang="ts">
definePageMeta({
  breadcrumb: {
    icon: 'i-heroicons-home',
    ariaLabel: 'Home',
  },
})

useSeoMeta({
  title: '%siteName %separator Full stack <head> package',
  ogTitle: '%siteName %separator Full stack <head> package',
  titleTemplate: null,
})

defineOgImageComponent('Home')

if (import.meta.server) {
  useHead({
    link: [
      {
        rel: 'dns-prefetch',
        href: 'https://avatars.githubusercontent.com',
      },
    ],
  })
}

const url = ref('')
const markdown = ref('')
const isLoading = ref(false)
const error = ref('')
const eventSource = ref(null)
const copied = ref(false)
const ast = ref({ body: '', data: {} })

function cancelConversion() {
  if (eventSource.value) {
    eventSource.value.close()
    eventSource.value = null
    isLoading.value = false
  }
}

async function convertUrl() {
  if (!url.value)
    return

  // Reset state
  markdown.value = ''
  error.value = ''
  isLoading.value = true
  copied.value = false

  // Close any existing event source
  cancelConversion()

  try {
    // Create a new EventSource connection
    const encodedUrl = encodeURIComponent(url.value)
    // eventSource.value = new EventSource(`/api/sse?url=${encodedUrl}`);
    // do fetching stream instead
    const res = await fetch(`/api/stream?url=${encodedUrl}`)

    // read res as stream
    const reader = res.body.getReader()
    const decoder = new TextDecoder('utf-8')
    while (true) {
      const { done, value } = await reader.read()
      if (done)
        break
      const chunk = decoder.decode(value, { stream: true })
      markdown.value += chunk
      ast.value = await parseMarkdown(markdown.value)
    }
    cancelConversion()
    // // Handle incoming markdown chunks
    // eventSource.value.onmessage = (event) => {
    //   markdown.value += event.data;
    //   console.log(event)
    // };
    //
    // // Handle errors
    // eventSource.value.onerror = (err) => {
    //   console.log(arguments)
    //   error.value = 'Error streaming content. Please try again.';
    //   cancelConversion();
    // };
    //
    // // Handle completion
    // eventSource.value.addEventListener('complete', () => {
    //   isLoading.value = false;
    //   cancelConversion();
    // });
  }
  catch (err) {
    error.value = err.message || 'Failed to start conversion'
    isLoading.value = false
  }
}
</script>

<template>
  <div>
    <div class="gradient" />

    <section class="xl:[1200px] max-w-3xl mx-auto py-5 sm:py-12">
      <UContainer class="container mx-auto">
        <div class="">
          <div class="flex flex-col justify-center">
            <h1 class="max-w-2xl text-neutral-900/90 dark:text-neutral-100 text-4xl md:text-6xl leading-tight font-bold tracking-tight" style="line-height: 1.3;">
              Parse <span class="font-cursive text-yellow-500">&lt;html&gt;</span> for LLMs with <span class="italic dark:text-neutral-200 text-neutral-800 ">half of the tokens</span>
            </h1>
            <ul>
              <li>Human friendly output</li>
              <li>Less Tokens.</li>
              <li>More accurate insights.</li>
            </ul>
            <p class="max-w-xl text-neutral-700 dark:text-neutral-300 mt-4 max-w-3xl text-base md:text-xl">
              Mdream is an ultra Performant HTML to Markdown optimized for LLMs & Human readability
            </p>
          </div>
          <UCard class="mt-10">
            <h2 class="text-xl font-semibold mb-4">
              Input HTML URL
            </h2>

            <form class="space-y-4" @submit.prevent="convertUrl">
              <div>
                <label for="url" class="block text-sm font-medium text-gray-700 mb-1">URL</label>
                <input
                  id="url"
                  v-model="url"
                  type="url"
                  placeholder="https://example.com"
                  class="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
              </div>

              <div class="flex items-center space-x-4">
                <button
                  type="submit"
                  class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  :disabled="isLoading"
                >
                  {{ isLoading ? 'Mdreaming...' : 'Mdream' }}
                </button>

                <button
                  v-if="isLoading"
                  type="button"
                  class="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                  @click="cancelConversion"
                >
                  Cancel
                </button>
              </div>
            </form>

            <div v-if="isLoading" class="mt-4">
              <div class="flex items-center">
                <div class="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div class="h-full bg-blue-600 rounded-full animate-pulse" />
                </div>
                <span class="ml-3 text-sm text-gray-600">Streaming...</span>
              </div>
            </div>

            <div v-if="error" class="mt-4 p-3 bg-red-100 text-red-700 rounded-md">
              {{ error }}
            </div>
          </UCard>
        </div>
      </UContainer>
    </section>
  </div>
</template>
