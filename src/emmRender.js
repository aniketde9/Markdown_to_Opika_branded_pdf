'use strict';

const BRAND = require('./brand');
const { decodeHtmlEntities } = require('./htmlEntities');
const { Lexer } = require('marked');

const E = () => BRAND.emm;

/** Opika brand blue for inline **…** emphasis (body copy). */
const OPIKA_EMPHASIS = BRAND.color.navy;

/**
 * Turn Marked inline tokens into { bold, text } runs (bold only inside strong / __).
 */
function flattenStrongOnly(tokens, inStrong = false) {
  const pieces = [];
  for (const t of tokens || []) {
    switch (t.type) {
      case 'text':
      case 'escape':
        pieces.push({ bold: inStrong, text: decodeHtmlEntities(t.text || '') });
        break;
      case 'strong':
        pieces.push(...flattenStrongOnly(t.tokens, true));
        break;
      case 'em':
        pieces.push(...flattenStrongOnly(t.tokens, inStrong));
        break;
      case 'link':
      case 'image':
        pieces.push(...flattenStrongOnly(t.tokens, inStrong));
        break;
      case 'codespan':
        pieces.push({ bold: inStrong, text: decodeHtmlEntities(t.text || '') });
        break;
      case 'br':
        pieces.push({ bold: inStrong, text: '\n' });
        break;
      case 'del':
        pieces.push(...flattenStrongOnly(t.tokens, inStrong));
        break;
      default:
        pieces.push({ bold: inStrong, text: decodeHtmlEntities(t.text || t.raw || '') });
    }
  }
  return pieces;
}

function mergeAdjacentStrongRuns(runs) {
  const out = [];
  for (const r of runs) {
    if (!r.text) continue;
    const last = out[out.length - 1];
    if (last && last.bold === r.bold) last.text += r.text;
    else out.push({ bold: r.bold, text: r.text });
  }
  return out.filter((x) => x.text.length > 0);
}

function parseStrongRuns(source) {
  const s = String(source || '').trim();
  if (!s) return [];
  try {
    const tokens = Lexer.lexInline(s);
    if (!tokens || tokens.length === 0) return [{ bold: false, text: s }];
    const runs = mergeAdjacentStrongRuns(flattenStrongOnly(tokens, false));
    return runs.length > 0 ? runs : [{ bold: false, text: s }];
  } catch {
    return [{ bold: false, text: s }];
  }
}

const BODY_SIZE = () => BRAND.size.body;

/** Split runs into words / whitespace chunks (and explicit newlines from marked `br`). */
function runsToWordTokens(runs) {
  const tokens = [];
  for (const run of runs) {
    const parts = String(run.text || '').split('\n');
    parts.forEach((seg, si) => {
      if (si > 0) tokens.push({ bold: run.bold, text: '\n', newline: true });
      const chunks = seg.split(/(\s+)/);
      for (const c of chunks) {
        if (c) tokens.push({ bold: run.bold, text: c, newline: false });
      }
    });
  }
  return tokens;
}

function measureTokenWidth(doc, tok) {
  doc.font(tok.bold ? BRAND.font.bold : BRAND.font.regular).fontSize(BODY_SIZE());
  return doc.widthOfString(tok.text, { lineBreak: false });
}

/**
 * Break overlong token (single word) across lines to fit width.
 */
function splitOversizeToken(doc, tok, maxW) {
  if (maxW <= 0) return [tok];
  const out = [];
  let rest = tok.text;
  doc.font(tok.bold ? BRAND.font.bold : BRAND.font.regular).fontSize(BODY_SIZE());
  while (rest.length) {
    let lo = 1;
    let hi = rest.length;
    let fit = 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const w = doc.widthOfString(rest.slice(0, mid), { lineBreak: false });
      if (w <= maxW) {
        fit = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    if (fit < 1) fit = 1;
    out.push({ bold: tok.bold, text: rest.slice(0, fit), newline: false });
    rest = rest.slice(fit);
  }
  return out;
}

/**
 * Layout word tokens into lines. First line uses firstW; wrapped lines use contW (e.g. full width after a numbered prefix).
 * startX per line: firstX then contX (PDFKit `continued` cannot mix inline fonts on one line).
 */
function layoutStrongLines(doc, runs, firstX, firstW, contX, contW) {
  const contXf = contX === undefined ? firstX : contX;
  const contWf = contW === undefined ? firstW : contW;
  const raw = runsToWordTokens(runs);
  const lines = [];
  let line = [];
  let used = 0;
  let lineStartX = firstX;
  let curMaxW = firstW;

  const isOnlyWs = (t) => !t.newline && /^\s+$/.test(t.text);
  const flush = () => {
    if (line.length) {
      lines.push({ startX: lineStartX, tokens: line });
      line = [];
      used = 0;
      lineStartX = contXf;
      curMaxW = contWf;
    }
  };

  let i = 0;
  while (i < raw.length) {
    const t = raw[i];
    if (t.newline) {
      flush();
      i++;
      continue;
    }
    let tw = measureTokenWidth(doc, t);
    if (tw > curMaxW && !isOnlyWs(t)) {
      const parts = splitOversizeToken(doc, t, curMaxW);
      for (const p of parts) {
        const pw = measureTokenWidth(doc, p);
        if (line.length && used + pw > curMaxW) flush();
        if (!line.length && isOnlyWs(p)) continue;
        line.push(p);
        used += pw;
      }
      i++;
      continue;
    }
    if (line.length === 0 && isOnlyWs(t)) {
      i++;
      continue;
    }
    if (line.length === 0) {
      line.push(t);
      used = tw;
      i++;
      continue;
    }
    if (used + tw <= curMaxW) {
      line.push(t);
      used += tw;
      i++;
    } else {
      flush();
    }
  }
  flush();
  return lines;
}

function lineHeightForRuns(doc, lineGap) {
  doc.font(BRAND.font.bold).fontSize(BODY_SIZE());
  const hBold = doc.currentLineHeight(true);
  doc.font(BRAND.font.regular).fontSize(BODY_SIZE());
  const hReg = doc.currentLineHeight(true);
  return Math.max(hBold, hReg) + lineGap;
}

function heightOfStrongRuns(doc, runs, width, lineGap, contW) {
  if (runs.length === 0) return 0;
  const contWf = contW === undefined ? width : contW;
  const lines = layoutStrongLines(doc, runs, 0, width, 0, contWf);
  if (lines.length === 0) return 0;
  const lh = lineHeightForRuns(doc, lineGap);
  return lines.length * lh;
}

/**
 * Mixed regular + **bold** on the same line: manual wrap (avoids PDFKit `continued` newline bug).
 * Optional contX/contW: wrapped lines start at contX with width contW (numbered list body).
 */
function emitStrongRuns(doc, runs, x, y, width, lineGap, baseColor, contX, contW) {
  if (runs.length === 0) return;
  const startX = x != null ? x : doc.x;
  const startY = y != null ? y : doc.y;
  const contXf = contX === undefined ? startX : contX;
  const contWf = contW === undefined ? width : contW;
  const size = BODY_SIZE();
  const lines = layoutStrongLines(doc, runs, startX, width, contXf, contWf);
  const lh = lineHeightForRuns(doc, lineGap);
  let lineY = startY;

  for (const row of lines) {
    let cx = row.startX;
    for (const tok of row.tokens) {
      doc
        .font(tok.bold ? BRAND.font.bold : BRAND.font.regular)
        .fontSize(size)
        .fillColor(tok.bold ? OPIKA_EMPHASIS : baseColor)
        .text(tok.text, cx, lineY, { lineBreak: false });
      cx += measureTokenWidth(doc, tok);
    }
    lineY += lh;
  }
  doc.x = contXf;
  doc.y = lineY;
  doc.font(BRAND.font.regular).fontSize(size).fillColor(baseColor);
}

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
  const size = BRAND.size.body;
  const base = BRAND.color.dark;
  const oneLine = doc.heightOfString('Mg', { font: BRAND.font.regular, size, width: w, lineGap: lg });
  ensureRoom(doc, oneLine + 4);
  const runs = parseStrongRuns(t);
  const hasEmphasis = runs.some((r) => r.bold);
  if (!hasEmphasis) {
    doc.font(BRAND.font.regular).fontSize(size).fillColor(base);
    doc.text(t, ml(), doc.y, { width: w, lineBreak: true, lineGap: lg });
  } else {
    emitStrongRuns(doc, runs, ml(), doc.y, w, lg, base);
  }
  doc.font(BRAND.font.regular).fontSize(size).fillColor(base);
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
  const pink = BRAND.color.pink;
  const dark = BRAND.color.dark;

  const leadRuns = lead ? parseStrongRuns(lead) : [];
  const bodyRuns = body ? parseStrongRuns(body) : [];
  const singleRuns = !lead || !body ? parseStrongRuns(lead || body) : [];

  let textH = 0;
  if (lead && body) {
    const leadH = leadRuns.some((r) => r.bold)
      ? heightOfStrongRuns(doc, leadRuns, innerW, lg)
      : doc.heightOfString(lead, { font: BRAND.font.bold, size: BRAND.size.body, width: innerW, lineGap: lg });
    const bodyH = bodyRuns.some((r) => r.bold)
      ? heightOfStrongRuns(doc, bodyRuns, innerW, lg)
      : doc.heightOfString(body, { font: BRAND.font.regular, size: BRAND.size.body, width: innerW, lineGap: lg });
    textH = leadH + E().calloutInteriorGap + bodyH;
  } else {
    const single = lead || body;
    if (singleRuns.some((r) => r.bold)) {
      textH = heightOfStrongRuns(doc, singleRuns, innerW, lg);
    } else if (lead) {
      textH = doc.heightOfString(single, { font: BRAND.font.bold, size: BRAND.size.body, width: innerW, lineGap: lg });
    } else {
      textH = doc.heightOfString(single, { font: BRAND.font.regular, size: BRAND.size.body, width: innerW, lineGap: lg });
    }
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
    if (leadRuns.some((r) => r.bold)) {
      emitStrongRuns(doc, leadRuns, tx, ty, innerW, lg, pink);
    } else {
      doc.font(BRAND.font.bold).fontSize(BRAND.size.body).fillColor(pink);
      doc.text(lead, tx, ty, { width: innerW, lineBreak: true, lineGap: lg });
    }
    ty +=
      (leadRuns.some((r) => r.bold)
        ? heightOfStrongRuns(doc, leadRuns, innerW, lg)
        : doc.heightOfString(lead, { font: BRAND.font.bold, size: BRAND.size.body, width: innerW, lineGap: lg })) +
      E().calloutInteriorGap;
    if (bodyRuns.some((r) => r.bold)) {
      emitStrongRuns(doc, bodyRuns, tx, ty, innerW, lg, dark);
    } else {
      doc.font(BRAND.font.regular).fillColor(dark);
      doc.text(body, tx, ty, { width: innerW, lineBreak: true, lineGap: lg });
    }
  } else {
    const single = lead || body;
    if (singleRuns.some((r) => r.bold)) {
      emitStrongRuns(doc, singleRuns, tx, ty, innerW, lg, lead ? pink : dark);
    } else if (lead) {
      doc.font(BRAND.font.bold).fontSize(BRAND.size.body).fillColor(pink);
      doc.text(single, tx, ty, { width: innerW, lineBreak: true, lineGap: lg });
    } else {
      doc.font(BRAND.font.regular).fontSize(BRAND.size.body).fillColor(dark);
      doc.text(single, tx, ty, { width: innerW, lineBreak: true, lineGap: lg });
    }
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

  function blockHeight(text, isEmail) {
    if (isEmail) {
      return doc.heightOfString(text, { font: BRAND.font.bold, size: BRAND.size.body, width: innerW, lineGap: lg });
    }
    const runs = parseStrongRuns(text);
    return runs.some((r) => r.bold) ? heightOfStrongRuns(doc, runs, innerW, lg) : doc.heightOfString(text, { font: BRAND.font.regular, size: BRAND.size.body, width: innerW, lineGap: lg });
  }

  let textH = 0;
  blocks.forEach((b, i) => {
    textH += blockHeight(b.text, b.font === BRAND.font.bold);
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
    if (isEmail) {
      doc.font(BRAND.font.bold).fontSize(BRAND.size.body).fillColor(BRAND.color.navy);
      doc.text(b.text, tx, ty, { width: innerW, lineBreak: true, lineGap: lg });
    } else {
      const runs = parseStrongRuns(b.text);
      if (runs.some((r) => r.bold)) {
        emitStrongRuns(doc, runs, tx, ty, innerW, lg, BRAND.color.dark);
      } else {
        doc.font(BRAND.font.regular).fontSize(BRAND.size.body).fillColor(BRAND.color.dark);
        doc.text(b.text, tx, ty, { width: innerW, lineBreak: true, lineGap: lg });
      }
    }
    ty += blockHeight(b.text, isEmail) + (i < blocks.length - 1 ? E().calloutInteriorGap : 0);
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
  const runs = parseStrongRuns(t);
  const proposalFirstX = doc.x;
  const proposalFirstY = doc.y;
  const proposalFirstW = ml() + cw() - proposalFirstX;
  if (runs.some((r) => r.bold)) {
    emitStrongRuns(doc, runs, proposalFirstX, proposalFirstY, proposalFirstW, lg, BRAND.color.dark, ml(), cw());
  } else {
    doc.font(BRAND.font.regular).fillColor(BRAND.color.dark).text(t, { width: w, lineBreak: true, lineGap: lg });
  }
  doc.font(BRAND.font.regular).fontSize(BRAND.size.body).fillColor(BRAND.color.dark);
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
