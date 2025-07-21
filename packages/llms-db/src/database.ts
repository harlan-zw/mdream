// Deprecated: Use createDrizzleLlmsRepository instead
// This file is kept for backward compatibility only

import type { DatabaseOptions } from './types.ts'
import { createDrizzleLlmsRepository } from './drizzle-repository.ts'

/**
 * @deprecated Use createDrizzleLlmsRepository instead
 */
export function createDatabase(options?: DatabaseOptions) {
  return createDrizzleLlmsRepository(options)
}

/**
 * @deprecated Use createDrizzleLlmsRepository instead
 */
export const LlmsDatabase = createDatabase
