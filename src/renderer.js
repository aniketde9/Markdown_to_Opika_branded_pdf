'use strict';

const BRAND = require('./brand');
const { drawTable } = require('./tables');

let state = {};

/** Last Y coordinate usable for starting new body content (above bottom margin). */
function bodyContentBottom() {
  return BRAND.page.height - BRAND.page.marginBottom;
}

/** If the cursor is too low to fit `minHeight`, start a new page and reset the header margin. */
function ensureRoom(doc, minHeight) {
  const bottom = bodyContentBottom();
  if (doc.y + minHeight > bottom) {
    doc.addPage();
    doc.x = BRAND.page.marginLeft;
    doc.y = BRAND.page.marginTop;
  }
}

function initState(doc, showHeader, title) {
  state = {
    doc,
    showHeader,
    title,
    x: BRAND.page.marginLeft,
    contentW: BRAND.contentWidth,
    listDepth: 0,
    listCounters: [],
  };

  if (showHeader) drawHeader(doc, title);

  doc.on('pageAdded', () => {
    if (showHeader) drawHeader(doc, title);
  });
}

function drawHeader(doc, title) {
  const y = BRAND.page.marginTop - 28;

  doc
    .moveTo(BRAND.page.marginLeft, y + 14)
    .lineTo(BRAND.page.width - BRAND.page.marginRight, y + 14)
    .lineWidth(0.5)
    .strokeColor(BRAND.color.grey)
    .stroke();

  doc
    .font(BRAND.font.regular)
    .fontSize(BRAND.size.footer)
    .fillColor(BRAND.color.grey)
    .text(title, BRAND.page.marginLeft, y, {
      width: BRAND.contentWidth * 0.7,
      align: 'left',
      lineBreak: false,
    });

  doc
    .font(BRAND.font.mono)
    .fontSize(BRAND.size.footer)
    .fillColor(BRAND.color.pink)
    .text('OPIKA', BRAND.page.marginLeft, y, {
      width: BRAND.contentWidth,
      align: 'right',
      lineBreak: false,
    });

  // PDFKit advances doc.y/doc.x from text(); reset so body flow starts at the real top margin.
  doc.x = BRAND.page.marginLeft;
  doc.y = BRAND.page.marginTop;
}

function renderTokens(doc, tokens, opts = {}) {
  initState(doc, opts.showHeader || false, opts.title || '');

  for (const token of tokens) {
    renderToken(token);
  }
}

function renderToken(token) {
  const { doc } = state;

  switch (token.type) {
    case 'heading':
      renderHeading(token);
      break;
    case 'paragraph':
      renderParagraph(token);
      break;
    case 'list':
      renderList(token);
      break;
    case 'code':
      renderCode(token);
      break;
    case 'blockquote':
      renderBlockquote(token);
      break;
    case 'table':
      renderTable(token);
      break;
    case 'hr':
      renderRule();
      break;
    case 'space':
      doc.y += 6;
      break;
    default:
      break;
  }
}

function renderHeading(token) {
  const { doc } = state;
  const level = token.depth;
  const text = stripInlineTokens(token.tokens);

  ensureRoom(doc, 56);

  const cfg =
    {
      1: {
        font: BRAND.font.mono,
        size: BRAND.size.h1,
        color: BRAND.color.navy,
        spaceBefore: 18,
        spaceAfter: BRAND.space.afterH1,
        rule: true,
      },
      2: {
        font: BRAND.font.mono,
        size: BRAND.size.h2,
        color: BRAND.color.navy,
        spaceBefore: 14,
        spaceAfter: BRAND.space.afterH2,
        rule: false,
      },
      3: {
        font: BRAND.font.bold,
        size: BRAND.size.h3,
        color: BRAND.color.dark,
        spaceBefore: 10,
        spaceAfter: BRAND.space.afterH3,
        rule: false,
      },
      4: {
        font: BRAND.font.bold,
        size: BRAND.size.body,
        color: BRAND.color.dark,
        spaceBefore: 8,
        spaceAfter: 4,
        rule: false,
      },
    }[level] || {
      font: BRAND.font.bold,
      size: BRAND.size.body,
      color: BRAND.color.dark,
      spaceBefore: 6,
      spaceAfter: 4,
      rule: false,
    };

  doc.x = state.x;
  doc.y += cfg.spaceBefore;

  doc
    .font(cfg.font)
    .fontSize(cfg.size)
    .fillColor(cfg.color)
    .text(text, state.x, doc.y, { width: state.contentW, lineBreak: true });

  if (cfg.rule) {
    const ruleY = doc.y + 4;
    doc
      .moveTo(state.x, ruleY)
      .lineTo(state.x + state.contentW, ruleY)
      .lineWidth(2.5)
      .strokeColor(BRAND.color.pink)
      .stroke();
    doc.y = ruleY + 10;
  }

  doc.y += cfg.spaceAfter;
}

function renderParagraph(token) {
  const { doc } = state;
  ensureRoom(doc, 48);
  doc.x = state.x;
  renderInlineTokens(doc, token.tokens, state.contentW);
  doc.y += BRAND.space.afterPara;
}

function renderInlineTokens(doc, tokens, width) {
  if (!tokens || tokens.length === 0) return;

  doc.font(BRAND.font.regular).fontSize(BRAND.size.body).fillColor(BRAND.color.dark);

  const lastIdx = tokens.length - 1;
  tokens.forEach((t, i) => {
    const continued = i < lastIdx;

    switch (t.type) {
      case 'text':
        doc.text(t.raw || t.text || '', { continued, width });
        break;

      case 'strong':
        doc
          .font(BRAND.font.bold)
          .fillColor(BRAND.color.navy)
          .text(stripInlineTokens(t.tokens), { continued, width });
        doc.font(BRAND.font.regular).fillColor(BRAND.color.dark);
        break;

      case 'em':
        doc.font(BRAND.font.italic).text(stripInlineTokens(t.tokens), { continued, width });
        doc.font(BRAND.font.regular);
        break;

      case 'codespan':
        doc
          .font(BRAND.font.mono)
          .fontSize(BRAND.size.code)
          .fillColor(BRAND.color.navy)
          .text(t.text, { continued, width });
        doc.font(BRAND.font.regular).fontSize(BRAND.size.body).fillColor(BRAND.color.dark);
        break;

      case 'link':
        doc
          .fillColor(BRAND.color.navy)
          .text(t.text, { continued, width, underline: true, link: t.href });
        doc.fillColor(BRAND.color.dark);
        break;

      case 'softbreak':
      case 'hardbreak':
        doc.text(' ', { continued, width });
        break;

      default:
        if (t.text || t.raw) {
          doc.text(t.text || t.raw, { continued, width });
        }
        break;
    }
  });
}

function renderListItemContent(doc, item, textX, textW, startY) {
  if (!item.tokens || item.tokens.length === 0) {
    doc.x = textX;
    doc.y = startY;
    doc.text(item.text || '', { width: textW });
    return;
  }

  const nonLists = item.tokens.filter((t) => t.type !== 'list');
  let first = true;
  for (const t of nonLists) {
    if (t.type === 'paragraph' && t.tokens) {
      if (!first) doc.y += 4;
      doc.x = textX;
      renderInlineTokens(doc, t.tokens, textW);
      first = false;
    } else if (t.type === 'text' || t.raw) {
      if (!first) doc.y += 4;
      doc.x = textX;
      doc.text(t.text || t.raw || '', { width: textW });
      first = false;
    }
  }

  const nested = item.tokens.filter((t) => t.type === 'list');
  state.listDepth++;
  for (const nestedList of nested) {
    renderList(nestedList);
  }
  state.listDepth--;
}

function renderList(token) {
  const { doc } = state;
  const ordered = token.ordered;
  let counter = token.start || 1;

  ensureRoom(doc, 40);

  for (const item of token.items || []) {
    ensureRoom(doc, 32);
    const indent = state.x + state.listDepth * BRAND.space.listIndent;
    const textX = indent + 16;
    const textW = state.contentW - state.listDepth * BRAND.space.listIndent - 16;
    const itemY = doc.y;

    if (ordered) {
      doc
        .font(BRAND.font.bold)
        .fontSize(BRAND.size.body)
        .fillColor(BRAND.color.navy)
        .text(`${counter}.`, indent, itemY, { width: 14, lineBreak: false });
      counter++;
    } else {
      doc.circle(indent + 4, itemY + 5.5, 2.5).fill(BRAND.color.pink);
    }

    doc.font(BRAND.font.regular).fontSize(BRAND.size.body).fillColor(BRAND.color.dark);

    const startY = itemY;
    doc.y = startY;
    renderListItemContent(doc, item, textX, textW, startY);

    doc.y += BRAND.space.listItemGap;
  }

  doc.y += BRAND.space.afterPara;
}

function renderCode(token) {
  const { doc } = state;
  const text = token.text || '';

  const textHeight = doc.heightOfString(text, {
    font: BRAND.font.mono,
    size: BRAND.size.code,
    width: state.contentW - 28,
  });

  const boxH = textHeight + 24;
  const boxX = state.x;
  const boxY = doc.y;
  const boxW = state.contentW;

  if (boxY + boxH > bodyContentBottom() - 20) {
    doc.addPage();
    doc.x = BRAND.page.marginLeft;
    doc.y = BRAND.page.marginTop;
  }

  const drawY = doc.y;

  doc.rect(boxX, drawY, boxW, boxH).fill(BRAND.color.light);

  doc.rect(boxX, drawY, 3, boxH).fill(BRAND.color.navy);

  doc
    .font(BRAND.font.mono)
    .fontSize(BRAND.size.code)
    .fillColor(BRAND.color.dark)
    .text(text, boxX + 14, drawY + 12, {
      width: boxW - 28,
      lineBreak: true,
      lineGap: 2,
    });

  doc.x = state.x;
  doc.y = drawY + boxH + BRAND.space.afterCode;
}

function renderBlockquote(token) {
  const { doc } = state;

  const innerText = (token.tokens || [])
    .map((t) => {
      if (t.type === 'paragraph') return stripInlineTokens(t.tokens);
      return t.text || '';
    })
    .join(' ');

  const boxW = state.contentW;
  const textH = doc.heightOfString(innerText, {
    font: BRAND.font.regular,
    size: BRAND.size.body,
    width: boxW - 32,
  });
  const boxH = textH + 24;
  const boxX = state.x;
  const drawY = doc.y;

  if (drawY + boxH > bodyContentBottom() - 20) {
    doc.addPage();
    doc.x = BRAND.page.marginLeft;
    doc.y = BRAND.page.marginTop;
  }

  const y2 = doc.y;
  doc.rect(boxX, y2, boxW, boxH).fill(BRAND.color.light);

  doc.rect(boxX, y2, 4, boxH).fill(BRAND.color.pink);

  doc
    .font(BRAND.font.regular)
    .fontSize(BRAND.size.body)
    .fillColor(BRAND.color.navy)
    .text(innerText, boxX + 16, y2 + 12, {
      width: boxW - 32,
      lineBreak: true,
    });

  doc.x = state.x;
  doc.y = y2 + boxH + BRAND.space.afterPara;
}

function renderRule() {
  const { doc } = state;
  ensureRoom(doc, 24);
  doc.y += 4;
  const lineY = doc.y;
  doc
    .moveTo(state.x, lineY)
    .lineTo(state.x + state.contentW, lineY)
    .lineWidth(0.75)
    .strokeColor(BRAND.color.grey)
    .stroke();
  doc.y = lineY + 14;
  doc.x = state.x;
}

function renderTable(token) {
  ensureRoom(state.doc, 72);
  drawTable(state.doc, token, state.x, state.contentW);
  state.doc.y += BRAND.space.afterTable;
  state.doc.x = state.x;
}

function stripInlineTokens(tokens) {
  if (!tokens) return '';
  return tokens.map((t) => t.text || t.raw || '').join('');
}

module.exports = { renderTokens };
