import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir, unlink } from 'node:fs/promises';
import path from 'node:path';
const origin=new URL(process.argv[2]??'http://localhost:9600');
if(!['localhost','127.0.0.1'].includes(origin.hostname))throw new Error('Use a loopback origin.');
const destination=path.resolve('docs/lab/experiments/m1-outpaint');await mkdir(destination,{recursive:true});
const browser=await chromium.launch({headless:true});
try {
  const context=await browser.newContext({viewport:{width:1280,height:900},recordVideo:{dir:destination,size:{width:1280,height:900}}});
  const page=await context.newPage();await page.goto(new URL('/lab/m1-outpaint',origin).href);
  const surface=page.getByRole('application',{name:'Expanding world movement'});
  await page.waitForFunction(()=>document.querySelector('[role="application"]')?.dataset.ready==='true');
  await page.getByRole('button',{name:'Load east',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('[role="application"]')?.dataset.chunks==='1');
  await page.getByRole('checkbox',{name:'World overview'}).check();await page.getByRole('checkbox',{name:'Place player'}).check();await page.waitForTimeout(300);
  const box=await surface.boundingBox(),scale=Math.min(box.width/(3*1376),box.height/(3*768));
  await surface.click({position:{x:box.width/2+(1330-688)*scale,y:box.height/2+(518-384)*scale}});
  await page.getByRole('button',{name:'Follow player'}).click();await page.getByRole('slider',{name:'Zoom'}).fill('2');await page.waitForTimeout(300);
  await surface.focus();await page.keyboard.down('KeyD');await page.waitForTimeout(3200);await page.keyboard.up('KeyD');await page.waitForTimeout(400);
  assert.ok(await surface.evaluate(e=>Number(e.dataset.playerX)>1376),'Recorded movement crossed into the new tile');
  await page.keyboard.down('KeyA');await page.waitForTimeout(2000);await page.keyboard.up('KeyA');await page.waitForTimeout(400);
  const video=page.video();await context.close();await video.saveAs(path.join(destination,'east-crossing.webm'));await unlink(await video.path());
  console.log('Recorded headless east crossing and return.');
}finally{await browser.close();}
