'use strict';

const BRAND = require('./brand');

const E = () => BRAND.emm;

function contentBottom() {
  return BRAND.bodyContentMaxY;
}

function ml() {
  return BRAND.page.marginLeft;
}

function cw() {
  return BRAND.contentWidth;
}

function ensureRoom(doc, minHeight) {
  const bottom = contentBottom();
  if (doc.y + minHeight > bottom) {
    doc.addPage();
    doc.x = ml();
    doc.y = BRAND.page.marginTop;
  }
}

/** PDFKit advances `doc.y` after `text()` — only add extra spacing here, never add `heightOfString` again. */
function flowParagraph(doc, text) {
  const t = String(text || '').trim();
  if (!t) return;
  const w = cw();
  const lg = E().lineGap;
  const font = BRAND.font.regular;
  const size = BRAND.size.body;
  const oneLine = doc.heightOfString('Mg', { font, size, width: w, lineGap: lg });
  ensureRoom(doc, oneLine + 4);
  doc.font(font).fontSize(size).fillColor(BRAND.color.dark);
  doc.text(t, ml(), doc.y, { width: w, lineBreak: true, lineGap: lg });
  doc.y += BRAND.space.afterPara;
}

function flowSection(doc, title) {
  const label = String(title).toUpperCase();
  const w = cw();
  const lg = E().lineGap;
  const font = BRAND.font.mono;
  const size = E().sectionTitleSize;
  doc.y += E().sectionInsetTop;
  doc.font(font).fontSize(size).fillColor(BRAND.color.navy);
  doc.text(label, ml(), doc.y, { width: w, lineBreak: true, lineGap: lg });
  // Rule Y must follow PDFKit’s post-text cursor — heightOfString often overshoots and
  // pushes every section’s body down (wrong spacing document-wide).
  const ruleY = doc.y + E().ruleGapBelowHeading;
  doc
    .moveTo(ml(), ruleY)
    .lineTo(ml() + w, ruleY)
    .lineWidth(3)
    .strokeColor(BRAND.color.pink)
    .stroke();
  doc.y = ruleY + E().afterSectionRule;
}

function flowAssetLinks(doc, links) {
  const w = cw();
  const li = (links && links.linkedin) || '#';
  const em = (links && links.email) || '#';
  const lg = E().lineGap;

  doc.y += E().afterPreparedBand;
  ensureRoom(doc, 24);

  function oneLine(prefix, url) {
    ensureRoom(doc, 22);
    doc.font(BRAND.font.bold).fontSize(BRAND.size.body).fillColor(BRAND.color.orange);
    doc.text(prefix, ml(), doc.y, { continued: true, lineBreak: false });
    doc.font(BRAND.font.regular).fillColor(BRAND.color.pink);
    doc.text('View Here', { underline: true, link: url, width: w, lineBreak: true, lineGap: lg });
    doc.y += E().afterAssetLine;
  }

  oneLine('[A] LinkedIn Posts — ', li);
  oneLine('[B] Email Nurture Sequence — ', em);
  doc.y += E().afterAssetBlock - E().afterAssetLine;
}

function normalizeExecSummary(es) {
  if (!es) return [];
  if (Array.isArray(es)) {
    return es.map((x) => String(x || '').trim()).filter(Boolean);
  }
  if (typeof es === 'object') {
    if (Array.isArray(es.paragraphs)) {
      return es.paragraphs.map((x) => String(x || '').trim()).filter(Boolean);
    }
    const parts = [];
    if (es.opening) parts.push(String(es.opening).trim());
    const gap = [es.gapOpening, es.gapDetails, es.gapBook, es.gapClosing].filter(Boolean).join(' ').trim();
    if (gap) parts.push(gap);
    return parts.filter(Boolean);
  }
  return [String(es)];
}

function normalizeWorkItems(items) {
  if (!items || !Array.isArray(items)) return [];
  return items
    .map((it) => {
      if (typeof it === 'string') return it.trim();
      if (it && typeof it.description === 'string') return it.description.trim();
      if (it && typeof it.text === 'string') return it.text.trim();
      return '';
    })
    .filter(Boolean);
}

function normalizeStateRows(rows) {
  if (!rows || !Array.isArray(rows)) return [];
  return rows
    .map((r) => {
      if (!r) return null;
      if (typeof r === 'string') return null;
      const signal = r.signal != null ? String(r.signal) : '';
      const status = r.status != null ? String(r.status) : '';
      if (!signal && !status) return null;
      return { signal, status };
    })
    .filter(Boolean);
}

function normalizeJourney(rows) {
  if (!rows || !Array.isArray(rows)) return [];
  return rows
    .map((r) => {
      if (!r || typeof r !== 'object') return null;
      return {
        from: String(r.from || ''),
        gap: String(r.gap || ''),
        to: String(r.to || ''),
      };
    })
    .filter((r) => r.from || r.gap || r.to);
}

function measureRowHeight(
  doc,
  texts,
  colWidths,
  padX,
  padY,
  fonts,
  sizes,
  minTotal = 0,
  lineGap = null,
  opts = {}
) {
  const lg = lineGap != null ? lineGap : E().lineGap;
  const lineBreak = opts.lineBreak !== false;
  let maxH = 0;
  texts.forEach((text, i) => {
    const tw = colWidths[i] - padX * 2;
    const h = doc.heightOfString(String(text || ''), {
      font: fonts[i],
      size: sizes[i],
      width: Math.max(1, tw),
      lineGap: lg,
      lineBreak,
    });
    if (h > maxH) maxH = h;
  });
  return Math.max(maxH + padY * 2, minTotal);
}

function strokeRowFrame(doc, x, y, colWidths, rowH) {
  const totalW = colWidths.reduce((a, b) => a + b, 0);
  doc
    .rect(x, y, totalW, rowH)
    .lineWidth(0.5)
    .strokeColor(BRAND.color.grey)
    .stroke();
  let cx = x;
  for (let i = 0; i < colWidths.length - 1; i++) {
    cx += colWidths[i];
    doc.moveTo(cx, y).lineTo(cx, y + rowH).lineWidth(0.5).strokeColor(BRAND.color.grey).stroke();
  }
}

function drawSignalTable(doc, rows) {
  const startX = ml();
  const totalW = cw();
  const colW = [totalW * 0.36, totalW * 0.64];
  const headers = ['SIGNAL', 'STATUS'];
  const padX = E().tableCellPadX;
  const bodyPadY = E().tableCellPadY;
  const headerPadY = E().tableHeaderPadY;
  const headerSize = E().tableHeaderFontSize;
  const bodySize = BRAND.size.tableBody;
  const dataRows = normalizeStateRows(rows);

  const headerFonts = [BRAND.font.bold, BRAND.font.bold];
  const headerSizes = [headerSize, headerSize];
  const headerH = measureRowHeight(
    doc,
    headers,
    colW,
    padX,
    headerPadY,
    headerFonts,
    headerSizes,
    E().tableHeaderMinHeight,
    E().tableHeaderLineGap
  );

  const bodyFonts = [BRAND.font.bold, BRAND.font.regular];
  const bodySizes = [bodySize, bodySize];
  ensureRoom(doc, headerH + 16);

  let y = doc.y;

  function drawHeaderRow(yy) {
    let cx = startX;
    headers.forEach((h, i) => {
      doc.rect(cx, yy, colW[i], headerH).fill(BRAND.color.navy);
      doc
        .font(headerFonts[i])
        .fontSize(headerSizes[i])
        .fillColor(BRAND.color.white)
        .text(h, cx + padX, yy + headerPadY, {
          width: colW[i] - padX * 2,
          lineBreak: true,
          lineGap: E().tableHeaderLineGap,
        });
      cx += colW[i];
    });
    strokeRowFrame(doc, startX, yy, colW, headerH);
    return yy + headerH;
  }

  y = drawHeaderRow(y);

  dataRows.forEach((row, rowIdx) => {
    const texts = [row.signal, row.status];
    const rowH = measureRowHeight(doc, texts, colW, padX, bodyPadY, bodyFonts, bodySizes, 0);
    if (y + rowH > contentBottom()) {
      doc.addPage();
      doc.x = ml();
      doc.y = BRAND.page.marginTop;
      y = doc.y;
      y = drawHeaderRow(y);
    }
    const rowBg = rowIdx % 2 === 0 ? BRAND.color.white : BRAND.color.light;
    doc.rect(startX, y, colW[0] + colW[1], rowH).fill(rowBg);
    let cx = startX;
    texts.forEach((text, i) => {
      doc
        .font(bodyFonts[i])
        .fontSize(bodySizes[i])
        .fillColor(BRAND.color.dark)
        .text(text, cx + padX, y + bodyPadY, {
          width: colW[i] - padX * 2,
          lineBreak: true,
          lineGap: E().lineGap,
        });
      cx += colW[i];
    });
    strokeRowFrame(doc, startX, y, colW, rowH);
    y += rowH;
  });

  doc.x = startX;
  doc.y = y + BRAND.space.afterTable;
}

function drawJourneyTable(doc, rows) {
  const startX = ml();
  const totalW = cw();
  const wcol = totalW / 3;
  const colW = [wcol, wcol, wcol];
  const headers = ['WHERE YOU ARE', 'THE GAP', "WHERE YOU'RE GOING"];
  const fills = [BRAND.color.navy, BRAND.color.pink, BRAND.color.orange];
  const padX = E().tableCellPadX;
  const bodyPadY = E().journeyTableCellPadY;
  const headerPadY = E().tableHeaderPadY;
  const bodySize = BRAND.size.tableBody;
  const dataRows = normalizeJourney(rows);

  const jHead = E().journeyHeaderFontSize;
  const hFonts = [BRAND.font.bold, BRAND.font.bold, BRAND.font.bold];
  const hSizes = [jHead, jHead, jHead];
  const headerH = measureRowHeight(
    doc,
    headers,
    colW,
    padX,
    headerPadY,
    hFonts,
    hSizes,
    E().tableHeaderMinHeight,
    E().tableHeaderLineGap,
    { lineBreak: false }
  );

  const bSizes = [bodySize, bodySize, bodySize];
  const bFontsRow = [BRAND.font.regular, BRAND.font.italic, BRAND.font.bold];

  function bodyRowHeight(row) {
    const texts = [row.from, row.gap, row.to];
    return measureRowHeight(doc, texts, colW, padX, bodyPadY, bFontsRow, bSizes, 0);
  }

  const hRow0 = dataRows.length ? bodyRowHeight(dataRows[0]) : 0;
  const hRow1 = dataRows.length > 1 ? bodyRowHeight(dataRows[1]) : hRow0;
  const minTableStart = headerH + hRow0 + hRow1;

  if (doc.y + minTableStart > contentBottom()) {
    doc.addPage();
    doc.x = ml();
    doc.y = BRAND.page.marginTop;
  }

  let y = doc.y;

  function drawHeaderRow(yy) {
    let cx = startX;
    headers.forEach((h, i) => {
      doc.rect(cx, yy, colW[i], headerH).fill(fills[i]);
      doc
        .font(hFonts[i])
        .fontSize(hSizes[i])
        .fillColor(BRAND.color.white)
        .text(h, cx + padX, yy + headerPadY, {
          width: colW[i] - padX * 2,
          lineBreak: false,
          lineGap: E().tableHeaderLineGap,
        });
      cx += colW[i];
    });
    strokeRowFrame(doc, startX, yy, colW, headerH);
    return yy + headerH;
  }

  y = drawHeaderRow(y);

  dataRows.forEach((row, rowIdx) => {
    const texts = [row.from, row.gap, row.to];
    const rowH = measureRowHeight(doc, texts, colW, padX, bodyPadY, bFontsRow, bSizes, 0);
    if (y + rowH > contentBottom()) {
      doc.addPage();
      doc.x = ml();
      doc.y = BRAND.page.marginTop;
      y = doc.y;
      // Journey map: do not repeat column headers on continuation pages.
    }
    const rowBg = rowIdx % 2 === 0 ? BRAND.color.white : BRAND.color.light;
    doc.rect(startX, y, totalW, rowH).fill(rowBg);
    let cx = startX;
    texts.forEach((text, i) => {
      doc
        .font(bFontsRow[i])
        .fontSize(bSizes[i])
        .fillColor(BRAND.color.dark)
        .text(text, cx + padX, y + bodyPadY, {
          width: colW[i] - padX * 2,
          lineBreak: true,
          lineGap: E().lineGap,
        });
      cx += colW[i];
    });
    strokeRowFrame(doc, startX, y, colW, rowH);
    y += rowH;
  });

  doc.x = startX;
  doc.y = y + BRAND.space.afterTable;
}

function drawObservationCallout(doc, obs) {
  const lead = obs && obs.lead != null ? String(obs.lead) : '';
  const body = obs && obs.body != null ? String(obs.body) : '';
  if (!lead && !body) return;

  const w = cw();
  const bar = E().calloutBarWidth;
  const pad = E().calloutPadX;
  const innerW = w - bar - pad * 2;
  const lg = E().lineGap;
  let textH = 0;
  if (lead && body) {
    textH =
      doc.heightOfString(lead, { font: BRAND.font.bold, size: BRAND.size.body, width: innerW, lineGap: lg }) +
      E().calloutInteriorGap +
      doc.heightOfString(body, { font: BRAND.font.regular, size: BRAND.size.body, width: innerW, lineGap: lg });
  } else {
    textH = doc.heightOfString(lead || body, {
      font: BRAND.font.regular,
      size: BRAND.size.body,
      width: innerW,
      lineGap: lg,
    });
  }
  const boxH = textH + E().calloutPadY * 2;
  ensureRoom(doc, boxH + 16);

  const boxX = ml();
  const y0 = doc.y;
  doc.rect(boxX, y0, w, boxH).fill(BRAND.color.pinkTint);
  doc.rect(boxX, y0, bar, boxH).fill(BRAND.color.pink);

  let ty = y0 + E().calloutPadY;
  const tx = boxX + bar + pad;
  if (lead && body) {
    doc.font(BRAND.font.bold).fontSize(BRAND.size.body).fillColor(BRAND.color.pink);
    doc.text(lead, tx, ty, { width: innerW, lineBreak: true, lineGap: lg });
    ty =
      ty +
      doc.heightOfString(lead, {
        font: BRAND.font.bold,
        size: BRAND.size.body,
        width: innerW,
        lineGap: lg,
      }) +
      E().calloutInteriorGap;
    doc.font(BRAND.font.regular).fillColor(BRAND.color.dark);
    doc.text(body, tx, ty, { width: innerW, lineBreak: true, lineGap: lg });
  } else {
    doc.font(BRAND.font.regular).fontSize(BRAND.size.body).fillColor(BRAND.color.dark);
    doc.text(lead || body, tx, ty, { width: innerW, lineBreak: true, lineGap: lg });
  }

  doc.y = y0 + boxH + BRAND.space.afterPara;
}

function drawCtaCallout(doc, cta) {
  if (!cta || typeof cta !== 'object') return;
  const line1 = cta.line1 != null ? String(cta.line1) : '';
  const line2 = cta.line2 != null ? String(cta.line2) : '';
  const email = cta.email != null ? String(cta.email) : '';
  const w = cw();
  const bar = E().calloutBarWidth;
  const pad = E().calloutPadX;
  const innerW = w - bar - pad * 2;
  const lg = E().lineGap;
  const blocks = [
    { text: line1, font: BRAND.font.regular },
    { text: line2, font: BRAND.font.regular },
    { text: email, font: BRAND.font.bold },
  ].filter((b) => b.text);

  let textH = 0;
  blocks.forEach((b, i) => {
    textH += doc.heightOfString(b.text, { font: b.font, size: BRAND.size.body, width: innerW, lineGap: lg });
    if (i < blocks.length - 1) textH += E().calloutInteriorGap;
  });
  const boxH = textH + E().calloutPadY * 2;
  ensureRoom(doc, boxH + 16);

  const boxX = ml();
  const y0 = doc.y;
  doc.rect(boxX, y0, w, boxH).fill(BRAND.color.orangeTint);
  doc.rect(boxX, y0, bar, boxH).fill(BRAND.color.orange);

  let ty = y0 + E().calloutPadY;
  const tx = boxX + bar + pad;
  blocks.forEach((b, i) => {
    const isEmail = b.font === BRAND.font.bold;
    doc.font(b.font).fontSize(BRAND.size.body).fillColor(isEmail ? BRAND.color.navy : BRAND.color.dark);
    doc.text(b.text, tx, ty, { width: innerW, lineBreak: true, lineGap: lg });
    ty +=
      doc.heightOfString(b.text, { font: b.font, size: BRAND.size.body, width: innerW, lineGap: lg }) +
      (i < blocks.length - 1 ? E().calloutInteriorGap : 0);
  });

  doc.y = y0 + boxH + BRAND.space.afterPara;
}

function flowProposal(doc, index, rawText) {
  let t = String(rawText || '').replace(/^\s+/, '');
  t = t.replace(/^\d+\.\s*/, '');
  const prefix = `${index}. `;
  const w = cw();
  const lg = E().lineGap;
  const oneLine = doc.heightOfString('Mg', { font: BRAND.font.regular, size: BRAND.size.body, width: w, lineGap: lg });
  ensureRoom(doc, oneLine + 4);
  doc.font(BRAND.font.bold).fontSize(BRAND.size.body).fillColor(BRAND.color.dark);
  doc.text(prefix, ml(), doc.y, { continued: true, lineBreak: false });
  doc.font(BRAND.font.regular).text(t, { width: w, lineBreak: true, lineGap: lg });
  doc.y += E().proposalSpacing;
}

function renderEmmDocument(doc, data) {
  const links = data.notionLinks || data.links || {};
  flowAssetLinks(doc, links);

  if (data.intro) {
    flowParagraph(doc, data.intro);
  }

  flowSection(doc, 'Executive Summary');
  normalizeExecSummary(data.execSummary).forEach((p) => flowParagraph(doc, p));

  flowSection(doc, "Work We've Done");
  normalizeWorkItems(data.workWeDone).forEach((p) => flowParagraph(doc, p));

  flowSection(doc, 'Your Current State');
  drawSignalTable(doc, data.currentState || []);

  if (data.observation) {
    drawObservationCallout(doc, data.observation);
  }

  flowSection(doc, 'Your Journey Map');
  drawJourneyTable(doc, data.journeyMap || []);

  flowSection(doc, "What We're Proposing");
  const props = data.proposals || {};
  if (props.intro) {
    flowParagraph(doc, props.intro);
  }
  const items = Array.isArray(props.items) ? props.items : [];
  items.forEach((item, i) => {
    const text = typeof item === 'string' ? item : item.text || item.body || '';
    flowProposal(doc, i + 1, text);
  });

  if (data.cta) {
    drawCtaCallout(doc, data.cta);
  }
}

module.exports = { renderEmmDocument };
