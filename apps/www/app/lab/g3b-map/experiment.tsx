"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { SOURCES, gridMasks, type Masks, type MaskResult, type Approach, paintMasks, type Brush } from "./model";
import { MAP_MODELS, VISION_MODELS } from "./generation";
import { type MapGeneration } from "../g3-map/generation";
import styles from "./map.module.css";
import { World, decodeResult } from "./world";
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
