export class CancellationError extends Error {
  constructor(message = "Operation was cancelled") {
    super(message);
    this.name = "CancellationError";
  }
}

export class CancellationToken {
  #cancelled = false;

  get isCancelled(): boolean {
    return this.#cancelled;
  }

  /** Throws {@link CancellationError} once after {@link cancel} was called. */
  throwIfCancelled(): void {
    if (this.#cancelled) {
      this.#cancelled = false;
      throw new CancellationError();
    }
  }

  cancel(): void {
    this.#cancelled = true;
  }
}
