"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { World, decodeResult } from "../g3b-map/world";
import { SOURCES, gridMasks, type Masks, type MaskResult, paintMasks, rasterizeRegions, safeSpawn, type Brush } from "../g3b-map/model";
import { MAP_MODELS, VISION_MODELS, type Interior, type InteriorResponse } from "./generation";
import { CABIN_DOOR, CABIN_START, doorPassage, type Point } from "./model";
import styles from "../g3b-map/map.module.css";
import walkStyles from "./walk.module.css";
type Room = { record: Interior; raw: Masks };
export default function Experiment(){
  const [outside,setOutside]=useState<Masks>(),[room,setRoom]=useState<Room>(),[inside,setInside]=useState(false);
  const [outerDoor,setOuterDoor]=useState(CABIN_DOOR),[innerDoor,setInnerDoor]=useState<Point>(),[near,setNear]=useState(false);
  const [zoom,setZoom]=useState(1),[collision,setCollision]=useState(false),[overhead,setOverhead]=useState(false),[grid,setGrid]=useState(false),[size,setSize]=useState(1),[reset,setReset]=useState(0);
  const [marking,setMarking]=useState(false),[editing,setEditing]=useState(false),[brush,setBrush]=useState<Brush>("collision"),[radius,setRadius]=useState(12),[edits,setEdits]=useState<{outside?:Masks;inside?:Masks}>({});
  const [model,setModel]=useState<string>(MAP_MODELS[0].id),[maskModel,setMaskModel]=useState<string>(VISION_MODELS[0].id);
  const [busy,setBusy]=useState(false),[fading,setFading]=useState(false),[error,setError]=useState(""),[access,setAccess]=useState(false),[cost,setCost]=useState("Saved reference · $0 new cost"),[visits,setVisits]=useState(0),[copied,setCopied]=useState(false);
  const [returning,setReturning]=useState(false);
  const mounted=useRef(true),locked=useRef(false),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined),generation=useRef(0);
  useEffect(()=>{
    mounted.current=true;
    void Promise.all([
      fetch("/g3b-map/cabin-vision.json").then(async r=>{if(!r.ok)throw new Error("Cabin masks unavailable.");return decodeResult(await r.json() as MaskResult);}),
      fetch("/m1-walk/cabin-interior.json").then(async r=>{if(!r.ok)throw new Error("Saved room unavailable. Generate one locally.");const record=await r.json() as Interior;const image=new Image();image.src=record.image;await image.decode();return {record,raw:record.reviewedRegions?rasterizeRegions(record.width,record.height,record.reviewedRegions):await decodeResult(record.mask)};})
    ]).then(([masks,loaded])=>{if(mounted.current){setOutside(masks);setRoom(loaded);setInnerDoor(loaded.record.door);}}).catch(e=>{if(mounted.current)setError(e.message);});
    void fetch("/api/lab/m1-walk").then(r=>{if(mounted.current)setAccess(r.ok);}).catch(()=>{});
    return()=>{mounted.current=false;clearTimeout(timer.current);};
  },[]);
  const raw=inside?(edits.inside??room?.raw):(edits.outside??outside),door=inside?(innerDoor??room?.record.door):outerDoor;
  const passage=useMemo(()=>raw&&door?doorPassage(gridMasks(raw,size),door):undefined,[raw,door,size]);
  const initialSpawn=useMemo(()=>inside&&passage?safeSpawn(passage.masks,{x:passage.door.x,y:passage.door.y-25}):returning?passage?.spawn:CABIN_START,[inside,returning,passage]);
  function transition(){
    if(!near||!room||locked.current||busy||editing||marking)return;
    locked.current=true;setFading(true);setNear(false);
    timer.current=setTimeout(()=>{
      if(!mounted.current)return;
      if(!inside)setVisits(n=>n+1);
      setInside(!inside);setReturning(true);setReset(n=>n+1);
      timer.current=setTimeout(()=>{if(mounted.current){setFading(false);locked.current=false;}},220);
    },200);
  }
  async function generate(){
    if(locked.current||busy||inside)return;
    const id=++generation.current;setBusy(true);setError("");
    try {
      const response=await fetch("/api/lab/m1-walk",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model,maskModel}),signal:AbortSignal.timeout(250_000)});
      const data=await response.json() as InteriorResponse & {error?:string};
      if(!response.ok)throw new Error(data.error??"Interior generation failed.");
      const loaded={record:data.room,raw:await decodeResult(data.room.mask)};
      // Decode the picture before replacing the previous playable room.
      const image=new Image();image.src=data.room.image;await image.decode();
      if(!mounted.current||generation.current!==id)return;
      setRoom(loaded);setInnerDoor(data.room.door);setEdits(previous=>({...previous,inside:undefined}));setVisits(0);
      setCost(`${(data.durationMs/1000).toFixed(1)}s total · ${data.cached?"cache hit · $0 new cost":`~$${data.requestCostUsd.toFixed(4)} new cost`}`);
    }catch(e){if(mounted.current&&generation.current===id)setError(e instanceof Error?e.message:"Generation failed.");}
    finally{if(mounted.current&&generation.current===id)setBusy(false);}
  }
  async function saved(){
    if(locked.current||busy)return;
    const id=++generation.current;setBusy(true);setError("");
    try{
      const response=await fetch("/m1-walk/cabin-interior.json");if(!response.ok)throw new Error("Saved room unavailable.");
      const record=await response.json() as Interior,raw=record.reviewedRegions?rasterizeRegions(record.width,record.height,record.reviewedRegions):await decodeResult(record.mask);
      const image=new Image();image.src=record.image;await image.decode();
      if(!mounted.current||id!==generation.current)return;
      setRoom({record,raw});setInnerDoor(record.door);setEdits({});setInside(false);setReturning(true);setVisits(0);setNear(false);setCost("Saved reference · $0 new cost");
    }catch(e){if(mounted.current&&id===generation.current)setError(e instanceof Error?e.message:"Saved room failed to load.");}
    finally{if(mounted.current&&id===generation.current)setBusy(false);}
  }
  function mark(point:Point){if(inside)setInnerDoor(point);else setOuterDoor(point);setMarking(false);setNear(false);}
  function paint(from:Point,to:Point){const key=inside?"inside":"outside";setEdits(previous=>raw?{...previous,[key]:paintMasks(raw,from,to,radius,brush)}:previous);}
  const config={scene:inside?"interior":"exterior",outerDoor,innerDoor,zoom,collision,overhead,grid,precision:size,model,maskModel,roomId:room?.record.id};
  return <>
    <section className={styles.stage} aria-label="Cabin walk and controls" data-scene={inside?"interior":"exterior"} data-room-id={room?.record.id} data-visits={visits} data-fading={fading}>
      <div className={walkStyles.scene}>
        <World key={inside?"interior":"exterior"} url={inside?room!.record.image:SOURCES[0].url} masks={passage?.masks} collision={collision} overhead={overhead} grid={grid} zoom={zoom} reset={reset} editing={editing||marking} paint={paint} door={passage?.door} spawn={initialSpawn} paused={busy||fading} markDoor={marking?mark:undefined} interact={transition} nearby={setNear}/>
        <div className={`${walkStyles.fade} ${fading?walkStyles.dark:""}`} aria-hidden="true"/>
      </div>
      <aside className={styles.controls} aria-label="Cabin controls">
        <strong>{inside?"Inside · Forest cottage":"Outside · Forest cottage"}</strong>
        <button disabled={!near||!room||busy||fading||editing||marking} onClick={transition}>{inside?"Leave cabin":"Enter cabin"}</button>
        <p className={styles.note}>{near?"E / Enter or the button to cross the threshold.":"Walk to the gold ring at the door."} {visits>1?"Same cached room · $0 new cost.":""}</p>
        <label>Zoom · {zoom.toFixed(2)}×<input aria-label="Zoom" type="range" min={.5} max={3} step={.25} value={zoom} onChange={e=>setZoom(Number(e.target.value))}/></label>
        <label><input type="checkbox" checked={collision} onChange={e=>setCollision(e.target.checked)}/> Collision mask · red</label>
        <label><input type="checkbox" checked={overhead} onChange={e=>setOverhead(e.target.checked)}/> Overhead layer · blue</label>
        <label><input type="checkbox" checked={grid} onChange={e=>setGrid(e.target.checked)}/> Tile grid · 16 px</label>
        <label>Collision precision<select aria-label="Collision precision" value={size} onChange={e=>{setNear(false);setSize(Number(e.target.value));}}><option value={1}>Pixel mask</option><option value={16}>16 px cells · conservative</option></select></label>
        <button disabled={busy||fading} onClick={()=>{setNear(false);setReset(n=>n+1);}}>Reset player</button>
        <button disabled={busy||fading||editing} onClick={()=>setMarking(v=>!v)}>{marking?"Cancel door marking":"Mark door on picture"}</button>
        <p className={styles.note}>{marking?"Click the doorway threshold on the picture.":"Gold rings are explicit door markers. A small local threshold correction keeps the passage open."}</p>
        <details><summary>Correct masks</summary>
          <label><input type="checkbox" checked={editing} disabled={busy||fading||marking} onChange={e=>setEditing(e.target.checked)}/> Paint on picture</label>
          <label>Brush<select aria-label="Brush" value={brush} onChange={e=>setBrush(e.target.value as Brush)}><option value="collision">Block ground</option><option value="overhead">Add overhead</option><option value="clear">Clear both</option></select></label>
          <label>Brush radius<input aria-label="Brush radius" type="range" min={2} max={64} value={radius} onChange={e=>setRadius(Number(e.target.value))}/></label>
          <button onClick={()=>setEdits(previous=>({...previous,[inside?"inside":"outside"]:undefined}))}>Restore scene masks</button>
        </details>
        <details open><summary>Interior generation</summary>
          <label>Interior image model<select aria-label="Interior image model" value={model} onChange={e=>setModel(e.target.value)}>{MAP_MODELS.map(m=><option key={m.id} value={m.id}>{m.label} · {m.id}</option>)}</select></label>
          <label>Interior mask model<select aria-label="Interior mask model" value={maskModel} onChange={e=>setMaskModel(e.target.value)}>{VISION_MODELS.map(m=><option key={m.id} value={m.id}>{m.label} · {m.id}</option>)}</select></label>
          <button disabled={busy||!access||inside||fading} onClick={()=>void generate()}>{busy?"Generating room + masks…":"Generate interior from cabin"}</button>
          <button disabled={busy||fading} onClick={()=>void saved()}>Use saved room</button>
          <p role="status" className={styles.note}>{cost}</p>
          {room&&<p className={styles.note}>Image: {room.record.model} · {(room.record.durationMs/1000).toFixed(1)}s · ~${room.record.estimatedCostUsd.toFixed(4)}<br/>Masks: {room.record.mask.model} · {(room.record.mask.durationMs/1000).toFixed(1)}s · ~${room.record.mask.estimatedCostUsd.toFixed(4)}</p>}
          <p className={styles.note}>Local live calls: 8 pipelines / hour, $1 estimated reservations. Failed calls count. Same settings reuse a process cache; changing a selector only affects the next generation.</p>
        </details>
        <button onClick={()=>{void navigator.clipboard.writeText(JSON.stringify(config,null,2)).then(()=>setCopied(true)).catch(()=>setError("Clipboard unavailable."));}}>{copied?"Settings copied":"Copy settings JSON"}</button>
        {error!==""&&<p role="alert" className={styles.error}>{error}</p>}
      </aside>
    </section>
    <p className="mt-5 text-sm text-mist">The original pictures form the ground; their masked pixels pass above the player. Occlusion keeps a 40% silhouette visible. The saved sample includes explicit reviewed furniture corrections; its original model polygons are retained. Live model masks are approximate: inspect walls and furniture or correct them with the brush. Markers and threshold corrections are explicit experiment annotations. The saved room works offline; new rooms keep the previous result if generation fails.</p>
  </>;
}
