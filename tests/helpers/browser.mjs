/** Install browser globals for one test and restore their original descriptors afterwards. */
export function installGlobals(t, values) {
  for (const [key, value] of Object.entries(values)) {
    const original = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    t.after(() => {
      if (original) Object.defineProperty(globalThis, key, original);
      else delete globalThis[key];
    });
  }
}

/** A frame flush runs only the callbacks pending when that frame began. */
export function frameQueue() {
  const pending = new Map();
  let sequence = 0;
  return {
    pending,
    request(callback) {
      pending.set(++sequence, callback);
      return sequence;
    },
    cancel: (id) => pending.delete(id),
    flush(time = 0) {
      const callbacks = [...pending.values()];
      pending.clear();
      callbacks.forEach((callback) => callback(time));
    },
  };
}

export const mediaQuery = (matches = false) => Object.assign(new EventTarget(), { matches });

/** Explicit observer delivery keeps tests independent of browser scheduling. */
export function intersectionObservers() {
  const instances = [];
  class Observer {
    targets = new Set();
    constructor(callback, options) {
      this.callback = callback;
      this.options = options;
      instances.push(this);
    }
    observe(target) {
      this.targets.add(target);
    }
    unobserve(target) {
      this.targets.delete(target);
    }
    disconnect() {
      this.targets.clear();
    }
  }
  return {
    Observer,
    instances,
    deliver(visible, intersectionRatio = visible ? 1 : 0) {
      for (const observer of instances) {
        if (!observer.targets.size) continue;
        observer.callback(
          [...observer.targets].map((target) => ({
            target,
            isIntersecting: visible,
            intersectionRatio,
          })),
        );
      }
    },
  };
}
