import { rasterizeRegions, safeSpawn, walkable, type MaskResult } from "../g3b-map/model";
import { doorPassage, type Point } from "./model";
/** Reject a model that encloses the whole room as one blocked wall rectangle. */
export function reachableInterior(result:MaskResult,door:Point) {
  if(!result.regions)return false;
  const masks=doorPassage(rasterizeRegions(result.width,result.height,result.regions),door).masks;
  const start=safeSpawn(masks,door);if(!start)return false;
  const size=4,columns=Math.ceil(result.width/size),rows=Math.ceil(result.height/size),seen=new Uint8Array(columns*rows);
  const sx=Math.round(start.x/size),sy=Math.round(start.y/size),queue=[sy*columns+sx];seen[queue[0]!]=1;
  let count=0;
  for(let head=0;head<queue.length;head++){
    const index=queue[head]!,x=index%columns,y=Math.floor(index/columns);
    if(!walkable(masks,x*size,y*size))continue;
    count++;
    for(const [nx,ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){
      if(nx!<0||ny!<0||nx!>=columns||ny!>=rows)continue;
      const next=ny!*columns+nx!;if(seen[next]===1)continue;seen[next]=1;queue.push(next);
    }
  }
  return count*size*size>=result.width*result.height*.08;
}
