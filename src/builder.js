'use strict';

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const BRAND = require('./brand');
const { parseMarkdown } = require('./parser');
const { renderTokens } = require('./renderer');
const { attachRunningHeader, drawPreparedForBlock, drawMemorandumFooter } = require('./memorandumChrome');
const { splitFrontmatter, isEmmTemplate } = require('./emmParse');
const { renderEmmDocument } = require('./emmRender');

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

/** With memorandum cover, first `#` is the recipient line — do not repeat in body. */
function stripLeadingH1ForCover(tokens) {
  if (!tokens || tokens.length === 0) return tokens;
  const first = tokens[0];
  if (first.type !== 'heading' || first.depth !== 1) return tokens;
  return tokens.slice(1);
}

function mergeEmmAuthor(data, title, subtitle) {
  const out = { ...data };
  out.author = { ...(data.author || {}) };
  if (title) out.author.name = title;
  if (subtitle) out.author.bookLine = subtitle;
  return out;
}

function applyFooters(doc) {
  const range = doc.bufferedPageRange();
  const total = range.count;
  if (total < 1) return;
  if (!doc._emmFooterApplied) doc._emmFooterApplied = new Set();
  const lastPageIndex = range.start + total - 1;
  if (doc._emmFooterApplied.has(lastPageIndex)) return;
  doc._emmFooterApplied.add(lastPageIndex);
  doc.switchToPage(lastPageIndex);
  drawMemorandumFooter(doc, total, total);
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

    let frontData;
    let bodyMarkdown;
    try {
      const sp = splitFrontmatter(markdown);
      frontData = sp.data;
      bodyMarkdown = sp.body;
    } catch (e) {
      reject(e);
      return;
    }

    const useEmm = isEmmTemplate(frontData);
    const emmData = useEmm ? mergeEmmAuthor(frontData, title || null, subtitle || null) : null;

    const docTitle = useEmm
      ? emmData.author?.name || title || fallbackTitle
      : title || inferTitle(bodyMarkdown, fallbackTitle);

    let tokens;
    if (!useEmm) {
      try {
        tokens = parseMarkdown(bodyMarkdown);
      } catch (e) {
        reject(e);
        return;
      }
      if (cover) {
        tokens = stripLeadingH1ForCover(tokens);
      }
    }

    const doc = new PDFDocument({
      size: 'LETTER',
      margins: {
        top: BRAND.page.marginTop,
        bottom: BRAND.page.marginBottom,
        left: BRAND.page.marginLeft,
        right: BRAND.page.marginRight,
      },
      bufferPages: true,
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

    if (header) {
      attachRunningHeader(doc);
    }

    doc.addPage();

    if (useEmm) {
      if (cover && emmData.author && emmData.author.name) {
        const bookLine = emmData.author.bookLine || emmData.author.bookSubtitle || '';
        drawPreparedForBlock(doc, emmData.author.name, bookLine);
      }
      renderEmmDocument(doc, emmData);
    } else {
      if (cover) {
        drawPreparedForBlock(doc, docTitle, subtitle || '');
      }
      renderTokens(doc, tokens, {
        showHeader: false,
        title: docTitle,
      });
    }

    applyFooters(doc);

    stream.once('finish', () => {
      stream.removeListener('error', onError);
      resolve();
    });

    doc.end();
  });
}

module.exports = { buildPDF, inferTitle, registerFonts, FONTS_DIR };
