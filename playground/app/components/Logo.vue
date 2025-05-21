<script setup lang="ts">
import { motion } from 'motion-v'
</script>

<template>
  <div class="flex items-center relative">
    <img src="/logo.png" alt="Logo" class="w-15 h-15 absolute -left-10 -top-3">
    <motion.svg
      v-bind="{ xmlns: 'http://www.w3.org/2000/svg' }"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      initial="hidden"
      animate="visible"
      class="mr-1"
    >
      <defs>
        <linearGradient id="modernGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#FBBF24" />
          <stop offset="100%" style="stop-color:#f0db4f" />
        </linearGradient>
        <mask id="cutoutMask">
          <rect width="100%" height="100%" fill="white" />
          <path d="M12 32 L1 32 L15 15 Z" fill="black" />
        </mask>
      </defs>
    </motion.svg>
    <motion.span
      v-for="(l, i) in 'Mdream'"
      :key="i"
      :initial="{ opacity: 0, x: -5 + 1 * i }"
      :animate="{ opacity: 1, x: 0 + 1 }"
      :transition="{ delay: 0.8, duration: 0.3 + i * 0.1 }"
    >
      {{ l }}
    </motion.span>
  </div>
</template>
