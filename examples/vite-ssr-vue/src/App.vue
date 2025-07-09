<script setup>
// No need for manual routing - Vue Router handles this
</script>

<template>
  <div>
    <nav class="navigation">
      <router-link to="/" :class="{ active: $route.path === '/' }">
        Home
      </router-link>
      <router-link to="/about" :class="{ active: $route.path === '/about' }">
        About
      </router-link>
      <router-link to="/contact" :class="{ active: $route.path === '/contact' }">
        Contact
      </router-link>
    </nav>

    <div v-if="$route.path === '/'">
      <div class="logos">
        <a href="https://vite.dev" target="_blank">
          <img src="/vite.svg" class="logo" alt="Vite logo">
        </a>
        <a href="https://vuejs.org/" target="_blank">
          <img src="./assets/vue.svg" class="logo vue" alt="Vue logo">
        </a>
      </div>
    </div>

    <!-- Router outlet for components -->
    <router-view />
  </div>
</template>

<style scoped>
.navigation {
  display: flex;
  gap: 2rem;
  padding: 1rem 0;
  margin-bottom: 2rem;
  border-bottom: 1px solid #eee;
}

.navigation a {
  color: #333;
  text-decoration: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  transition: background-color 0.3s;
}

.navigation a:hover {
  background-color: #f5f5f5;
}

.navigation a.active {
  background-color: #007bff;
  color: white;
}

.logos {
  display: flex;
  justify-content: center;
  gap: 2rem;
  margin-bottom: 2rem;
}

.logo {
  height: 6em;
  padding: 1.5em;
  will-change: filter;
}
.logo:hover {
  filter: drop-shadow(0 0 2em #646cffaa);
}
.logo.vue:hover {
  filter: drop-shadow(0 0 2em #42b883aa);
}
</style>
