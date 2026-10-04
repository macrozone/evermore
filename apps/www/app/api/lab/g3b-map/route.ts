import { NextResponse } from "next/server";
import { deny } from "../g3-map/local-access";
import { parseMaskInput } from "../../../lab/g3b-map/generation";
import { maskGenerator, MapLimitError, MapProviderError } from "./generate";
export const runtime="nodejs";
const headers={"Cache-Control":"no-store"};
export async function GET(request:Request) {const rejected=deny(request);if(rejected)return rejected;return NextResponse.json({budget:maskGenerator.budget()},{headers});}
export async function POST(request:Request) {
  const rejected=deny(request);if(rejected)return rejected;
  let input;
  try {
    const reader=request.body?.getReader();if(!reader)throw new TypeError("Provide mask settings.");
    let size=0;const chunks:Uint8Array[]=[];
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>8_010_000){await reader.cancel();return NextResponse.json({error:"Source is too large."},{status:413,headers});}chunks.push(value);}
    input=parseMaskInput(JSON.parse(Buffer.concat(chunks).toString("utf8")));
  }catch(error){return NextResponse.json({error:error instanceof TypeError?error.message:"Invalid mask settings."},{status:400,headers});}
  try{return NextResponse.json(await maskGenerator.generate(input),{headers});}
  catch(error){console.error(error);return NextResponse.json({error:error instanceof MapProviderError || error instanceof MapLimitError?error.message:"Mask extraction failed.",budget:maskGenerator.budget()},{status:error instanceof MapLimitError?429:502,headers});}
}
