"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { createMovement, createMovementClock, DEFAULT_MOVEMENT, stepMovement } from "@evermore/core";
import { useMovement } from "../../../components/lab/use-movement";
import { movementFromKeys } from "../../../components/lab/keyboard";
import { movementSprite } from "../../../components/lab/movement-sprite";
import { SOURCES, decodeColourMask, rasterizeRegions, gridMasks, safeSpawn, walkable, occluded, type Masks, type MaskResult, type Approach, paintMasks, type Brush } from "./model";
import { MAP_MODELS, VISION_MODELS } from "./generation";
import { type MapGeneration } from "../g3-map/generation";
import styles from "./map.module.css";
async function loadImage(url:string){const image=new Image();image.src=url;await image.decode();return image;}
async function decodeResult(result:MaskResult):Promise<Masks>{
  if(result.regions)return rasterizeRegions(result.width,result.height,result.regions);
  if(result.mask===undefined)throw new Error("No mask returned.");
  const image=await loadImage(result.mask);
  if(image.naturalWidth!==result.width||image.naturalHeight!==result.height)throw new Error("Mask size differs from the source.");
  const canvas=document.createElement("canvas");canvas.width=result.width;canvas.height=result.height;
  const ctx=canvas.getContext("2d");if(!ctx)throw new Error("Canvas unavailable.");ctx.drawImage(image,0,0);
  return decodeColourMask(result.width,result.height,ctx.getImageData(0,0,result.width,result.height).data);
}
function maskCanvas(masks:Masks,kind:"collision"|"overhead",colour:number[]){
  const canvas=document.createElement("canvas");canvas.width=masks.width;canvas.height=masks.height;const ctx=canvas.getContext("2d")!;
  const pixels=ctx.createImageData(masks.width,masks.height);
  for(let i=0;i<masks[kind].length;i++)if(masks[kind][i] === 1)pixels.data.set(colour,i*4);
  ctx.putImageData(pixels,0,0);return canvas;
}
function World({url,masks,collision,overhead,grid,zoom,reset,editing,paint}:{url:string;masks?:Masks;collision:boolean;overhead:boolean;grid:boolean;zoom:number;reset:number;editing:boolean;paint:(from:{x:number;y:number},to:{x:number;y:number})=>void}) {
  const surface=useRef<HTMLDivElement>(null),canvas=useRef<HTMLCanvasElement>(null),keys=useMovement(surface);
  const options=useRef({collision,overhead,grid,editing});useEffect(()=>{options.current={collision,overhead,grid,editing};},[collision,overhead,grid,editing]);
  const stroke=useRef<{x:number;y:number}|undefined>(undefined);
  const point=(event:React.PointerEvent<HTMLDivElement>)=>{const rect=canvas.current!.getBoundingClientRect();return {x:(event.clientX-rect.left)*canvas.current!.width/rect.width,y:(event.clientY-rect.top)*canvas.current!.height/rect.height};};
  const [stats,setStats]=useState("Loading picture…"),[error,setError]=useState("");
  useEffect(()=>{
    let cancelled=false,frame=0;const ctx=canvas.current?.getContext("2d");if(!ctx)return;
    if(surface.current)surface.current.dataset.ready="false";
    async function start(){
      const image=await loadImage(url);if(cancelled||!ctx||!canvas.current)return;setError("");
      canvas.current.width=image.naturalWidth;canvas.current.height=image.naturalHeight;
      if(masks&&(masks.width!==image.naturalWidth||masks.height!==image.naturalHeight))throw new Error("Source and mask dimensions differ.");
      const spawn=masks?safeSpawn(masks):undefined;
      const motion=createMovement({x:(spawn?.x??image.naturalWidth/2)/16,y:(spawn?.y??image.naturalHeight*.72)/16,z:0});
      const advance=createMovementClock();let previous=performance.now(),sample=0;
      const red=masks?maskCanvas(masks,"collision",[255,45,45,100]):undefined,blue=masks?maskCanvas(masks,"overhead",[40,140,255,105]):undefined;
      const layer=masks?maskCanvas(masks,"overhead",[255,255,255,255]):undefined;
      if(layer){const lc=layer.getContext("2d")!;lc.globalCompositeOperation="source-in";lc.drawImage(image,0,0);}
      function draw(now:number){if(cancelled||!ctx)return;const dt=(now-previous)/1000;previous=now;
        if(masks&&spawn&&!options.current.editing)advance(dt,()=>stepMovement(motion,movementFromKeys(keys.current),{...DEFAULT_MOVEMENT,cornerTolerance:0},p=>walkable(masks,p.x*16,p.y*16)?0:null));
        ctx.globalAlpha=1;ctx.imageSmoothingEnabled=false;ctx.drawImage(image,0,0);
        const x=motion.x*16,y=motion.y*16,hidden=masks&&spawn?occluded(masks,x,y):false;
        const avatar=()=>{for(const mark of movementSprite(motion)){ctx.fillStyle=`#${mark.color.toString(16).padStart(6,"0")}`;ctx.fillRect(Math.round(x)+mark.x,Math.round(y)+mark.y,mark.width,mark.height);}};
        if(spawn){avatar();if(layer)ctx.drawImage(layer,0,0);if(hidden){ctx.globalAlpha=.4;avatar();ctx.globalAlpha=1;}}
        if(options.current.collision&&red)ctx.drawImage(red,0,0);if(options.current.overhead&&blue)ctx.drawImage(blue,0,0);
        if(options.current.grid){ctx.beginPath();ctx.strokeStyle="#ffffff40";for(let gx=0;gx<image.naturalWidth;gx+=16){ctx.moveTo(gx+.5,0);ctx.lineTo(gx+.5,image.naturalHeight);}for(let gy=0;gy<image.naturalHeight;gy+=16){ctx.moveTo(0,gy+.5);ctx.lineTo(image.naturalWidth,gy+.5);}ctx.stroke();}
        if(surface.current){surface.current.dataset.playerX=String(x);surface.current.dataset.playerY=String(y);surface.current.dataset.occluded=String(hidden);surface.current.dataset.ready=String(Boolean(masks));}
        sample+=dt;if(sample>.2){setStats(!masks?"Choose saved masks or extract them to walk.":!spawn?"No safe spawn: this mask blocks the whole map.":`Feet (${x.toFixed(1)}, ${y.toFixed(1)}) · ${hidden?"behind overhead · silhouette 40%":"visible"}`);sample=0;}
        frame=requestAnimationFrame(draw);
      }
      frame=requestAnimationFrame(draw);
    }
    void start().catch(e=>{if(!cancelled)setError(e instanceof Error?e.message:"Picture failed to load.");});
    return()=>{cancelled=true;cancelAnimationFrame(frame);};
  },[url,masks,reset,keys]);
  return <div className={styles.scene}>
    <div className={styles.viewport}><div ref={surface} role="application" aria-label="Map movement" tabIndex={0} className={styles.surface} onPointerDown={e=>{if(!editing)return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);stroke.current=point(e);paint(stroke.current,stroke.current);}} onPointerMove={e=>{if(!editing||!stroke.current)return;const next=point(e);paint(stroke.current,next);stroke.current=next;}} onPointerUp={()=>{stroke.current=undefined;}} onPointerCancel={()=>{stroke.current=undefined;}} onLostPointerCapture={()=>{stroke.current=undefined;}} style={{cursor:editing?"crosshair":"default",width:`${zoom*100}%`}}><canvas ref={canvas} aria-label="Unchanged map with player and masks"/></div></div>
    <output aria-label="Movement diagnostics" className={styles.note}>{error!==""?error:stats}</output>
    <div className={styles.pad} aria-label="Touch movement">{[["←","ArrowLeft"],["↑","ArrowUp"],["↓","ArrowDown"],["→","ArrowRight"]].map(([label,code])=><button key={code} aria-label={`Move ${code!.slice(5).toLowerCase()}`} onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);keys.current.add(code!);}} onPointerUp={()=>keys.current.delete(code!)} onPointerCancel={()=>keys.current.delete(code!)} onLostPointerCapture={()=>keys.current.delete(code!)}>{label}</button>)}</div>
  </div>;
}
export default function Experiment(){
  const query=new URLSearchParams(window.location.search);
  const [source,setSource]=useState(query.get("source")==="harbour"?"harbour":"cabin"),[approach,setApproach]=useState<Approach>(query.get("approach")==="image"?"image":"vision");
  const [model,setModel]=useState<string>(approach === "image" ? MAP_MODELS[0].id : VISION_MODELS[0].id),[mapModel,setMapModel]=useState<string>(MAP_MODELS[0].id);
  const [live,setLive]=useState<string>(),[prompt,setPrompt]=useState("A forest cabin with a path, a door, a pond and a bridge.");
  const [record,setRecord]=useState<MaskResult>(),[raw,setRaw]=useState<Masks>(),[maskError,setMaskError]=useState("");
  const [collision,setCollision]=useState(true),[overhead,setOverhead]=useState(true),[grid,setGrid]=useState(false),[size,setSize]=useState(1),[zoom,setZoom]=useState(1),[reset,setReset]=useState(0);
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[access,setAccess]=useState(false),[cost,setCost]=useState<string>();
  const revision=useRef(0),mounted=useRef(true),original=useRef<Masks|undefined>(undefined);
  const [editing,setEditing]=useState(false),[brush,setBrush]=useState<Brush>("collision"),[radius,setRadius]=useState(12),[edited,setEdited]=useState(false);
  function clearMasks(){revision.current++;setRecord(undefined);setRaw(undefined);original.current=undefined;setMaskError("");setError("");setBusy(false);setCost(undefined);setEdited(false);}
  function paint(from:{x:number;y:number},to:{x:number;y:number}){setRaw(previous=>previous?paintMasks(previous,from,to,radius,brush):previous);setEdited(true);}
  const url=SOURCES.find(s=>s.id===source)?.url??live;
  const masks=useMemo(()=>raw?gridMasks(raw,size):undefined,[raw,size]);
  useEffect(()=>{mounted.current=true;void fetch("/api/lab/g3b-map").then(r=>{if(mounted.current)setAccess(r.ok);}).catch(()=>{});return()=>{mounted.current=false;};},[]);
  useEffect(()=>{
    const id=++revision.current;
    if(source==="live")return;
    void fetch(`/g3b-map/${source}-${approach}.json`).then(async r=>{if(!r.ok)throw new Error("No saved mask yet. Extract masks locally.");return await r.json() as MaskResult;}).then(async result=>{const mask=await decodeResult(result);if(mounted.current&&revision.current===id){original.current=mask;setRecord(result);setRaw(mask);setEdited(false);setCost("Saved model output · $0 new cost");}}).catch(e=>{if(mounted.current&&revision.current===id)setMaskError(e.message);});
  },[source,approach]);
  async function extract(){
    const id=++revision.current;setBusy(true);setError("");
    try{const response=await fetch("/api/lab/g3b-map",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({source,approach,model,image:source==="live"?live:undefined}),signal:AbortSignal.timeout(140_000)});
      const data=await response.json() as {result:MaskResult;cached:boolean;durationMs:number;requestCostUsd:number;error?:string};if(!response.ok)throw new Error(data.error??"Mask extraction failed.");
      const mask=await decodeResult(data.result);if(!mounted.current||id!==revision.current)return;
      original.current=mask;setEdited(false);setRecord(data.result);setRaw(mask);setMaskError("");setCost(`${(data.durationMs/1000).toFixed(1)}s · ${data.cached?"cache hit · $0 new cost":`~$${data.requestCostUsd.toFixed(4)}`}`);
    }catch(e){if(mounted.current&&id===revision.current)setError(e instanceof Error?e.message:"Mask extraction failed.");}finally{if(mounted.current&&id===revision.current)setBusy(false);}
  }
  async function generate(){const id=++revision.current;setBusy(true);setError("");try{
    const response=await fetch("/api/lab/g3-map",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt,model:mapModel,seed:1}),signal:AbortSignal.timeout(110_000)});
    const data=await response.json() as MapGeneration & {error?:string};if(!response.ok)throw new Error(data.error??"Map generation failed.");if(!mounted.current||id!==revision.current)return;
    setLive(data.map.image);setSource("live");setRecord(undefined);setRaw(undefined);original.current=undefined;setEdited(false);setMaskError("");setCost(`Map ${(data.durationMs/1000).toFixed(1)}s · ~$${data.requestCostUsd.toFixed(4)}. Extract masks next.`);
  }catch(e){if(mounted.current&&id===revision.current)setError(e instanceof Error?e.message:"Map generation failed.");}finally{if(mounted.current&&id===revision.current)setBusy(false);}}
  return <>
    <section className={styles.stage} aria-label="Map walk and controls">
      {url!==undefined?<World url={url} masks={masks} collision={collision} overhead={overhead} grid={grid} zoom={zoom} reset={reset} editing={editing} paint={paint}/>:<p>Generate a map to begin.</p>}
      <aside className={styles.controls} aria-label="Map controls">
        <label>Source<select aria-label="Source" value={source} onChange={e=>{clearMasks();setSource(e.target.value);}}>{SOURCES.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}{live!==undefined&&<option value="live">Latest generated map</option>}</select></label>
        <label>Approach<select aria-label="Approach" value={approach} onChange={e=>{const a=e.target.value as Approach;clearMasks();setApproach(a);setModel(a==="image"?MAP_MODELS[0].id:VISION_MODELS[0].id);}}><option value="image">A · Image edit → colour mask</option><option value="vision">B · Vision → object polygons</option></select></label>
        <label>Collision precision<select aria-label="Collision precision" value={size} onChange={e=>setSize(Number(e.target.value))}><option value={1}>Pixel mask</option><option value={16}>16 px cells · conservative</option></select></label>
        <label><input type="checkbox" checked={collision} onChange={e=>setCollision(e.target.checked)}/> Collision mask · red</label>
        <label><input type="checkbox" checked={overhead} onChange={e=>setOverhead(e.target.checked)}/> Overhead layer · blue</label>
        <label><input type="checkbox" checked={grid} onChange={e=>setGrid(e.target.checked)}/> Tile grid · 16 px</label>
        <label>Zoom · {zoom.toFixed(2)}×<input aria-label="Zoom" type="range" min={.5} max={3} step={.25} value={zoom} onChange={e=>setZoom(Number(e.target.value))}/></label>
        <button onClick={()=>setReset(v=>v+1)}>Reset player</button>
        <p className={styles.note}>{record?`${record.model} · original ${(record.durationMs/1000).toFixed(1)}s · ~$${record.estimatedCostUsd.toFixed(4)} (${record.costBasis})`:maskError}</p>
        {cost!==undefined&&<p role="status" className={styles.note}>{cost}</p>}
        <details><summary>Correct masks · {edited?"local edits":"original output"}</summary>
          <label><input type="checkbox" checked={editing} disabled={!raw} onChange={e=>setEditing(e.target.checked)}/> Paint on the picture (movement paused)</label>
          <label>Brush<select aria-label="Brush" value={brush} onChange={e=>setBrush(e.target.value as Brush)}><option value="collision">Block ground</option><option value="overhead">Add overhead</option><option value="both">Block + overhead</option><option value="clear-collision">Clear collision</option><option value="clear-overhead">Clear overhead</option><option value="clear">Clear both</option></select></label>
          <label>Brush radius · {radius} px<input aria-label="Brush radius" type="range" min={2} max={64} value={radius} onChange={e=>setRadius(Number(e.target.value))}/></label>
          <button disabled={!edited} onClick={()=>{setRaw(original.current);setEdited(false);}}>Restore model output</button>
          <p className={styles.note}>Edits affect this session only. Source or approach changes discard them. Original samples stay available; 16 px cells are recomputed from your edits.</p>
        </details>
        <label>Extraction model<select aria-label="Extraction model" value={model} onChange={e=>setModel(e.target.value)}>{(approach==="image"?MAP_MODELS:VISION_MODELS).map(m=><option key={m.id} value={m.id}>{m.label} · {m.id}</option>)}</select></label>
        <button disabled={busy||!access||url===undefined} onClick={()=>void extract()}>{busy?"Working…":"Extract masks"}</button>
        <p className={styles.note}>Live extraction is available in the local lab. Up to 16 calls and $1 in estimated reservations per hour, including failed calls. Estimates are not billing caps. Saved masks need no live service.</p>
        <details><summary>Generate a new source</summary><label>Map description<textarea aria-label="Map description" rows={3} maxLength={500} value={prompt} onChange={e=>setPrompt(e.target.value)}/></label><label>Map image model<select value={mapModel} onChange={e=>setMapModel(e.target.value)}>{MAP_MODELS.map(m=><option key={m.id} value={m.id}>{m.label}</option>)}</select></label><button disabled={busy||!access||prompt.trim()===""} onClick={()=>void generate()}>Generate map</button><p className={styles.note}>Map generation has its own $1/hour reservation budget.</p></details>
        {error!==""&&<p role="alert" className={styles.error}>{error}</p>}
      </aside>
    </section>
    <p className="mt-5 text-sm text-mist">No ground is invented beneath roofs: the original picture is the base and its masked pixels are drawn above the player. An occluded avatar is redrawn at 40% opacity. Vision polygons approximate object boundaries; an image edit may shift edges. Neither is verified geometry. Compare walls, fences, water, bridge decks and door openings. A 16 px cell blocks if any source pixel blocks, so narrow passages can close.</p>
  </>;
}
