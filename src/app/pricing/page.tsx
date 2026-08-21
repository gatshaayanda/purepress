import Link from "next/link";
import { ArrowRight } from "lucide-react";

export const metadata = { title: "Membership" };

const plans = [
  { name: "First Review", price: "Free", note: "one time", features: ["One completed weekly review", "What happened + What mattered + Focus next", "Private My BoardSignal access"], style: "" },
  { name: "Founding Member", price: "$7.99", note: "per month", features: ["Up to four reviews per billing month", "My BoardSignal and moving review history", "Choose which positive moments to share", "Founding price while Founding Access terms apply"], style: "lime" },
  { name: "Human-reviewed Plus", price: "$19.99", note: "planned", features: ["Everything in membership", "Human review on selected weekly reviews", "Deeper clarification when the evidence is unusual"], style: "blue" },
];

export default function PricingPage() {
  return (
    <div id="main" className="interior-page">
      <header className="interior-hero"><div className="container"><p className="kicker">Membership</p><h1>Keep understanding your games, week after week.</h1><p className="standfirst">Each review tells you what happened, what mattered, and what to focus on next—then your history starts showing what is changing over time.</p></div></header>
      <section className="container section-pad">
        <div className="content-grid">
          {plans.map((plan) => (
            <article className={`metric-card ${plan.style}`} key={plan.name}>
              <span>{plan.name}</span>
              <strong>{plan.price}</strong>
              <p>{plan.note}</p>
              <ul className="feature-list">{plan.features.map((feature) => <li key={feature}>{feature}</li>)}</ul>
              <div className="interior-actions"><Link href="/join" className={`button ${plan.style === "blue" ? "button-lime" : "button-dark"}`}>Choose this review <ArrowRight size={16} /></Link></div>
            </article>
          ))}
        </div>
        <p className="helper-copy">Seeded Founding Access pricing for product testing. Payment collection is not active in this shell.</p>
      </section>
    </div>
  );
}
