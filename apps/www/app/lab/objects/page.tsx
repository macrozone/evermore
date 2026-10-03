"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { applyObjectPalette, objectLibrary, objectPalettes, OBJECT_TILE_SIZE, type LibraryObject, type ObjectPalette } from "../../../lib/objects";
import styles from "./objects.module.css";

function Sprite({ object, zoom, pixelSize, palette, footprint }: { object: LibraryObject; zoom: number; pixelSize: number; palette: ObjectPalette; footprint: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (cancelled || !ref.current) return;
      const canvas = ref.current;
      const context = canvas.getContext("2d");
      if (!context) return;
      canvas.width = object.width; canvas.height = object.height;
      context.imageSmoothingEnabled = false;
      const small = document.createElement("canvas");
      small.width = Math.ceil(object.width / pixelSize); small.height = Math.ceil(object.height / pixelSize);
      const smallContext = small.getContext("2d");
      if (!smallContext) return;
      smallContext.imageSmoothingEnabled = false;
      smallContext.drawImage(image, 0, 0, small.width, small.height);
      const pixels = smallContext.getImageData(0, 0, small.width, small.height);
      applyObjectPalette(pixels.data, objectPalettes[palette]);
      smallContext.putImageData(pixels, 0, 0);
      context.drawImage(small, 0, 0, object.width, object.height);
      if (footprint) {
        context.fillStyle = "#eba65566"; context.strokeStyle = "#f4cf82";
        const originX = (object.width - object.footprint.columns * OBJECT_TILE_SIZE) / 2;
        const originY = object.height - object.footprint.rows * OBJECT_TILE_SIZE;
        for (const [x, y] of object.footprint.collision) {
          const dx = originX + x * OBJECT_TILE_SIZE; const dy = originY + y * OBJECT_TILE_SIZE;
          context.fillRect(dx, dy, OBJECT_TILE_SIZE, OBJECT_TILE_SIZE);
          context.strokeRect(dx + 0.5, dy + 0.5, OBJECT_TILE_SIZE - 1, OBJECT_TILE_SIZE - 1);
        }
      }
      setError(false);
    };
    image.onerror = () => { if (!cancelled) setError(true); };
    image.src = object.sprite;
    return () => { cancelled = true; };
  }, [object, pixelSize, palette, footprint]);
  return error ? <p role="alert">Could not load {object.name}.</p> : <canvas ref={ref} width={object.width} height={object.height} style={{ width: object.width * zoom, height: object.height * zoom }} role="img" aria-label={`${object.name} sprite${footprint ? " with collision footprint" : ""}`} />;
}

export default function ObjectsPage() {
  const [pixelSize, setPixelSize] = useState(1);
  const [palette, setPalette] = useState<ObjectPalette>("original");
  const [zoom, setZoom] = useState(3);
  const [footprint, setFootprint] = useState(false);
  return <main className={styles.page}>
    <nav><Link href="/">Evermore</Link><span> / </span><Link href="/lab">Lab</Link><span> / Object library</span></nav>
    <header className={styles.header}><p className={styles.eyebrow}>G2 · THE BUILDING BLOCKS</p><h1>A village, piece by piece.</h1><p>Seven reusable objects, imagined by AI and prepared for a 16 px tile world. Explore their silhouettes, palettes and ground footprints.</p></header>
    <section className={styles.controls} aria-label="Preview controls">
      <label>Pixel size <output>{pixelSize} px</output><input type="range" min="1" max="4" step="1" value={pixelSize} onChange={event => setPixelSize(Number(event.target.value))} /></label>
      <label>Display scale <output>{zoom}×</output><input type="range" min="1" max="4" step="1" value={zoom} onChange={event => setZoom(Number(event.target.value))} /></label>
      <label>Palette<select value={palette} onChange={event => setPalette(event.target.value as ObjectPalette)}><option value="original">Generated colors</option><option value="hearth">Warm hearth · 16 colors</option><option value="dusk">Quiet dusk · 16 colors</option></select></label>
      <label className={styles.checkbox}><input type="checkbox" checked={footprint} onChange={event => setFootprint(event.target.checked)} />Show collision footprints</label>
    </section>
    <div className={styles.grid}>{objectLibrary.map(object => <article key={object.id} className={styles.card}>
      <div className={styles.preview}><Sprite object={object} zoom={zoom} pixelSize={pixelSize} palette={palette} footprint={footprint} /></div>
      <div className={styles.details}><h2>{object.name}</h2><p>{object.width} × {object.height} px · {object.footprint.columns} × {object.footprint.rows} ground tiles</p><p>{object.footprint.collision.length} blocked cells · height {object.heightTiles} tiles</p><a href={object.sprite} download={`${object.id}.png`}>Download sprite ↗</a></div>
    </article>)}</div>
    <footer>Axis-aligned south-facing view · Gemini 3.1 Flash Image via Vertex AI<br />Preview adjustments happen locally. Downloads contain the original transparent sprite. Ground footprints are authored placement metadata; tree canopies can overhang walkable cells.</footer>
  </main>;
}
