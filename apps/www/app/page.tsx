import { getGameInfo } from "@evermore/core";

export default function HomePage() {
  const { name, tagline } = getGameInfo();

  return (
    <main>
      <h1>{name}</h1>
      <p>{tagline}</p>
    </main>
  );
}
