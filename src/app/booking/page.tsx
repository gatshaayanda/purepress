'use client';

import { useState } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { firestore } from '@/utils/firebaseConfig';
import { Loader2, Send } from 'lucide-react';

export default function BookingPage() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    room: '',
    dates: '',
  });
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');

    try {
      await addDoc(collection(firestore, 'contact_messages'), {
        admin_id: 'admin',
        name: form.name,
        email: form.email,
        phone: '',
        company: '',
        message: `Room: ${form.room}\nDates: ${form.dates}`,
        interest: 'Suite Booking',
        status: 'new',
        source: 'scents-booking',
        createdAt: serverTimestamp(),
      });
      setForm({ name: '', email: '', room: '', dates: '' });
      setStatus('sent');
    } catch {
      setStatus('error');
    }
  };

  return (
    <main className="bg-[--background] text-[--foreground] px-6 py-24 flex flex-col items-center relative overflow-hidden">
      {/* Header */}
      <div className="text-center max-w-2xl mb-12 animate-fadeIn">
        <h1 className="text-4xl md:text-5xl font-serif font-bold text-[--brand-secondary] tracking-[0.25em] uppercase mb-6">
          Reserve Your Stay
        </h1>
        <p className="text-base md:text-lg text-[--brand-accent] leading-relaxed">
          Tell us your preferred suite and dates — our concierge will confirm availability shortly.
        </p>
      </div>

      {/* Booking Form */}
      <form
        className="w-full max-w-md bg-white/90 rounded-2xl p-8 shadow-md border border-[--brand-secondary]/20 animate-fadeIn-slow"
        onSubmit={handleSubmit}
      >
        <Field
          label="Full Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
        <Field
          label="Email Address"
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          required
        />
        <Select
          label="Suite Type"
          value={form.room}
          onChange={(e) => setForm({ ...form, room: e.target.value })}
        />
        <Field
          label="Preferred Dates (e.g. Nov 22–25)"
          value={form.dates}
          onChange={(e) => setForm({ ...form, dates: e.target.value })}
          required
        />

        <button
          type="submit"
          disabled={status === 'sending'}
          className="w-full mt-4 px-6 py-3 rounded-full font-semibold text-[--brand-primary] bg-[--brand-secondary] hover:brightness-110 transition inline-flex items-center justify-center gap-2 shadow-glow-gold"
        >
          {status === 'sending' ? (
            <Loader2 className="animate-spin" size={16} />
          ) : (
            <Send size={16} />
          )}
          {status === 'sending' ? 'Sending…' : 'Confirm Booking'}
        </button>

        {status === 'sent' && (
          <p className="text-green-600 text-sm text-center mt-3">
            ✅ Booking sent! We’ll confirm your reservation shortly.
          </p>
        )}
        {status === 'error' && (
          <p className="text-red-600 text-sm text-center mt-3">
            ❌ Something went wrong. Please try again or contact us via WhatsApp.
          </p>
        )}
      </form>

      {/* Ambient Gold Glow */}
      <div className="absolute inset-x-0 bottom-0 h-[35vh] bg-gradient-to-t from-[--brand-primary]/60 to-transparent pointer-events-none" />

      {/* Animations & Glow */}
      <style jsx global>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 1s ease-out forwards;
        }
        .animate-fadeIn-slow {
          animation: fadeIn 1.3s ease-out forwards;
        }
        .shadow-glow-gold {
          box-shadow: 0 0 14px rgba(214, 182, 120, 0.45);
        }
        .shadow-glow-gold:hover {
          box-shadow: 0 0 22px rgba(214, 182, 120, 0.65);
        }
      `}</style>
    </main>
  );
}

/* ---------- Reusable Field Components ---------- */
function Field({
  label,
  type = 'text',
  value,
  onChange,
  required,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
}) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-black mb-1">
        {label}
        {required && ' *'}
      </label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        required={required}
        placeholder={label}
        className="w-full px-4 py-2 border rounded text-sm bg-white text-black focus:ring-2 focus:ring-[--brand-secondary]/40 focus:outline-none"
      />
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-black mb-1">
        {label}
      </label>
      <select
        value={value}
        onChange={onChange}
        required
        className="w-full px-4 py-2 border rounded text-sm bg-white text-black focus:ring-2 focus:ring-[--brand-secondary]/40 focus:outline-none"
      >
        <option value="">Select a Suite</option>
        <option value="Premium Suite (32 sqm)">Premium Suite (32 sqm)</option>
        <option value="Deluxe Suite (27 sqm)">Deluxe Suite (27 sqm)</option>
        <option value="Classic Suite (15 sqm)">Classic Suite (15 sqm)</option>
      </select>
    </div>
  );
}
