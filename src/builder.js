'use strict';

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const BRAND = require('./brand');
const { parseMarkdown } = require('./parser');
const { renderTokens } = require('./renderer');
const { drawCoverPage } = require('./cover');

const FONTS_DIR = path.join(__dirname, '../fonts');

const FONT_FILES = [
  ['Roboto-Regular', 'Roboto-Regular.ttf'],
  ['Roboto-Bold', 'Roboto-Bold.ttf'],
  ['Roboto-Italic', 'Roboto-Italic.ttf'],
  ['Roboto-BoldItalic', 'Roboto-BoldItalic.ttf'],
  ['JetBrainsMono-Bold', 'JetBrainsMono-Bold.ttf'],
];

function registerFonts(doc) {
  for (const [name, file] of FONT_FILES) {
    const fp = path.join(FONTS_DIR, file);
    if (!fs.existsSync(fp)) {
      throw new Error(`Missing font file: ${fp}. Run: npm run setup:fonts`);
    }
    doc.registerFont(name, fp);
  }
}

function inferTitle(mdText, fallback) {
  const h1 = mdText.match(/^#\s+(.+)$/m);
  return h1 ? h1[1].trim() : fallback;
}

/**
 * @param {object} options
 * @param {string} options.markdown
 * @param {import('stream').Writable} [options.outputStream]
 * @param {string} [options.outputPath]
 * @param {string} [options.title]
 * @param {string|null} [options.subtitle]
 * @param {boolean} [options.cover=true]
 * @param {boolean} [options.header=true]
 * @param {string} [options.fallbackTitle='Document']
 * @returns {Promise<void>}
 */
function buildPDF(options) {
  const {
    markdown,
    outputStream,
    outputPath,
    title,
    subtitle = null,
    cover = true,
    header = true,
    fallbackTitle = 'Document',
  } = options;

  return new Promise((resolve, reject) => {
    let stream = outputStream;
    if (!stream && outputPath) {
      stream = fs.createWriteStream(outputPath);
    }
    if (!stream) {
      reject(new Error('buildPDF requires outputStream or outputPath'));
      return;
    }

    const docTitle = title || inferTitle(markdown, fallbackTitle);
    let tokens;
    try {
      tokens = parseMarkdown(markdown);
    } catch (e) {
      reject(e);
      return;
    }

    const doc = new PDFDocument({
      size: 'LETTER',
      margins: {
        top: BRAND.page.marginTop,
        bottom: BRAND.page.marginBottom,
        left: BRAND.page.marginLeft,
        right: BRAND.page.marginRight,
      },
      bufferPages: false,
      autoFirstPage: false,
      info: {
        Title: docTitle,
        Author: 'Opika',
        Creator: 'md-to-pdf',
      },
    });

    try {
      registerFonts(doc);
    } catch (e) {
      reject(e);
      return;
    }

    const onError = (err) => reject(err);
    stream.once('error', onError);

    doc.pipe(stream);

    if (cover) {
      drawCoverPage(doc, docTitle, subtitle);
      doc.addPage();
    } else {
      doc.addPage();
    }

    renderTokens(doc, tokens, {
      showHeader: header,
      title: docTitle,
    });

    stream.once('finish', () => {
      stream.removeListener('error', onError);
      resolve();
    });

    doc.end();
  });
}

module.exports = { buildPDF, inferTitle, registerFonts, FONTS_DIR };
