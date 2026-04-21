'use strict';

const path = require('path');
const fs = require('fs');
const BRAND = require('./brand');

function drawCoverPage(doc, title, subtitle) {
  doc.addPage({ size: 'LETTER', margins: { top: 0, bottom: 0, left: 0, right: 0 } });

  const W = BRAND.page.width;
  const H = BRAND.page.height;

  doc.rect(0, 0, W, 8).fill(BRAND.color.navy);

  doc.rect(0, 8, W, 3).fill(BRAND.color.pink);

  const logoPath = path.join(__dirname, '../assets/opika_logo.png');
  if (fs.existsSync(logoPath)) {
    doc.image(logoPath, W - 72 - 90, 36, { width: 90 });
  } else {
    doc
      .font(BRAND.font.mono)
      .fontSize(14)
      .fillColor(BRAND.color.pink)
      .text('OPIKA', W - 72 - 80, 40, { width: 80, align: 'right' });
  }

  const titleY = H * 0.38;

  doc
    .font(BRAND.font.mono)
    .fontSize(BRAND.size.coverTitle)
    .fillColor(BRAND.color.navy)
    .text(title, 72, titleY, {
      width: W - 144,
      align: 'left',
      lineBreak: true,
    });

  if (subtitle) {
    const titleHeight = doc.heightOfString(title, {
      font: BRAND.font.mono,
      size: BRAND.size.coverTitle,
      width: W - 144,
    });
    doc
      .font(BRAND.font.bold)
      .fontSize(BRAND.size.coverSub)
      .fillColor(BRAND.color.pink)
      .text(subtitle, 72, titleY + titleHeight + 14, {
        width: W - 144,
        align: 'left',
        lineBreak: true,
      });
  }

  doc
    .moveTo(72, H * 0.62)
    .lineTo(W - 72, H * 0.62)
    .lineWidth(1.5)
    .strokeColor(BRAND.color.pink)
    .stroke();

  doc
    .font(BRAND.font.regular)
    .fontSize(9)
    .fillColor(BRAND.color.grey)
    .text('opika.co', 72, H - 48, { align: 'left', lineBreak: false });

  doc.rect(0, H - 8, W, 8).fill(BRAND.color.navy);
}

module.exports = { drawCoverPage };
