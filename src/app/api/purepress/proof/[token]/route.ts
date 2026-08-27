import { NextResponse } from "next/server";
import { PurePressArtworkProofError } from "@/lib/purepress/artworkProof";
import { decideProofByToken, getProofByToken } from "@/lib/purepress/server/proofs";
import { logProofFailure } from "@/lib/purepress/server/proofDiagnostics";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, private", "X-Robots-Tag": "noindex, nofollow, noarchive" };
export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  try { const {token}=await context.params; return NextResponse.json({proof:await getProofByToken(token)},{headers}); }
  catch(reason){ const status=typeof reason==="object"&&reason&&"status" in reason?Number((reason as {status?:number}).status)||404:404; const diagnosticId=status>=500?logProofFailure("customer-get",reason):undefined; return NextResponse.json({error:status>=500?"PurePress could not open this proof.":reason instanceof Error?reason.message:"This proof could not be opened.",...(diagnosticId?{diagnosticId}:{})},{status,headers}); }
}
export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  try { const bodyText=await request.text(); if(Buffer.byteLength(bodyText,"utf8")>8*1024) return NextResponse.json({error:"Proof decision is too large."},{status:413,headers}); const body=JSON.parse(bodyText); const {token}=await context.params; return NextResponse.json(await decideProofByToken(token,body),{headers}); }
  catch(reason){ const status=reason instanceof PurePressArtworkProofError?reason.status:typeof reason==="object"&&reason&&"status" in reason?Number((reason as {status?:number}).status)||400:reason instanceof SyntaxError?400:500; const diagnosticId=status>=500?logProofFailure("customer-decision",reason):undefined; return NextResponse.json({error:status>=500?"PurePress could not record this proof decision.":reason instanceof Error?reason.message:"Proof decision was rejected.",...(diagnosticId?{diagnosticId}:{})},{status,headers}); }
}
