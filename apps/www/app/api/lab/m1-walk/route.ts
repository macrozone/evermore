import { NextResponse } from "next/server";
import { deny } from "../g3-map/local-access";
import { parseInteriorInput } from "../../../lab/m1-walk/generation";
import { interiorGenerator, MapLimitError, MapProviderError } from "./generate";
export const runtime="nodejs";
const headers={"Cache-Control":"no-store"};
export async function GET(request:Request){const rejected=deny(request);if(rejected)return rejected;return NextResponse.json({budget:interiorGenerator.budget()},{headers});}
export async function POST(request:Request){
  const rejected=deny(request);if(rejected)return rejected;
  let input;
  try {
    const reader=request.body?.getReader();if(!reader)throw new TypeError("Choose interior models.");
    let size=0;const chunks:Uint8Array[]=[];
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>2048){await reader.cancel();return NextResponse.json({error:"Settings too large."},{status:413,headers});}chunks.push(value);}
    input=parseInteriorInput(JSON.parse(Buffer.concat(chunks).toString("utf8")));
  }catch(e){return NextResponse.json({error:e instanceof TypeError?e.message:"Invalid settings."},{status:400,headers});}
  try{return NextResponse.json(await interiorGenerator.generate(input),{headers});}
  catch(e){console.error(e);return NextResponse.json({error:e instanceof MapLimitError||e instanceof MapProviderError?e.message:"Interior generation failed.",budget:interiorGenerator.budget()},{status:e instanceof MapLimitError?429:502,headers});}
}
