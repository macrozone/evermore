import { describe, expect, it } from "vitest";

import { formatPageTitle, getGameInfo } from "./game";

describe("getGameInfo", () => {
  it("returns the game metadata", () => {
    const info = getGameInfo();

    expect(info.name).toBe("Evermore");
    expect(info.tagline).not.toBe("");
    expect(info.description).not.toBe("");
  });

  it("returns a copy that callers cannot use to mutate the source", () => {
    getGameInfo().name = "Changed";

    expect(getGameInfo().name).toBe("Evermore");
  });
});

describe("formatPageTitle", () => {
  it("returns the game name without a page name", () => {
    expect(formatPageTitle()).toBe("Evermore");
  });

  it("treats a blank page name as missing", () => {
    expect(formatPageTitle("  ")).toBe("Evermore");
  });

  it("prefixes the trimmed page name", () => {
    expect(formatPageTitle(" Features ")).toBe("Features · Evermore");
  });
});
