const DARK_TEXT = "#0a0a0a";
const LIGHT_TEXT = "#ffffff";

export function readableTextColor(background: string): typeof DARK_TEXT | typeof LIGHT_TEXT {
  const match = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/iu.exec(background);
  if (!match) return LIGHT_TEXT;

  const channels = match.slice(1).map((channel) => Number.parseInt(channel, 16) / 255);
  const [red, green, blue] = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;

  return luminance > 0.179 ? DARK_TEXT : LIGHT_TEXT;
}
