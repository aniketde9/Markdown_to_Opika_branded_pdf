'use strict';

const { buildPDF } = require('./builder');
const { buildDOCX } = require('./builderDocx');

function buildDocument(options) {
  const format = (options.format || 'docx').toLowerCase();
  if (format === 'pdf') {
    return buildPDF(options);
  }
  if (format === 'docx') {
    return buildDOCX(options);
  }
  throw new Error(`Unsupported format: ${format}. Use "docx" or "pdf".`);
}

module.exports = { buildDocument };
