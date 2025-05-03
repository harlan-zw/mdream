/**
 * HTML parser worker implementation for Node.js environments
 */

import { parseHTML } from '../../parser.ts'
import {WorkerMessage, WorkerResponse} from "../types.ts";
import { parentPort } from 'node:worker_threads'


// Use a try-catch to prevent errors if worker_threads is not available
parentPort!.on('message', (message: string) => {
  try {
    const { id, html, state } = JSON.parse(message) as WorkerMessage
    const result = parseHTML(html, state)

    parentPort!.postMessage({
      id,
      events: result.events,
      unprocessedHtml: result.unprocessedHtml,
      state,
    } as WorkerResponse)
  }
  catch (error) {
    parentPort!.postMessage({
      error: error instanceof Error ? error.message : String(error),
    })
  }
})
