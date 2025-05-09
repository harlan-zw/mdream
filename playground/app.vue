<template>
<div class="min-h-screen bg-gray-100">
  <div class="container mx-auto py-8 px-4">
    <h1 class="text-3xl font-bold mb-8 text-center">HTML to Markdown Converter</h1>

    <div class="grid md:grid-cols-2 gap-8">
      <!-- Input section -->
      <div class="bg-white rounded-lg shadow p-6">
        <h2 class="text-xl font-semibold mb-4">Input HTML URL</h2>

        <form @submit.prevent="convertUrl" class="space-y-4">
          <div>
            <label for="url" class="block text-sm font-medium text-gray-700 mb-1">URL</label>
            <input
              id="url"
              v-model="url"
              type="url"
              placeholder="https://example.com"
              class="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          <div class="flex items-center space-x-4">
            <button
              type="submit"
              class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              :disabled="isLoading"
            >
              {{ isLoading ? 'Converting...' : 'Convert' }}
            </button>

            <button
              v-if="isLoading"
              @click="cancelConversion"
              type="button"
              class="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            >
              Cancel
            </button>
          </div>
        </form>

        <div v-if="isLoading" class="mt-4">
          <div class="flex items-center">
            <div class="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div class="h-full bg-blue-600 rounded-full animate-pulse"></div>
            </div>
            <span class="ml-3 text-sm text-gray-600">Streaming...</span>
          </div>
        </div>

        <div v-if="error" class="mt-4 p-3 bg-red-100 text-red-700 rounded-md">
          {{ error }}
        </div>
      </div>

      <!-- Output section -->
      <div class="bg-white rounded-lg shadow overflow-hidden flex flex-col">
        <div class="p-4 border-b">
          <div class="flex justify-between items-center">
            <h2 class="text-xl font-semibold">Markdown Output</h2>
            <button
              v-if="markdown"
              @click="copyToClipboard"
              class="text-sm px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              {{ copied ? 'Copied!' : 'Copy' }}
            </button>
          </div>
        </div>

        <div class="flex-1 overflow-auto p-4">
          <pre v-if="markdown" class="whitespace-pre-wrap font-mono text-sm bg-gray-50 p-4 rounded h-full">
            <MDCRenderer :body="ast.body" :data="ast.data" />
          </pre>
          <div v-else class="text-gray-500 italic h-full flex items-center justify-center">
            Enter a URL and click Convert to see the result
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
</template>

<script setup>
const url = ref('');
const markdown = ref('');
const isLoading = ref(false);
const error = ref('');
const eventSource = ref(null);
const copied = ref(false);
const ast = ref({ body: '', data: {} });

function cancelConversion() {
  if (eventSource.value) {
    eventSource.value.close();
    eventSource.value = null;
    isLoading.value = false;
  }
}

async function convertUrl() {
  if (!url.value) return;

  // Reset state
  markdown.value = '';
  error.value = '';
  isLoading.value = true;
  copied.value = false;

  // Close any existing event source
  cancelConversion();

  try {
    // Create a new EventSource connection
    const encodedUrl = encodeURIComponent(url.value);
    // eventSource.value = new EventSource(`/api/sse?url=${encodedUrl}`);
    // do fetching stream instead
    const res = await fetch(`/api/stream?url=${encodedUrl}`)

    // read res as stream
    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      markdown.value += chunk;
      ast.value = await parseMarkdown(markdown.value)
    }
    cancelConversion();
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
  } catch (err) {
    error.value = err.message || 'Failed to start conversion';
    isLoading.value = false;
  }
}

function copyToClipboard() {
  if (!markdown.value) return;

  navigator.clipboard.writeText(markdown.value)
    .then(() => {
      copied.value = true;
      setTimeout(() => {
        copied.value = false;
      }, 2000);
    })
    .catch(() => {
      error.value = 'Failed to copy to clipboard';
    });
}
</script>
