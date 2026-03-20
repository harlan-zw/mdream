import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Required: mdream uses native Node.js bindings (NAPI-RS) which
  // cannot be bundled by Turbopack or webpack. This tells Next.js
  // to load mdream via native require() at runtime.
  serverExternalPackages: ['mdream'],
}

export default nextConfig
