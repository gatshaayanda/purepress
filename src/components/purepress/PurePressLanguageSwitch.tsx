"use client";
import { usePurePressLanguage } from "./PurePressLanguageProvider";
import styles from "./PurePressLanguageSwitch.module.css";
export default function PurePressLanguageSwitch(){
  const {locale,setLocale}=usePurePressLanguage();
  return <div className={styles.dock} role="group" aria-label="Language">
    <button type="button" className={locale==="en-BW"?styles.active:styles.button} aria-pressed={locale==="en-BW"} onClick={()=>setLocale("en-BW")}>English</button>
    <button type="button" className={locale==="tn-BW"?styles.active:styles.button} aria-pressed={locale==="tn-BW"} onClick={()=>setLocale("tn-BW")}>Setswana</button>
  </div>;
}
