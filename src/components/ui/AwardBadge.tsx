import type { HTMLAttributes, ReactNode } from "react";

interface AwardBadgeProps extends HTMLAttributes<HTMLDivElement> {
  emoji: ReactNode;
  label: string;
  detail?: ReactNode;
  highlighted?: boolean;
  treatment?: "editorial" | "soft";
}

export function AwardBadge({
  className = "",
  detail,
  emoji,
  highlighted = false,
  label,
  treatment = "editorial",
  ...props
}: AwardBadgeProps) {
  const shell =
    treatment === "soft"
      ? `${highlighted ? "bg-[#fdeef4]" : "bg-white"} rounded-full border border-[#f2dbe3]`
      : `${highlighted ? "bg-pink text-white" : "bg-white text-ink"} border-2 border-ink`;

  return (
    <div className={`flex items-center gap-3 px-3 py-2 ${shell} ${className}`} {...props}>
      <span className="text-xl leading-none" aria-hidden="true">
        {emoji}
      </span>
      <div className="min-w-0">
        <div className="text-[13px] font-extrabold uppercase leading-tight">{label}</div>
        {detail ? (
          <div className={`text-[11px] font-semibold leading-snug ${highlighted && treatment === "editorial" ? "text-white/85" : "text-ink/55"}`}>
            {detail}
          </div>
        ) : null}
      </div>
    </div>
  );
}
