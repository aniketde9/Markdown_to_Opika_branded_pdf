'use strict';

const {
  BorderStyle,
  ExternalHyperlink,
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
const { hex, twipFromPt } = require('./docxStyles');
const { inlineToChildren } = require('./rendererDocx');
const { Lexer } = require('marked');

function toInlineRuns(text) {
  const tokens = Lexer.lexInline(String(text || ''));
  return inlineToChildren(tokens);
}

function makeSectionHeading(label) {
  return new Paragraph({
    style: 'H2',
    text: String(label || '').toUpperCase(),
    border: {
      bottom: { style: BorderStyle.SINGLE, color: hex(BRAND.color.pink), size: 6 },
    },
    spacing: { before: twipFromPt(8), after: twipFromPt(6) },
  });
}

function linksBlock(links) {
  const li = (links && links.linkedin) || '#';
  const em = (links && links.email) || '#';
  return [
    new Paragraph({
      children: [
        new TextRun({ text: '[A] LinkedIn Posts — ', bold: true, color: hex(BRAND.color.orange) }),
        new ExternalHyperlink({
          link: li,
          children: [new TextRun({ text: 'View Here', color: hex(BRAND.color.pink), underline: {} })],
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: twipFromPt(10) },
      children: [
        new TextRun({ text: '[B] Email Nurture Sequence — ', bold: true, color: hex(BRAND.color.orange) }),
        new ExternalHyperlink({
          link: em,
          children: [new TextRun({ text: 'View Here', color: hex(BRAND.color.pink), underline: {} })],
        }),
      ],
    }),
  ];
}

function preparedForBlock(author) {
  const name = (author && author.name) || '';
  const bookLine = (author && (author.bookLine || author.bookSubtitle)) || '';
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { type: ShadingType.CLEAR, fill: hex(BRAND.color.navy), color: 'auto' },
            borders: {
              top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
              bottom: { style: BorderStyle.NONE, size: 0, color: 'auto' },
              left: { style: BorderStyle.NONE, size: 0, color: 'auto' },
              right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
            },
            children: [
              new Paragraph({
                spacing: { before: twipFromPt(8), after: twipFromPt(6) },
                children: [new TextRun({ text: 'PREPARED FOR', color: hex(BRAND.color.grey), font: BRAND.font.mono })],
              }),
              new Paragraph({
                spacing: { after: twipFromPt(8) },
                children: [
                  new TextRun({
                    text: name,
                    color: hex(BRAND.color.white),
                    bold: true,
                    font: BRAND.font.mono,
                    size: BRAND.memorandum.coverNameSize * 2,
                  }),
                ],
              }),
              new Paragraph({
                spacing: { after: twipFromPt(10) },
                children: [
                  new TextRun({
                    text: bookLine,
                    color: hex(BRAND.color.white),
                    italics: true,
                    font: BRAND.font.italic,
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

function signalTable(rows) {
  const items = Array.isArray(rows) ? rows : [];
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({
        tableHeader: true,
        children: ['SIGNAL', 'STATUS'].map((h) =>
          new TableCell({
            shading: { type: ShadingType.CLEAR, fill: hex(BRAND.color.navy), color: 'auto' },
            children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, color: hex(BRAND.color.white) })] })],
          })
        ),
      }),
      ...items.map((row, idx) => {
        const fill = idx % 2 === 0 ? hex(BRAND.color.white) : hex(BRAND.color.light);
        return new TableRow({
          children: [
            new TableCell({
              shading: { type: ShadingType.CLEAR, fill, color: 'auto' },
              children: [new Paragraph({ children: [new TextRun({ text: String(row.signal || ''), bold: true })] })],
            }),
            new TableCell({
              shading: { type: ShadingType.CLEAR, fill, color: 'auto' },
              children: [new Paragraph(String(row.status || ''))],
            }),
          ],
        });
      }),
    ],
  });
}

function journeyTable(rows) {
  const items = Array.isArray(rows) ? rows : [];
  const heads = ['WHERE YOU ARE', 'THE GAP', "WHERE YOU'RE GOING"];
  const fills = [hex(BRAND.color.navy), hex(BRAND.color.pink), hex(BRAND.color.orange)];
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({
        tableHeader: true,
        children: heads.map((h, idx) =>
          new TableCell({
            shading: { type: ShadingType.CLEAR, fill: fills[idx], color: 'auto' },
            children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, color: hex(BRAND.color.white) })] })],
          })
        ),
      }),
      ...items.map((row, idx) => {
        const fill = idx % 2 === 0 ? hex(BRAND.color.white) : hex(BRAND.color.light);
        return new TableRow({
          children: [
            new TableCell({
              shading: { type: ShadingType.CLEAR, fill, color: 'auto' },
              children: [new Paragraph(String(row.from || ''))],
            }),
            new TableCell({
              shading: { type: ShadingType.CLEAR, fill, color: 'auto' },
              children: [new Paragraph({ children: [new TextRun({ text: String(row.gap || ''), italics: true })] })],
            }),
            new TableCell({
              shading: { type: ShadingType.CLEAR, fill, color: 'auto' },
              children: [new Paragraph({ children: [new TextRun({ text: String(row.to || ''), bold: true })] })],
            }),
          ],
        });
      }),
    ],
  });
}

function callout(fill, lead, body) {
  const children = [];
  if (lead) {
    children.push(new Paragraph({ children: [new TextRun({ text: lead, bold: true, color: hex(BRAND.color.pink) })] }));
  }
  if (body) {
    children.push(new Paragraph({ children: toInlineRuns(body) }));
  }
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { type: ShadingType.CLEAR, fill: hex(fill), color: 'auto' },
            borders: {
              left: { style: BorderStyle.SINGLE, color: hex(BRAND.color.pink), size: 10 },
            },
            children,
          }),
        ],
      }),
    ],
  });
}

function ctaCallout(cta) {
  return callout(
    BRAND.color.orangeTint,
    cta && cta.line1 ? cta.line1 : '',
    `${(cta && cta.line2) || ''}${cta && cta.email ? `\n${cta.email}` : ''}`
  );
}

function renderEmmDocumentDocx(data) {
  const out = [];
  out.push(preparedForBlock(data.author || {}));
  out.push(...linksBlock(data.notionLinks || data.links || {}));

  if (data.intro) out.push(new Paragraph({ children: toInlineRuns(data.intro) }));

  out.push(makeSectionHeading('Executive Summary'));
  const exec = Array.isArray(data.execSummary) ? data.execSummary : [];
  exec.forEach((p) => out.push(new Paragraph({ children: toInlineRuns(p) })));

  out.push(makeSectionHeading("Work We've Done"));
  const work = Array.isArray(data.workWeDone) ? data.workWeDone : [];
  work.forEach((p) => out.push(new Paragraph({ children: toInlineRuns(p) })));

  out.push(makeSectionHeading('Your Current State'));
  out.push(signalTable(data.currentState || []));

  if (data.observation) {
    out.push(callout(BRAND.color.pinkTint, data.observation.lead || '', data.observation.body || ''));
  }

  out.push(makeSectionHeading('Your Journey Map'));
  out.push(journeyTable(data.journeyMap || []));

  out.push(makeSectionHeading("What We're Proposing"));
  const props = data.proposals || {};
  if (props.intro) out.push(new Paragraph({ children: toInlineRuns(props.intro) }));
  (Array.isArray(props.items) ? props.items : []).forEach((item, idx) => {
    const text = typeof item === 'string' ? item : item.text || item.body || '';
    out.push(
      new Paragraph({
        children: [new TextRun({ text: `${idx + 1}. `, bold: true }), ...toInlineRuns(String(text).replace(/^\d+\.\s*/, ''))],
      })
    );
  });

  if (data.cta) out.push(ctaCallout(data.cta));
  return out;
}

module.exports = { renderEmmDocumentDocx };
