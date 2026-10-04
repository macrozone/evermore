import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
const origin=new URL(process.argv[2]??'http://localhost:5600');
assert.ok(['localhost','127.0.0.1'].includes(origin.hostname));
const destination=path.resolve(process.argv[3]??'docs/lab/experiments/m1-walk');
await mkdir(destination,{recursive:true});
const browser=await chromium.launch({headless:true});
const evidence={},errors=[];
try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(new URL('/lab/m1-walk',origin).href);
  const surface=page.getByRole('application',{name:'Map movement'}),stage=page.getByRole('region',{name:'Cabin walk and controls'});
  const ready=()=>page.waitForFunction(()=>document.querySelector('[role=application]')?.dataset.ready==='true');
  const position=()=>surface.evaluate(e=>({x:Number(e.dataset.playerX),y:Number(e.dataset.playerY),hidden:e.dataset.occluded==='true'}));
  const settle=()=>page.waitForTimeout(300);
  const capture=name=>page.screenshot({path:path.join(destination,`${name}.png`),fullPage:!(["scrolled","mobile"].includes(name))});
  const move=async(code,ms)=>{await surface.focus();await page.keyboard.down(code);await page.waitForTimeout(ms);await page.keyboard.up(code);await settle();return position();};
  const reset=async()=>{await page.getByRole('button',{name:'Reset player',exact:true}).click();await ready();await settle();};
  const scene=async name=>{await page.waitForFunction(name=>document.querySelector('[aria-label="Cabin walk and controls"]')?.dataset.scene===name,name);await ready();await page.waitForFunction(()=>document.querySelector('[aria-label="Cabin walk and controls"]')?.dataset.fading==='false');await settle();};
  await ready();await settle();const initialBox=await surface.boundingBox();assert.ok(initialBox.width>200&&initialBox.height>200,"Picture occupies a visible area on initial load");await capture('start');
  assert.equal(await page.getByRole('button',{name:'Enter cabin',exact:true}).isEnabled(),false,'Cannot enter at a distance');
  evidence.start=await position();
  await move('KeyW',1400);
  assert.equal(await page.getByRole('button',{name:'Enter cabin',exact:true}).isEnabled(),true,'Walking to exterior door enables entry');
  evidence.door=await position();await capture('outside-door');
  const roomId=await stage.getAttribute('data-room-id');
  await page.keyboard.press('KeyE');
  await page.waitForFunction(()=>document.querySelector('[aria-label="Cabin walk and controls"]')?.dataset.fading==='true');
  evidence.fadeObserved=true;
  await scene('interior');await capture('inside');evidence.inside=await position();
  assert.equal(await stage.getAttribute('data-room-id'),roomId);
  evidence.unchangedInteriorPixels=await page.evaluate(async()=>{
    const room=await fetch('/m1-walk/cabin-interior.json').then(r=>r.json());
    const image=new Image();image.src=room.image;await image.decode();
    const canvas=document.querySelector('[role=application] canvas'),reference=document.createElement('canvas');
    reference.width=canvas.width;reference.height=canvas.height;reference.getContext('2d').drawImage(image,0,0);
    const actual=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data,expected=reference.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
    const d=document.querySelector('[role=application]').dataset;let differences=0;
    for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){
      if(Math.abs(x-Number(d.playerX))<10&&Math.abs(y-Number(d.playerY))<30)continue;
      if(Math.abs(x-room.door.x)<20&&Math.abs(y-room.door.y)<12)continue;
      const i=(y*canvas.width+x)*4;for(let c=0;c<4;c++)if(actual[i+c]!==expected[i+c]){differences++;break;}
    }
    return differences;
  });
  assert.equal(evidence.unchangedInteriorPixels,0,'Interior source pixels stay unchanged outside marker/avatar');
  // Furniture collision: move left from the doorway into the table footprint.
  await move('KeyW',2200);await move('KeyA',5000);
  const furniture=await position();await move('KeyA',400);const held=await position();
  assert.ok(Math.abs(furniture.x-held.x)<1,'Furniture/wall collision stops held movement');
  evidence.furniture=held;await capture('inside-collision');
  await reset();
  assert.equal(await page.getByRole('button',{name:'Leave cabin',exact:true}).isEnabled(),true);
  await page.getByRole('button',{name:'Leave cabin',exact:true}).click();
  await scene('exterior');evidence.returned=await position();
  assert.ok(Math.abs(evidence.returned.x-500)<5&&evidence.returned.y>=450&&evidence.returned.y<485,'Return places feet in front of exterior door');
  await capture('outside-return');
  let liveCalls=0;page.on('request',r=>{if(r.method()==='POST'&&r.url().endsWith('/api/lab/m1-walk'))liveCalls++;});
  await page.getByRole('button',{name:'Enter cabin',exact:true}).click();await scene('interior');
  assert.equal(await stage.getAttribute('data-room-id'),roomId);assert.equal(liveCalls,0,'Re-entry makes no model calls');
  assert.equal(await stage.getAttribute('data-visits'),'2');
  evidence.cachedRoom=roomId;
  await page.getByRole('checkbox',{name:'Collision mask'}).check();await page.getByRole('checkbox',{name:'Overhead layer'}).check();await capture('inside-masks');
  const zoom=page.getByRole('slider',{name:'Zoom',exact:true});
  for(const value of ['0.5','3','1']){await zoom.fill(value);await settle();await capture(`zoom-${value}`);}
  await page.getByRole('combobox',{name:'Collision precision'}).selectOption('16');await ready();await settle();
  assert.equal(await page.getByRole('button',{name:'Leave cabin',exact:true}).isEnabled(),true,'Threshold stays open at conservative precision');
  await page.getByRole('combobox',{name:'Collision precision'}).selectOption('1');await ready();await settle();
  // All control interaction is local; selectors never silently generate.
  await page.getByRole('combobox',{name:'Interior image model'}).selectOption('gemini-3-pro-image');
  await page.getByRole('combobox',{name:'Interior mask model'}).selectOption('gemini-3.1-pro-preview');assert.equal(liveCalls,0);
  await page.getByRole('button',{name:'Mark door on picture'}).click();
  const box=await surface.boundingBox();await page.mouse.click(box.x+box.width*.5,box.y+box.height*.79);await settle();
  assert.equal(await page.getByRole('button',{name:'Mark door on picture'}).count(),1);
  await page.getByText('Correct masks',{exact:true}).click();
  await page.getByRole('checkbox',{name:'Paint on picture'}).check();
  await page.getByRole('combobox',{name:'Brush',exact:true}).selectOption('collision');
  await page.mouse.click(box.x+box.width*.6,box.y+box.height*.5);await settle();
  await page.getByRole('button',{name:'Restore scene masks'}).click();await page.getByRole('checkbox',{name:'Paint on picture'}).uncheck();
  await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));await settle();
  const layout=async()=>{const controls=await page.getByRole('complementary',{name:'Cabin controls'}).boundingBox(),canvas=await page.locator('[role=application] canvas').boundingBox(),viewport=page.viewportSize();assert.ok(controls.y>=0&&controls.y+controls.height<=viewport.height+1);assert.ok(canvas.x+canvas.width>0&&canvas.y+canvas.height>0);assert.ok(controls.x>=canvas.x+Math.min(canvas.width,500)||controls.y>=canvas.y+Math.min(canvas.height,150),'Controls and visible scene are separate');return {controls,canvas,viewport};};
  evidence.scrolled=await layout();await capture('scrolled');
  await page.setViewportSize({width:390,height:844});await settle();await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));await settle();
  evidence.mobile=await layout();await capture('mobile');
  await page.getByRole('checkbox',{name:'Collision mask'}).uncheck();await page.getByRole('checkbox',{name:'Overhead layer'}).uncheck();
  await surface.focus();const touchStart=await position(),upButton=await page.getByRole('button',{name:'Move up',exact:true}).boundingBox();
  await page.mouse.move(upButton.x+upButton.width/2,upButton.y+upButton.height/2);await page.mouse.down();await page.waitForTimeout(600);await page.mouse.up();await settle();
  const touched=await position();assert.ok(touched.y<touchStart.y-20,'Touch movement continues when the focused picture loses focus');evidence.touch={start:touchStart,end:touched};
  await capture('mobile-touch');
  const fps=Number(await surface.getAttribute('data-fps'));assert.ok(fps>0);evidence.fps=fps;
  await page.waitForTimeout(1000);assert.ok(Number(await surface.getAttribute('data-fps'))>0,'Renderer keeps running over time');
  assert.deepEqual(errors,[]);
  await writeFile(path.join(destination,'evidence.json'),JSON.stringify(evidence,null,2));
  console.log(JSON.stringify(evidence,null,2));
}finally{await browser.close();}
