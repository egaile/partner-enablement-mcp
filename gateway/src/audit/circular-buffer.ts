/**
 * Rec 8: Fixed-capacity circular buffer that replaces Array splice/unshift
 * with O(1) push and O(n) drain operations. Overflow drops the oldest entry.
 */
export class CircularBuffer<T> {
  private buf: (T | undefined)[];
  private head = 0;   // index of the oldest entry
  private tail = 0;   // index of the next write slot
  private count = 0;
  private readonly cap: number;
  private dropCount = 0;

  constructor(capacity: number) {
    if (capacity < 1) throw new Error("CircularBuffer capacity must be >= 1");
    this.cap = capacity;
    this.buf = new Array<T | undefined>(capacity);
  }

  /** Number of entries currently in the buffer */
  get length(): number {
    return this.count;
  }

  /** Total entries dropped due to overflow since last reset */
  get dropped(): number {
    return this.dropCount;
  }

  /** O(1) push. Overwrites the oldest entry on overflow. */
  push(item: T): void {
    if (this.count === this.cap) {
      // Overwrite oldest
      this.buf[this.tail] = item;
      this.head = (this.head + 1) % this.cap;
      this.tail = (this.tail + 1) % this.cap;
      this.dropCount++;
    } else {
      this.buf[this.tail] = item;
      this.tail = (this.tail + 1) % this.cap;
      this.count++;
    }
  }

  /**
   * Remove and return up to `n` entries from the front (oldest first).
   * Returns an array (possibly empty).
   */
  drain(n: number): T[] {
    const take = Math.min(n, this.count);
    const result: T[] = new Array(take);
    for (let i = 0; i < take; i++) {
      result[i] = this.buf[this.head] as T;
      this.buf[this.head] = undefined; // allow GC
      this.head = (this.head + 1) % this.cap;
    }
    this.count -= take;
    return result;
  }

  /**
   * Prepend items back to the front of the buffer (for retry).
   * Items that don't fit are silently dropped (oldest-first from the items array).
   */
  prepend(items: T[]): void {
    const available = this.cap - this.count;
    const take = Math.min(items.length, available);
    // Walk backwards so the first item in `items` ends up at the new head
    for (let i = take - 1; i >= 0; i--) {
      this.head = (this.head - 1 + this.cap) % this.cap;
      this.buf[this.head] = items[i];
      this.count++;
    }
  }
}
