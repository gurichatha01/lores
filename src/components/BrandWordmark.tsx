interface BrandWordmarkProps {
  accent: string;
  className?: string;
  contrastPlate?: boolean;
}

export function BrandWordmark({
  accent,
  className = "",
  contrastPlate = false,
}: BrandWordmarkProps) {
  return (
    <span
      className={`inline-flex items-baseline text-ink ${
        contrastPlate ? "bg-surface px-[0.18em] py-[0.08em]" : ""
      } ${className}`}
      style={{ color: "#0a0a0a" }}
      aria-label="lores"
    >
      lores<span style={{ color: accent }} aria-hidden="true">_</span>
    </span>
  );
}
