import { describe, expect, it } from 'vitest'
import { wasmPanicError } from '../../src/wasm-panic.js'

// WASM aborts on panic, so the runtime hands JS a bare `RuntimeError:
// unreachable`. The Rust panic hook stashes the message for us to attach (#195).
const TRAP = new WebAssembly.RuntimeError('unreachable')

describe('wasmPanicError', () => {
  it('attaches the captured panic message and keeps the trap as cause', () => {
    const error = wasmPanicError(TRAP, () => 'panicked at edge/src/lib.rs:12:5:\nboom') as Error

    expect(error).toBeInstanceOf(Error)
    expect(error.message).toContain('mdream WASM panic')
    expect(error.message).toContain('panicked at edge/src/lib.rs:12:5:\nboom')
    expect(error.cause).toBe(TRAP)
  })

  it('rethrows untouched when the failure was not a panic', () => {
    expect(wasmPanicError(TRAP, () => undefined)).toBe(TRAP)
  })

  it('rethrows untouched when the message cannot be read', () => {
    expect(wasmPanicError(TRAP, () => {
      throw new TypeError('wasm is undefined')
    })).toBe(TRAP)
  })
})
