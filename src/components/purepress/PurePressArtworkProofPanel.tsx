"use client";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { auth } from "@/utils/firebaseConfig";
import { useUploadThing } from "@/utils/uploadthing";
import styles from "./PurePressArtworkProofPanel.module.css";
type Category="quote_artwork"|"customer_artwork"|"proof"|"digitized_production_file"|"sample_evidence";
interface FileRow{id:string;category:Category;fileName:string;mimeType:string;sizeBytes:number;viewUrl:string;createdAt:string;}
interface Bundle{projectId:string;referenceCode:string;status:string;readiness?:Record<string,string>;embroidery:Record<string,unknown>;workflow:{currentProofId?:string;currentProofRevision?:number};sourceQuoteArtworkFileIds:string[];files:FileRow[];proofs:Array<{id:string;revision:number;createdAt:string;state?:{status:string;decision?:{approverName:string;source:string;decidedAt:string}}}>;currentProofState?:{status:string}|null;}
async function ownerFetch(url:string,init?:RequestInit){const token=await auth.currentUser?.getIdToken();const headers=new Headers(init?.headers);if(token)headers.set("Authorization",`Bearer ${token}`);if(init?.body)headers.set("Content-Type","application/json");return fetch(url,{...init,headers,credentials:"include",cache:"no-store"});}
export default function PurePressArtworkProofPanel({projectId}:{projectId:string}){
 const[bundle,setBundle]=useState<Bundle|null>(null);const[loading,setLoading]=useState(true);const[busy,setBusy]=useState("");const[error,setError]=useState("");const[shareLink,setShareLink]=useState("");
 const load=useCallback(async()=>{setLoading(true);setError("");try{const r=await ownerFetch(`/api/admin/purepress/jobs/${encodeURIComponent(projectId)}/artwork-proof`);const d=await r.json();if(!r.ok)throw new Error(d.error||"Could not load artwork workflow.");setBundle(d);}catch(e){setError(e instanceof Error?e.message:"Could not load artwork workflow.");}finally{setLoading(false);}},[projectId]);
 useEffect(()=>{void load();},[load]);
 async function action(actionName:string,extra:Record<string,unknown>={}){setBusy(actionName);setError("");try{const r=await ownerFetch(`/api/admin/purepress/jobs/${encodeURIComponent(projectId)}/artwork-proof`,{method:"POST",body:JSON.stringify({action:actionName,...extra})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Artwork action failed.");if(d.sharePath)setShareLink(`${window.location.origin}${d.sharePath}`);await load();}catch(e){setError(e instanceof Error?e.message:"Artwork action failed.");}finally{setBusy("");}}
 if(loading)return <section className={styles.panel}><p role="status">Loading artwork and proof workflow…</p></section>;
 if(!bundle)return <section className={styles.panel}><p className={styles.error}>{error||"Artwork workflow unavailable."}</p></section>;
 const proofFiles=bundle.files.filter((file)=>file.category==="proof");
 return <section className={styles.panel} aria-labelledby="pp-artwork-heading">
  <div className={styles.heading}><div><p className="pp-kicker">ARTWORK + PROOF</p><h2 id="pp-artwork-heading">Production artwork readiness</h2><p>Private source artwork, digitising, immutable proof revisions and final approval gate.</p></div><span>{bundle.status.replaceAll("_"," ")}</span></div>
  {error&&<p className={styles.error} role="alert">{error}</p>}{shareLink&&<p className={styles.share}><strong>Secure proof link:</strong> <a href={shareLink} target="_blank" rel="noreferrer">{shareLink}</a></p>}
  <div className={styles.readiness}>{Object.entries(bundle.readiness??{}).map(([key,value])=><div key={key}><strong>{key}</strong><span>{value.replaceAll("_"," ")}</span></div>)}</div>
  <div className={styles.grid}>
   <AssetColumn title="Customer artwork" category="customer_artwork" projectId={projectId} files={bundle.files} onComplete={load}/>
   <AssetColumn title="Digitized production files" category="digitized_production_file" projectId={projectId} files={bundle.files} onComplete={load}/>
   <AssetColumn title="Proof files" category="proof" projectId={projectId} files={bundle.files} onComplete={load}/>
   <AssetColumn title="Sample / sew-out evidence" category="sample_evidence" projectId={projectId} files={bundle.files} onComplete={load}/>
  </div>
  <p className={styles.note}>Quote artwork remains quote artwork and is reused by reference; it is never relabelled as a production file.</p>
  <div className={styles.actions}>
   <ActionSelect label="Artwork readiness" name="artwork" values={["received","needs_cleanup","needs_digitizing","digitizing","production_ready","issue"]} onSubmit={(v)=>action("set_artwork_readiness",{artwork:v})} busy={busy}/>
   <ActionSelect label="Digitising" name="digitizingStatus" values={["not_started","required","in_progress","complete","not_required"]} onSubmit={(v)=>action("set_digitising",{digitizingStatus:v})} busy={busy}/>
   <ActionSelect label="Sample readiness" name="sample" values={["not_required","pending","needs_review","approved","issue"]} onSubmit={(v)=>action("set_sample_readiness",{sample:v})} busy={busy}/>
   <EmbroideryFacts onSubmit={(payload)=>action("set_embroidery_facts",payload)} busy={busy}/>
  </div>
  <ProofIssue proofFiles={proofFiles} busy={busy} onIssue={(payload)=>action("issue_proof",payload)}/>
  <div className={styles.finalActions}>
   <button type="button" onClick={()=>void action("replace_approval_link")} disabled={Boolean(busy)||bundle.currentProofState?.status!=="awaiting_customer"}>REPLACE APPROVAL LINK</button>
   <button type="button" onClick={()=>{const approverName=window.prompt("Customer / approver name");if(approverName)void action("record_owner_approval",{approverName,comment:"Approval recorded by PurePress owner."});}} disabled={Boolean(busy)||bundle.currentProofState?.status!=="awaiting_customer"}>RECORD OWNER APPROVAL</button>
   <button type="button" className={styles.primary} onClick={()=>void action("finalize_for_production")} disabled={Boolean(busy)}>MARK APPROVED FOR PRODUCTION</button>
  </div>
  <div className={styles.history}><h3>Proof revision history</h3>{bundle.proofs.length?bundle.proofs.map((proof)=><article key={proof.id}><strong>R{proof.revision}</strong><span>{proof.state?.status??"issued"}</span><small>{new Date(proof.createdAt).toLocaleString()}</small></article>):<p>No proof revisions issued yet.</p>}</div>
 </section>;
}
function AssetColumn({title,category,projectId,files,onComplete}:{title:string;category:Category;projectId:string;files:FileRow[];onComplete:()=>Promise<void>}){
 const {startUpload,isUploading}=useUploadThing("purePressUpload",{headers:async()=>{const token=await auth.currentUser?.getIdToken();return {"x-purepress-upload-category":category,"x-purepress-job-id":projectId,...(token?{Authorization:`Bearer ${token}`}:{})};},onClientUploadComplete:()=>void onComplete()});
 const rows=files.filter((file)=>file.category===category);
 return <section className={styles.asset}><h3>{title}</h3><label className={styles.upload}>{isUploading?"UPLOADING…":"UPLOAD PRIVATE FILE"}<input type="file" disabled={isUploading} onChange={(event)=>{const file=event.target.files?.[0];if(file)void startUpload([file]);event.currentTarget.value="";}}/></label>{rows.map((file)=><a key={file.id} href={file.viewUrl} target="_blank" rel="noreferrer">{file.fileName}</a>)}{!rows.length&&<small>No files recorded.</small>}</section>;
}
function ActionSelect({label,name,values,onSubmit,busy}:{label:string;name:string;values:string[];onSubmit:(value:string)=>Promise<void>;busy:string}){return <form onSubmit={(event)=>{event.preventDefault();const form=new FormData(event.currentTarget);void onSubmit(String(form.get(name)||""));}}><label>{label}<select name={name}>{values.map((value)=><option key={value} value={value}>{value.replaceAll("_"," ")}</option>)}</select></label><button disabled={Boolean(busy)}>SAVE</button></form>;}
function EmbroideryFacts({onSubmit,busy}:{onSubmit:(p:Record<string,unknown>)=>Promise<void>;busy:string}){return <form onSubmit={(event)=>{event.preventDefault();const f=new FormData(event.currentTarget);void onSubmit({stitchCount:String(f.get("stitchCount")||""),threadColorRefs:String(f.get("threadColorRefs")||"").split(",").map((v)=>v.trim()).filter(Boolean),sampleRequired:f.get("sampleRequired")==="on"});}}><label>Stitch count<input name="stitchCount" inputMode="numeric" placeholder="Only enter when known"/></label><label>Thread colours<input name="threadColorRefs" placeholder="Only enter confirmed colours"/></label><label className={styles.check}><input type="checkbox" name="sampleRequired"/> Sample / sew-out required</label><button disabled={Boolean(busy)}>SAVE FACTS</button></form>;}
function ProofIssue({proofFiles,busy,onIssue}:{proofFiles:FileRow[];busy:string;onIssue:(p:Record<string,unknown>)=>Promise<void>}){const[selected,setSelected]=useState<string[]>([]);const available=useMemo(()=>proofFiles,[proofFiles]);return <form className={styles.proofIssue} onSubmit={(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();const f=new FormData(event.currentTarget);void onIssue({proofFileIds:selected,customerVisibleNotes:String(f.get("notes")||""),placementSummary:String(f.get("placement")||""),designWidthMm:String(f.get("width")||""),designHeightMm:String(f.get("height")||""),threadColorSummary:String(f.get("colors")||"")});}}><h3>Issue immutable proof revision</h3>{available.map((file)=><label className={styles.check} key={file.id}><input type="checkbox" checked={selected.includes(file.id)} onChange={(e)=>setSelected((current)=>e.target.checked?[...current,file.id]:current.filter((id)=>id!==file.id))}/>{file.fileName}</label>)}<div className={styles.proofFields}><input name="placement" placeholder="Placement summary"/><input name="width" inputMode="decimal" placeholder="Width mm"/><input name="height" inputMode="decimal" placeholder="Height mm"/><input name="colors" placeholder="Confirmed thread colour summary"/><textarea name="notes" rows={3} placeholder="Customer-visible proof notes"/></div><button className={styles.primary} disabled={Boolean(busy)||selected.length===0}>ISSUE PROOF + SECURE LINK</button></form>;}
