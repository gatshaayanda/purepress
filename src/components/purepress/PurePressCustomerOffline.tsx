"use client";

import Image from "next/image";
import { onAuthStateChanged, type User } from "firebase/auth";
import { useEffect, useState } from "react";
import { auth } from "@/utils/firebaseConfig";
import type { PurePressCustomerOrderProjection } from "@/lib/purepress/customerProjection";
import { isPurePressCustomerTrustedDevice, loadPurePressCustomerOrders } from "@/lib/purepress/offline/customer";
import styles from "./PurePressCustomerPortal.module.css";
import { usePurePressLanguage } from "./PurePressLanguageProvider";
import { formatPurePressDateTime } from "@/lib/purepress/i18n";

export default function PurePressCustomerOffline() {
  const { locale, t } = usePurePressLanguage();
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [orders, setOrders] = useState<PurePressCustomerOrderProjection[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => onAuthStateChanged(auth, async (next) => {
    setUser(next);
    if (!next) { setReady(true); return; }
    const trusted = await isPurePressCustomerTrustedDevice(next.uid).catch(() => false);
    const cached = trusted ? await loadPurePressCustomerOrders(next.uid).catch(() => []) : [];
    setOrders(cached.map((record) => record.value));
    setReady(true);
  }), []);
  if (!ready || user === undefined) return <main className={styles.portalPage}><div className={styles.loadingCard}>OPENING SAVED MY PUREPRESS…</div></main>;
  return <main className={styles.portalPage}><div className={styles.portalShell}><header className={styles.portalHeader}><div className={styles.headerIdentity}><Image src="/purepress/brand/purepress-mark.svg" alt="PurePress Printers" width={62} height={52} /><div><span>MY PUREPRESS</span></div></div></header><div className={styles.savedBanner}><strong>SAVED COPY</strong><span>You’re offline. This is the last update saved on this device.</span></div>{!user ? <section className={styles.emptyState}><h1>CONNECT TO THE INTERNET TO SIGN IN.</h1><p>My PurePress needs your secure Firebase sign-in before it can open private saved orders.</p></section> : orders.length === 0 ? <section className={styles.emptyState}><h1>NO SAVED ORDERS ON THIS DEVICE.</h1><p>When you’re online, turn on “KEEP MY ORDERS ON THIS DEVICE” in My PurePress.</p></section> : <section className={styles.orderList}><h1>YOUR SAVED ORDERS</h1>{orders.map((order) => <article className={styles.orderCard} key={order.projectId}><p className={styles.orderReference}>ORDER {order.referenceCode}</p><h2 data-pp-no-translate>{order.title}</h2><div className={styles.answerBlock}><span>CURRENT STATUS</span><strong>{t(order.status.headlineKey)}</strong></div><div className={styles.nextBlock}><span>NEXT</span><p>{t(order.status.nextKey)}</p></div><p className={styles.nothingNeeded}>{order.status.action === "NONE" ? "NOTHING NEEDED FROM YOU RIGHT NOW." : "CONNECT TO THE INTERNET TO COMPLETE THIS ORDER ACTION."}</p><p className={styles.lastUpdated}>LAST UPDATED {formatPurePressDateTime(locale, order.updatedAt)}</p></article>)}</section>}</div></main>;
}
