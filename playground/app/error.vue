<script setup lang="ts">
import type { NuxtError } from '#app'
import { ref } from 'vue'

const props = defineProps<{
  error: NuxtError
}>()

const appConfig = useAppConfig()

useSeoMeta({
  title: props.error.statusCode === 404 ? 'Page not found' : props.error.statusMessage,
  description: 'We are sorry but this page could not be found.',
})
const searchTerm = ref('')

const recommendedLinks = ref()
</script>

<template>
  <UApp :toaster="appConfig.toaster">
    <Header />

    <UContainer>
      <UMain class="flex flex-col items-center justify-center">
        <div class="min-h-[60vh] flex gap-10 min-w-[50vw] items-center justify-center px-4 py-12 mb-15">
          <div class="w-4xl max-w-full">
            <!-- Error Title -->
            <h1 class="text-4xl font-bold  mb-4 flex items-center gap-2">
              <UIcon name="i-carbon-warning-square" class="size-15" />
              {{ error.statusCode === 404 ? 'Page Not Found' : 'Something Went Wrong' }}
            </h1>

            <!-- Error Description -->
            <p class="text-xl  text-[var(--ui-text-dimmed)] mb-8">
              {{ error.statusCode === 404 ? 'Oops... we can\'t find that page.' : 'Uh oh, looks like an error :(' }}
            </p>

            <!-- Additional Error Message (if not 404) -->
            <div v-if="error.statusCode !== 404" class="text-red-500 mb-8 p-4 bg-red-50 rounded-lg">
              {{ error.message }}
            </div>

            <!-- Home Link -->
            <div v-else class="mb-3 text-[var(--ui-text-muted)]">
              <div>
                <span class="">Go back</span>
                <NuxtLink
                  to="/"
                  class="text-indigo-600 font-medium hover:text-indigo-500 transition-colors duration-300 underline"
                  @click="clearError"
                >
                  home
                </NuxtLink>
                <span class="">or search elsewhere.</span>
              </div>
            </div>
            <!-- Search Box -->
            <div class="w-1/2">
              <UInput
                type="search"
                class="w-full"
                placeholder="Search..."
                @click="openSearch = true"
              >
                <template #leading>
                  <UContentSearchButton size="sm" class="p-0 opacity-70 hover:opacity-100" />
                </template>
              </UInput>
            </div>
          </div>
        </div>
      </UMain>
    </UContainer>
    <Footer />
    <ClientOnly>
      <LazyUContentSearch
        v-model:search-term="searchTerm"
        :files="search"
        :navigation="searchNav"
        :fuse="{ resultLimit: 42 }"
      />
    </ClientOnly>
  </UApp>
</template>
