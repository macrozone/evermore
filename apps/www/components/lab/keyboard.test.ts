import { describe, expect, it, vi } from "vitest";

import { bindMovementKeys, movementFromKeys } from "./keyboard";

describe("movementFromKeys", () => {
  it("maps both control schemes to world axes", () => {
    expect(movementFromKeys(new Set(["KeyW"]))).toEqual({ x: 0, y: -1 });
    expect(movementFromKeys(new Set(["ArrowRight"]))).toEqual({ x: 1, y: 0 });
    expect(movementFromKeys(new Set(["KeyS", "ArrowDown"]))).toEqual({ x: 0, y: 1 });
  });
  it("cancels opposing directions and ignores unrelated keys", () => {
    expect(movementFromKeys(new Set(["KeyW", "ArrowDown", "Space"]))).toEqual({ x: 0, y: 0 });
  });
  it("keeps diagonal speed equal to cardinal speed", () => {
    const diagonal = movementFromKeys(new Set(["KeyW", "KeyD"]));
    expect(Math.hypot(diagonal.x, diagonal.y)).toBeCloseTo(1);
  });
});

describe("keyboard lifecycle", () => {
  it("clears held keys on focus loss and disposal and removes listeners", () => {
    const surface = new EventTarget();
    const windowTarget = new EventTarget();
    const documentTarget = new EventTarget();
    vi.stubGlobal("window", windowTarget);
    vi.stubGlobal("document", documentTarget);
    const keys = new Set(["KeyW"]);
    try {
      const dispose = bindMovementKeys(surface as HTMLElement, keys);
      windowTarget.dispatchEvent(new Event("blur"));
      expect(keys.size).toBe(0);
      keys.add("KeyD");
      surface.dispatchEvent(new Event("focusout"));
      expect(keys.size).toBe(0);
      keys.add("KeyA");
      dispose();
      expect(keys.size).toBe(0);
      keys.add("KeyS");
      windowTarget.dispatchEvent(new Event("blur"));
      expect(keys.has("KeyS")).toBe(true);
    } finally { vi.unstubAllGlobals(); }
  });
});
