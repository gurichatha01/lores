import { getModePreset } from "./modePresets";
import { buildPlayerCards, type PlayerCardModel } from "./playerCards";
import { buildReceiptPresentation } from "./receiptPresentation";
import { buildStoryTimeline, type StoryTimelineTick } from "./storyTimeline";
import {
  formatCount,
  formatLocalReportDate,
  formatParticipantTitle,
  formatReplyTime,
  formatSpanLabel,
  formatWordCountWithNovels,
} from "./reportPresentation";
import type { Award, PersonStats, ReportContent, ReportMode, ReportSessionData } from "./types";

export const PDF_PAGE_WIDTH = 1240;
export const PDF_PAGE_HEIGHT = 1754;

export interface PdfChapter {
  title: string;
  body: string;
}

export interface PdfDocumentData {
  report: ReportSessionData;
  modeLabel: string;
  storyLabel: string;
  accent: string;
  accentSoft: string;
  surface: string;
  names: string;
  span: string;
  dateRange: string;
  storyPages: PdfChapter[][];
  storyTimeline: StoryTimelineTick[];
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
  const storyPages = paginateChapters(chapters);

  return {
    report,
    modeLabel: report.mode === "roast" ? "Roast" : preset.label,
    storyLabel: preset.storyLabel,
    accent: preset.accent,
    accentSoft: preset.accentSoft,
    surface: preset.treatment === "soft" ? preset.surface : PAPER,
    names: formatParticipantTitle(report.stats.people),
    span: formatSpanLabel(report.stats.spanDays).replace(", in messages", ""),
    dateRange: `${formatLocalReportDate(report.stats.firstMessageDate.slice(0, 10))} - ${formatLocalReportDate(
      report.stats.lastMessageDate.slice(0, 10),
    )}`,
    storyPages,
    storyTimeline: buildStoryTimeline(storyPages.flat(), report.stats),
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
  pages.push(renderPage(createCanvas, (context) => drawNarrative(context, data)));
  pages.push(renderPage(createCanvas, (context) => drawMetrics(context, data)));
  pages.push(renderPage(createCanvas, (context) => drawAwards(context, data)));
  let pageNumber = 5;
  for (const [index, details] of data.detailPages.entries()) {
    pages.push(renderPage(createCanvas, (context) => drawDetailsPage(context, data, details, index, pageNumber)));
    pageNumber += 1;
  }
  for (const [index, chapters] of data.storyPages.entries()) {
    pages.push(renderPage(createCanvas, (context) => drawStory(context, data, chapters, index, pageNumber)));
    pageNumber += 1;
  }
  // Multi-person standings suit the group scoreboard and work teams alike —
  // work reports are mostly team/work-group chats, so they get it too.
  const LEADERBOARD_MODES: readonly ReportMode[] = ["group", "work"];
  if (LEADERBOARD_MODES.includes(report.mode) && (report.stats.isGroup || report.stats.people.length > 2)) {
    pages.push(renderPage(createCanvas, (context) => drawLeaderboard(context, data, pageNumber)));
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
  const stats = data.report.stats;

  context.fillStyle = data.accent;
  context.fillRect(0, 0, 28, PDF_PAGE_HEIGHT);
  context.fillRect(0, 1640, PDF_PAGE_WIDTH, 114);
  drawCoverMotif(context, data);

  drawHeader(context, data, "the keepsake edition", false);
  if (data.report.mode === "roast") {
    drawHazardTape(context, PAGE_MARGIN, 140, PDF_PAGE_WIDTH - PAGE_MARGIN * 2, 44);
  } else {
    context.strokeStyle = data.accent;
    context.lineWidth = 8;
    context.beginPath();
    context.moveTo(PAGE_MARGIN, 140);
    context.lineTo(PDF_PAGE_WIDTH - PAGE_MARGIN, 140);
    context.stroke();
  }

  context.save();
  context.globalAlpha = 1;
  context.fillStyle = data.accent;
  mono(context, 28, 700, 4);
  context.fillText(`${data.modeLabel.toUpperCase()} - THE LORES OF`, PAGE_MARGIN, 344);
  context.letterSpacing = "0px";

  context.fillStyle = INK;
  archivo(context, 132, 900);
  const namesBottom = drawTextBlock(context, data.names, PAGE_MARGIN, 404, 1076, 124, 3);

  context.fillStyle = MUTED;
  mono(context, 24, 700, 1);
  context.fillText(
    `${data.dateRange.toUpperCase()} - ${data.span.toUpperCase()}`,
    PAGE_MARGIN,
    namesBottom + 44,
  );
  context.restore();

  drawCoverStats(context, data, Math.max(930, namesBottom + 136));

  context.strokeStyle = data.accent;
  context.lineWidth = 4;
  context.beginPath();
  context.moveTo(PAGE_MARGIN, 1458);
  context.lineTo(PDF_PAGE_WIDTH - PAGE_MARGIN, 1458);
  context.stroke();
  context.fillStyle = data.accent;
  mono(context, 17, 700, 2);
  context.fillText("THE LINE THAT SUMS IT UP", PAGE_MARGIN, 1412);
  context.letterSpacing = "0px";
  context.save();
  context.globalAlpha = 1;
  context.fillStyle = INK;
  archivo(context, 34, 700);
  drawTextBlock(context, `“${data.report.content.heroLine}”`, PAGE_MARGIN, 1492, 1030, 44, 4);
  context.restore();
  context.fillStyle =
    data.report.mode === "group" || data.report.mode === "roast" ? PAPER : INK;
  mono(context, 18, 700, 2);
  context.fillText("KEEPSAKE EDITION", PAGE_MARGIN, 1680);
  context.textAlign = "right";
  context.fillText("01 - LORES.IN", PDF_PAGE_WIDTH - PAGE_MARGIN, 1680);
  context.textAlign = "left";
}

function drawCoverStats(
  context: CanvasRenderingContext2D,
  data: PdfDocumentData,
  y: number,
): void {
  const stats = data.report.stats;
  const items = [
    { label: "MESSAGES", value: formatCount(stats.totalMessages) },
    { label: "WORDS", value: formatCount(stats.totalWords) },
    { label: "DAY STREAK", value: formatCount(stats.longestStreakDays) },
  ];
  const width = PDF_PAGE_WIDTH - PAGE_MARGIN * 2;
  const columnWidth = width / items.length;
  const mode = data.report.mode;
  const soft = mode === "sweetheart" || mode === "family";
  const solid = mode === "ride-or-die" || mode === "group";
  const roast = mode === "roast";
  const panelFill = roast ? INK : solid ? data.accent : data.accentSoft;
  const valueColor = roast || mode === "group" ? PAPER : INK;
  const labelColor = roast ? data.accent : mode === "group" ? PAPER : solid ? INK : data.accent;
  const dividerColor = roast || mode === "group" ? "rgba(243,243,239,.45)" : data.accent;

  context.fillStyle = panelFill;
  if (soft) {
    context.beginPath();
    context.roundRect(PAGE_MARGIN, y, width, 230, mode === "sweetheart" ? 38 : 22);
    context.fill();
  } else {
    context.fillRect(PAGE_MARGIN, y, width, 230);
  }
  context.strokeStyle = data.accent;
  context.lineWidth = 5;
  if (soft) {
    context.beginPath();
    context.roundRect(PAGE_MARGIN, y, width, 230, mode === "sweetheart" ? 38 : 22);
    context.stroke();
  } else {
    context.strokeRect(PAGE_MARGIN, y, width, 230);
  }

  items.forEach((item, index) => {
    const x = PAGE_MARGIN + index * columnWidth;
    if (index > 0) {
      context.strokeStyle = dividerColor;
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(x, y + 28);
      context.lineTo(x, y + 202);
      context.stroke();
    }
    context.fillStyle = labelColor;
    mono(context, 19, 700, 2);
    context.fillText(item.label, x + 28, y + 36);
    context.letterSpacing = "0px";
    context.fillStyle = valueColor;
    fitAndDrawText(
      context,
      item.value,
      x + 28,
      y + 91,
      columnWidth - 56,
      68,
      42,
      900,
    );
  });
}

function drawCoverMotif(context: CanvasRenderingContext2D, data: PdfDocumentData): void {
  const mode = data.report.mode;
  context.save();
  context.globalAlpha = mode === "group" ? 0.075 : 0.07;
  context.fillStyle = data.accent;
  context.strokeStyle = data.accent;
  archivo(context, 620, 900);
  context.textAlign = "right";
  context.fillText("01", PDF_PAGE_WIDTH - 48, 170);
  context.textAlign = "left";
  context.lineWidth = 18;

  if (mode === "sweetheart") {
    drawHeartOutline(context, 905, 298, 225);
  } else if (mode === "ride-or-die") {
    for (let index = 0; index < 3; index += 1) {
      const x = 860 + index * 90;
      context.beginPath();
      context.moveTo(x, 280);
      context.lineTo(x - 100, 565);
      context.stroke();
    }
  } else if (mode === "group") {
    context.strokeRect(700, 250, 440, 330);
    context.beginPath();
    context.moveTo(700, 360);
    context.lineTo(1140, 360);
    context.moveTo(700, 470);
    context.lineTo(1140, 470);
    context.moveTo(920, 250);
    context.lineTo(920, 580);
    context.stroke();
  } else if (mode === "family") {
    context.beginPath();
    context.moveTo(770, 410);
    context.lineTo(940, 270);
    context.lineTo(1110, 410);
    context.lineTo(1110, 590);
    context.lineTo(770, 590);
    context.closePath();
    context.stroke();
  } else if (mode === "work") {
    context.lineWidth = 10;
    for (let x = 730; x <= 1130; x += 100) {
      context.beginPath();
      context.moveTo(x, 245);
      context.lineTo(x, 600);
      context.stroke();
    }
    for (let y = 300; y <= 600; y += 100) {
      context.beginPath();
      context.moveTo(680, y);
      context.lineTo(1140, y);
      context.stroke();
    }
  }
  context.restore();
  context.textAlign = "left";
}

function drawHeartOutline(
  context: CanvasRenderingContext2D,
  centerX: number,
  top: number,
  size: number,
): void {
  context.beginPath();
  context.moveTo(centerX, top + size * 0.28);
  context.bezierCurveTo(
    centerX - size * 0.5,
    top - size * 0.05,
    centerX - size * 0.58,
    top + size * 0.55,
    centerX,
    top + size,
  );
  context.bezierCurveTo(
    centerX + size * 0.58,
    top + size * 0.55,
    centerX + size * 0.5,
    top - size * 0.05,
    centerX,
    top + size * 0.28,
  );
  context.stroke();
}

function drawHazardTape(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  context.save();
  context.beginPath();
  context.rect(x, y, width, height);
  context.clip();
  context.fillStyle = "#e11400";
  context.fillRect(x, y, width, height);
  context.fillStyle = INK;
  const stripeWidth = 92;
  for (let stripeX = x - height; stripeX < x + width + height; stripeX += stripeWidth) {
    context.beginPath();
    context.moveTo(stripeX, y);
    context.lineTo(stripeX + stripeWidth / 2, y);
    context.lineTo(stripeX + stripeWidth / 2 - height, y + height);
    context.lineTo(stripeX - height, y + height);
    context.closePath();
    context.fill();
  }
  context.restore();
}

// Page 2: the full narrative prose, styled like the web report's
// "your story, in full" section. Prose the reader sits with: generous line
// spacing and a readable measure. Uses the existing content.narrative field.
function drawNarrative(context: CanvasRenderingContext2D, data: PdfDocumentData): void {
  fillPage(context, PAPER);
  drawSectionHeader(context, data, `01 - ${data.storyLabel}`);

  const roast = data.report.mode === "roast";
  if (roast) {
    drawHazardTape(context, PAGE_MARGIN, 148, PDF_PAGE_WIDTH - PAGE_MARGIN * 2, 38);
  }

  const contentWidth = PDF_PAGE_WIDTH - PAGE_MARGIN * 2;
  const proseWidth = 960; // readable measure, generous right margin

  // Title, big and black, matching the web narrative heading.
  context.fillStyle = INK;
  archivo(context, 58, 900);
  context.letterSpacing = "-1px";
  const titleBottom = drawTextBlock(
    context,
    data.report.content.title,
    PAGE_MARGIN,
    roast ? 262 : 224,
    contentWidth,
    62,
    3,
  );
  context.letterSpacing = "0px";

  // Narrative prose: line height ~1.6 for a generous, sit-with-it read.
  context.fillStyle = INK;
  archivo(context, 30, 500);
  const paragraphs = data.report.content.narrative
    .split(/\n+/u)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  let y = titleBottom + 60;
  for (const paragraph of paragraphs) {
    y = drawFullTextBlock(context, paragraph, PAGE_MARGIN, y, proseWidth, 48) + 28;
  }

  drawPageNumber(context, 2, data.accent, false);
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
  drawPageNumber(context, 3, data.accent, false);
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
    // Start higher and tighten the leading so a full 3-line verdict clears the
    // card's bottom edge (y + 226) with comfortable breathing room.
    drawTextBlock(context, line, x + 24, y + 150, 480, 23, 3);
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

  drawPageNumber(context, 4, data.accent, false);
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
    hasHighlights
      ? `04 - the receipts${data.detailPages.length > 1 ? ` - ${detailPageIndex + 1}` : ""}`
      : "04 - the people",
  );

  if (hasHighlights) {
    const gap = 26;
    const top = 188;
    const availableHeight = 1390;
    const cardHeight =
      details.highlights.length === 1
        ? availableHeight
        : (availableHeight - gap) / details.highlights.length;
    details.highlights.forEach((highlight, index) =>
      drawFullHighlight(
        context,
        data,
        highlight,
        precedingHighlightCount(data.detailPages, detailPageIndex) + index,
        top + index * (cardHeight + gap),
        cardHeight,
      ),
    );
    drawPageNumber(context, pageNumber, data.accent, false);
    return;
  }

  const columns = 2;
  const gapX = 28;
  const cardWidth = (PDF_PAGE_WIDTH - PAGE_MARGIN * 2 - gapX) / columns;
  const compact = details.people.length > 2;
  const cardHeight = compact ? 690 : 1_388;
  const rowGap = 26;
  const peopleTop = 178;
  const cardsByName = new Map(buildPlayerCards(data.report).map((card) => [card.personName, card]));
  details.people.forEach((person, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = PAGE_MARGIN + column * (cardWidth + gapX);
    const y = peopleTop + row * (cardHeight + rowGap);
    const card = cardsByName.get(person.name);
    if (card) drawPlayerCard(context, data, card, x, y, cardWidth, cardHeight, compact);
  });
  drawPageNumber(context, pageNumber, data.accent, false);
}

function drawPlayerCard(
  context: CanvasRenderingContext2D,
  data: PdfDocumentData,
  card: PlayerCardModel,
  x: number,
  y: number,
  width: number,
  height: number,
  compact: boolean,
): void {
  const headerHeight = compact ? 154 : 276;
  const padding = compact ? 20 : 28;
  const headerText = readableCanvasTextColor(data.accent);

  context.fillStyle = "#ffffff";
  context.strokeStyle = INK;
  context.lineWidth = 4;
  context.fillRect(x, y, width, height);
  context.strokeRect(x, y, width, height);
  context.fillStyle = data.accent;
  context.fillRect(x + 2, y + 2, width - 4, headerHeight - 2);

  if (card.watermarkEmoji) {
    context.save();
    context.beginPath();
    context.rect(x + 2, y + 2, width - 4, headerHeight - 2);
    context.clip();
    context.globalAlpha = 0.14;
    context.fillStyle = headerText;
    context.font = `${compact ? 132 : 224}px 'Segoe UI Emoji', Arial, sans-serif`;
    context.fillText(card.watermarkEmoji, x + width - (compact ? 144 : 238), y - (compact ? 26 : 42));
    context.restore();
  }

  context.fillStyle = headerText;
  mono(context, compact ? 13 : 17, 700, compact ? 1.5 : 2.5);
  context.globalAlpha = 0.76;
  context.fillText(card.role.toUpperCase(), x + padding, y + (compact ? 20 : 32));
  context.globalAlpha = 1;
  context.letterSpacing = "0px";
  fitAndDrawText(
    context,
    card.personName,
    x + padding,
    y + (compact ? 50 : 79),
    width - padding * 2,
    compact ? 37 : 54,
    compact ? 24 : 32,
    900,
  );
  mono(context, compact ? 12 : 16, 700, 0.4);
  context.globalAlpha = 0.82;
  context.fillText(card.summary.toUpperCase(), x + padding, y + (compact ? 111 : 205));
  context.globalAlpha = 1;
  context.letterSpacing = "0px";

  const signatureY = y + headerHeight + (compact ? 22 : 42);
  drawPlayerLabel(context, "TALKS LIKE", x + padding, signatureY, compact);
  drawSignatureWords(
    context,
    card.signatureWords,
    x + padding,
    signatureY + (compact ? 28 : 39),
    width - padding * 2,
    data.accent,
    compact,
  );

  const statY = y + (compact ? 276 : 548);
  const statHeight = compact ? 142 : 218;
  const statWidth = (width - padding * 2) / 3;
  context.strokeStyle = INK;
  context.lineWidth = 3;
  context.strokeRect(x + padding, statY, statWidth * 3, statHeight);
  card.stats.forEach((stat, index) => {
    const statX = x + padding + index * statWidth;
    if (index > 0) {
      context.beginPath();
      context.moveTo(statX, statY);
      context.lineTo(statX, statY + statHeight);
      context.stroke();
    }
    context.fillStyle = data.accent;
    fitAndDrawText(
      context,
      stat.value,
      statX + (compact ? 9 : 14),
      statY + (compact ? 18 : 30),
      statWidth - (compact ? 18 : 28),
      compact ? 29 : 43,
      compact ? 18 : 26,
      900,
    );
    context.fillStyle = MUTED;
    mono(context, compact ? 10 : 13, 700, 0.7);
    drawTextBlock(
      context,
      stat.label.toUpperCase(),
      statX + (compact ? 9 : 14),
      statY + (compact ? 79 : 116),
      statWidth - (compact ? 18 : 28),
      compact ? 15 : 20,
      2,
    );
  });
  context.letterSpacing = "0px";

  const secondaryY = y + (compact ? 443 : 824);
  card.secondary.forEach((item, index) => {
    const itemX = x + padding + index * ((width - padding * 2) / 2);
    drawPlayerLabel(context, item.label.toUpperCase(), itemX, secondaryY, compact);
    context.fillStyle = INK;
    if (index === 0 && card.watermarkEmoji) {
      context.font = `${compact ? 24 : 34}px 'Segoe UI Emoji', Arial, sans-serif`;
      context.fillText(card.watermarkEmoji, itemX, secondaryY + (compact ? 24 : 36));
      const emojiWidth = context.measureText(card.watermarkEmoji).width;
      archivo(context, compact ? 22 : 31, 800);
      const count = item.value.slice(card.watermarkEmoji.length).trim();
      context.fillText(count, itemX + emojiWidth + (compact ? 7 : 10), secondaryY + (compact ? 28 : 42));
    } else {
      fitAndDrawText(
        context,
        item.value,
        itemX,
        secondaryY + (compact ? 28 : 42),
        (width - padding * 2) / 2 - 10,
        compact ? 22 : 31,
        compact ? 15 : 20,
        800,
      );
    }
  });

  const verdictY = y + (compact ? 536 : 1_018);
  context.save();
  context.setLineDash([compact ? 7 : 10, compact ? 7 : 10]);
  context.strokeStyle = "rgba(10,10,10,.2)";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(x + padding, verdictY);
  context.lineTo(x + width - padding, verdictY);
  context.stroke();
  context.restore();
  drawPlayerLabel(context, "VERDICT", x + padding, verdictY + (compact ? 18 : 30), compact);
  context.fillStyle = INK;
  archivo(context, compact ? 17 : 25, 600);
  drawTextBlock(
    context,
    card.verdict,
    x + padding,
    verdictY + (compact ? 46 : 72),
    width - padding * 2,
    compact ? 23 : 34,
    compact ? 4 : 7,
  );
}

function drawPlayerLabel(
  context: CanvasRenderingContext2D,
  label: string,
  x: number,
  y: number,
  compact: boolean,
): void {
  context.fillStyle = MUTED;
  mono(context, compact ? 10 : 13, 700, compact ? 1.2 : 1.8);
  context.fillText(label, x, y);
  context.letterSpacing = "0px";
}

function drawSignatureWords(
  context: CanvasRenderingContext2D,
  words: readonly string[],
  x: number,
  y: number,
  maxWidth: number,
  accent: string,
  compact: boolean,
): void {
  archivo(context, compact ? 17 : 23, 700);
  const lineHeight = compact ? 24 : 34;
  let cursorX = x;
  let cursorY = y;
  words.forEach((word, index) => {
    const token = index === 0 ? word : ` · ${word}`;
    const tokenWidth = context.measureText(token).width;
    if (cursorX > x && cursorX + tokenWidth > x + maxWidth) {
      cursorX = x;
      cursorY += lineHeight;
    }
    context.fillStyle = index === 0 ? accent : INK;
    context.fillText(index > 0 && cursorX === x ? word : token, cursorX, cursorY);
    cursorX += context.measureText(index > 0 && cursorX === x ? word : token).width;
  });
}

function readableCanvasTextColor(background: string): string {
  const hex = background.replace("#", "");
  if (!/^[\da-f]{6}$/iu.test(hex)) return "#ffffff";
  const channels = [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const linear = channels.map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  const luminance = 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  return luminance > 0.179 ? INK : "#ffffff";
}

function drawFullHighlight(
  context: CanvasRenderingContext2D,
  data: PdfDocumentData,
  highlight: ReportContent["highlights"][number],
  receiptIndex: number,
  y: number,
  cardHeight: number,
): void {
  const x = PAGE_MARGIN;
  const cardWidth = PDF_PAGE_WIDTH - PAGE_MARGIN * 2;
  const compact = cardHeight < 900;
  const receipt = buildReceiptPresentation(highlight);
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

  const cardBottom = y + cardHeight - (compact ? 20 : 28);
  const statHeight = receipt.statLine ? (compact ? 64 : 98) : 0;
  const quoteHeight = receipt.pullQuote ? (compact ? 104 : 218) : 0;
  const footerGap = receipt.pullQuote ? (compact ? 14 : 24) : 0;
  const statTop = receipt.statLine
    ? cardBottom - statHeight - quoteHeight - footerGap
    : cardBottom - quoteHeight;
  const threadBottom = statTop - (compact ? 16 : 32);

  drawConversationSnippet(
    context,
    data,
    receipt.messages,
    x + (compact ? 24 : 32),
    bodyBottom + (compact ? 18 : 34),
    cardWidth - (compact ? 48 : 64),
    threadBottom,
    compact,
  );

  if (receipt.statLine) {
    drawReceiptStatStrip(context, data, receipt.statLine, x + 28, statTop, cardWidth - 56, statHeight, compact);
  }
  if (receipt.pullQuote) {
    drawReceiptPullQuote(
      context,
      data,
      receipt.pullQuote,
      x + 34,
      statTop + statHeight + footerGap,
      cardWidth - 68,
      quoteHeight,
      compact,
    );
  }
}

function drawConversationSnippet(
  context: CanvasRenderingContext2D,
  data: PdfDocumentData,
  messages: ReportContent["highlights"][number]["snippet"]["messages"],
  x: number,
  top: number,
  width: number,
  bottom: number,
  compact: boolean,
): void {
  if (messages.length === 0 || bottom <= top) return;
  let fontSize = compact ? 23 : 30;
  let lineHeight = compact ? 31 : 40;
  let bubbleGap = compact ? 16 : 26;
  let layouts = layoutSnippetMessages(context, messages, width, fontSize, lineHeight, bubbleGap, compact);
  while (layouts.totalHeight > bottom - top && fontSize > 11) {
    fontSize -= 1;
    lineHeight = fontSize + (compact ? 8 : 10);
    bubbleGap = Math.max(10, bubbleGap - 1);
    layouts = layoutSnippetMessages(context, messages, width, fontSize, lineHeight, bubbleGap, compact);
  }
  if (messages.length > 1 && layouts.totalHeight < bottom - top) {
    bubbleGap = Math.min(
      compact ? 32 : 58,
      bubbleGap + (bottom - top - layouts.totalHeight) / (messages.length - 1),
    );
    layouts = layoutSnippetMessages(context, messages, width, fontSize, lineHeight, bubbleGap, compact);
  }

  let y = top;
  const firstSender = messages[0]?.sender;
  for (const layout of layouts.items) {
    const outgoing = layout.message.sender !== firstSender;
    const horizontalPadding = compact ? 24 : 30;
    const bubbleWidth = Math.min(
      width * (compact ? 0.88 : 0.9),
      Math.max(width * (compact ? 0.52 : 0.56), layout.maxLineWidth + horizontalPadding * 2),
    );
    const bubbleX = outgoing ? x + width - bubbleWidth : x;
    context.fillStyle = outgoing ? data.accent : `${data.accent}18`;
    context.fillRect(bubbleX, y, bubbleWidth, layout.height);
    context.fillStyle = outgoing ? "rgba(255,255,255,.78)" : data.accent;
    mono(context, Math.max(12, fontSize - 8), 700, 0.5);
    context.fillText(layout.message.sender, bubbleX + horizontalPadding, y + (compact ? 14 : 18));
    context.textAlign = "right";
    context.fillText(
      formatSnippetTime(layout.message.timestamp),
      bubbleX + bubbleWidth - horizontalPadding,
      y + (compact ? 14 : 18),
    );
    context.textAlign = "left";
    context.letterSpacing = "0px";
    context.fillStyle = outgoing ? "#ffffff" : INK;
    archivo(context, fontSize, 600);
    layout.lines.forEach((line, lineIndex) =>
      context.fillText(
        line,
        bubbleX + horizontalPadding,
        y + (compact ? 44 : 56) + lineIndex * lineHeight,
      ),
    );
    y += layout.height + bubbleGap;
  }
}

function layoutSnippetMessages(
  context: CanvasRenderingContext2D,
  messages: ReportContent["highlights"][number]["snippet"]["messages"],
  width: number,
  fontSize: number,
  lineHeight: number,
  bubbleGap: number,
  compact: boolean,
) {
  archivo(context, fontSize, 600);
  const items = messages.map((message) => {
    const horizontalPadding = compact ? 24 : 30;
    const lines = wrapLines(
      context,
      message.text,
      width * (compact ? 0.88 : 0.9) - horizontalPadding * 2,
      Number.POSITIVE_INFINITY,
    );
    return {
      message,
      lines,
      maxLineWidth: Math.max(0, ...lines.map((line) => context.measureText(line).width)),
      height: (compact ? 62 : 78) + lines.length * lineHeight,
    };
  });
  return {
    items,
    totalHeight: items.reduce(
      (total, item, index) => total + item.height + (index < items.length - 1 ? bubbleGap : 0),
      0,
    ),
  };
}

function drawReceiptStatStrip(
  context: CanvasRenderingContext2D,
  data: PdfDocumentData,
  statLine: string,
  x: number,
  y: number,
  width: number,
  height: number,
  compact: boolean,
): void {
  context.fillStyle = `${data.accent}14`;
  context.fillRect(x, y, width, height);
  context.strokeStyle = data.accent;
  context.lineWidth = compact ? 2 : 3;
  context.beginPath();
  context.moveTo(x, y);
  context.lineTo(x + width, y);
  context.moveTo(x, y + height);
  context.lineTo(x + width, y + height);
  context.stroke();
  context.fillStyle = INK;
  mono(context, compact ? 13 : 19, 700, compact ? 0.5 : 1.2);
  context.textAlign = "center";
  fitAndDrawMonoText(context, statLine.toUpperCase(), x + width / 2, y + (compact ? 22 : 35), width - 32, compact ? 13 : 19, 10);
  context.textAlign = "left";
  context.letterSpacing = "0px";
}

function drawReceiptPullQuote(
  context: CanvasRenderingContext2D,
  data: PdfDocumentData,
  quote: string,
  x: number,
  y: number,
  width: number,
  height: number,
  compact: boolean,
): void {
  context.fillStyle = data.accent;
  archivo(context, compact ? 27 : 43, 900);
  drawTextBlock(
    context,
    `"${quote}"`,
    x,
    y + (compact ? 8 : 16),
    width,
    compact ? 31 : 49,
    compact ? 3 : Math.max(3, Math.floor((height - 20) / 49)),
  );
}

function formatSnippetTime(timestamp: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/u.exec(timestamp);
  return match ? `${match[3]}/${match[2]} ${match[4]}:${match[5]}` : timestamp;
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
  if (data.report.mode === "roast" && storyIndex === 0) {
    drawHazardTape(context, PAGE_MARGIN, 148, PDF_PAGE_WIDTH - PAGE_MARGIN * 2, 38);
  }
  const globalOffset = precedingChapterCount(data.storyPages, storyIndex);
  const ticks = data.storyTimeline.slice(globalOffset, globalOffset + chapters.length);
  const top = data.report.mode === "roast" && storyIndex === 0 ? 226 : 190;
  const bottom = 1_610;
  const spineX = 218;
  const contentX = 278;
  const contentWidth = PDF_PAGE_WIDTH - contentX - PAGE_MARGIN;
  const bandHeight = (bottom - top) / Math.max(1, chapters.length);
  const firstTickY = top + 22;
  const lastTickY = chapters.length === 1 ? bottom - 22 : top + (chapters.length - 1) * bandHeight + 22;

  context.strokeStyle = `${data.accent}70`;
  context.lineWidth = 5;
  context.beginPath();
  context.moveTo(spineX, chapters.length === 1 ? top : firstTickY);
  context.lineTo(spineX, chapters.length === 1 ? bottom : lastTickY);
  context.stroke();

  for (const [index, chapter] of chapters.entries()) {
    const tick = ticks[index] ?? fallbackStoryTick(globalOffset + index + 1);
    const bandTop = top + index * bandHeight;
    const tickY = bandTop + 22;
    const dense = chapters.length > 4;

    context.fillStyle = MUTED;
    mono(context, dense ? 13 : 16, 700, dense ? 0.8 : 1.2);
    context.textAlign = "right";
    context.fillText(tick.dateLabel.toUpperCase(), spineX - 28, tickY - (dense ? 7 : 9));
    context.textAlign = "left";
    context.letterSpacing = "0px";

    context.fillStyle = tick.isBusiestDay ? data.accent : PAPER;
    context.strokeStyle = data.accent;
    context.lineWidth = 4;
    context.beginPath();
    context.arc(spineX, tickY, tick.isBusiestDay ? 11 : 8, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.beginPath();
    context.moveTo(spineX + 10, tickY);
    context.lineTo(contentX - 14, tickY);
    context.stroke();

    context.fillStyle = data.accent;
    mono(context, dense ? 14 : 17, 700, dense ? 1.5 : 2.5);
    context.fillText(`CH. ${tick.chapterIndex}`, contentX, bandTop + 7);
    context.letterSpacing = "0px";

    if (tick.busiestDayLabel) {
      drawBusiestDayBadge(
        context,
        data,
        tick.busiestDayLabel,
        contentX + (dense ? 110 : 130),
        bandTop + 1,
        contentWidth - (dense ? 110 : 130),
        dense,
      );
    }

    const titleSize = dense ? 32 : 43;
    const titleLineHeight = dense ? 35 : 47;
    context.fillStyle = INK;
    archivo(context, titleSize, 900);
    const titleBottom = drawTextBlock(
      context,
      chapter.title || "Untitled chapter",
      contentX,
      bandTop + (dense ? 38 : 43),
      contentWidth,
      titleLineHeight,
      2,
    );
    const bodySize = dense ? 19 : 24;
    const bodyLineHeight = dense ? 26 : 33;
    const bodyTop = titleBottom + (dense ? 7 : 11);
    const bandBottom = bandTop + bandHeight - 16;
    const maxBodyLines = Math.max(1, Math.floor((bandBottom - bodyTop) / bodyLineHeight));
    context.fillStyle = INK;
    archivo(context, bodySize, 500);
    drawTextBlock(
      context,
      chapter.body || "No chapter text available.",
      contentX,
      bodyTop,
      contentWidth,
      bodyLineHeight,
      maxBodyLines,
    );
  }
  drawPageNumber(context, pageNumber, data.accent, false);
}

function drawBusiestDayBadge(
  context: CanvasRenderingContext2D,
  data: PdfDocumentData,
  label: string,
  x: number,
  y: number,
  width: number,
  dense: boolean,
): void {
  const height = dense ? 30 : 34;
  const badgeWidth = Math.min(width, dense ? 340 : 390);
  context.fillStyle = `${data.accent}18`;
  context.fillRect(x, y, badgeWidth, height);
  context.fillStyle = data.accent;
  mono(context, dense ? 11 : 13, 700, 0.5);
  fitAndDrawMonoText(
    context,
    label.toUpperCase(),
    x + 10,
    y + (dense ? 8 : 9),
    badgeWidth - 20,
    dense ? 11 : 13,
    9,
  );
  context.letterSpacing = "0px";
}

function fallbackStoryTick(chapterIndex: number): StoryTimelineTick {
  return {
    chapterIndex,
    date: null,
    dateLabel: "Date unknown",
    isBusiestDay: chapterIndex === 1,
    busiestDayLabel: chapterIndex === 1 ? "date unknown · 0 msgs" : null,
  };
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
  drawClosingPageNumber(context, pageNumber);
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
    if (current.length > 0 && (current.length >= 6 || weight + chapterWeight > 1_350)) {
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
    pages.push({
      highlights: [highlight],
      people: [],
    });
  }
  for (let personIndex = 0; personIndex < people.length; personIndex += 4) {
    pages.push({ highlights: [], people: people.slice(personIndex, personIndex + 4) });
  }

  return pages;
}

function receiptLayoutWeight(highlight: ReportContent["highlights"][number]): number {
  return (
    highlight.body.length +
    highlight.snippet.messages.reduce((total, message) => total + message.text.length, 0) +
    highlight.snippet.messages.length * 75
  );
}

function precedingHighlightCount(
  pages: readonly PdfDocumentData["detailPages"][number][],
  pageIndex: number,
): number {
  return pages
    .slice(0, pageIndex)
    .reduce((total, page) => total + page.highlights.length, 0);
}

function fillPage(context: CanvasRenderingContext2D, color: string): void {
  context.clearRect(0, 0, PDF_PAGE_WIDTH, PDF_PAGE_HEIGHT);
  context.fillStyle = color;
  context.fillRect(0, 0, PDF_PAGE_WIDTH, PDF_PAGE_HEIGHT);
  context.textBaseline = "top";
  context.textAlign = "left";
}

function drawLogo(context: CanvasRenderingContext2D, x: number, y: number, accent: string, dark: boolean): void {
  archivo(context, 46, 900);
  const width = context.measureText("lores").width;
  const underscoreWidth = context.measureText("_").width;
  if (dark) {
    context.fillStyle = PAPER;
    context.fillRect(x - 12, y - 8, width + underscoreWidth + 24, 66);
  }
  context.fillStyle = INK;
  context.fillText("lores", x, y);
  context.fillStyle = accent;
  context.fillText("_", x + width, y);
}

function drawPageNumber(context: CanvasRenderingContext2D, page: number, accent: string, dark: boolean): void {
  mono(context, 17, 400);
  const prefix = `${String(page).padStart(2, "0")} - `;
  const brand = "lores";
  const prefixWidth = context.measureText(prefix).width;
  const brandWidth = context.measureText(brand).width;
  const underscoreWidth = context.measureText("_").width;
  const startX = PDF_PAGE_WIDTH - PAGE_MARGIN - prefixWidth - brandWidth - underscoreWidth;
  if (dark) {
    context.fillStyle = PAPER;
    context.fillRect(startX - 10, 1669, prefixWidth + brandWidth + underscoreWidth + 20, 38);
  }
  context.textAlign = "left";
  context.fillStyle = dark ? "rgba(10,10,10,.55)" : MUTED;
  context.fillText(prefix, startX, 1680);
  context.fillStyle = INK;
  context.fillText(brand, startX + prefixWidth, 1680);
  context.fillStyle = accent;
  context.fillText("_", startX + prefixWidth + brandWidth, 1680);
}

function drawClosingPageNumber(context: CanvasRenderingContext2D, page: number): void {
  context.fillStyle = "rgba(243,243,239,.42)";
  mono(context, 17, 400);
  context.textAlign = "right";
  context.fillText(String(page).padStart(2, "0"), PDF_PAGE_WIDTH - PAGE_MARGIN, 1680);
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

function fitAndDrawMonoText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  maxSize: number,
  minSize: number,
): void {
  let size = maxSize;
  mono(context, size, 700);
  while (size > minSize && context.measureText(text).width > maxWidth) {
    size -= 1;
    mono(context, size, 700);
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

interface LeaderboardCategoryDef {
  id: string;
  title: string;
  emoji: string;
  unitLabel: string;
  direction: "asc" | "desc";
  eligible?: (person: PersonStats) => boolean;
  score: (person: PersonStats) => number;
  format: (person: PersonStats) => string;
}

const LEADERBOARD_CATEGORIES: readonly LeaderboardCategoryDef[] = [
  {
    id: "yap-rank",
    title: "YAP RANK",
    emoji: "🗣️",
    unitLabel: "BY TOTAL MESSAGES",
    direction: "desc",
    score: (person) => person.messageCount,
    format: (person) => `${formatCount(person.messageCount)} msgs`,
  },
  {
    id: "fastest-trigger",
    title: "FASTEST TRIGGER",
    emoji: "⚡",
    unitLabel: "BY MEDIAN REPLY",
    direction: "asc",
    eligible: (person) => person.replyCount > 0,
    score: (person) => person.medianReplyTimeMin,
    format: (person) => formatReplyTime(person.medianReplyTimeMin, person.replyCount),
  },
  {
    id: "night-shift",
    title: "NIGHT SHIFT",
    emoji: "🌙",
    unitLabel: "BY 00-04H MESSAGES",
    direction: "desc",
    score: (person) => person.lateNightCount,
    format: (person) => `${formatCount(person.lateNightCount)} msgs`,
  },
  {
    id: "ghost-rating",
    title: "GHOST RATING",
    emoji: "👻",
    unitLabel: "BY 24H+ SILENCES",
    direction: "desc",
    score: (person) => person.ghostStreakCount,
    format: (person) => `${formatCount(person.ghostStreakCount)} streaks`,
  },
  {
    id: "void-screamer",
    title: "VOID SCREAMER",
    emoji: "📢",
    unitLabel: "BY UNANSWERED STARTS",
    direction: "desc",
    score: (person) => person.soloRate,
    format: (person) => `${Math.round(person.soloRate * 100)}% solo`,
  },
  {
    id: "thread-killer",
    title: "THREAD KILLER",
    emoji: "🛑",
    unitLabel: "BY SESSIONS ENDED",
    direction: "desc",
    score: (person) => person.threadKillerCount,
    format: (person) => `${formatCount(person.threadKillerCount)} ended`,
  },
  {
    id: "conversation-starter",
    title: "CONVO STARTER",
    emoji: "🚀",
    unitLabel: "BY SESSIONS OPENED",
    direction: "desc",
    score: (person) => person.conversationStartCount,
    format: (person) => `${formatCount(person.conversationStartCount)} starts`,
  },
  {
    id: "emoji-economy",
    title: "EMOJI ECONOMY",
    emoji: "😍",
    unitLabel: "BY EMOJIS PER MSG",
    direction: "desc",
    score: (person) => person.emojisPerMessage,
    format: (person) => `${person.emojisPerMessage.toFixed(1)} / msg`,
  },
];

function selectLeaderboardCategories(people: readonly PersonStats[]): Array<{
  category: LeaderboardCategoryDef;
  rankings: Array<{ person: PersonStats; rank: number; formatted: string }>;
  spread: number;
}> {
  const evaluated: Array<{
    category: LeaderboardCategoryDef;
    rankings: Array<{ person: PersonStats; rank: number; formatted: string }>;
    spread: number;
  }> = [];

  for (const cat of LEADERBOARD_CATEGORIES) {
    const candidates = people.filter((person) => cat.eligible?.(person) ?? true);
    if (candidates.length < 2) continue;

    const values = candidates.map((person) => cat.score(person));
    const maxValue = Math.max(...values);
    const minValue = Math.min(...values);
    const uniqueValues = new Set(values);

    if (maxValue === 0 || uniqueValues.size < 2) continue;

    const sorted = [...candidates].sort((left, right) => {
      const diff = cat.score(left) - cat.score(right);
      return cat.direction === "desc" ? -diff : diff;
    });

    const rankings = sorted.map((person, index) => ({
      person,
      rank: index + 1,
      formatted: cat.format(person),
    }));

    const spreadScore = ((maxValue - minValue) / Math.max(1, maxValue)) * (uniqueValues.size - 1);
    evaluated.push({ category: cat, rankings, spread: spreadScore });
  }

  evaluated.sort((left, right) => right.spread - left.spread);
  const count = evaluated.length >= 6 ? 6 : evaluated.length >= 4 ? 4 : evaluated.length >= 2 ? evaluated.length : 0;
  return evaluated.slice(0, count);
}

function drawLeaderboard(
  context: CanvasRenderingContext2D,
  data: PdfDocumentData,
  pageNumber: number,
): void {
  fillPage(context, PAPER);
  drawSectionHeader(context, data, "06 - the standings");

  const categories = selectLeaderboardCategories(data.report.stats.people);
  const top = 180;

  context.fillStyle = INK;
  archivo(context, 44, 900);
  context.fillText("group standings", PAGE_MARGIN, top);

  context.fillStyle = MUTED;
  mono(context, 16, 700, 1);
  context.fillText("HEAD-TO-HEAD RANKINGS ACROSS THE GROUP", PAGE_MARGIN, top + 48);
  context.letterSpacing = "0px";

  if (categories.length === 0) {
    drawPageNumber(context, pageNumber, data.accent, false);
    return;
  }

  const gridTop = top + 80;
  const bottom = 1630;
  const totalGridHeight = bottom - gridTop;

  const columns = 2;
  const gapX = 28;
  const cardWidth = (PDF_PAGE_WIDTH - PAGE_MARGIN * 2 - gapX) / columns;
  const rows = Math.ceil(categories.length / columns);
  const gapY = rows === 3 ? 20 : 28;
  const cardHeight = (totalGridHeight - (rows - 1) * gapY) / rows;

  categories.forEach((item, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    const x = PAGE_MARGIN + col * (cardWidth + gapX);
    const y = gridTop + row * (cardHeight + gapY);

    drawLeaderboardCard(context, data, item.category, item.rankings, x, y, cardWidth, cardHeight);
  });

  drawPageNumber(context, pageNumber, data.accent, false);
}

function drawLeaderboardCard(
  context: CanvasRenderingContext2D,
  data: PdfDocumentData,
  category: LeaderboardCategoryDef,
  rankings: Array<{ person: PersonStats; rank: number; formatted: string }>,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  const headerHeight = 52;
  const headerText = "#ffffff";

  // Card background & outline
  context.fillStyle = "#ffffff";
  context.strokeStyle = INK;
  context.lineWidth = 4;
  context.fillRect(x, y, width, height);
  context.strokeRect(x, y, width, height);

  // Category Header bar in cobalt/accent
  context.fillStyle = data.accent;
  context.fillRect(x + 2, y + 2, width - 4, headerHeight);

  // Category Title
  context.fillStyle = headerText;
  archivo(context, 20, 900);
  fitAndDrawText(
    context,
    `${category.emoji}  ${category.title}`,
    x + 16,
    y + 14,
    width - 190,
    20,
    16,
    900,
  );

  // Category Unit / Subhead
  context.fillStyle = "rgba(255, 255, 255, 0.85)";
  mono(context, 11, 700, 0.5);
  context.textAlign = "right";
  context.fillText(category.unitLabel, x + width - 16, y + 20);
  context.textAlign = "left";
  context.letterSpacing = "0px";

  // Standings rows
  const visibleRankings = rankings.slice(0, 8);
  const rowCount = visibleRankings.length;
  const bodyHeight = height - headerHeight - 8;
  const rowHeight = Math.min(48, Math.max(34, (bodyHeight - 12) / rowCount));
  const rowStartTop = y + headerHeight + 6;

  visibleRankings.forEach((entry, idx) => {
    const rowY = rowStartTop + idx * rowHeight;
    const isWinner = entry.rank === 1;

    if (isWinner) {
      context.fillStyle = `${data.accent}12`;
      context.fillRect(x + 3, rowY, width - 6, rowHeight - 2);
    }

    // Rank indicator
    if (isWinner) {
      context.fillStyle = data.accent;
      const pillWidth = 32;
      const pillHeight = 24;
      const pillY = rowY + (rowHeight - pillHeight) / 2;
      context.fillRect(x + 14, pillY, pillWidth, pillHeight);
      context.fillStyle = headerText;
      mono(context, 13, 700);
      context.textAlign = "center";
      context.fillText("#1", x + 14 + pillWidth / 2, pillY + 4);
      context.textAlign = "left";
    } else {
      context.fillStyle = MUTED;
      mono(context, 13, 700);
      context.fillText(`#${entry.rank}`, x + 18, rowY + (rowHeight - 16) / 2 + 1);
    }

    // Person name
    context.fillStyle = isWinner ? INK : "rgba(10,10,10,.85)";
    archivo(context, isWinner ? 18 : 16, isWinner ? 800 : 600);
    fitAndDrawText(
      context,
      entry.person.name,
      x + 58,
      rowY + (rowHeight - (isWinner ? 20 : 18)) / 2 + 1,
      width - 240,
      isWinner ? 18 : 16,
      13,
      isWinner ? 800 : 600,
    );

    // Formatted stat value
    context.fillStyle = isWinner ? data.accent : MUTED;
    mono(context, isWinner ? 14 : 13, 700);
    context.textAlign = "right";
    context.fillText(
      entry.formatted,
      x + width - 16,
      rowY + (rowHeight - 16) / 2 + 1,
    );
    context.textAlign = "left";

    // Divider line
    if (idx < rowCount - 1) {
      context.strokeStyle = "rgba(10,10,10,.07)";
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(x + 14, rowY + rowHeight - 1);
      context.lineTo(x + width - 14, rowY + rowHeight - 1);
      context.stroke();
    }
  });
}
