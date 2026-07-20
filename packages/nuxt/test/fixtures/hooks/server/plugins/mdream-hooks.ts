export default defineNitroPlugin((nitroApp) => {
  // mdream:config hook - dynamically modify mdream options before conversion
  // Uses filter to exclude <p> elements, proving the hook modified options
  nitroApp.hooks.hook('mdream:config', (options) => {
    options.filter = { exclude: ['p'] }
  })

  // mdream:negotiate hook - override content negotiation based on custom headers
  nitroApp.hooks.hook('mdream:negotiate', (ctx) => {
    const forceMarkdown = ctx.event.headers.get('x-force-markdown')
    if (forceMarkdown === 'true') {
      ctx.shouldServe = true
    }
    const blockMarkdown = ctx.event.headers.get('x-block-markdown')
    if (blockMarkdown === 'true') {
      ctx.shouldServe = false
    }
  })
})
