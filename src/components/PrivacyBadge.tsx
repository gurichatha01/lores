import { Lock } from "lucide-react";

interface PrivacyBadgeProps {
  /** Icon + hairline border color. Use the page's brand or mode accent. */
  accent: string;
  /** Subtle background tint — barely-there, never a solid fill. */
  tint: string;
  textColor?: string;
  className?: string;
}

/**
 * The site's one privacy trust badge. A small bordered strip (hairline border,
 * faint tint), not floating caption text — matches the app's existing
 * bordered-box language (stat cards, award pills) at a quieter, secondary
 * weight. Fully centered: the lock sits inline with the first clause on a
 * centered row, and the second clause stacks on its own centered line below.
 */
export function PrivacyBadge({ accent, tint, textColor = "#0a0a0a", className = "" }: PrivacyBadgeProps) {
  return (
    <div
      className={`flex flex-col items-center gap-1 border px-3.5 py-3 text-center font-mono text-[11px] font-semibold leading-[1.4] ${className}`}
      style={{ borderColor: accent, backgroundColor: tint, color: textColor }}
    >
      <span className="flex items-center gap-2">
        <Lock className="size-3.5 shrink-0" aria-hidden="true" strokeWidth={2.5} />
        your full chat never leaves your phone
      </span>
      <span>we only send anonymised stats</span>
    </div>
  );
}
