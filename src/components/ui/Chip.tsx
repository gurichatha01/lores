import type { HTMLAttributes, ReactNode } from "react";

type ChipSize = "mode" | "subtype";

interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
  selected?: boolean;
  size?: ChipSize;
}

export function Chip({
  children,
  className = "",
  selected = false,
  size = "mode",
  ...props
}: ChipProps) {
  const sizeStyles =
    size === "mode"
      ? "border-2 px-3 py-1.5 text-[13px] font-bold"
      : "rounded-full border px-2.5 py-1 text-xs font-semibold";

  const selectionStyles = selected
    ? size === "subtype"
      ? "border-ink bg-pink text-white"
      : "border-ink bg-ink text-white"
    : "border-ink bg-white text-ink";

  return (
    <span className={`inline-flex items-center ${sizeStyles} ${selectionStyles} ${className}`} {...props}>
      {children}
    </span>
  );
}
