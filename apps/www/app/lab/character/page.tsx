import CharacterClient from "./character-client";

export default function CharacterPage() {
  return <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
    <p className="mb-2 text-sm uppercase tracking-widest text-mist">Evermore / Lab / Character A & B</p>
    <h1 className="text-3xl text-gold">Who are you?</h1>
    <p className="my-4 max-w-3xl text-mist">Describe your character, even an animal. Compare A, a text model choosing from a parts library, with B, an image model drawing new artwork in four directions. Edit an existing B character with a short request and compare its variants. Watch for matching anatomy, colors and foot placement across every walking frame.</p>
    <CharacterClient />
  </main>;
}
