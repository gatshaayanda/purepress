import Image from "next/image";

export default function PurePressStudioVisual({
  compact = false,
}: {
  compact?: boolean;
}) {
  return (
    <div
      className={`pp-studio-visual${compact ? " is-compact" : ""}`}
      aria-label="Graphic embroidery-studio composition using the PurePress mark, stitch paths and thread colours"
    >
      <div className="pp-dot-field" aria-hidden="true" />
      <div className="pp-thread-line pp-thread-one" aria-hidden="true" />
      <div className="pp-thread-line pp-thread-two" aria-hidden="true" />
      <div className="pp-hoop" aria-hidden="true">
        <div className="pp-hoop-inner">
          <Image
            src="/purepress/brand/purepress-mark.svg"
            alt=""
            width={176}
            height={147}
          />
        </div>
      </div>
      <div className="pp-studio-label pp-studio-label-one">THREAD</div>
      <div className="pp-studio-label pp-studio-label-two">STITCH</div>
      <div className="pp-studio-label pp-studio-label-three">BRAND</div>
      <div className="pp-yellow-block" aria-hidden="true" />
      <div className="pp-magenta-block" aria-hidden="true" />
    </div>
  );
}
