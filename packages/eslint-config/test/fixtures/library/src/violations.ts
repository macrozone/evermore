import { Counter } from "./types";

async function load(): Promise<void> {}

export function label(counter: Counter): string {
  void load;
  if (counter.count) {
    return "some";
  }
  return "none";
}

export function run(): void {
  load();
}
