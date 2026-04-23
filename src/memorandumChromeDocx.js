'use strict';

const {
  AlignmentType,
  BorderStyle,
  Footer,
  Header,
  Paragraph,
  TabStopPosition,
  TabStopType,
  TextRun,
  PageNumber,
} = require('docx');
const BRAND = require('./brand');
const { DISCLAIMER } = require('./memorandumChrome');
const { hex, twipFromPt } = require('./docxStyles');

function createMemoHeader() {
  return new Header({
    children: [
      new Paragraph({
        border: {
          bottom: {
            style: BorderStyle.SINGLE,
            color: hex(BRAND.color.grey),
            size: 2,
          },
        },
        spacing: { after: twipFromPt(2) },
      }),
      new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
        spacing: { after: twipFromPt(6) },
        children: [
          new TextRun({
            text: 'OPIKA',
            bold: true,
            font: BRAND.font.mono,
            size: 14,
            color: hex(BRAND.color.navy),
          }),
          new TextRun({ text: '\t' }),
          new TextRun({
            text: 'ENGAGEMENT MARKETING MEMORANDUM',
            font: BRAND.font.mono,
            size: 14,
            color: hex(BRAND.color.grey),
          }),
        ],
      }),
    ],
  });
}

function createMemoFooter() {
  return new Footer({
    children: [
      new Paragraph({
        border: {
          top: {
            style: BorderStyle.SINGLE,
            color: hex(BRAND.color.grey),
            size: 2,
          },
        },
        spacing: { before: twipFromPt(4), after: twipFromPt(3) },
      }),
      new Paragraph({
        style: 'MemoTiny',
        spacing: { after: twipFromPt(2) },
        children: [
          new TextRun({
            text: DISCLAIMER,
            italics: true,
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        style: 'MemoTiny',
        children: [
          new TextRun({ text: '-- ' }),
          new TextRun({ children: [PageNumber.CURRENT] }),
          new TextRun({ text: ' --', font: BRAND.font.mono }),
        ],
      }),
    ],
  });
}

module.exports = { createMemoHeader, createMemoFooter };
