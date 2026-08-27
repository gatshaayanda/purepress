import { NextResponse } from "next/server";
import { parseArtworkAction, PurePressArtworkProofError } from "@/lib/purepress/artworkProof";
import { requirePurePressAdmin } from "@/lib/purepress/server/adminAuth";
import { getArtworkProofBundle, performArtworkProofAction } from "@/lib/purepress/server/artworkWorkflow";
import { logProofFailure } from "@/lib/purepress/server/proofDiagnostics";
export const dynamic = "force-dynamic";
const MAX_BODY_BYTES = 24 * 1024;
const privateHeaders = { "Cache-Control": "no-store, private" };
export async function GET(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try { await requirePurePressAdmin(request); const { projectId } = await context.params; return NextResponse.json(await getArtworkProofBundle(projectId), { headers: privateHeaders }); }
  catch (reason) { const status=typeof reason==="object"&&reason&&"status" in reason?Number((reason as {status?:number}).status)||401:401; const diagnosticId=status>=500?logProofFailure("owner-get",reason):undefined; return NextResponse.json({error:status>=500?"PurePress could not load artwork/proof state.":"PurePress owner authorization is required.",...(diagnosticId?{diagnosticId}:{})},{status,headers:privateHeaders}); }
}
export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const admin=await requirePurePressAdmin(request); const {projectId}=await context.params; const bodyText=await request.text();
    if(Buffer.byteLength(bodyText,"utf8")>MAX_BODY_BYTES) return NextResponse.json({error:"Artwork/proof action is too large."},{status:413,headers:privateHeaders});
    const body=JSON.parse(bodyText) as Record<string,unknown>; const action=parseArtworkAction(body); const result=await performArtworkProofAction(projectId,action,admin.uid??"purepress-admin");
    return NextResponse.json(result,{headers:privateHeaders});
  } catch(reason) {
    const status=reason instanceof PurePressArtworkProofError?reason.status:typeof reason==="object"&&reason&&"status" in reason?Number((reason as {status?:number}).status)||400:reason instanceof SyntaxError?400:500;
    const diagnosticId=status>=500?logProofFailure("owner-action",reason):undefined; return NextResponse.json({error:status>=500?"PurePress could not complete the artwork/proof action.":reason instanceof Error?reason.message:"Artwork/proof action was rejected.",...(diagnosticId?{diagnosticId}:{})},{status,headers:privateHeaders});
  }
}
