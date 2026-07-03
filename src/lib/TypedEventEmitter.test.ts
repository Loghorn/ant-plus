import { describe, expect, it } from "vitest";
import { TypedEventEmitter } from "./TypedEventEmitter.js";

type TestEvents = {
  ping: [number];
  pong: [string, boolean];
};

describe("TypedEventEmitter", () => {
  it("invokes listeners with the emitted arguments in registration order", () => {
    const emitter = new TypedEventEmitter<TestEvents>();
    const calls: string[] = [];
    emitter.on("ping", (value) => calls.push(`first:${value}`));
    emitter.on("ping", (value) => calls.push(`second:${value}`));

    const emitted = emitter.emit("ping", 42);

    expect(emitted).toBe(true);
    expect(calls).toEqual(["first:42", "second:42"]);
  });

  it("once removes itself after the first emit", () => {
    const emitter = new TypedEventEmitter<TestEvents>();
    const calls: number[] = [];
    emitter.once("ping", (value) => calls.push(value));

    emitter.emit("ping", 1);
    emitter.emit("ping", 2);

    expect(calls).toEqual([1]);
    expect(emitter.listenerCount("ping")).toBe(0);
  });

  it("off removes a listener", () => {
    const emitter = new TypedEventEmitter<TestEvents>();
    const calls: number[] = [];
    const listener = (value: number) => calls.push(value);
    emitter.on("ping", listener);
    emitter.off("ping", listener);

    emitter.emit("ping", 1);

    expect(calls).toEqual([]);
    expect(emitter.listenerCount("ping")).toBe(0);
  });

  it("removeAllListeners clears a single event", () => {
    const emitter = new TypedEventEmitter<TestEvents>();
    emitter.on("ping", () => {});
    emitter.on("pong", () => {});

    emitter.removeAllListeners("ping");

    expect(emitter.listenerCount("ping")).toBe(0);
    expect(emitter.listenerCount("pong")).toBe(1);
  });

  it("removeAllListeners without an event clears everything", () => {
    const emitter = new TypedEventEmitter<TestEvents>();
    emitter.on("ping", () => {});
    emitter.on("pong", () => {});

    emitter.removeAllListeners();

    expect(emitter.listenerCount("ping")).toBe(0);
    expect(emitter.listenerCount("pong")).toBe(0);
  });

  it("listenerCount reflects registered listeners", () => {
    const emitter = new TypedEventEmitter<TestEvents>();
    expect(emitter.listenerCount("ping")).toBe(0);

    emitter.on("ping", () => {});
    emitter.on("ping", () => {});

    expect(emitter.listenerCount("ping")).toBe(2);
  });

  it("emit returns false when there are no listeners", () => {
    const emitter = new TypedEventEmitter<TestEvents>();

    expect(emitter.emit("ping", 1)).toBe(false);
  });
});
