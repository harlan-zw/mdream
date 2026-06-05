import * as p from '@clack/prompts'

/**
 * Minimal spinner surface used by the crawler. Mirrors the subset of
 * `@clack/prompts` spinner methods the package relies on.
 */
export interface CrawlSpinner {
  start: (message?: string) => void
  message: (message?: string) => void
  stop: (message?: string, code?: number) => void
}

/**
 * Diagnostic/progress sink for the crawler. All human-facing, non-data output
 * (the messages that would otherwise pollute stdout) flows through this single
 * seam so it can be silenced or redirected. It deliberately excludes the
 * interactive prompts (`select`, `text`, `confirm`, ...) which are input
 * control flow, not log output, and only run in the interactive CLI.
 *
 * Provide a custom implementation via `CrawlOptions.logger` to route messages
 * anywhere (e.g. stderr for an MCP server), or set `CrawlOptions.silent` to
 * drop them entirely. See issue #100.
 */
export interface CrawlLogger {
  intro: (title?: string) => void
  note: (message: string, title?: string) => void
  cancel: (message?: string) => void
  info: (message: string) => void
  warn: (message: string) => void
  error: (message: string) => void
  success: (message: string) => void
  spinner: () => CrawlSpinner
}

const noopSpinner: CrawlSpinner = {
  start() {},
  message() {},
  stop() {},
}

/**
 * A logger that drops every message. Used when `silent` is set so a library
 * consumer (e.g. an MCP server) gets a clean stdout.
 */
export const silentLogger: CrawlLogger = {
  intro() {},
  note() {},
  cancel() {},
  info() {},
  warn() {},
  error() {},
  success() {},
  spinner: () => noopSpinner,
}

/**
 * The default logger, backed by `@clack/prompts` (writes to stdout). Preserves
 * the existing CLI output exactly.
 */
export function createClackLogger(): CrawlLogger {
  return {
    intro: title => p.intro(title),
    note: (message, title) => p.note(message, title),
    cancel: message => p.cancel(message),
    info: message => p.log.info(message),
    warn: message => p.log.warn(message),
    error: message => p.log.error(message),
    success: message => p.log.success(message),
    spinner: () => p.spinner(),
  }
}

/**
 * Resolve the effective logger from crawl options. An explicit `logger` wins;
 * otherwise `silent` selects the no-op sink, and the default is the clack
 * logger. Pure: same inputs, same logger.
 */
export function resolveLogger(options: { silent?: boolean, logger?: CrawlLogger }): CrawlLogger {
  if (options.logger) {
    return options.logger
  }
  return options.silent ? silentLogger : createClackLogger()
}
