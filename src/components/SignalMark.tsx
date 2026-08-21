type SignalMarkProps = {
  className?: string;
};

export default function SignalMark({ className = "h-8 w-8" }: SignalMarkProps) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      aria-hidden="true"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="3" y="3" width="42" height="42" rx="12" fill="currentColor" />
      <path d="M11 11h10v10H11zM27 11h10v10H27zM11 27h10v10H11zM27 27h10v10H27z" fill="var(--signal-paper, #f4f0e7)" />
      <path d="M12 34.5 19.5 27l5.25 5.25L36 21" stroke="var(--signal-lime, #c9f65d)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

