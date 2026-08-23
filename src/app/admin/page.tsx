import PurePressStudioPrimer from "@/components/purepress/PurePressStudioPrimer";
import PurePressQuoteRequests from "@/components/purepress/PurePressQuoteRequests";

export default function PurePressStudioPage() {
  return (
    <main id="main" className="pp-admin-page">
      <div className="pp-admin-container">
        <PurePressStudioPrimer />
        <PurePressQuoteRequests />
      </div>
    </main>
  );
}
