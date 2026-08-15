import { Briefcase, Flame, Heart, Home, Trophy, Users, type LucideIcon } from "lucide-react";

import type { ReportMode } from "@/lib/types";

/**
 * One fitting Lucide icon per edition, used wherever the /create flow labels a
 * mode (the edition-select cards, the step header, the desktop brand panel, the
 * generating screen) so the whole flow shows consistent line icons instead of
 * emoji. The mode accent color is applied by the caller via `className`/color.
 */
const MODE_ICONS: Record<ReportMode, LucideIcon> = {
  sweetheart: Heart,
  "ride-or-die": Users,
  group: Trophy,
  family: Home,
  work: Briefcase,
  roast: Flame,
};

interface ModeIconProps {
  mode: ReportMode;
  className?: string;
  strokeWidth?: number;
  style?: React.CSSProperties;
}

export function ModeIcon({ mode, className, strokeWidth = 2.5, style }: ModeIconProps) {
  const Icon = MODE_ICONS[mode];
  return <Icon className={className} strokeWidth={strokeWidth} style={style} aria-hidden="true" />;
}
