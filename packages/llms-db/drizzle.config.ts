import { defineConfig } from 'drizzle-kit'

const isProduction = process.env.NODE_ENV === 'production'

export default defineConfig({
  schema: './src/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: isProduction
    ? {
        url: process.env.TURSO_DATABASE_URL || 'libsql://mdream-production-harlan-zw.aws-ap-northeast-1.turso.io',
        authToken: process.env.TURSO_AUTH_TOKEN,
      }
    : {
        url: './.mdream/llms.db',
      },
  verbose: true,
  strict: true,
})
