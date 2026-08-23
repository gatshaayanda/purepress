import PurePressStudioDesk from "@/components/purepress/PurePressStudioDesk";
import PurePressQuoteRequests from "@/components/purepress/PurePressQuoteRequests";
import PurePressStudioPrimer from "@/components/purepress/PurePressStudioPrimer";

export default function PurePressStudioPage() {
  return (
    <main id="main" className="pp-admin-page">
      <div className="pp-admin-container">
        <PurePressStudioDesk />
        <PurePressQuoteRequests />
        <PurePressStudioPrimer />
      </div>
    </main>
  );
}
