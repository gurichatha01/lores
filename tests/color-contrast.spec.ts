import { describe, expect, it } from "vitest";

import { readableTextColor } from "../src/lib/colorContrast";
import { MODE_PRESETS } from "../src/lib/modePresets";

describe("mode card contrast", () => {
  it("chooses the higher-contrast foreground for every mode accent", () => {
    expect(readableTextColor(MODE_PRESETS.sweetheart.accent)).toBe("#0a0a0a");
    expect(readableTextColor(MODE_PRESETS["ride-or-die"].accent)).toBe("#0a0a0a");
    expect(readableTextColor(MODE_PRESETS.group.accent)).toBe("#ffffff");
    expect(readableTextColor(MODE_PRESETS.family.accent)).toBe("#0a0a0a");
    expect(readableTextColor(MODE_PRESETS.work.accent)).toBe("#0a0a0a");
    expect(readableTextColor(MODE_PRESETS.roast.accent)).toBe("#ffffff");
  });
});
