import { defineNuxtConfig } from 'nuxt/config'
import { resolve } from 'pathe'
import { logger } from './logger'

logger.info(`🚀 Using Nuxt UI Pro License: ${!!process.env.NUXT_UI_PRO_LICENSE}`)

export default defineNuxtConfig({
  modules: [
    'motion-v/nuxt',
    '@nuxt/ui-pro',
    '@nuxtjs/seo',
    'radix-vue/nuxt',
    '@vueuse/nuxt',
    '@nuxthub/core',
    '@nuxt/fonts',
    // '@nuxt/content',
    // 'nuxt-llms',
    '@nuxt/scripts',
    '@nuxt/image',
    // maybe buggy
    'nuxt-rebundle',
    // 'nuxt-build-cache',
    async (_, nuxt) => {
      // addBuildPlugin(UnheadImportsPlugin({ sourcemap: true }))
      nuxt.hooks.hook('nitro:init', (nitro) => {
        // from sponsorkit
        nitro.options.alias.sharp = 'unenv/mock/empty'
        nitro.options.alias.pnpapi = 'unenv/mock/empty' // ?
      })
    },
  ],

  ui: {
    theme: {
      transitions: true,
    },
  },

  sitemap: {
    exclude: [
      '**/.navigation',
    ],
    xslColumns: [
      { label: 'URL', width: '100%' },
    ],
  },

  // breaks build locally
  hub: {
    database: true,
    cache: true,
    kv: true,
    ai: true,
  },

  future: {
    compatibilityVersion: 4,
  },

  runtimeConfig: {
    githubAccessToken: '', // NUXT_GITHUB_ACCESS_TOKEN
    githubAuthToken: '', // NUXT_GITHUB_AUTH_TOKEN
    githubAuthClientId: 'cabace556bd9519d9299', // NUXT_GITHUB_AUTH_CLIENT_ID
    githubAuthClientSecret: '', // NUXT_GITHUB_AUTH_SECRET_ID
  },

  fonts: {
    experimental: {
      processCSSVariables: true,
    },
    families: [
      { name: 'Hubot Sans', provider: 'local', weight: [200, 900], stretch: '75% 125%' },
    ],
  },

  nitro: {
    prerender: {
      failOnError: false,
      crawlLinks: true,
      routes: ['/', '/404.html'],
    },
  },

  linkChecker: {
    report: {
      // generate both a html and markdown report
      html: true,
      markdown: true,
      json: true,
      publish: true,
    },
  },

  site: {
    url: 'https://mdream.com',
    name: 'Mdream',
    description: 'Unhead is the any-framework document head manager built for performance and delightful developer experience.',
  },

  imports: {
    autoImport: true,
  },

  typescript: {
    strict: false,
  },

  // content: {
  //   database: { type: 'd1', binding: 'DB' },
  //   build: {
  //     markdown: {
  //       highlight: {
  //         theme: {
  //           light: 'github-light',
  //           default: 'github-light',
  //           dark: 'material-theme-palenight',
  //         },
  //         langs: [
  //           'ts',
  //           'tsx',
  //           'vue',
  //           'json',
  //           'html',
  //           'bash',
  //           'xml',
  //           'diff',
  //           'md',
  //           'dotenv',
  //           'svelte',
  //         ],
  //       },
  //     },
  //   },
  // },

  // CI Not picking this up for some reason ?
  uiPro: {
    license: process.env.NUXT_UI_PRO_LICENSE,
  },

  components: [
    {
      path: '~/components',
      pathPrefix: false,
    },
  ],

  hooks: {
    'components:extend': function (components) {
      for (const component of components) {
        if (component.pascalName === 'UAlert') {
          component.global = true
        }
      }
    },
  },

  mdc: {
    highlight: {
      theme: {
        light: 'github-light',
        default: 'github-light',
        dark: 'material-theme-palenight',
      },
      langs: [
        'ts',
        'tsx',
        'vue',
        'json',
        'html',
        'bash',
        'xml',
        'diff',
        'md',
        'dotenv',
        'svelte',
      ],
    },
  },

  schemaOrg: {
    identity: {
      type: 'Organization',
      name: 'Unhead',
      logo: '/logo.svg',
    },
  },

  $production: {
    routeRules: {
      '/api/stats.json': { prerender: true },
      '/api/github/sponsors.json': { prerender: true },
      '/api/_mdc/highlight': { cache: { group: 'mdc', name: 'highlight', maxAge: 60 * 60 } },
      '/__nuxt_content/**': { cache: { group: 'content', name: 'query', maxAge: 60 * 60 } },
      '/api/_nuxt_icon': { cache: { group: 'icon', name: 'icon', maxAge: 60 * 60 * 24 * 7 } },
    },
    scripts: {
      registry: {
        fathomAnalytics: {
          site: 'BRDEJWKJ',
        },
      },
    },
  },

  css: [
    '~/css/global.css',
  ],

  ogImage: {
    enabled: true,
    zeroRuntime: true,
    defaults: {
      component: 'Unhead',
    },
    fonts: [
      'Hubot+Sans:400',
      'Hubot+Sans:700',
    ],
  },

  icon: {
    customCollections: [{
      prefix: 'custom',
      dir: resolve('./app/assets/icons'),
    }],
    clientBundle: {
      scan: true,
      includeCustomCollections: true,
    },
    provider: 'iconify',
  },

  seo: {
    meta: {
      themeColor: [
        { content: '#18181b', media: '(prefers-color-scheme: dark)' },
        { content: 'white', media: '(prefers-color-scheme: light)' },
      ],
    },
  },

  app: {
    pageTransition: {
      name: 'page',
      mode: 'out-in',
    },
    head: {
      meta: [
        { name: 'google-site-verification', content: 'x' },
      ],
      link: [
        {
          rel: 'author',
          href: 'https://harlanzw.com/',
        },
      ],
      templateParams: {
        separator: '·',
      },

    },
  },

  compatibilityDate: '2024-07-12',
})
