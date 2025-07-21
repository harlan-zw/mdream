<script setup lang="ts">
const shape = {
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  strokeWidth: 3,
  fill: 'transparent',
}
</script>

<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
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

    <!-- U shape with animation -->
    <path
      stroke="url(#modernGradient)"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="3"
      d="M6 4v14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4"
      mask="url(#cutoutMask)"
      :style="shape"
    />
  </svg>
</template>
