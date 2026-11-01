export interface DelayLine<Item> {
  push(item: Item, releaseAtMs: number): void;
  clear(): void;
}

interface QueuedItem<Item> {
  readonly item: Item;
  readonly releaseAtMs: number;
}

/**
 * Delivers items in push order. One timer serves the whole queue because separate timers can fire
 * out of order when their expiry times land close together. Release times must not decrease.
 */
export function createDelayLine<Item>(
  deliver: (item: Item) => void,
  now: () => number,
): DelayLine<Item> {
  let queue: QueuedItem<Item>[] = [];
  let timer: NodeJS.Timeout | undefined;

  function arm(releaseAtMs: number): void {
    timer = setTimeout(pump, Math.max(0, Math.ceil(releaseAtMs - now())));
  }

  function pump(): void {
    timer = undefined;
    const nowMs = now();
    const ready = queue.filter((queued) => queued.releaseAtMs <= nowMs);
    queue = queue.slice(ready.length);
    for (const queued of ready) deliver(queued.item);
    const head = queue[0];
    if (head && timer === undefined) arm(head.releaseAtMs);
  }

  return {
    push(item, releaseAtMs) {
      queue.push({ item, releaseAtMs });
      if (timer === undefined) arm(releaseAtMs);
    },
    clear() {
      clearTimeout(timer);
      timer = undefined;
      queue = [];
    },
  };
}
