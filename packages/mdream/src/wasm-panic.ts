/**
 * WASM aborts on panic (wasm32-unknown-unknown has no unwinding), so a Rust
 * panic reaches JS as a bare `RuntimeError: unreachable` with no message. The
 * Rust panic hook stashes the message before aborting: pick it up here and
 * re-throw something actionable, keeping the trap as `cause`.
 *
 * The instance stays usable after an abort, so callers may keep converting.
 *
 * Each entry passes its own instance so panic messages stay with that instance.
 */
export function wasmPanicError(error: unknown, takeMessage: () => string | undefined): unknown {
  // An abort always surfaces as a trap. Anything else (a TypeError from the
  // bindings, a rejected stream read) must not be labelled with a message left
  // behind by a panic someone else caught.
  if (!(error instanceof WebAssembly.RuntimeError))
    return error

  let message: string | undefined
  try {
    message = takeMessage()
  }
  catch {
    // WASM never initialized, or the instance is gone: nothing to add.
    return error
  }
  if (!message)
    return error
  return new Error(`mdream WASM panic, please report this at https://github.com/harlan-zw/mdream/issues\n${message}`, { cause: error })
}
