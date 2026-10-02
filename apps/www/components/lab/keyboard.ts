export type Movement = { x: number; y: number };

export const movementCodes = new Set([
  "KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight",
]);

/** World axes: x east, y south. Normalize diagonals to preserve movement speed. */
export function movementFromKeys(keys: ReadonlySet<string>): Movement {
  const x = Number(keys.has("KeyD") || keys.has("ArrowRight")) - Number(keys.has("KeyA") || keys.has("ArrowLeft"));
  const y = Number(keys.has("KeyS") || keys.has("ArrowDown")) - Number(keys.has("KeyW") || keys.has("ArrowUp"));
  const magnitude = Math.hypot(x, y);
  const length = magnitude === 0 ? 1 : magnitude;
  return { x: x / length, y: y / length };
}

export function isEditingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement &&
    (target.isContentEditable || Boolean(target.closest("input, textarea, select, [contenteditable]")));
}

/** Attach to a focusable experiment surface; never capture keys from the rest of the page. */
export function bindMovementKeys(surface: HTMLElement, keys: Set<string>): () => void {
  const clear = () => keys.clear();
  const down = (event: KeyboardEvent) => {
    if (isEditingTarget(event.target) || event.ctrlKey || event.metaKey || event.altKey) return;
    if (!movementCodes.has(event.code)) return;
    event.preventDefault();
    keys.add(event.code);
  };
  const up = (event: KeyboardEvent) => { keys.delete(event.code); };
  surface.addEventListener("keydown", down);
  window.addEventListener("keyup", up);
  surface.addEventListener("focusout", clear);
  window.addEventListener("blur", clear);
  const visibility = () => { if (document.hidden) clear(); };
  document.addEventListener("visibilitychange", visibility);
  return () => {
    clear();
    surface.removeEventListener("keydown", down);
    window.removeEventListener("keyup", up);
    surface.removeEventListener("focusout", clear);
    window.removeEventListener("blur", clear);
    document.removeEventListener("visibilitychange", visibility);
  };
}
