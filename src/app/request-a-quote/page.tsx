import PurePressQuoteIntake from "@/components/purepress/PurePressQuoteIntake";

export default function RequestQuotePage() {
  return (
    <div className="pp-site">
      <section className="pp-section">
        <div className="pp-container">
          <p className="pp-kicker">Start a PurePress job</p>
          <span className="pp-stitch-line" aria-hidden="true" />
          <h1 className="pp-display pp-display-wide">Tell us what you&apos;re branding.</h1>
          <p className="pp-lede">
            Build your embroidery brief step by step. You can request a quote without creating an account,
            and timing will only be confirmed after PurePress reviews the job.
          </p>
          <PurePressQuoteIntake />
        </div>
      </section>
    </div>
  );
}
