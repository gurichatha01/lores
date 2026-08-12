import type { HTMLAttributes, ReactNode } from "react";

interface StatCardProps extends HTMLAttributes<HTMLDivElement> {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  treatment?: "editorial" | "soft";
}

export function StatCard({
  className = "",
  detail,
  label,
  treatment = "editorial",
  value,
  ...props
}: StatCardProps) {
  const shell =
    treatment === "soft"
      ? "rounded-[18px] border border-[#f2dbe3] bg-white shadow-sweetheart"
      : "border-2 border-ink bg-white";
  const valueColor = treatment === "soft" ? "text-sweetheart" : "text-ink";

  return (
    <div className={`p-3 ${shell} ${className}`} {...props}>
      <div className="font-mono text-[9px] font-bold uppercase tracking-[0.06em] text-ink/50">
        {label}
      </div>
      <div className={`my-1 text-[30px] font-black leading-none tracking-[-1px] ${valueColor}`}>{value}</div>
      {detail ? <div className="text-[11px] font-semibold leading-snug">{detail}</div> : null}
    </div>
  );
}
