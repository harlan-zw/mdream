<script setup lang="ts">
</script>

<template>
  <footer class="relative z-10 antialiased font-sans dark:bg-[#82AAFF]/4 bg-neutral-50/50 text-sm text-neutral-700 dark:text-neutral-200">
    <svg viewBox="0 0 1440 181" fill="none" xmlns="http://www.w3.org/2000/svg" class="text-blue-900/30 pointer-events-none absolute w-full top-[1px] transition-all text-(--ui-primary) flex-shrink-0 opacity-100 duration-[400ms] opacity-30 z-20"><mask id="path-1-inside-1_414_5526" fill="white"><path d="M0 0H1440V181H0V0Z" /></mask><path d="M0 0H1440V181H0V0Z" fill="url(#paint0_linear_414_5526)" fill-opacity="0.22" /><path d="M0 2H1440V-2H0V2Z" fill="url(#paint1_linear_414_5526)" mask="url(#path-1-inside-1_414_5526)" /><defs><linearGradient id="paint0_linear_414_5526" x1="720" y1="0" x2="720" y2="181" gradientUnits="userSpaceOnUse"><stop stop-color="currentColor" /><stop offset="1" stop-color="currentColor" stop-opacity="0" /></linearGradient><linearGradient id="paint1_linear_414_5526" x1="0" y1="90.5" x2="1440" y2="90.5" gradientUnits="userSpaceOnUse"><stop stop-color="currentColor" stop-opacity="0" /><stop offset="0.395" stop-color="currentColor" /><stop offset="1" stop-color="currentColor" stop-opacity="0" /></linearGradient></defs></svg>
    <div class="border-t border-neutral-200 dark:border-neutral-800 ">
      <UContainer class="container py-10">
        <div class="flex lg:flex-row flex-col items-center justify-between gap-3 mb-10">
          <div class="sm:flex items-center justify-between gap-3 ">
            <UButton
              aria-label="Unhead on GitHub"
              to="https://github.com/unjs/unhead"
              target="_blank"
              color="neutral"
              variant="ghost"
              class="transition opacity-85"
              icon="i-carbon-logo-github"
            >
              GitHub
            </UButton>
            <UButton
              aria-label="Harlan's Discord"
              to="https://discord.com/invite/275MBUBvgP"
              target="_blank"
              color="neutral"
              variant="ghost"
              class="transition opacity-85"
              icon="i-carbon-logo-discord"
            >
              Discord
            </UButton>
            <ColorModeButton verbose />
            <ULink target="_blank" external href="/llms.txt" class="flex items-center gap-1 hover:underline transition">
              <UIcon dynamic name="i-noto-sparkles" class="w-4 h-4" />
              /llms.txt
            </ULink>
          </div>
          <div class="flex items-center justify-center gap-10">
            <UButton target="_blank" variant="ghost" to="https://unjs.io/" class="flex gap-3 items-center">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <g clip-path="url(#clip0_206_4645)">
                  <mask id="mask0_206_4645" style="mask-type:luminance" maskUnits="userSpaceOnUse" x="0" y="0" width="32" height="32">
                    <path d="M32 0H0V32H32V0Z" fill="white" />
                  </mask>
                  <g mask="url(#mask0_206_4645)">
                    <path d="M31.9142 32.0223C21.2766 32.0223 10.6506 32.0223 0.0246745 32.0223C0.0238272 32.0194 0.0222373 32.0166 0.0222373 32.0137C0.0221323 21.3508 0.0221329 10.688 0.0221329 0.0236816C10.6877 0.0236816 21.3534 0.0236816 32.0206 0.0236816C32.0206 10.6878 32.0206 21.3533 32.0206 32.0223C31.9901 32.0223 31.958 32.0223 31.9142 32.0223ZM26.4121 20.9345C26.361 20.8762 26.3128 20.8153 26.2585 20.7601C25.6577 20.1492 24.9011 20.0218 24.0955 20.0946C23.3969 20.1577 22.7984 20.4652 22.2811 20.9345C22.2532 20.9598 22.2227 20.9823 22.1824 21.0151C22.1824 20.9497 22.185 20.902 22.182 20.8546C22.1669 20.6225 22.0579 20.4465 21.8514 20.3407C21.649 20.2371 21.4421 20.247 21.2512 20.3689C21.0389 20.5045 20.9665 20.713 20.9667 20.958C20.9682 22.7933 20.9675 24.6286 20.9675 26.4639C20.9675 26.5784 20.9652 26.693 20.968 26.8074C20.9751 27.102 21.1313 27.3354 21.3685 27.4101C21.7847 27.5411 22.1817 27.2525 22.1823 26.8136C22.1839 25.5543 22.1836 24.2951 22.1824 23.0359C22.1821 22.6812 22.2717 22.356 22.4979 22.0791C23.025 21.434 23.7075 21.1616 24.5332 21.2556C24.9353 21.3015 25.2602 21.4881 25.4831 21.8327C25.6923 22.1561 25.7639 22.5212 25.7668 22.8971C25.7747 23.9347 25.7716 24.9724 25.7727 26.01C25.7731 26.2943 25.7683 26.5788 25.7739 26.863C25.7826 27.3076 26.2605 27.5828 26.6518 27.3716C26.9007 27.2373 26.9891 27.0176 26.9888 26.7463C26.9873 25.5683 26.9907 24.3903 26.9862 23.2123C26.9852 22.9326 26.9757 22.6511 26.9432 22.3735C26.883 21.8589 26.7401 21.3697 26.4121 20.9345ZM18.7519 20.2768C18.6788 20.282 18.6027 20.2759 18.5331 20.2944C18.2433 20.3715 18.0835 20.6019 18.0833 20.9365C18.0826 22.1367 18.0851 23.337 18.081 24.5372C18.0803 24.7357 18.07 24.9372 18.035 25.1319C17.9425 25.6461 17.6668 26.0312 17.1721 26.2263C16.6902 26.4164 16.194 26.423 15.695 26.2875C15.3165 26.1848 15.0263 25.9676 14.8367 25.6226C14.7009 25.3752 14.6347 25.1055 14.6298 24.8266C14.6199 24.2617 14.6232 23.6966 14.6226 23.1316C14.6218 22.4004 14.6236 21.6691 14.6219 20.9379C14.6211 20.5778 14.3819 20.295 14.069 20.2767C13.6814 20.254 13.4081 20.518 13.4076 20.9221C13.4063 22.1556 13.4047 23.389 13.4085 24.6225C13.4099 25.0635 13.4572 25.4984 13.6251 25.9135C13.9436 26.701 14.5379 27.1764 15.3353 27.4077C15.8372 27.5533 16.3542 27.5622 16.8722 27.5012C17.2723 27.4541 17.6549 27.3449 18.0035 27.1424C18.8265 26.6641 19.2453 25.9203 19.2718 24.9916C19.3108 23.63 19.2949 22.2667 19.2963 20.9041C19.2968 20.5622 19.0957 20.3353 18.7519 20.2768Z" fill="#ECDC5A" />
                    <path d="M26.4164 20.9411C26.7401 21.3697 26.883 21.8589 26.9432 22.3735C26.9757 22.6511 26.9852 22.9326 26.9862 23.2123C26.9907 24.3903 26.9873 25.5683 26.9888 26.7463C26.9891 27.0176 26.9007 27.2373 26.6518 27.3716C26.2605 27.5828 25.7825 27.3076 25.7739 26.863C25.7683 26.5787 25.773 26.2943 25.7728 26.01C25.7716 24.9723 25.7746 23.9347 25.7668 22.8971C25.7639 22.5212 25.6923 22.1561 25.4831 21.8327C25.2603 21.488 24.9353 21.3014 24.5332 21.2556C23.7076 21.1616 23.025 21.434 22.4979 22.0791C22.2718 22.356 22.182 22.6812 22.1824 23.0358C22.1836 24.2951 22.1839 25.5543 22.1823 26.8136C22.1817 27.2525 21.7847 27.5411 21.3686 27.4101C21.1313 27.3354 20.9751 27.102 20.968 26.8074C20.9653 26.6929 20.9676 26.5784 20.9676 26.4639C20.9676 24.6286 20.9682 22.7933 20.9667 20.9579C20.9665 20.713 21.039 20.5045 21.2512 20.3689C21.4421 20.2469 21.649 20.2371 21.8513 20.3407C22.0578 20.4465 22.1669 20.6224 22.182 20.8546C22.185 20.9019 22.1824 20.9497 22.1824 21.015C22.2227 20.9823 22.2532 20.9598 22.2811 20.9344C22.7984 20.4652 23.3969 20.1577 24.0955 20.0946C24.901 20.0218 25.6577 20.1492 26.2585 20.7601C26.3127 20.8153 26.361 20.8762 26.4164 20.9411Z" fill="#111827" />
                    <path d="M18.7618 20.2773C19.0957 20.3354 19.2968 20.5622 19.2963 20.9041C19.2949 22.2667 19.3108 23.63 19.2718 24.9916C19.2453 25.9204 18.8265 26.6641 18.0035 27.1424C17.6549 27.345 17.2723 27.4542 16.8722 27.5012C16.3542 27.5622 15.8372 27.5534 15.3353 27.4078C14.5379 27.1764 13.9436 26.701 13.6251 25.9135C13.4572 25.4984 13.4099 25.0635 13.4085 24.6225C13.4047 23.3891 13.4063 22.1556 13.4076 20.9221C13.4081 20.518 13.6814 20.2541 14.069 20.2767C14.3819 20.2951 14.6211 20.5779 14.6219 20.938C14.6236 21.6692 14.6218 22.4004 14.6226 23.1316C14.6232 23.6966 14.6199 24.2618 14.6298 24.8266C14.6347 25.1055 14.7009 25.3753 14.8367 25.6226C15.0263 25.9677 15.3165 26.1848 15.695 26.2876C16.1939 26.423 16.6902 26.4164 17.1721 26.2263C17.6668 26.0313 17.9425 25.6461 18.035 25.132C18.07 24.9372 18.0803 24.7358 18.081 24.5373C18.0851 23.337 18.0826 22.1368 18.0833 20.9366C18.0835 20.602 18.2433 20.3715 18.5331 20.2944C18.6027 20.2759 18.6788 20.282 18.7618 20.2773Z" fill="#111827" />
                  </g>
                </g>
                <defs>
                  <clipPath id="clip0_206_4645">
                    <rect width="32" height="32" rx="2" fill="white" />
                  </clipPath>
                </defs>
              </svg>
              <div class="text-[var(--ui-text-muted)]">
                Part of the UnJS ecosystem
              </div>
            </UButton>
          </div>
        </div>
        <div class="md:grid flex flex-col gap-5 grid-cols-3 xl:grid-cols-5 mx-auto">
          <div class="flex ">
            <div class="inline" />
          </div>
          <div class="flex ">
            <div class="inline" />
          </div>
          <div class="flex ">
            <div class="inline" />
          </div>
        </div>
      </UContainer>
    </div>
    <div class="border-t border-neutral-200 dark:border-neutral-800">
      <UContainer>
        <div class="py-10">
          Copyright © 2025-{{ new Date().getFullYear() }} Harlan Wilton - <a href="https://github.com/unjs/unhead/blob/main/LICENSE">MIT License</a>
        </div>
      </UContainer>
    </div>
  </footer>
</template>
