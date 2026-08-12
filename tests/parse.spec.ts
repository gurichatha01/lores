import { readFile } from "node:fs/promises";
import path from "node:path";

import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import {
  parseWhatsApp,
  parseWhatsAppText,
  WhatsAppParseError,
} from "../src/lib/parseWhatsApp";

const fixtures = path.join(process.cwd(), "tests", "fixtures");

async function fixture(name: string): Promise<string> {
  return readFile(path.join(fixtures, name), "utf8");
}

function namedBlob(parts: BlobPart[], name: string, type: string): Blob & { name: string } {
  return Object.assign(new Blob(parts, { type }), { name });
}

describe("parseWhatsAppText", () => {
  it("parses iOS 12-hour DMY exports, multiline messages, colon names, and metadata markers", async () => {
    const result = parseWhatsAppText(await fixture("ios-one-to-one.txt"));

    expect(result.mediaCount).toBe(1);
    expect(result.messages).toHaveLength(5);
    expect(result.messages.map((message) => message.sender)).toEqual([
      "Ava",
      "Ops: Night",
      "Ops: Night",
      "Ava",
      "Ava",
    ]);
    expect(result.messages[0].text).toBe(
      "First line of a long thought\nand this belongs to the same message.",
    );
    expect(result.messages[0].timestamp.getFullYear()).toBe(2024);
    expect(result.messages[0].timestamp.getMonth()).toBe(7);
    expect(result.messages[0].timestamp.getDate()).toBe(13);
    expect(result.messages[0].timestamp.getHours()).toBe(21);
    expect(result.messages[1].text).toBe("Deploy after midnight: only if the checks pass.");
    expect(result.messages[3]).toMatchObject({
      text: "👩🏽‍💻🔥",
      wordCount: 0,
      hasEmoji: true,
      emojis: ["👩🏽‍💻", "🔥"],
    });
    expect(result.messages[4].text).toBe("fixed the typo");
    expect(result.messages.some((message) => message.text.includes("deleted"))).toBe(false);
    expect(result.messages.some((message) => message.sender.includes("‎"))).toBe(false);
  });

  it("parses Android 24-hour MDY group exports and filters group events", async () => {
    const result = parseWhatsAppText(await fixture("android-group.txt"));

    expect(result.mediaCount).toBe(2);
    expect(result.messages).toHaveLength(4);
    expect(result.messages.map((message) => message.sender)).toEqual(["Maya", "Leo", "Priya", "Leo"]);
    expect(result.messages[0].timestamp.getMonth()).toBe(7);
    expect(result.messages[0].timestamp.getDate()).toBe(13);
    expect(result.messages[1]).toMatchObject({
      text: "First line\nsecond line with an emoji 🙂",
      hasEmoji: true,
      emojis: ["🙂"],
    });
    expect(result.messages[2].timestamp.getDate()).toBe(14);
    expect(result.messages[3].text).toBe("caption stays in the chat");
  });

  it("lets callers resolve fully ambiguous dates explicitly", () => {
    const raw = "[01/02/24, 12:05:00 AM] Noor: midnight";
    const dmy = parseWhatsAppText(raw, { dateOrder: "DMY" }).messages[0].timestamp;
    const mdy = parseWhatsAppText(raw, { dateOrder: "MDY" }).messages[0].timestamp;

    expect([dmy.getMonth(), dmy.getDate(), dmy.getHours()]).toEqual([1, 1, 0]);
    expect([mdy.getMonth(), mdy.getDate(), mdy.getHours()]).toEqual([0, 2, 0]);
  });

  it("accepts 24-hour iOS and 12-hour Android timestamp variants", () => {
    const ios = parseWhatsAppText("[18/08/24, 23:59] Ava: late iOS").messages[0];
    const android = parseWhatsAppText("08/18/2024, 11:59 p.m. - Ava: late Android").messages[0];

    expect([ios.timestamp.getDate(), ios.timestamp.getHours()]).toEqual([18, 23]);
    expect([android.timestamp.getDate(), android.timestamp.getHours()]).toEqual([18, 23]);
  });

  it("uses explicit participants for a one-off colon-containing sender", () => {
    const raw = "15/08/2024, 08:30 - Ops: Night: one-off handover: all green";
    const result = parseWhatsAppText(raw, { participants: ["Ops: Night"] });

    expect(result.messages[0]).toMatchObject({
      sender: "Ops: Night",
      text: "one-off handover: all green",
    });
  });

  it("ignores invalid calendar dates instead of normalizing them", () => {
    const result = parseWhatsAppText(
      "31/02/2024, 10:00 - Ava: impossible\n29/02/2024, 10:00 - Ava: leap day",
    );

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].text).toBe("leap day");
  });

  it("does not mistake ordinary user text for a group event and strips inline edited markers", () => {
    const result = parseWhatsAppText(
      "17/08/2024, 09:00 - Ava: I added sugar to the coffee\n" +
        "17/08/2024, 09:01 - Ava: better wording [edited]",
    );

    expect(result.messages.map((message) => message.text)).toEqual([
      "I added sugar to the coffee",
      "better wording",
    ]);
  });
});

describe("parseWhatsApp file inputs", () => {
  it("accepts a raw .txt Blob", async () => {
    const input = namedBlob([await fixture("ios-one-to-one.txt")], "chat.txt", "text/plain");
    const result = await parseWhatsApp(input);

    expect(result.messages).toHaveLength(5);
    expect(result.mediaCount).toBe(1);
  });

  it("finds nested _chat.txt in a ZIP and counts archived media without double-counting references", async () => {
    const zip = new JSZip();
    zip.file("WhatsApp Chat/_chat.txt", await fixture("android-group.txt"));
    zip.file("WhatsApp Chat/photo.jpg", new Uint8Array([1, 2, 3]));
    zip.file("WhatsApp Chat/report.pdf", new Uint8Array([4, 5, 6]));
    zip.file("__MACOSX/._photo.jpg", new Uint8Array([7]));
    zip.file(".DS_Store", new Uint8Array([8]));

    const bytes = await zip.generateAsync({ type: "uint8array" });
    const input = namedBlob([bytes], "export.zip", "application/zip");
    const result = await parseWhatsApp(input);

    // Two real archived files + one omitted image. report.pdf's text reference is
    // not counted again because the corresponding file exists in the ZIP.
    expect(result.mediaCount).toBe(3);
    expect(result.messages).toHaveLength(4);
    expect(result.messages.at(-1)?.text).toBe("caption stays in the chat");
  });

  it("sniffs ZIP input even without a filename", async () => {
    const zip = new JSZip();
    zip.file("_chat.txt", "16/08/2024, 09:00 - Ava: found it");
    const input = new Blob([await zip.generateAsync({ type: "uint8array" })]);

    await expect(parseWhatsApp(input)).resolves.toMatchObject({
      mediaCount: 0,
      messages: [{ sender: "Ava", text: "found it" }],
    });
  });

  it("rejects ZIPs without a chat text file", async () => {
    const zip = new JSZip();
    zip.file("photo.jpg", new Uint8Array([1]));
    const input = namedBlob(
      [await zip.generateAsync({ type: "uint8array" })],
      "photos.zip",
      "application/zip",
    );

    await expect(parseWhatsApp(input)).rejects.toEqual(
      new WhatsAppParseError("No WhatsApp _chat.txt file was found in that ZIP."),
    );
  });

  it("rejects unsupported named files", async () => {
    const input = namedBlob(["hello"], "chat.csv", "text/csv");
    await expect(parseWhatsApp(input)).rejects.toThrow("Choose a WhatsApp .txt or .zip export.");
  });
});
