import { describe, expect, it } from "vitest";

import { curateSample } from "../src/lib/curateSample";
import { testMessage } from "./reportTestData";

describe("curateSample", () => {
  it("selects 20–30 messages per person from heuristics and a repeatable time spread", () => {
    const messages = ["A", "B"].flatMap((sender, senderIndex) =>
      Array.from({ length: 45 }, (_, index) => {
        let text = `${sender} ordinary message ${index}`;
        if (index === 21) text = "lol hahaha 😂 😂";
        if (index === 32) text = "I will always remember how much I love this";
        if (index === 40) text = "longest " + "thoughtful detail ".repeat(80);
        return testMessage(
          new Date(2024, 0, 1, senderIndex * 2 + index, index % 60),
          sender,
          text,
        );
      }),
    );

    const first = curateSample([...messages].reverse(), { perPerson: 25 });
    const second = curateSample([...messages].reverse(), { perPerson: 25 });

    expect(first.map((message) => `${message.sender}:${message.text}`)).toEqual(
      second.map((message) => `${message.sender}:${message.text}`),
    );
    for (const sender of ["A", "B"]) {
      const selected = first.filter((message) => message.sender === sender);
      expect(selected).toHaveLength(25);
      expect(selected.some((message) => message.text.startsWith("longest"))).toBe(true);
      expect(selected.some((message) => message.text.includes("hahaha"))).toBe(true);
      expect(selected.some((message) => message.text.includes("always remember"))).toBe(true);
      expect(
        selected.at(-1)!.timestamp.getTime() - selected[0].timestamp.getTime(),
      ).toBeGreaterThan(30 * 60 * 60 * 1_000);
    }
    expect(first.every((message, index) => index === 0 || message.timestamp >= first[index - 1].timestamp)).toBe(
      true,
    );
  });

  it("keeps every message in small chats and enforces the phase sampling bounds", () => {
    const messages = [
      testMessage(new Date(2024, 0, 1, 9), "A", "one"),
      testMessage(new Date(2024, 0, 1, 10), "B", "two"),
    ];

    expect(curateSample(messages)).toEqual(messages);
    expect(() => curateSample(messages, { perPerson: 19 })).toThrow("20");
    expect(() => curateSample(messages, { perPerson: 31 })).toThrow("30");
  });
});
