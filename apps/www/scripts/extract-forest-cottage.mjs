import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

// Run from apps/www. Authored masks separate visual coverage from collision.
const root = fileURLToPath(new URL('../../../', import.meta.url));
const output = `${root}apps/www/public/forest-cottage`;
await mkdir(output, { recursive: true });
const { data } = await sharp(`${root}docs/art/moodboards/02-eigene-welt/it2-waldhuette-tag.jpg`)
  .resize(688, 384, { kernel: 'nearest' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const layers = [
  { id: 'facade', layer: 'facade', polygon: [[550,320],[818,320],[818,442],[550,442]] },
  { id: 'barrel', layer: 'objects', polygon: [[816,345],[856,348],[881,391],[876,443],[824,445],[812,414]] },
  { id: 'garden', layer: 'objects', polygon: [[916,194],[1214,194],[1214,447],[916,447]] },
  { id: 'roof', layer: 'overhead', polygon: [[523,177],[650,16],[708,16],[842,175],[846,341],[816,344],[694,230],[681,222],[550,344],[523,336]] },
  { id: 'oak-west', layer: 'overhead', polygon: [[93,340],[133,276],[210,222],[277,228],[315,284],[342,350],[317,418],[265,439],[260,497],[230,504],[195,493],[203,448],[156,429],[119,389]] },
  { id: 'oak-north', layer: 'overhead', polygon: [[201,1],[414,1],[450,66],[445,139],[404,163],[365,171],[365,236],[340,244],[312,232],[319,164],[260,159],[215,109]] },
  { id: 'oak-edge-west', layer: 'overhead', polygon: [[0,16],[101,19],[168,86],[179,158],[153,220],[92,244],[99,303],[66,312],[40,275],[0,237]] },
  { id: 'oak-east', layer: 'overhead', polygon: [[1148,0],[1312,0],[1336,79],[1291,113],[1261,124],[1266,171],[1227,181],[1193,157],[1194,123],[1155,107],[1122,61]] },
  { id: 'pine-east', layer: 'overhead', polygon: [[1288,201],[1376,250],[1376,504],[1309,510],[1312,537],[1270,540],[1261,512],[1210,495],[1200,465],[1241,411],[1227,399],[1260,333],[1247,321]] },
  { id: 'forest-north', layer: 'overhead', polygon: [[431,0],[1146,0],[1146,105],[1090,119],[1031,77],[982,53],[920,18],[858,28],[801,57],[755,33],[699,2],[624,2],[588,49],[550,55],[522,22],[464,77],[431,67]] },
  { id: 'pine-west', layer: 'overhead', polygon: [[0,231],[39,282],[80,389],[81,443],[31,456],[0,449]] },
  { id: 'pine-edge-east', layer: 'overhead', polygon: [[1355,120],[1376,120],[1376,394],[1346,383],[1290,345],[1330,287],[1294,272],[1322,235]] },
  { id: 'forest-south-west', layer: 'overhead', polygon: [[0,672],[66,670],[75,703],[168,637],[245,644],[289,712],[352,668],[393,700],[434,768],[0,768]] },
  { id: 'oak-south-east', layer: 'overhead', polygon: [[1019,752],[1040,685],[1109,620],[1186,623],[1245,674],[1270,737],[1260,768],[1019,768]] },
  { id: 'flowers', layer: 'decoration', polygon: [[462,440],[500,440],[500,487],[462,487]] },
  { id: 'flowers-path', layer: 'decoration', polygon: [[505,484],[550,484],[550,538],[505,538]] },
  { id: 'flowers-east', layer: 'decoration', polygon: [[1006,489],[1092,489],[1092,546],[1006,546]] },
];
function contains(points, x, y) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i]; const [xj, yj] = points[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const ground = Buffer.from(data);
const sprites = [];
for (const entry of layers) {
  const points = entry.polygon.map(([x,y]) => [Math.floor(x/2), Math.floor(y/2)]);
  const x = Math.floor(Math.min(...points.map(p => p[0])) / 16) * 16;
  const y = Math.floor(Math.min(...points.map(p => p[1])) / 16) * 16;
  const width = Math.ceil((Math.max(...points.map(p => p[0])) - x) / 16) * 16;
  const height = Math.ceil((Math.max(...points.map(p => p[1])) - y) / 16) * 16;
  const pixels = Buffer.alloc(width * height * 4);
  for (let py = y; py < Math.min(y + height,384); py++) for (let px = x; px < Math.min(x + width,688); px++) {
    if (!contains(points,px,py)) continue;
    const offset = (py*688+px)*4;
    data.copy(pixels, ((py-y)*width+px-x)*4, offset, offset+4);
    // Reconstruct occluded terrain from a clean 16px grass patch. It must be
    // present when a roof/canopy is hidden, rather than leaving a black hole.
    const grassOffset = ((260+py%16)*688+280+px%16)*4;
    data.copy(ground,offset,grassOffset,grassOffset+4);
  }
  await sharp(pixels,{raw:{width,height,channels:4}}).png().toFile(`${output}/${entry.id}.png`);
  sprites.push({ id:entry.id, layer:entry.layer, x:x/16, y:y/16, width:width/16, height:height/16 });
}
const tiles = [], hashes = new Map(), cells = [];
for (let y=0;y<24;y++) for(let x=0;x<43;x++) {
  const tile=Buffer.alloc(16*16*4);
  for(let row=0;row<16;row++) ground.copy(tile,row*16*4,((y*16+row)*688+x*16)*4,((y*16+row)*688+x*16+16)*4);
  const hash=createHash('sha256').update(tile).digest('hex');
  if(!hashes.has(hash)) {hashes.set(hash,tiles.length);tiles.push(tile);}
  cells.push(hashes.get(hash));
}
const atlas=Buffer.alloc(512*Math.ceil(tiles.length/32)*16*4);
tiles.forEach((tile,id)=>{for(let row=0;row<16;row++) tile.copy(atlas,((Math.floor(id/32)*16+row)*512+(id%32)*16)*4,row*64,(row+1)*64);});
await sharp(atlas,{raw:{width:512,height:Math.ceil(tiles.length/32)*16,channels:4}}).png().toFile(`${output}/terrain.png`);
const fixture={width:43,depth:24,tileSize:16,atlasColumns:32,tileCount:tiles.length,ground:cells,sprites};
await writeFile(`${root}packages/world/src/test-worlds/forest-cottage-art.ts`, `// Generated by apps/www/scripts/extract-forest-cottage.mjs; edit masks there.\nexport const FOREST_COTTAGE_ART = ${JSON.stringify(fixture,null,2)} as const;\n`);
console.log(`${cells.length} cells, ${tiles.length} unique tiles, ${sprites.length} layered sprites`);
