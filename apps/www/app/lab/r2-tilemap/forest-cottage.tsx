"use client";

import { useEffect, useRef, useState } from 'react';
import { createMovement, createMovementClock, DEFAULT_MOVEMENT, stepMovement } from '@evermore/core';
import { FOREST_COTTAGE_ART as art, cottageOccludes, createForestCottageWorld } from '@evermore/world';
import { useMovement } from '../../../components/lab/use-movement';
import { movementFromKeys } from '../../../components/lab/keyboard';
import { movementSprite } from '../../../components/lab/movement-sprite';
import { movementFloor } from './tilemap-model';

type ArtLayer = 'ground' | 'decoration' | 'objects' | 'facade' | 'overhead' | 'light';
const initialLayers: Record<ArtLayer, boolean> = { ground:true, decoration:true, objects:true, facade:true, overhead:true, light:true };
const reference = '/moodboards/02-eigene-welt/images/it2-waldhuette-tag.jpg';

export default function ForestCottage({ onSceneChange }: { onSceneChange: (scene: string) => void }) {
  const surface = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const keys = useMovement(surface);
  const [night, setNight] = useState(0);
  const [grid, setGrid] = useState(false);
  const [collision, setCollision] = useState(false);
  const [fade, setFade] = useState(true);
  const [layers, setLayers] = useState(initialLayers);
  const [reset, setReset] = useState(0);
  const [error, setError] = useState('');
  const [stats, setStats] = useState({ fps:0, ms:0, x:21.5, y:16.5, faded:0 });
  const [copied, setCopied] = useState('');
  const options = useRef({ night, grid, collision, fade, layers });
  useEffect(() => { options.current = { night, grid, collision, fade, layers }; }, [night,grid,collision,fade,layers]);

  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx) return;
    let cancelled=false, frame=0;
    const loadImage = (url:string) => new Promise<HTMLImageElement>((resolve,reject) => {
      const image=new Image(); image.onload=()=>resolve(image); image.onerror=()=>reject(new Error(`Could not load ${url}`)); image.src=url;
    });
    async function start() {
      const [atlas, ...sprites] = await Promise.all([loadImage('/forest-cottage/terrain.png'), ...art.sprites.map(sprite=>loadImage(`/forest-cottage/${sprite.id}.png`))]);
      if(cancelled || !ctx) return;
      const world=createForestCottageWorld();
      const motion=createMovement({ x:world.spawn.x+0.5, y:world.spawn.y+0.5, z:world.spawn.z });
      const advance=createMovementClock();
      let previous=performance.now(), sample=0, frames=0;
      ctx.imageSmoothingEnabled=false;
      function draw(now:number) {
        if(cancelled || !ctx) return;
        const elapsed=(now-previous)/1000; previous=now;
        const dt=Math.min(elapsed,0.05);
        advance(dt,()=>stepMovement(motion,movementFromKeys(keys.current),DEFAULT_MOVEMENT,p=>movementFloor(world,p)));
        const settings=options.current;
        ctx.globalAlpha=1; ctx.fillStyle='#213c2c';ctx.fillRect(0,0,688,384);
        if(settings.layers.ground) {
          art.ground.forEach((id,i)=>ctx.drawImage(atlas!,id%art.atlasColumns*16,Math.floor(id/art.atlasColumns)*16,16,16,i%art.width*16,Math.floor(i/art.width)*16,16,16));
          // Hidden ground under the cottage is authored floor, not missing pixels.
          ctx.fillStyle='#8d6545';ctx.fillRect(18*16,9*16,7*16,4*16);
          ctx.fillStyle='#a57b51';
          for(let y=9*16;y<13*16;y+=4) ctx.fillRect(18*16,y,7*16,1);
        }
        let faded=0;
        const drawSprite=(index:number) => {
          const sprite=art.sprites[index]!;
          if(!settings.layers[sprite.layer]) return;
          const occludes=(sprite.layer==='overhead' || sprite.layer==='facade') && settings.fade && cottageOccludes(sprite,motion.x,motion.y);
          ctx.globalAlpha=occludes?0.28:1; if(occludes) faded++;
          ctx.drawImage(sprites[index]!,sprite.x*16,sprite.y*16);ctx.globalAlpha=1;
        };
        // Ground details and front-facing walls below the avatar; roof/crowns above.
        art.sprites.forEach((sprite,i)=>{if(sprite.layer!=='overhead') drawSprite(i);});
        const x=Math.round(motion.x*16), y=Math.round(motion.y*16);
        ctx.fillStyle='#17221e';ctx.globalAlpha=0.45;ctx.beginPath();ctx.ellipse(x,y+1,5,2,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
        for(const mark of movementSprite(motion)) {ctx.fillStyle=`#${mark.color.toString(16).padStart(6,'0')}`;ctx.fillRect(x+mark.x,y+mark.y,mark.width,mark.height);}
        art.sprites.forEach((sprite,i)=>{if(sprite.layer==='overhead') drawSprite(i);});
        if(settings.layers.light && settings.night>0) {
          ctx.fillStyle=`rgba(13,20,60,${settings.night*0.7})`;ctx.fillRect(0,0,688,384);
          ctx.globalCompositeOperation='screen';
          for(const [lx,ly,radius] of [[311,186,48],[341,198,28]] as const) {
            const glow=ctx.createRadialGradient(lx,ly,2,lx,ly,radius);
            glow.addColorStop(0,`rgba(255,190,85,${settings.night*0.9})`);glow.addColorStop(1,'rgba(255,166,65,0)');
            ctx.fillStyle=glow;ctx.fillRect(lx-radius,ly-radius,radius*2,radius*2);
          }
          ctx.globalCompositeOperation='source-over';
        }
        if(settings.collision) {
          ctx.fillStyle='rgba(248,70,65,0.35)';
          for(let ty=0;ty<world.depth;ty++) for(let tx=0;tx<world.width;tx++) if(!world.isWalkable(tx,ty,3)) ctx.fillRect(tx*16,ty*16,16,16);
        }
        if(settings.grid) {
          ctx.strokeStyle='rgba(255,255,255,0.28)';ctx.lineWidth=1;ctx.beginPath();
          for(let tx=0;tx<=688;tx+=16){ctx.moveTo(tx+0.5,0);ctx.lineTo(tx+0.5,384);}
          for(let ty=0;ty<=384;ty+=16){ctx.moveTo(0,ty+0.5);ctx.lineTo(688,ty+0.5);}ctx.stroke();
        }
        if(surface.current) { surface.current.dataset.playerX=String(motion.x);surface.current.dataset.playerY=String(motion.y);surface.current.dataset.faded=String(faded); }
        sample+=elapsed;frames++;
        if(sample>=0.25) {setStats({fps:frames/sample,ms:sample/frames*1000,x:motion.x,y:motion.y,faded});sample=0;frames=0;}
        frame=requestAnimationFrame(draw);
      }
      frame=requestAnimationFrame(draw);
    }
    setError('');
    void start().catch(cause=>{if(!cancelled) setError(cause instanceof Error?cause.message:'The cottage could not load.');});
    return()=>{cancelled=true;cancelAnimationFrame(frame);};
  },[keys,reset]);

  const settings=JSON.stringify({scene:'moodboard',night,grid,collision,fade,layers},null,2);
  return <div className="grid gap-4">
    <section aria-label="Forest cottage comparison" className="sticky top-2 z-10 rounded border border-dusk bg-night p-3">
      <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
        <label>Scene <select aria-label="Scene" value="moodboard" onChange={event=>onSceneChange(event.target.value)} className="rounded bg-night p-1"><option value="moodboard">Moodboard: Forest cottage</option><option value="village">G3 library village</option><option value="meadow">Meadow house</option></select></label>
        <output aria-label="Cottage diagnostics" className="font-mono text-xs text-mist">{stats.fps.toFixed(0)} FPS · {stats.ms.toFixed(1)} ms · ({stats.x.toFixed(1)}, {stats.y.toFixed(1)}) · {stats.faded} faded</output>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <figure><figcaption className="mb-1 text-xs text-mist">Moodboard · original</figcaption>
          {/* The original reference must remain directly comparable at its native aspect ratio. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={reference} alt="Forest cottage moodboard with a thatched roof, vegetable garden and river bridge" width={1376} height={768} className="w-full" />
        </figure>
        <figure><figcaption className="mb-1 text-xs text-mist">R2 · 43 × 24 tiles · WASD / arrows</figcaption>
          <div ref={surface} tabIndex={0} role="application" aria-label="Forest cottage movement" className="focus:outline-2 focus:outline-gold">
            <canvas ref={canvas} width={688} height={384} className="block w-full [image-rendering:pixelated]" />
          </div>
        </figure>
      </div>
      <fieldset aria-label="Cottage controls" className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
        <legend className="sr-only">Cottage controls</legend>
        <label className="flex items-center gap-2">Day / night <input aria-label="Night amount" type="range" min={0} max={1} step={0.05} value={night} onChange={event=>setNight(Number(event.target.value))} className="w-24" /></label>
        <label><input type="checkbox" checked={grid} onChange={event=>setGrid(event.target.checked)} /> Tile grid</label>
        <label><input type="checkbox" checked={collision} onChange={event=>setCollision(event.target.checked)} /> Collision</label>
        <label><input type="checkbox" checked={fade} onChange={event=>setFade(event.target.checked)} /> Fade occluders</label>
        {(Object.keys(layers) as ArtLayer[]).map(layer=><label key={layer}><input type="checkbox" checked={layers[layer]} onChange={event=>setLayers({...layers,[layer]:event.target.checked})} /> {layer}</label>)}
        <button onClick={()=>setReset(value=>value+1)} className="rounded border border-gold px-2 py-1">Reset player</button>
      </fieldset>
    </section>
    {error !== '' && <p role="alert">{error}</p>}
    <p className="text-sm text-mist">Walk north through the door and south across the bridge. The roof and tree crowns fade over your character; only trunks, walls, the garden and water block movement. Toggle layers to see the terrain beneath them. The evening slider adds warm lantern light to the extracted daytime art.</p>
    <p className="text-sm text-mist">{art.ground.length} ground cells reuse {art.tileCount} extracted 16 px tiles; {art.sprites.length} separate sprites carry the roof, trees, facade and details. This is an authored reconstruction with collision data, not a generated world. Mask edges and hidden ground are approximate; extracting reusable terrain borders is a next step. No model calls were needed.</p>
    <details><summary>Settings JSON</summary><textarea aria-label="Cottage settings JSON" readOnly value={settings} rows={12} className="mt-2 w-full bg-black/30 p-3 font-mono text-xs" /><button onClick={()=>{
      if(typeof navigator.clipboard === 'undefined'){setCopied('Select and copy the JSON above.');return;}
      void navigator.clipboard.writeText(settings).then(()=>setCopied('Copied settings.'),()=>setCopied('Select and copy the JSON above.'));
    }} className="rounded border border-gold px-2 py-1">Copy settings</button><p role="status">{copied}</p></details>
  </div>;
}
