import PurePressStudioDesk from "@/components/purepress/PurePressStudioDesk";
import PurePressStudioQuotationOverview from "@/components/purepress/PurePressStudioQuotationOverview";
import PurePressQuoteRequests from "@/components/purepress/PurePressQuoteRequests";
import PurePressStudioPrimer from "@/components/purepress/PurePressStudioPrimer";

export default function PurePressStudioPage() {
  return (
    <main id="main" className="pp-admin-page">
      <div className="pp-admin-container">
        <PurePressStudioDesk />
        <PurePressStudioQuotationOverview />
        <PurePressQuoteRequests />
        <PurePressStudioPrimer />
      </div>
    </main>
  );
}
