export function Logo({ size = 48, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <rect width="48" height="48" rx="10" fill="#0C66E4" />
      <path
        d="M14 12V36M14 24L26 12M18 20L28 36"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="32" y="14" width="4" height="12" rx="2" fill="#FFFFFF" opacity="0.8" />
      <rect x="32" y="29" width="4" height="6" rx="2" fill="#FFFFFF" opacity="0.8" />
    </svg>
  );
}
