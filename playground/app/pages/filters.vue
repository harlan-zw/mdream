<script setup>
const url = ref('')
const markdown = ref('')
const isLoading = ref(false)
const error = ref('')
const eventSource = ref(null)
const copied = ref(false)
const ast = ref({ body: '', data: {} })

const filters = reactive({
  minimal: true,
  fromFirstTag: false,
  excludeTags: false,
})

const startTag = ref('article')
const excludedTags = ref('nav, footer, aside')

function cancelConversion() {
  if (eventSource.value) {
    eventSource.value.close()
    eventSource.value = null
    isLoading.value = false
  }
}

async function convertWithFilters() {
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
    // Build filter query parameters
    const filterParams = []

    if (filters.minimal) {
      filterParams.push('minimal')
    }

    if (filters.fromFirstTag) {
      filterParams.push(`from-first-tag:${startTag.value}`)
    }

    if (filters.excludeTags) {
      const tags = excludedTags.value
        .split(',')
        .map(tag => tag.trim())
        .filter(Boolean)
        .join(',')

      if (tags) {
        filterParams.push(`exclude-tags:${tags}`)
      }
    }

    // Create a new EventSource connection
    const encodedUrl = encodeURIComponent(url.value)
    const filtersQuery = filterParams.length > 0
      ? `&filters=${encodeURIComponent(filterParams.join(','))}`
      : ''

    const res = await fetch(`/api/stream?url=${encodedUrl}${filtersQuery}`)

    if (!res.ok) {
      const errorData = await res.json()
      error.value = errorData.message || `Error: ${res.status} ${res.statusText}`
      isLoading.value = false
      return
    }

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

    isLoading.value = false
  }
  catch (err) {
    error.value = err.message || 'Failed to start conversion'
    isLoading.value = false
  }
}

function copyToClipboard() {
  if (!markdown.value)
    return

  navigator.clipboard.writeText(markdown.value)
    .then(() => {
      copied.value = true
      setTimeout(() => {
        copied.value = false
      }, 2000)
    })
    .catch(() => {
      error.value = 'Failed to copy to clipboard'
    })
}

// Set page-specific meta
useHead({
  title: 'Filtering Options - MDream',
  meta: [
    { name: 'description', content: 'Customize your HTML to Markdown conversion with MDream\'s filtering options' },
    { property: 'og:title', content: 'Filtering Options - MDream' },
    { property: 'og:description', content: 'Customize your HTML to Markdown conversion with MDream\'s filtering options' },
  ],
})
</script>

<template>
  <UContainer class="py-10 px-4">
    <div class="max-w-3xl mx-auto">
      <h1 class="font-display text-3xl font-bold mb-6 text-center dark:text-white">
        Filtering Options
      </h1>
      <p class="text-gray-500 dark:text-gray-400 text-center mb-8">
        MDream offers various filtering options to customize your HTML to Markdown conversion
      </p>

      <UCard class="mb-8">
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-adjustments-horizontal" class="text-primary-500" />
            <h2 class="text-xl font-semibold">
              Filter Configuration
            </h2>
          </div>
        </template>

        <div class="space-y-6">
          <UFormGroup label="HTML URL" name="url">
            <UInput
              v-model="url"
              type="url"
              placeholder="https://example.com"
              icon="i-heroicons-globe-alt"
            />
          </UFormGroup>

          <div class="space-y-3">
            <label class="font-medium text-gray-700 dark:text-gray-300">Active Filters</label>
            <div class="space-y-2">
              <UCheckbox
                v-model="filters.minimal"
                label="minimal"
                help="Only convert the most common HTML elements"
              />
              <UCheckbox
                v-model="filters.fromFirstTag"
                label="from-first-tag"
                help="Start conversion from a specific HTML tag"
              />
              <UCheckbox
                v-model="filters.excludeTags"
                label="exclude-tags"
                help="Skip specific HTML tags during conversion"
              />
            </div>
          </div>

          <UDivider />

          <div v-if="filters.fromFirstTag" class="space-y-3">
            <UFormGroup label="Start tag" name="startTag">
              <UInput
                v-model="startTag"
                placeholder="h1, main, article, etc."
                icon="i-heroicons-code-bracket"
              />
              <template #help>
                <span>Specify the HTML tag to start conversion from</span>
              </template>
            </UFormGroup>
          </div>

          <div v-if="filters.excludeTags" class="space-y-3">
            <UFormGroup label="Tags to exclude" name="excludedTags">
              <UInput
                v-model="excludedTags"
                placeholder="nav, footer, aside, etc."
                icon="i-heroicons-no-symbol"
              />
              <template #help>
                <span>Comma-separated list of HTML tags to exclude</span>
              </template>
            </UFormGroup>
          </div>

          <div class="flex items-center gap-2">
            <UButton
              :loading="isLoading"
              :disabled="isLoading || !url"
              color="primary"
              icon="i-heroicons-arrow-path"
              @click="convertWithFilters"
            >
              {{ isLoading ? 'Converting...' : 'Convert with Filters' }}
            </UButton>

            <UButton
              v-if="isLoading"
              color="red"
              variant="soft"
              icon="i-heroicons-x-mark"
              @click="cancelConversion"
            >
              Cancel
            </UButton>
          </div>

          <UProgress v-if="isLoading" indeterminate color="primary" class="mt-4" />

          <UAlert
            v-if="error"
            color="red"
            variant="soft"
            icon="i-heroicons-exclamation-triangle"
            title="Error"
            class="mt-4"
          >
            {{ error }}
          </UAlert>
        </div>
      </UCard>

      <!-- Output section -->
      <UCard v-if="markdown || isLoading" class="mb-8">
        <template #header>
          <div class="flex items-center justify-between w-full">
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-document-text" class="text-primary-500" />
              <h2 class="text-xl font-semibold">
                Filtered Output
              </h2>
            </div>
            <UTooltip text="Copy to clipboard">
              <UButton
                v-if="markdown"
                color="gray"
                variant="ghost"
                icon="i-heroicons-clipboard-document"
                :padded="false"
                @click="copyToClipboard"
              >
                <UIcon
                  v-if="copied"
                  name="i-heroicons-check"
                  class="ml-1 text-green-500"
                />
              </UButton>
            </UTooltip>
          </div>
        </template>

        <div>
          <div v-if="markdown" class="h-full">
            <MDCRenderer
              :body="ast.body"
              :data="ast.data"
              class="prose prose-primary dark:prose-invert max-w-none p-4"
            />
          </div>
          <div v-else class="h-32 flex flex-col items-center justify-center text-gray-400 p-8">
            <UIcon name="i-heroicons-document" class="h-12 w-12 mb-2 opacity-25" />
            <p class="text-center">
              Output will appear here
            </p>
          </div>
        </div>
      </UCard>

      <!-- Filter examples -->
      <div class="mt-16">
        <h2 class="text-xl font-display font-bold text-center mb-8 dark:text-white">
          Filter Examples
        </h2>

        <div class="grid md:grid-cols-2 gap-6">
          <UCard>
            <template #header>
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-code-bracket" class="text-primary-500" />
                <h3 class="font-semibold">
                  Minimal Mode
                </h3>
              </div>
            </template>
            <UCodeBlock
              language="javascript" code="import { htmlToMarkdown } from 'mdream'

const html = '...'
const markdown = htmlToMarkdown(html, {
  filters: 'minimal'
})

// Only converts common tags like headings,
// paragraphs, lists, and basic formatting"
            />
          </UCard>

          <UCard>
            <template #header>
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-code-bracket" class="text-primary-500" />
                <h3 class="font-semibold">
                  From First Tag
                </h3>
              </div>
            </template>
            <UCodeBlock
              language="javascript" code="import { htmlToMarkdown } from 'mdream'

const html = '...'
const markdown = htmlToMarkdown(html, {
  filters: {
    'from-first-tag': {
      tag: 'article'
    }
  }
})

// Conversion starts at the first <article> tag
// and ignores all content before it"
            />
          </UCard>

          <UCard>
            <template #header>
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-code-bracket" class="text-primary-500" />
                <h3 class="font-semibold">
                  Exclude Tags
                </h3>
              </div>
            </template>
            <UCodeBlock
              language="javascript" code="import { htmlToMarkdown } from 'mdream'

const html = '...'
const markdown = htmlToMarkdown(html, {
  filters: {
    'exclude-tags': {
      tags: ['nav', 'footer', 'aside']
    }
  }
})

// Ignores content inside specified tags
// Great for cleaning webpage content"
            />
          </UCard>

          <UCard>
            <template #header>
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-code-bracket" class="text-primary-500" />
                <h3 class="font-semibold">
                  Combined Filters
                </h3>
              </div>
            </template>
            <UCodeBlock
              language="javascript" code="import { htmlToMarkdown } from 'mdream'

const html = '...'
const markdown = htmlToMarkdown(html, {
  filters: [
    'minimal',
    {
      'from-first-tag': { tag: 'main' },
      'exclude-tags': { tags: ['nav', 'script'] }
    }
  ]
})

// Filters can be combined for maximum effect"
            />
          </UCard>
        </div>
      </div>
    </div>
  </UContainer>
</template>
