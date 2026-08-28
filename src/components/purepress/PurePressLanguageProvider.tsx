"use client";
import { usePathname } from "next/navigation";
import { createContext,useCallback,useContext,useLayoutEffect,useMemo,useState,type ReactNode } from "react";
import { PUREPRESS_DEFAULT_LOCALE,isPurePressLocaleSurface,localizePurePressFixedText,normalizePurePressLocale,purePressLocaleFromUrl,readPurePressLocalePreference,resolvePurePressLocale,translatePurePress,writePurePressLocalePreference,type PurePressLocale,type PurePressTemplateValues,type PurePressTranslationKey } from "@/lib/purepress/i18n";
import PurePressLanguageSwitch from "./PurePressLanguageSwitch";
interface Value{locale:PurePressLocale;setLocale:(locale:PurePressLocale)=>void;t:(key:PurePressTranslationKey,values?:PurePressTemplateValues)=>string}
const Ctx=createContext<Value|null>(null);
const originalText=new WeakMap<Text,string>();
const originalAttrs=new WeakMap<Element,Map<string,string>>();
const ATTRS=["aria-label","title","placeholder"] as const;
function initial(){if(typeof document==="undefined")return PUREPRESS_DEFAULT_LOCALE;return normalizePurePressLocale(document.documentElement.dataset.ppLocale)??PUREPRESS_DEFAULT_LOCALE}
function skip(el:Element|null){return Boolean(el?.closest("script,style,noscript,code,pre,[data-pp-no-translate]"))}
function localizeText(node:Text,locale:PurePressLocale){
  if(skip(node.parentElement))return;
  const current=node.nodeValue??"";
  if(locale==="en-BW"){const source=originalText.get(node);if(source!==undefined&&current!==source)node.nodeValue=source;return}
  let source=originalText.get(node);
  if(source===undefined){source=current;originalText.set(node,source)}
  else{const translated=localizePurePressFixedText("tn-BW",source);if(current!==source&&current!==translated){source=current;originalText.set(node,source)}}
  const lead=source.match(/^\s*/)?.[0]??"",trail=source.match(/\s*$/)?.[0]??"",core=source.trim();
  if(!core)return;
  const translated=localizePurePressFixedText("tn-BW",core);
  const next=translated===core?source:`${lead}${translated}${trail}`;
  if(node.nodeValue!==next)node.nodeValue=next;
}
function localizeElement(el:Element,locale:PurePressLocale){
  if(skip(el))return;
  let map=originalAttrs.get(el);if(!map){map=new Map();originalAttrs.set(el,map)}
  for(const attr of ATTRS){
    const current=el.getAttribute(attr);if(!current)continue;
    if(!map.has(attr))map.set(attr,current);
    const source=map.get(attr)??current;
    const next=locale==="tn-BW"?localizePurePressFixedText("tn-BW",source):source;
    if(current!==next)el.setAttribute(attr,next);
  }
}
function localizeTree(root:Node,locale:PurePressLocale){
  if(root.nodeType===Node.TEXT_NODE){localizeText(root as Text,locale);return}
  if(root.nodeType!==Node.ELEMENT_NODE&&root.nodeType!==Node.DOCUMENT_FRAGMENT_NODE)return;
  if(root.nodeType===Node.ELEMENT_NODE)localizeElement(root as Element,locale);
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT);
  let n=walker.nextNode();while(n){if(n.nodeType===Node.TEXT_NODE)localizeText(n as Text,locale);else localizeElement(n as Element,locale);n=walker.nextNode()}
}
export default function PurePressLanguageProvider({children}:{children:ReactNode}){
  const pathname=usePathname(),enabled=isPurePressLocaleSurface(pathname),[locale,setLocaleState]=useState<PurePressLocale>(initial);
  const setLocale=useCallback((next:PurePressLocale)=>{setLocaleState(next);writePurePressLocalePreference(next)},[]);
  useLayoutEffect(()=>{if(!enabled){document.documentElement.dataset.ppLocaleReady="true";return}
    const stored=readPurePressLocalePreference(),url=purePressLocaleFromUrl(window.location.search);
    setLocaleState(resolvePurePressLocale({stored,url,browser:window.navigator.languages}));
  },[enabled,pathname]);
  useLayoutEffect(()=>{if(!enabled)return;document.documentElement.lang=locale;document.documentElement.dataset.ppLocale=locale;
    localizeTree(document.body,locale);document.documentElement.dataset.ppLocaleReady="true";
    const observer=new MutationObserver(ms=>{for(const m of ms){if(m.type==="characterData")localizeTree(m.target,locale);if(m.type==="attributes"&&m.target instanceof Element)localizeElement(m.target,locale);for(const n of m.addedNodes)localizeTree(n,locale)}});
    observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:[...ATTRS]});return()=>observer.disconnect();
  },[enabled,locale]);
  const value=useMemo<Value>(()=>({locale,setLocale,t:(key,values)=>translatePurePress(locale,key,values)}),[locale,setLocale]);
  return <Ctx.Provider value={value}>{children}{enabled?<PurePressLanguageSwitch/>:null}</Ctx.Provider>;
}
export function usePurePressLanguage(){const value=useContext(Ctx);if(!value)throw new Error("usePurePressLanguage must be used inside PurePressLanguageProvider");return value}
