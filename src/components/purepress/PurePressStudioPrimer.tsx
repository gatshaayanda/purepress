const lanes = [
  {
    title: "ATTENTION",
    empty: "No jobs need a decision or follow-up right now.",
  },
  {
    title: "WAITING ON CUSTOMER",
    empty: "No customer responses are connected here yet.",
  },
  {
    title: "IN PRODUCTION",
    empty: "No active production jobs are connected here yet.",
  },
  {
    title: "READY / DUE NEXT",
    empty: "No ready or next-due jobs are connected here yet.",
  },
] as const;

export default function PurePressStudioPrimer() {
  return (
    <section className="pp-studio-desk" aria-labelledby="pp-studio-heading">
      <p className="pp-kicker">PUREPRESS STUDIO</p>
      <p className="pp-studio-subkicker">PRODUCTION DESK</p>
      <span className="pp-stitch-line" aria-hidden="true" />
      <h1 id="pp-studio-heading" className="pp-studio-title">
        What needs attention next.
      </h1>
      <p className="pp-studio-intro">
        Your production desk keeps the work that needs a decision, customer
        response or production action in one place.
      </p>
      <p className="pp-studio-empty">
        No active production jobs are connected to the Studio yet.
      </p>

      <div className="pp-attention-lanes">
        {lanes.map((lane) => (
          <article className="pp-attention-lane" key={lane.title}>
            <strong>{lane.title}</strong>
            <span className="pp-lane-state">NOT CONNECTED YET</span>
            <p>{lane.empty}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
