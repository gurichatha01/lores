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
 * The site's one privacy trust badge: "your full chat never leaves your
 * phone — we only send anonymised stats". A small bordered strip (hairline
 * border, faint tint), not floating caption text — matches the app's
 * existing bordered-box language (stat cards, award pills) at a quieter,
 * secondary weight. Each clause stays intact (whitespace-nowrap) so it either
 * sits on one line or breaks cleanly at the dash, never mid-phrase.
 */
export function PrivacyBadge({ accent, tint, textColor = "#0a0a0a", className = "" }: PrivacyBadgeProps) {
  return (
    <div
      className={`flex items-start gap-2 border px-3.5 py-2.5 font-mono text-[11px] font-semibold leading-[1.45] ${className}`}
      style={{ borderColor: accent, backgroundColor: tint, color: textColor }}
    >
      {/* Match the icon box to the text line-height so it optically centers on
          the first line whether the phrase sits on one line or wraps to two. */}
      <span className="flex h-[calc(11px*1.45)] shrink-0 items-center">
        <Lock className="size-3.5" aria-hidden="true" strokeWidth={2.5} />
      </span>
      <p>
        <span className="whitespace-nowrap">your full chat never leaves your phone</span>{" "}
        <span className="whitespace-nowrap">— we only send anonymised stats</span>
      </p>
    </div>
  );
}
