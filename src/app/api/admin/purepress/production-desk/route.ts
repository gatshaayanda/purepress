import { NextResponse } from "next/server";
import { requirePurePressAdmin } from "@/lib/purepress/server/adminAuth";
import { listProductionDesk } from "@/lib/purepress/server/production";
export const dynamic="force-dynamic";
export async function GET(request:Request){try{await requirePurePressAdmin(request);return NextResponse.json({jobs:await listProductionDesk()},{headers:{"Cache-Control":"no-store, private"}});}catch(reason){const status=typeof reason==="object"&&reason&&"status" in reason?Number((reason as {status?:number}).status)||401:401;return NextResponse.json({error:status>=500?"PurePress could not load the production desk.":"PurePress owner authorization is required."},{status,headers:{"Cache-Control":"no-store, private"}});}}
