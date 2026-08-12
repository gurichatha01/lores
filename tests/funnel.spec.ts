import { describe, expect, it } from "vitest";

import {
  defaultSubtypeForMode,
  EXPORT_INSTRUCTIONS,
  narrativeFirstLine,
  PARTNER_SUBTYPES,
} from "../src/lib/funnel";

describe("Phase 8 funnel configuration", () => {
  it("keeps the design-specified partner subtype chips", () => {
    expect(PARTNER_SUBTYPES).toEqual(["situationship", "gf", "bf", "crush", "ex"]);
    expect(defaultSubtypeForMode("sweetheart")).toBe("situationship");
    expect(defaultSubtypeForMode("group")).toBe("");
  });

  it("provides distinct export paths for iOS and Android", () => {
    expect(EXPORT_INSTRUCTIONS.ios.steps).toHaveLength(3);
    expect(EXPORT_INSTRUCTIONS.ios.steps.join(" ")).toContain("Export Chat");
    expect(EXPORT_INSTRUCTIONS.ios.steps.join(" ")).toContain("Without Media");
    expect(EXPORT_INSTRUCTIONS.android.steps).toHaveLength(3);
    expect(EXPORT_INSTRUCTIONS.android.steps.join(" ")).toContain("Export chat");
    expect(EXPORT_INSTRUCTIONS.android.steps.join(" ")).toContain("Without media");
  });

  it("reveals only the first narrative sentence in the teaser", () => {
    expect(narrativeFirstLine("It started with a hello. Then everything changed.\nA new chapter."))
      .toBe("It started with a hello.");
    expect(narrativeFirstLine("One line without punctuation"))
      .toBe("One line without punctuation");
  });
});
