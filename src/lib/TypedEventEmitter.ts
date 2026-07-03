export type EventMap = Record<string, unknown[]>;

type Listener<TArgs extends unknown[]> = (...args: TArgs) => void;

/**
 * A minimal event emitter with compile-time checked event names and payloads.
 */
export class TypedEventEmitter<TEvents extends EventMap> {
  #listeners = new Map<keyof TEvents, Set<Listener<never>>>();

  on<K extends keyof TEvents>(event: K, listener: Listener<TEvents[K]>): this {
    let set = this.#listeners.get(event);
    if (!set) {
      set = new Set();
      this.#listeners.set(event, set);
    }
    set.add(listener as Listener<never>);
    return this;
  }

  once<K extends keyof TEvents>(
    event: K,
    listener: Listener<TEvents[K]>,
  ): this {
    const wrapper: Listener<TEvents[K]> = (...args) => {
      this.off(event, wrapper);
      listener(...args);
    };
    return this.on(event, wrapper);
  }

  off<K extends keyof TEvents>(event: K, listener: Listener<TEvents[K]>): this {
    const set = this.#listeners.get(event);
    if (set) {
      set.delete(listener as Listener<never>);
      if (set.size === 0) {
        this.#listeners.delete(event);
      }
    }
    return this;
  }

  emit<K extends keyof TEvents>(event: K, ...args: TEvents[K]): boolean {
    const set = this.#listeners.get(event);
    if (!set || set.size === 0) {
      return false;
    }
    for (const listener of [...set]) {
      (listener as Listener<TEvents[K]>)(...args);
    }
    return true;
  }

  removeAllListeners<K extends keyof TEvents>(event?: K): this {
    if (event === undefined) {
      this.#listeners.clear();
    } else {
      this.#listeners.delete(event);
    }
    return this;
  }

  listenerCount<K extends keyof TEvents>(event: K): number {
    return this.#listeners.get(event)?.size ?? 0;
  }
}
