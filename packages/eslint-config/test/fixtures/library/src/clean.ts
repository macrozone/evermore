import type { Counter } from "./types";

export function hasItems(counter: Counter | undefined): boolean {
  return counter != null && counter.count > 0;
}
