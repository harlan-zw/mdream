use std::alloc::{GlobalAlloc, Layout, System};
use std::cell::Cell;

#[derive(Clone, Copy, Default, serde::Serialize)]
pub struct Counts {
  pub calls: usize,
  pub reallocations: usize,
  // Sum of requested allocation sizes, including full realloc requests.
  pub bytes: usize,
  pub peak: usize,
  live: usize,
  invalid: bool,
}
thread_local! {
  static COUNTS: Cell<Counts> = const { Cell::new(Counts { calls: 0, reallocations: 0, bytes: 0, peak: 0, live: 0, invalid: false }) };
  static ACTIVE: Cell<bool> = const { Cell::new(false) };
}
pub struct Allocator;

fn record(old: usize, new: usize, realloc: bool) {
  if ACTIVE.get() {
    let mut counts = COUNTS.get();
    if new > 0 {
      counts.calls += usize::from(!realloc);
      counts.reallocations += usize::from(realloc);
      counts.bytes += new;
    }
    counts.invalid |= old > counts.live;
    counts.live = counts.live.saturating_sub(old);
    counts.live += new;
    counts.peak = counts.peak.max(counts.live);
    COUNTS.set(counts);
  }
}
// SAFETY: System owns every allocation. Counters change only after successful allocation.
unsafe impl GlobalAlloc for Allocator {
  unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
    let ptr = unsafe { System.alloc(layout) };
    if !ptr.is_null() {
      record(0, layout.size(), false);
    }
    ptr
  }
  unsafe fn alloc_zeroed(&self, layout: Layout) -> *mut u8 {
    let ptr = unsafe { System.alloc_zeroed(layout) };
    if !ptr.is_null() {
      record(0, layout.size(), false);
    }
    ptr
  }
  unsafe fn realloc(&self, ptr: *mut u8, layout: Layout, size: usize) -> *mut u8 {
    let next = unsafe { System.realloc(ptr, layout, size) };
    if !next.is_null() {
      record(layout.size(), size, true);
    }
    next
  }
  unsafe fn dealloc(&self, ptr: *mut u8, layout: Layout) {
    record(layout.size(), 0, false);
    unsafe { System.dealloc(ptr, layout) };
  }
}
pub fn measure(run: impl FnOnce()) -> Counts {
  COUNTS.set(Counts::default());
  ACTIVE.set(true);
  run();
  ACTIVE.set(false);
  let counts = COUNTS.get();
  assert!(!counts.invalid, "Only measured allocations may be freed");
  assert_eq!(
    counts.live, 0,
    "The measured conversion must release its allocations"
  );
  counts
}

#[cfg(test)]
mod tests {
  #[test]
  fn counts_growth_and_release() {
    let counts = super::measure(|| {
      let mut bytes = Vec::<u8>::with_capacity(64);
      bytes.resize(64, 1);
      bytes.reserve_exact(64);
      std::hint::black_box(&bytes);
      bytes.truncate(32);
      bytes.shrink_to_fit();
      std::hint::black_box(&bytes);
    });
    assert_eq!(counts.calls, 1);
    assert_eq!(counts.reallocations, 2);
    assert_eq!(counts.bytes, 224);
    assert_eq!(counts.peak, 128);
  }
}
