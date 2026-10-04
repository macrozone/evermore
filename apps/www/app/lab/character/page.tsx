import CharacterClient from "./character-client";

export default function CharacterPage() {
  return <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
    <p className="mb-2 text-sm uppercase tracking-widest text-mist">Evermore / Lab / Character A / C</p>
    <h1 className="text-3xl text-gold">Who are you?</h1>
    <p className="my-4 max-w-3xl text-mist">Describe a traveller. A text model chooses their parts and colours; choose Paper doll or Voxel to see the same traveller walking in four directions. Voxel turns a small 3D figure into pixel sprites, with adjustable camera and light. Compare silhouettes and movement; both options still use a limited human parts library.</p>
    <CharacterClient />
  </main>;
}
