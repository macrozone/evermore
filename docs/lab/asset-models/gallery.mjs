/** Build a local HTML gallery and lossless nearest-neighbor comparison sheet. */
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
const require = createRequire(new URL('../../../apps/www/package.json', import.meta.url));
const sharp = require('sharp');
const dir = new URL('./', import.meta.url);
const samples = JSON.parse(await readFile(new URL('measurements.json', dir), 'utf8'));
const options = [...new Set(samples.map(sample => sample.option))];
const subjects = ['tree', 'house', 'grass'];
const sizes = [16, 32, 64];
const width = 1430, rowHeight = 190, top = 60;
const overlays = [];
let svg = `<svg width="${width}" height="${top + options.length * rowHeight}" xmlns="http://www.w3.org/2000/svg"><style>text{font:16px monospace;fill:#eeeeee}</style><text x="20" y="25">Fixed palette, nearest-neighbor, magenta-key sprites. Each preview enlarged to 128px.</text>`;
for (let column = 0; column < 9; column++) svg += `<text x="${215 + column * 134}" y="50">${subjects[Math.floor(column / 3)]} ${sizes[column % 3]}px</text>`;
for (let row = 0; row < options.length; row++) {
  const option = options[row];
  svg += `<text x="15" y="${top + row * rowHeight + 50}">${option.replace('flash-reference-guided', 'Flash ref + role').replace('flash-reference', 'Flash ref naive')}</text>`;
  for (let column = 0; column < 9; column++) {
    const subject = subjects[Math.floor(column / 3)], size = sizes[column % 3];
    const tile = await sharp(await readFile(new URL(`${option}/${subject}-${size}.png`, dir))).resize(128, 128, { kernel: 'nearest' }).png().toBuffer();
    overlays.push({ input: tile, left: 215 + column * 134, top: top + row * rowHeight + 12 });
  }
}
svg += '</svg>';
await sharp({ create: { width, height: top + options.length * rowHeight, channels: 4, background: '#363c38' } }).composite([{ input: Buffer.from(svg) }, ...overlays]).png().toFile(new URL('comparison.png', dir).pathname);
const rows = options.map(option => `<section><h2>${option}</h2>${subjects.map(subject => {
  const sample = samples.find(sample => sample.option === option && sample.subject === subject);
  return `<article><h3>${subject}: ${sample.durationMs} ms, raw ${sample.width}×${sample.height}</h3><a href="${option}/${subject}.png">Raw source</a> · <a href="${option}/${subject}.json">Provenance</a><div class="variants">${sizes.map(size => `<figure><img src="${option}/${subject}-${size}.png" alt="${subject} ${size}px fixed palette"><figcaption>${size}px palette</figcaption></figure><figure><img src="${option}/${subject}-${size}-unquantized.png" alt="${subject} ${size}px original colors"><figcaption>${size}px original colors</figcaption></figure>`).join('')}</div>${subject === 'grass' ? `<figure><img class="repeat" src="${option}/grass-tiled.png" alt="Grass repeated three by three"><figcaption>3×3 repetition, no seam repair</figcaption></figure>` : ''}</article>`;
}).join('')}</section>`).join('');
await writeFile(new URL('gallery.html', dir), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Evermore asset model benchmark</title><style>body{font:16px system-ui;background:#202723;color:#eee;margin:24px}section{border-top:1px solid #778;padding:12px 0}.variants{display:flex;flex-wrap:wrap;gap:12px}figure{margin:8px 0}img{width:128px;height:128px;image-rendering:pixelated;background:repeating-conic-gradient(#333 0% 25%,#555 0% 50%) 0/16px 16px}img.repeat{width:384px;height:384px}a{color:#bce0c3}figcaption{font-size:13px}article{padding-bottom:24px}</style><h1>Evermore asset model benchmark</h1><p>2026-10-04. Three subjects per option; one generation each. Identical primary text prompts, no seeds. Reference options use the archived well image; the guided option adds an explicit style-only instruction. No seam repair. Research recommendations only.</p><p><a href="research.md">Report</a> · <a href="measurements.json">Measurements</a> · <a href="comparison.png">Comparison sheet</a></p>${rows}</html>\n`);
console.log(`Gallery: ${samples.length} samples, ${options.length} options`);
