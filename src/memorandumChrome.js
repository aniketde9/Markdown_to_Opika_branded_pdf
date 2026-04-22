'use strict';

const BRAND = require('./brand');

const DISCLAIMER =
  'All information is derived from your public social links and reviews. Some details may not be accurate, we just wanted to show you what we can do.';

function headerRuleY() {
  return BRAND.page.marginTop - 22;
}

function headerTextY() {
  return BRAND.page.marginTop - 28;
}

/** Top running head: OPIKA (navy) + ENGAGEMENT MARKETING MEMORANDUM (grey, right). */
function drawRunningHeader(doc) {
  const y = headerTextY();
  const ruleY = headerRuleY();

  doc
    .moveTo(BRAND.page.marginLeft, ruleY)
    .lineTo(BRAND.page.width - BRAND.page.marginRight, ruleY)
    .lineWidth(0.5)
    .strokeColor(BRAND.color.grey)
    .stroke();

  doc
    .font(BRAND.font.mono)
    .fontSize(7)
    .fillColor(BRAND.color.navy)
    .text('OPIKA', BRAND.page.marginLeft, y, { lineBreak: false });

  const memoText = 'ENGAGEMENT MARKETING MEMORANDUM';
  const memoW = doc.widthOfString(memoText, { font: BRAND.font.mono, size: 7 });
  doc
    .font(BRAND.font.mono)
    .fontSize(7)
    .fillColor(BRAND.color.grey)
    .text(memoText, BRAND.page.width - BRAND.page.marginRight - memoW, y, { lineBreak: false });

  doc.x = BRAND.page.marginLeft;
  doc.y = BRAND.page.marginTop;
}

/**
 * Footer: disclaimer (wrapped) + centered "-- n of m --".
 * Call after all pages exist via switchToPage.
 */
function drawMemorandumFooter(doc, pageNum, totalPages) {
  const left = BRAND.page.marginLeft;
  const w = BRAND.contentWidth;
  const bottom = BRAND.page.height - BRAND.page.marginBottom;
  /** Sit disclaimer block slightly lower in the bottom margin so it clears body text. */
  const footerLift = 10;

  const ruleY = bottom - BRAND.page.footerReserve + 2 + footerLift;
  doc
    .moveTo(left, ruleY)
    .lineTo(BRAND.page.width - BRAND.page.marginRight, ruleY)
    .lineWidth(0.5)
    .strokeColor(BRAND.color.grey)
    .stroke();

  const disclaimerY = ruleY + 6;
  doc
    .font(BRAND.font.italic)
    .fontSize(7)
    .fillColor(BRAND.color.grey)
    .text(DISCLAIMER, left, disclaimerY, { width: w, lineBreak: true, align: 'left' });

  const discH = doc.heightOfString(DISCLAIMER, {
    font: BRAND.font.italic,
    size: 7,
    width: w,
  });

  const pageLabel = `-- ${pageNum} of ${totalPages} --`;
  doc
    .font(BRAND.font.mono)
    .fontSize(7)
    .fillColor(BRAND.color.grey)
    .text(pageLabel, left, disclaimerY + discH + 4, { width: w, align: 'center', lineBreak: false });
}

function attachRunningHeader(doc) {
  doc.on('pageAdded', () => {
    drawRunningHeader(doc);
  });
}

function measureBookBlockHeight(doc, bookLine, innerW) {
  if (!bookLine || !bookLine.trim()) return 0;
  const size = BRAND.memorandum.coverBookSize;
  const lg = BRAND.memorandum.coverLineGap;
  const colon = bookLine.indexOf(':');
  if (colon >= 0) {
    const partA = bookLine.slice(0, colon + 1).trim();
    const partB = bookLine.slice(colon + 1).trim();
    const line = partB ? `${partA} ${partB.trim()}` : partA;
    return doc.heightOfString(line, {
      font: BRAND.font.boldItalic,
      size,
      width: innerW,
      lineGap: lg,
    });
  }
  return doc.heightOfString(bookLine, {
    font: BRAND.font.italic,
    size,
    width: innerW,
    lineGap: lg,
  });
}

/**
 * Navy "prepared for" band (first page only). Advances doc.y below the block.
 */
function drawPreparedForBlock(doc, recipientName, bookLine) {
  doc.y += 6;
  const padX = 22;
  const padTop = 20;
  /** Extra space below book line so subtitle clears the navy band bottom. */
  const padBottom = 30;
  const boxX = BRAND.page.marginLeft;
  const boxW = BRAND.contentWidth;
  const innerW = boxW - padX * 2;
  const gapPN = BRAND.memorandum.coverGapPreparedToName;
  const gapNB = BRAND.memorandum.coverGapNameToBook;
  const nameLg = BRAND.memorandum.coverLineGap;
  const bookLg = BRAND.memorandum.coverLineGap;
  const bookSize = BRAND.memorandum.coverBookSize;
  const boxY = doc.y;
  const innerTop = boxY + padTop;

  const hPrepared = doc.heightOfString('PREPARED FOR', {
    font: BRAND.font.mono,
    size: 9,
    width: innerW,
    lineGap: nameLg,
  });
  const hName = doc.heightOfString(recipientName || '', {
    font: BRAND.font.mono,
    size: BRAND.memorandum.coverNameSize,
    width: innerW,
    lineGap: nameLg,
  });
  const hBook = bookLine && bookLine.trim() ? measureBookBlockHeight(doc, bookLine, innerW) : 0;
  const hInner = hPrepared + gapPN + hName + (hBook ? gapNB + hBook : 0);
  // Extra slack so PDFKit’s laid-out height never clips the last line vs pre-measure.
  const boxH = padTop + hInner + padBottom + 8;

  doc.rect(boxX, boxY, boxW, boxH).fill(BRAND.color.navy);

  doc.font(BRAND.font.mono).fontSize(9).fillColor(BRAND.color.grey);
  doc.text('PREPARED FOR', boxX + padX, innerTop, { width: innerW, lineBreak: true, lineGap: nameLg });

  doc.font(BRAND.font.mono).fontSize(BRAND.memorandum.coverNameSize).fillColor(BRAND.color.white);
  doc.text(recipientName || '', boxX + padX, doc.y + gapPN, { width: innerW, lineBreak: true, lineGap: nameLg });

  if (bookLine && bookLine.trim()) {
    const colon = bookLine.indexOf(':');
    const bookY = doc.y + gapNB;
    if (colon >= 0) {
      const partA = bookLine.slice(0, colon + 1).trim();
      const partB = bookLine.slice(colon + 1).trim();
      if (partB) {
        doc.font(BRAND.font.boldItalic).fontSize(bookSize).fillColor(BRAND.color.pink);
        doc.text(partA, boxX + padX, bookY, { continued: true, lineBreak: false });
        doc.font(BRAND.font.italic).fillColor(BRAND.color.white);
        doc.text(` ${partB.trim()}`, { width: innerW, lineBreak: true, lineGap: bookLg });
      } else {
        doc.font(BRAND.font.boldItalic).fontSize(bookSize).fillColor(BRAND.color.pink);
        doc.text(partA, boxX + padX, bookY, { width: innerW, lineBreak: true, lineGap: bookLg });
      }
    } else {
      doc.font(BRAND.font.italic).fontSize(bookSize).fillColor(BRAND.color.white);
      doc.text(bookLine, boxX + padX, bookY, { width: innerW, lineBreak: true, lineGap: bookLg });
    }
  }

  doc.x = BRAND.page.marginLeft;
  doc.y = boxY + boxH + 8;
}

module.exports = {
  drawRunningHeader,
  drawMemorandumFooter,
  attachRunningHeader,
  drawPreparedForBlock,
  DISCLAIMER,
};
