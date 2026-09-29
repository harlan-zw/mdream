import type { HtmlToMarkdownOptions, MdreamNapiResult } from '../napi/index.js'
import type { MdreamOptions } from './index.js'
import type { ResolvedOptions } from './resolve-options.js'
import { deliverPluginData } from './convert.js'
import { resolveOptions } from './resolve-options.js'

// Options resolve on this thread: callbacks cannot cross `postMessage`, and the
// worker then runs the same engine options as every other entry point.
type WorkerMessage
  = | { id: number, type: 'convert', html: string, options: HtmlToMarkdownOptions }
    | { type: 'init', wasmUrl: string }

type WorkerResponse
  = | { id: number, type: 'result', data: MdreamNapiResult }
    | { id: number, type: 'error', message: string }
    | { type: 'ready' }

interface Pending {
  resolve: (markdown: string) => void
  reject: (e: Error) => void
  callbacks: Pick<ResolvedOptions, 'frontmatterCallback' | 'extractionHandlers'>
}

let _worker: Worker | null = null
let _ready: Promise<void> | null = null
let _idCounter = 0
const _pending = new Map<number, Pending>()
const WASM_RE = /\.wasm$/

function getWorkerBlob(wasmUrl: string): Blob {
  const code = `
// namespace import: the URL is caller-supplied and may point at an older build
import init, * as engine from '${wasmUrl.replace(WASM_RE, '.js')}';
const { htmlToMarkdownResult } = engine;

let ready = false;

async function initialize() {
  await init('${wasmUrl}');
  ready = true;
  self.postMessage({ type: 'ready' });
}

initialize().catch(e => {
  self.postMessage({ type: 'error', id: -1, message: 'WASM init failed: ' + e.message });
});

self.onmessage = function(e) {
  const msg = e.data;
  if (msg.type === 'convert') {
    if (!ready) {
      self.postMessage({ id: msg.id, type: 'error', message: 'Worker not ready' });
      return;
    }
    try {
      const result = htmlToMarkdownResult(msg.html, msg.options || {});
      self.postMessage({ id: msg.id, type: 'result', data: result });
    } catch (err) {
      // WASM aborts on panic (#195): the message is stashed by the panic hook
      const panic = engine.__mdreamTakePanicMessage?.();
      self.postMessage({ id: msg.id, type: 'error', message: panic || err.message });
    }
  }
};`
  return new Blob([code], { type: 'application/javascript' })
}

function onMessage(e: MessageEvent<WorkerResponse>) {
  const msg = e.data
  if (msg.type === 'ready')
    return
  if ('id' in msg) {
    const pending = _pending.get(msg.id)
    if (!pending)
      return
    _pending.delete(msg.id)
    if (msg.type === 'result') {
      try {
        deliverPluginData(msg.data, pending.callbacks)
        pending.resolve(msg.data.markdown || '')
      }
      catch (error) {
        pending.reject(error as Error)
      }
    }
    else {
      pending.reject(new Error(msg.message))
    }
  }
}

/**
 * Initialize the mdream web worker. Must be called before htmlToMarkdown.
 * @param wasmUrl - URL to the mdream_edge_bg.wasm file
 */
export function initWorker(wasmUrl: string): Promise<void> {
  if (_ready)
    return _ready

  _ready = new Promise<void>((resolve, reject) => {
    const blob = getWorkerBlob(wasmUrl)
    const url = URL.createObjectURL(blob)
    _worker = new Worker(url, { type: 'module' })
    _worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      if (e.data.type === 'ready') {
        _worker!.onmessage = onMessage
        URL.revokeObjectURL(url)
        resolve()
      }
      else if (e.data.type === 'error') {
        reject(new Error((e.data as WorkerResponse & { type: 'error' }).message))
      }
    }
    _worker.onerror = (e) => {
      reject(new Error(`Worker error: ${e.message}`))
    }
  })

  return _ready
}

/**
 * Convert HTML to markdown using the web worker.
 * Call initWorker() first.
 */
export function htmlToMarkdown(html: string, options?: Partial<MdreamOptions>): Promise<string> {
  if (!_worker || !_ready)
    return Promise.reject(new Error('Call initWorker() before htmlToMarkdown()'))

  return _ready.then(() => {
    const { napiOpts, frontmatterCallback, extractionHandlers } = resolveOptions(options ?? {})
    const id = _idCounter++
    return new Promise<string>((resolve, reject) => {
      _pending.set(id, { resolve, reject, callbacks: { frontmatterCallback, extractionHandlers } })
      _worker!.postMessage({ id, type: 'convert', html, options: napiOpts } satisfies WorkerMessage)
    })
  })
}

/**
 * Terminate the web worker and free resources.
 */
export function terminateWorker(): void {
  if (_worker) {
    _worker.terminate()
    _worker = null
  }
  _ready = null
  for (const [, pending] of _pending)
    pending.reject(new Error('Worker terminated'))
  _pending.clear()
}
