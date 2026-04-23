'use strict';

const BRAND = require('./brand');

function hex(color) {
  return String(color || '').replace('#', '');
}

function twipFromPt(pt) {
  return Math.round(pt * 20);
}

function createStyles() {
  return {
    default: {
      document: {
        run: {
          font: BRAND.font.regular,
          size: BRAND.size.body * 2,
          color: hex(BRAND.color.dark),
        },
        paragraph: {
          spacing: {
            after: twipFromPt(BRAND.space.afterPara),
          },
        },
      },
    },
    paragraphStyles: [
      {
        id: 'Body',
        name: 'Body',
        basedOn: 'Normal',
        quickFormat: true,
        run: {
          font: BRAND.font.regular,
          size: BRAND.size.body * 2,
          color: hex(BRAND.color.dark),
        },
        paragraph: {
          spacing: { after: twipFromPt(BRAND.space.afterPara) },
        },
      },
      {
        id: 'H1',
        name: 'H1',
        basedOn: 'Normal',
        run: {
          font: BRAND.font.mono,
          bold: true,
          size: BRAND.size.h1 * 2,
          color: hex(BRAND.color.navy),
        },
        paragraph: {
          spacing: {
            before: twipFromPt(12),
            after: twipFromPt(BRAND.space.afterH1),
          },
        },
      },
      {
        id: 'H2',
        name: 'H2',
        basedOn: 'Normal',
        run: {
          font: BRAND.font.mono,
          bold: true,
          size: BRAND.size.h2 * 2,
          color: hex(BRAND.color.navy),
        },
        paragraph: {
          spacing: {
            before: twipFromPt(10),
            after: twipFromPt(BRAND.space.afterH2),
          },
        },
      },
      {
        id: 'H3',
        name: 'H3',
        basedOn: 'Normal',
        run: {
          font: BRAND.font.bold,
          bold: true,
          size: BRAND.size.h3 * 2,
          color: hex(BRAND.color.dark),
        },
        paragraph: {
          spacing: {
            before: twipFromPt(8),
            after: twipFromPt(BRAND.space.afterH3),
          },
        },
      },
      {
        id: 'CodeBlock',
        name: 'CodeBlock',
        basedOn: 'Normal',
        run: {
          font: BRAND.font.mono,
          size: BRAND.size.code * 2,
          color: hex(BRAND.color.dark),
        },
        paragraph: {
          spacing: {
            before: twipFromPt(6),
            after: twipFromPt(BRAND.space.afterCode),
          },
        },
      },
      {
        id: 'MemoTiny',
        name: 'MemoTiny',
        basedOn: 'Normal',
        run: {
          font: BRAND.font.regular,
          size: 14,
          color: hex(BRAND.color.grey),
        },
      },
    ],
  };
}

function createPageProperties() {
  return {
    margin: {
      top: twipFromPt(BRAND.page.marginTop),
      right: twipFromPt(BRAND.page.marginRight),
      bottom: twipFromPt(BRAND.page.marginBottom),
      left: twipFromPt(BRAND.page.marginLeft),
    },
  };
}

module.exports = {
  hex,
  twipFromPt,
  createStyles,
  createPageProperties,
};
