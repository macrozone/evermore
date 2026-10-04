import assert from 'node:assert/strict';
import { readFile,mkdir,writeFile,access } from 'node:fs/promises';
const origin=new URL(process.argv[2]??'http://localhost:9600');
assert.ok(['localhost','127.0.0.1'].includes(origin.hostname));
const destination='apps/www/public/m1-outpaint';await mkdir(destination,{recursive:true});
const source=await readFile('docs/art/moodboards/02-eigene-welt/it2-waldhuette-abend.jpg');
const directions=(process.argv.find(a=>a.startsWith('--directions='))?.split('=')[1]??'north,east,south,west').split(',');
for(const direction of directions){
  assert.ok(['north','east','south','west'].includes(direction));
  try {if(process.argv.includes("--replace"))throw new Error("replace");await access(`${destination}/${direction}.json`);console.log(direction,'already saved');continue;} catch {}
  const response=await fetch(new URL('/api/lab/m1-outpaint',origin),{method:'POST',headers:{'Content-Type':'application/json',origin:origin.origin},body:JSON.stringify({direction,model:process.argv.find(a=>a.startsWith("--image-model="))?.split("=")[1],maskModel:process.argv.find(a=>a.startsWith("--mask-model="))?.split("=")[1],image:`data:image/jpeg;base64,${source.toString('base64')}`}),signal:AbortSignal.timeout(260_000)});
  const data=await response.json();if(!response.ok)throw new Error(`${direction}: ${response.status} ${data.error}`);
  const chunk=data.chunk;
  for(const name of ['image','context']){await writeFile(`${destination}/${direction}-${name}.png`,Buffer.from(chunk[name].split(',')[1],'base64'));chunk[name]=`/m1-outpaint/${direction}-${name}.png`;}
  await writeFile(`${destination}/${direction}.json`,JSON.stringify(chunk,null,2)+'\n');
  console.log(direction,chunk.durationMs,chunk.estimatedCostUsd);
}
