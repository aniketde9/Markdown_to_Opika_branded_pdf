'use strict';

const BRAND = require('./brand');

function contentBottom() {
  return BRAND.bodyContentMaxY;
}

function getText(cell) {
  if (typeof cell === 'string') return cell;
  if (cell && cell.text) return cell.text;
  if (cell && cell.tokens) return cell.tokens.map((t) => t.text || t.raw || '').join('');
  return '';
}

function normalizeHeaderCell(h) {
  return getText(h).replace(/\s+/g, ' ').trim().toUpperCase();
}

function isJourneyMapTable(headers) {
  if (!headers || headers.length !== 3) return false;
  const c = headers.map(normalizeHeaderCell);
  return c[1].includes('GAP') && c[0].includes('WHERE') && c[2].includes('GOING');
}

function isSignalStatusTable(headers) {
  if (!headers || headers.length !== 2) return false;
  const c = headers.map(normalizeHeaderCell);
  return c[0].includes('SIGNAL') && c[1].includes('STATUS');
}

function drawTable(doc, token, startX, totalWidth) {
  const headers = token.header || [];
  const rows = token.rows || [];
  const colCount = headers.length;

  if (colCount === 0) {
    return;
  }

  const journey = isJourneyMapTable(headers);
  const signalTable = isSignalStatusTable(headers);

  let colWidths;
  if (colCount === 1) {
    colWidths = [totalWidth];
  } else if (colCount === 2) {
    colWidths = [totalWidth / 2, totalWidth / 2];
  } else if (colCount === 3) {
    const w = totalWidth / 3;
    colWidths = [w, w, w];
  } else if (colCount === 4) {
    colWidths = [totalWidth * 0.2, totalWidth * 0.35, totalWidth * 0.3, totalWidth * 0.15];
  } else {
    const w = totalWidth / colCount;
    colWidths = Array(colCount).fill(w);
  }

  const headerFills = journey
    ? [BRAND.color.navy, BRAND.color.pink, BRAND.color.orange]
    : null;

  const cellPadX = 10;
  const cellPadY = 8;

  let currentY = doc.y;

  const headerHeight = measureRowHeight(
    doc,
    headers.map((h) => getText(h)),
    colWidths,
    cellPadX,
    cellPadY,
    BRAND.font.bold,
    BRAND.size.tableHeader
  );

  const sampleTexts =
    rows.length > 0
      ? rows[0].map((c) => getText(c))
      : headers.map(() => '');
  const sampleRowH = measureRowHeight(
    doc,
    sampleTexts,
    colWidths,
    cellPadX,
    cellPadY,
    BRAND.font.regular,
    BRAND.size.tableBody
  );
  const minNeeded = headerHeight + sampleRowH * Math.min(2, Math.max(1, rows.length || 1));
  const bottom = contentBottom();

  if (currentY + minNeeded > bottom) {
    doc.addPage();
    currentY = doc.y;
  }

  function drawHeaderRow(y) {
    let cellX = startX;
    headers.forEach((cell, i) => {
      const fill = headerFills ? headerFills[i] : BRAND.color.navy;
      doc.rect(cellX, y, colWidths[i], headerHeight).fill(fill);
      doc
        .font(BRAND.font.bold)
        .fontSize(BRAND.size.tableHeader)
        .fillColor(BRAND.color.white)
        .text(getText(cell), cellX + cellPadX, y + cellPadY, {
          width: colWidths[i] - cellPadX * 2,
          lineBreak: true,
        });
      cellX += colWidths[i];
    });
    const nextY = y + headerHeight;
    doc.x = startX;
    doc.y = nextY;
    return nextY;
  }

  currentY = drawHeaderRow(currentY);

  rows.forEach((row, rowIdx) => {
    const texts = headers.map((_, colIdx) => getText(row[colIdx] || ''));
    const rowBg = rowIdx % 2 === 0 ? BRAND.color.white : BRAND.color.light;
    const rowHeight = measureRowHeight(
      doc,
      texts,
      colWidths,
      cellPadX,
      cellPadY,
      BRAND.font.regular,
      BRAND.size.tableBody
    );

    if (currentY + rowHeight > bottom) {
      doc.addPage();
      currentY = doc.y;
      currentY = drawHeaderRow(currentY);
    }

    doc.rect(startX, currentY, totalWidth, rowHeight).fill(rowBg);

    doc
      .rect(startX, currentY, totalWidth, rowHeight)
      .lineWidth(0.5)
      .strokeColor(BRAND.color.grey)
      .stroke();

    let cellX = startX;
    texts.forEach((text, i) => {
      const color = signalTable ? BRAND.color.dark : getCellColor(text);
      let font = BRAND.font.regular;
      if (journey) {
        if (i === 1) font = BRAND.font.italic;
        if (i === 2) font = BRAND.font.bold;
      } else if (signalTable && i === 0) {
        font = BRAND.font.bold;
      }

      doc
        .font(font)
        .fontSize(BRAND.size.tableBody)
        .fillColor(color)
        .text(text, cellX + cellPadX, currentY + cellPadY, {
          width: colWidths[i] - cellPadX * 2,
          lineBreak: true,
        });
      cellX += colWidths[i];
    });

    currentY += rowHeight;
    doc.x = startX;
    doc.y = currentY;
  });

  doc.y = currentY;
  doc.x = startX;
}

function measureRowHeight(doc, texts, colWidths, padX, padY, font, size) {
  let maxH = 0;
  texts.forEach((text, i) => {
    const w = colWidths[i] - padX * 2;
    const h = doc.heightOfString(String(text || ''), {
      font,
      size,
      width: Math.max(1, w),
    });
    if (h > maxH) maxH = h;
  });
  return maxH + padY * 2;
}

function getCellColor(text) {
  const s = String(text).trim();
  if (/^(A|B)\s*$/.test(s)) return BRAND.color.green;
  if (/^(F)\s*$/.test(s)) return BRAND.color.red;
  if (/^(D)\s*$/.test(s)) return BRAND.color.amber;
  if (/PASS/i.test(s)) return BRAND.color.green;
  if (/FAIL|blocked|timeout/i.test(s)) return BRAND.color.red;
  return BRAND.color.dark;
}

module.exports = { drawTable };
