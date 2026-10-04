import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
// Deliberately spends the local lab budget; run only when verifying live generation.
const origin=new URL(process.argv[2]??'http://127.0.0.1:9500');
assert.ok(['localhost','127.0.0.1'].includes(origin.hostname));
const browser=await chromium.launch({headless:true});
try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  await page.goto(new URL('/lab/g3b-map',origin).href);
  await page.getByText('Generate a new source',{exact:true}).click();
  await page.getByRole('textbox',{name:'Map description'}).fill('An isolated tiny cottage in a broad empty grass clearing, one straight path and one small pond with a wooden bridge. Only two trees, no forest, no fences or decorative objects.');
  const generated=page.waitForResponse(r=>r.url().endsWith('/api/lab/g3-map')&&r.request().method()==='POST',{timeout:125000});
  await page.getByRole('button',{name:'Generate map',exact:true}).click();
  const mapResponse=await generated,mapData=await mapResponse.json();assert.equal(mapResponse.status(),200,JSON.stringify(mapData.error));
  await page.getByRole('combobox',{name:'Source',exact:true}).locator('option[value="live"]').waitFor({state:'attached'});
  assert.equal(await page.getByRole('combobox',{name:'Source',exact:true}).inputValue(),'live');
  const extracted=page.waitForResponse(r=>r.url().endsWith('/api/lab/g3b-map')&&r.request().method()==='POST',{timeout:150000});
  await page.getByRole('button',{name:'Extract masks',exact:true}).click();
  const response=await extracted,data=await response.json();assert.equal(response.status(),200,JSON.stringify(data.error));
  await page.waitForFunction(()=>document.querySelector('[role="application"]')?.dataset.ready==='true');await page.waitForTimeout(400);
  assert.equal(await page.locator('aside [role="alert"]').count(),0);
  const layout=await page.evaluate(()=>{
    const stage=document.querySelector('section[aria-label="Map walk and controls"]').getBoundingClientRect();
    const note=document.querySelector('output[aria-label="Movement diagnostics"]').getBoundingClientRect();
    return {stageBottom:stage.bottom,noteBottom:note.bottom};
  });
  assert.ok(layout.noteBottom<layout.stageBottom,'Square generated maps stay inside the stage');
  await page.screenshot({path:'docs/lab/experiments/g3b-map/live-vision.png',fullPage:true});
  const evidence={map:{model:mapData.map.model,width:mapData.map.width,height:mapData.map.height,durationMs:mapData.map.durationMs,estimatedCostUsd:mapData.map.estimatedCostUsd},mask:{model:data.result.model,width:data.result.width,height:data.result.height,regions:data.result.regions.length,durationMs:data.result.durationMs,estimatedCostUsd:data.result.estimatedCostUsd},layout};
  await writeFile('docs/lab/experiments/g3b-map/live-checks.json',JSON.stringify(evidence,null,2)+'\n');console.log(evidence);
}finally{await browser.close();}
