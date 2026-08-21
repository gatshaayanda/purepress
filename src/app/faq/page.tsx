// src/app/faq/page.tsx
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'FAQ – AdminHub',
  description: 'Frequently asked questions about AdminHub services and processes.',
};

export default function FAQPage() {
  return (
    <section className="py-20 bg-white text-[#0B1A33]">
      <div className="container mx-auto max-w-4xl space-y-8">
        <h1 className="text-4xl font-bold text-center">❓ Frequently Asked Questions</h1>

        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold">How do I get started?</h2>
            <p className="text-[#4F5F7A]">
              Just fill out our{' '}
              <a href="/intake" className="underline text-[#0E3A62]">
                intake form
              </a>{' '}
              and we’ll reach out to you.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold">What’s the turnaround time?</h2>
            <p className="text-[#4F5F7A]">
              We deliver full websites within 5–10 working days depending on complexity.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold">Do you offer hosting?</h2>
            <p className="text-[#4F5F7A]">
              Yes. We deploy using Vercel and offer automated maintenance & updates.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
