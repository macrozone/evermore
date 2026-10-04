import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import path from 'node:path';
const origin=new URL(process.argv[2]??'http://localhost:9600');
const destination=path.resolve(process.argv[3]??'docs/lab/experiments/m1-outpaint');await mkdir(destination,{recursive:true});
const browser=await chromium.launch({headless:true});const evidence={};
try {
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(new URL('/lab/m1-outpaint',origin).href);
  const surface=page.getByRole('application',{name:'Expanding world movement'});
  await page.waitForFunction(()=>document.querySelector('[role="application"]')?.dataset.ready==='true');
  const position=()=>surface.evaluate(e=>({x:Number(e.dataset.playerX),y:Number(e.dataset.playerY),hidden:e.dataset.occluded==='true',chunks:Number(e.dataset.chunks)}));
  const settle=()=>page.waitForTimeout(300);
  const move=async(key,ms)=>{await surface.focus();await page.keyboard.down(key);await page.waitForTimeout(ms);await page.keyboard.up(key);await settle();return position();};
  evidence.initial=await position();
  // Delay the saved east chunk to make real prefetch loading and collision observable.
  await page.route('**/m1-outpaint/east.json',async route=>{await page.waitForTimeout(4000);await route.continue();});
  await page.getByRole('checkbox',{name:'World overview'}).check();
  await page.getByRole('checkbox',{name:'Place player'}).check();
  const box=await surface.boundingBox();
  // Map overview fits the entire 3x3 cross; place close to the east path exit.
  const width=1376,height=768,scale=Math.min(box.width/(3*width),box.height/(3*height));
  const place=async(x,y)=>{await surface.click({position:{x:box.width/2+(x-width/2)*scale,y:box.height/2+(y-height/2)*scale}});await settle();};
  await place(1250,518);await page.getByText('east: Loading saved chunk…',{exact:true}).waitFor();
  await page.screenshot({path:path.join(destination,'loading.png'),fullPage:true});
  evidence.waitingAtBoundary=await move('KeyD',2400);assert.equal(evidence.waitingAtBoundary.chunks,0);assert.ok(evidence.waitingAtBoundary.x<1372,'Missing chunk blocks feet at the edge');
  await page.waitForFunction(()=>document.querySelector('[role="application"]')?.dataset.chunks==='1');
  evidence.prefetch=await position();
  await page.unroute('**/m1-outpaint/east.json');
  for(const direction of ['north','south','west']){
    await page.getByRole('button',{name:`Load ${direction}`,exact:true}).click();
    await page.getByRole('button',{name:`Inspect ${direction} seam`}).waitFor({state:'visible'});
    await page.waitForFunction(d=>!Array.from(document.querySelectorAll('button')).find(b=>b.textContent===`Inspect ${d} seam`)?.disabled,direction);
  }
  await page.waitForFunction(()=>document.querySelector('[role="application"]')?.dataset.chunks==='4');
  await settle();await page.screenshot({path:path.join(destination,'world-overview.png'),fullPage:true});
  for(const direction of ['north','east','south','west']){
    for(const method of ['pure','blend']){
      await page.getByRole('combobox',{name:'Seam method'}).selectOption(method);
      await page.getByRole('button',{name:`Inspect ${direction} seam`}).click();await settle();
      await page.screenshot({path:path.join(destination,`${direction}-${method}-seam.png`),fullPage:true});
    }
  }
  // Pure mode preserves every parent pixel outside the avatar, even after loading neighbours.
  await page.getByRole('combobox',{name:'Seam method'}).selectOption('pure');
  await page.getByRole('button',{name:'Follow player'}).click();await page.getByRole('slider',{name:'Zoom'}).fill('1');await settle();
  evidence.parentPixelDifferences=await page.evaluate(async()=>{
    const surface=document.querySelector('[role="application"]'),canvas=surface.querySelector('canvas'),ctx=canvas.getContext('2d'),transform=ctx.getTransform();
    const image=new Image();image.src='/moodboards/02-eigene-welt/images/it2-waldhuette-abend.jpg';await image.decode();
    const expected=document.createElement('canvas');expected.width=canvas.width;expected.height=canvas.height;const ec=expected.getContext('2d');ec.imageSmoothingEnabled=false;ec.setTransform(transform);ec.drawImage(image,0,0);
    const actual=ctx.getImageData(0,0,canvas.width,canvas.height).data,reference=ec.getImageData(0,0,canvas.width,canvas.height).data;let differences=0;
    for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){
      const wx=(x-transform.e)/transform.a,wy=(y-transform.f)/transform.d;
      if(wx<2||wx>=image.naturalWidth-2||wy<2||wy>=image.naturalHeight-2)continue;
      if(Math.abs(wx-Number(surface.dataset.playerX))<10&&Math.abs(wy-Number(surface.dataset.playerY))<30)continue;
      const i=(y*canvas.width+x)*4;for(let c=0;c<4;c++)if(actual[i+c]!==reference[i+c]){differences++;break;}
    }
    return differences;
  });assert.equal(evidence.parentPixelDifferences,0,'Pure mode keeps source pixels unchanged');
  await page.getByRole('combobox',{name:'Seam method'}).selectOption('blend');
  // Walk from the path in the original image into the east neighbour, across the full feet footprint.
  await page.getByRole('checkbox',{name:'World overview'}).check();await settle();
  await place(1340,518);evidence.beforeCrossing=await position();
  const east=await move('KeyD',1300);evidence.eastCrossing=east;assert.ok(east.x>1376,'Player crosses the east seam');
  // Exercise actual masks in the generated east tile, including translucent crowns.
  const eastRecord=JSON.parse(await readFile('apps/www/public/m1-outpaint/east.json','utf8'));
  const regions=eastRecord.masks.regions;
  function inside(x,y,p){let hit=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const a=p[i],b=p[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;}
  function bits(x,y,kind){let hit=false;for(const r of [...regions.filter(r=>r.kind===kind),...regions.filter(r=>kind==='collision'&&r.kind==='free')])if(inside((x+.5)*1000/width,(y+.5)*1000/height,r.polygon))hit=r.kind===kind;return hit;}
  function free(x,y){for(let py=Math.floor(y-2);py<=Math.ceil(y+2);py++)for(let px=Math.floor(x-4);px<=Math.ceil(x+4);px++)if(bits(px,py,'collision'))return false;return true;}
  let waterPoint,crownPoint;
  for(let y=32;y<height-40&&(!waterPoint||!crownPoint);y+=4)for(let x=32;x<width-32&&(!waterPoint||!crownPoint);x+=16){
    if(!free(x,y))continue;
    if(!waterPoint&&!free(x,y+32))waterPoint={x,y};
    if(!crownPoint&&Array.from({length:20},(_,i)=>y-i).some(py=>bits(x,py,'overhead')))crownPoint={x,y};
  }
  assert.ok(waterPoint&&crownPoint,'Generated masks contain collision and overhead test points');
  await page.getByRole('checkbox',{name:'World overview'}).check();await settle();
  await place(width+waterPoint.x,waterPoint.y);
  const blocked=await move('KeyS',1200),held=await move('KeyS',600);assert.ok(Math.abs(blocked.y-held.y)<1,'Collision in new chunk holds');evidence.newChunkCollision=held;
  await page.getByRole('button',{name:'Follow player'}).click();await page.getByRole('slider',{name:'Zoom'}).fill('4');await settle();
  await page.screenshot({path:path.join(destination,'new-chunk-collision.png'),fullPage:true});
  await page.getByRole('checkbox',{name:'World overview'}).check();await settle();await place(width+crownPoint.x,crownPoint.y);
  evidence.newChunkOverhead=await position();assert.equal(evidence.newChunkOverhead.hidden,true);
  await page.getByRole('button',{name:'Follow player'}).click();await settle();await page.screenshot({path:path.join(destination,'new-chunk-overhead.png'),fullPage:true});
  // Saved costs are historical, and reloading restores the same browser chunk without a model call.
  await page.getByRole('button',{name:'Inspect east seam'}).click();
  await page.getByRole('checkbox',{name:'Collision mask'}).check();await page.getByRole('checkbox',{name:'Overhead layer'}).check();await settle();
  await page.screenshot({path:path.join(destination,'east-masks.png'),fullPage:true});
  const liveCalls=[];page.on('request',r=>{if(r.method()==='POST')liveCalls.push(r.url());});
  await page.reload();await page.waitForFunction(()=>document.querySelector('[role="application"]')?.dataset.ready==='true');
  await page.getByRole('button',{name:'Load east',exact:true}).click();await page.getByText('Restored from browser',{exact:true}).waitFor();assert.deepEqual(liveCalls,[]);
  // Replacing chunk settings resets a player in the discarded neighbour to the source.
  await page.getByRole('checkbox',{name:'World overview'}).check();await settle();
  const restoredBox=await surface.boundingBox(),restoredScale=Math.min(restoredBox.width/(3*width),restoredBox.height/(3*height));
  await page.getByRole('checkbox',{name:'Place player'}).check();
  await surface.click({position:{x:restoredBox.width/2+(width+40-width/2)*restoredScale,y:restoredBox.height/2+(518-height/2)*restoredScale}});await settle();
  assert.ok((await position()).x>width,'Settings regression starts in the neighbour');
  await page.getByRole('combobox',{name:'Chunk source'}).selectOption('live');await settle();
  evidence.settingsReset=await position();assert.equal(evidence.settingsReset.chunks,0);assert.ok(evidence.settingsReset.x>0&&evidence.settingsReset.x<width&&evidence.settingsReset.y>0&&evidence.settingsReset.y<height,'Discarded chunks cannot strand the player');
  await page.getByRole('combobox',{name:'Chunk source'}).selectOption('saved');await settle();assert.deepEqual(liveCalls,[]);
  assert.match(await page.getByRole('status',{name:'Movement diagnostics'}).textContent(),/\d+ FPS · [\d.]+ ms/);
  await page.context().grantPermissions(['clipboard-read','clipboard-write'],{origin:origin.origin});
  await page.getByRole('button',{name:'Copy settings JSON'}).click();
  evidence.settings=JSON.parse(await page.evaluate(()=>navigator.clipboard.readText()));assert.equal(evidence.settings.model,'gemini-3-pro-image');assert.equal(evidence.settings.maskModel,'gemini-3.8-flash');assert.equal(evidence.settings.overview,false);
  for(const zoom of ['0.5','6']){
    await page.getByRole('slider',{name:'Zoom'}).fill(zoom);await settle();
    await page.screenshot({path:path.join(destination,`zoom-${zoom}.png`),fullPage:true});
  }
  await page.getByRole('slider',{name:'Zoom'}).fill('1');
  await page.setViewportSize({width:390,height:844});await page.locator('section').scrollIntoViewIfNeeded();await settle();
  evidence.mobile=await page.evaluate(()=>{const stage=document.querySelector('section'),scene=stage.querySelector('[role="application"]').getBoundingClientRect(),controls=stage.querySelector('aside').getBoundingClientRect();return {scene:scene.height,controls:controls.height,bottom:controls.bottom,viewport:innerHeight};});
  assert.ok(evidence.mobile.scene>100&&evidence.mobile.controls>100&&evidence.mobile.bottom<=evidence.mobile.viewport+2);
  await page.screenshot({path:path.join(destination,'mobile.png'),fullPage:false});assert.deepEqual(errors,[]);
  await writeFile(path.join(destination,'checks.json'),JSON.stringify(evidence,null,2)+'\n');console.log(evidence);
}finally{await browser.close();}
