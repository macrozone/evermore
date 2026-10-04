import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

// Run against an already-started local lab; all interaction and captures are headless.
const origin = new URL(process.argv[2] ?? 'http://localhost:9500');
assert.ok(['localhost', '127.0.0.1'].includes(origin.hostname));
const destination = path.resolve(process.argv[3] ?? 'docs/lab/experiments/g3b-map');
await mkdir(destination, { recursive: true });
const browser = await chromium.launch({ headless: true });
const evidence = {};
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(new URL('/lab/g3b-map', origin).href);
  const surface = page.getByRole('application', { name: 'Map movement' });
  const ready = () => page.waitForFunction(() => document.querySelector('[role="application"]')?.dataset.ready === 'true');
  const position = () => surface.evaluate(element => ({ x: Number(element.dataset.playerX), y: Number(element.dataset.playerY), hidden: element.dataset.occluded === 'true' }));
  const settle = () => page.waitForTimeout(250);
  const reset = async () => { await page.getByRole('button', { name: 'Reset player' }).click(); await settle(); await ready(); };
  const move = async (codes, duration) => {
    await surface.focus();
    for (const code of codes) await page.keyboard.down(code);
    await page.waitForTimeout(duration);
    for (const code of codes) await page.keyboard.up(code);
    await settle();
    return position();
  };
  const capture = name => page.screenshot({ path: path.join(destination, `${name}.png`), fullPage: true });
  await ready();
  for (const source of ['cabin', 'harbour']) {
    for (const approach of ['vision', 'image']) {
      const response = page.waitForResponse(r => r.url().endsWith(`/g3b-map/${source}-${approach}.json`));
      // Reload also tests direct-link source and approach selection.
      await page.goto(new URL(`/lab/g3b-map?source=${source}&approach=${approach}`, origin).href);
      assert.ok((await response).ok()); await ready(); await settle();
      await capture(`${source}-${approach}`);
      evidence[`${source}-${approach}`] = await position();
    }
  }
  await page.goto(new URL('/lab/g3b-map?source=cabin&approach=vision', origin).href);
  await ready(); await settle();
  await page.getByRole('checkbox', { name: 'Collision mask' }).uncheck();
  await page.getByRole('checkbox', { name: 'Overhead layer' }).uncheck(); await settle();
  // Verify source pixels survive exactly, including the masked overhead pass.
  const unchanged = await page.evaluate(async () => {
    const canvas = document.querySelector('[role="application"] canvas');
    const image = new Image(); image.src = '/moodboards/02-eigene-welt/images/it2-waldhuette-abend.jpg'; await image.decode();
    const reference = document.createElement('canvas'); reference.width = canvas.width; reference.height = canvas.height;
    reference.getContext('2d').drawImage(image, 0, 0);
    const actual = canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
    const expected = reference.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
    const player = document.querySelector('[role="application"]').dataset;
    let differences = 0;
    for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){
      if(Math.abs(x-Number(player.playerX))<8 && Math.abs(y-Number(player.playerY))<26)continue;
      const i=(y*canvas.width+x)*4;
      for(let c=0;c<4;c++)if(actual[i+c]!==expected[i+c]){differences++;break;}
    }
    return differences;
  });
  assert.equal(unchanged, 0, 'Original source pixels are unchanged outside the avatar');
  const start = await position();
  const diagonal = await move(['KeyD','KeyW'], 500);
  await reset(); const cardinal = await move(['ArrowRight'], 500);
  const distance = p => Math.hypot(p.x-start.x,p.y-start.y);
  assert.ok(Math.abs(distance(diagonal)-distance(cardinal))<5, 'Diagonal movement has the same speed');
  await reset();
  // Water is below the starting path. Hold down long enough to hit its edge.
  const water = await move(['KeyS'], 1500); const heldWater = await move(['ArrowDown'], 400);
  assert.ok(water.y<618 && water.y>600); assert.ok(Math.abs(heldWater.y-water.y)<1, 'Water collision holds');
  evidence.water = heldWater; await capture('player-water-edge');
  await reset();
  await move(['KeyA'], 2850); // Align with the narrow wooden bridge around x=504.
  const bridge = await move(['KeyS'], 2400);
  assert.ok(bridge.y>700,'Bridge remains traversable through the water collision region'); evidence.bridge=bridge;
  await reset();
  await move(['KeyA'], 1000); // Under the cabin wall, outside the door exception.
  const wall=await move(['KeyW'], 2300),heldWall=await move(['ArrowUp'],400);
  assert.ok(wall.y>430 && wall.y<445); assert.ok(Math.abs(heldWall.y-wall.y)<1,'Wall collision holds'); evidence.wall=heldWall;
  await reset();
  await move(['KeyA'],6400); await move(['KeyW'],4500); const roof=await move(['KeyD'],500);
  assert.equal(roof.hidden,true,'Player is partially visible behind the roof'); evidence.roof=roof;
  await capture('player-behind-roof');
  // Compare conservative raster and zoom extremes, then test local correction/reset.
  await page.getByRole('combobox',{name:'Collision precision'}).selectOption('16'); await settle(); await ready();
  await page.getByRole('checkbox',{name:'Tile grid'}).check();
  const zoom=page.getByRole('slider',{name:'Zoom',exact:true});
  for(const value of ['0.5','3','1']){await zoom.fill(value);await settle();}
  await page.getByText('Correct masks · original output',{exact:true}).click();
  await page.getByRole('checkbox',{name:'Paint on the picture'}).check();
  await page.getByRole('combobox',{name:'Brush'}).selectOption('both');
  const box=await surface.boundingBox();
  await page.mouse.move(box.x+box.width*.5,box.y+box.height*.7);await page.mouse.down();
  await page.mouse.move(box.x+box.width*.6,box.y+box.height*.7,{steps:5});await page.mouse.up();
  await page.getByRole('button',{name:'Restore model output'}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Restore model output'}).isEnabled(),true);
  await page.getByRole('button',{name:'Restore model output'}).click();
  assert.equal(await page.getByRole('button',{name:'Restore model output'}).isEnabled(),false);
  await page.getByRole('checkbox',{name:'Paint on the picture'}).uncheck();
  await page.setViewportSize({width:390,height:844}); await settle();
  const visible=await page.evaluate(()=>{
    const stage=document.querySelector('section[aria-label="Map walk and controls"]');stage.scrollIntoView();
    const scene=stage.querySelector('[role="application"]').getBoundingClientRect(),controls=stage.querySelector('aside').getBoundingClientRect();
    return {scene:scene.height,controls:controls.height,sceneTop:scene.top,controlsBottom:controls.bottom,viewport:innerHeight};
  });
  assert.ok(visible.scene>100 && visible.controls>100 && visible.controlsBottom<=visible.viewport+2,'Map and controls stay visible on mobile');
  evidence.mobile=visible;await page.screenshot({path:path.join(destination,'mobile-grid.png'),fullPage:false});
  assert.deepEqual(errors,[],'No browser runtime errors');
  await writeFile(path.join(destination,'checks.json'),JSON.stringify(evidence,null,2)+'\n');
  console.log(JSON.stringify(evidence,null,2));
} finally { await browser.close(); }
