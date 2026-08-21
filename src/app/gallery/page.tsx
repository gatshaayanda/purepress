'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { firestore } from '@/utils/firebaseConfig';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';

type Highlight = {
  id: string;
  title: string;
  desc: string;
  imageUrl: string;
  order: number;
};

export default function HighlightsPage() {
  const [items, setItems] = useState<Highlight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const q = query(collection(firestore, 'highlights'), orderBy('order', 'asc'));
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map((doc) => ({
          ...(doc.data() as Highlight),
          id: doc.id,
        }));
        setItems(data);
      } catch (err) {
        console.error('Error loading highlights:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <main className="bg-[--background] text-[--foreground] px-6 py-24 relative overflow-hidden">
      {/* Header */}
      <div className="max-w-4xl mx-auto text-center mb-20 animate-fadeIn">
        <h1 className="text-4xl md:text-5xl font-serif font-bold text-[--brand-secondary] tracking-[0.25em] uppercase mb-6">
          Things To Do
        </h1>
        <p className="text-base md:text-lg text-[--brand-accent] leading-relaxed max-w-3xl mx-auto">
          Your stay at Scents & Suites is more than rest — it’s discovery.  
          From morning walks through tranquil gardens to art, dining, and city life nearby,  
          every day invites a new way to indulge or unwind.
        </p>
      </div>

      {/* Highlights Grid */}
      {loading ? (
        <div className="grid md:grid-cols-3 gap-10 max-w-6xl mx-auto">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-gray-300/40 h-80 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid md:grid-cols-3 gap-10 max-w-6xl mx-auto">
          {items.length > 0 ? (
            items.map((item, index) => (
              <div
                key={item.id}
                className={`group bg-white/95 rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-transform duration-300 hover:-translate-y-1 animate-fadeIn-slow`}
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="relative">
                  <Image
                    src={item.imageUrl || '/placeholder.png'}
                    alt={item.title}
                    width={500}
                    height={320}
                    className="w-full h-56 object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent opacity-0 group-hover:opacity-100 transition" />
                </div>

                <div className="p-5 text-left">
                  <h2 className="text-xl font-semibold text-[--brand-primary] mb-2 tracking-wide">
                    {item.title}
                  </h2>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-3 text-center text-gray-500 italic py-10">
              No highlights available yet. Please check back soon.
            </div>
          )}
        </div>
      )}

      {/* Ambient Gradient Glow */}
      <div className="absolute inset-x-0 bottom-0 h-[35vh] bg-gradient-to-t from-[--brand-primary]/60 to-transparent pointer-events-none" />

      {/* Animation & Glow Styling */}
      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 1s ease-out forwards;
        }
        .animate-fadeIn-slow {
          animation: fadeIn 1.2s ease-out forwards;
        }
      `}</style>
    </main>
  );
}
