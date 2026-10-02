export interface GameInfo {
  name: string;
  tagline: string;
  description: string;
}

const gameInfo: GameInfo = {
  name: "Evermore",
  tagline: "An online action RPG in 16-bit style. Coming soon.",
  description: "An online action RPG in 16-bit style, built by its players.",
};

export function getGameInfo(): GameInfo {
  return { ...gameInfo };
}

/**
 * Builds a document title like "Features · Evermore".
 * Without a (non-blank) page name, the plain game name is returned.
 */
export function formatPageTitle(pageName?: string): string {
  const page = pageName?.trim() ?? "";
  return page === "" ? gameInfo.name : `${page} · ${gameInfo.name}`;
}
