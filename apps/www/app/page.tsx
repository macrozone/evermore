import { getGameInfo } from "@evermore/core";

export default function HomePage() {
  const { name, tagline } = getGameInfo();

  return (
    <main className="grid min-h-screen place-content-center gap-6 p-6 text-center">
      <h1 className="font-display text-pixel-4x text-gold">{name}</h1>
      <p>{tagline}</p>
    </main>
  );
}
