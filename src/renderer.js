'use strict';

const BRAND = require('./brand');
const { drawTable } = require('./tables');

let state = {};

/** Last Y coordinate usable for starting new body content (above running footer). */
function bodyContentBottom() {
  return BRAND.bodyContentMaxY;
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

  doc.x = BRAND.page.marginLeft;
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
  const majorSection = level === 1 || level === 2;
  const sectionLabel = majorSection ? String(text).toUpperCase() : text;

  ensureRoom(doc, 56);

  const cfg =
    majorSection
      ? {
          font: BRAND.font.mono,
          size: BRAND.emm.sectionTitleSize,
          color: BRAND.color.navy,
          spaceBefore: level === 1 ? 14 : 12,
          spaceAfter: BRAND.space.afterH1,
          rule: true,
        }
      : {
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
    .text(sectionLabel, state.x, doc.y, { width: state.contentW, lineBreak: true, lineGap: BRAND.emm.lineGap });

  if (cfg.rule) {
    const ruleY = doc.y + BRAND.emm.ruleGapBelowHeading;
    doc
      .moveTo(state.x, ruleY)
      .lineTo(state.x + state.contentW, ruleY)
      .lineWidth(3)
      .strokeColor(BRAND.color.pink)
      .stroke();
    doc.y = ruleY + BRAND.emm.afterSectionRule + cfg.spaceAfter;
  } else {
    doc.y += cfg.spaceAfter;
  }
}

function renderParagraph(token) {
  const { doc } = state;
  ensureRoom(doc, 48);
  doc.x = state.x;
  const plain = stripInlineTokens(token.tokens || []).trimStart();
  const assetLead = /^\[[AB]\]/.test(plain);
  renderInlineTokens(doc, token.tokens, state.contentW, { assetLead });
  doc.y += BRAND.space.afterPara;
}

function renderInlineTokens(doc, tokens, width, opts = {}) {
  if (!tokens || tokens.length === 0) return;

  let assetLead = opts.assetLead || false;

  doc.font(BRAND.font.regular).fontSize(BRAND.size.body).fillColor(BRAND.color.dark);

  const lastIdx = tokens.length - 1;
  tokens.forEach((t, i) => {
    const continued = i < lastIdx;

    switch (t.type) {
      case 'text': {
        let txt = t.raw || t.text || '';
        if (assetLead && txt) {
          const m = txt.match(/^(\[[AB]\][\s\S]*?—\s*)([\s\S]*)$/);
          if (m) {
            doc
              .font(BRAND.font.bold)
              .fillColor(BRAND.color.orange)
              .text(m[1], { continued: true, width });
            assetLead = false;
            txt = m[2] || '';
            if (!txt) {
              doc.font(BRAND.font.regular).fillColor(BRAND.color.dark);
              return;
            }
          }
        }
        doc.font(BRAND.font.regular).fillColor(BRAND.color.dark).text(txt, { continued, width });
        break;
      }

      case 'strong': {
        const inner = stripInlineTokens(t.tokens);
        if (assetLead && /^\[[AB]\]/.test(inner)) {
          doc.font(BRAND.font.bold).fillColor(BRAND.color.orange).text(inner, { continued, width });
          assetLead = false;
        } else {
          doc
            .font(BRAND.font.bold)
            .fillColor(BRAND.color.navy)
            .text(inner, { continued, width });
          doc.font(BRAND.font.regular).fillColor(BRAND.color.dark);
        }
        break;
      }

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

      case 'link': {
        const label = (t.text || '').trim();
        const isViewHere = /^view here$/i.test(label);
        const linkColor = isViewHere ? BRAND.color.pink : BRAND.color.navy;
        doc
          .font(BRAND.font.regular)
          .fillColor(linkColor)
          .text(t.text, { continued, width, underline: true, link: t.href });
        doc.fillColor(BRAND.color.dark);
        break;
      }

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
  const pad = 16;
  const textW = boxW - pad * 2;
  const leadMatch = innerText.match(/^([^:]+:)(\s*)([\s\S]*)$/);

  let textH;
  if (leadMatch && leadMatch[3].trim()) {
    const lead = leadMatch[1];
    const rest = leadMatch[3].trim();
    textH =
      doc.heightOfString(lead, {
        font: BRAND.font.bold,
        size: BRAND.size.body,
        width: textW,
      }) +
      4 +
      doc.heightOfString(rest, {
        font: BRAND.font.regular,
        size: BRAND.size.body,
        width: textW,
      });
  } else {
    textH = doc.heightOfString(innerText, {
      font: BRAND.font.regular,
      size: BRAND.size.body,
      width: textW,
    });
  }

  const boxH = textH + 24;
  const boxX = state.x;
  const drawY = doc.y;

  if (drawY + boxH > bodyContentBottom() - 20) {
    doc.addPage();
    doc.x = BRAND.page.marginLeft;
    doc.y = BRAND.page.marginTop;
  }

  const y2 = doc.y;
  doc.rect(boxX, y2, boxW, boxH).fill(BRAND.color.pinkTint);

  doc.rect(boxX, y2, 4, boxH).fill(BRAND.color.pink);

  const textX = boxX + pad;
  let ty = y2 + 12;

  if (leadMatch && leadMatch[3].trim()) {
    const lead = leadMatch[1];
    const rest = leadMatch[3].trim();
    doc
      .font(BRAND.font.bold)
      .fontSize(BRAND.size.body)
      .fillColor(BRAND.color.pink)
      .text(lead, textX, ty, { width: textW, lineBreak: true });
    ty += doc.heightOfString(lead, {
      font: BRAND.font.bold,
      size: BRAND.size.body,
      width: textW,
    });
    doc
      .font(BRAND.font.regular)
      .fontSize(BRAND.size.body)
      .fillColor(BRAND.color.dark)
      .text(rest, textX, ty + 4, { width: textW, lineBreak: true });
  } else {
    doc
      .font(BRAND.font.regular)
      .fontSize(BRAND.size.body)
      .fillColor(BRAND.color.dark)
      .text(innerText, textX, ty, {
        width: textW,
        lineBreak: true,
      });
  }

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
