import CharacterClient from "./character-client";

export default function CharacterPage() {
  return <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
    <p className="mb-2 text-sm uppercase tracking-widest text-mist">Evermore / Lab / Character A</p>
    <h1 className="text-3xl text-gold">Who are you?</h1>
    <p className="my-4 max-w-3xl text-mist">Describe a traveller. A text model chooses their parts and colours; a paper doll brings them to life in four directions.</p>
    <CharacterClient />
  </main>;
}
