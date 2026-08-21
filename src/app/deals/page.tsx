"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { collection, getDocs, query, where } from "firebase/firestore";
import { firestore } from "@/utils/firebaseConfig";

const WHATSAPP_NUMBER = "+26778768259";

type Product = {
  id: string;
  name: string;
  category: string;
  brand?: string;
  price: number;
  dealPrice?: number | null;
  isDeal: boolean;
  inStock: boolean;
  imageUrl: string;
  description?: string | null;
};

function waLink(text: string) {
  const phone = WHATSAPP_NUMBER.replace("+", "");
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

export default function DealsPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);

        // ✅ no orderBy → no composite index required
        const q = query(collection(firestore, "products"), where("isDeal", "==", true));
        const snap = await getDocs(q);
        const data = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Product[];

        if (alive) setItems(data);
      } catch (e) {
        console.error("Load deals failed:", e);
        if (alive) setItems([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  return (
    <main className="bg-[--background] text-[--foreground]">
      <section className="container py-10">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Deals</h1>
        <p className="text-sm text-white/70 mt-2">Limited deals — tap to order on WhatsApp.</p>

        <div className="mt-8">
          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-8">Loading…</div>
          ) : items.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
              <p className="text-white/80">No deals posted yet.</p>
              <a
                href={waLink("Hi iHub! Any deals available today?")}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-4 px-4 py-2 rounded-lg bg-[--brand-primary] hover:opacity-90 transition text-sm font-semibold"
              >
                Ask on WhatsApp
              </a>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((p) => {
                const deal = p.dealPrice ?? p.price;
                const msg = [
                  "Hi iHub!",
                  `I want this deal: ${p.name}`,
                  `Deal Price: P${deal}`,
                  `Original: P${p.price}`,
                  "Please confirm availability.",
                ].join("\n");

                return (
                  <div
                    key={p.id}
                    className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden hover:bg-white/10 transition"
                  >
                    <div className="relative aspect-[4/3] bg-black/30">
                      <Image src={p.imageUrl || "/placeholder.png"} alt={p.name} fill className="object-cover" />
                      <div className="absolute top-3 right-3 px-2 py-1 rounded-md text-xs font-semibold bg-[--brand-primary]">
                        Deal
                      </div>
                    </div>

                    <div className="p-4">
                      <div className="font-semibold">{p.name}</div>
                      <div className="mt-2 flex items-baseline gap-2">
                        <div className="text-lg font-bold">P{deal}</div>
                        <div className="text-sm line-through text-white/50">P{p.price}</div>
                      </div>

                      <a
                        href={waLink(msg)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-4 block text-center px-4 py-2 rounded-lg bg-[--brand-primary] hover:opacity-90 transition text-sm font-semibold"
                      >
                        Order on WhatsApp
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
