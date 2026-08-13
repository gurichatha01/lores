import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BrandWordmark } from "../src/components/BrandWordmark";

describe("BrandWordmark", () => {
  it("keeps the word black and applies the supplied accent only to the underscore", () => {
    const markup = renderToStaticMarkup(
      createElement(BrandWordmark, { accent: "#e11400", contrastPlate: true }),
    );

    expect(markup).toContain('style="color:#0a0a0a"');
    expect(markup).toContain('style="color:#e11400"');
    expect(markup).toContain("bg-surface");
  });
});
