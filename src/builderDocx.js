'use strict';

const fs = require('fs');
const {
  Document,
  Packer,
} = require('docx');
const { parseMarkdown } = require('./parser');
const { inferTitle } = require('./builder');
const { splitFrontmatter, isEmmTemplate } = require('./emmParse');
const { renderTokensToDocx } = require('./rendererDocx');
const { renderEmmDocumentDocx } = require('./emmRenderDocx');
const { createStyles, createPageProperties } = require('./docxStyles');
const { createMemoHeader, createMemoFooter } = require('./memorandumChromeDocx');

function mergeEmmAuthor(data, title, subtitle) {
  const out = { ...data };
  out.author = { ...(data.author || {}) };
  if (title) out.author.name = title;
  if (subtitle) out.author.bookLine = subtitle;
  return out;
}

async function outputDoc(document, outputPath, outputStream) {
  const buffer = await Packer.toBuffer(document);
  if (outputPath) {
    await fs.promises.writeFile(outputPath, buffer);
    return;
  }
  if (!outputStream) throw new Error('buildDOCX requires outputStream or outputPath');
  outputStream.write(buffer);
  outputStream.end();
}

async function buildDOCX(options) {
  const {
    markdown,
    outputPath,
    outputStream,
    title,
    subtitle = null,
    fallbackTitle = 'Document',
  } = options;

  let frontData;
  let bodyMarkdown;
  const split = splitFrontmatter(markdown);
  frontData = split.data;
  bodyMarkdown = split.body;

  const useEmm = isEmmTemplate(frontData);
  const emmData = useEmm ? mergeEmmAuthor(frontData, title || null, subtitle || null) : null;
  const docTitle = useEmm
    ? emmData.author?.name || title || fallbackTitle
    : title || inferTitle(bodyMarkdown, fallbackTitle);

  const children = useEmm
    ? renderEmmDocumentDocx(emmData)
    : renderTokensToDocx(parseMarkdown(bodyMarkdown));

  const doc = new Document({
    creator: 'Opika',
    title: docTitle,
    description: 'Opika branded markdown to DOCX converter',
    styles: createStyles(),
    sections: [
      {
        properties: { page: createPageProperties() },
        headers: { default: createMemoHeader() },
        footers: { default: createMemoFooter() },
        children,
      },
    ],
  });

  await outputDoc(doc, outputPath, outputStream);
}

module.exports = { buildDOCX };
