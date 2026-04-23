'use strict';

const {
  AlignmentType,
  BorderStyle,
  ExternalHyperlink,
  HeadingLevel,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  WidthType,
} = require('docx');
const BRAND = require('./brand');
const { decodeHtmlEntities } = require('./htmlEntities');
const { hex, twipFromPt } = require('./docxStyles');

function renderTokensToDocx(tokens) {
  const out = [];
  for (const token of tokens || []) {
    if (token.type === 'heading') out.push(renderHeading(token));
    else if (token.type === 'paragraph') out.push(renderParagraph(token));
    else if (token.type === 'list') out.push(...renderList(token, 0));
    else if (token.type === 'code') out.push(renderCode(token));
    else if (token.type === 'blockquote') out.push(renderBlockquote(token));
    else if (token.type === 'table') out.push(renderTable(token));
    else if (token.type === 'hr') out.push(renderRule());
  }
  return out;
}

function stripInline(tokens) {
  return (tokens || []).map((t) => decodeHtmlEntities(t.text || t.raw || '')).join('');
}

function inlineToChildren(tokens) {
  const out = [];
  for (const t of tokens || []) {
    if (t.type === 'text') {
      out.push(new TextRun({ text: decodeHtmlEntities(t.raw || t.text || '') }));
      continue;
    }
    if (t.type === 'strong') {
      out.push(new TextRun({ text: stripInline(t.tokens), bold: true, color: hex(BRAND.color.navy) }));
      continue;
    }
    if (t.type === 'em') {
      out.push(new TextRun({ text: stripInline(t.tokens), italics: true }));
      continue;
    }
    if (t.type === 'codespan') {
      out.push(new TextRun({ text: decodeHtmlEntities(t.text || ''), font: BRAND.font.mono, color: hex(BRAND.color.navy) }));
      continue;
    }
    if (t.type === 'link') {
      out.push(
        new ExternalHyperlink({
          link: t.href,
          children: [
            new TextRun({
              text: decodeHtmlEntities(t.text || ''),
              style: 'Hyperlink',
              underline: {},
              color: hex(BRAND.color.navy),
            }),
          ],
        })
      );
      continue;
    }
    if (t.type === 'softbreak' || t.type === 'hardbreak') {
      out.push(new TextRun({ break: 1 }));
      continue;
    }
    if (t.tokens) {
      out.push(...inlineToChildren(t.tokens));
      continue;
    }
    if (t.text || t.raw) {
      out.push(new TextRun({ text: decodeHtmlEntities(t.text || t.raw || '') }));
    }
  }
  return out;
}

function renderHeading(token) {
  const depth = token.depth || 1;
  const text = stripInline(token.tokens);
  const style = depth <= 1 ? 'H1' : depth === 2 ? 'H2' : 'H3';
  const heading = depth <= 1 ? HeadingLevel.HEADING_1 : depth === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3;
  return new Paragraph({
    text: depth <= 2 ? text.toUpperCase() : text,
    style,
    heading,
  });
}

function renderParagraph(token) {
  return new Paragraph({
    style: 'Body',
    children: inlineToChildren(token.tokens),
  });
}

function renderList(token, level) {
  const out = [];
  const ordered = Boolean(token.ordered);
  let counter = token.start || 1;
  for (const item of token.items || []) {
    const textTokens = (item.tokens || []).filter((t) => t.type !== 'list');
    if (textTokens.length > 0) {
      const children = [];
      for (const tok of textTokens) {
        if (tok.type === 'paragraph') children.push(...inlineToChildren(tok.tokens || []));
        else children.push(new TextRun({ text: decodeHtmlEntities(tok.text || tok.raw || '') }));
      }
      out.push(
        new Paragraph({
          style: 'Body',
          indent: { left: twipFromPt(level * BRAND.space.listIndent) },
          children: [new TextRun({ text: ordered ? `${counter}. ` : '• ', bold: true, color: hex(BRAND.color.navy) }), ...children],
        })
      );
      if (ordered) counter++;
    } else {
      out.push(
        new Paragraph({
          style: 'Body',
          indent: { left: twipFromPt(level * BRAND.space.listIndent) },
          children: [new TextRun({ text: ordered ? `${counter}.` : '•' })],
        })
      );
      if (ordered) counter++;
    }
    for (const nested of (item.tokens || []).filter((t) => t.type === 'list')) {
      out.push(...renderList(nested, level + 1));
    }
  }
  return out;
}

function renderCode(token) {
  return new Paragraph({
    style: 'CodeBlock',
    shading: { type: ShadingType.CLEAR, fill: hex(BRAND.color.light), color: 'auto' },
    border: {
      left: { style: BorderStyle.SINGLE, size: 8, color: hex(BRAND.color.navy) },
    },
    children: [new TextRun({ text: token.text || '', font: BRAND.font.mono })],
  });
}

function renderBlockquote(token) {
  const text = (token.tokens || [])
    .map((t) => {
      if (t.type === 'paragraph') return stripInline(t.tokens || []);
      return decodeHtmlEntities(t.text || t.raw || '');
    })
    .join(' ');
  return new Paragraph({
    style: 'Body',
    shading: { type: ShadingType.CLEAR, fill: hex(BRAND.color.pinkTint), color: 'auto' },
    border: {
      left: { style: BorderStyle.SINGLE, size: 10, color: hex(BRAND.color.pink) },
    },
    children: [new TextRun({ text })],
  });
}

function renderRule() {
  return new Paragraph({
    border: {
      bottom: {
        style: BorderStyle.SINGLE,
        color: hex(BRAND.color.grey),
        size: 2,
      },
    },
    spacing: { after: twipFromPt(8) },
  });
}

function cellText(cell) {
  if (typeof cell === 'string') return decodeHtmlEntities(cell);
  if (cell && cell.text) return decodeHtmlEntities(cell.text);
  if (cell && cell.tokens) return stripInline(cell.tokens);
  return '';
}

function renderTable(token) {
  const headers = token.header || [];
  const rows = token.rows || [];
  const cols = Math.max(1, headers.length);
  const widthPct = Math.floor(100 / cols);

  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((h) =>
      new TableCell({
        shading: { type: ShadingType.CLEAR, fill: hex(BRAND.color.navy), color: 'auto' },
        children: [
          new Paragraph({
            children: [new TextRun({ text: cellText(h), bold: true, color: hex(BRAND.color.white) })],
          }),
        ],
      })
    ),
  });

  const bodyRows = rows.map((row, idx) => {
    const fill = idx % 2 === 0 ? hex(BRAND.color.white) : hex(BRAND.color.light);
    return new TableRow({
      children: headers.map((_, colIdx) =>
        new TableCell({
          shading: { type: ShadingType.CLEAR, fill, color: 'auto' },
          children: [new Paragraph({ text: cellText(row[colIdx] || '') })],
        })
      ),
    });
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    rows: [headerRow, ...bodyRows],
    columnWidths: Array(cols).fill(widthPct * 50),
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: hex(BRAND.color.grey) },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: hex(BRAND.color.grey) },
      left: { style: BorderStyle.SINGLE, size: 2, color: hex(BRAND.color.grey) },
      right: { style: BorderStyle.SINGLE, size: 2, color: hex(BRAND.color.grey) },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: hex(BRAND.color.grey) },
      insideVertical: { style: BorderStyle.SINGLE, size: 2, color: hex(BRAND.color.grey) },
    },
    alignment: AlignmentType.CENTER,
  });
}

module.exports = { renderTokensToDocx, inlineToChildren };
