"use client";
import { useEffect, useRef, useState } from "react";
import { createMovement, createMovementClock, DEFAULT_MOVEMENT, stepMovement } from "@evermore/core";
import { useMovement } from "../../../components/lab/use-movement";
import { movementFromKeys } from "../../../components/lab/keyboard";
import { movementSprite } from "../../../components/lab/movement-sprite";
import { decodeColourMask, rasterizeRegions, safeSpawn, walkable, occluded, type Masks, type MaskResult } from "./model";
import styles from "./map.module.css";
export type Door = { x:number; y:number };
async function loadImage(url:string){const image=new Image();image.src=url;await image.decode();return image;}
export async function decodeResult(result:MaskResult):Promise<Masks>{
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
export function World({url,masks,collision,overhead,grid,zoom,reset,editing,paint,door,spawn:preferred,paused=false,markDoor,interact,nearby}:{url:string;masks?:Masks;collision:boolean;overhead:boolean;grid:boolean;zoom:number;reset:number;editing:boolean;paint:(from:{x:number;y:number},to:{x:number;y:number})=>void;door?:Door;spawn?:Door;paused?:boolean;markDoor?:(point:Door)=>void;interact?:()=>void;nearby?:(near:boolean)=>void}) {
  const viewport=useRef<HTMLDivElement>(null);
  const [aspect,setAspect]=useState(16/9),[fitWidth,setFitWidth]=useState<number>();
  useEffect(()=>{const element=viewport.current;if(!element)return;const update=()=>setFitWidth(Math.min(element.clientWidth,element.clientHeight*aspect));const observer=new ResizeObserver(update);observer.observe(element);update();return()=>observer.disconnect();},[aspect]);
  const surface=useRef<HTMLDivElement>(null),canvas=useRef<HTMLCanvasElement>(null),keys=useMovement(surface);
  const options=useRef({collision,overhead,grid,editing,door,paused,interact,nearby});useEffect(()=>{options.current={collision,overhead,grid,editing,door,paused,interact,nearby};},[collision,overhead,grid,editing,door,paused,interact,nearby]);
  useEffect(()=>{if(options.current.door)surface.current?.focus({preventScroll:true});},[]);
  const stroke=useRef<{x:number;y:number}|undefined>(undefined);
  const point=(event:React.PointerEvent<HTMLDivElement>)=>{const rect=canvas.current!.getBoundingClientRect();return {x:(event.clientX-rect.left)*canvas.current!.width/rect.width,y:(event.clientY-rect.top)*canvas.current!.height/rect.height};};
  const [stats,setStats]=useState("Loading picture…"),[error,setError]=useState(""),[performanceStats,setPerformance]=useState("");
  useEffect(()=>{
    let cancelled=false,frame=0;const ctx=canvas.current?.getContext("2d");if(!ctx)return;
    if(surface.current)surface.current.dataset.ready="false";
    async function start(){
      const image=await loadImage(url);if(cancelled||!ctx||!canvas.current)return;setError("");
      canvas.current.width=image.naturalWidth;canvas.current.height=image.naturalHeight;setAspect(image.naturalWidth/image.naturalHeight);
      if(masks&&(masks.width!==image.naturalWidth||masks.height!==image.naturalHeight))throw new Error("Source and mask dimensions differ.");
      const spawn=masks?safeSpawn(masks,preferred):undefined;
      const motion=createMovement({x:(spawn?.x??image.naturalWidth/2)/16,y:(spawn?.y??image.naturalHeight*.72)/16,z:0});
      const advance=createMovementClock();let previous=performance.now(),sample=0,frames=0,lastNear=false;
      const red=masks?maskCanvas(masks,"collision",[255,45,45,100]):undefined,blue=masks?maskCanvas(masks,"overhead",[40,140,255,105]):undefined;
      const layer=masks?maskCanvas(masks,"overhead",[255,255,255,255]):undefined;
      if(layer){const lc=layer.getContext("2d")!;lc.globalCompositeOperation="source-in";lc.drawImage(image,0,0);}
      function draw(now:number){if(cancelled||!ctx)return;const dt=(now-previous)/1000;previous=now;
        if(masks&&spawn&&!options.current.editing&&!options.current.paused)advance(dt,()=>stepMovement(motion,movementFromKeys(keys.current),{...DEFAULT_MOVEMENT,cornerTolerance:0},p=>walkable(masks,p.x*16,p.y*16)?0:null));
        ctx.globalAlpha=1;ctx.imageSmoothingEnabled=false;ctx.drawImage(image,0,0);
        const x=motion.x*16,y=motion.y*16,hidden=masks&&spawn?occluded(masks,x,y):false;
        const portal=options.current.door,near=Boolean(portal&&Math.hypot(x-portal.x,y-portal.y)<=36);
        if(near!==lastNear){lastNear=near;options.current.nearby?.(near);}
        const avatar=()=>{for(const mark of movementSprite(motion)){ctx.fillStyle=`#${mark.color.toString(16).padStart(6,"0")}`;ctx.fillRect(Math.round(x)+mark.x,Math.round(y)+mark.y,mark.width,mark.height);}};
        if(spawn){avatar();if(layer)ctx.drawImage(layer,0,0);if(hidden){ctx.globalAlpha=.4;avatar();ctx.globalAlpha=1;}}
        if(portal){ctx.strokeStyle=near?"#ffedb5":"#d6b77c";ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(portal.x,portal.y,15,7,0,0,Math.PI*2);ctx.stroke();}
        if(options.current.collision&&red)ctx.drawImage(red,0,0);if(options.current.overhead&&blue)ctx.drawImage(blue,0,0);
        if(options.current.grid){ctx.beginPath();ctx.strokeStyle="#ffffff40";for(let gx=0;gx<image.naturalWidth;gx+=16){ctx.moveTo(gx+.5,0);ctx.lineTo(gx+.5,image.naturalHeight);}for(let gy=0;gy<image.naturalHeight;gy+=16){ctx.moveTo(0,gy+.5);ctx.lineTo(image.naturalWidth,gy+.5);}ctx.stroke();}
        if(surface.current){surface.current.dataset.playerX=String(x);surface.current.dataset.playerY=String(y);surface.current.dataset.occluded=String(hidden);surface.current.dataset.ready=String(Boolean(masks));surface.current.dataset.nearDoor=String(near);}
        frames++;sample+=dt;if(sample>.2){setStats(!masks?"Choose saved masks or extract them to walk.":!spawn?"No safe spawn: this mask blocks the whole map.":`Feet (${x.toFixed(1)}, ${y.toFixed(1)}) · ${hidden?"behind overhead · silhouette 40%":"visible"}`);if(surface.current){surface.current.dataset.fps=(frames/sample).toFixed(0);surface.current.dataset.nearDoor=String(near);}setPerformance(`${(frames/sample).toFixed(0)} FPS · ${(sample*1000/frames).toFixed(1)} ms/frame`);frames=0;sample=0;}
        frame=requestAnimationFrame(draw);
      }
      frame=requestAnimationFrame(draw);
    }
    void start().catch(e=>{if(!cancelled)setError(e instanceof Error?e.message:"Picture failed to load.");});
    return()=>{cancelled=true;cancelAnimationFrame(frame);};
  },[url,masks,reset,keys,preferred]);
  return <div className={styles.scene}>
    <div ref={viewport} className={styles.viewport}><div ref={surface} role="application" aria-label="Map movement" tabIndex={0} className={styles.surface} onKeyDown={e=>{if(["KeyE","Enter"].includes(e.code)&&!e.ctrlKey&&!e.metaKey&&!e.altKey){e.preventDefault();if(!e.repeat&&!options.current.paused&&surface.current?.dataset.nearDoor==="true")options.current.interact?.();}}} onPointerDown={e=>{if(markDoor){markDoor(point(e));return;}if(!editing)return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);stroke.current=point(e);paint(stroke.current,stroke.current);}} onPointerMove={e=>{if(!editing||!stroke.current)return;const next=point(e);paint(stroke.current,next);stroke.current=next;}} onPointerUp={()=>{stroke.current=undefined;}} onPointerCancel={()=>{stroke.current=undefined;}} onLostPointerCapture={()=>{stroke.current=undefined;}} style={{cursor:editing?"crosshair":"default",width:fitWidth!==undefined?`${fitWidth*zoom}px`:`${zoom*100}%`}}><canvas ref={canvas} aria-label="Unchanged map with player and masks"/></div></div>
    <output aria-label="Movement diagnostics" className={styles.note}>{error!==""?error:stats} · {performanceStats}</output>
    <div className={styles.pad} aria-label="Touch movement">{[["←","ArrowLeft"],["↑","ArrowUp"],["↓","ArrowDown"],["→","ArrowRight"]].map(([label,code])=><button key={code} aria-label={`Move ${code!.slice(5).toLowerCase()}`} onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);keys.current.add(code!);}} onPointerUp={()=>keys.current.delete(code!)} onPointerCancel={()=>keys.current.delete(code!)} onLostPointerCapture={()=>keys.current.delete(code!)}>{label}</button>)}</div>
  </div>;
}
