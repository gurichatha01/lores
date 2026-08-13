import { describe, expect, it } from "vitest";

import { buildStoryTimeline } from "../src/lib/storyTimeline";

const chapters = Array.from({ length: 4 }, (_, index) => ({
  title: `Chapter ${index + 1}`,
  body: "A deterministic chapter.",
}));

describe("story timeline", () => {
  it("anchors endpoints and evenly interpolates middle chapter dates", () => {
    const timeline = buildStoryTimeline(chapters, {
      firstMessageDate: "2022-01-01",
      lastMessageDate: "2023-01-01",
      spanDays: 366,
      busiestDay: { date: "2022-08-28", count: 143 },
    });

    expect(timeline.map(({ chapterIndex }) => chapterIndex)).toEqual([1, 2, 3, 4]);
    expect(timeline[0]).toMatchObject({ date: "2022-01-01", dateLabel: "Jan 2022" });
    expect(timeline[1]).toMatchObject({ date: "2022-05-03", dateLabel: "May 2022" });
    expect(timeline[2]).toMatchObject({ date: "2022-09-01", dateLabel: "Sep 2022" });
    expect(timeline[3]).toMatchObject({ date: "2023-01-01", dateLabel: "Jan 2023" });
    expect(timeline.filter(({ isBusiestDay }) => isBusiestDay)).toEqual([
      expect.objectContaining({ chapterIndex: 3, busiestDayLabel: "28 Aug 2022 · 143 msgs" }),
    ]);
  });

  it("supports twelve chapters without assuming a four-chapter report", () => {
    const timeline = buildStoryTimeline(Array.from({ length: 12 }, () => ({ title: "", body: "" })), {
      firstMessageDate: "2024-01-01",
      lastMessageDate: "2024-12-31",
      spanDays: 366,
      busiestDay: { date: "2024-12-31", count: 20 },
    });

    expect(timeline).toHaveLength(12);
    expect(timeline.at(-1)).toMatchObject({
      chapterIndex: 12,
      date: "2024-12-31",
      isBusiestDay: true,
    });
  });

  it("uses safe labels for one chapter and invalid dates", () => {
    expect(buildStoryTimeline([{ title: "Only", body: "One chapter" }], {
      firstMessageDate: "not-a-date",
      lastMessageDate: "",
      spanDays: 0,
      busiestDay: { date: "bad", count: Number.NaN },
    })).toEqual([{
      chapterIndex: 1,
      date: null,
      dateLabel: "Date unknown",
      isBusiestDay: true,
      busiestDayLabel: "date unknown · 0 msgs",
    }]);
  });
});
