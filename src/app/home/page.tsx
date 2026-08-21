'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Code, RefreshCcw, ArrowRightCircle } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const keys = useRef<string[]>([]);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [greeting, setGreeting] = useState('');
  const [emoji, setEmoji] = useState('');

  useEffect(() => {
    const hour = new Date().getHours();
    setGreeting(hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening');
    setEmoji(hour < 12 ? '🌞' : hour < 18 ? '☀️' : '🌙');

    const onKey = (e: KeyboardEvent) => {
      keys.current.push(e.key.toLowerCase());
      if (keys.current.length > 5) keys.current.shift();
      if (keys.current.join('') === 'admin') router.push('/login-secret-login-for-admins97F4B2NXQ');
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router]);

  const longPress = {
    onTouchStart: () => setTouchStart(Date.now()),
    onTouchEnd: () => {
      if (touchStart && Date.now() - touchStart > 600) router.push('/login-secret-login-for-admins97F4B2NXQ');
      setTouchStart(null);
    },
  };

  const services = [
    {
      icon: <Code size={36} className="text-[#C9A43E]" />,
      title: 'Custom Build Framework',
      body: 'We use a custom-built template base + AI guided by 10 years of coding experience.',
    },
    {
      icon: <RefreshCcw size={36} className="text-[#C9A43E]" />,
      title: 'Human Support Plans',
      body: 'Revisions, updates, maintenance, admin — handled monthly by real developers.',
    },
    {
      icon: <ArrowRightCircle size={36} className="text-[#C9A43E]" />,
      title: 'Live Demo Experience',
      body: (
        <div className="space-y-1">
          <p>Test our site-building speed and performance live in your browser.</p>
          <Link
            href="https://adminhub-base-template.vercel.app/"
            target="_blank"
            className="underline text-[#C9A43E]"
          >
            Try Live Demo →
          </Link>
        </div>
      ),
    },
  ];

  return (
    <>
      <section
        {...longPress}
        className="flex flex-col items-center justify-center text-center px-6 pt-28 pb-20 bg-gradient-to-br from-[#C9A43E] to-[#b3d0ff] text-white"
      >
        <h1 className="text-4xl sm:text-5xl font-bold leading-tight max-w-3xl mb-4 drop-shadow-lg">
          {greeting} {emoji}, welcome to AdminHub!
        </h1>
        <p className="mt-2 max-w-xl text-lg text-white/80 mb-6">
          Powerful websites. Built fast. Secured, supported, and scalable.
        </p>
        <Link
          href="#services"
          className="inline-flex items-center gap-2 bg-white text-[#0F264B] rounded-full px-7 py-3 font-semibold hover:brightness-105 transition"
        >
          🚀 Explore What We Offer
        </Link>
      </section>

      <section id="services" className="py-20 bg-[#FFFDF6]">
        <div className="container mx-auto px-6 grid gap-12 text-center md:grid-cols-3">
          {services.map(({ icon, title, body }) => (
            <div key={title} className="p-6 rounded-2xl shadow-md border bg-white hover:shadow-lg transition">
              <div className="flex justify-center mb-4">{icon}</div>
              <h3 className="text-xl font-semibold mb-2 text-[#0F264B]">{title}</h3>
              <div className="text-sm text-[#4F5F7A]">{body}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="py-20 bg-[#F1F1F1] text-center px-6">
        <div className="container mx-auto max-w-3xl space-y-6">
          <h2 className="text-2xl font-bold text-[#0F264B]">📍 About AdminHub</h2>
          <p className="text-[#4F5F7A]">
            We build powerful, scalable web platforms using our own optimized Next.js + Firebase base,
            enhanced with AI and delivered with a decade of dev experience — and a human support plan to match.
          </p>
        </div>
      </section>

      <section className="py-16 bg-[#F9FAFB] text-center">
        <div className="container mx-auto max-w-xl px-6 space-y-4">
          <h2 className="text-xl font-bold text-[#0F264B]">Already a Client?</h2>
          <p className="text-[#4F5F7A]">Log in to view your unique project status, updates, and progress.</p>
          <Link
            href="/client/login"
            className="inline-block bg-[#0F264B] text-white px-6 py-3 rounded-full font-semibold hover:brightness-110"
          >
            🔐 Client Login
          </Link>
        </div>
      </section>

{/* ♻️ Sustainability Badge */}
<section className="py-12 bg-white border-t border-gray-100 text-center px-6">
  <div className="container mx-auto max-w-2xl space-y-4">
    <h2 className="text-xl font-bold text-[#0F264B]">♻️ Greener Web, Smarter Tech</h2>
    <p className="text-[#4F5F7A] text-sm">
      AdminHub is built to perform — and preserve. According to the{' '}
      <a
        href="https://www.websitecarbon.com/website/adhubmvp-vercel-app/"
        target="_blank"
        rel="noopener noreferrer"
        className="underline text-blue-600 font-medium"
      >
        Website Carbon Calculator
      </a>
      , we produce just <strong>0.06g of CO₂</strong> per page view and rank cleaner than 89% of the web.
    </p>
    <p className="text-[#4F5F7A] text-sm">
      Hosted on <strong>100% renewable energy</strong> via Vercel.
    </p>
  </div>
</section>


      <section id="contact" className="py-20 bg-white text-center">
        <div className="container mx-auto max-w-xl px-6">
          <h2 className="text-2xl font-bold text-[#0F264B] mb-4">📞 Ready to Start?</h2>
          <p className="text-[#4F5F7A] mb-8">
            We're currently working on select pilot clients at this stage. Want to see what we can build for you?
          </p>
          <Link
            href="mailto:noreplyadhubmvp@gmail.com"
            className="bg-[#fae9b9] text-[#0F264B] rounded-full px-7 py-3 font-semibold hover:brightness-110"
          >
            📧 Contact Us
          </Link>
        </div>
      </section>
    </>
  );
}
