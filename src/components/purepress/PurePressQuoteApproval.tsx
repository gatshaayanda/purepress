"use client";

import { type FormEvent, useCallback, useEffect, useState } from "react";
import styles from "./PurePressQuoteApproval.module.css";

interface QuoteLine { id:string; category:string; description:string; quantity:number; unitPriceMinor:number; lineTotalMinor:number; }
interface PublicQuote {
  quoteNumber:string; revision:number; currency:"BWP"; state:"issued"|"changes_requested"|"accepted"|"superseded"|"expired";
  customer:{displayName:string;organisation?:string;email?:string;phone?:string};
  job:{referenceCode:string;itemSummary:string;quantity?:number;supplySource:string;customerRequestedDate?:string;customerTimingFlexible?:boolean};
  lineItems:QuoteLine[]; subtotalMinor:number; discountMinor:number; tax?:{label:string;ratePercent:string;amountMinor:number}; totalMinor:number;
  issueDate?:string; validUntil?:string; customerVisibleNotes?:string; paymentTerms?:string; fulfillmentNotes?:string;
  estimatedTurnaroundText?:string; estimatedCompletionDate?:string;
  decision?:{type:"accepted"|"changes_requested";source:"secure_link"|"owner_recorded";decidedAt:string;acceptingName?:string;comment?:string};
  canAccept:boolean; canRequestChanges:boolean;
}

function money(minor:number){return `P ${Math.floor(minor/100).toLocaleString("en-BW")}.${String(minor%100).padStart(2,"0")}`;}

export default function PurePressQuoteApproval({ token }: { token:string }) {
  const [quote,setQuote]=useState<PublicQuote|null>(null); const [loading,setLoading]=useState(true); const [error,setError]=useState("");
  const [confirming,setConfirming]=useState(false); const [busy,setBusy]=useState(""); const [acceptingName,setAcceptingName]=useState("");
  const [changeComment,setChangeComment]=useState("");
  const load=useCallback(async()=>{setLoading(true);setError("");try{const response=await fetch(`/api/purepress/quote/${encodeURIComponent(token)}`,{cache:"no-store"});const data=await response.json();if(!response.ok)throw new Error(data.error||"This quotation could not be opened.");setQuote(data.quote);}catch(reason){setError(reason instanceof Error?reason.message:"This quotation could not be opened.");}finally{setLoading(false);}},[token]);
  useEffect(()=>{void load();},[load]);

  async function decide(decision:"accept"|"request_changes", comment=""){
    setBusy(decision);setError("");try{const response=await fetch(`/api/purepress/quote/${encodeURIComponent(token)}/decision`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({decision,acceptingName,comment}),cache:"no-store"});const data=await response.json();if(!response.ok)throw new Error(data.error||"PurePress could not record your response.");setQuote(data.quote);setConfirming(false);setChangeComment("");}catch(reason){setError(reason instanceof Error?reason.message:"PurePress could not record your response.");}finally{setBusy("");}}

  async function requestChanges(event:FormEvent<HTMLFormElement>){event.preventDefault();await decide("request_changes",changeComment);}

  if(loading)return <main className={styles.page}><p className={styles.state} role="status">Opening your PurePress quotation…</p></main>;
  if(error&&!quote)return <main className={styles.page}><div className={styles.shell}><Brand/><p className={styles.error} role="alert">{error}</p><p>Contact PurePress if you need a current quotation link.</p></div></main>;
  if(!quote)return null;
  return <main className={styles.page}><div className={styles.shell}><Brand/>{error&&<p className={styles.error} role="alert">{error}</p>}
    <header className={styles.hero}><div><span>QUOTATION</span><h1>{quote.quoteNumber}</h1><p>Revision {quote.revision} · Job {quote.job.referenceCode}</p></div><div className={styles.total}><small>TOTAL BWP</small><strong>{money(quote.totalMinor)}</strong><span>{stateCopy(quote)}</span></div></header>
    <section className={styles.customer}><div><small>PREPARED FOR</small><strong>{quote.customer.displayName}</strong>{quote.customer.organisation&&<span>{quote.customer.organisation}</span>}</div><div><small>WORK QUOTED</small><strong>{quote.job.itemSummary}</strong>{quote.job.quantity&&<span>{quote.job.quantity} item(s)</span>}</div><div><small>VALID UNTIL</small><strong>{quote.validUntil||"Not stated"}</strong></div></section>
    <section className={styles.lines} aria-label="Quotation line items"><div className={styles.lineHead}><span>Description</span><span>Qty</span><span>Unit</span><span>Total</span></div>{quote.lineItems.map(line=><div className={styles.line} key={line.id}><span><strong>{line.description}</strong><small>{line.category.replaceAll("_"," ")}</small></span><span>{line.quantity}</span><span>{money(line.unitPriceMinor)}</span><span>{money(line.lineTotalMinor)}</span></div>)}</section>
    <section className={styles.totals}><span>Subtotal<strong>{money(quote.subtotalMinor)}</strong></span>{quote.discountMinor>0&&<span>Discount<strong>{money(quote.discountMinor)}</strong></span>}{quote.tax&&<span>{quote.tax.label} ({quote.tax.ratePercent}%)<strong>{money(quote.tax.amountMinor)}</strong></span>}<span className={styles.grand}>TOTAL BWP<strong>{money(quote.totalMinor)}</strong></span></section>
    <div className={styles.detailGrid}>{quote.job.customerRequestedDate&&<Info title="Customer requested date" text={quote.job.customerRequestedDate}/>} {quote.job.customerTimingFlexible&&!quote.job.customerRequestedDate&&<Info title="Customer requested timing" text="Flexible"/>}{quote.estimatedCompletionDate&&<Info title="Estimated completion" text={quote.estimatedCompletionDate}/>} {quote.estimatedTurnaroundText&&<Info title="Estimated turnaround" text={quote.estimatedTurnaroundText}/>} {quote.paymentTerms&&<Info title="Payment terms" text={quote.paymentTerms}/>} {quote.fulfillmentNotes&&<Info title="Collection / delivery" text={quote.fulfillmentNotes}/>} {quote.customerVisibleNotes&&<Info title="Quote notes" text={quote.customerVisibleNotes}/>}</div>
    <div className={styles.pdfRow}><a href={`/api/purepress/quote/${encodeURIComponent(token)}/pdf`} target="_blank" rel="noreferrer">VIEW / DOWNLOAD EXACT QUOTE PDF</a></div>
    {quote.state==="accepted"&&<section className={styles.success}><span>QUOTE ACCEPTED</span><h2>Thank you.</h2><p>PurePress will now prepare the artwork/proof stage. This does not mean production has started.</p></section>}
    {quote.state==="changes_requested"&&<section className={styles.notice}><h2>Changes requested</h2><p>PurePress has your request and can prepare a new quotation revision. The issued price above has not been silently changed.</p>{quote.decision?.comment&&<blockquote>{quote.decision.comment}</blockquote>}</section>}
    {quote.state==="expired"&&<section className={styles.notice}><h2>This quotation has expired.</h2><p>You can still review it, but it cannot be newly accepted. Contact PurePress for a current revision.</p></section>}
    {quote.state==="superseded"&&<section className={styles.notice}><h2>This revision has been superseded.</h2><p>A newer PurePress quotation revision exists. This older revision can no longer be accepted.</p></section>}
    {quote.canAccept&&<section className={styles.decision}><h2>Your decision</h2><label>Customer / approver name (optional)<input value={acceptingName} onChange={e=>setAcceptingName(e.target.value)} maxLength={120}/></label>{!confirming?<button type="button" className={styles.primary} onClick={()=>setConfirming(true)}>ACCEPT QUOTE</button>:<div className={styles.confirm}><strong>Confirm acceptance</strong><p>You are accepting {quote.quoteNumber}, Revision {quote.revision}, for {money(quote.totalMinor)}.</p><div><button type="button" className={styles.primary} onClick={()=>void decide("accept")} disabled={Boolean(busy)}>{busy==="accept"?"ACCEPTING…":"CONFIRM ACCEPT QUOTE"}</button><button type="button" onClick={()=>setConfirming(false)} disabled={Boolean(busy)}>GO BACK</button></div></div>}
      <form onSubmit={requestChanges} className={styles.changeForm}><label>Need something changed?<textarea required minLength={3} maxLength={1200} value={changeComment} onChange={e=>setChangeComment(e.target.value)} placeholder="Tell PurePress what should change in this quotation."/></label><button type="submit" disabled={Boolean(busy)}>{busy==="request_changes"?"SENDING…":"REQUEST CHANGES"}</button></form></section>}
    <footer className={styles.footer}><strong>PurePress Printers</strong><span>Plot 17879, Gaborone West · Gaborone, Botswana</span><span>purepressprinters@gmail.com · +267 78 013 297 · +267 77 116 195</span></footer>
  </div></main>;
}
function Brand(){return <div className={styles.brand}><div><i/><i/><i/></div><strong>PUREPRESS PRINTERS</strong><span>Your Vision, Fully Printed</span></div>}
function Info({title,text}:{title:string;text:string}){return <section><small>{title.toUpperCase()}</small><p>{text}</p></section>}
function stateCopy(quote:PublicQuote){if(quote.state==="accepted")return"Accepted";if(quote.state==="changes_requested")return"Changes requested";if(quote.state==="expired")return"Expired";if(quote.state==="superseded")return"Superseded";return"Awaiting your decision";}
