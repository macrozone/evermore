# Lab-Bausteine

Neue Experimente in `apps/www/lib/catalog.ts` registrieren (Name, Beschreibung,
Status, Route). `/lab` filtert die Kategorie `experiment`; die Startseiten-Übersicht
kann dieselbe Registry verwenden. `planned`-Einträge werden ohne Link angezeigt.

Die Server-Seite enthält Titel und Beschreibung. Eine kleine Client-Komponente
lädt den eigentlichen Renderer mit `next/dynamic` und `ssr: false` – siehe
`app/lab/controls/controls-client.tsx`. Das Lab-Layout setzt `noindex, nofollow`
für alle Unterseiten.

`useMovement(surfaceRef)` liefert ein Ref auf die gedrückten Keyboard-Codes.
`movementFromKeys(keys.current)` gibt einen normalisierten Bewegungsvektor
(x Ost, y Süd) für den Renderloop zurück. Die Oberfläche muss `tabIndex={0}`
haben; Tasten werden nur dort abgefangen. Eingabefelder bleiben bedienbar.
Fokusverlust, versteckter Tab und Unmount leeren den Zustand.

`DebugOverlay` erhält `{ fps, position: { x, y, z }, seed }` vom Renderer.
Snapshots nur etwa viermal pro Sekunde veröffentlichen, nicht pro Frame.
Die Controls-Sandbox zeigt ein einfaches Einstellpanel und kopierbares JSON.
Ihr Seed ist nur Diagnose-Metadatum; sie generiert noch keine Welt.
