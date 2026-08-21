'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { firestore } from '@/utils/firebaseConfig';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';

type Suite = {
  id: string;
  name: string;
  size: string;
  imageUrl: string;
  desc: string;
  highlights: string[];
  price: string;
  order: number;
};

export default function OurSuitesPage() {
  const [suites, setSuites] = useState<Suite[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFloorPlan, setShowFloorPlan] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const q = query(collection(firestore, 'suites'), orderBy('order', 'asc'));
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map((doc) => ({
          ...(doc.data() as Suite),
          id: doc.id,
        }));
        setSuites(data);
      } catch (err) {
        console.error('Error loading suites:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <main className="bg-[--background] text-[--foreground] px-6 py-24 relative overflow-hidden">
      {/* Hero Section */}
      <div className="max-w-5xl mx-auto text-center mb-20">
        <h1 className="text-4xl md:text-5xl font-serif font-bold text-[--brand-secondary] tracking-[0.25em] uppercase mb-6 animate-fadeIn">
          Our Suites
        </h1>
        <p className="text-base md:text-lg text-[--brand-accent] leading-relaxed max-w-3xl mx-auto">
          Discover a curated selection of elegant suites designed to reflect
          comfort, beauty, and quiet luxury. Each room features calming tones,
          premium bedding, and timeless details that invite you to unwind.
        </p>
        <button
          onClick={() => setShowFloorPlan(true)}
          className="mt-8 inline-flex items-center gap-2 px-6 py-2.5 rounded-full font-semibold text-sm bg-[--brand-secondary] text-[--brand-primary] hover:brightness-110 transition shadow-glow-gold"
        >
          View Floor Plan
        </button>
      </div>

      {/* Suites Grid */}
      {loading ? (
        <div className="grid md:grid-cols-3 gap-12 max-w-6xl mx-auto">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="bg-gray-300/40 rounded-2xl h-[26rem] animate-pulse"
            />
          ))}
        </div>
      ) : (
        <div className="grid md:grid-cols-3 gap-12 max-w-6xl mx-auto">
          {suites.length > 0 ? (
            suites.map((suite) => (
              <div
                key={suite.id}
                className="group bg-white/95 rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-transform duration-300 hover:-translate-y-1 relative"
              >
                <div className="relative">
                  <Image
                    src={suite.imageUrl || '/placeholder.png'}
                    alt={suite.name}
                    width={500}
                    height={350}
                    className="w-full h-64 object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#000]/40 via-transparent opacity-0 group-hover:opacity-100 transition" />
                </div>

                <div className="p-5 flex flex-col flex-grow text-left">
                  <h2 className="text-xl font-semibold text-[--brand-primary] mb-1">
                    {suite.name}
                  </h2>
                  <p className="text-sm text-gray-500 mb-2 italic">{suite.size}</p>
                  <p className="text-sm text-gray-700 mb-4 leading-relaxed flex-grow">
                    {suite.desc}
                  </p>

                  <ul className="text-xs text-gray-600 mb-4 space-y-1">
                    {suite.highlights?.length > 0 ? (
                      suite.highlights.map((item, i) => (
                        <li
                          key={i}
                          className="before:content-['•'] before:mr-2 before:text-[--brand-secondary]"
                        >
                          {item}
                        </li>
                      ))
                    ) : (
                      <li className="text-gray-400 italic">
                        Highlights coming soon.
                      </li>
                    )}
                  </ul>

                  {suite.price && (
                    <p className="text-sm font-medium text-[--brand-secondary] mb-3 tracking-wide">
                      {suite.price}
                    </p>
                  )}

                  <Link
                    href="/booking"
                    className="mt-auto text-[--brand-secondary] font-medium hover:underline"
                  >
                    Reserve this Suite →
                  </Link>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-3 text-center text-gray-500 italic py-10">
              No suites available yet. Please check back soon.
            </div>
          )}
        </div>
      )}

      {/* Floor Plan Modal */}
      {showFloorPlan && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn"
          onClick={() => setShowFloorPlan(false)}
        >
          <div
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex justify-between items-center p-4 border-b bg-[--brand-primary] text-white">
              <h2 className="text-lg font-semibold">Reflected Ceiling Plan</h2>
              <button
                onClick={() => setShowFloorPlan(false)}
                className="text-white text-xl hover:opacity-80"
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            {/* PDF Viewer */}
            <iframe
              src="/SCENTS & SUITES REFLECTED CEILING PLAN.pdf"
              className="w-full h-[75vh]"
              title="Scents & Suites Floor Plan"
            />
          </div>
        </div>
      )}

      {/* Page motion & glow styles */}
      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 1s ease-out forwards;
        }

        .shadow-glow-gold {
          box-shadow: 0 0 12px rgba(214, 182, 120, 0.4);
        }
        .shadow-glow-gold:hover {
          box-shadow: 0 0 20px rgba(214, 182, 120, 0.6);
        }
      `}</style>
    </main>
  );
}
