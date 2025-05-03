/**
 * HTML parser worker implementation for web environments
 */

import { parseHTML } from '../../parser.ts'
import {WorkerMessage, WorkerResponse} from "../types.ts";

// Browser environment - use Web Workers
// eslint-disable-next-line no-restricted-globals
const ctx: Worker = self as any

ctx.addEventListener('message', (event: MessageEvent<WorkerMessage>) => {
  try {
    const { id, html, state } = event.data
    const result = parseHTML(html, state)

    ctx.postMessage({
      id,
      events: result.events,
      unprocessedHtml: result.unprocessedHtml,
      state,
    } as WorkerResponse)
  }
  catch (error) {
    ctx.postMessage({
      error: error instanceof Error ? error.message : String(error),
    })
  }
})
