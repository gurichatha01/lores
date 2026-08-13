import { getModePreset } from "./modePresets";
import {
  formatCount,
  formatLocalReportDate,
  formatParticipantTitle,
  formatSpanLabel,
  formatWordCountWithNovels,
} from "./reportPresentation";
import type { Award, PersonStats, ReportContent, ReportSessionData } from "./types";

export const PDF_PAGE_WIDTH = 1240;
export const PDF_PAGE_HEIGHT = 1754;

export interface PdfChapter {
  title: string;
  body: string;
}

export interface PdfDocumentData {
  report: ReportSessionData;
  modeLabel: string;
  accent: string;
  surface: string;
  names: string;
  span: string;
  dateRange: string;
  storyPages: PdfChapter[][];
  awardCards: Array<{ award: Award; line: string }>;
  detailPages: Array<{
    highlights: ReportContent["highlights"];
    people: PersonStats[];
  }>;
}

export interface PdfCanvas {
  width: number;
  height: number;
  getContext(contextId: "2d"): CanvasRenderingContext2D | null;
  toDataURL(type?: string, quality?: number): string;
}

export type PdfCanvasFactory = (width: number, height: number) => PdfCanvas;

const PAGE_MARGIN = 82;
const INK = "#0a0a0a";
const PAPER = "#f3f3ef";
const MUTED = "rgba(10,10,10,.55)";
const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

export function buildPdfDocumentData(report: ReportSessionData): PdfDocumentData {
  const preset = getModePreset(report.mode);
  const chapters = report.content.chapters?.length
    ? report.content.chapters
    : [{ title: report.content.title, body: report.content.narrative }];

  return {
    report,
    modeLabel: preset.label,
    accent: preset.accent,
    surface: preset.treatment === "soft" ? preset.surface : PAPER,
    names: formatParticipantTitle(report.stats.people),
    span: formatSpanLabel(report.stats.spanDays).replace(", in messages", ""),
    dateRange: `${formatLocalReportDate(report.stats.firstMessageDate.slice(0, 10))} - ${formatLocalReportDate(
      report.stats.lastMessageDate.slice(0, 10),
    )}`,
    storyPages: paginateChapters(chapters),
    awardCards: report.awards.map((award) => ({
      award,
      line:
        report.content.awardLines.find((candidate) => candidate.awardId === award.id)?.line ??
        award.detail,
    })),
    detailPages: buildDetailPages(report.content.highlights, report.stats.people),
  };
}

export function renderReportPdfPages(
  report: ReportSessionData,
  createCanvas: PdfCanvasFactory,
): PdfCanvas[] {
  const data = buildPdfDocumentData(report);
  const pages: PdfCanvas[] = [];

  pages.push(renderPage(createCanvas, (context) => drawCover(context, data)));
  pages.push(renderPage(createCanvas, (context) => drawMetrics(context, data)));
  pages.push(renderPage(createCanvas, (context) => drawAwards(context, data)));
  let pageNumber = 4;
  for (const [index, details] of data.detailPages.entries()) {
    pages.push(renderPage(createCanvas, (context) => drawDetailsPage(context, data, details, index, pageNumber)));
    pageNumber += 1;
  }
  for (const [index, chapters] of data.storyPages.entries()) {
    pages.push(renderPage(createCanvas, (context) => drawStory(context, data, chapters, index, pageNumber)));
    pageNumber += 1;
  }
  pages.push(renderPage(createCanvas, (context) => drawClosing(context, data, pageNumber)));

  return pages;
}

function renderPage(createCanvas: PdfCanvasFactory, draw: (context: CanvasRenderingContext2D) => void) {
  const canvas = createCanvas(PDF_PAGE_WIDTH, PDF_PAGE_HEIGHT);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("A 2D canvas context is required to render the PDF.");
  draw(context);
  return canvas;
}

function drawCover(context: CanvasRenderingContext2D, data: PdfDocumentData): void {
  fillPage(context, data.surface);
  drawHeader(context, data, "the keepsake edition", false);

  context.fillStyle = data.accent;
  mono(context, 28, 700, 4);
  context.fillText(`${data.modeLabel.toUpperCase()} - THE LORES OF`, PAGE_MARGIN, 510);
  context.letterSpacing = "0px";

  context.fillStyle = INK;
  archivo(context, 112, 900);
  const namesBottom = drawTextBlock(context, data.names, PAGE_MARGIN, 570, 1040, 112, 4);

  context.fillStyle = MUTED;
  mono(context, 27, 400);
  context.fillText(
    `${data.dateRange.toUpperCase()} - ${data.span.toUpperCase()} - ${formatCount(data.report.stats.totalMessages)} MESSAGES`,
    PAGE_MARGIN,
    namesBottom + 68,
  );

  context.strokeStyle = INK;
  context.lineWidth = 4;
  context.beginPath();
  context.moveTo(PAGE_MARGIN, 1458);
  context.lineTo(PDF_PAGE_WIDTH - PAGE_MARGIN, 1458);
  context.stroke();
  context.fillStyle = INK;
  archivo(context, 34, 700);
  drawTextBlock(context, `“${data.report.content.heroLine}”`, PAGE_MARGIN, 1492, 1030, 44, 4);
  drawPageNumber(context, 1, data.accent, false);
}

function drawMetrics(context: CanvasRenderingContext2D, data: PdfDocumentData): void {
  fillPage(context, PAPER);
  drawSectionHeader(context, data, "02 - the numbers");
  const stats = data.report.stats;

  context.fillStyle = INK;
  archivo(context, 45, 900);
  context.fillText("messages by month", PAGE_MARGIN, 190);
  drawBars(
    context,
    stats.messagesByMonth.map((entry) => entry.count),
    stats.messagesByMonth.map((entry) => entry.month.slice(2).replace("-", "/")),
    PAGE_MARGIN,
    265,
    1076,
    270,
    data.accent,
  );

  chartTitle(context, "hour of day", PAGE_MARGIN, 615);
  drawHeatStrip(context, stats.messagesByHour, PAGE_MARGIN, 674, 500, 96, data.accent);
  chartAxis(context, ["12a", "12p", "11p"], PAGE_MARGIN, 785, 500);

  chartTitle(context, "by weekday", 662, 615);
  drawBars(context, stats.messagesByWeekday, WEEKDAYS, 662, 674, 496, 96, data.accent);

  chartTitle(context, "reply-time spread", PAGE_MARGIN, 905);
  drawBars(
    context,
    stats.replyTimeDistribution.map((bucket) => bucket.count),
    stats.replyTimeDistribution.map((bucket) => bucket.label),
    PAGE_MARGIN,
    962,
    500,
    160,
    data.accent,
  );

  chartTitle(context, "top emoji", 662, 905);
  drawHorizontalBars(context, stats.topEmojis, 662, 962, 496, data.accent);

  context.fillStyle = PAPER;
  context.strokeStyle = INK;
  context.lineWidth = 4;
  context.fillRect(PAGE_MARGIN, 1260, 1076, 252);
  context.strokeRect(PAGE_MARGIN, 1260, 1076, 252);
  context.fillStyle = MUTED;
  mono(context, 23, 700, 2);
  context.fillText(
    `BUSIEST DAY EVER - ${formatLocalReportDate(stats.busiestDay.date).toUpperCase()}`,
    PAGE_MARGIN + 34,
    1300,
  );
  context.letterSpacing = "0px";
  context.fillStyle = data.accent;
  archivo(context, 70, 900);
  context.fillText(`${formatCount(stats.busiestDay.count)} messages`, PAGE_MARGIN + 34, 1350);
  context.fillStyle = INK;
  archivo(context, 27, 700);
  context.fillText(
    `${formatCount(stats.goodMorningCount)} good mornings - ${formatCount(stats.iLoveYouCount)} “love you” messages`,
    PAGE_MARGIN + 34,
    1440,
  );
  drawPageNumber(context, 2, data.accent, false);
}

function drawAwards(context: CanvasRenderingContext2D, data: PdfDocumentData): void {
  fillPage(context, PAPER);
  drawSectionHeader(context, data, "03 - the awards");
  const { awardCards } = data;

  awardCards.forEach(({ award, line }, index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = PAGE_MARGIN + column * 548;
    const y = 190 + row * 252;
    const highlighted = award.id === "main-character";
    context.fillStyle = highlighted ? data.accent : "#ffffff";
    context.strokeStyle = INK;
    context.lineWidth = 4;
    context.fillRect(x, y, 528, 226);
    context.strokeRect(x, y, 528, 226);
    context.fillStyle = highlighted ? "#ffffff" : INK;
    context.font = "48px 'Segoe UI Emoji', Arial, sans-serif";
    context.fillText(award.emoji, x + 24, y + 34);
    archivo(context, 27, 900);
    fitAndDrawText(context, award.label.toUpperCase(), x + 88, y + 26, 410, 27, 20, 900);
    archivo(context, 22, 700);
    context.fillStyle = highlighted ? "rgba(255,255,255,.82)" : MUTED;
    fitAndDrawText(context, award.who, x + 88, y + 65, 410, 22, 16, 700);
    context.fillStyle = highlighted ? "rgba(255,255,255,.7)" : data.accent;
    mono(context, 16, 700);
    drawTextBlock(context, award.detail.toUpperCase(), x + 24, y + 108, 480, 22, 2);
    context.fillStyle = highlighted ? "#ffffff" : INK;
    archivo(context, 19, 600);
    drawTextBlock(context, line, x + 24, y + 157, 480, 25, 3);
  });

  const awardRows = Math.ceil(awardCards.length / 2);
  const milestoneRuleY = Math.max(955, 190 + awardRows * 252 + 24);
  sectionRule(context, "MILESTONES", milestoneRuleY);
  const milestoneTop = milestoneRuleY + 63;
  const milestones = buildMilestones(data);
  milestones.forEach((milestone, index) => {
    const y = milestoneTop + index * 62;
    context.fillStyle = INK;
    archivo(context, 24, 700);
    context.fillText(milestone.label, PAGE_MARGIN, y);
    context.fillStyle = MUTED;
    mono(context, 21, 400);
    context.textAlign = "right";
    context.fillText(milestone.value.toUpperCase(), PDF_PAGE_WIDTH - PAGE_MARGIN, y + 3);
    context.textAlign = "left";
  });

  drawPageNumber(context, 3, data.accent, false);
}

function drawDetailsPage(
  context: CanvasRenderingContext2D,
  data: PdfDocumentData,
  details: PdfDocumentData["detailPages"][number],
  detailPageIndex: number,
  pageNumber: number,
): void {
  fillPage(context, PAPER);
  const hasHighlights = details.highlights.length > 0;
  drawSectionHeader(
    context,
    data,
    `04 - ${hasHighlights ? "the receipts" : "the people"}${data.detailPages.length > 1 ? ` - ${detailPageIndex + 1}` : ""}`,
  );

  if (hasHighlights) {
    drawFullHighlight(context, data, details.highlights[0], detailPageIndex);
    drawPageNumber(context, pageNumber, data.accent, false);
    return;
  }

  const columns = 3;
  const cardWidth = 342;
  const cardHeight = 310;
  const gapX = 25;
  const rowGap = 28;
  const peopleTop = 194;
  details.people.forEach((person, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = PAGE_MARGIN + column * (cardWidth + gapX);
    const y = peopleTop + row * (cardHeight + rowGap);
    context.fillStyle = "#ffffff";
    context.strokeStyle = INK;
    context.lineWidth = 3;
    context.fillRect(x, y, cardWidth, cardHeight);
    context.strokeRect(x, y, cardWidth, cardHeight);
    context.fillStyle = data.accent;
    fitAndDrawText(context, person.name, x + 20, y + 20, cardWidth - 40, 29, 19, 900);
    context.fillStyle = MUTED;
    mono(context, 15, 700, 1.5);
    context.fillText(`${formatCount(person.messageCount)} MESSAGES`, x + 20, y + 68);
    context.letterSpacing = "0px";
    context.fillStyle = INK;
    archivo(context, 21, 600);
    drawTextBlock(
      context,
      person.topWords.join(" - ") || "no repeated words",
      x + 20,
      y + 105,
      cardWidth - 40,
      31,
      6,
    );
  });
  drawPageNumber(context, pageNumber, data.accent, false);
}

function drawFullHighlight(
  context: CanvasRenderingContext2D,
  data: PdfDocumentData,
  highlight: ReportContent["highlights"][number],
  receiptIndex: number,
): void {
  const x = PAGE_MARGIN;
  const y = 188;
  const cardWidth = PDF_PAGE_WIDTH - PAGE_MARGIN * 2;
  const cardHeight = 1390;
  context.fillStyle = "#ffffff";
  context.strokeStyle = INK;
  context.lineWidth = 3;
  context.fillRect(x, y, cardWidth, cardHeight);
  context.strokeRect(x, y, cardWidth, cardHeight);
  context.fillStyle = data.accent;
  mono(context, 17, 700, 2);
  context.fillText(`RECEIPT ${String(receiptIndex + 1).padStart(2, "0")}`, x + 34, y + 32);
  context.letterSpacing = "0px";
  context.fillStyle = INK;
  fitAndDrawText(context, highlight.label, x + 34, y + 78, cardWidth - 68, 50, 38, 900);
  context.fillStyle = MUTED;
  archivo(context, 25, 600);
  const bodyBottom = drawFullTextBlock(
    context,
    highlight.body,
    x + 34,
    y + 150,
    cardWidth - 68,
    36,
  );

  if (highlight.bubble) {
    const receiptTop = bodyBottom + 38;
    archivo(context, 22, 700);
    const receiptLines = wrapLines(
      context,
      `“${highlight.bubble}”`,
      cardWidth - 108,
      Number.POSITIVE_INFINITY,
    );
    const receiptHeight = receiptLines.length * 31 + 60;
    context.fillStyle = `${data.accent}18`;
    context.fillRect(x + 28, receiptTop, cardWidth - 56, receiptHeight);
    context.fillStyle = INK;
    receiptLines.forEach((line, index) =>
      context.fillText(line, x + 54, receiptTop + 30 + index * 31),
    );
  }
}

function drawStory(
  context: CanvasRenderingContext2D,
  data: PdfDocumentData,
  chapters: readonly PdfChapter[],
  storyIndex: number,
  pageNumber: number,
): void {
  fillPage(context, PAPER);
  drawSectionHeader(context, data, `05 - the story${data.storyPages.length > 1 ? ` - ${storyIndex + 1}` : ""}`);
  let y = 200;

  for (const [index, chapter] of chapters.entries()) {
    context.fillStyle = data.accent;
    mono(context, 21, 700, 3);
    context.fillText(`CH. ${index + 1 + precedingChapterCount(data.storyPages, storyIndex)}`, PAGE_MARGIN, y);
    context.letterSpacing = "0px";
    context.fillStyle = INK;
    archivo(context, 55, 900);
    y = drawTextBlock(context, chapter.title, PAGE_MARGIN, y + 42, 1050, 58, 2) + 26;
    context.fillStyle = INK;
    archivo(context, 29, 500);
    y = drawTextBlock(context, chapter.body, PAGE_MARGIN, y, 1050, 43, 22) + 46;
  }
  drawPageNumber(context, pageNumber, data.accent, false);
}

function drawClosing(context: CanvasRenderingContext2D, data: PdfDocumentData, pageNumber: number): void {
  fillPage(context, INK);
  context.textAlign = "center";
  context.fillStyle = data.accent;
  mono(context, 26, 700, 4);
  context.fillText("THE LORES OF", PDF_PAGE_WIDTH / 2, 490);
  context.letterSpacing = "0px";
  context.fillStyle = PAPER;
  archivo(context, 88, 900);
  drawCenteredTextBlock(context, data.names, PDF_PAGE_WIDTH / 2, 560, 1020, 92, 3);
  context.fillStyle = "rgba(243,243,239,.72)";
  archivo(context, 38, 700);
  context.fillText(`${formatCount(data.report.stats.totalMessages)} messages.`, PDF_PAGE_WIDTH / 2, 915);
  context.fillText(
    `${formatWordCountWithNovels(
      data.report.stats.totalWords,
      data.report.stats.novelsEquivalent,
    )}.`,
    PDF_PAGE_WIDTH / 2,
    970,
  );
  context.fillText(`${data.span} of showing up.`, PDF_PAGE_WIDTH / 2, 1025);
  context.fillStyle = PAPER;
  archivo(context, 34, 700);
  drawCenteredTextBlock(context, `“${data.report.content.heroLine}”`, PDF_PAGE_WIDTH / 2, 1140, 900, 48, 5);
  context.textAlign = "left";
  context.strokeStyle = "rgba(243,243,239,.2)";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(PAGE_MARGIN, 1588);
  context.lineTo(PDF_PAGE_WIDTH - PAGE_MARGIN, 1588);
  context.stroke();
  context.fillStyle = "rgba(243,243,239,.5)";
  mono(context, 21, 400);
  context.fillText("MADE WITH LORES.IN", PAGE_MARGIN, 1625);
  drawLogo(context, PDF_PAGE_WIDTH - PAGE_MARGIN - 120, 1610, data.accent, true);
  drawPageNumber(context, pageNumber, data.accent, true);
}

function drawHeader(
  context: CanvasRenderingContext2D,
  data: PdfDocumentData,
  rightLabel: string,
  dark: boolean,
): void {
  drawLogo(context, PAGE_MARGIN, 70, data.accent, dark);
  context.fillStyle = dark ? "rgba(243,243,239,.55)" : MUTED;
  mono(context, 21, 400, 2);
  context.textAlign = "right";
  context.fillText(rightLabel.toUpperCase(), PDF_PAGE_WIDTH - PAGE_MARGIN, 82);
  context.textAlign = "left";
  context.strokeStyle = dark ? "rgba(243,243,239,.28)" : INK;
  context.lineWidth = 4;
  context.beginPath();
  context.moveTo(PAGE_MARGIN, 140);
  context.lineTo(PDF_PAGE_WIDTH - PAGE_MARGIN, 140);
  context.stroke();
}

function drawSectionHeader(context: CanvasRenderingContext2D, data: PdfDocumentData, label: string): void {
  context.fillStyle = MUTED;
  mono(context, 23, 700, 3);
  context.fillText(label.toUpperCase(), PAGE_MARGIN, 76);
  context.letterSpacing = "0px";
  context.strokeStyle = data.accent;
  context.lineWidth = 4;
  context.beginPath();
  context.moveTo(PAGE_MARGIN, 136);
  context.lineTo(PDF_PAGE_WIDTH - PAGE_MARGIN, 136);
  context.stroke();
}

function drawBars(
  context: CanvasRenderingContext2D,
  values: readonly number[],
  labels: readonly string[],
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
): void {
  const maximum = Math.max(...values, 1);
  const gap = Math.max(3, Math.min(10, width / Math.max(values.length, 1) / 5));
  const barWidth = (width - gap * Math.max(0, values.length - 1)) / Math.max(values.length, 1);
  const labelStep = Math.max(1, Math.ceil(values.length / 12));

  values.forEach((value, index) => {
    const barHeight = value === 0 ? 2 : Math.max(5, (value / maximum) * height);
    const barX = x + index * (barWidth + gap);
    context.fillStyle = color;
    context.fillRect(barX, y + height - barHeight, barWidth, barHeight);
    if (index % labelStep === 0 || index === values.length - 1) {
      context.fillStyle = MUTED;
      mono(context, Math.max(13, Math.min(18, barWidth)), 400);
      context.textAlign = "center";
      context.fillText(labels[index] ?? "", barX + barWidth / 2, y + height + 14);
      context.textAlign = "left";
    }
  });
}

function drawHeatStrip(
  context: CanvasRenderingContext2D,
  values: readonly number[],
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
): void {
  const maximum = Math.max(...values, 1);
  const gap = 3;
  const cellWidth = (width - gap * 23) / 24;
  values.forEach((value, index) => {
    context.globalAlpha = Math.max(0.08, value / maximum);
    context.fillStyle = color;
    context.fillRect(x + index * (cellWidth + gap), y, cellWidth, height);
  });
  context.globalAlpha = 1;
}

function drawHorizontalBars(
  context: CanvasRenderingContext2D,
  entries: readonly { emoji: string; count: number }[],
  x: number,
  y: number,
  width: number,
  color: string,
): void {
  const maximum = Math.max(...entries.map((entry) => entry.count), 1);
  entries.slice(0, 5).forEach((entry, index) => {
    const rowY = y + index * 42;
    context.fillStyle = INK;
    context.font = "27px 'Segoe UI Emoji', Arial, sans-serif";
    context.fillText(entry.emoji, x, rowY);
    context.fillStyle = color;
    context.fillRect(x + 50, rowY + 7, (entry.count / maximum) * (width - 105), 23);
    context.fillStyle = MUTED;
    mono(context, 17, 700);
    context.fillText(formatCount(entry.count), x + width - 45, rowY + 9);
  });
}

function chartTitle(context: CanvasRenderingContext2D, title: string, x: number, y: number): void {
  context.fillStyle = INK;
  archivo(context, 32, 900);
  context.fillText(title, x, y);
}

function chartAxis(
  context: CanvasRenderingContext2D,
  labels: readonly string[],
  x: number,
  y: number,
  width: number,
): void {
  context.fillStyle = MUTED;
  mono(context, 16, 400);
  labels.forEach((label, index) => {
    context.textAlign = index === 0 ? "left" : index === labels.length - 1 ? "right" : "center";
    context.fillText(label, x + (index / (labels.length - 1)) * width, y);
  });
  context.textAlign = "left";
}

function sectionRule(context: CanvasRenderingContext2D, label: string, y: number): void {
  context.fillStyle = MUTED;
  mono(context, 21, 700, 3);
  context.fillText(label, PAGE_MARGIN, y);
  context.letterSpacing = "0px";
  context.strokeStyle = INK;
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(PAGE_MARGIN, y + 44);
  context.lineTo(PDF_PAGE_WIDTH - PAGE_MARGIN, y + 44);
  context.stroke();
}

function buildMilestones(data: PdfDocumentData): Array<{ label: string; value: string }> {
  const stats = data.report.stats;
  const milestones = [
    { label: "first message ever", value: formatLocalReportDate(stats.firstMessageDate.slice(0, 10)) },
  ];
  if (stats.firstLateNightDate) {
    milestones.push({ label: "first midnight-4am text", value: formatLocalReportDate(stats.firstLateNightDate.slice(0, 10)) });
  }
  if (stats.firstRelationshipTalkDate) {
    milestones.push({ label: 'first “what are we”', value: formatLocalReportDate(stats.firstRelationshipTalkDate.slice(0, 10)) });
  }
  if (stats.longestSilenceRange) {
    milestones.push({
      label: "longest silence",
      value: `${stats.longestSilenceRange.days} days - ${formatLocalReportDate(stats.longestSilenceRange.startDate)}`,
    });
  }
  return milestones;
}

function paginateChapters(chapters: readonly PdfChapter[]): PdfChapter[][] {
  const expanded = chapters.flatMap((chapter) => splitChapter(chapter));
  const pages: PdfChapter[][] = [];
  let current: PdfChapter[] = [];
  let weight = 0;

  for (const chapter of expanded) {
    const chapterWeight = chapter.title.length * 2 + chapter.body.length;
    if (current.length > 0 && weight + chapterWeight > 1_350) {
      pages.push(current);
      current = [];
      weight = 0;
    }
    current.push(chapter);
    weight += chapterWeight;
  }
  if (current.length > 0) pages.push(current);
  return pages;
}

function splitChapter(chapter: PdfChapter): PdfChapter[] {
  if (chapter.body.length <= 1_200) return [{ ...chapter }];
  const words = chapter.body.split(/\s+/u);
  const chunks: string[] = [];
  let current = "";
  for (const word of words) {
    if (current.length > 0 && current.length + word.length + 1 > 1_150) {
      chunks.push(current);
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }
  if (current) chunks.push(current);
  return chunks.map((body, index) => ({
    title: index === 0 ? chapter.title : `${chapter.title} (continued)`,
    body,
  }));
}

function precedingChapterCount(pages: readonly PdfChapter[][], pageIndex: number): number {
  return pages.slice(0, pageIndex).reduce((total, page) => total + page.length, 0);
}

function buildDetailPages(
  highlights: ReportContent["highlights"],
  people: readonly PersonStats[],
): PdfDocumentData["detailPages"] {
  const pages: PdfDocumentData["detailPages"] = [];
  for (const highlight of highlights) {
    pages.push({ highlights: [highlight], people: [] });
  }
  for (let personIndex = 0; personIndex < people.length; personIndex += 12) {
    pages.push({ highlights: [], people: people.slice(personIndex, personIndex + 12) });
  }

  return pages;
}

function fillPage(context: CanvasRenderingContext2D, color: string): void {
  context.clearRect(0, 0, PDF_PAGE_WIDTH, PDF_PAGE_HEIGHT);
  context.fillStyle = color;
  context.fillRect(0, 0, PDF_PAGE_WIDTH, PDF_PAGE_HEIGHT);
  context.textBaseline = "top";
  context.textAlign = "left";
}

function drawLogo(context: CanvasRenderingContext2D, x: number, y: number, accent: string, dark: boolean): void {
  context.fillStyle = dark ? PAPER : INK;
  archivo(context, 46, 900);
  context.fillText("lores", x, y);
  const width = context.measureText("lores").width;
  context.fillStyle = accent;
  context.fillText("_", x + width, y);
}

function drawPageNumber(context: CanvasRenderingContext2D, page: number, accent: string, dark: boolean): void {
  context.fillStyle = dark ? "rgba(243,243,239,.42)" : MUTED;
  mono(context, 17, 400);
  context.textAlign = "right";
  context.fillText(`${String(page).padStart(2, "0")} - lores`, PDF_PAGE_WIDTH - PAGE_MARGIN, 1680);
  context.fillStyle = accent;
  context.fillText("_", PDF_PAGE_WIDTH - PAGE_MARGIN + 8, 1680);
  context.textAlign = "left";
}

function archivo(context: CanvasRenderingContext2D, size: number, weight: number): void {
  context.font = `${weight} ${size}px Archivo, Arial, sans-serif`;
}

function mono(context: CanvasRenderingContext2D, size: number, weight: number, spacing = 0): void {
  context.font = `${weight} ${size}px 'Space Mono', monospace`;
  context.letterSpacing = `${spacing}px`;
}

function fitAndDrawText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  maxSize: number,
  minSize: number,
  weight: number,
): void {
  let size = maxSize;
  archivo(context, size, weight);
  while (size > minSize && context.measureText(text).width > maxWidth) {
    size -= 1;
    archivo(context, size, weight);
  }
  context.fillText(ellipsize(context, text, maxWidth), x, y);
}

function ellipsize(context: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (context.measureText(text).width <= maxWidth) return text;
  let value = text;
  while (value.length > 1 && context.measureText(`${value}…`).width > maxWidth) {
    value = value.slice(0, -1);
  }
  return `${value.trimEnd()}…`;
}

function drawTextBlock(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
): number {
  const lines = wrapLines(context, text, maxWidth, maxLines);
  lines.forEach((line, index) => context.fillText(line, x, y + index * lineHeight));
  return y + lines.length * lineHeight;
}

function drawFullTextBlock(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
): number {
  const lines = wrapLines(context, text, maxWidth, Number.POSITIVE_INFINITY);
  lines.forEach((line, index) => context.fillText(line, x, y + index * lineHeight));
  return y + lines.length * lineHeight;
}

function drawCenteredTextBlock(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
): number {
  context.textAlign = "center";
  const lines = wrapLines(context, text, maxWidth, maxLines);
  lines.forEach((line, index) => context.fillText(line, x, y + index * lineHeight));
  return y + lines.length * lineHeight;
}

function wrapLines(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.replace(/\s+/gu, " ").trim().split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (!line || context.measureText(candidate).width <= maxWidth) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
      if (lines.length === maxLines - 1) break;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (Number.isFinite(maxLines) && lines.join(" ").length < text.trim().length && lines.length > 0) {
    lines[lines.length - 1] = `${lines.at(-1)!.replace(/[.,;:!?]?$/u, "")}…`;
  }
  return lines;
}
